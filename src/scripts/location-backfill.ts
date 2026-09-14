/**
 * Bestandssanierung (fn-25 Phase E1): kontrolliert, in Batches, mit
 * Versionsprüfung.
 *
 * Zwei Fälle:
 *  A) Zeilen MIT gesichertem Quellenstand (Rohspalten/raw_event_id): der
 *     Resolver entscheidet aus den Rohwerten neu (Belege aus DB), die ganze
 *     Entscheidung wird geschrieben (Position, Status, Genauigkeit,
 *     Herkunft, Protokoll, venue_id, Anzeigename-Fallback). `updated_at`
 *     muss dem gelesenen Stand entsprechen, sonst wird die Zeile
 *     übersprungen (paralleler Scrape / Admin). Konflikte gehen auf
 *     `needs_review`; Zeilen, die NUR wegen Ortskonflikt (A6/Vertrag)
 *     zurückgehalten waren und jetzt keinen Konflikt mehr haben, werden
 *     wieder veröffentlicht.
 *  B) Zeilen OHNE Quellenstand, die die Quelle beim Voll-Abruf nicht mehr
 *     geliefert hat (`--stale-since <iso>`): sie werden als ungeklärt
 *     erfasst (`unresolved`, Grund `source_not_redelivered`). Positionen aus
 *     dem alten Namensabgleich (exact, normalized, verified, from_title,
 *     from_description, gemini, gemini_low, nominatim, openai)
 *     werden durch den Gemeinde-Mittelpunkt der PLZ ersetzt (falls
 *     eindeutig) oder entfernt; Quellkoordinaten (`scraper`) bleiben, gelten
 *     aber als unbestätigt. Nichts davon zählt als „repariert".
 *
 * Reihenfolge: bevorstehende Termine zuerst. Bestehende Event-IDs bleiben.
 *
 * Aufruf:
 *   npx tsx --env-file=.env.local src/scripts/location-backfill.ts --with-raw [--source X] [--limit N] [--dry-run]
 *   npx tsx --env-file=.env.local src/scripts/location-backfill.ts --stale-since 2026-09-14T05:50:00Z [--limit N] [--dry-run]
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { reResolveStoredEvents, STORED_LOCATION_COLUMNS, type StoredEventLocationRow } from '../lib/location/re-resolve';
import { plzCentroid } from '../lib/location/gemeinde-index';

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i !== -1 ? argv[i + 1] : undefined; };
const DRY_RUN = argv.includes('--dry-run');
const WITH_RAW = argv.includes('--with-raw');
const STALE_SINCE = arg('--stale-since');
const SOURCE = arg('--source');
const LIMIT = arg('--limit') ? parseInt(arg('--limit')!, 10) : Infinity;
const LEGACY_LABELS = new Set(['exact', 'normalized', 'verified', 'from_title', 'from_description', 'gemini', 'gemini_low', 'nominatim', 'openai']);

type Row = StoredEventLocationRow & { source_name: string; publish_status: string | null; last_seen_at: string | null; raw_event_id: string | null; geocoding_source: string | null };

async function page(sb: SupabaseClient, afterId: string | null, mode: 'raw' | 'stale'): Promise<Row[]> {
  let q = sb
    .from('events')
    .select(STORED_LOCATION_COLUMNS + ', source_name, publish_status, last_seen_at, raw_event_id, geocoding_source')
    .gte('start_date', new Date().toISOString())
    .in('publish_status', ['published', 'published_low_confidence', 'needs_review'])
    .order('id', { ascending: true })
    .limit(500);
  if (SOURCE) q = q.eq('source_name', SOURCE);
  if (afterId) q = q.gt('id', afterId);
  if (mode === 'raw') q = q.not('raw_event_id', 'is', null);
  else q = q.is('raw_event_id', null).lt('last_seen_at', STALE_SINCE!);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Row[];
}

async function runWithRaw(sb: SupabaseClient) {
  let after: string | null = null;
  let seen = 0, written = 0, wouldWrite = 0, unchanged = 0, concurrent = 0, errors = 0, republished = 0, withheld = 0;
  while (seen < LIMIT) {
    const rows = await page(sb, after, 'raw');
    if (rows.length === 0) break;
    after = rows[rows.length - 1].id;
    seen += rows.length;
    for (let i = 0; i < rows.length; i += 100) {
      const slice = rows.slice(i, i + 100);
      const results = await reResolveStoredEvents(sb, slice, { dryRun: DRY_RUN, phase: 'E1-backfill' });
      for (const r of results) {
        if (r.written) written++;
        else if (r.skipped_reason === 'unchanged') unchanged++;
        else if (r.skipped_reason === 'concurrent_update') concurrent++;
        else if (r.skipped_reason === 'write_error') errors++;
        else wouldWrite++;
        // Veröffentlichung nachziehen (nur unsere Ortsgründe).
        const row = slice.find(x => x.id === r.id)!;
        const prevReasons = ((row.location_resolution as { reasons?: string[] } | null)?.reasons ?? []);
        const heldByUs = prevReasons.some(x => x.startsWith('a6_') || x === 'location_conflict_withheld');
        if (r.decision.status === 'conflict' && row.publish_status === 'published') {
          withheld++;
          if (!DRY_RUN) await sb.from('events').update({ publish_status: 'needs_review' }).eq('id', row.id);
        } else if (r.decision.status !== 'conflict' && row.publish_status === 'needs_review' && heldByUs) {
          republished++;
          if (!DRY_RUN) await sb.from('events').update({ publish_status: 'published' }).eq('id', row.id);
        }
      }
    }
    process.stdout.write(`\r[E1 raw] ${seen} gelesen, ${written} geschrieben, ${wouldWrite} würden geschrieben (dry-run), ${unchanged} unverändert, ${concurrent} parallel, ${errors} Fehler, ${withheld} zurückgehalten, ${republished} wieder veröffentlicht`);
  }
  console.log('');
}

async function runStale(sb: SupabaseClient) {
  let after: string | null = null;
  let seen = 0, centroid = 0, dropped = 0, kept = 0, errors = 0;
  while (seen < LIMIT) {
    const rows = await page(sb, after, 'stale');
    if (rows.length === 0) break;
    after = rows[rows.length - 1].id;
    seen += rows.length;
    for (const row of rows) {
      const legacy = row.latitude != null && (row.geocoding_confidence == null || LEGACY_LABELS.has(row.geocoding_confidence) || (row.geocoding_source ?? '').startsWith('master'));
      const reasons = [`source_not_redelivered_since:${STALE_SINCE}`];
      let payload: Record<string, unknown>;
      if (legacy) {
        const c = row.postal_code && (row.country ?? 'AT') === 'AT' ? plzCentroid(row.postal_code, row.location_name) : null;
        if (c && !c.ambiguous) {
          centroid++;
          reasons.push('legacy_position_replaced_by_plz_centroid');
          payload = {
            latitude: c.lat, longitude: c.lng, geocoding_confidence: 'gemeinde-centroid', geocoding_source: 'E1:plz-centroid',
            location_status: 'municipality_only', location_precision: 'postcode',
          };
        } else {
          dropped++;
          reasons.push('legacy_position_removed');
          payload = { latitude: null, longitude: null, geocoding_confidence: null, geocoding_source: 'revoked:E1', location_status: 'unresolved', location_precision: 'unknown' };
        }
      } else {
        kept++;
        payload = { location_status: row.latitude != null ? 'unresolved' : (row.location_status ?? 'unresolved'), location_precision: row.latitude != null ? 'unknown' : (row.location_status ? undefined : 'unknown') };
      }
      payload.location_resolution = {
        version: 1, status: payload.location_status, precision: payload.location_precision ?? 'unknown', reasons, phase: 'E1-stale',
        allowed: { pin: false, route: false, distance: false, municipality_page: payload.location_status === 'municipality_only' },
        revoked: legacy ? { latitude: row.latitude, longitude: row.longitude, geocoding_confidence: row.geocoding_confidence, geocoding_source: row.geocoding_source } : null,
        resolved_at: new Date().toISOString(),
      };
      if (!DRY_RUN) {
        let q = sb.from('events').update(payload).eq('id', row.id);
        q = row.updated_at ? q.eq('updated_at', row.updated_at) : q.is('updated_at', null);
        const { error } = await q;
        if (error) { errors++; console.error(`[E1 stale] ${row.id}: ${error.message}`); }
      }
    }
    process.stdout.write(`\r[E1 stale] ${seen} gelesen, ${centroid} auf PLZ-Mittelpunkt, ${dropped} Position entfernt, ${kept} Quellkoordinate behalten (unbestätigt), ${errors} Fehler`);
  }
  console.log('');
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase-Env fehlt');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  if (!WITH_RAW && !STALE_SINCE) { console.error('--with-raw oder --stale-since <iso> angeben'); process.exit(2); }
  if (WITH_RAW) await runWithRaw(sb);
  if (STALE_SINCE) await runStale(sb);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
