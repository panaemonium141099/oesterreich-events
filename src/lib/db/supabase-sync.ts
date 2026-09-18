/**
 * Supabase sync for scraper pipeline.
 *
 * Upserts a batch of ScrapedEvents into the Supabase `events` table using
 * the service role key (bypasses RLS). Conflict resolution: ON CONFLICT
 * (source_name, source_id) -> update all mutable fields.
 *
 * Ortsentscheidung (fn-25, Phase A):
 * - `location_name` ist immer der Rohwert der Quelle; kein Normalizer
 *   ersetzt ihn mehr (siehe docs/ORTSDATEN-ANALYSE-2026-09-13.md).
 * - Koordinaten kommen nur von der Quelle oder als gekennzeichneter
 *   Gemeinde-/PLZ-Mittelpunkt aus einer genannten PLZ
 *   (`src/lib/location/conservative-resolution.ts`).
 * - Batch-prefetch der Bestandszeilen; Altkoordinaten werden nur nach dem
 *   Rang in CONFIDENCE_RANK ersetzt, die Entscheidung protokolliert, was
 *   tatsächlich in der Zeile steht (`location_resolution`).
 *
 * Confidence-aware category handling (central classifier):
 * - Raw scraper-provided category/tags are persisted as source_category_raw /
 *   source_tags_raw and are only signals, never the final answer.
 * - The deterministic classifier runs inline on every upsert and writes
 *   category + tags + category_confidence + category_source + category_version.
 * - category_locked=true on an existing row prevents any overwrite.
 * - New deterministic confidence only overwrites existing categorization when
 *   its rank is <= the existing rank (never downgrades ai -> ai_low silently).
 * - Events that the deterministic stage cannot accept are flagged
 *   category_needs_review=true for the batch AI script.
 *
 * Used by runScraper() so every scraper writes directly to Supabase
 * in addition to SQLite (dual-write pattern).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ScrapedEvent } from '@/types/events';
import {
  resolveCanonicalCategory,
  type ExistingCategoryRow,
} from '@/lib/category-classifier';
import type { LocationInput } from '@/lib/location/conservative-resolution';
import { resolveEventLocation, type LocationEvidence, type ResolvedLocation } from '@/lib/location/resolver';
import { loadLocationEvidence } from '@/lib/location/evidence';
import { applyAdmissionToPosition } from '@/lib/location/contract';
import type { LocationDecision, LocationStatus } from '@/lib/location/types';
import {
  closeScrapeRun,
  openScrapeRun,
  persistRawEvents,
} from '@/lib/db/raw-persist';
import { normalizeDistrict, isCanonicalDistrict } from '@/lib/district-normalizer';
import { districtFromPlz, districtFromGemeinde } from '@/lib/plz-district';
import { bundeslandToId } from '@/lib/bundeslaender';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { getBundeslandFromPLZ } from '@/lib/plzCoordinates';
import { bundeslandFromPolygon } from '@/lib/eventim/bundesland-from-geo';
import { generateFingerprint } from '@/lib/dedup/fingerprint';
import { generateEventSlug } from '@/lib/utils/slugify';
import { scoreAndAdmit } from '@/lib/quality/score-event';
import { isContactHandleTitle } from '@/lib/scrapers/detail-extract/validate';
import { extractDimsFromUrl } from '@/lib/event-images/extract-dims-from-url';
import {
  validateAndUpgradeImageUrl,
  type ValidatedImage,
} from '@/lib/event-images/validate-upgrade';
import {
  shouldUpgradeImage,
  pickFinalImageWidth,
  pickFinalImageHeight,
  shouldOverwriteAddress,
  shouldOverwriteDescription,
  shouldOverwritePrice,
} from '@/lib/db/upsert-guards';
import {
  evaluateAdmission,
  type AdmissionReason,
  type AdmissionVerdict,
} from '@/lib/quality/admission';

/**
 * Punkt-in-Polygon-Auflösung Koordinate → Bundesland für die
 * Widerspruchsprüfung im Freigabevertrag.
 *
 * `bundesland-from-geo` liest seine GeoJSON erst beim ersten Aufruf (und
 * cached sie), der Import selbst kostet nichts. Die Datei-Pfade dort sind
 * voll-literal, damit Vercels output-file-tracing genau die neun
 * Bundesland-Dateien einsammelt statt public/ komplett (siehe den
 * 597-MB-Zwischenfall im Kommentar dieses Moduls).
 *
 * Fehlertolerant: schlägt das Laden fehl (Dateien nicht mitgebündelt),
 * liefert der Resolver `null`. `evaluateAdmission` behandelt das als
 * "keine Aussage" und behauptet dann nichts, statt zu raten.
 */
let regionWarned = false;

function regionOfCoords(lat: number, lng: number): string | null {
  try {
    return bundeslandFromPolygon(lat, lng);
  } catch (e) {
    if (!regionWarned) {
      regionWarned = true;
      console.warn(
        '[supabase-sync] Bundesland-Polygone nicht verfügbar — Regions-Gegenprobe übersprungen:',
        e instanceof Error ? e.message : e,
      );
    }
    return null;
  }
}

/**
 * Rangfolge der Koordinatenherkunft (kleiner = gewinnt beim Überschreiben).
 *
 * Neu geordnet 2026-09-13 (fn-25): Die Quelle ist für ihre eigene
 * Koordinate maßgeblich. Vorher standen Normalizer-Treffer (`exact`,
 * `normalized`) und KI-Ergebnisse ÜBER Feed-Koordinaten und
 * Gemeinde-Zentroide auf einer Stufe mit manuellen Korrekturen; damit
 * konnte weder ein Re-Scrape noch eine belegte Position eine falsche
 * Zuordnung ablösen (Review-Befund P0). Gemeinde-/PLZ-Mittelpunkte sind
 * Gebietsangaben und sperren keine bessere belegte Position.
 */
const CONFIDENCE_RANK: Record<string, number> = {
  manual: 0,                 // gültige Korrektur aus event_location_corrections (Resolver)
  'json-ld-venue': 1,        // strukturierte Venue-Angabe der Quellseite
  scraper: 2,                // Koordinate der Quelle selbst
  venue: 2,                  // belegter Venue-Kandidat / bestätigte Quellen-Venue-Zuordnung (Resolver)
  address: 3,                // geocodierte Eventadresse mit Hausnummer (Resolver)
  openai: 4,                 // Alt-Refinement (wird nicht mehr geschrieben)
  gemini: 4,
  nominatim: 5,
  'gemeinde-centroid': 6,    // Gemeinde-/PLZ-Mittelpunkt aus genannter PLZ (Gebietsangabe)
  'gemeinde-registry': 6,    // Mapbox-verifizierter Gemeinde-Zentroid (Gebietsangabe)
  exact: 7,                  // Alt-Normalizer, nicht mehr geschrieben
  normalized: 8,
  verified: 9,               // Alt-Master-Koordinaten (apply_master_coords_bulk)
  from_title: 10,
  from_description: 11,
  gemini_low: 12,
};

/** Herkünfte, deren Position deterministisch aus Belegen folgt: eine
 *  geänderte Position ist dann eine Korrektur, kein Rauschen. */
const DETERMINISTIC_CONFIDENCES = new Set(['manual', 'scraper', 'venue', 'address']);

function getConfidenceRank(confidence: string | null | undefined): number {
  if (!confidence) return Infinity; // NULL = lowest priority
  return CONFIDENCE_RANK[confidence] ?? Infinity;
}

