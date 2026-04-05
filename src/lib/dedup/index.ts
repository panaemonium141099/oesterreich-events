/**
 * Content deduplication pipeline for events.
 *
 * Two-stage approach:
 * 1. **Fingerprint** (exact): sha256(normalizeTitle + date) catches identical events
 *    across different sources.
 * 2. **Fuzzy** (Jaro-Winkler): Within (date, city) blocks, detects near-duplicates
 *    where titles differ slightly (e.g., "Pub Quiz Flex" vs "PubQuiz @ Flex").
 *
 * Designed for use in:
 * - Scraper sync pipeline (inline dedup before Supabase upsert)
 * - Batch dedup script (post-hoc cleanup of existing events)
 */

export { normalizeTitle, extractDatePart, generateFingerprint } from './fingerprint';
export { jaroWinkler } from './jaro-winkler';

import { normalizeTitle, generateFingerprint } from './fingerprint';
import { jaroWinkler } from './jaro-winkler';

/** Minimum Jaro-Winkler similarity to consider events as fuzzy duplicates. */
export const FUZZY_THRESHOLD = 0.85;

/**
 * Minimal event shape required by the dedup pipeline.
 */
export interface DedupEvent {
  id?: string;
  title: string;
  start_date: string;
  location_name?: string | null;
  city?: string | null;
  source_name?: string | null;
  content_fingerprint?: string | null;
}

/**
 * A pair of events flagged as fuzzy duplicates.
 */
export interface DedupMatch {
  /** The event to keep (typically the one with more data or from a preferred source). */
  keep: DedupEvent;
  /** The event flagged as a duplicate. */
  duplicate: DedupEvent;
  /** Jaro-Winkler similarity score (0-1). */
  similarity: number;
  /** How the match was found. */
  method: 'fingerprint' | 'fuzzy';
}

/**
 * Extract city from location_name or city field.
 * Falls back to 'unknown' for grouping purposes.
 */
function extractCity(event: DedupEvent): string {
  if (event.city) return event.city.toLowerCase().trim();
  if (event.location_name) {
    // Try extracting city from location_name (often "Venue, City" format)
    const parts = event.location_name.split(',');
    if (parts.length >= 2) {
      return parts[parts.length - 1].trim().toLowerCase();
    }
  }
  return 'unknown';
}

/**
 * Build (date, city) block key for grouping events before fuzzy comparison.
 * Only events in the same block are compared, keeping complexity manageable.
 */
function blockKey(event: DedupEvent): string {
  const date = event.start_date.slice(0, 10);
  const city = extractCity(event);
  return `${date}|${city}`;
}

/**
 * Run the full dedup pipeline on a list of events.
 *
 * Returns:
 * - events with content_fingerprint populated
 * - list of duplicate matches found
 *
 * Does NOT modify or remove events from the input array.
 * Callers decide what to do with detected duplicates.
 */
