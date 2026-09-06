/**
 * Quality scoring — deterministic event score 0-100 + publish_status
 * derivation. Pure functions, no I/O.
 *
 * Used at two layers:
 *   1. INGEST  — `supabase-sync.ts` calls this in `toSupabaseRow()` so every
 *      scraped event gets `quality_score` + `publish_status` written on the
 *      first upsert. No more "qs=NULL backfill cycle".
 *   2. BACKFILL — `scripts/backfill-quality.ts` uses the same helper to
 *      score legacy rows that pre-date the at-ingest scoring.
 *
 * 7 dimensions, max 100 points (Phase 1 spec):
 *
 *     completeness  25   title/date/location/category/description-length
 *     date          15   exact-time bonus, future-window, end_date
 *     location      25   coords, address, name, in-AT bonus, plz+bundesland
 *     image         10   has image_url
 *     link          10   source_url + ticket_url combos
 *     dedup         10   caller-supplied; defaults to 10 (= treat as unique)
 *     source_trust   5   caller-supplied; defaults to 2 (= neutral)
 *
 * Outside-Austria coordinates short-circuit to score=0, status=suppressed.
 *
 * Status thresholds:
 *     >= 60   published
 *     >= 40   published_low_confidence
 *     >= 20   needs_review
 *      < 20   suppressed
 */

import { isContactHandleTitle } from '@/lib/scrapers/detail-extract/validate';
import {
  evaluateAdmission,
  hasTimeOfDay,
  type AdmissionOptions,
  type AdmissionVerdict,
} from './admission';

export interface ScoreableEvent {
  title?: string | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location_name?: string | null;
  address?: string | null;
  postal_code?: string | null;
  bundesland?: string | null;
  /** ISO country (AT/DE/CH). DE/CH events are deliberately imported (country
   *  toggle) and legitimately lie outside Austria — they must not be suppressed
   *  by the outside-Austria guard. */
  country?: string | null;
  category?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  image_url?: string | null;
  source_url?: string | null;
  ticket_url?: string | null;
}

export type PublishStatus =
  | 'published'
  | 'published_low_confidence'
  | 'needs_review'
  | 'suppressed';

export type FlagType =
  | 'outside_austria'
  | 'contact_handle_title'
  | 'missing_location'
  | 'missing_description'
  | 'missing_image';

export type FlagSeverity = 'low' | 'high' | 'critical';

export interface QualityFlag {
  flag_type: FlagType;
  severity: FlagSeverity;
  /** Free-form structured payload — written to quality_flags.details_json. */
  details?: unknown;
}

export interface ScoreResult {
  quality_score: number;
  publish_status: PublishStatus;
  outside_austria: boolean;
  flags: QualityFlag[];
  /** Per-dimension breakdown — backfill persists this to event_quality_scores. */
  breakdown: {
    completeness: number;
    date: number;
    location: number;
    image: number;
    link: number;
    dedup: number;
    source_trust: number;
  };
}

export interface ScoreOptions {
  /** Caller-supplied dedup confidence score (0-10). Default 10. */
  dedupScore?: number;
  /** Caller-supplied source trust score (0-5). Default 2. */
  sourceTrust?: number;
}

// Austria bounding box (rough — covers all 9 Bundesländer)
const AT_LAT_MIN = 46.3;
const AT_LAT_MAX = 49.1;
const AT_LNG_MIN = 9.5;
const AT_LNG_MAX = 17.2;

/**
 * Trusted Austrian ticketing hosts. ticket_url whose hostname matches one
 * of these gets the full bonus; an unknown host still gets a small bonus
 * (better than nothing — it's at least a structured purchase link), and
 * a missing ticket_url gets nothing.
 *
 * Identical copy lives in `src/lib/utils/scoring.ts` (backfill scorer) — keep
 * both lists in sync.
 */
export const TRUSTED_TICKET_HOSTS = new Set<string>([
  'oeticket.com', 'oeticket.at',
  'eventim.de', 'eventim.at',
  'ticketmaster.at', 'ticketmaster.com',
  'wien-ticket.at',
  'ntry.at',
  'feverup.com',
]);

/**
 * Host-based ticket bonus. Returns:
 *   0 — no ticket_url
 *   1 — ticket_url present but host not in TRUSTED_TICKET_HOSTS
 *   5 — ticket_url host is in TRUSTED_TICKET_HOSTS
 *
 * Defensive: returns 0 if `new URL(...)` throws on a malformed value.
 */
export function getTrustedTicketBonus(ticketUrl: string | null | undefined): number {
  if (!ticketUrl) return 0;
  try {
    const host = new URL(ticketUrl).hostname.toLowerCase().replace(/^www\./, '');
    return TRUSTED_TICKET_HOSTS.has(host) ? 5 : 1;
  } catch {
    return 0;
  }
}

