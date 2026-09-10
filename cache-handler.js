/**
 * Begrenzter ISR-Cache-Handler (Incident 10.09.2026).
 *
 * ── Warum es diese Datei gibt ────────────────────────────────────────────
 * Next.js legt den Incremental-Cache über den eingebauten FileSystemCache
 * auf Platte ab, und zwar unter `<distDir>/server/app/**` (Seiten, RSC-
 * Payloads, Segment-Prefetches) sowie `<distDir>/cache/fetch-cache/**`
 * (unstable_cache + fetch). Dieser Cache kennt **kein Größenlimit**: er
 * wächst, solange Requests hereinkommen.
 *
 * Auf lasstreffen.at ist das ein echtes Problem, weil ~280k Event-Detail-
 * seiten existieren und Crawler den kompletten Long Tail durchgehen. Jede
 * besuchte Seite schreibt `.html` + `.rsc` + `.meta` + ein `.segments/`-
 * Verzeichnis mit Prefetch-Segmenten, in Summe grob 90 KB. Am 10.09.2026
 * standen nach 7 Stunden Laufzeit 39 GB im Writable-Layer des Containers
 * (775k .rsc-Dateien allein unter de/events), die 75-GB-Platte lief auf
 * 100 % und Postgres ging in den Crash-Loop:
 *   FATAL: could not write to file "pg_wal/xlogtemp.33": No space left on device
 *
 * Auf Betriebsebene fängt das seit dem Incident `/opt/app/isr-guard.sh`
 * (lt-isr-guard.timer) ab, indem er den Container ab 70 % Plattenbelegung
 * neu erzeugt. Das ist die Notbremse. Diese Datei ist der eigentliche Fix:
 * der Cache wächst gar nicht erst über ein Limit hinaus.
 *
 * ── Warum ein Wrapper und kein eigener Store ─────────────────────────────
 * Der naheliegende Weg wäre ein komplett eigener Handler mit eigenem
 * Serialisierungsformat. Das ist hier bewusst NICHT gemacht: die Cache-
 * Werte enthalten `rscData: Buffer` und `segmentData: Map<string, Buffer>`
 * (siehe next/dist/server/response-cache/types.d.ts). Beides überlebt ein
 * naives JSON.stringify nicht, und ein falsch serialisierter RSC-Payload
 * äußert sich nicht als sauberer Fehler, sondern als kaputte Hydration auf
 * zufälligen Seiten. Deshalb delegieren get/set/revalidateTag unverändert
 * an den eingebauten FileSystemCache; wir ergänzen ausschließlich das, was
 * fehlt: eine Obergrenze mit LRU-artiger Räumung.
 *
 * ── Was geräumt wird (und was nicht) ─────────────────────────────────────
 * Geräumt werden ausschließlich Einträge, die NACH dem Prozessstart
 * geschrieben wurden (mtime >= PROCESS_START_MS). Alles Ältere stammt aus
 * dem Docker-Image, also aus `next build` (generateStaticParams-Prerenders).
 * Die dürfen nicht verschwinden: sie kämen nie wieder als Build-Artefakt
 * zurück, sondern müssten ab dann bei jedem Request dynamisch gerendert
 * werden. Das Limit gilt damit für den Laufzeit-Cache; die feste Größe des
 * Build-Outputs liegt im Image und ist beim Setzen von ISR_CACHE_MAX_BYTES
 * bereits einkalkuliert.
 *
 * Geräumt wird immer der komplette Key, also `.html` + `.rsc` + `.meta` +
 * `.segments/` gemeinsam. Ein halb gelöschter Eintrag wäre zwar nicht
 * fatal (der FileSystemCache behandelt eine fehlende Datei als Miss), er
 * hinterließe aber Müll, den kein späterer Lauf mehr zuordnen kann.
 *
 * Sortiert wird nach mtime, nicht nach echter Zugriffszeit: atime ist unter
 * relatime praktisch unbrauchbar, und mtime ist hier ein gutes Signal, weil
 * Next einen Eintrag nur dann neu schreibt, wenn er nach Ablauf von
 * `revalidate` tatsächlich wieder angefragt wurde. Die am längsten nicht
 * erneuerte Seite ist also auch die am längsten nicht besuchte.
 *
 * ── Konfiguration ────────────────────────────────────────────────────────
 *   ISR_CACHE_MAX_BYTES     Obergrenze des Laufzeit-Caches (Default 4 GiB)
 *   ISR_CACHE_TARGET_RATIO  Füllstand nach dem Sweep (Default 0.8)
 *   ISR_CACHE_DEBUG         '1' → jeder Sweep wird geloggt, auch No-ops
 */

