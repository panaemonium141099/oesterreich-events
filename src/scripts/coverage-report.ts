/**
 * Abdeckungsbericht der Gemeinden (fn-29.18): Gemeinden mit mindestens einem
 * kommenden Termin je Land, je Bundesland und für Deutschland je
 * Integration der Gemeinde-Registry. Regeln: src/lib/pipeline/coverage.ts.
 *
 * Schreibt `reports/abdeckung.json` (Artefakt des Nachtlaufs) und die
 * Tabellen in die GitHub-Zusammenfassung des Laufs. Liest nur.
 *
 * Für Deutschland dazu die Gemeinden ohne Termin nach Ursache
 * (coverage-causes.ts): aus den Berichten der Shards (`reports/kalender/`) und
 * dem Stand des letzten Laufs (`reports/kalender-vorher/`) entsteht
 * `reports/kalender-stand.json`, das Artefakt für die nächste Nacht, und
 * `reports/gemeinden-ohne-termin.json`.
 *
 *   npx tsx src/scripts/coverage-report.ts [--country AT|DE]
 *
 * Im getrennten Lauf (pipeline-country.ts) nur das eigene Land.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { POSTGREST_MAX_ROWS } from '../lib/db/fetch-all';
import { findGemeinde, loadGemeindenMaster } from '../lib/gemeinden/data';
import { findGemeindeDe, loadGemeindenDe } from '../lib/gemeinden/de';
import { normalizeGemeindeName } from '../lib/location/gemeinde-name';
import { loadRegistryDe } from '../lib/registry-de/load';
import { deNachtlaufScrapers } from '../lib/scrapers/de/nachtlauf';
import { mergeKalenderStand, type KalenderZeile } from '../lib/scrapers/de/kalender-stand';
import { buildCoverage, coverageTable, type CoverageEvent, type CoverageGemeinde, type IntegrationAssignment } from '../lib/pipeline/coverage';
import { buildUrsachen, ursachenTabellen, websiteKey, type UrsachenBericht } from '../lib/pipeline/coverage-causes';
import { viennaDayBoundsUtc } from '../lib/pipeline/dedup-evidence';
import { viennaToday } from '../lib/utils/event-time';
import { forCountry, pipelineCountry } from '../lib/pipeline/pipeline-country';

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

/** Berichte dieser Nacht und letzter Stand; null, wenn es weder das eine noch das andere gibt. */
function kalenderStand(now: Date): KalenderZeile[] | null {
  const reports = join(process.cwd(), 'reports');
  const heuteDir = join(reports, 'kalender');
  const vorherFile = join(reports, 'kalender-vorher', 'kalender-stand.json');
  const heute: KalenderZeile[] = existsSync(heuteDir)
    ? readdirSync(heuteDir).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(readFileSync(join(heuteDir, f), 'utf8')) as KalenderZeile[])
    : [];
  const vorher: KalenderZeile[] = existsSync(vorherFile) ? JSON.parse(readFileSync(vorherFile, 'utf8')) : [];
  if (!heute.length && !vorher.length) return null;
  return mergeKalenderStand(vorher, heute, now);
}

