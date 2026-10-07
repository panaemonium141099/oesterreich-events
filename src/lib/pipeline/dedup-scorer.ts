// src/lib/pipeline/dedup-scorer.ts

/**
 * Paar-Entscheidung des Event-Dedups: merge / uncertain / distinct mit
 * Begründung. Die Belege liefert dedup-evidence.ts; Cluster, Mehrdeutigkeit
 * und Primary-Wahl macht dedup-engine.ts.
 */

import { jaroWinkler } from '@/lib/dedup/jaro-winkler';
import { normalizeTitle, generateFingerprint } from '@/lib/dedup/fingerprint';
import { normalizeUrl } from '@/lib/pipeline/normalize-url';
import { haversineDistance } from '@/lib/pipeline/normalize-venue';
import {
  isPlaceless,
  isSpecificTitle,
  placeEvidence,
  sameViennaDay,
  timeRelation,
  titleRelation,
  titleTokensOf,
} from './dedup-evidence';
import type { EventRow, DedupScoreBreakdown } from './types';

// ---------------------------------------------------------------------------
// Teilwerte — nur Auskunft für Log und Admin-Prüfansicht
// ---------------------------------------------------------------------------

const W_TITLE = 0.30;
const W_DATETIME = 0.20;
const W_VENUE = 0.25;
const W_GEO = 0.15;
const W_URL = 0.10;

function tokenize(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/\s+/).filter(t => t.length > 1));
}

function tokenOverlap(a: string, b: string): number {
  const tokA = tokenize(a);
  const tokB = tokenize(b);
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let overlap = 0;
  for (const t of Array.from(tokA)) {
    if (tokB.has(t)) overlap++;
  }
  return overlap / Math.max(tokA.size, tokB.size);
}

function computeTitleScore(a: EventRow, b: EventRow): number {
  const titleA = normalizeTitle(a.title);
  const titleB = normalizeTitle(b.title);

  if (!titleA || !titleB) return 0;

  // Fingerprint match (same normalized title + same day)
  const dayA = a.start_date?.slice(0, 10);
  const dayB = b.start_date?.slice(0, 10);
  let fpMatch = 0;
  if (dayA && dayB && dayA === dayB) {
    const fpA = generateFingerprint(a.title, a.start_date);
    const fpB = generateFingerprint(b.title, b.start_date);
    if (fpA && fpB && fpA === fpB) fpMatch = 1.0;
  }

  const jw = jaroWinkler(titleA, titleB);
  const to = tokenOverlap(titleA, titleB);
  return Math.max(fpMatch, 0.7 * jw + 0.3 * to);
}

function computeDatetimeScore(a: EventRow, b: EventRow): number {
  if (!a.start_date || !b.start_date) return 0;

  const dayA = a.start_date.slice(0, 10);
  const dayB = b.start_date.slice(0, 10);

  if (dayA !== dayB) {
    const dA = new Date(dayA);
    const dB = new Date(dayB);
    const diffDays = Math.abs(dA.getTime() - dB.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) return 0.2;
    return 0;
  }

  const timeA = a.start_date.includes('T') ? a.start_date : null;
  const timeB = b.start_date.includes('T') ? b.start_date : null;

  if (!timeA || !timeB) {
    const hasTimeA = timeA && !timeA.endsWith('T00:00:00');
    const hasTimeB = timeB && !timeB.endsWith('T00:00:00');
    if (!hasTimeA && !hasTimeB) return 0.7;
    if (!hasTimeA || !hasTimeB) return 0.7;
  }

  const dateA = new Date(a.start_date);
  const dateB = new Date(b.start_date);
  const diffMinutes = Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60);

  if (diffMinutes <= 15) return 1.0;
  if (diffMinutes <= 120) return 0.8;
  return 0.3;
}

function computeVenueScore(a: EventRow, b: EventRow): number {
  if (a.venue_id && b.venue_id) {
    return a.venue_id === b.venue_id ? 1.0 : 0.0;
  }

  const locA = (a.location_name ?? '').toLowerCase().trim();
  const locB = (b.location_name ?? '').toLowerCase().trim();

  if (!locA || !locB) return 0;
  if (locA === locB) return 0.8;

  const jw = jaroWinkler(locA, locB);
  if (jw > 0.85) return 0.6;

  const distA = (a.district ?? a.bundesland ?? '').toLowerCase();
  const distB = (b.district ?? b.bundesland ?? '').toLowerCase();
  if (distA && distB && distA === distB && jw > 0.7) return 0.5;

  return 0;
}

