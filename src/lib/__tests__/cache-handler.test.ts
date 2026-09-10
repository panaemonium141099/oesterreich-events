// @vitest-environment node
/**
 * Tests für die Räum-Logik des begrenzten ISR-Cache-Handlers
 * (siehe cache-handler.js im Repo-Root, Incident 10.09.2026).
 *
 * Geprüft wird ausschließlich sweepCacheDirs/cacheKeyForPath gegen ein
 * echtes temporäres Verzeichnis. Die Delegation an den FileSystemCache
 * braucht einen laufenden Next-Server und ist hier bewusst nicht Teil des
 * Testumfangs — sie ist reines Weiterreichen ohne eigene Logik.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, utimes, rm, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const cacheHandler = require_('../../../cache-handler.js');
const { sweepCacheDirs, cacheKeyForPath } = cacheHandler as {
  sweepCacheDirs: (opts: {
    dirs: string[];
    maxBytes: number;
    targetBytes: number;
    minMtimeMs: number;
  }) => Promise<{
    scanned: number;
    evictable: number;
    bytesBefore: number;
    bytesAfter: number;
    evicted: number;
  }>;
  cacheKeyForPath: (p: string) => string;
};

let root: string;
let appDir: string;

/** Legt einen kompletten Cache-Eintrag an, so wie Next ihn schreibt. */
async function writeEntry(
  name: string,
  opts: { bytes: number; ageMs: number; segments?: number },
) {
  const base = path.join(appDir, name);
  await mkdir(path.dirname(base), { recursive: true });

  const when = new Date(Date.now() - opts.ageMs);
  const filler = 'x'.repeat(Math.max(1, Math.floor(opts.bytes / 2)));

  await writeFile(`${base}.html`, filler);
  await writeFile(`${base}.rsc`, filler);
  await writeFile(`${base}.meta`, '{}');

  const written = [`${base}.html`, `${base}.rsc`, `${base}.meta`];

  if (opts.segments) {
    const segDir = `${base}.segments`;
    await mkdir(segDir, { recursive: true });
    for (let i = 0; i < opts.segments; i += 1) {
      const segPath = path.join(segDir, `seg${i}.segment.rsc`);
      await writeFile(segPath, filler);
      written.push(segPath);
    }
  }

  for (const p of written) await utimes(p, when, when);
  return base;
}