export function findDuplicates(events: DedupEvent[]): {
  fingerprinted: Array<DedupEvent & { content_fingerprint: string }>;
  matches: DedupMatch[];
} {
  const fingerprinted: Array<DedupEvent & { content_fingerprint: string }> = [];
  const matches: DedupMatch[] = [];

  // Stage 1: Generate fingerprints and detect exact duplicates
  const fingerprintMap = new Map<string, DedupEvent & { content_fingerprint: string }>();

  for (const event of events) {
    const fp = generateFingerprint(event.title, event.start_date);
    if (!fp) continue;

    const withFp = { ...event, content_fingerprint: fp };
    fingerprinted.push(withFp);

    const existing = fingerprintMap.get(fp);
    if (existing) {
      // Exact fingerprint match — keep the one with more data
      const keepExisting = pickPreferred(existing, withFp);
      const duplicate = keepExisting === existing ? withFp : existing;
      matches.push({
        keep: keepExisting,
        duplicate,
        similarity: 1.0,
        method: 'fingerprint',
      });
    } else {
      fingerprintMap.set(fp, withFp);
    }
  }

  // Stage 2: Fuzzy matching within (date, city) blocks
  // Group unique (non-fingerprint-duplicate) events by block
  const blocks = new Map<string, Array<DedupEvent & { content_fingerprint: string }>>();
  const uniqueFingerprints = new Set<string>();
  const duplicateFingerprints = new Set<string>(
    matches
      .filter(m => m.method === 'fingerprint')
      .map(m => (m.duplicate as DedupEvent & { content_fingerprint: string }).content_fingerprint)
  );

  for (const event of fingerprinted) {
    // Skip events already flagged as exact duplicates
    if (duplicateFingerprints.has(event.content_fingerprint) && event !== fingerprintMap.get(event.content_fingerprint)) {
      continue;
    }
    if (uniqueFingerprints.has(event.content_fingerprint)) continue;
    uniqueFingerprints.add(event.content_fingerprint);

    const key = blockKey(event);
    const block = blocks.get(key) ?? [];
    block.push(event);
    blocks.set(key, block);
  }

  // Compare events within each block
  for (const [, block] of blocks) {
    if (block.length < 2) continue;

    for (let i = 0; i < block.length; i++) {
      const normA = normalizeTitle(block[i].title);
      for (let j = i + 1; j < block.length; j++) {
        const normB = normalizeTitle(block[j].title);

        // Skip if fingerprints match (already caught in stage 1)
        if (block[i].content_fingerprint === block[j].content_fingerprint) continue;

        const similarity = jaroWinkler(normA, normB);
        if (similarity >= FUZZY_THRESHOLD) {
          const preferred = pickPreferred(block[i], block[j]);
          const duplicate = preferred === block[i] ? block[j] : block[i];
          matches.push({
            keep: preferred,
            duplicate,
            similarity,
            method: 'fuzzy',
          });
        }
      }
    }
  }

  return { fingerprinted, matches };
}

/**
 * Pick the preferred event to keep from a duplicate pair.
 *
 * Heuristic priority:
 * 1. Event with an ID (already in DB) over one without
 * 2. Event with more non-null fields (richer data)
 */
function pickPreferred(a: DedupEvent, b: DedupEvent): DedupEvent {
  // Prefer events already in DB
  if (a.id && !b.id) return a;
  if (b.id && !a.id) return b;

  // Prefer event with more data
  const scoreA = dataRichness(a);
  const scoreB = dataRichness(b);
  return scoreA >= scoreB ? a : b;
}

/** Simple richness score: count non-null/non-undefined fields. */
function dataRichness(event: DedupEvent): number {
  let score = 0;
  if (event.title) score++;
  if (event.start_date) score++;
  if (event.location_name) score++;
  if (event.city) score++;
  if (event.source_name) score++;
  return score;
}

/**
 * Deduplicate an array of events, returning only unique events.
 *
 * Convenience wrapper around findDuplicates that filters out the duplicates
 * and returns a clean array. Each event gets its content_fingerprint set.
 */
export function deduplicateEvents<T extends DedupEvent>(events: T[]): {
  unique: Array<T & { content_fingerprint: string }>;
  removed: DedupMatch[];
} {
  const { fingerprinted, matches } = findDuplicates(events);

  // Collect all duplicate fingerprints/titles to filter out
  const duplicateIds = new Set<DedupEvent>();
  for (const match of matches) {
    duplicateIds.add(match.duplicate);
  }

  // Map fingerprinted events back to original type T
  const fpMap = new Map<DedupEvent, string>();
  for (const fp of fingerprinted) {
    // Find the original event by reference
    const original = events.find(
      e => e.title === fp.title && e.start_date === fp.start_date && e.source_name === fp.source_name
    );
    if (original) {
      fpMap.set(original, fp.content_fingerprint);
    }
  }

  const unique: Array<T & { content_fingerprint: string }> = [];
  const seen = new Set<string>();

  for (const event of events) {
    const fp = fpMap.get(event);
    if (!fp) continue; // skip events that couldn't be fingerprinted

    // Skip if this event was flagged as a duplicate
    if (duplicateIds.has(event)) continue;

    // Skip if we already emitted an event with this fingerprint
    if (seen.has(fp)) continue;
    seen.add(fp);

    unique.push({ ...event, content_fingerprint: fp });
  }

  return { unique, removed: matches };
}
