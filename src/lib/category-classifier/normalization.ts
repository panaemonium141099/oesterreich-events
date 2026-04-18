/**
 * Input normalization + content hashing for the category classifier (cat-v2).
 *
 * Two responsibilities:
 *   1. Deterministically normalize title/description/tags/source fields so
 *      the matcher can compare them case- and diacritics-insensitively.
 *   2. Produce a stable content hash (cache key) that is resistant to trivial
 *      SEO edits in the description — but sensitive to semantically relevant
 *      changes (title, raw tags, source, organizer, cleaned description).
 */

import { createHash } from 'crypto';
import { CLASSIFIER_VERSION } from './taxonomy';

/**
 * Lowercase + NFD + strip combining marks + collapse whitespace. Matches
 * the dedup/fingerprint normalization style and the location-normalizer's
 * `normalizeString`. Keeps letters, digits, spaces, and dashes.
 */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^\p{L}\p{N}\s\-&]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokenise normalised text into word tokens. */
export function tokenize(input: string | null | undefined): string[] {
  const t = normalizeText(input);
  if (!t) return [];
  return t.split(/[\s-]+/).filter(Boolean);
}

/** Normalise a tag list: trim, drop empties, dedupe case-insensitively. */
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

/**
 * Description pre-processor for signal extraction and cache keying.
 *
 * Removes boilerplate that dominates event-detail text and adds no category
 * value: ticket vendor snippets, "weitere Infos", copyright lines, phone
 * numbers, email addresses, URLs. Collapses whitespace. Truncates to 500
 * chars (classifier uses up to 500, cache key uses first 200 slice).
 *
 * The original untouched description stays in the DB — this is purely a
 * signal-extraction pre-processor.
 */
export function cleanDescriptionForSignals(input: string | null | undefined): string {
  if (!input) return '';
  let text = String(input);

  // URLs
  text = text.replace(/https?:\/\/\S+/gi, ' ');
  // Emails
  text = text.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, ' ');
  // Phone numbers (Austrian formats)
  text = text.replace(/(?:\+43|0)[\s./-]?\d{1,4}[\s./-]?\d{3,}[\s./-]?\d{0,}/g, ' ');
  // Ticket/SEO boilerplate (common German phrasings, case-insensitive).
  const BOILERPLATE_PATTERNS: RegExp[] = [
    /\bweitere infos?\b.*?(?=[.!?\n]|$)/gi,
    /\btickets?\s+(?:ab|kostenlos|buchen|erhaltlich|online|verfugbar)\b.*?(?=[.!?\n]|$)/gi,
    /\bmehr erfahren\b.*?(?=[.!?\n]|$)/gi,
    /\bals download\b.*?(?=[.!?\n]|$)/gi,
    /\bimpressum\b.*?(?=[.!?\n]|$)/gi,
    /\bdatenschutz\b.*?(?=[.!?\n]|$)/gi,
    /\bagb\b.*?(?=[.!?\n]|$)/gi,
    /©\s*[\d\w\s]*(?:all rights reserved|alle rechte vorbehalten)?/gi,
    /\ball rights reserved\b/gi,
    /\balle rechte vorbehalten\b/gi,
  ];
  for (const re of BOILERPLATE_PATTERNS) text = text.replace(re, ' ');

  // Collapse whitespace + truncate.
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > 500) text = text.slice(0, 500);
  return text;
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
  /** Cleaned description ready for signal extraction. */
  description: string;
  tags: string[];
  sourceCategory: string;
  sourceName: string;
  organizer: string;
  locationName: string;
  hashTags: string[];
  inputHash: string;
}

/**
 * Deterministic content hash over the fields the classifier actually
 * consumes, namespaced by `CLASSIFIER_VERSION` so a version bump invalidates
 * all existing cache rows. NOT tied to the raw description — uses the
 * cleaned + first-200-char slice so SEO edits don't churn the cache.
 */
export function hashClassifierInput(norm: Omit<NormalizedInput, 'inputHash'>): string {
  const descKey = norm.description.slice(0, 200);
  const payload = [
    CLASSIFIER_VERSION,
    norm.title,
    norm.hashTags.join('|'),
    norm.sourceCategory,
    norm.sourceName,
    norm.organizer,
    descKey,
    // locationName deliberately NOT in the hash — location changes don't
    // change semantic category and would needlessly churn the cache when a
    // venue resolver fills missing coordinates.
  ].join('\u0001');
  return createHash('sha1').update(payload).digest('hex');
}

/**
 * Full normalisation: returns normalized variants of every input field plus
 * a stable content hash.
 */
export function normalizeInput(input: ClassifierInputShape): NormalizedInput {
  const title = normalizeText(input.title);
  const description = normalizeText(cleanDescriptionForSignals(input.description));
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