async function main(): Promise<void> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const country = pipelineCountry();
  const gemeinden: CoverageGemeinde[] = [
    ...(country !== 'DE' ? loadGemeindenMaster().map(g => ({ id: g.gkz, country: 'AT', region: g.bundesland })) : []),
    ...(country !== 'AT' ? loadGemeindenDe().map(g => ({ id: g.ags, country: 'DE', region: g.land })) : []),
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
    let q = forCountry(supabase
      .from('events')
      .select('id,country,source_name,gem:location_resolution->gemeinde')
      .gte('start_date', fromIso)
      .in('publish_status', ['published', 'published_low_confidence', 'duplicate']), country)
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
  const integrations: IntegrationAssignment[] = country === 'AT' ? [] : deNachtlaufScrapers().flatMap(s => s.integrations.map(integration => ({
    integration,
    adapter: s.name,
    gemeindeIds: registry
      .filter(e => e.integration === integration || (e.fallback?.kind === 'verband' && e.fallback.integration === integration))
      .map(e => e.ags),
  })));

  const report = buildCoverage(gemeinden, events, integrations);

  let ursachen: UrsachenBericht | null = null;
  const stand = country === 'AT' ? null : kalenderStand(new Date());
  if (stand) {
    // Zurückgehaltene kommende Termine, die der Resolver einer Gemeinde gegeben hat.
    const zurueckgehalten = new Set<string>();
    const zurueckgehaltenWebsites = new Set<string>();
    let gehalteneZeilen = 0;
    let lastId: string | null = null;
    for (;;) {
      let q = forCountry(supabase
        .from('events')
        .select('id,country,source_name,source_url,gem:location_resolution->gemeinde')
        .gte('start_date', fromIso)
        .in('publish_status', ['needs_review', 'draft']), 'DE')
        .order('id')
        .limit(POSTGREST_MAX_ROWS);
      if (lastId) q = q.gt('id', lastId);
      const { data, error } = await q;
      if (error) throw new Error(`coverage-report (zurückgehalten): ${error.message}`);
      const page = (data ?? []) as unknown as (Row & { source_url: string | null })[];
      if (page.length === 0) break;
      for (const r of page) {
        gehalteneZeilen++;
        const id = gemeindeId(r.country, r.gem);
        if (id) zurueckgehalten.add(id);
        else if (r.source_name && r.source_url) zurueckgehaltenWebsites.add(websiteKey(r.source_name, r.source_url));
      }
      lastId = page[page.length - 1].id;
    }
    const adapterVon = new Map<string, string[]>();
    for (const i of integrations) for (const ags of i.gemeindeIds) adapterVon.set(ags, [...new Set([...(adapterVon.get(ags) ?? []), i.adapter])]);
    const integrationOf = new Map(registry.map(e => [e.ags, e.integration]));
    ursachen = buildUrsachen({
      gemeinden: loadGemeindenDe().map(g => ({ id: g.ags, region: g.land, integration: integrationOf.get(g.ags) ?? '(nicht in der Registry)' })),
      sichtbar: new Set(events.filter(e => e.country === 'DE' && e.gemeindeId).map(e => e.gemeindeId!)),
      zurueckgehalten,
      zurueckgehaltenWebsites,
      stand,
      adapterVon,
    });
    console.log(`Zurückgehalten: ${gehalteneZeilen} kommende Zeilen, ${zurueckgehalten.size} Gemeinden mit Ortsentscheidung, ${zurueckgehaltenWebsites.size} Websites ohne.`);
  }

  const md = [
    `## Abdeckung der Gemeinden (${new Date().toISOString().slice(0, 10)})`,
    '',
    `Gemeinden mit mindestens einem kommenden Termin (sichtbar oder Duplikat), ${events.length} Termine gelesen, ${unmapped} mit Gemeinde ohne Treffer in den Stammdaten.`,
    '',
    coverageTable('Je Land', report.countries),
    '',
    ...Object.entries(report.regions).flatMap(([c, rows]) => [coverageTable(`${c} je Bundesland`, rows), '']),
    ...(country === 'AT' ? [] : [coverageTable('DE je Integration (Termine des Adapters)', report.integrations)]),
    ...(ursachen ? ['', ursachenTabellen(ursachen)] : country === 'AT' ? [] : ['', 'Kein Kalenderstand gefunden, keine Aufteilung nach Ursache.']),
  ].join('\n');
  console.log(md);

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true });
  const { gemeinden: ohneTermin, ...ursachenKurz } = ursachen ?? { gemeinden: null };
  writeFileSync(join(process.cwd(), 'reports', 'abdeckung.json'), JSON.stringify({ at: new Date().toISOString(), events: events.length, unmapped, ...report, ...(ursachen ? { ursachen: ursachenKurz } : {}) }, null, 1));
  if (stand) writeFileSync(join(process.cwd(), 'reports', 'kalender-stand.json'), JSON.stringify(stand));
  if (ohneTermin) writeFileSync(join(process.cwd(), 'reports', 'gemeinden-ohne-termin.json'), JSON.stringify(ohneTermin));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('[coverage-report] Abbruch:', err);
    process.exit(1);
  },
);