/** Unsere Eventim-Austria-Partner-ID. Steckt auch in den Deeplinks des
 *  PFT-Feeds (siehe src/lib/eventim/types.ts). */
export const EVENTIM_AFFILIATE_ID = 'J70';

/**
 * Schreibt oeticket.com-Deeplinks auf UNSERE Affiliate-ID um.
 *
 * oeticket.com ist Eventim Austria. Aggregator-Quellen liefern deren
 * Deeplinks samt eigener Partner-ID mit — eventfinder.at etwa mit
 * `?affiliate=H51`. V4SideBox rendert die TicketBox für jeden gesetzten
 * `ticketUrl`, nicht nur für source_name='Eventim'. Ungeprüft durchgereicht
 * steht damit ein echter Ticket-Button auf unserer Seite, dessen Provision
 * an einen Mitbewerber geht (Befund 2026-08-26: 520 kommende Events mit
 * H51, per Backfill bereinigt — dieser Guard hält es dauerhaft dicht).
 *
 * Nicht-oeticket-URLs und unparsbare Strings bleiben unangetastet.
 */
export function normalizeTicketUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw; // kein gültiger Absolut-Link → unverändert lassen
  }
  if (!/(^|\.)oeticket\.com$/i.test(url.hostname)) return raw;
  url.searchParams.set('affiliate', EVENTIM_AFFILIATE_ID);
  return url.toString();
}

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for scraper sync');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Existing row shape returned by batch-prefetch. */
interface ExistingRow {
  id: string;
  source_name: string;
  source_id: string;
  latitude: number | null;
  longitude: number | null;
  geocoding_confidence: string | null;
  geocoding_source: string | null;
  category: string | null;
  tags: string[] | null;
  category_confidence: string | null;
  category_source: string | null;
  category_version: string | null;
  category_locked: boolean | null;
  category_needs_review: boolean | null;
  category_reason: string | null;
  category_candidates: unknown;
  /** The URL slug. Once persisted it MUST NOT change — it's baked into
   *  Google-indexed URLs, bookmarks, and social shares. See
   *  `resolveStableSlug()` below. */
  slug: string | null;
  /** Existing publish_status — used to preserve non-computed values
   *  (e.g. 'duplicate' set by dedup, or any future manual admin status)
   *  on re-upsert. See COMPUTED_PUBLISH_STATUSES below. */
  publish_status: string | null;
  /** fn-25 O1: bisheriger Ortsstatus und Zeitpunkt seines letzten Wechsels. */
  location_status: string | null;
  location_status_changed_at: string | null;
  // ─── UPSERT-Guard fields (fn-14.5) ─────────────────────────────────
  // These are read so toSupabaseRow() can decide whether to upgrade or
  // preserve the existing value. When a guard says "keep old", the
  // existing value is written back VERBATIM into the upsert payload
  // (see the longer note above the guard imports for why omitting the
  // key would be unsafe with PostgREST bulk upsert). last_seen_at is
  // the only column that always advances on every upsert.
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  description: string | null;
  enrichment_version: string | null;
  price_text: string | null;
  /** Preis-Gruppe: der Text wird nur gemeinsam mit den Zahlen aktualisiert. */
  price_min: number | null;
  price_max: number | null;
  address: string | null;
  // Facetten (Quelle oder frühere Anreicherung): werden nur ersetzt, wenn
  // der Adapter selbst welche liefert, sonst verbatim zurückgeschrieben.
  audience: string[] | null;
  setting: string[] | null;
  occasion_tags: string[] | null;
  price_flags: string[] | null;
  language: string | null;
  is_family_friendly: boolean | null;
  image_credit: string | null;
}

/** Statuses that the scoring pipeline owns. Everything else (e.g.
 *  'duplicate' from dedup, future admin overrides) is preserved on
 *  re-upsert so a routine scrape can't accidentally promote a
 *  duplicate row back to 'published'. */
const COMPUTED_PUBLISH_STATUSES = new Set([
  'published',
  'published_low_confidence',
  'needs_review',
  'suppressed',
]);

/**
 * Batch-prefetch existing rows by composite key (source_name, source_id).
 * Returns a map keyed by "source_name::source_id".
 *
 * Strategy: fetch by unique source_names using .in() (safe, no escaping needed
 * since .in() uses Supabase SDK's array parameter binding), then filter
 * client-side by source_id to match the exact composite keys.
 */
async function prefetchExistingRows(
  supabase: SupabaseClient,
  keys: Array<{ source_name: string; source_id: string }>
): Promise<Map<string, ExistingRow>> {
  const map = new Map<string, ExistingRow>();
  if (keys.length === 0) return map;

  // Build a set of expected composite keys for client-side filtering
  const expectedKeys = new Set(keys.map(k => `${k.source_name}::${k.source_id}`));

  // Get unique source_names to query (within a batch, usually 1-3 unique scrapers)
  const uniqueSourceNames = [...new Set(keys.map(k => k.source_name))];

  // Also get unique source_ids for a secondary filter to reduce result set
  const uniqueSourceIds = [...new Set(keys.map(k => k.source_id))];

  // Supabase .in() has a practical limit; split source_ids into sub-batches
  const SUB_BATCH = 200;
  for (let i = 0; i < uniqueSourceIds.length; i += SUB_BATCH) {
    const idSlice = uniqueSourceIds.slice(i, i + SUB_BATCH);
    const { data, error } = await supabase
      .from('events')
      .select(
        'id, source_name, source_id, latitude, longitude, geocoding_confidence, geocoding_source, ' +
          'category, tags, category_confidence, category_source, category_version, ' +
          'category_locked, category_needs_review, category_reason, category_candidates, slug, ' +
          'publish_status, location_status, location_status_changed_at, ' +
          // fn-14.5 UPSERT-Guard fields:
          'image_url, image_width, image_height, description, enrichment_version, price_text, ' +
          'price_min, price_max, address, ' +
          'audience, setting, occasion_tags, price_flags, language, is_family_friendly, image_credit',
      )
      .in('source_name', uniqueSourceNames)
      .in('source_id', idSlice);

    if (error) {
      console.error('[supabase-sync] prefetch error:', error.message);
      continue;
    }
    // Supabase's generated types infer a narrow row shape from the SELECT
    // string; our SELECT is long enough that it falls back to a pessimistic
    // union, so we widen to ExistingRow[] explicitly.
    const rows = (data ?? []) as unknown as ExistingRow[];
    for (const row of rows) {
      const key = `${row.source_name}::${row.source_id}`;
      // Client-side filter: only include rows that match our exact composite keys
      if (expectedKeys.has(key)) {
        map.set(key, row);
      }
    }
  }
  return map;
}

/**
 * Ortsentscheidung für ein Scraper-Event (fn-25). Die Quelle liefert den
 * Namen, die Entscheidung liefert Position, PLZ, Gemeinde, Status,
 * Genauigkeit und die erlaubte Ausspielung. Kein Namensabgleich mehr.
 */
function locationInputOf(event: ScrapedEvent, existingId?: string | null): LocationInput {
  return {
    event_id: existingId ?? null,
    source_name: event.source_name,
    title: event.title,
    location_name: event.location_name ?? null,
    address: event.address ?? null,
    postal_code: event.postal_code ?? null,
    city: event.city ?? null,
    bundesland: event.bundesland ?? null,
    country: event.country ?? null,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    coords_precision: event.coords_precision ?? null,
    source_venue_id: event.source_venue_id ?? null,
  };
}

function decideLocation(event: ScrapedEvent, evidence: LocationEvidence, existingId?: string | null): ResolvedLocation {
  return resolveEventLocation(locationInputOf(event, existingId), evidence);
}

