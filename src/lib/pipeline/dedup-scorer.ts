// src/lib/pipeline/dedup-scorer.ts

/**
 * Multi-dimensional dedup scoring engine.
 *
 * Compares two events and produces a score breakdown with a merge/uncertain/distinct decision.
 * Used by both batch dedup and live dedup flows.
 */

import { jaroWinkler } from '@/lib/dedup/jaro-winkler';
import { normalizeTitle, generateFingerprint } from '@/lib/dedup/fingerprint';
import { normalizeUrl, hashUrl } from '@/lib/pipeline/normalize-url';
import { haversineDistance } from '@/lib/pipeline/normalize-venue';
import type { EventRow, DedupScoreBreakdown } from './types';

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

const W_TITLE = 0.30;
const W_DATETIME = 0.20;
const W_VENUE = 0.25;
const W_GEO = 0.15;
const W_URL = 0.10;

// Thresholds
const MERGE_THRESHOLD = 0.85;
const UNCERTAIN_THRESHOLD = 0.65;

// ---------------------------------------------------------------------------
// Title Score
// ---------------------------------------------------------------------------

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

  // Jaro-Winkler on normalized titles
  const jw = jaroWinkler(titleA, titleB);

  // Token overlap
  const to = tokenOverlap(titleA, titleB);

  // Combined: max of fingerprint or weighted JW+token
  return Math.max(fpMatch, 0.7 * jw + 0.3 * to);
}

// ---------------------------------------------------------------------------
// DateTime Score
// ---------------------------------------------------------------------------

function computeDatetimeScore(a: EventRow, b: EventRow): number {
  if (!a.start_date || !b.start_date) return 0;

  const dayA = a.start_date.slice(0, 10);
  const dayB = b.start_date.slice(0, 10);

  if (dayA !== dayB) {
    // Check adjacent days
    const dA = new Date(dayA);
    const dB = new Date(dayB);
    const diffDays = Math.abs(dA.getTime() - dB.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) return 0.2;
    return 0;
  }

  // Same day — check time
  const timeA = a.start_date.includes('T') ? a.start_date : null;
  const timeB = b.start_date.includes('T') ? b.start_date : null;

  if (!timeA || !timeB) {
    // One or both have no time component
    const hasTimeA = timeA && !timeA.endsWith('T00:00:00');
    const hasTimeB = timeB && !timeB.endsWith('T00:00:00');
    if (!hasTimeA && !hasTimeB) return 0.7; // Both day-only
    if (!hasTimeA || !hasTimeB) return 0.7; // One day-only
  }

  // Both have time — compare
  const dateA = new Date(a.start_date);
  const dateB = new Date(b.start_date);
  const diffMinutes = Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60);

  if (diffMinutes <= 15) return 1.0;
  if (diffMinutes <= 120) return 0.8;
  return 0.3; // Same day but different time
}

// ---------------------------------------------------------------------------
// Venue Score
// ---------------------------------------------------------------------------

function computeVenueScore(a: EventRow, b: EventRow): number {
  // Both have venue_id
  if (a.venue_id && b.venue_id) {
    if (a.venue_id === b.venue_id) return 1.0;
    // Different venue_id — hard distinct signal
    return 0.0;
  }

  // Compare location names
  const locA = (a.location_name ?? '').toLowerCase().trim();
  const locB = (b.location_name ?? '').toLowerCase().trim();

  if (!locA || !locB) return 0;

  if (locA === locB) return 0.8;

  const jw = jaroWinkler(locA, locB);
  if (jw > 0.85) return 0.6;

  // Same city + similar name
  const cityA = (a.city ?? a.bundesland ?? '').toLowerCase();
  const cityB = (b.city ?? b.bundesland ?? '').toLowerCase();
  if (cityA && cityB && cityA === cityB && jw > 0.7) return 0.5;

  return 0;
}

// ---------------------------------------------------------------------------
// Geo Score
// ---------------------------------------------------------------------------

