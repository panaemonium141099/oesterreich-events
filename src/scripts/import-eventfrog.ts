/**
 * Eventfrog Public API importer.
 *
 *   npx tsx src/scripts/import-eventfrog.ts --dry-run
 *   npx tsx src/scripts/import-eventfrog.ts --country AT,DE --limit 50
 *
 * Env: EVENTFROG_API_KEY (Public-API-Key, NICHT der Organizer-Key),
 *      EVENTFROG_COUNTRIES (optional, Standard "AT"),
 *      plus Supabase env für den Schreibpfad.
 *
 * DE/CH bleiben vorerst aus dem Cron (lasstreffen.de folgt): DE sind
 * ~84.000 Events, deren Bilder und Pipeline-Last erst mit der .de-Seite
 * Sinn ergeben. Manuell geht `--country DE --dry-run` jederzeit.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EventfrogClient, eventfrogApiKey } from '@/lib/eventfrog/client';
import { fetchAndParseEventfrog, upsertEventfrogEvents } from '@/lib/eventfrog/import';
import { startWorkflowRun, finishWorkflowRun } from '@/lib/reporting/workflow-run';

// .env.local laden (tsx macht das nicht selbst).
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
const log = (m: string) => console.log(`[eventfrog] ${m}`);

async function main() {
  const apiKey = eventfrogApiKey();
  if (!apiKey) {
    log('EVENTFROG_API_KEY fehlt — nichts zu tun.');
    return;
  }
  const dryRun = hasFlag('--dry-run');
  const limitStr = arg('--limit');
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;
  const countries = (arg('--country') ?? process.env.EVENTFROG_COUNTRIES ?? 'AT')
    .split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);

  const runId = dryRun ? null : await startWorkflowRun('import-eventfrog');
  // Ab Wiener Tagesbeginn: laufende mehrtägige Events (Ausstellungen) kommen mit.
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' });
  const client = new EventfrogClient(apiKey);
  const results = await fetchAndParseEventfrog(client, countries, today, log);

  let events = results.flatMap((r) => r.events);
  for (const r of results) {
    const s = r.stats;
    log(`${r.country}: ${s.output}/${s.input} übernommen — Dauerangebot ${s.standingOffer}, abgesagt ${s.cancelled}, `
      + `versteckt ${s.hidden}, ohne Titel ${s.noTitle}, ohne Location ${s.noLocation}`);
    const top = Object.entries(s.standingOfferTitles).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [title, n] of top) log(`  Dauerangebot: ${String(n).padStart(4)}× ${title}`);
  }
  if (limit && events.length > limit) {
    events = events.slice(0, limit);
    log(`auf ${events.length} begrenzt`);
  }

  const withImage = events.filter((e) => e.image_url).length;
  const withTicket = events.filter((e) => e.ticket_url).length;
  const locked = events.filter((e) => e.category_locked).length;
  const venue = events.filter((e) => e.coords_precision === 'venue').length;
  log(`mit Bild ${withImage}, mit Ticket-Link ${withTicket}, Kategorie fest ${locked}, Venue-Koordinaten ${venue} (von ${events.length})`);

  if (dryRun) {
    for (const e of events.slice(0, 3)) {
      console.log(JSON.stringify({
        source_id: e.source_id, title: e.title, start_date: e.start_date, end_date: e.end_date,
        location_name: e.location_name, address: e.address, postal_code: e.postal_code, city: e.city,
        lat: e.latitude, lng: e.longitude, coords_precision: e.coords_precision, country: e.country,
        category: e.category, locked: e.category_locked, tags: e.tags, price_text: e.price_text,
        ticket_url: e.ticket_url, image_url: e.image_url,
      }, null, 2));
    }
    log('DRY RUN — keine DB-Writes, keine Bild-Uploads.');
    return;
  }

  const r = await upsertEventfrogEvents(events, log);
  log(`FERTIG — ${r.upserted} geschrieben, ${r.errors} Fehler, ${r.filtered} gefiltert, ${r.quarantined} zur Prüfung`);

  await finishWorkflowRun(runId, {
    status: r.errors > 0 ? 'partial' : 'success',
    summary: `${r.upserted.toLocaleString('de-AT')} Eventfrog-Events importiert (${countries.join(', ')})`,
    metrics: {
      ...Object.fromEntries(results.flatMap((x) => [
        [`${x.country} von der API`, x.stats.input],
        [`${x.country} Dauerangebote verworfen`, x.stats.standingOffer],
        [`${x.country} übernommen`, x.stats.output],
      ])),
      'in die DB geschrieben': r.upserted,
      'zur Prüfung': r.quarantined,
      'Upsert-Fehler': r.errors,
      'API-Anfragen': client.requests,
    },
    errors: r.errors > 0 ? [`${r.errors} Events konnten nicht geschrieben werden`] : [],
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