/**
 * Wenn der Rang-Vergleich die Bestandskoordinate behält, muss die
 * gespeicherte Entscheidung DAS beschreiben, was tatsächlich in der Zeile
 * steht, nicht das, was die Quelle diesmal geliefert hat. Alt-Labels
 * (`exact`, `normalized`, `verified`, …) stammen aus dem abgeschalteten
 * Namensabgleich und gelten deshalb als unbestätigt; Phase E findet sie
 * über den Grund `legacy_coords_retained`.
 */
function retainedStatusFor(confidence: string | null): { status: LocationStatus; precision: LocationDecision['precision'] } {
  switch (confidence) {
    case 'manual':
    case 'json-ld-venue':
      return { status: 'address_confirmed', precision: 'building' };
    case 'venue':
      return { status: 'venue_confirmed', precision: 'building' };
    case 'address':
      return { status: 'address_confirmed', precision: 'street' };
    case 'gemeinde-registry':
    case 'gemeinde-centroid':
      return { status: 'municipality_only', precision: 'municipality' };
    default:
      return { status: 'unresolved', precision: 'unknown' };
  }
}

/**
 * Entscheidet, ob neue Koordinaten die bestehenden ersetzen.
 *
 * - Ohne Bestandskoordinate wird immer geschrieben.
 * - Ein besserer Rang ersetzt; derselbe Rang ersetzt NUR bei
 *   deterministischen Herkünften (`manual`, `scraper`, `venue`, `address`):
 *   die Quelle ist für ihre eigene Koordinate maßgeblich, eine geänderte
 *   Quellkoordinate ist eine Korrektur oder eine Verlegung; eine neue
 *   Korrektur ersetzt die alte.
 * - `manual` (Rang 0) wird von keiner automatischen Herkunft ersetzt. Ob
 *   das Label noch durch eine gültige Korrektur gedeckt ist, prüft der
 *   Schreibpfad (`toSupabaseRow`), nicht diese Rangregel.
 * - Die frühere 5-km-Sperre entfällt: Sie hielt falsche Zuordnungen fest,
 *   sobald der richtige Ort zufällig in der Nähe lag.
 */
export function shouldOverwriteCoords(
  existing: Pick<ExistingRow, 'latitude' | 'longitude' | 'geocoding_confidence'>,
  newLat: number | null,
  newLng: number | null,
  newConfidence: string | null
): boolean {
  if (newLat == null || newLng == null) return false;
  if (existing.latitude == null || existing.longitude == null) return true;

  const existingRank = getConfidenceRank(existing.geocoding_confidence);
  const newRank = getConfidenceRank(newConfidence);

  if (newRank < existingRank) return true;
  if (newRank === existingRank && newConfidence && DETERMINISTIC_CONFIDENCES.has(newConfidence)) {
    return existing.latitude !== newLat || existing.longitude !== newLng;
  }
  return false;
}

// ─── fn-14.5 UPSERT-Guards ───────────────────────────────────────────
// Predicates live in `./upsert-guards.ts` so they can be unit-tested
// against the same production code, with no copy in the test file.
//
// IMPORTANT (Codex review): we cannot rely on omitting keys from
// individual rows in a bulk Supabase `.upsert(batch)` call to mean
// "leave this column untouched". PostgREST normalises rows to a
// uniform key set across the batch — a row that drops `image_url`
// while another row in the same batch includes it can end up with
// `image_url = NULL` after the upsert. So when a guard says "keep
// old", we WRITE BACK the existing value verbatim. That keeps the
// column unchanged in Postgres and guarantees consistent batch row
// shapes regardless of which rows win or lose the guard.
//
// `last_seen_at` is the only column that always advances on every
// upsert — it's the soft-delete anchor the fn-14.6 nightly job
// reads.

/**
 * Build the category-reconciliation input shape from an existing row.
 * Returns null when there is no pre-existing event (fresh insert path).
 */
function toExistingCategoryRow(row: ExistingRow | undefined): ExistingCategoryRow | null {
  if (!row) return null;
  return {
    category: row.category,
    tags: row.tags,
    category_confidence: row.category_confidence,
    category_source: row.category_source,
    category_version: row.category_version,
    category_locked: row.category_locked,
    category_needs_review: row.category_needs_review,
    category_reason: row.category_reason,
    category_candidates: row.category_candidates,
  };
}

/** Maps a ScrapedEvent to the Supabase events row shape. */
/** Rohschicht-Ergebnis für einen Batch (fn-25 B1). */
interface RawRefs {
  /** `source_name::source_id` → raw_events.id */
  ids: Map<string, string>;
  /** Schlüssel ohne gesicherten Quellenstand → nicht veröffentlichen. */
  failed: Set<string>;
}

