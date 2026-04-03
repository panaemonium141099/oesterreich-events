/**
 * Event Archive Pipeline
 *
 * Archives past events from Supabase:
 * 1. Export events as gzipped JSON backup (restorable)
 * 2. Generate detailed Markdown statistics report with trends
 * 3. Delete archived events from Supabase
 *
 * Usage:
 *   npx tsx src/scripts/archive-events.ts                  # Archive events older than 7 days
 *   npx tsx src/scripts/archive-events.ts --dry-run        # Preview without deleting
 *   npx tsx src/scripts/archive-events.ts --before=2026-04-01  # Custom cutoff date
 *   npx tsx src/scripts/archive-events.ts --restore=data/archive/events-2026-W14.json.gz  # Restore from backup
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { gzipSync, gunzipSync } from 'zlib';
import { createClient } from '@supabase/supabase-js';

// ── Load .env.local ─────────────────────────────────────────────
try {
  const envPath = join(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* */ }

// ── Types ────────────────────────────────────────────────────────
interface ArchivedEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  source_name: string | null;
  source_url: string | null;
  image_url: string | null;
  organizer: string | null;
  tags: string[] | null;
  event_score: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getWeekLabel(date: Date): string {
  const week = getISOWeek(date);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getWeekRange(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    end: sunday.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  };
}

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%';
  return (n / total * 100).toFixed(1) + '%';
}

function change(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+∞' : '0%';
  const diff = ((current - previous) / previous * 100).toFixed(1);
  return (parseFloat(diff) >= 0 ? '+' : '') + diff + '%';
}

// ── Statistics ───────────────────────────────────────────────────
function generateStats(events: ArchivedEvent[]): Record<string, unknown> {
  const total = events.length;
  const withImages = events.filter(e => e.image_url).length;
  const withCoords = events.filter(e => e.latitude && e.longitude).length;
  const withScore = events.filter(e => e.event_score && e.event_score > 0).length;

  // By Bundesland
  const byBundesland: Record<string, number> = {};
  for (const e of events) {
    const bl = e.bundesland || 'Unbekannt';
    byBundesland[bl] = (byBundesland[bl] || 0) + 1;
  }

  // By Category
  const byCategory: Record<string, number> = {};
  for (const e of events) {
    const cat = e.category || 'Sonstiges';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }

  // By Location (Top 20)
  const byLocation: Record<string, number> = {};
  for (const e of events) {
    const loc = e.location_name || 'Unbekannt';
    byLocation[loc] = (byLocation[loc] || 0) + 1;
  }

  // By Source
  const bySource: Record<string, number> = {};
  for (const e of events) {
    const src = e.source_name || 'Unbekannt';
    bySource[src] = (bySource[src] || 0) + 1;
  }

  // Date range
  const dates = events.map(e => e.start_date).filter(Boolean).sort();
  const dateRange = { from: dates[0] || '', to: dates[dates.length - 1] || '' };

  return { total, withImages, withCoords, withScore, byBundesland, byCategory, byLocation, bySource, dateRange };
}