/**
 * ── Warum die Node-Module hier so umständlich geladen werden ─────────────
 * Diese Datei landet NICHT nur im Node-Server-Bundle. Sobald `cacheHandler`
 * in next.config.ts gesetzt ist, importiert Next sie auch in die Edge-
 * Runtime-Entries (next-edge-ssr-loader/index.js zieht die Option per
 * `this.utils.contextify(..., cacheHandler)` in den Edge-Chunk). Das Projekt
 * hat keine Edge-Seiten, aber src/middleware.ts läuft ohne explizite Runtime
 * auf Edge — und damit landete die Datei dort.
 *
 * Ein Top-Level `require('node:path')` hat deshalb am 10.09.2026 die
 * Produktion umgeworfen: der Docker-Build lief sauber durch, das Image
 * entstand, und erst der erste Request nach dem Start scheiterte mit
 *   Error: Cannot find module 'node:path': Unsupported external type Url
 *   for commonjs reference    at .next/server/edge/chunks/_0a9h9~9._.js
 * Ein lokaler `next build` hätte das nie gezeigt.
 *
 * Zwei Absicherungen, weil eine allein jeweils auf einer Annahme beruht:
 *
 *   1. `process.env.NEXT_RUNTIME` unterscheidet 'edge' von 'nodejs'. In der
 *      Edge-Runtime bleibt `inner` null und der Handler ist ein No-op. Das
 *      ist korrekt und nicht bloß Schadensbegrenzung: in der Edge-Runtime
 *      gibt es kein Dateisystem, dort ist ein FS-Cache ohnehin unmöglich,
 *      und die Middleware cacht nichts.
 *   2. Der Zugriff läuft über `eval('require')`. Damit sieht der Bundler
 *      keinen auflösbaren Import und packt node:path/node:fs gar nicht erst
 *      in den Edge-Chunk — unabhängig davon, ob er den Guard aus (1) als
 *      toten Code erkennt und wegoptimiert. Hässlich, aber genau das ist
 *      der Punkt: die statische Analyse soll hier nichts finden.
 */
const IS_EDGE_RUNTIME = process.env.NEXT_RUNTIME === 'edge';

let path = null;
let fs = null;
let FileSystemCache = null;

if (!IS_EDGE_RUNTIME) {
  // eslint-disable-next-line no-eval
  const nodeRequire = eval('require');
  path = nodeRequire('node:path');
  fs = nodeRequire('node:fs/promises');

  // Interner Next-Pfad. Bewusst hart geladen statt weich abgesichert: wenn
  // ein Next-Upgrade ihn verschiebt, soll der Server laut scheitern statt
  // still ohne Cache weiterzulaufen. Ein stiller Cache-Ausfall wäre der
  // schlechtere Zustand — die Seite bliebe oben, würde aber jede Anfrage
  // gegen die Supabase-Micro-Instanz rendern.
  const mod = nodeRequire('next/dist/server/lib/incremental-cache/file-system-cache');
  FileSystemCache = mod.default || mod;

  if (typeof FileSystemCache !== 'function') {
    throw new Error(
      '[isr-cache] FileSystemCache konnte nicht geladen werden ' +
        '(next/dist/server/lib/incremental-cache/file-system-cache). ' +
        'Vermutlich hat ein Next.js-Upgrade den Pfad geändert — cache-handler.js anpassen.',
    );
  }
}

const GiB = 1024 * 1024 * 1024;

function positiveNumberFromEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const MAX_BYTES = positiveNumberFromEnv('ISR_CACHE_MAX_BYTES', 4 * GiB);
const TARGET_RATIO = Math.min(positiveNumberFromEnv('ISR_CACHE_TARGET_RATIO', 0.8), 0.95);
const TARGET_BYTES = Math.floor(MAX_BYTES * TARGET_RATIO);
const DEBUG = process.env.ISR_CACHE_DEBUG === '1';

// Ein Sweep scannt das Cache-Verzeichnis vollständig. Bei ~45k Dateien sind
// das einige hundert Millisekunden, deshalb läuft er nicht bei jedem set,
// sondern erst nachdem grob SWEEP_TRIGGER_BYTES neu geschrieben wurden, und
// nie öfter als alle SWEEP_MIN_INTERVAL_MS.
const SWEEP_TRIGGER_BYTES = 128 * 1024 * 1024;
const SWEEP_MIN_INTERVAL_MS = 30_000;

// Alles, was vor dem Prozessstart auf der Platte lag, stammt aus dem Build.
const PROCESS_START_MS = Date.now();

/** Endungen, die der FileSystemCache an einen Cache-Key anhängt. */
const SEGMENTS_DIR_SUFFIX = '.segments';