function toSupabaseRow(
  event: ScrapedEvent,
  existingMap: Map<string, ExistingRow>,
  imageMap: Map<string, ValidatedImage>,
  rawRefs: RawRefs = { ids: new Map(), failed: new Set() },
  evidence: LocationEvidence = {},
) {
  const key = `${event.source_name}::${event.source_id}`;
  const existing = existingMap.get(key);
  const decision = decideLocation(event, evidence, existing?.id);
  // `resolved` bündelt, was tatsächlich in die Zeile geschrieben wird —
  // die Entscheidung selbst bleibt unverändert und wandert als Protokoll
  // in `location_resolution`.
  const resolved = {
    locationName: decision.location_name,
    postalCode: decision.postal_code,
    latitude: decision.latitude,
    longitude: decision.longitude,
    confidence: decision.geocoding_confidence as string | null,
    source: decision.geocoding_source,
    status: decision.status,
    precision: decision.precision,
    reasons: [...decision.reasons],
  };

  let finalLat = resolved.latitude;
  let finalLng = resolved.longitude;
  let finalConfidence = resolved.confidence;
  let finalSource = resolved.source;

  // Verworfene Werte werden explizit entfernt (Review §7): ein Konflikt
  // oder ein Online-Event hat KEINE Position — auch nicht die alte aus der
  // Zeile. Vorher hielt die Rang-Regel („keine neue Koordinate → alte
  // behalten") 686 Konflikt-Zeilen mit Pin fest (Prod-Befund 2026-09-14).
  const decisionForbidsPosition = decision.status === 'conflict' || decision.status === 'online';

  // Ein `manual`-Label in der Zeile schützt nur, solange eine gültige
  // Korrektur als Beleg vorliegt und zum Quellenstand passt; dann ist die
  // Entscheidung selbst `manual`. Fehlt sie oder ist sie veraltet
  // (Verlegung), fällt die alte Position: keine ewige Koordinatensperre
  // (Review §7). Konnte die Korrekturtabelle nicht gelesen werden, bleibt
  // der Bestand unverändert.
  const manualLabelReleased =
    existing?.geocoding_confidence === 'manual' &&
    decision.geocoding_confidence !== 'manual' &&
    evidence.correctionsLoaded === true;
  if (manualLabelReleased) resolved.reasons.push('manual_label_released');

  // Belegte Positionen (`venue`, `address`) leben von ihrem Beleg. Trägt die
  // aktuelle Entscheidung keinen solchen Beleg mehr (Adresse verworfen oder
  // nicht mehr geliefert, Kandidat weg), ist die alte Position nicht mehr
  // gedeckt und wird nicht per Rang festgehalten. Nur bei vollständig
  // geladenen Belegen, sonst bliebe ein Ausfall der Belegquellen unbemerkt.
  const evidenceGone =
    !!existing &&
    (existing.geocoding_confidence === 'address' || existing.geocoding_confidence === 'venue') &&
    decision.geocoding_confidence !== 'address' && decision.geocoding_confidence !== 'venue' && decision.geocoding_confidence !== 'manual' &&
    evidence.complete === true;
  if (evidenceGone) resolved.reasons.push(`evidence_gone:${existing!.geocoding_confidence}`);

  if (existing && !decisionForbidsPosition && !manualLabelReleased && !evidenceGone) {
    const samePoint =
      existing.latitude != null && existing.longitude != null && resolved.latitude != null && resolved.longitude != null &&
      Math.abs(existing.latitude - resolved.latitude) < 1e-6 && Math.abs(existing.longitude - resolved.longitude) < 1e-6;
    // Stammt die Position aus der Quelle selbst (Provenienz `source`), ist
    // die Quelle für ihre eigene Koordinate maßgeblich, gleich welches Label
    // die Entscheidung trägt (Feed-Platzhalter → `gemeinde-centroid`): eine
    // geänderte Quellkoordinate ist eine Korrektur oder Verlegung.
    // Nur bei vollständig geladenen Belegen: ohne Belege sähe ein belegter
    // Bestand fälschlich wie „von der Quelle abgestuft" aus.
    const rankConfidence = decision.provenance.latitude === 'source' && evidence.complete === true ? 'scraper' : resolved.confidence;
    // Gleiche Position: das Label folgt der Entscheidung (z. B. Feed-
    // Platzhalter, bisher `scraper`, jetzt Gebietsangabe `gemeinde-centroid`).
    if (!samePoint && !shouldOverwriteCoords(existing, resolved.latitude, resolved.longitude, rankConfidence)) {
      // Bestandskoordinate bleibt — die gespeicherte Entscheidung muss das
      // abbilden, sonst behauptet sie eine Position, die nicht in der Zeile
      // steht.
      finalLat = existing.latitude;
      finalLng = existing.longitude;
      finalConfidence = existing.geocoding_confidence;
      finalSource = existing.geocoding_source;
      if (existing.latitude != null && existing.longitude != null) {
        const retained = retainedStatusFor(existing.geocoding_confidence);
        resolved.status = retained.status;
        resolved.precision = retained.precision;
        resolved.reasons.push(`legacy_coords_retained:${existing.geocoding_confidence ?? 'null'}`);
      }
    }
  }

  // Feed sources (e.g. Eventim) provide an authoritative category via an
  // explicit code map — `category_locked` short-circuits the text classifier
  // so the mapped category is never overwritten by title/description guessing.
  const canonical = event.category_locked && event.category
    ? ({
        category: event.category,
        tags: event.tags ?? null,
        category_confidence: 'manual',
        category_source: 'manual',
        category_version: event.category_lock_reason ? 'source-map' : 'eventim-feed',
        category_locked: true,
        category_needs_review: false,
        category_reason: event.category_lock_reason ?? 'eventim feed category code map',
        category_candidates: null,
        changed: true,
        reconcileReason: 'locked',
      } as unknown as ReturnType<typeof resolveCanonicalCategory>)
    : resolveCanonicalCategory(
        {
          title: event.title,
          description: event.description ?? null,
          source_tags_raw: event.tags ?? null,
          source_category_raw: event.category ?? null,
          source_name: event.source_name,
          organizer: event.organizer ?? null,
          location_name: event.location_name ?? null,
        },
        toExistingCategoryRow(existing),
      );

  // ─── fn-14.5 Image guard ─────────────────────────────────────────
  // imageMap has the validated/upgraded URL + extracted dims (when
  // possible). Dim-resolution rule:
  //   - If the validator UPGRADED the URL (new URL ≠ scraper URL),
  //     we trust ONLY the validator's dims. The scraper's dims
  //     described the pre-upgrade variant — re-using them on a
  //     wider URL persists impossible metadata (e.g. w_2000 with
  //     scraper-supplied h_300 from the original w_400 variant).
  //   - If the validator kept the original URL (unknown CDN, HEAD
  //     failed, already at-target), fall back to the scraper's dims
  //     so HTML-attribute extraction still flows through.
  const validated = imageMap.get(key);
  const scraperImageUrl = event.image_url ?? null;
  const scraperImageWidth =
    typeof event.image_width === 'number' && event.image_width > 0 ? event.image_width : null;
  const scraperImageHeight =
    typeof event.image_height === 'number' && event.image_height > 0 ? event.image_height : null;
  const newImageUrl = validated?.url || scraperImageUrl;
  const urlWasUpgraded =
    !!validated?.url && !!scraperImageUrl && validated.url !== scraperImageUrl;
  const validatorWidth =
    validated?.width && validated.width > 0 ? validated.width : null;
  const validatorHeight =
    validated?.height && validated.height > 0 ? validated.height : null;
  const newImageWidth = urlWasUpgraded
    ? validatorWidth
    : (validatorWidth ?? scraperImageWidth);
  const newImageHeight = urlWasUpgraded
    ? validatorHeight
    : (validatorHeight ?? scraperImageHeight);
  const upgradeImage = shouldUpgradeImage(
    newImageUrl,
    newImageWidth,
    newImageHeight,
    existing?.image_url ?? null,
    existing?.image_width ?? null,
    existing?.image_height ?? null,
    // HEAD-validated CDN allowlist upgrade — accepts the new URL
    // even when extracted dims are absent (e.g. WordPress strip
    // pattern). Validator only sets this flag on actual URL change.
    validated?.upgraded === true,
  );

  // ─── fn-14.5 Description guard ───────────────────────────────────
  // For raw scraper writes the new enrichment_version is unknown
  // (null) — we never set it from this function. Pass null so the
  // length comparison runs but the version-upgrade branch is skipped.
  const newDescription = event.description ?? null;
  const overwriteDescription = shouldOverwriteDescription(
    newDescription,
    existing?.description ?? null,
    null,
    existing?.enrichment_version ?? null,
  );

  // ─── fn-14.5 Price-text guard ────────────────────────────────────
  // Preis-Gruppe: der Text zieht mit, sobald sich der numerische Preis
  // belegbar geaendert hat — sonst zeigt die Detailseite den alten Text
  // neben dem neuen Betrag (Prod-Befund 2026-09-06: 875 Events).
  const overwritePrice = shouldOverwritePrice(
    event.price_text ?? null,
    existing?.price_text ?? null,
    event.price_min ?? null,
    existing?.price_min ?? null,
    event.price_max ?? null,
    existing?.price_max ?? null,
  );

  // ─── Address guard (hourly-sync safe) ────────────────────────────
  // Don't let a re-scrape that no longer carries a street erase an
  // address that detail-fetch / enrichment populated earlier.
  const overwriteAddress = shouldOverwriteAddress(
    event.address ?? null,
    existing?.address ?? null,
  );
  // fn-25: Eine als Seitenadresse verworfene Angabe darf nicht über die
  // „nicht auf NULL setzen"-Regel aus dem Bestand weiterleben.
  const finalAddress = event.address_rejected
    ? null
    : overwriteAddress
      ? (event.address ?? null)
      : (existing?.address ?? null);
  if (event.address_rejected) resolved.reasons.push(`address_rejected:${event.address_rejected}`);

  // Resolve final guarded values FIRST so every row in the batch
  // carries the SAME key set (otherwise PostgREST's bulk-upsert
  // key-shape normalisation can clobber preserved columns with NULL —
  // see Codex-review note above the imports). When the guard says
  // "keep old", we explicitly write back the existing value verbatim.
  //
  // Width and height are picked INDEPENDENTLY of the URL-upgrade
  // decision: even when we keep the existing URL, a freshly-known
  // dim from the same URL still backfills its column. And when we
  // adopt a wider new URL with unknown height, the existing height
  // is preserved instead of NULL-clobbered.
  //
  // CRITICAL: build these BEFORE scoring so quality_score reflects
  // the row that will actually be persisted (e.g. whitespace-only
  // description rejected by the guard → row stores NULL → score
  // must also evaluate against NULL, not the rejected raw input).
  const finalImageUrl = upgradeImage ? newImageUrl : (existing?.image_url ?? null);
  const finalImageWidth = pickFinalImageWidth(
    upgradeImage,
    newImageWidth,
    existing?.image_width ?? null,
  );
  const finalImageHeight = pickFinalImageHeight(
    upgradeImage,
    newImageHeight,
    existing?.image_height ?? null,
  );
  const finalDescription = overwriteDescription
    ? newDescription
    : (existing?.description ?? null);
  const finalPriceText = overwritePrice
    ? (event.price_text ?? null)
    : (existing?.price_text ?? null);
  // Fremde Affiliate-IDs in oeticket-Deeplinks auf J70 umbiegen, bevor der
  // Wert sowohl ins Quality-Scoring als auch in die Zeile geht.
  const finalTicketUrl = normalizeTicketUrl(event.ticket_url);

  // ─── Quality scoring at ingest ───────────────────────────────────
  // Compute against the FINAL resolved values (post-geocoding,
  // post-canonical-category, post-UPSERT-guard) so the score reflects
  // what we'll actually persist, not the raw scraper input. Identical
  // scoring function as backfill-quality.ts — they share
  // src/lib/quality/score-event.ts.
  //
  // publish_status: only overwrite when the existing value is one of
  // the computed statuses (or absent). Preserves dedup's 'duplicate'
  // marking and any future admin overrides.
  const score = scoreAndAdmit(
    {
      title: event.title,
      description: finalDescription,
      start_date: event.start_date,
      end_date: event.end_date ?? null,
      location_name: resolved.locationName,
      address: finalAddress,
      postal_code: resolved.postalCode,
      // Kanonisierte Bundesland-ID, damit die Polygon-Gegenprobe dieselbe
      // Schreibweise vergleicht, die auch in der Zeile landet.
      bundesland: bundeslandToId(event.bundesland) ?? null,
      country: event.country ?? null,
      category: canonical.category,
      latitude: finalLat,
      longitude: finalLng,
      image_url: finalImageUrl,
      source_url: event.source_url,
      ticket_url: finalTicketUrl,
    },
    { regionOf: regionOfCoords, plzRegionOf: getBundeslandFromPLZ },
  );

  // `scoreAndAdmit` hat den Freigabevertrag gegen dieselben FINALEN Werte
  // laufen lassen. Der Score sagt "wie vollständig", der Vertrag sagt "darf
  // das publik werden": ein `quarantine`-Verdikt schreibt die Zeile
  // weiterhin (nichts geht verloren), nimmt ihr aber die Veröffentlichung —
  // egal wie hoch der Score aus Bild/Text/Links wäre.
  const admission = score.admission;

  // Korrekturen des Vertrags gewinnen über die aufgelösten Werte. Wichtig:
  // das überschreibt auch die `shouldOverwriteCoords`-Entscheidung weiter
  // oben — eine widerlegte Koordinate darf nicht deshalb bestehen bleiben,
  // weil sie schon in der Zeile stand.
  finalLat = score.corrected.latitude;
  finalLng = score.corrected.longitude;
  if (finalLat == null || finalLng == null) {
    finalConfidence = null;
    finalSource = null;
  }
  const finalBundesland = score.corrected.bundesland;

  // Ortsstatus nach dem Freigabevertrag: eine verworfene Koordinate oder
  // ein Orts-Widerspruch macht aus der Entscheidung einen Konflikt bzw.
  // einen ungeklärten Ort. Das Protokoll trägt die Gründe des Vertrags mit.
  // Dieselbe Abbildung wie in der erneuten Entscheidung im Bestand
  // (`applyAdmissionToPosition`): ein Konflikt hat keine Position, die
  // verworfene wird protokolliert (DB-Check events_location_conflict_no_position).
  const contracted = applyAdmissionToPosition(
    { status: resolved.status, precision: resolved.precision, latitude: finalLat, longitude: finalLng, geocoding_confidence: finalConfidence, geocoding_source: finalSource },
    admission,
  );
  const finalStatus: LocationStatus = contracted.status;
  const finalPrecision = contracted.precision;
  finalLat = contracted.latitude;
  finalLng = contracted.longitude;
  finalConfidence = contracted.geocoding_confidence as string | null;
  finalSource = contracted.geocoding_source;
  resolved.reasons.push(...contracted.reasons);
  const revoked = contracted.revoked;
  const hasFinalCoords = finalLat != null && finalLng != null;
  const preciseStatus = finalStatus === 'venue_confirmed' || finalStatus === 'address_confirmed';
  const finalAllowed = {
    pin: hasFinalCoords && preciseStatus && decision.allowed.pin,
    route: hasFinalCoords && preciseStatus && decision.allowed.route,
    distance: hasFinalCoords && preciseStatus && decision.allowed.distance,
    municipality_page: decision.allowed.municipality_page && finalStatus !== 'conflict' && finalStatus !== 'unresolved',
  };
  const locationResolution = {
    ...decision,
    status: finalStatus,
    precision: finalPrecision,
    latitude: finalLat,
    longitude: finalLng,
    geocoding_confidence: finalConfidence,
    geocoding_source: finalSource,
    reasons: resolved.reasons,
    allowed: finalAllowed,
    admission: { decision: admission.decision, reasons: admission.reasons, corrections: admission.corrections },
    ...(revoked ? { revoked } : {}),
  };

  // Ohne erhaltenen Quellenstand keine Veröffentlichung (fn-25 B1): die
  // Ortsentscheidung wäre nicht reproduzierbar. Die Zeile wird trotzdem
  // geschrieben, damit nichts verloren geht.
  const rawPersistFailed = rawRefs.failed.has(key);
  if (rawPersistFailed) resolved.reasons.push('raw_persist_failed');
  // Ein belegter Widerspruch (Quellkoordinate, Beleg oder Vertrag gegen die
  // genannte PLZ) wird nicht veröffentlicht, sondern zur Prüfung gegeben
  // (Review §6): der Freigabevertrag sieht nach dem Verwerfen der Koordinate
  // nur noch Ortstext + PLZ und würde die Zeile sonst durchwinken.
  const locationConflict = finalStatus === 'conflict';
  if (locationConflict) resolved.reasons.push('location_conflict_withheld');
  const finalPublishStatus =
    existing?.publish_status && !COMPUTED_PUBLISH_STATUSES.has(existing.publish_status)
      ? existing.publish_status
      : (rawPersistFailed || locationConflict) && score.publish_status === 'published'
        ? 'needs_review'
        : score.publish_status;

  // ─── Bezirk: NUR kanonische Werte ───────────────────────────────
  // `events.district` haengt an einem Fremdschluessel auf
  // `district_canonical(name)`. `normalizeDistrict()` laesst unbekannte
  // Schreibweisen aber unveraendert durch (nur lowercase) — und PostgREST
  // upsertet batchweise, also reisst EIN unbekannter Bezirk die ganzen
  // 100 Zeilen des Batches mit.
  //
  // Gemessen am Lauf 2026-09-07: 4.801 Zeilen gingen so verloren, allein
  // meinbezirk 3.700 von 3.701 — der Adapter schreibt den URL-Slug
  // ("wr-neustadt", "zell-am-see") als Bezirk. Der Fehler stand schon
  // vorher im Log (41 Treffer am 2026-09-06), nur meldete der Lauf
  // trotzdem "success".
  //
  // Deshalb: ein nicht-kanonischer Wert wird verworfen statt geschrieben.
  // Danach greift der PLZ-Fallback (der validiert bereits selbst), sonst
  // bleibt die Spalte NULL. Ein fehlender Bezirk kostet Filter-Treffer,
  // ein ungueltiger kostet 100 Events.
  const normalizedDistrict = normalizeDistrict(
    event.district,
    finalBundesland,
    resolved.postalCode ?? event.postal_code,
  );
  // fn-25 C2: Bezirk zuerst aus der belegten Gemeinde (Registry), dann aus
  // der PLZ — aber nur, wenn die PLZ genau einen Bezirk hat. 438 PLZ decken
  // mehrere Bezirke; dort entschied bisher Häufigkeit oder Alphabet.
  const finalDistrict =
    (normalizedDistrict && isCanonicalDistrict(normalizedDistrict) ? normalizedDistrict : null) ??
    (decision.gemeinde
      ? districtFromGemeinde(decision.gemeinde.bezirk, decision.gemeinde.bundesland, decision.gemeinde.plz)
      : null) ??
    districtFromPlz(resolved.postalCode ?? event.postal_code, finalBundesland);

  const row = {
    source_type: 'scraped' as const,
    source_name: event.source_name,
    source_id: event.source_id,
    source_url: event.source_url,
    title: event.title,
    description: finalDescription,
    start_date: event.start_date,
    end_date: event.end_date ?? null,
    location_name: resolved.locationName,
    address: finalAddress,
    // postal_code is handled below via conditional spread — when
    // resolved.postalCode is null we OMIT the field entirely so the
    // Supabase upsert preserves whatever the existing row has (e.g.
    // a value written earlier by the backfill-plz-from-coords script).
    // Writing `null` explicitly here would clobber that value.
    //
    // Note: this conditional-spread pattern is safe specifically for
    // postal_code because EITHER (a) every row in the batch has
    // resolved.postalCode (uniform shape) OR (b) we accept the
    // existing-clobber risk for the (rare) cross-batch mixed case —
    // an existing migration explicitly relies on "scrape can't
    // overwrite a backfilled PLZ", which the omit semantics covers
    // for the homogeneous-batch case. The guarded fields above
    // (image_url/description/price_text) cannot use the same trick
    // because their cross-batch heterogeneity is the COMMON case.
    ...(resolved.postalCode !== null ? { postal_code: resolved.postalCode } : {}),
    // Canonicalise bundesland to one of the 9 lowercase IDs that
    // bundeslandToId() recognises. The Feratel/TourData scrapers
    // emit "Salzburg" / "Kärnten" / "Tirol" Title-Case; without this
    // 9k+ events end up under a bundesland the client filter doesn't
    // know about, leaving them invisible on the map.
    bundesland: finalBundesland,
    // Normalise district at scrape-time so the FilterDrawer chip can
    // match by exact string. Without this, every new scrape pumps
    // freshly-spelled aliases (e.g. "bruck/leitha", "suedoststeiermark")
    // back into the DB and undoes the canonical-rewrite migration.
    // Note: pass the canonicalised bundesland id so the alias map's
    // bundesland-scoped lookup actually hits.
    // fn-19: Quellen ohne Bezirksfeld (Feratel, Gemeinde-Kalender,
    // Eventim) liefern district=NULL — der Stadt-Filter der Smart-Suche
    // wirft solche Events dann komplett raus (Eisenstadt-Befund
    // 2026-07-31: Hub 59 Events, Suche 0). Fallback: Bezirk aus der PLZ.
    district: finalDistrict,
    latitude: finalLat,
    longitude: finalLng,
    // ISO-Code aus der Entscheidung (Adapter liefern teils Ländernamen; der
    // Länderfilter der API vergleicht exakt mit 'AT').
    country: decision.country,
    // ─── fn-25: Rohwerte der Quelle (unverändert) und Ortsentscheidung ──
    location_name_raw: event.location_name ?? null,
    address_raw: event.address ?? null,
    postal_code_raw: event.postal_code ?? null,
    city_raw: event.city ?? null,
    country_raw: event.country ?? null,
    source_venue_id: event.source_venue_id ?? null,
    latitude_raw: typeof event.latitude === 'number' ? event.latitude : null,
    longitude_raw: typeof event.longitude === 'number' ? event.longitude : null,
    coords_precision_raw: event.coords_precision ?? null,
    location_status: finalStatus,
    // Zeitpunkt des letzten Statuswechsels (Kennzahl „neue Konflikte"):
    // unverändert zurückschreiben, wenn der Status gleich bleibt.
    location_status_changed_at:
      existing && existing.location_status === finalStatus
        ? existing.location_status_changed_at
        : new Date().toISOString(),
    location_precision: finalPrecision,
    location_resolution: locationResolution,
    location_provenance: decision.provenance,
    raw_event_id: rawRefs.ids.get(key) ?? null,
    category: canonical.category,
    tags: canonical.tags && canonical.tags.length > 0 ? canonical.tags : null,
    source_category_raw: event.category ?? null,
    source_tags_raw: event.tags ?? null,
    category_confidence: canonical.category_confidence,
    category_source: canonical.category_source,
    category_version: canonical.category_version,
    category_locked: canonical.category_locked,
    category_needs_review: canonical.category_needs_review,
    category_reason: canonical.category_reason,
    category_candidates: canonical.category_candidates,
    // Guarded fields — always written, value picked above.
    price_text: finalPriceText,
    price_min: event.price_min ?? null,
    price_max: event.price_max ?? null,
    image_url: finalImageUrl,
    image_width: finalImageWidth,
    image_height: finalImageHeight,
    organizer: event.organizer ?? null,
    // Facetten: liefert der Adapter nichts (undefined), bleibt der bestehende
    // Wert; leere Arrays der Quelle gelten als "nichts gesagt".
    audience: event.audience && event.audience.length > 0 ? event.audience : existing?.audience ?? null,
    setting: event.setting && event.setting.length > 0 ? event.setting : existing?.setting ?? null,
    occasion_tags: event.occasion_tags && event.occasion_tags.length > 0 ? event.occasion_tags : existing?.occasion_tags ?? null,
    price_flags: event.price_flags && event.price_flags.length > 0 ? event.price_flags : existing?.price_flags ?? null,
    language: event.language ?? existing?.language ?? null,
    is_family_friendly: event.is_family_friendly ?? existing?.is_family_friendly ?? null,
    image_credit: event.image_credit ?? existing?.image_credit ?? null,
    ticket_url: finalTicketUrl,
    visibility: 'public' as const,
    // Quality score + publish_status set at ingest. Eliminates the
    // "scrape writes qs=NULL → backfill-quality runs later" cycle.
    // Same scoring function as backfill (src/lib/quality/score-event.ts);
    // preserves non-computed publish_status values like 'duplicate'.
    quality_score: score.quality_score,
    publish_status: finalPublishStatus,
    geocoding_confidence: finalConfidence,
    geocoding_source: finalSource,
    content_fingerprint: generateFingerprint(event.title, event.start_date),
    // Slug preservation rule:
    //   - If the row already has a slug in the DB, KEEP IT. The slug is a
    //     path segment in the canonical URL (/events/{plz-ort}/{date}/{slug})
    //     and changing it would silently break every Google-indexed URL
    //     because the catch-all's (slug, date) lookup would miss.
    //   - If the row is new (or legacy without slug), generate one from
    //     title + location_name.
    //
    // We learned this the hard way — pre-phase-1 the slug was regenerated
    // every upsert, which was fine when the URL was {shortId}-{slug} because
    // the shortId anchored the lookup. With the new {plz-ort}/{date}/{slug}
    // shape, slug = primary lookup key, so it MUST be stable.
    slug: existing?.slug ?? generateEventSlug(event.title, resolved.locationName ?? event.location_name),
    // venue_id: vom Registry-Scraper oder von einem belegten Venue-Kandidaten
    // des Resolvers (fn-25 C3).
    ...(event.venue_id || decision.venue_id ? { venue_id: event.venue_id ?? decision.venue_id } : {}),
    // fn-14.5: ALWAYS bump last_seen_at — anchor for the soft-delete
    // job in fn-14.6. INSERT or UPDATE, doesn't matter.
    last_seen_at: new Date().toISOString(),
  };

  return { row, admission, rawPersistFailed, locationConflict };
}

