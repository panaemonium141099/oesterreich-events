/**
 * DE-Prüfstand (fn-29.3): einen Adapter ohne Datenbank so laufen lassen, wie
 * der Nachtlauf ihn schreiben würde, und gegen die Schwellen des
 * Qualitätsvertrags prüfen.
 *
 *   1. Seiten über den Prüfstand-Cache laden (erstes Mal aus dem Netz, danach
 *      offline), damit Vorher/Nachher denselben Quellstand sieht.
 *   2. Derselbe Schreibweg wie supabase-sync: normalizeEventTimestamps →
 *      filterValidEvents → toSupabaseRow (ohne Bestand, ohne Schreiben).
 *   3. Metriken gegen die AT-Referenz (data/pruefstand/at-referenz.json),
 *      Diff nach source_id gegen den letzten Lauf, Stichprobe zum Abhaken.
 *
 * Aufruf:
 *   npm run pruefstand:de -- --adapter <name> [--sample 30] [--offline] [--fresh]
 *     --offline  nur Cache, fehlende Seiten sind ein Fehler
 *     --fresh    Cache neu aufbauen (vorher/nachher gegen neuen Quellstand)
 *     --mit-belegen  Ortsbelege (Venues, Adress-Geocodes) wie der Sync aus der
 *                    Prod-DB lesen, nur lesend; braucht --env-file=.env.local
 * Ausgabe: .pruefstand/<adapter>/bericht.md, rows.json (vorheriger Lauf: rows.prev.json)
 * Exit 1, wenn eine automatische Schwelle reißt.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installCachedFetch } from '../lib/pruefstand/cache-fetch';
import { diffRuns, measureRows, type PruefRow } from '../lib/pruefstand/metrics';
import { buildReport } from '../lib/pruefstand/report';
import type { AtReferenz } from '../lib/pruefstand/schwellen';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main(): Promise<void> {
  const adapter = arg('adapter');
  if (!adapter) {
    console.error('Aufruf: npm run pruefstand:de -- --adapter <name> [--sample 30] [--offline] [--fresh]');
    process.exit(2);
  }
  const dir = join(process.cwd(), '.pruefstand', adapter);
  const cacheDir = join(dir, 'cache');
  if (process.argv.includes('--fresh')) rmSync(cacheDir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const refFile = join(process.cwd(), 'data', 'pruefstand', 'at-referenz.json');
  if (!existsSync(refFile)) throw new Error('data/pruefstand/at-referenz.json fehlt: npm run pruefstand:at-referenz');
  const ref = JSON.parse(readFileSync(refFile, 'utf8')) as AtReferenz;

  const cache = installCachedFetch(cacheDir, process.argv.includes('--offline') ? 'replay' : 'auto');
  // Erst nach dem Cache laden: Module, die beim Import fetch binden, sehen so den Cache.
  const { getScraperByName } = await import('../lib/scrapers');
  const { filterValidEvents, locationInputOf, normalizeEventTimestamps, toSupabaseRow } = await import('../lib/db/supabase-sync');
  const scraper = getScraperByName(adapter);
  if (!scraper) throw new Error(`Adapter ${adapter} unbekannt`);

  const scraped = await scraper.scrape();
  cache.restore();
  const normalized = normalizeEventTimestamps(scraped);
  const { valid, rejected, rejectionReasons } = filterValidEvents(normalized);
  // Wie der Sync: je source_id nur eine Zeile.
  const seen = new Set<string>();
  const unique = valid.filter(e => {
    const k = `${e.source_name}::${e.source_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  let evidence: Awaited<ReturnType<typeof import('../lib/location/evidence').loadLocationEvidence>> = unique.map(() => ({}));
  if (process.argv.includes('--mit-belegen')) {
    const { createClient } = await import('@supabase/supabase-js');
    const { loadLocationEvidence } = await import('../lib/location/evidence');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    if (!/^https:\/\/api\.lasstreffen\.at/.test(url)) throw new Error('--mit-belegen braucht die Prod-DB api.lasstreffen.at (.env.local)');
    const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    evidence = [];
    for (let i = 0; i < unique.length; i += 100) {
      evidence.push(...await loadLocationEvidence(sb, unique.slice(i, i + 100).map(e => locationInputOf(e))));
    }
  }
  const rows = unique.map((e, idx) => ({
    ...(toSupabaseRow(e, new Map(), new Map(), undefined, evidence[idx]).row as unknown as PruefRow),
    previous_source_id: (e as { previous_source_id?: string | string[] }).previous_source_id ?? null,
  }));

  const rowsFile = join(dir, 'rows.json');
  const prevFile = join(dir, 'rows.prev.json');
  let diff = null;
  if (existsSync(rowsFile)) {
    copyFileSync(rowsFile, prevFile);
    diff = diffRuns(JSON.parse(readFileSync(prevFile, 'utf8')), rows);
  }
  writeFileSync(rowsFile, JSON.stringify(rows));

  const sample = Number(arg('sample') ?? 30);
  const { markdown, passed } = buildReport({
    adapter,
    generatedAt: new Date().toISOString(),
    scraped: scraped.length,
    rejected,
    rejectionReasons,
    metrics: measureRows(rows),
    rows,
    ref,
    diff,
    cache: { hits: cache.stats.hits, recorded: cache.stats.recorded, misses: cache.stats.misses.length },
    sampleSize: sample,
  });
  writeFileSync(join(dir, 'bericht.md'), markdown);
  console.log(markdown);
  process.exit(passed ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