function computeGeoScore(a: EventRow, b: EventRow, venueScore: number): number {
  if (!a.latitude || !a.longitude || !b.latitude || !b.longitude) {
    if (venueScore >= 1.0) return 0.8;
    return 0;
  }

  const dist = haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);

  if (dist < 100) return 1.0;
  if (dist < 500) return 0.8;
  if (dist < 2000) return 0.5;
  if (dist < 10000) return 0.2;
  return 0;
}

export function normalizeUrlForDedup(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const normalized = normalizeUrl(url);
    return normalized ? normalized.toLowerCase() : url.toLowerCase().trim();
  } catch {
    return (url ?? '').toLowerCase().trim();
  }
}

function computeUrlScore(a: EventRow, b: EventRow): number {
  const ticketA = normalizeUrlForDedup(a.ticket_url);
  const ticketB = normalizeUrlForDedup(b.ticket_url);
  if (ticketA && ticketB && ticketA === ticketB) return 0.9;

  const srcA = normalizeUrlForDedup(a.source_url);
  const srcB = normalizeUrlForDedup(b.source_url);
  if (srcA && srcB && srcA === srcB) return 1.0;

  try {
    if (srcA && srcB) {
      const hostA = new URL(srcA).hostname;
      const hostB = new URL(srcB).hostname;
      if (hostA === hostB) {
        const pathSim = jaroWinkler(new URL(srcA).pathname, new URL(srcB).pathname);
        if (pathSim > 0.8) return 0.4;
      }
    }
  } catch { /* ignore URL parse errors */ }

  return 0;
}

// ---------------------------------------------------------------------------
// Entscheidung aus Belegen (dedup-evidence.ts)
// ---------------------------------------------------------------------------

/**
 * Gründe, aus denen zwei Events nie in einen Cluster dürfen — auch nicht
 * über einen dritten Eintrag (dedup-engine prüft das beim Zusammenlegen).
 */
export const HARD_DISTINCT_REASONS = new Set([
  'different_day',
  'different_venue_id',
  'different_place',
  'different_venue',
  'different_district',
  'different_plz_region',
  'different_gemeinde',
  'different_showtime',
  'same_source_other_time',
  'same_source_other_title',
  'manual_split',
]);

/** Etiketten-Widersprüche (Bezirk/PLZ), die ein gemeinsamer Ticket-Link aufhebt. */
const LABEL_CONFLICTS = new Set(['different_district', 'different_plz_region', 'different_gemeinde']);

interface Verdict {
  decision: 'merge' | 'uncertain' | 'distinct';
  reason: string;
  strength?: 'strong' | 'weak';
}

const merge = (reason: string, strength: 'strong' | 'weak'): Verdict => ({ decision: 'merge', reason, strength });
const uncertain = (reason: string): Verdict => ({ decision: 'uncertain', reason });
const distinct = (reason: string): Verdict => ({ decision: 'distinct', reason });

export function isHardDistinct(b: Pick<DedupScoreBreakdown, 'decision' | 'reason'>): boolean {
  return b.decision === 'distinct' && !!b.reason && HARD_DISTINCT_REASONS.has(b.reason);
}

/**
 * Zusammenführen nur mit Beleg für Titel UND Ort UND Zeit; fehlende Angaben
 * sind kein Gegenbeweis, widersprechende schon.
 *
 * | Titel           | Ort gleich               | gleiche Gemeinde            | Ort unbekannt          |
 * |-----------------|--------------------------|-----------------------------|------------------------|
 * | gleich/Tippfehl.| merge (Zeit ≤ 60 min     | merge (Zeit gleich oder     | merge nur bei gleicher |
 * |                 |  oder unbekannt)         |  unbekannt)                 |  Uhrzeit               |
 * | enthalten       | merge (Zeit gleich oder  | merge, wenn der kürzere     | getrennt               |
 * |                 |  unbekannt), „weak"      |  Titel konkret ist, „weak"  |                        |
 * | Hauptteil gleich| prüfen bei gleicher Zeit | getrennt                    | getrennt               |
 */