async function countFiles(dir: string): Promise<number> {
  let total = 0;
  for (const dirent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, dirent.name);
    if (dirent.isDirectory()) total += await countFiles(full);
    else total += 1;
  }
  return total;
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'isr-cache-test-'));
  appDir = path.join(root, 'app');
  await mkdir(appDir, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('cacheKeyForPath', () => {
  it('fasst html, rsc und meta zu einem Key zusammen', () => {
    const base = path.join('c', 'app', 'de', 'events', 'x');
    expect(cacheKeyForPath(`${base}.html`)).toBe(base);
    expect(cacheKeyForPath(`${base}.rsc`)).toBe(base);
    expect(cacheKeyForPath(`${base}.meta`)).toBe(base);
  });

  it('ordnet Segment-Dateien ihrem Elterneintrag zu', () => {
    const base = path.join('c', 'app', 'de', 'events', 'x');
    const seg = path.join(`${base}.segments`, 'foo.segment.rsc');
    expect(cacheKeyForPath(seg)).toBe(base);
  });

  it('entfernt nur die letzte Endung, damit Keys mit Punkt zusammenfallen', () => {
    const base = path.join('c', 'app', 'sitemap.xml');
    expect(cacheKeyForPath(`${base}.body`)).toBe(base);
    expect(cacheKeyForPath(`${base}.meta`)).toBe(base);
  });

  it('lässt endungslose fetch-cache-Keys unverändert', () => {
    const p = path.join('c', 'cache', 'fetch-cache', 'abc123');
    expect(cacheKeyForPath(p)).toBe(p);
  });
});

describe('sweepCacheDirs', () => {
  it('räumt nichts, solange das Limit nicht erreicht ist', async () => {
    await writeEntry('a', { bytes: 1000, ageMs: 5000 });
    await writeEntry('b', { bytes: 1000, ageMs: 4000 });

    const result = await sweepCacheDirs({
      dirs: [appDir],
      maxBytes: 10_000_000,
      targetBytes: 8_000_000,
      minMtimeMs: 0,
    });

    expect(result.evicted).toBe(0);
    expect(result.bytesAfter).toBe(result.bytesBefore);
    expect(existsSync(path.join(appDir, 'a.html'))).toBe(true);
    expect(existsSync(path.join(appDir, 'b.html'))).toBe(true);
  });

  it('räumt den ältesten Eintrag zuerst und stoppt an der Zielgröße', async () => {
    // Drei Einträge à 2002 Bytes (html 1000 + rsc 1000 + meta 2), zusammen
    // 6006. Limit 5000 ist überschritten, nach genau einer Räumung sind noch
    // 4004 übrig — das liegt unter dem Ziel von 4500, also muss der Sweep
    // hier aufhören und nicht blind weiterräumen.
    await writeEntry('alt', { bytes: 2000, ageMs: 900_000 });
    await writeEntry('mittel', { bytes: 2000, ageMs: 600_000 });
    await writeEntry('neu', { bytes: 2000, ageMs: 1000 });

    const result = await sweepCacheDirs({
      dirs: [appDir],
      maxBytes: 5000,
      targetBytes: 4500,
      minMtimeMs: 0,
    });

    expect(result.evicted).toBe(1);
    expect(existsSync(path.join(appDir, 'alt.html'))).toBe(false);
    expect(existsSync(path.join(appDir, 'mittel.html'))).toBe(true);
    expect(existsSync(path.join(appDir, 'neu.html'))).toBe(true);
  });

  it('löscht alle Dateien eines Keys gemeinsam, inklusive Segment-Verzeichnis', async () => {
    await writeEntry('mitsegmenten', { bytes: 2000, ageMs: 900_000, segments: 5 });
    await writeEntry('neu', { bytes: 2000, ageMs: 1000 });

    await sweepCacheDirs({
      dirs: [appDir],
      maxBytes: 3000,
      targetBytes: 2500,
      minMtimeMs: 0,
    });

    expect(existsSync(path.join(appDir, 'mitsegmenten.html'))).toBe(false);
    expect(existsSync(path.join(appDir, 'mitsegmenten.rsc'))).toBe(false);
    expect(existsSync(path.join(appDir, 'mitsegmenten.meta'))).toBe(false);
    expect(existsSync(path.join(appDir, 'mitsegmenten.segments'))).toBe(false);
    // Kein verwaister Rest.
    expect(await countFiles(appDir)).toBe(3);
  });

  it('zählt Segment-Bytes mit, statt sie zu unterschlagen', async () => {
    await writeEntry('a', { bytes: 1000, ageMs: 1000, segments: 10 });

    const result = await sweepCacheDirs({
      dirs: [appDir],
      maxBytes: 10_000_000,
      targetBytes: 8_000_000,
      minMtimeMs: 0,
    });

    // 10 Segmente à ~500 Bytes müssen im Ergebnis auftauchen; ohne sie läge
    // bytesBefore bei rund 1000 statt bei über 5000.
    expect(result.bytesBefore).toBeGreaterThan(5000);
    expect(result.scanned).toBe(1);
  });

  it('rührt Build-Artefakte nicht an, auch wenn sie die ältesten sind', async () => {
    const buildTime = Date.now() - 3_600_000;
    const processStart = Date.now() - 60_000;

    // Aus dem Image (vor Prozessstart geschrieben) — muss überleben.
    await writeEntry('prerendered', { bytes: 4000, ageMs: 3_600_000 });
    // Zur Laufzeit geschrieben — darf geräumt werden.
    await writeEntry('runtime', { bytes: 4000, ageMs: 30_000 });

    const result = await sweepCacheDirs({
      dirs: [appDir],
      maxBytes: 1000,
      targetBytes: 500,
      minMtimeMs: processStart,
    });

    expect(existsSync(path.join(appDir, 'prerendered.html'))).toBe(true);
    expect(existsSync(path.join(appDir, 'runtime.html'))).toBe(false);
    // Nur der Laufzeit-Eintrag zählt gegen das Limit.
    expect(result.evictable).toBe(1);
    expect(result.scanned).toBe(2);
    expect(buildTime).toBeLessThan(processStart);
  });

  it('kommt mit einem noch nicht existierenden Verzeichnis klar', async () => {
    const result = await sweepCacheDirs({
      dirs: [path.join(root, 'gibtsnicht')],
      maxBytes: 1000,
      targetBytes: 500,
      minMtimeMs: 0,
    });

    expect(result.scanned).toBe(0);
    expect(result.evicted).toBe(0);
  });

  it('räumt auch über mehrere Verzeichnisse hinweg', async () => {
    const fetchDir = path.join(root, 'cache', 'fetch-cache');
    await mkdir(fetchDir, { recursive: true });
    const old = new Date(Date.now() - 900_000);
    await writeFile(path.join(fetchDir, 'abc123'), 'y'.repeat(3000));
    await utimes(path.join(fetchDir, 'abc123'), old, old);

    await writeEntry('neu', { bytes: 1000, ageMs: 1000 });

    const result = await sweepCacheDirs({
      dirs: [appDir, fetchDir],
      maxBytes: 2000,
      targetBytes: 1500,
      minMtimeMs: 0,
    });

    expect(result.scanned).toBe(2);
    expect(existsSync(path.join(fetchDir, 'abc123'))).toBe(false);
    expect(existsSync(path.join(appDir, 'neu.html'))).toBe(true);
  });

  it('meldet die tatsächlich geräumte Menge zurück', async () => {
    await writeEntry('a', { bytes: 2000, ageMs: 900_000 });
    await writeEntry('b', { bytes: 2000, ageMs: 800_000 });
    await writeEntry('c', { bytes: 2000, ageMs: 1000 });

    const before = await countFiles(appDir);
    const result = await sweepCacheDirs({
      dirs: [appDir],
      maxBytes: 3000,
      targetBytes: 2500,
      minMtimeMs: 0,
    });
    const after = await countFiles(appDir);

    expect(result.evicted).toBe(2);
    expect(result.bytesAfter).toBeLessThanOrEqual(2500);
    expect(before - after).toBe(6); // zwei Einträge à html+rsc+meta
    const remaining = await stat(path.join(appDir, 'c.html'));
    expect(remaining.size).toBeGreaterThan(0);
  });
});