function computeGeoScore(a: EventRow, b: EventRow, venueScore: number): number {
  if (!a.latitude || !a.longitude || !b.latitude || !b.longitude) {
    // No coords on one/both — use venue as proxy
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

// ---------------------------------------------------------------------------
// URL Score
// ---------------------------------------------------------------------------

function normalizeUrlForDedup(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const normalized = normalizeUrl(url);
    return normalized ? normalized.toLowerCase() : url.toLowerCase().trim();
  } catch {
    return (url ?? '').toLowerCase().trim();
  }
}

function computeUrlScore(a: EventRow, b: EventRow): number {
  // Ticket URL match — strongest URL signal
  const ticketA = normalizeUrlForDedup(a.ticket_url);
  const ticketB = normalizeUrlForDedup(b.ticket_url);
  if (ticketA && ticketB && ticketA === ticketB) return 0.9;

  // Source URL match
  const srcA = normalizeUrlForDedup(a.source_url);
  const srcB = normalizeUrlForDedup(b.source_url);
  if (srcA && srcB && srcA === srcB) return 1.0;

  // Same host + similar path
  try {
    if (srcA && srcB) {
      const hostA = new URL(srcA).hostname;
      const hostB = new URL(srcB).hostname;
      if (hostA === hostB) {
        const pathA = new URL(srcA).pathname;
        const pathB = new URL(srcB).pathname;
        const pathSim = jaroWinkler(pathA, pathB);
        if (pathSim > 0.8) return 0.4;
      }
    }
  } catch { /* ignore URL parse errors */ }

  return 0;
}

// ---------------------------------------------------------------------------
// Hard Rules
// ---------------------------------------------------------------------------

interface HardRuleResult {
  forced: boolean;
  decision?: 'merge' | 'distinct';
  reason?: string;
}

function checkHardRules(a: EventRow, b: EventRow): HardRuleResult {
  // Rule 1: Different venue_id (both non-null) → always distinct
  if (a.venue_id && b.venue_id && a.venue_id !== b.venue_id) {
    return { forced: true, decision: 'distinct', reason: 'different_venue_id' };
  }

  // Rule 3: Same source_id + same source_name → always merge
  if (a.source_id && b.source_id && a.source_name && b.source_name &&
      a.source_id === b.source_id && a.source_name === b.source_name) {
    return { forced: true, decision: 'merge', reason: 'same_source_id' };
  }

  // Rule 4: Same ticket_url (normalized, non-empty) → always merge
  const ticketA = normalizeUrlForDedup(a.ticket_url);
  const ticketB = normalizeUrlForDedup(b.ticket_url);
  if (ticketA && ticketB && ticketA === ticketB) {
    return { forced: true, decision: 'merge', reason: 'same_ticket_url' };
  }

  // Rule 2: Different city (both non-null/non-empty) → distinct unless hard proof
  const cityA = (a.city ?? '').toLowerCase().trim();
  const cityB = (b.city ?? '').toLowerCase().trim();
  if (cityA && cityB && cityA !== cityB) {
    // Check exceptions: same venue_id already handled above (would be merge if same)
    // Check: same ticket_url already handled above
    // Check: same source_id + source_name already handled above
    // No exception found → distinct
    return { forced: true, decision: 'distinct', reason: 'different_city' };
  }

  return { forced: false };
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Compute the full dedup score breakdown for a pair of events.
 */
export function scorePair(a: EventRow, b: EventRow): DedupScoreBreakdown {
  // Check hard rules first
  const hardRule = checkHardRules(a, b);
  if (hardRule.forced) {
    // Compute scores anyway for the log, but override decision
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

    return {
      titleScore,
      datetimeScore,
      venueScore,
      geoScore,
      urlScore,
      overallScore,
      decision: hardRule.decision!,
    };
  }

  // Normal scoring
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

  let decision: 'merge' | 'uncertain' | 'distinct';
  if (overallScore >= MERGE_THRESHOLD) {
    decision = 'merge';
  } else if (overallScore >= UNCERTAIN_THRESHOLD) {
    decision = 'uncertain';
  } else {
    decision = 'distinct';
  }

  return {
    titleScore,
    datetimeScore,
    venueScore,
    geoScore,
    urlScore,
    overallScore,
    decision,
  };
}

/**
 * Canonicalize a pair of event IDs for dedup log storage.
 * Always returns [smaller, larger] UUID to prevent duplicate entries.
 */
export function canonicalizeIds(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}