const BATCH_SIZE = 100;

/**
 * Ergebnis eines Sync-Laufs — bewusst nach Ausgang getrennt statt einer
 * einzigen "ok"-Zahl (Audit §2I). `errors` zählt Zeilen, die die Datenbank
 * NICHT geschrieben hat; `quarantined` Zeilen, die geschrieben wurden, aber
 * nicht publik sind. Der Aufrufer entscheidet daraus, ob der Lauf als
 * erfolgreich gilt.
 */
export interface SyncResult {
  upserted: number;
  errors: number;
  /** Vor dem Schreiben hart verworfen (Titel/Datum/Zeitintervall). */
  filtered: number;
  /** Geschrieben, aber auf `needs_review` gesetzt statt veröffentlicht. */
  quarantined: number;
  /** Häufigkeit je Verwerfungs-/Quarantänegrund, für den Lauf-Report. */
  reasons: Record<string, number>;
  /** Neu gesicherte Rohzeilen (`raw_events`); unveränderte Events zählen nicht. */
  rawWritten: number;
  /**
   * Die tatsächlichen Postgres-Meldungen der fehlgeschlagenen Batches,
   * dedupliziert. Ohne sie stand in `source_runs.error_message` nur
   * "N Zeilen nicht geschrieben" — die Ursache (`events_district_fkey`)
   * liess sich erst durch ein Grep über 4 MB GitHub-Actions-Log finden.
   */
  errorMessages: string[];
}

