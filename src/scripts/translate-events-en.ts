/**
 * Backfill: englische Titel/Beschreibungen für Future-Events (fn-17).
 *
 * Hintergrund und Warum-Batt-statt-Lazy: siehe Kopf von
 * `src/lib/i18n/translate-batch.ts`. Kurz: der Lazy-Pfad übersetzt erst
 * beim Aufruf der /en-Seite, die /en-Seite kommt aber erst in die Sitemap
 * (und bekommt erst einen eigenen Canonical), wenn `title_en` gefüllt ist.
 * Ohne diesen Backfill bleibt die englische Seite für Google unsichtbar.
 *
 * Der Lauf ist jederzeit abbrechbar und fortsetzbar — der Filter ist
 * `title_en IS NULL`, ein Neustart macht dort weiter, wo aufgehört wurde.
 *
 * Usage:
 *   npm run translate:en -- --dry-run --limit 20
 *   npm run translate:en                      # alles, Concurrency 4
 *   npm run translate:en -- --limit 5000 --concurrency 8
 *
 * Auf dem Server (Env liegt in /opt/app/.env):
 *   docker exec -w /app nextjs-app npx tsx src/scripts/translate-events-en.ts
 */

import { createClient } from '@supabase/supabase-js';
import { runTranslationBatch, MIN_QUALITY_SCORE } from '../lib/i18n/translate-batch';

function arg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx === process.argv.length - 1) return null;
  return process.argv[idx + 1];
}

const dryRun = process.argv.includes('--dry-run');
const limit = Number(arg('limit') ?? Number.MAX_SAFE_INTEGER);
const concurrency = Number(arg('concurrency') ?? 4);

const apiKey = process.env.GEMINI_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!apiKey) {
  console.error('ERROR: GEMINI_API_KEY fehlt.');
  process.exit(1);
}
if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen.');
  process.exit(1);
}

async function main() {
  const supabase = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } });
  const today = new Date().toISOString().slice(0, 10);

  // count: 'planned' statt 'exact' — ein exakter COUNT über events (~280k
  // Zeilen) läuft auf der Instanz in den statement_timeout (CLAUDE.md,
  // "Bekannte Issues"). Der Planner-Schätzwert reicht für die Anzeige.
  const { count: remaining } = await supabase
    .from('events')
    .select('id', { count: 'planned', head: true })
    .is('title_en', null)
    .gte('start_date', today)
    .eq('publish_status', 'published')
    .gte('quality_score', MIN_QUALITY_SCORE);

  console.log('─── Event-Übersetzung DE → EN ' + '─'.repeat(30));
  console.log(`  offen (geschätzt): ${remaining ?? '?'}`);
  console.log(`  Limit dieser Lauf: ${limit === Number.MAX_SAFE_INTEGER ? 'alle' : limit}`);
  console.log(`  Concurrency:       ${concurrency}`);
  console.log(`  Modus:             ${dryRun ? 'DRY RUN (kein Write)' : 'schreibend'}`);
  console.log('─'.repeat(60));

  let lastLogged = 0;
  const result = await runTranslationBatch(supabase, apiKey!, {
    limit,
    concurrency,
    dryRun,
    onProgress: p => {
      if (p.processed - lastLogged < 25) return;
      lastLogged = p.processed;
      process.stdout.write(
        `\r  ${p.processed} bearbeitet · ${p.translated} übersetzt · ` +
        `${p.failed} Fehler · ${p.skipped} übersprungen   `,
      );
    },
  });

  process.stdout.write('\n');
  console.log('─'.repeat(60));
  console.log(`  bearbeitet:    ${result.processed}`);
  console.log(`  übersetzt:     ${result.translated}`);
  console.log(`  Fehler:        ${result.failed}`);
  console.log(`  übersprungen:  ${result.skipped}`);
  console.log(`  Dauer:         ${(result.durationMs / 1000).toFixed(1)}s`);

  // Ohne diese Aufschluesselung sagt ein Lauf mit 8 000 Fehlern nur "8 000
  // Fehler" — und die Ursache (Quota-Fenster? RECITATION? Timeout?)
  // entscheidet, ob ein zweiter Lauf ueberhaupt etwas bringt.
  if (result.errorKinds.length > 0) {
    console.log('  Fehlerursachen:');
    for (const { reason, count } of result.errorKinds.slice(0, 8)) {
      console.log(`    ${String(count).padStart(6)} × ${reason}`);
    }
  }

  // Ein Lauf mit ausschließlich Fehlern ist fast immer ein Auth-/Quota-
  // Problem und darf nicht als Erfolg durchgehen (sonst meldet ein Cron
  // grün, während nichts geschrieben wurde).
  if (result.processed > 0 && result.translated === 0 && result.failed > 0) {
    console.error('ERROR: kein einziges Event übersetzt — Gemini-Key oder Quota prüfen.');
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\nERROR:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
