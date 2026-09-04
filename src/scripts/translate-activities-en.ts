/**
 * Backfill: englische Beschreibungen für Freizeit-POIs (fn-17).
 *
 * Gegenstück zu `translate-events-en.ts`, gleiche Mechanik (siehe
 * `src/lib/i18n/translate-batch.ts`), andere Tabelle. Solange
 * `poi_activities.description_en` fehlt, rendert /en/aktivitaet/<slug>
 * deutschen Text, kanonisiert auf die DE-URL und steht nur mit der
 * DE-URL in der Sitemap.
 *
 * Der Lauf ist jederzeit abbrechbar und fortsetzbar — der Filter ist
 * `description_en IS NULL`.
 *
 * Usage:
 *   npm run translate:activities -- --dry-run --limit 20
 *   npm run translate:activities -- --limit 3000 --concurrency 10
 */

import { createClient } from '@supabase/supabase-js';
import { runActivityTranslationBatch, MIN_ACTIVITY_DESCRIPTION, isQuotaExhausted } from '../lib/i18n/translate-batch';

function arg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx === process.argv.length - 1) return null;
  return process.argv[idx + 1];
}

const dryRun = process.argv.includes('--dry-run');
const limit = Number(arg('limit') ?? Number.MAX_SAFE_INTEGER);
const concurrency = Number(arg('concurrency') ?? 8);

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

  // poi_activities ist mit ~11k Zeilen klein genug für einen exakten
  // COUNT — anders als events (~280k), wo nur count:'planned' durchgeht.
  const { count: remaining } = await supabase
    .from('poi_activities')
    .select('id', { count: 'exact', head: true })
    .is('description_en', null)
    .eq('visible', true)
    .eq('is_closed', false)
    .not('description', 'is', null);

  console.log('─── POI-Beschreibungen DE → EN ' + '─'.repeat(29));
  console.log(`  offen:             ${remaining ?? '?'}`);
  console.log(`  Mindestlänge:      ${MIN_ACTIVITY_DESCRIPTION} Zeichen (E7-Gate)`);
  console.log(`  Limit dieser Lauf: ${limit === Number.MAX_SAFE_INTEGER ? 'alle' : limit}`);
  console.log(`  Concurrency:       ${concurrency}`);
  console.log(`  Modus:             ${dryRun ? 'DRY RUN (kein Write)' : 'schreibend'}`);
  console.log('─'.repeat(60));

  let lastLogged = 0;
  const result = await runActivityTranslationBatch(supabase, apiKey!, {
    limit,
    concurrency,
    dryRun,
    onProgress: p => {
      if (p.processed - lastLogged < 25) return;
      lastLogged = p.processed;
      process.stdout.write(
        `\r  ${p.processed} bearbeitet · ${p.translated} übersetzt · ` +
        `${p.failed} Fehler · ${p.skipped} zu kurz   `,
      );
    },
  });

  process.stdout.write('\n');
  console.log('─'.repeat(60));
  console.log(`  bearbeitet:    ${result.processed}`);
  console.log(`  übersetzt:     ${result.translated}`);
  console.log(`  Fehler:        ${result.failed}`);
  console.log(`  zu kurz:       ${result.skipped}`);
  console.log(`  Dauer:         ${(result.durationMs / 1000).toFixed(1)}s`);

  if (result.errorKinds.length > 0) {
    console.log('  Fehlerursachen:');
    for (const { reason, count } of result.errorKinds.slice(0, 8)) {
      console.log(`    ${String(count).padStart(6)} × ${reason}`);
    }
  }

  // Tageskontingent erschöpft ist auf dem Free Tier der Normalfall
  // (10 000 Requests/Tag), kein Fehler — der nächste Lauf macht weiter.
  if (isQuotaExhausted(result)) {
    console.log('  Abbruch: Gemini-Tageskontingent erschöpft — der nächste Lauf macht weiter.');
    return;
  }

  if (result.processed > 0 && result.translated === 0 && result.failed > 0) {
    console.error('ERROR: keine einzige Beschreibung übersetzt — Gemini-Key prüfen.');
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\nERROR:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
