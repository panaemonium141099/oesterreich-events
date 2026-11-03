/**
 * Abdeckungsbericht der Gemeinden (fn-29.18): Gemeinden mit mindestens einem
 * kommenden Termin je Land, je Bundesland und für Deutschland je
 * Integration der Gemeinde-Registry. Regeln: src/lib/pipeline/coverage.ts.
 *
 * Schreibt `reports/abdeckung.json` (Artefakt des Nachtlaufs) und die
 * Tabellen in die GitHub-Zusammenfassung des Laufs. Liest nur.
 *
 *   npx tsx src/scripts/coverage-report.ts
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { POSTGREST_MAX_ROWS } from '../lib/db/fetch-all';
import { findGemeinde, loadGemeindenMaster } from '../lib/gemeinden/data';
import { findGemeindeDe, loadGemeindenDe } from '../lib/gemeinden/de';
import { normalizeGemeindeName } from '../lib/location/gemeinde-name';
import { loadRegistryDe } from '../lib/registry-de/load';
import { deNachtlaufScrapers } from '../lib/scrapers/de/nachtlauf';
import { buildCoverage, coverageTable, type CoverageEvent, type CoverageGemeinde, type IntegrationAssignment } from '../lib/pipeline/coverage';
import { viennaDayBoundsUtc } from '../lib/pipeline/dedup-evidence';
import { viennaToday } from '../lib/utils/event-time';

try {
  for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0 && !process.env[t.slice(0, eq)]) process.env[t.slice(0, eq)] = t.slice(eq + 1);
  }
} catch { /* ignore */ }

type Gem = { name?: string; plz?: string; bundesland?: string } | null;
type Row = { id: string; country: string | null; source_name: string | null; gem: Gem };

async function main(): Promise<void> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const gemeinden: CoverageGemeinde[] = [
    ...loadGemeindenMaster().map(g => ({ id: g.gkz, country: 'AT', region: g.bundesland })),
    ...loadGemeindenDe().map(g => ({ id: g.ags, country: 'DE', region: g.land })),
  ];
  // Die Ortsentscheidung trägt Name, PLZ und Land der Stammdaten-Gemeinde.
  const deByNamePlz = new Map(loadGemeindenDe().map(g => [`${g.land}|${normalizeGemeindeName(g.name)}|${g.plz}`, g.ags]));
  const gemeindeId = (country: string | null, g: Gem): string | null => {
    if (!g?.name || !g.bundesland) return null;
    if (country === 'DE') {
      return deByNamePlz.get(`${g.bundesland}|${normalizeGemeindeName(g.name)}|${g.plz ?? ''}`)
        ?? findGemeindeDe({ name: g.name, land: g.bundesland })?.ags ?? null;
    }
    if (country === 'AT') return findGemeinde({ name: g.name, bundesland: g.bundesland })?.gkz ?? null;
    return null;
  };

  // Kommende Termine, die als Event existieren (sichtbar oder als Duplikat eines sichtbaren).
  const fromIso = viennaDayBoundsUtc(viennaToday(new Date()))[0];
  const events: CoverageEvent[] = [];
  let unmapped = 0;
  // Seiten nach id statt Offset: mit OFFSET lief die Abfrage im Nachtlauf
  // vom 03.11. tief im Bestand in den Statement-Timeout.
  let afterId: string | null = null;
  for (;;) {
    let q = supabase
      .from('events')
      .select('id,country,source_name,gem:location_resolution->gemeinde')
      .gte('start_date', fromIso)
      .in('publish_status', ['published', 'published_low_confidence', 'duplicate'])
      .order('id')
      .limit(POSTGREST_MAX_ROWS);
    if (afterId) q = q.gt('id', afterId);
    const { data, error } = await q;
    if (error) throw new Error(`coverage-report: ${error.message}`);
    const page = (data ?? []) as unknown as Row[];
    if (page.length === 0) break;
    for (const r of page) {
      const id = gemeindeId(r.country, r.gem);
      if (r.gem && !id) unmapped++;
      events.push({ country: r.country, source_name: r.source_name, gemeindeId: id });
    }
    afterId = page[page.length - 1].id;
  }

  const registry = loadRegistryDe();
  const integrations: IntegrationAssignment[] = deNachtlaufScrapers().flatMap(s => s.integrations.map(integration => ({
    integration,
    adapter: s.name,
    gemeindeIds: registry
      .filter(e => e.integration === integration || (e.fallback?.kind === 'verband' && e.fallback.integration === integration))
      .map(e => e.ags),
  })));

  const report = buildCoverage(gemeinden, events, integrations);
  const md = [
    `## Abdeckung der Gemeinden (${new Date().toISOString().slice(0, 10)})`,
    '',
    `Gemeinden mit mindestens einem kommenden Termin (sichtbar oder Duplikat), ${events.length} Termine gelesen, ${unmapped} mit Gemeinde ohne Treffer in den Stammdaten.`,
    '',
    coverageTable('Je Land', report.countries),
    '',
    ...Object.entries(report.regions).flatMap(([c, rows]) => [coverageTable(`${c} je Bundesland`, rows), '']),
    coverageTable('DE je Integration (Termine des Adapters)', report.integrations),
  ].join('\n');
  console.log(md);

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true });
  writeFileSync(join(process.cwd(), 'reports', 'abdeckung.json'), JSON.stringify({ at: new Date().toISOString(), events: events.length, unmapped, ...report }, null, 1));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('[coverage-report] Abbruch:', err);
    process.exit(1);
  },
);