/** `no_location_evidence=3, placeholder_location=1` */
function formatReasons(reasons: Record<string, number>): string {
  const entries = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  return entries.length > 0 ? entries.map(([k, v]) => `${k}=${v}`).join(', ') : '—';
}

/**
 * Eingangsprüfung: die harten Verwerfungen des Freigabevertrags
 * (`decision === 'reject'`) — Titel, Datum, Zeitintervall.
 *
 * Ersetzt die frühere String-Prefix-Prüfung. Die verglich Beginn und Ende
 * über `slice(0, 10)`, wodurch ein Event von 18:00 bis 17:00 desselben
 * Tages den Filter passierte (Audit §2F). `evaluateAdmission` vergleicht
 * vollständige Zeitpunkte, wenn beide eine echte Uhrzeit tragen, und sonst
 * Kalendertage in Wien-Ortszeit.
 *
 * Ortsprüfungen laufen hier NICHT — der Ort steht erst nach
 * `resolveCoordinates()` fest und wird deshalb in `toSupabaseRow()`
 * bewertet.
 */
export function filterValidEvents(events: ScrapedEvent[]): {
  valid: ScrapedEvent[];
  rejected: number;
  rejectionReasons: Record<string, number>;
} {
  let rejected = 0;
  const rejectionReasons: Record<string, number> = {};

  const valid = events.filter(e => {
    // Listing-Parser greifen bei Kontaktbloecken den mailto:/tel:-Anchor
    // statt der Ueberschrift ab — solche "Titel" duerfen gar nicht erst
    // in die DB (Prod-Befund 2026-09-04: 613 Events mit E-Mail als Titel).
    if (e.title && isContactHandleTitle(e.title)) {
      rejected++;
      rejectionReasons.contact_handle_title = (rejectionReasons.contact_handle_title ?? 0) + 1;
      return false;
    }

    const verdict = evaluateAdmission({
      title: e.title,
      start_date: e.start_date,
      end_date: e.end_date ?? null,
      // Ortsfelder bewusst weggelassen — der Ort steht erst nach
      // `resolveCoordinates()` fest. Etwaige Orts-Befunde kämen hier als
      // `quarantine` zurück und werden hier ignoriert; entschieden wird
      // darüber in `toSupabaseRow()` gegen die aufgelösten Werte.
    });
    if (verdict.decision !== 'reject') return true;
    rejected++;
    for (const r of verdict.reasons) rejectionReasons[r] = (rejectionReasons[r] ?? 0) + 1;
    return false;
  });

  return { valid, rejected, rejectionReasons };
}