export function isOutsideAustria(
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  if (lat == null || lng == null) return false;
  return lat < AT_LAT_MIN || lat > AT_LAT_MAX || lng < AT_LNG_MIN || lng > AT_LNG_MAX;
}

export function scoreToPublishStatus(score: number): PublishStatus {
  if (score >= 60) return 'published';
  if (score >= 40) return 'published_low_confidence';
  if (score >= 20) return 'needs_review';
  return 'suppressed';
}

export function computeCompletenessScore(e: ScoreableEvent): number {
  let s = 0;
  if (e.title && e.title.length > 5) s += 5;
  if (e.start_date) s += 5;
  if (e.location_name) s += 5;
  if (e.category) s += 3;
  if (e.description && e.description.length > 50) s += 4;
  if (e.description && e.description.length > 200) s += 3;
  return s;
}

export function computeDateScore(e: ScoreableEvent): number {
  let s = 0;
  if (e.start_date) s += 5;
  const sd = e.start_date;
  // Bonus when the scraper captured an ACTUAL start time rather than a
  // midnight placeholder.
  //
  // Vorher: `sd.includes('T') && !sd.endsWith('T00:00:00')`. Das war ein
  // String-Vergleich und damit von der Schreibweise abhängig, nicht von
  // der Information: derselbe künftige Kalendertag bekam 8 Punkte als
  // `…T00:00:00` und 13 Punkte als `…T00:00:00Z`, weil die Z-Form nicht
  // auf `T00:00:00` endet. `hasTimeOfDay()` prüft den geparsten Instant
  // und kennt beide Platzhalter-Formen (naive UTC-Mitternacht und
  // Wien-Mitternacht) — siehe src/lib/quality/admission.ts.
  if (hasTimeOfDay(sd)) s += 5;
  if (sd) {
    const d = new Date(sd);
    if (!isNaN(d.getTime())) {
      const now = new Date();
      const twoYears = new Date();
      twoYears.setFullYear(twoYears.getFullYear() + 2);
      if (d >= now && d <= twoYears) s += 3;
    }
  }
  if (e.end_date) s += 2;
  return s;
}

export function computeLocationScore(e: ScoreableEvent): number {
  let s = 0;
  if (e.latitude && e.longitude) s += 7;
  if (e.address) s += 5;
  if (e.location_name) s += 3;
  if (e.latitude && e.longitude && !isOutsideAustria(e.latitude, e.longitude)) s += 5;
  if (e.bundesland && e.postal_code) s += 5;
  return Math.min(25, s);
}

export function computeImageScore(e: ScoreableEvent): number {
  return e.image_url ? 10 : 0;
}

export function computeLinkScore(e: ScoreableEvent): number {
  let s = 0;
  if (e.source_url) s += 3;
  // Host-based bonus on ticket_url (fn-14.1): 0 / 1 / 5 depending on whether
  // the host is in TRUSTED_TICKET_HOSTS. Replaces the previous unconditional
  // +3 — that was rewarding any random ticket-shaped URL, including spam.
  s += getTrustedTicketBonus(e.ticket_url);
  if (e.source_url || e.ticket_url) s += 4;
  return Math.min(10, s);
}

/**
 * Score an event end-to-end. Pure — no I/O, deterministic.
 *
 * Caller chooses what to do with the result:
 *   - At ingest:    write `quality_score` + `publish_status` on the events row.
 *   - In backfill:  same, plus persist breakdown to event_quality_scores and
 *                   flags to quality_flags.
 */
