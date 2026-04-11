// src/scripts/generate-scrape-report.ts
/**
 * Generates a comprehensive scrape report:
 *   - All Austrian municipalities (Gemeinden) with events per source
 *   - Source performance breakdown
 *   - Comparison to previous run (delta tracking)
 *   - Warnings: sources that stopped delivering, coverage gaps
 *
 * Output: reports/scrape-report-YYYY-MM-DD.txt + reports/scrape-snapshot-YYYY-MM-DD.json
 *
 * Usage:
 *   npx tsx --env-file=.env.local src/scripts/generate-scrape-report.ts
 *   npx tsx --env-file=.env.local src/scripts/generate-scrape-report.ts --dry-run
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { PaginationLogEntry } from '../lib/scrapers/GemeindeRegistryScraper';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GeoNameEntry {
  name: string;
  bundesland: string;
  pop: number;
  type: string;
}

interface GemeindeRow {
  gemeinde: string;
  bundesland: string;
  source_name: string;
  count: number;
}

interface SourceRow {
  source_name: string;
  total: number;
  future: number;
}

interface Snapshot {
  date: string;
  total_events: number;
  sources: Record<string, { total: number; future: number }>;
  gemeinden: Record<string, Record<string, number>>; // gemeinde -> source -> count
  bundesland_totals: Record<string, number>;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const REPORTS_DIR = join(process.cwd(), 'reports');
const GEONAMES_PATH = join(process.cwd(), 'data', 'geonames-at.json');

const BUNDESLAND_ORDER = [
  'Wien', 'Niederösterreich', 'Oberösterreich', 'Steiermark',
  'Salzburg', 'Tirol', 'Vorarlberg', 'Kärnten', 'Burgenland',
];

// Normalize bundesland names to canonical form
const BUNDESLAND_NORMALIZE: Record<string, string> = {
  'wien': 'Wien',
  'niederösterreich': 'Niederösterreich', 'niederoesterreich': 'Niederösterreich',
  'oberösterreich': 'Oberösterreich', 'oberoesterreich': 'Oberösterreich', 'ooe': 'Oberösterreich',
  'steiermark': 'Steiermark',
  'salzburg': 'Salzburg',
  'tirol': 'Tirol',
  'vorarlberg': 'Vorarlberg',
  'kärnten': 'Kärnten', 'kaernten': 'Kärnten',
  'burgenland': 'Burgenland',
};

function normBundesland(bl: string | null): string {
  if (!bl) return 'Unbekannt';
  return BUNDESLAND_NORMALIZE[bl.toLowerCase()] || bl;
}

// ─── Supabase ────────────────────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// ─── Data Loading ────────────────────────────────────────────────────────────

function loadGemeinden(): Map<string, { bundesland: string; pop: number }> {
  const raw: GeoNameEntry[] = JSON.parse(readFileSync(GEONAMES_PATH, 'utf8'));
  const adm3 = raw.filter((e) => e.type === 'ADM3');
  const map = new Map<string, { bundesland: string; pop: number }>();
  for (const g of adm3) {
    map.set(g.name, { bundesland: normBundesland(g.bundesland), pop: g.pop || 0 });
  }
  return map;
}

function loadPreviousSnapshot(): Snapshot | null {
  if (!existsSync(REPORTS_DIR)) return null;
  const files = readdirSync(REPORTS_DIR)
    .filter((f) => f.startsWith('scrape-snapshot-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  try {
    return JSON.parse(readFileSync(join(REPORTS_DIR, files[0]), 'utf8'));
  } catch {
    return null;
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

async function queryGemeindeEvents(supabase: ReturnType<typeof getSupabase>): Promise<GemeindeRow[]> {
  // Use RPC or raw query — Supabase JS can't do GROUP BY, so we use .rpc or multiple queries
  // We'll query in batches by bundesland to keep it manageable
  const results: GemeindeRow[] = [];

  // Query: events grouped by location_name, source_name, bundesland
  // We need to use the REST API with a custom query since supabase-js doesn't support GROUP BY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const query = `
    SELECT
      location_name as gemeinde,
      bundesland,
      source_name,
      COUNT(*)::int as count
    FROM events
    WHERE location_name IS NOT NULL
      AND source_name IS NOT NULL
      AND start_date >= NOW()
    GROUP BY location_name, bundesland, source_name
    ORDER BY location_name, count DESC
  `;

  const res = await fetch(`${url}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  // Fallback: use multiple paginated queries
  // Actually, let's use Supabase's PostgREST with a simple approach
  // We'll query the raw SQL via the management API
  return results;
}

async function fetchWithSQL(sql: string): Promise<unknown[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Use the pg_net or just use supabase-js .rpc
  // Actually, simplest: create a Supabase function, or use the REST endpoint
  // Let's use a direct approach with the Supabase client
  const supabase = getSupabase();

  // Try using rpc if available, otherwise fall back
  const { data, error } = await supabase.rpc('execute_sql_query', { query_text: sql });
  if (error) {
    // Fallback: use fetch to PostgREST /rest/v1/rpc endpoint won't work without a function
    // We'll use the Supabase management API endpoint instead
    throw new Error(`SQL query failed: ${error.message}`);
  }
  return data as unknown[];
}

// Direct PostgreSQL query via Supabase's REST SQL endpoint
async function querySQL<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Supabase exposes pg endpoint at /pg/query for service_role
  // But the simplest approach: use supabase-js with a view or function
  // Let's just use multiple filtered queries instead

  // Actually, the cleanest way: call the Supabase Management API
  // But that requires a different auth. Let's do it the supabase-js way
  // by creating a temporary RPC function, or use an alternative approach.

  // PRACTICAL APPROACH: Use the supabase-js client with .from().select()
  // and aggregate in TypeScript. The data fits in memory (117k events).
  return [] as T[];
}

// ─── Practical Data Fetching (TypeScript aggregation) ────────────────────────

interface EventRow {
  location_name: string;
  bundesland: string;
  source_name: string;
  start_date: string;
}

async function fetchAllEventCounts(): Promise<{
  gemeindeSourceCounts: Map<string, Map<string, number>>;
  gemeindeBundesland: Map<string, string>;
  sourceTotals: Map<string, { total: number; future: number }>;
  bundeslandTotals: Map<string, number>;
  totalEvents: number;
  futureEvents: number;
}> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const gemeindeSourceCounts = new Map<string, Map<string, number>>();
  const gemeindeBundesland = new Map<string, string>();
  const sourceTotals = new Map<string, { total: number; future: number }>();
  const bundeslandTotals = new Map<string, number>();
  let totalEvents = 0;
  let futureEvents = 0;

  // Fetch in pages of 10,000
  const PAGE_SIZE = 10000;
  let offset = 0;
  let hasMore = true;

  console.log('[report] Fetching events from Supabase...');

  while (hasMore) {
    const { data, error } = await supabase
      .from('events')
      .select('location_name, bundesland, source_name, start_date')
      .not('location_name', 'is', null)
      .not('source_name', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Fetch failed at offset ${offset}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data as EventRow[]) {
      totalEvents++;
      const bl = normBundesland(row.bundesland);
      const isFuture = row.start_date >= now;
      if (isFuture) futureEvents++;

      // Gemeinde × Source
      if (!gemeindeSourceCounts.has(row.location_name)) {
        gemeindeSourceCounts.set(row.location_name, new Map());
      }
      const srcMap = gemeindeSourceCounts.get(row.location_name)!;
      srcMap.set(row.source_name, (srcMap.get(row.source_name) || 0) + 1);

      // Gemeinde → Bundesland
      if (!gemeindeBundesland.has(row.location_name)) {
        gemeindeBundesland.set(row.location_name, bl);
      }

      // Source totals
      if (!sourceTotals.has(row.source_name)) {
        sourceTotals.set(row.source_name, { total: 0, future: 0 });
      }
      const st = sourceTotals.get(row.source_name)!;
      st.total++;
      if (isFuture) st.future++;

      // Bundesland totals
      bundeslandTotals.set(bl, (bundeslandTotals.get(bl) || 0) + 1);
    }

    offset += data.length;
    if (data.length < PAGE_SIZE) hasMore = false;
    process.stdout.write(`\r[report] Fetched ${totalEvents.toLocaleString()} events...`);
  }

  console.log(`\n[report] Total: ${totalEvents.toLocaleString()} events, ${futureEvents.toLocaleString()} upcoming`);
  return { gemeindeSourceCounts, gemeindeBundesland, sourceTotals, bundeslandTotals, totalEvents, futureEvents };
}

// ─── Pagination Log ─────────────────────────────────────────────────────────

function loadPaginationLog(): PaginationLogEntry[] {
  const logPath = join(REPORTS_DIR, 'pagination-log.json');
  if (!existsSync(logPath)) return [];
  try {
    return JSON.parse(readFileSync(logPath, 'utf8'));
  } catch {
    return [];
  }
}

// ─── Report Generation ───────────────────────────────────────────────────────

function generateReport(
  data: Awaited<ReturnType<typeof fetchAllEventCounts>>,
  gemeinden: Map<string, { bundesland: string; pop: number }>,
  prevSnapshot: Snapshot | null,
): string {
  const lines: string[] = [];
  const dateStr = new Date().toLocaleDateString('de-AT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const timeStr = new Date().toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });

  // ── Header ──
  lines.push('╔══════════════════════════════════════════════════════════════════════════════╗');
  lines.push('║                    ÖSTERREICH EVENTS — SCRAPE REPORT                       ║');
  lines.push(`║  ${dateStr}, ${timeStr}${' '.repeat(Math.max(0, 74 - dateStr.length - timeStr.length - 4))} ║`);
  lines.push('╚══════════════════════════════════════════════════════════════════════════════╝');
  lines.push('');

  // ── Quick Stats ──
  lines.push('┌─────────────────────────────────────────┐');
  lines.push('│          ZUSAMMENFASSUNG                 │');
  lines.push('├─────────────────────────────────────────┤');
  lines.push(`│  Events gesamt:     ${pad(data.totalEvents.toLocaleString('de-AT'), 18)} │`);
  lines.push(`│  Davon zukünftig:   ${pad(data.futureEvents.toLocaleString('de-AT'), 18)} │`);
  lines.push(`│  Quellen aktiv:     ${pad(data.sourceTotals.size.toString(), 18)} │`);
  lines.push(`│  Orte mit Events:   ${pad(data.gemeindeSourceCounts.size.toLocaleString('de-AT'), 18)} │`);
  lines.push(`│  Gemeinden (AT):    ${pad(gemeinden.size.toLocaleString('de-AT'), 18)} │`);

  const coveredGemeinden = [...gemeinden.keys()].filter((g) => data.gemeindeSourceCounts.has(g));
  const coveragePct = ((coveredGemeinden.length / gemeinden.size) * 100).toFixed(1);
  lines.push(`│  Gemeinde-Coverage: ${pad(`${coveredGemeinden.length}/${gemeinden.size} (${coveragePct}%)`, 18)} │`);

  if (prevSnapshot) {
    const diff = data.totalEvents - prevSnapshot.total_events;
    const sign = diff >= 0 ? '+' : '';
    lines.push('├─────────────────────────────────────────┤');
    lines.push(`│  Δ zum letzten Run: ${pad(`${sign}${diff.toLocaleString('de-AT')} Events`, 18)} │`);
    lines.push(`│  Letzter Run:       ${pad(prevSnapshot.date, 18)} │`);
  }
  lines.push('└─────────────────────────────────────────┘');
  lines.push('');

  // ── Section 1: Source Performance ──
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('  TEIL 1: QUELLEN-PERFORMANCE');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');

  const sortedSources = [...data.sourceTotals.entries()]
    .sort((a, b) => b[1].total - a[1].total);

  // Header
  const srcHeader = `${'Quelle'.padEnd(30)} | ${'Gesamt'.padStart(8)} | ${'Zukünftig'.padStart(10)} | ${'Δ Gesamt'.padStart(10)} | ${'Δ Zuk.'.padStart(8)} | Status`;
  lines.push(srcHeader);
  lines.push('─'.repeat(srcHeader.length + 5));

  for (const [source, counts] of sortedSources) {
    const prev = prevSnapshot?.sources[source];
    let deltaTotal = '';
    let deltaFuture = '';
    let status = '●';

    if (prev) {
      const dt = counts.total - prev.total;
      const df = counts.future - prev.future;
      deltaTotal = `${dt >= 0 ? '+' : ''}${dt.toLocaleString('de-AT')}`;
      deltaFuture = `${df >= 0 ? '+' : ''}${df.toLocaleString('de-AT')}`;

      if (counts.total === 0 && prev.total > 0) status = '🔴 AUSGEFALLEN';
      else if (counts.future === 0 && prev.future > 10) status = '⚠️  Keine zuk.';
      else if (df < -Math.max(10, prev.future * 0.5)) status = '⚠️  Starker Rückgang';
      else if (dt > 0) status = '✅ OK';
      else if (dt === 0) status = '➖ Unverändert';
      else status = '📉 Rückgang';
    } else if (prevSnapshot) {
      status = '🆕 Neu';
    } else {
      status = '●  Erstlauf';
    }

    lines.push(
      `${source.padEnd(30)} | ${counts.total.toLocaleString('de-AT').padStart(8)} | ${counts.future.toLocaleString('de-AT').padStart(10)} | ${deltaTotal.padStart(10)} | ${deltaFuture.padStart(8)} | ${status}`,
    );
  }

  // Sources that disappeared
  if (prevSnapshot) {
    const disappeared = Object.keys(prevSnapshot.sources).filter(
      (s) => !data.sourceTotals.has(s) && prevSnapshot.sources[s].total > 0,
    );
    if (disappeared.length > 0) {
      lines.push('');
      lines.push(`  ⛔ VERSCHWUNDENE QUELLEN (${disappeared.length}):`);
      for (const s of disappeared) {
        lines.push(`     - ${s} (hatte ${prevSnapshot.sources[s].total} Events)`);
      }
    }
  }

  lines.push('');

  // ── Section 2: Bundesland Overview ──
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('  TEIL 2: BUNDESLAND-ÜBERSICHT');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');

  const blHeader = `${'Bundesland'.padEnd(22)} | ${'Events'.padStart(8)} | ${'Gemeinden'.padStart(10)} | ${'Δ Events'.padStart(10)}`;
  lines.push(blHeader);
  lines.push('─'.repeat(blHeader.length + 5));

  for (const bl of BUNDESLAND_ORDER) {
    const count = data.bundeslandTotals.get(bl) || 0;
    const gemCount = [...data.gemeindeBundesland.entries()].filter(([, b]) => b === bl).length;
    const prev = prevSnapshot?.bundesland_totals[bl] || 0;
    const delta = prevSnapshot ? `${count - prev >= 0 ? '+' : ''}${(count - prev).toLocaleString('de-AT')}` : '';

    lines.push(
      `${bl.padEnd(22)} | ${count.toLocaleString('de-AT').padStart(8)} | ${gemCount.toString().padStart(10)} | ${delta.padStart(10)}`,
    );
  }

  // Unknown
  const unknownCount = data.bundeslandTotals.get('Unbekannt') || 0;
  if (unknownCount > 0) {
    lines.push(`${'Unbekannt'.padEnd(22)} | ${unknownCount.toLocaleString('de-AT').padStart(8)} | ${'?'.padStart(10)} |`);
  }

  lines.push('');

  // ── Section 3: Gemeinde-Detail (by Bundesland) ──
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('  TEIL 3: GEMEINDEN × QUELLEN (Alle 2.120 Gemeinden)');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');

  // Get top sources (top 10 by total events) for the column headers
  const topSources = sortedSources.slice(0, 10).map(([name]) => name);
  const srcColWidth = 8;

  for (const bl of BUNDESLAND_ORDER) {
    const blGemeinden = [...gemeinden.entries()]
      .filter(([, info]) => info.bundesland === bl)
      .sort((a, b) => a[0].localeCompare(b[0], 'de'));

    if (blGemeinden.length === 0) continue;

    const blEventCount = data.bundeslandTotals.get(bl) || 0;
    const coveredInBl = blGemeinden.filter(([name]) => data.gemeindeSourceCounts.has(name)).length;

    lines.push(`\n  ── ${bl} (${blGemeinden.length} Gemeinden, ${coveredInBl} mit Events, ${blEventCount.toLocaleString('de-AT')} Events) ──`);
    lines.push('');

    // Column headers
    const gemColW = 35;
    let header = `${'Gemeinde'.padEnd(gemColW)} | ${'Gesamt'.padStart(7)}`;
    for (const src of topSources) {
      const shortName = src.length > srcColWidth ? src.slice(0, srcColWidth) : src;
      header += ` | ${shortName.padStart(srcColWidth)}`;
    }
    header += ' | Sonstige';
    lines.push(header);
    lines.push('─'.repeat(header.length + 2));

    for (const [name] of blGemeinden) {
      const srcMap = data.gemeindeSourceCounts.get(name);
      if (!srcMap) {
        // Gemeinde without events
        lines.push(`${name.padEnd(gemColW)} | ${'0'.padStart(7)}${' | '.padStart(srcColWidth + 3).repeat(topSources.length)} | -`);
        continue;
      }

      const total = [...srcMap.values()].reduce((a, b) => a + b, 0);
      let topSourceTotal = 0;
      let row = `${name.padEnd(gemColW)} | ${total.toLocaleString('de-AT').padStart(7)}`;

      for (const src of topSources) {
        const cnt = srcMap.get(src) || 0;
        topSourceTotal += cnt;
        row += ` | ${cnt ? cnt.toLocaleString('de-AT').padStart(srcColWidth) : '·'.padStart(srcColWidth)}`;
      }

      const sonstige = total - topSourceTotal;
      row += ` | ${sonstige > 0 ? sonstige.toLocaleString('de-AT') : '-'}`;
      lines.push(row);
    }
  }

  // Extra locations not in GeoNames (venues, districts, etc.)
  const extraLocations = [...data.gemeindeSourceCounts.entries()]
    .filter(([name]) => !gemeinden.has(name))
    .sort((a, b) => {
      const totalA = [...a[1].values()].reduce((x, y) => x + y, 0);
      const totalB = [...b[1].values()].reduce((x, y) => x + y, 0);
      return totalB - totalA;
    });

  if (extraLocations.length > 0) {
    lines.push('');
    lines.push(`\n  ── Weitere Orte (nicht in Gemeinde-Liste, ${extraLocations.length} Einträge, Top 100) ──`);
    lines.push('');

    const gemColW = 45;
    let header = `${'Ort'.padEnd(gemColW)} | ${'Gesamt'.padStart(7)} | Top-Quelle`;
    lines.push(header);
    lines.push('─'.repeat(header.length + 10));

    for (const [name, srcMap] of extraLocations.slice(0, 100)) {
      const total = [...srcMap.values()].reduce((a, b) => a + b, 0);
      const topSource = [...srcMap.entries()].sort((a, b) => b[1] - a[1])[0];
      lines.push(
        `${name.slice(0, gemColW).padEnd(gemColW)} | ${total.toLocaleString('de-AT').padStart(7)} | ${topSource[0]} (${topSource[1]})`,
      );
    }
  }

  lines.push('');

  // ── Section 4: Warnings & Anomalies ──
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('  TEIL 4: WARNUNGEN & ANOMALIEN');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');

  const warnings: string[] = [];

  // Sources with 0 future events
  for (const [source, counts] of sortedSources) {
    if (counts.future === 0 && counts.total > 50) {
      warnings.push(`⚠️  ${source}: ${counts.total} Events, aber 0 zukünftige — möglicherweise veraltet`);
    }
  }

  // Sources that dropped more than 50%
  if (prevSnapshot) {
    for (const [source, counts] of sortedSources) {
      const prev = prevSnapshot.sources[source];
      if (prev && prev.total > 50 && counts.total < prev.total * 0.5) {
        warnings.push(`🔴 ${source}: Starker Rückgang von ${prev.total} → ${counts.total} Events (${((counts.total / prev.total) * 100).toFixed(0)}%)`);
      }
    }

    // Gemeinden that lost all events
    for (const [gemeinde, prevSources] of Object.entries(prevSnapshot.gemeinden)) {
      const prevTotal = Object.values(prevSources).reduce((a, b) => a + b, 0);
      const currentSrcMap = data.gemeindeSourceCounts.get(gemeinde);
      const currentTotal = currentSrcMap ? [...currentSrcMap.values()].reduce((a, b) => a + b, 0) : 0;
      if (prevTotal >= 20 && currentTotal === 0) {
        warnings.push(`⛔ ${gemeinde}: Alle ${prevTotal} Events verloren (vorher von: ${Object.keys(prevSources).join(', ')})`);
      }
    }
  }

  // Bundesland without coverage
  for (const bl of BUNDESLAND_ORDER) {
    const count = data.bundeslandTotals.get(bl) || 0;
    if (count === 0) {
      warnings.push(`🔴 ${bl}: Keine Events!`);
    } else if (count < 100) {
      warnings.push(`⚠️  ${bl}: Nur ${count} Events — Coverage-Problem`);
    }
  }

  // Uncovered Gemeinden with population > 10,000
  const uncoveredBigGemeinden = [...gemeinden.entries()]
    .filter(([name, info]) => !data.gemeindeSourceCounts.has(name) && info.pop >= 10000)
    .sort((a, b) => b[1].pop - a[1].pop);

  if (uncoveredBigGemeinden.length > 0) {
    warnings.push('');
    warnings.push(`📍 ${uncoveredBigGemeinden.length} Gemeinden mit >10.000 Einwohnern ohne Events:`);
    for (const [name, info] of uncoveredBigGemeinden.slice(0, 20)) {
      warnings.push(`   - ${name} (${info.bundesland}, ${info.pop.toLocaleString('de-AT')} EW)`);
    }
  }

  if (warnings.length === 0) {
    lines.push('  ✅ Keine Warnungen — alles sieht gut aus!');
  } else {
    for (const w of warnings) lines.push(`  ${w}`);
  }

  lines.push('');

  // ── Section 5: Pagination Report ──
  const paginationLog = loadPaginationLog();
  if (paginationLog.length > 0) {
    lines.push('═══════════════════════════════════════════════════════════════════════════════');
    lines.push('  TEIL 5: PAGINATION-REPORT');
    lines.push('═══════════════════════════════════════════════════════════════════════════════');
    lines.push('');

    const paginated = paginationLog.filter(e => e.pagesScraped > 1);
    const failedPag = paginationLog.filter(e => e.failedNextUrl);
    const singlePage = paginationLog.filter(e => e.pagesScraped === 1 && e.paginationType === 'none');
    const singlePageWithEvents = singlePage.filter(e => e.eventsTotal > 0);

    lines.push(`  Gemeinden mit Pagination:     ${paginated.length}`);
    lines.push(`  Pagination fehlgeschlagen:     ${failedPag.length}`);
    lines.push(`  Nur 1 Seite (keine Pagination):  ${singlePage.length} (davon ${singlePageWithEvents.length} mit Events)`);
    lines.push('');

    // Show successfully paginated sites
    if (paginated.length > 0) {
      lines.push('  ✅ ERFOLGREICH PAGINIERT:');
      const pagHeader = `  ${'Gemeinde'.padEnd(35)} | ${'Seiten'.padStart(6)} | ${'Typ'.padEnd(12)} | ${'Pg1'.padStart(4)} | ${'Ges.'.padStart(5)} | URL`;
      lines.push(pagHeader);
      lines.push('  ' + '─'.repeat(pagHeader.length));
      for (const e of paginated.sort((a, b) => b.pagesScraped - a.pagesScraped)) {
        lines.push(`  ${e.gemeinde.padEnd(35)} | ${String(e.pagesScraped).padStart(6)} | ${e.paginationType.padEnd(12)} | ${String(e.eventsPage1).padStart(4)} | ${String(e.eventsTotal).padStart(5)} | ${e.url}`);
      }
      lines.push('');
    }

    // Show failed pagination
    if (failedPag.length > 0) {
      lines.push('  ❌ PAGINATION FEHLGESCHLAGEN (Fetch der nächsten Seite gescheitert):');
      const failHeader = `  ${'Gemeinde'.padEnd(35)} | ${'Strategie'.padEnd(16)} | Fehlgeschlagene URL`;
      lines.push(failHeader);
      lines.push('  ' + '─'.repeat(failHeader.length));
      for (const e of failedPag) {
        lines.push(`  ${e.gemeinde.padEnd(35)} | ${e.strategy.padEnd(16)} | ${e.failedNextUrl}`);
      }
      lines.push('');
    }

    // Show sites with events but no pagination detected (potential missed events)
    const suspectSites = paginationLog.filter(
      e => e.pagesScraped === 1 && e.paginationType === 'none' && e.eventsPage1 > 0 && e.eventsPage1 <= 10
    );
    if (suspectSites.length > 0) {
      lines.push(`  ⚠️  VERDACHT AUF FEHLENDE PAGINATION (1 Seite, ≤10 Events — evtl. mehr auf Folgeseiten):`);
      const suspHeader = `  ${'Gemeinde'.padEnd(35)} | ${'Events'.padStart(6)} | ${'Strategie'.padEnd(16)} | URL`;
      lines.push(suspHeader);
      lines.push('  ' + '─'.repeat(suspHeader.length));
      for (const e of suspectSites.sort((a, b) => a.eventsPage1 - b.eventsPage1).slice(0, 50)) {
        lines.push(`  ${e.gemeinde.padEnd(35)} | ${String(e.eventsPage1).padStart(6)} | ${e.strategy.padEnd(16)} | ${e.url}`);
      }
      if (suspectSites.length > 50) {
        lines.push(`  ... und ${suspectSites.length - 50} weitere`);
      }
      lines.push('');
    }
  }

  // ── Section 6: Coverage Heatmap (ASCII) ──
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push(`  TEIL ${paginationLog.length > 0 ? '6' : '5'}: QUELLEN-DIVERSITÄT PRO BUNDESLAND`);
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('  Wie viele verschiedene Quellen liefern Events pro Bundesland:');
  lines.push('');

  for (const bl of BUNDESLAND_ORDER) {
    const sourcesInBl = new Map<string, number>();
    for (const [loc, srcMap] of data.gemeindeSourceCounts) {
      if (data.gemeindeBundesland.get(loc) === bl) {
        for (const [src, cnt] of srcMap) {
          sourcesInBl.set(src, (sourcesInBl.get(src) || 0) + cnt);
        }
      }
    }
    const sortedBl = [...sourcesInBl.entries()].sort((a, b) => b[1] - a[1]);
    const barLength = Math.min(sortedBl.length, 40);
    const bar = '█'.repeat(barLength) + '░'.repeat(40 - barLength);

    lines.push(`  ${bl.padEnd(20)} [${bar}] ${sortedBl.length} Quellen`);
    if (sortedBl.length > 0) {
      const top3 = sortedBl.slice(0, 3).map(([s, c]) => `${s}(${c.toLocaleString('de-AT')})`).join(', ');
      lines.push(`  ${''.padEnd(20)} Top: ${top3}`);
    }
  }

  lines.push('');

  // ── Footer ──
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push(`  Report generiert: ${new Date().toISOString()}`);
  if (prevSnapshot) {
    lines.push(`  Vergleichsbasis:  ${prevSnapshot.date}`);
  } else {
    lines.push('  Vergleichsbasis:  (Erstlauf — kein Vergleich)');
  }
  lines.push('═══════════════════════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

function buildSnapshot(data: Awaited<ReturnType<typeof fetchAllEventCounts>>): Snapshot {
  const sources: Record<string, { total: number; future: number }> = {};
  for (const [name, counts] of data.sourceTotals) {
    sources[name] = counts;
  }

  const gemeinden: Record<string, Record<string, number>> = {};
  for (const [name, srcMap] of data.gemeindeSourceCounts) {
    gemeinden[name] = Object.fromEntries(srcMap);
  }

  const bundesland_totals: Record<string, number> = {};
  for (const [bl, count] of data.bundeslandTotals) {
    bundesland_totals[bl] = count;
  }

  return {
    date: new Date().toISOString().split('T')[0],
    total_events: data.totalEvents,
    sources,
    gemeinden,
    bundesland_totals,
  };
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function pad(s: string, width: number): string {
  return s.padEnd(width);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('[report] Loading GeoNames Gemeinde-Liste...');
  const gemeinden = loadGemeinden();
  console.log(`[report] ${gemeinden.size} offizielle Gemeinden geladen`);

  console.log('[report] Loading previous snapshot...');
  const prevSnapshot = loadPreviousSnapshot();
  if (prevSnapshot) {
    console.log(`[report] Previous snapshot from ${prevSnapshot.date} (${prevSnapshot.total_events.toLocaleString()} events)`);
  } else {
    console.log('[report] No previous snapshot found (first run)');
  }

  const data = await fetchAllEventCounts();

  console.log('[report] Generating report...');
  const report = generateReport(data, gemeinden, prevSnapshot);

  const today = new Date().toISOString().split('T')[0];
  const txtPath = join(REPORTS_DIR, `scrape-report-${today}.txt`);
  const jsonPath = join(REPORTS_DIR, `scrape-snapshot-${today}.json`);

  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });

  if (dryRun) {
    console.log('\n--- DRY RUN — Report preview (first 100 lines): ---\n');
    console.log(report.split('\n').slice(0, 100).join('\n'));
    console.log(`\n... (${report.split('\n').length} lines total)`);
  } else {
    writeFileSync(txtPath, report, 'utf8');
    console.log(`[report] Report saved: ${txtPath}`);

    const snapshot = buildSnapshot(data);
    writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2), 'utf8');
    console.log(`[report] Snapshot saved: ${jsonPath}`);
  }

  console.log('[report] Done!');
}

main().catch((err) => {
  console.error(`[report] Fatal error: ${err}`);
  process.exit(1);
});