function decide(a: EventRow, b: EventRow): Verdict {
  // Dieselbe Zeile der Quelle (z. B. nach Datumskorrektur doppelt angelegt).
  if (a.source_id && b.source_id && a.source_name && b.source_name &&
      a.source_id === b.source_id && a.source_name === b.source_name) {
    return merge('same_source_id', 'strong');
  }
  if (!sameViennaDay(a, b)) return distinct('different_day');

  const place = placeEvidence(a, b);
  if (place.relation === 'conflict' && !LABEL_CONFLICTS.has(place.reason)) return distinct(place.reason);

  // Zwei echte Uhrzeiten mehr als 2 h auseinander sind zwei Vorstellungen
  // (Circus Roncalli 13:00 und 17:30). Steht vor der Ticket-Regel: Quellen
  // wie Linz Termine verlinken alle Vorstellungen eines Tages auf eine Seite.
  const time = timeRelation(a, b);
  if (time === 'conflict') return distinct('different_showtime');

  // Dieselbe Quelle listet zwei Einträge: verschiedene echte Uhrzeiten
  // (Messen 08:00 und 09:15) oder verschiedene Titel (Acts eines Festivals)
  // sind verschiedene Programmpunkte (Probelauf 2026-09-24).
  const sameSourceOtherId = !!a.source_name && a.source_name === b.source_name && a.source_id !== b.source_id;
  if (sameSourceOtherId && time !== 'exact' && time !== 'unknown') return distinct('same_source_other_time');

  const ticketA = normalizeUrlForDedup(a.ticket_url);
  const ticketB = normalizeUrlForDedup(b.ticket_url);
  if (ticketA && ticketB && ticketA === ticketB) return merge('same_ticket_url', 'strong');

  // Verschiedene Titel derselben Quelle sind verschiedene Programmpunkte
  // („Kaiser Wiesn – Dirndl Rocker" / „– Die Lauser"). Verschachtelte Titel
  // („Bob Dylan" / „Bob Dylan - VIP Packages") sind dieselbe Show, mehrfach
  // gelistet; die prüft die normale Tabelle samt Mehrdeutigkeitsschutz.
  const title = titleRelation(a, b);
  if (sameSourceOtherId && (title === 'different' || title === 'related')) return distinct('same_source_other_title');
  if (place.relation === 'conflict') return distinct(place.reason);

  switch (title) {
    case 'equal':
    case 'near': {
      const t = `${title}_title`;
      if (place.relation === 'same') {
        return time === 'far' ? uncertain(`${t}_same_place_far_time`) : merge(`${t}_same_place`, 'strong');
      }
      if (place.relation === 'town') {
        return time === 'exact' || time === 'unknown'
          ? merge(`${t}_same_town`, 'strong')
          : uncertain(`${t}_same_town_other_time`);
      }
      if (time === 'exact') return merge(`${t}_same_time`, 'strong');
      if (time === 'unknown' && isPlaceless(a) && isPlaceless(b)) return merge(`${t}_no_place_data`, 'strong');
      return uncertain(`${t}_place_unknown`);
    }
    case 'contains': {
      const timeOk = time === 'exact' || time === 'unknown';
      if (place.relation === 'same') {
        return timeOk ? merge('contained_title_same_place', 'weak') : uncertain('contained_title_other_time');
      }
      if (place.relation === 'town') {
        const shorter = titleTokensOf(a).length <= titleTokensOf(b).length ? a : b;
        return timeOk && isSpecificTitle(shorter)
          ? merge('contained_title_same_town', 'weak')
          : uncertain('contained_title_same_town');
      }
      return distinct('contained_title_place_unknown');
    }
    case 'related':
      return place.relation === 'same' && time === 'exact'
        ? uncertain('related_title_same_place')
        : distinct('different_title');
    default:
      return distinct('different_title');
  }
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Bewertet ein Paar. Die Teilwerte (title/datetime/venue/geo/url) sind nur
 * Auskunft für Log und Admin-Prüfansicht — die Entscheidung kommt aus den
 * Belegen (decide), nicht aus der gewichteten Summe. Die Summe ließ gleiche
 * Titel zur gleichen Zeit am gleichen Pin bei 0,775 „uncertain" liegen,
 * weil quellenübergreifend URL und Venue-Id fast nie übereinstimmen.
 */
export function scorePair(a: EventRow, b: EventRow): DedupScoreBreakdown {
  const titleScore = computeTitleScore(a, b);
  const datetimeScore = computeDatetimeScore(a, b);
  const venueScore = computeVenueScore(a, b);
  const geoScore = computeGeoScore(a, b, venueScore);
  const urlScore = computeUrlScore(a, b);
  const overallScore =
    titleScore * W_TITLE +
    datetimeScore * W_DATETIME +
    venueScore * W_VENUE +
    geoScore * W_GEO +
    urlScore * W_URL;

  const verdict = decide(a, b);
  return {
    titleScore,
    datetimeScore,
    venueScore,
    geoScore,
    urlScore,
    overallScore,
    decision: verdict.decision,
    reason: verdict.reason,
    ...(verdict.strength ? { strength: verdict.strength } : {}),
  };
}

/**
 * Canonicalize a pair of event IDs for dedup log storage.
 * Always returns [smaller, larger] UUID to prevent duplicate entries.
 */
export function canonicalizeIds(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}