/**
 * Zeitzonen-Normalisierung fuer den gesamten Schreibpfad.
 *
 * Die ~64 Scraper bauen ihre Datums-Strings jeder fuer sich; die meisten
 * geben Wiener Wandzeit ohne Zone aus ("2026-10-04T11:00:00"). Ohne Zone
 * liest Postgres den Wert in der Session-Zeitzone - die steht auf UTC -,
 * und die Seite rendert ihn wieder in Europe/Vienna. Ergebnis: die Uhrzeit
 * springt um den Wiener Offset nach vorn (Sommer 2 h, Winter 1 h).
 *
 * Hier ist die einzige Stelle, durch die alle Scraper-Schreibvorgaenge
 * laufen, also wird hier umgerechnet - vor `filterValidEvents`, damit
 * Zulassung, Scoring, Fingerprint und Zeile denselben Instant sehen.
 * Werte mit Zone und reine Datums-Werte bleiben unangetastet
 * (siehe `toUtcInstant`).
 */
export function normalizeEventTimestamps(events: ScrapedEvent[]): ScrapedEvent[] {
  return events.map(e => {
    const start = toUtcInstant(e.start_date) as string;
    const end = toUtcInstant(e.end_date) as string | undefined;
    if (start === e.start_date && end === e.end_date) return e;
    return { ...e, start_date: start, end_date: end };
  });
}

/**
 * Upserts a list of scraped events into Supabase in batches.
 * Returns counts of inserted/updated rows.
 */
export interface SyncOptions {
  /**
   * Lauf-ID aus `scrape_runs`, wenn der Aufrufer mehrere Batches zu EINEM
   * Lauf bündelt (Eventim-Import). Fehlt sie, öffnet und schließt der Sync
   * einen eigenen Lauf für diesen Aufruf.
   */
  scrapeRunId?: string | null;
}

