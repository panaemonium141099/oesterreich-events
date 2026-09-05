/**
 * Meldet per E-Mail, sobald der DE→EN-Rückstand abgearbeitet ist (fn-17).
 *
 * Läuft nach jedem Backfill-Durchgang (siehe /opt/app/translate-backfill.sh
 * auf dem Server) und schickt GENAU EINE Mail, wenn beide Bestände
 * durchübersetzt sind — der Anlass, die Sitemaps in der Search Console neu
 * einzureichen.
 *
 * **Warum die Schwelle nicht bei null liegt.** Der Rückstand erreicht nie
 * exakt 0:
 *
 *   - Die Scraper legen täglich neue Events an (gemessen 30.08.–05.09.2026:
 *     704 bis 2 146 pro Tag). Zwischen zwei Läufen steht also immer ein
 *     frischer Schwung unübersetzt da.
 *   - Ein kleiner Rest scheitert dauerhaft: Gemini blockt wörtlich von
 *     Veranstalterseiten übernommene Texte mit `finishReason: RECITATION`,
 *     und daran ändert auch ein zehnter Versuch nichts.
 *
 * Auf `= 0` zu warten hieße, die Mail nie zu schicken. EVENT_BACKLOG_OK
 * entspricht deshalb rund einem Tagesaufkommen: liegt der Rückstand
 * darunter, ist der Bestand abgearbeitet und was übrig bleibt, ist der
 * normale Nachschub.
 *
 * POIs sind der strengere Fall — sie kommen aus einem wöchentlichen
 * Ingest statt aus einem Nacht-Scrape, also muss da wirklich alles
 * übersetzt sein.
 *
 * Usage:
 *   npm run notify:translation -- --marker /state/translation-complete
 *   npm run notify:translation -- --dry-run     # nur Zahlen, keine Mail
 *   npm run notify:translation -- --force       # Mail auch ohne Erreichen
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { createClient } from '@supabase/supabase-js';
import { sendGenericEmail } from '../lib/email';
import { MIN_QUALITY_SCORE } from '../lib/i18n/translate-batch';

/** Rückstand, ab dem der Event-Bestand als abgearbeitet gilt. */
const EVENT_BACKLOG_OK = 2000;

function arg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx === process.argv.length - 1) return null;
  return process.argv[idx + 1];
}

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
const markerPath = arg('marker');

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const alertEmail = process.env.ALERT_EMAIL;

if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen.');
  process.exit(1);
}

interface Counts {
  eventsTotal: number;
  eventsDone: number;
  poisTotal: number;
  poisDone: number;
}

function renderMail(c: Counts): string {
  const pct = (done: number, total: number) =>
    total === 0 ? '100' : ((100 * done) / total).toFixed(1);
  const row = (label: string, done: number, total: number) => `
    <tr>
      <td style="padding:8px 16px 8px 0;color:#374151;">${label}</td>
      <td style="padding:8px 16px 8px 0;color:#111827;font-weight:600;white-space:nowrap;">
        ${done.toLocaleString('de-AT')} / ${total.toLocaleString('de-AT')}
      </td>
      <td style="padding:8px 0;color:#059669;font-weight:600;">${pct(done, total)} %</td>
    </tr>`;

  return `<!doctype html>
<html lang="de"><body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b7280;font-weight:700;">LassTreffen.at</p>
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#111827;">Englische Übersetzung ist durch</h1>

    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151;">
      Der Rückstand ist abgearbeitet. Die englischen URLs stehen jetzt mit
      eigenem Canonical und hreflang-Paar in den Sitemaps — der Moment, sie
      in der Search Console neu einzureichen.
    </p>

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 24px;">
      ${row('Events (sitemap-fähig)', c.eventsDone, c.eventsTotal)}
      ${row('Freizeit-Aktivitäten', c.poisDone, c.poisTotal)}
    </table>

    <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#111827;">Nächster Schritt</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
      In der Google Search Console unter <em>Sitemaps</em> die
      <code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;">/sitemap.xml</code>
      neu einreichen. Der Index verweist auf alle Kind-Sitemaps, eine einzelne
      Einreichung genügt.
    </p>

    <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
      Ein kleiner Rest bleibt dauerhaft deutsch: Texte, die Gemini als
      wörtliche Übernahme von einer Veranstalterseite erkennt, lehnt es ab
      (RECITATION). Dazu kommt der tägliche Nachschub der Scraper, den der
      Timer alle drei Stunden mitnimmt — hier ist nichts mehr zu tun.
    </p>
  </div>
</body></html>`;
}

async function main() {
  const supabase = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } });
  const today = new Date().toISOString().slice(0, 10);

  const eventsBase = () =>
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gte('start_date', today)
      .eq('publish_status', 'published')
      .gte('quality_score', MIN_QUALITY_SCORE);

  const poisBase = () =>
    supabase
      .from('poi_activities')
      .select('id', { count: 'exact', head: true })
      .eq('visible', true)
      .eq('is_closed', false)
      .not('description', 'is', null);

  const [eventsTotalRes, eventsDoneRes, poisTotalRes, poisDoneRes] = await Promise.all([
    eventsBase(),
    eventsBase().not('title_en', 'is', null),
    poisBase(),
    poisBase().not('description_en', 'is', null),
  ]);

  for (const r of [eventsTotalRes, eventsDoneRes, poisTotalRes, poisDoneRes]) {
    if (r.error) {
      console.error('ERROR: Zaehl-Query fehlgeschlagen:', r.error.message);
      process.exit(1);
    }
  }

  const c: Counts = {
    eventsTotal: eventsTotalRes.count ?? 0,
    eventsDone: eventsDoneRes.count ?? 0,
    poisTotal: poisTotalRes.count ?? 0,
    poisDone: poisDoneRes.count ?? 0,
  };

  const eventBacklog = c.eventsTotal - c.eventsDone;
  const poiBacklog = c.poisTotal - c.poisDone;
  const done = eventBacklog <= EVENT_BACKLOG_OK && poiBacklog === 0;

  console.log(`  Events: ${c.eventsDone}/${c.eventsTotal} — offen ${eventBacklog} (ok ab <= ${EVENT_BACKLOG_OK})`);
  console.log(`  POIs:   ${c.poisDone}/${c.poisTotal} — offen ${poiBacklog} (ok ab 0)`);

  if (markerPath && existsSync(markerPath) && !force) {
    console.log('  Mail wurde bereits verschickt (Marker vorhanden) — nichts zu tun.');
    return;
  }
  if (!done && !force) {
    console.log('  Noch nicht so weit.');
    return;
  }
  if (dryRun) {
    console.log('  DRY RUN — Mail waere jetzt rausgegangen.');
    return;
  }
  if (!alertEmail) {
    console.error('ERROR: ALERT_EMAIL fehlt — kann nicht benachrichtigen.');
    process.exit(1);
  }

  const result = await sendGenericEmail(
    alertEmail,
    'LassTreffen.at: Englische Übersetzung ist durch — Sitemap einreichen',
    renderMail(c),
  );

  if (!result.success) {
    // Laut scheitern: eine stille Fehlmeldung hiesse, dass die Mail nie
    // kommt UND der Marker trotzdem gesetzt wird.
    console.error('ERROR: Mail-Versand fehlgeschlagen:', result.error);
    process.exit(1);
  }

  console.log(`  Mail an ${alertEmail} verschickt.`);

  if (markerPath) {
    mkdirSync(dirname(markerPath), { recursive: true });
    writeFileSync(markerPath, `${new Date().toISOString()}\n`);
    console.log(`  Marker gesetzt: ${markerPath}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('ERROR:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