function generateReport(
  events: ArchivedEvent[],
  weekLabel: string,
  weekRange: { start: string; end: string },
  previousReport?: Record<string, unknown>,
): string {
  const stats = generateStats(events);
  const total = stats.total as number;
  const prevTotal = (previousReport?.total as number) || 0;

  const byBL = stats.byBundesland as Record<string, number>;
  const byCat = stats.byCategory as Record<string, number>;
  const byLoc = stats.byLocation as Record<string, number>;
  const bySrc = stats.bySource as Record<string, number>;
  const prevByBL = (previousReport?.byBundesland as Record<string, number>) || {};

  let md = `# Event-Archiv Report — KW ${weekLabel.split('-W')[1]}/${weekLabel.split('-')[0]} (${weekRange.start} - ${weekRange.end})\n\n`;

  // Summary
  md += `## Zusammenfassung\n`;
  md += `- **Archivierte Events:** ${total.toLocaleString('de-AT')}\n`;
  md += `- **Davon mit Bildern:** ${(stats.withImages as number).toLocaleString('de-AT')} (${pct(stats.withImages as number, total)})\n`;
  md += `- **Davon mit Koordinaten:** ${(stats.withCoords as number).toLocaleString('de-AT')} (${pct(stats.withCoords as number, total)})\n`;
  md += `- **Davon mit Score:** ${(stats.withScore as number).toLocaleString('de-AT')} (${pct(stats.withScore as number, total)})\n`;
  md += `- **Zeitraum:** ${(stats.dateRange as { from: string; to: string }).from} bis ${(stats.dateRange as { from: string; to: string }).to}\n`;
  md += `- **Archiviert am:** ${new Date().toISOString().split('T')[0]}\n\n`;

  // Comparison
  if (prevTotal > 0) {
    md += `## Vergleich zur Vorwoche\n`;
    md += `- Events: ${total.toLocaleString('de-AT')} vs ${prevTotal.toLocaleString('de-AT')} → ${change(total, prevTotal)}\n`;
    md += `- Mit Bildern: ${pct(stats.withImages as number, total)} vs ${pct((previousReport?.withImages as number) || 0, prevTotal)}\n`;
    md += `- Mit Koordinaten: ${pct(stats.withCoords as number, total)} vs ${pct((previousReport?.withCoords as number) || 0, prevTotal)}\n\n`;
  }

  // By Bundesland
  md += `## Top Bundeslaender\n`;
  md += `| Bundesland | Events | Anteil | ${prevTotal > 0 ? 'Veraenderung |' : ''}\n`;
  md += `|---|---|---|${prevTotal > 0 ? '---|' : ''}\n`;
  const sortedBL = Object.entries(byBL).sort((a, b) => b[1] - a[1]);
  for (const [bl, count] of sortedBL.slice(0, 10)) {
    const prev = prevByBL[bl] || 0;
    md += `| ${bl} | ${count} | ${pct(count, total)} |`;
    if (prevTotal > 0) md += ` ${change(count, prev)} |`;
    md += '\n';
  }
  md += '\n';

  // By Category
  md += `## Top Kategorien\n`;
  md += `| Kategorie | Events | Anteil |\n|---|---|---|\n`;
  const sortedCat = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCat.slice(0, 10)) {
    md += `| ${cat} | ${count} | ${pct(count, total)} |\n`;
  }
  md += '\n';

  // By Location
  md += `## Top 20 Gemeinden/Orte\n`;
  md += `| Ort | Events |\n|---|---|\n`;
  const sortedLoc = Object.entries(byLoc).sort((a, b) => b[1] - a[1]);
  for (const [loc, count] of sortedLoc.slice(0, 20)) {
    md += `| ${loc} | ${count} |\n`;
  }
  md += '\n';

  // By Source
  md += `## Scraper-Quellen\n`;
  md += `| Source | Events | Anteil |\n|---|---|---|\n`;
  const sortedSrc = Object.entries(bySrc).sort((a, b) => b[1] - a[1]);
  for (const [src, count] of sortedSrc.slice(0, 15)) {
    md += `| ${src} | ${count} | ${pct(count, total)} |\n`;
  }
  md += '\n';

  // Coordinates coverage
  md += `## Koordinaten-Coverage\n`;
  md += `- Mit Koordinaten: ${(stats.withCoords as number).toLocaleString('de-AT')} (${pct(stats.withCoords as number, total)})\n`;
  md += `- Ohne Koordinaten: ${(total - (stats.withCoords as number)).toLocaleString('de-AT')} (${pct(total - (stats.withCoords as number), total)})\n`;

  return md;
}

