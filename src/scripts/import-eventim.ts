/**
 * Eventim PFT feed importer.
 *
 *   npx tsx src/scripts/import-eventim.ts --dry-run --verbose
 *   npx tsx src/scripts/import-eventim.ts --limit 50
 *
 * Env: EVENTIM_FEED_URL (optional), EVENTIM_FEED_USER, EVENTIM_FEED_PASS,
 *      plus Supabase env for the non-dry-run write path.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchAndParseEventim, upsertEventimEvents } from '@/lib/eventim/import';
import type { NotBookableStats } from '@/lib/eventim/parse';
import { startWorkflowRun, finishWorkflowRun } from '@/lib/reporting/workflow-run';

// Load .env.local (Next.js does this automatically, but tsx does not) — needed
// for the Supabase service-role key used by the write path, and optionally the
// EVENTIM_FEED_* credentials if stored there.
try {
  const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    if (!process.env[key]) process.env[key] = trimmed.substring(eqIdx + 1).trim();
  }
} catch { /* rely on the real environment */ }

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? '') : undefined;
}
const hasFlag = (name: string) => process.argv.includes(name);

async function main() {
  const dryRun = hasFlag('--dry-run');
  const verbose = hasFlag('--verbose');
  const limitStr = arg('--limit');
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  const runId = dryRun ? null : await startWorkflowRun('import-eventim');

  console.log('[eventim] downloading + parsing feed…');
  const notBookable: NotBookableStats = {};
  let events = await fetchAndParseEventim(new Date().toISOString(), notBookable);
  console.log(`[eventim] ${events.length} events after filtering (future, ticket, non-cancelled, AT/DE/CH)`);

  if (limit && events.length > limit) {
    events = events.slice(0, limit);
    console.log(`[eventim] limited to ${events.length}`);
  }

  // Distribution snapshot
  const byCountry: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let bookable = 0;
  let atNoBundesland = 0;
  for (const e of events) {
    byCountry[e.country ?? '?'] = (byCountry[e.country ?? '?'] ?? 0) + 1;
    byCategory[e.category ?? '?'] = (byCategory[e.category ?? '?'] ?? 0) + 1;
    if (e.ticket_url) bookable++;
    if (e.country === 'AT' && !e.bundesland) atNoBundesland++;
  }
  console.log('[eventim] by country:', byCountry);
  console.log('[eventim] by category:', byCategory);
  console.log(`[eventim] bookable (ticket_url set): ${bookable}/${events.length}`);
  console.log(`[eventim] AT events without bundesland: ${atNoBundesland}`);
  // Ein Event ohne Ticket-Link verdient nichts — die Ursachen gehoeren
  // deshalb ins Log UND in den Bericht, nicht nur die Summe.
  const ohneLink = Object.entries(notBookable).sort((a, b) => b[1] - a[1]);
  if (ohneLink.length > 0) {
    console.log('[eventim] ohne Ticket-Link, nach Ursache:');
    for (const [reason, count] of ohneLink) console.log(`  ${String(count).padStart(6)}  ${reason}`);
  }

  if (verbose || dryRun) {
    console.log('\n[eventim] sample events:');
    for (const e of events.slice(0, 3)) {
      console.log(JSON.stringify(
        { source_id: e.source_id, title: e.title, start_date: e.start_date, country: e.country,
          category: e.category, tags: e.tags, price_text: e.price_text, ticket_url: e.ticket_url,
          location_name: e.location_name, lat: e.latitude, lng: e.longitude }, null, 2));
    }
  }

  if (dryRun) {
    console.log('\n[eventim] DRY RUN — no DB writes.');
    return;
  }

  const r = await upsertEventimEvents(events, (m) => console.log(`[eventim] ${m}`));
  console.log(`[eventim] DONE — ${r.upserted} upserted, ${r.errors} errors, ${r.filtered} filtered`);

  const ohneLinkGesamt = events.length - bookable;
  await finishWorkflowRun(runId, {
    // Upsert-Fehler sind der einzige echte Fehlerfall. Events ohne
    // Ticket-Link sind KEIN Fehler des Imports — sie kommen so aus dem
    // Feed —, gehoeren aber prominent in den Bericht, weil sie direkt auf
    // die Affiliate-Einnahmen durchschlagen.
    status: r.errors > 0 ? 'partial' : 'success',
    summary: `${r.upserted.toLocaleString('de-AT')} Events importiert, `
      + `${ohneLinkGesamt.toLocaleString('de-AT')} davon ohne Ticket-Link `
      + `(${((100 * ohneLinkGesamt) / Math.max(events.length, 1)).toFixed(1)} % — verdienen nichts)`,
    metrics: {
      'Events aus dem Feed': events.length,
      'in die DB geschrieben': r.upserted,
      'mit Ticket-Link (Affiliate)': bookable,
      'OHNE Ticket-Link': ohneLinkGesamt,
      'Anteil ohne Link': `${((100 * ohneLinkGesamt) / Math.max(events.length, 1)).toFixed(1)} %`,
      'Upsert-Fehler': r.errors,
      ...Object.fromEntries(Object.entries(byCountry).map(([k, v]) => [`Land ${k}`, v])),
    },
    // Die Ursachen als Einzelposten: eine Zeile je Grund, mit Anzahl.
    items: ohneLink.slice(0, 10).map(([reason, count]) => ({
      title: `${count.toLocaleString('de-AT')} Events ohne Ticket-Link`,
      excerpt: `Grund laut Feed: ${reason}`,
    })),
    errors: r.errors > 0 ? [`${r.errors} Events konnten nicht geschrieben werden`] : [],
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