/**
 * Bildet einen Dateipfad auf seinen Cache-Key ab, damit zusammengehörige
 * Dateien gemeinsam geräumt werden.
 *
 *   /c/app/de/events/x.html            → /c/app/de/events/x
 *   /c/app/de/events/x.rsc             → /c/app/de/events/x
 *   /c/app/de/events/x.meta            → /c/app/de/events/x
 *   /c/app/de/events/x.segments/y.rsc  → /c/app/de/events/x
 *   /c/cache/fetch-cache/abc123        → /c/cache/fetch-cache/abc123
 *
 * Keys mit Punkt im Namen (etwa `sitemap.xml.body` und `sitemap.xml.meta`)
 * fallen korrekt zusammen, weil immer nur die LETZTE Endung entfernt wird.
 */
function cacheKeyForPath(filePath) {
  const segmentsIdx = filePath.indexOf(SEGMENTS_DIR_SUFFIX + path.sep);
  if (segmentsIdx !== -1) return filePath.slice(0, segmentsIdx);

  const ext = path.extname(filePath);
  return ext ? filePath.slice(0, -ext.length) : filePath;
}

/**
 * Sammelt alle Cache-Einträge unterhalb von `dir`, gruppiert nach Key.
 *
 * Das `.segments`-Verzeichnis wird als EIN Pfad geführt (rekursiv löschbar),
 * seine Bytes werden aber vollständig aufsummiert — sonst würde der Sweep
 * den Platzbedarf der Prefetch-Segmente unterschätzen, und die machen bei
 * uns den Löwenanteil aus (775k Segment-Dateien gegenüber 80k HTML-Seiten).
 */
async function collectEntries(dir, entries) {
  let dirents;
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    // Verzeichnis existiert noch nicht (frischer Container) oder wurde
    // parallel geräumt — beides kein Fehlerfall.
    return entries;
  }

  for (const dirent of dirents) {
    const full = path.join(dir, dirent.name);

    if (dirent.isDirectory()) {
      if (dirent.name.endsWith(SEGMENTS_DIR_SUFFIX)) {
        const key = full.slice(0, -SEGMENTS_DIR_SUFFIX.length);
        const stats = await directorySize(full);
        addToEntry(entries, key, stats.bytes, stats.mtimeMs, full);
      } else {
        await collectEntries(full, entries);
      }
      continue;
    }

    if (!dirent.isFile()) continue;

    try {
      const stat = await fs.stat(full);
      addToEntry(entries, cacheKeyForPath(full), stat.size, stat.mtimeMs, full);
    } catch {
      /* Datei ist zwischen readdir und stat verschwunden — ignorieren */
    }
  }

  return entries;
}

function addToEntry(entries, key, bytes, mtimeMs, filePath) {
  let entry = entries.get(key);
  if (!entry) {
    entry = { key, bytes: 0, mtimeMs: 0, paths: [] };
    entries.set(key, entry);
  }
  entry.bytes += bytes;
  // Der jüngste Zeitstempel gewinnt: wird die Seite revalidiert, werden
  // .html/.rsc/.meta gemeinsam neu geschrieben, aber ein einzelnes altes
  // Segment darf den ganzen Eintrag nicht künstlich alt aussehen lassen.
  if (mtimeMs > entry.mtimeMs) entry.mtimeMs = mtimeMs;
  entry.paths.push(filePath);
}

async function directorySize(dir) {
  let bytes = 0;
  let mtimeMs = 0;
  let dirents;
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return { bytes, mtimeMs };
  }
  for (const dirent of dirents) {
    const full = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      const nested = await directorySize(full);
      bytes += nested.bytes;
      if (nested.mtimeMs > mtimeMs) mtimeMs = nested.mtimeMs;
      continue;
    }
    try {
      const stat = await fs.stat(full);
      bytes += stat.size;
      if (stat.mtimeMs > mtimeMs) mtimeMs = stat.mtimeMs;
    } catch {
      /* verschwunden — ignorieren */
    }
  }
  return { bytes, mtimeMs };
}

/**
 * Räumt die übergebenen Verzeichnisse auf die Zielgröße herunter.
 *
 * Exportiert, damit die Logik ohne laufenden Next-Server testbar ist
 * (siehe tests/cache-handler.test.ts).
 *
 * @returns {Promise<{scanned:number, evictable:number, bytesBefore:number, bytesAfter:number, evicted:number}>}
 */
async function sweepCacheDirs({ dirs, maxBytes, targetBytes, minMtimeMs }) {
  const entries = new Map();
  for (const dir of dirs) {
    await collectEntries(dir, entries);
  }

  const all = [...entries.values()];
  // Build-Artefakte sind tabu (siehe Kopfkommentar).
  const evictable = all.filter((entry) => entry.mtimeMs >= minMtimeMs);
  const bytesBefore = evictable.reduce((sum, entry) => sum + entry.bytes, 0);

  if (bytesBefore <= maxBytes) {
    return {
      scanned: all.length,
      evictable: evictable.length,
      bytesBefore,
      bytesAfter: bytesBefore,
      evicted: 0,
    };
  }

  // Ältester Eintrag zuerst.
  evictable.sort((a, b) => a.mtimeMs - b.mtimeMs);

  let bytesAfter = bytesBefore;
  let evicted = 0;
  for (const entry of evictable) {
    if (bytesAfter <= targetBytes) break;
    let removed = true;
    for (const filePath of entry.paths) {
      try {
        await fs.rm(filePath, { force: true, recursive: true });
      } catch {
        removed = false;
      }
    }
    if (removed) {
      bytesAfter -= entry.bytes;
      evicted += 1;
    }
  }

  return { scanned: all.length, evictable: evictable.length, bytesBefore, bytesAfter, evicted };
}