export async function syncEventsToSupabase(
  rawEvents: ScrapedEvent[],
  options: SyncOptions = {},
): Promise<SyncResult> {
  const empty = (): SyncResult => ({
    upserted: 0,
    errors: 0,
    filtered: 0,
    quarantined: 0,
    reasons: {},
    rawWritten: 0,
    errorMessages: [],
  });
  if (rawEvents.length === 0) return empty();
  const startedMs = Date.now();

  // Nackte Wandzeiten der Scraper in echte Instants drehen, bevor
  // irgendjemand sie liest.
  const events = normalizeEventTimestamps(rawEvents);

  // Harte Verwerfungen (Titel/Datum/Zeitintervall) vor dem Schreiben.
  const { valid: validEvents, rejected: filtered, rejectionReasons } = filterValidEvents(events);
  const reasons: Record<string, number> = { ...rejectionReasons };
  if (filtered > 0) {
    console.log(
      `[supabase-sync] ${filtered} Kandidaten verworfen (${validEvents.length} verbleiben): ` +
        formatReasons(rejectionReasons),
    );
  }
  if (validEvents.length === 0) return { ...empty(), filtered, reasons };

  const supabase = getSupabaseAdminClient();
  let upserted = 0;
  let errors = 0;
  let quarantined = 0;
  let rawWritten = 0;
  const errorMessages = new Set<string>();

  // Deduplicate events by source_name+source_id before syncing
  // (ON CONFLICT DO UPDATE fails if same key appears twice in one batch)
  const seen = new Set<string>();
  const dedupedEvents = validEvents.filter(e => {
    const key = `${e.source_name}::${e.source_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Rohschicht (fn-25 B1): ein Lauf je Aufruf, sofern der Aufrufer keinen
  // übergibt. Ohne Lauf-ID kann keine Rohzeile geschrieben werden — dann
  // gelten alle Kandidaten als „Quellenstand nicht gesichert".
  const sourceNames = [...new Set(dedupedEvents.map(e => e.source_name))];
  const ownsRun = !options.scrapeRunId;
  const runId = options.scrapeRunId ?? (await openScrapeRun(supabase, sourceNames.length === 1 ? sourceNames[0] : 'mixed'));

  for (let i = 0; i < dedupedEvents.length; i += BATCH_SIZE) {
    const batchEvents = dedupedEvents.slice(i, i + BATCH_SIZE);

    // Batch-prefetch existing rows for confidence comparison + UPSERT-Guards
    const keys = batchEvents.map(e => ({
      source_name: e.source_name,
      source_id: e.source_id,
    }));
    const existingMap = await prefetchExistingRows(supabase, keys);

    // Quellenstand VOR der Normalisierung sichern.
    let rawRefs: RawRefs = { ids: new Map(), failed: new Set(keys.map(k => `${k.source_name}::${k.source_id}`)) };
    if (runId) {
      const raw = await persistRawEvents(supabase, runId, batchEvents);
      rawRefs = { ids: raw.ids, failed: raw.failed };
      rawWritten += raw.written;
    }

    // fn-14.5: validate + (when applicable) upgrade image URLs in
    // parallel with bounded concurrency. Pure no-op for events without
    // image_url. The map is keyed by `source_name::source_id` so
    // toSupabaseRow can look up the validated URL + extracted dims.
    const imageMap = await validateImagesForBatch(batchEvents);

    // Belege für die Ortsentscheidung (Venue-Kandidaten, Adress-Geocodes,
    // Quellen-Venue-Zuordnungen) batchweise laden — nie live geocodieren.
    let evidence: LocationEvidence[] = batchEvents.map(() => ({}));
    try {
      evidence = await loadLocationEvidence(
        supabase,
        batchEvents.map(e => locationInputOf(e, existingMap.get(`${e.source_name}::${e.source_id}`)?.id)),
      );
    } catch (e) {
      console.warn('[supabase-sync] Belege nicht ladbar, Entscheidung ohne Belege:', e instanceof Error ? e.message : e);
    }
    const mapped = batchEvents.map((e, idx) => toSupabaseRow(e, existingMap, imageMap, rawRefs, evidence[idx]));
    for (const { admission, rawPersistFailed, locationConflict } of mapped) {
      if (admission.decision === 'quarantine') {
        quarantined++;
        for (const r of admission.reasons) reasons[r] = (reasons[r] ?? 0) + 1;
      } else if (locationConflict) {
        quarantined++;
        reasons.location_conflict = (reasons.location_conflict ?? 0) + 1;
      } else if (rawPersistFailed) {
        quarantined++;
        reasons.raw_persist_failed = (reasons.raw_persist_failed ?? 0) + 1;
      }
    }

    const batch = mapped.map(m => m.row);
    const { error, count } = await supabase
      .from('events')
      .upsert(batch, {
        onConflict: 'source_name,source_id',
        count: 'exact',
      });

    if (error) {
      console.error(`[supabase-sync] Batch ${i}-${i + batch.length} error:`, error.message);
      errorMessages.add(error.message);
      errors += batch.length;
    } else {
      upserted += count ?? batch.length;
    }
  }

  if (quarantined > 0) {
    console.log(
      `[supabase-sync] ${quarantined} Events quarantänisiert (needs_review statt published): ` +
        formatReasons(reasons),
    );
  }

  if (runId && ownsRun) {
    await closeScrapeRun(supabase, runId, startedMs, {
      items_found: rawEvents.length,
      raw_written: rawWritten,
      items_updated: upserted,
      needs_review_count: quarantined,
      batch_errors: errorMessages.size,
      status: errors === 0 ? 'success' : upserted > 0 ? 'partial' : 'error',
      error_message: errorMessages.size > 0 ? [...errorMessages].join(' | ').slice(0, 1000) : null,
    });
  }

  return { upserted, errors, filtered, quarantined, reasons, rawWritten, errorMessages: [...errorMessages] };
}

// ─── fn-14.5 image validate-and-upgrade pool ─────────────────────────
// Runs `validateAndUpgradeImageUrl()` per event with bounded
// concurrency (default 5). Events without an image_url short-circuit
// and never enter the pool. The result map is keyed by
// `source_name::source_id` to match toSupabaseRow's lookup.

const IMAGE_VALIDATE_CONCURRENCY = 5;

async function validateImagesForBatch(
  events: ScrapedEvent[],
): Promise<Map<string, ValidatedImage>> {
  const result = new Map<string, ValidatedImage>();

  const tasks: Array<{ key: string; event: ScrapedEvent }> = events
    .filter(e => !!e.image_url)
    .map(e => ({ key: `${e.source_name}::${e.source_id}`, event: e }));

  if (tasks.length === 0) return result;

  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const idx = cursor++;
      const { key, event } = tasks[idx];
      try {
        const validated = await validateAndUpgradeImageUrl(
          event.image_url!,
          event.image_width ?? null,
          event.image_height ?? null,
        );
        result.set(key, validated);
      } catch {
        // Never let a single bad URL halt the batch — fall back to
        // pattern-extracted dims off the original URL.
        const dims = extractDimsFromUrl(event.image_url || null);
        result.set(key, {
          url: event.image_url || '',
          width: dims.width ?? event.image_width ?? undefined,
          height: dims.height ?? event.image_height ?? undefined,
        });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(IMAGE_VALIDATE_CONCURRENCY, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return result;
}

// ─── fn-25 B1: Lauf-Klammer für Aufrufer mit mehreren Batches ────────
// Der Eventim-Import ruft `syncEventsToSupabase` ~50× je Import auf; ein
// Lauf je Aufruf würde die Rohschicht zerstückeln. Diese Wrapper öffnen
// und schließen EINEN `scrape_runs`-Eintrag um alle Batches herum.

export async function beginScrapeRun(sourceName: string): Promise<string | null> {
  return openScrapeRun(getSupabaseAdminClient(), sourceName);
}

export async function finishScrapeRun(
  runId: string,
  startedMs: number,
  stats: Parameters<typeof closeScrapeRun>[3],
): Promise<void> {
  return closeScrapeRun(getSupabaseAdminClient(), runId, startedMs, stats);
}
