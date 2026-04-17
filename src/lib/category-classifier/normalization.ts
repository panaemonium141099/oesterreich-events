/**
 * Input normalization + content hashing for the category classifier.
 *
 * The hash is the cache key for the AI fallback — two events with the same
 * normalized inputs must produce the same result, so the hash must be stable
 * under cosmetic differences (case, whitespace, diacritics, trailing punctuation)
 * but sensitive to anything the classifier actually considers as evidence.
 */

import { createHash } from 'crypto';
import { CLASSIFIER_VERSION } from './taxonomy';

/**
 * Lowercase, strip diacritics (NFD + combining marks), collapse whitespace.
 * This matches the matching style used elsewhere in the app (see dedup/fingerprint).
 */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-') // unify dashes
    .replace(/[^\p{L}\p{N}\s\-&]/gu, ' ') // keep letters, digits, dash, ampersand
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokenise normalised text into word tokens. Empty tokens removed. */
export function tokenize(input: string | null | undefined): string[] {
  const t = normalizeText(input);
  if (!t) return [];
  return t.split(/[\s-]+/).filter(Boolean);
}

/** Normalise a tag list: trim, drop empties, dedupe (case-insensitive). */
export function normalizeTags(tags: readonly string[] | null | undefined): string[] {
  if (!tags || tags.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export interface ClassifierInputShape {
  title: string;
  description?: string | null;
  source_tags_raw?: readonly string[] | null;
  source_category_raw?: string | null;
  source_name?: string | null;
  organizer?: string | null;
  location_name?: string | null;
}

export interface NormalizedInput {
  title: string;
  description: string;
  tags: string[];
  sourceCategory: string;
  sourceName: string;
  organizer: string;
  locationName: string;
  /** Sorted, lowercased tags for hash stability. */
  hashTags: string[];
  inputHash: string;
}

/**
 * Deterministic content hash over the fields the classifier actually consumes,
 * namespaced by classifier version so a version bump invalidates old cache rows
 * without us having to delete them.
 */
export function hashClassifierInput(norm: Omit<NormalizedInput, 'inputHash'>): string {
  const payload = [
    CLASSIFIER_VERSION,
    norm.title,
    norm.description,
    norm.hashTags.join('|'),
    norm.sourceCategory,
    norm.sourceName,
    norm.organizer,
    norm.locationName,
  ].join('\u0001');
  return createHash('sha1').update(payload).digest('hex');
}

/**
 * Full normalisation: lowercased, diacritic-stripped strings plus a stable
 * input hash for the AI cache. This is what `decide()`, `runAiClassifier()`
 * and `categoryCache` all agree on.
 */
export function normalizeInput(input: ClassifierInputShape): NormalizedInput {
  const title = normalizeText(input.title);
  const description = normalizeText(input.description);
  const tags = normalizeTags(input.source_tags_raw);
  const sourceCategory = normalizeText(input.source_category_raw);
  const sourceName = normalizeText(input.source_name);
  const organizer = normalizeText(input.organizer);
  const locationName = normalizeText(input.location_name);
  const hashTags = tags
    .map(t => normalizeText(t))
    .filter(Boolean)
    .slice()
    .sort();

  const base: Omit<NormalizedInput, 'inputHash'> = {
    title,
    description,
    tags,
    sourceCategory,
    sourceName,
    organizer,
    locationName,
    hashTags,
  };

  return { ...base, inputHash: hashClassifierInput(base) };
}