/** Grobe Größenschätzung eines Cache-Werts — dient nur als Sweep-Auslöser. */
function estimateBytes(data) {
  if (!data) return 0;
  let bytes = 0;
  if (typeof data.html === 'string') bytes += data.html.length;
  if (data.rscData && typeof data.rscData.length === 'number') bytes += data.rscData.length;
  if (data.body && typeof data.body.length === 'number') bytes += data.body.length;
  if (data.segmentData && typeof data.segmentData.forEach === 'function') {
    data.segmentData.forEach((value) => {
      if (value && typeof value.length === 'number') bytes += value.length;
    });
  }
  return bytes;
}

module.exports = class BoundedFileSystemCache {
  constructor(ctx) {
    this.pendingBytes = 0;
    this.lastSweepMs = 0;
    this.sweeping = false;
    this.sweepDirs = [];

    // Edge-Runtime: kein Dateisystem, also kein Cache. Siehe Kopfkommentar —
    // die Datei landet dort nur, weil Next sie in den Edge-Entry importiert.
    if (IS_EDGE_RUNTIME) {
      this.inner = null;
      return;
    }

    this.inner = new FileSystemCache(ctx);

    // serverDistDir zeigt auf `<distDir>/server`. Der FileSystemCache legt
    // App-Router-Einträge unter `server/app` ab und den fetch-cache eine
    // Ebene höher unter `cache/fetch-cache` (siehe getFilePath() dort).
    const serverDistDir = ctx && ctx.serverDistDir ? ctx.serverDistDir : null;
    if (serverDistDir) {
      this.sweepDirs = [
        path.join(serverDistDir, 'app'),
        path.join(serverDistDir, '..', 'cache', 'fetch-cache'),
      ];
    }
  }

  get(...args) {
    if (!this.inner) return Promise.resolve(null);
    return this.inner.get(...args);
  }

  async set(key, data, ctx) {
    if (!this.inner) return;
    await this.inner.set(key, data, ctx);
    this.pendingBytes += estimateBytes(data);
    if (this.pendingBytes >= SWEEP_TRIGGER_BYTES) {
      // Bewusst nicht awaited: der Sweep darf den Request nicht aufhalten.
      // Fehler werden in maybeSweep() geschluckt und geloggt.
      void this.maybeSweep();
    }
  }

  revalidateTag(...args) {
    if (!this.inner) return Promise.resolve();
    return this.inner.revalidateTag(...args);
  }

  resetRequestCache() {
    if (!this.inner) return;
    return this.inner.resetRequestCache();
  }

  async maybeSweep() {
    const now = Date.now();
    if (this.sweeping) return;
    if (now - this.lastSweepMs < SWEEP_MIN_INTERVAL_MS) return;
    if (this.sweepDirs.length === 0) return;

    this.sweeping = true;
    this.pendingBytes = 0;
    this.lastSweepMs = now;

    try {
      const result = await sweepCacheDirs({
        dirs: this.sweepDirs,
        maxBytes: MAX_BYTES,
        targetBytes: TARGET_BYTES,
        minMtimeMs: PROCESS_START_MS,
      });
      if (result.evicted > 0 || DEBUG) {
        const mb = (bytes) => Math.round(bytes / (1024 * 1024));
        console.log(
          `[isr-cache] sweep: ${result.evicted} Eintraege geraeumt, ` +
            `${mb(result.bytesBefore)} MB -> ${mb(result.bytesAfter)} MB ` +
            `(Limit ${mb(MAX_BYTES)} MB, ${result.evictable}/${result.scanned} raeumbar)`,
        );
      }
    } catch (error) {
      // Ein fehlgeschlagener Sweep darf niemals eine Seite mitreißen. Die
      // Notbremse auf Betriebsebene (lt-isr-guard.timer) greift ohnehin.
      console.error('[isr-cache] sweep fehlgeschlagen:', error);
    } finally {
      this.sweeping = false;
    }
  }
};

// Für Tests: die reine Räum-Logik ohne Next-Server.
module.exports.sweepCacheDirs = sweepCacheDirs;
module.exports.cacheKeyForPath = cacheKeyForPath;