// ── Load previous report stats ──────────────────────────────────
function loadPreviousStats(archiveDir: string, currentWeek: string): Record<string, unknown> | undefined {
  // Try to find the previous week's stats
  const reportsDir = join(archiveDir, 'reports');
  if (!existsSync(reportsDir)) return undefined;

  // Parse current week to find previous
  const [year, weekStr] = currentWeek.split('-W');
  const prevWeek = parseInt(weekStr) - 1;
  const prevLabel = prevWeek > 0
    ? `${year}-W${String(prevWeek).padStart(2, '0')}`
    : `${parseInt(year) - 1}-W52`;

  const prevStatsPath = join(archiveDir, `stats-${prevLabel}.json`);
  if (existsSync(prevStatsPath)) {
    try {
      return JSON.parse(readFileSync(prevStatsPath, 'utf8'));
    } catch { return undefined; }
  }
  return undefined;
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const restoreArg = args.find(a => a.startsWith('--restore='));
  const beforeArg = args.find(a => a.startsWith('--before='));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const archiveDir = join(process.cwd(), 'data', 'archive');
  const reportsDir = join(archiveDir, 'reports');

  mkdirSync(archiveDir, { recursive: true });
  mkdirSync(reportsDir, { recursive: true });

  // ── Restore mode ────────────────────────────────────────────
  if (restoreArg) {
    const restorePath = restoreArg.split('=')[1];
    console.log(`Restoring events from ${restorePath}...`);

    const compressed = readFileSync(restorePath);
    const json = gunzipSync(compressed).toString('utf8');
    const events: ArchivedEvent[] = JSON.parse(json);

    console.log(`Found ${events.length} events to restore.`);

    const BATCH = 100;
    let restored = 0;
    for (let i = 0; i < events.length; i += BATCH) {
      const batch = events.slice(i, i + BATCH);
      const { error } = await supabase.from('events').upsert(
        batch.map(e => ({ ...e, visibility: 'public', source_type: 'scraped' })),
        { onConflict: 'source_name,source_id' }
      );
      if (error) {
        console.error(`Restore batch ${i}-${i + batch.length} error:`, error.message);
      } else {
        restored += batch.length;
      }
    }

    console.log(`Restored ${restored} events.`);
    return;
  }

  // ── Archive mode ────────────────────────────────────────────
  const cutoffDate = beforeArg
    ? beforeArg.split('=')[1]
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log(`Archiving events with start_date < ${cutoffDate}${dryRun ? ' (DRY RUN)' : ''}...`);

  // Count events to archive
  const { count } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .lt('start_date', cutoffDate)
    .or('visibility.eq.public,visibility.is.null');

  console.log(`Found ${count} events to archive.`);
  if (!count || count === 0) {
    console.log('Nothing to archive.');
    return;
  }

  // Fetch all events to archive (in batches)
  const allEvents: ArchivedEvent[] = [];
  let offset = 0;
  const FETCH_BATCH = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, start_date, end_date, location_name, address, postal_code, bundesland, district, latitude, longitude, category, source_name, source_url, image_url, organizer, tags, event_score')
      .lt('start_date', cutoffDate)
      .or('visibility.eq.public,visibility.is.null')
      .range(offset, offset + FETCH_BATCH - 1)
      .order('start_date', { ascending: true });

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;

    allEvents.push(...(data as ArchivedEvent[]));
    offset += data.length;

    if (offset % 5000 === 0) {
      console.log(`  Fetched ${offset}/${count}...`);
    }

    if (data.length < FETCH_BATCH) break;
  }

  console.log(`Fetched ${allEvents.length} events total.`);

  // Generate week label
  const now = new Date();
  const weekLabel = getWeekLabel(now);
  const weekRange = getWeekRange(now);

  // Save JSON backup (gzipped)
  const backupPath = join(archiveDir, `events-${weekLabel}.json.gz`);
  const jsonData = JSON.stringify(allEvents);
  const compressed = gzipSync(Buffer.from(jsonData));
  writeFileSync(backupPath, compressed);
  console.log(`Backup saved: ${backupPath} (${(compressed.length / 1024 / 1024).toFixed(1)} MB)`);

  // Load previous week stats for comparison
  const prevStats = loadPreviousStats(archiveDir, weekLabel);

  // Generate report
  const report = generateReport(allEvents, weekLabel, weekRange, prevStats);
  const reportPath = join(reportsDir, `${weekLabel}-report.md`);
  writeFileSync(reportPath, report);
  console.log(`Report saved: ${reportPath}`);

  // Save stats for next week's comparison
  const stats = generateStats(allEvents);
  const statsPath = join(archiveDir, `stats-${weekLabel}.json`);
  writeFileSync(statsPath, JSON.stringify(stats, null, 2));

  if (dryRun) {
    console.log('\n=== DRY RUN — no events deleted ===');
    console.log(`Would delete ${allEvents.length} events from Supabase.`);
    console.log(`Backup: ${backupPath}`);
    console.log(`Report: ${reportPath}`);
    return;
  }

  // Delete archived events from Supabase (in batches)
  console.log(`\nDeleting ${allEvents.length} events from Supabase...`);
  let deleted = 0;
  const DEL_BATCH = 500;

  for (let i = 0; i < allEvents.length; i += DEL_BATCH) {
    const batch = allEvents.slice(i, i + DEL_BATCH);
    const ids = batch.map(e => e.id);

    const { error } = await supabase
      .from('events')
      .delete()
      .in('id', ids);

    if (error) {
      console.error(`Delete batch ${i}-${i + batch.length} error:`, error.message);
    } else {
      deleted += batch.length;
    }

    if (deleted % 5000 === 0 && deleted > 0) {
      console.log(`  Deleted ${deleted}/${allEvents.length}...`);
    }
  }

  console.log(`\n=== ARCHIVE COMPLETE ===`);
  console.log(`Archived: ${allEvents.length} events`);
  console.log(`Deleted: ${deleted} events from Supabase`);
  console.log(`Backup: ${backupPath}`);
  console.log(`Report: ${reportPath}`);
  console.log(`\nTo restore: npx tsx src/scripts/archive-events.ts --restore=${backupPath}`);
}

main().catch(console.error);
