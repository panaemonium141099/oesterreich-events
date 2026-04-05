/**
 * Content fingerprint generation for event deduplication.
 *
 * Creates a sha256 hash from normalizeTitle(title) + startDate (date part only).
 * Two events with the same normalized title on the same date are considered
 * exact duplicates regardless of source.
 */
import { createHash } from 'crypto';

/**
 * Normalize an event title for deduplication comparison.
 *
 * Transforms:
 * - lowercase
 * - collapse whitespace
 * - strip punctuation (keep alphanumeric + spaces)
 * - trim
 * - normalize unicode (NFC)
 */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // replace punctuation with space, keep letters/digits/spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract the date portion (YYYY-MM-DD) from a start_date string.
 * Handles ISO 8601 strings with or without time components.
 */
export function extractDatePart(startDate: string): string {
  return startDate.slice(0, 10);
}

/**
 * Generate a content fingerprint for an event.
 *
 * Returns a hex-encoded sha256 hash of normalizeTitle(title) + '|' + datePart.
 * Returns null if title or startDate are missing/empty.
 */
export function generateFingerprint(title: string, startDate: string): string | null {
  if (!title || !title.trim() || !startDate) return null;

  const normalized = normalizeTitle(title);
  const datePart = extractDatePart(startDate);

  if (!normalized || !datePart || datePart.length < 10) return null;

  const input = `${normalized}|${datePart}`;
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