export function scoreEvent(
  event: ScoreableEvent,
  options: ScoreOptions = {},
): ScoreResult {
  // Titel, der in Wahrheit ein abgegriffenes Kontaktfeld ist (reine
  // Mailadresse/Telefonnummer aus einem mailto:/tel:-Anchor). Harte
  // Suppression VOR der Punktrechnung: solche Rows wuerden sonst ueber
  // Datum/Ort/Bild genug Punkte sammeln, um wieder 'published' zu werden —
  // genau so standen 605 von 613 Mail-Titeln 2026-09-04 auf published.
  if (isContactHandleTitle(event.title)) {
    return {
      quality_score: 0,
      publish_status: 'suppressed',
      outside_austria: false,
      flags: [
        {
          flag_type: 'contact_handle_title',
          severity: 'critical',
          details: { title: event.title },
        },
      ],
      breakdown: {
        completeness: 0,
        date: 0,
        location: 0,
        image: 0,
        link: 0,
        dedup: 0,
        source_trust: 0,
      },
    };
  }

  const outside = isOutsideAustria(event.latitude, event.longitude);
  // DE/CH events are deliberately imported (country toggle) and legitimately lie
  // outside Austria — only suppress events that are meant to be in Austria
  // (country AT or unset = mis-geocoded).
  const isForeign = event.country === 'DE' || event.country === 'CH';

  if (outside && !isForeign) {
    return {
      quality_score: 0,
      publish_status: 'suppressed',
      outside_austria: true,
      flags: [
        {
          flag_type: 'outside_austria',
          severity: 'critical',
          details: { latitude: event.latitude, longitude: event.longitude },
        },
      ],
      breakdown: {
        completeness: 0,
        date: 0,
        location: 0,
        image: 0,
        link: 0,
        dedup: 0,
        source_trust: 0,
      },
    };
  }

  const completeness = computeCompletenessScore(event);
  const date = computeDateScore(event);
  const location = computeLocationScore(event);
  const image = computeImageScore(event);
  const link = computeLinkScore(event);
  const dedup = options.dedupScore ?? 10;
  const sourceTrust = options.sourceTrust ?? 2;

  const quality_score = completeness + date + location + image + link + dedup + sourceTrust;
  const publish_status = scoreToPublishStatus(quality_score);

  const flags: QualityFlag[] = [];
  if (!event.location_name && !event.latitude) {
    flags.push({ flag_type: 'missing_location', severity: 'high' });
  }
  if (!event.description || event.description.length < 20) {
    flags.push({ flag_type: 'missing_description', severity: 'low' });
  }
  if (!event.image_url) {
    flags.push({ flag_type: 'missing_image', severity: 'low' });
  }

  return {
    quality_score,
    publish_status,
    outside_austria: false,
    flags,
    breakdown: {
      completeness,
      date,
      location,
      image,
      link,
      dedup,
      source_trust: sourceTrust,
    },
  };
}

/**
 * Score UND Freigabevertrag in einem Aufruf — die Form, die jeder
 * Schreibpfad benutzen soll.
 *
 * WARUM: `scoreEvent()` allein leitet `publish_status` rein additiv aus
 * dem Score ab. Ein Event ohne belastbaren Ort erreichte so über Bild,
 * Beschreibung und Links Score 65 und damit `published` (Audit §2A).
 * Wer nur `scoreEvent()` aufruft und dessen `publish_status` schreibt,
 * hebt jede Quarantäne wieder auf — genau so hat `backfill-quality.ts`
 * früher Zeilen zurück auf `published` gesetzt, die der Sync bewusst
 * zurückgehalten hatte.
 *
 * Der zurückgegebene `publish_status` ist bereits gefiltert:
 * `quarantine` → `needs_review`, unabhängig vom Score.
 */
export function scoreAndAdmit(
  event: ScoreableEvent,
  options: ScoreOptions & AdmissionOptions = {},
): ScoreResult & {
  admission: AdmissionVerdict;
  /**
   * Die Orts-Werte, die geschrieben werden SOLLEN — nach Anwendung der
   * Korrekturen aus dem Vertrag. Der Aufrufer muss diese persistieren,
   * nicht seine Eingabewerte, sonst schreibt er die widerlegte Angabe.
   */
  corrected: {
    latitude: number | null;
    longitude: number | null;
    bundesland: string | null;
  };
} {
  // Reihenfolge ist wichtig: erst prüfen, dann korrigieren, dann scoren.
  // Würde gegen die UNkorrigierten Werte gescort, bekäme ein Event Punkte
  // für eine Koordinate, die gleich darauf verworfen wird.
  const admission = evaluateAdmission(
    {
      title: event.title,
      start_date: event.start_date,
      end_date: event.end_date,
      location_name: event.location_name,
      address: event.address,
      postal_code: event.postal_code,
      bundesland: event.bundesland,
      country: event.country,
      latitude: event.latitude,
      longitude: event.longitude,
    },
    { regionOf: options.regionOf, plzRegionOf: options.plzRegionOf, now: options.now },
  );

  const dropCoords = admission.corrections.includes('drop_coordinates');
  const useCoordRegion = admission.corrections.includes('use_coordinate_region');

  const corrected = {
    latitude: dropCoords ? null : (event.latitude ?? null),
    longitude: dropCoords ? null : (event.longitude ?? null),
    bundesland: useCoordRegion
      ? (admission.correctedBundesland ?? event.bundesland ?? null)
      : (event.bundesland ?? null),
  };

  const score = scoreEvent({ ...event, ...corrected }, options);

  return {
    ...score,
    publish_status: admission.decision === 'admit' ? score.publish_status : 'needs_review',
    admission,
    corrected,
  };
}
