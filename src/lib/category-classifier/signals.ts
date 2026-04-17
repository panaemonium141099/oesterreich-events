/**
 * Signal extraction: turn a normalised classifier input into an array of
 * scored evidence rows. Each row records (category, score, evidence) so the
 * audit log can later explain exactly why a category won.
 */

import type { Category } from '@/types/events';
import type { NormalizedInput } from './normalization';
import { normalizeText } from './normalization';
import {
  SCORE,
  TRUSTED_RAW_TAG_MAP,
  STRONG_TITLE_PHRASES,
  CATEGORY_TOKENS,
  BLOCKERS,
  SOURCE_PRIORS,
} from './rules';
import { CATEGORIES } from './taxonomy';

export interface Evidence {
  category: Category;
  score: number;
  /** Short description of what matched, e.g. 'title_token:konzert' */
  kind: string;
  source: string;
}

/**
 * Check if any of the needles appears as a substring inside haystack. Substring
 * match (not whole-word) because normalised text already folds dashes/spaces.
 */
function anyIn(haystack: string, needles: readonly string[]): string | null {
  if (!haystack) return null;
  for (const needle of needles) {
    if (!needle) continue;
    if (haystack.includes(needle)) return needle;
  }
  return null;
}

/**
 * Match a needle inside haystack with a soft word-boundary guard for short
 * tokens: needles of length < 5 must be surrounded by non-letter characters to
 * avoid false positives like "rad" matching inside "paradeiser". Longer tokens
 * are allowed to substring-match (so German compounds like "kindertheater"
 * trigger the "kinder" keyword naturally).
 */
function matchKeyword(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  if (needle.length >= 5) return haystack.includes(needle);
  // Short token: require boundary (start/end of string or non-letter adjacent)
  const idx = haystack.indexOf(needle);
  if (idx === -1) return false;
  const before = idx === 0 ? ' ' : haystack[idx - 1];
  const afterIdx = idx + needle.length;
  const after = afterIdx >= haystack.length ? ' ' : haystack[afterIdx];
  const isLetter = (c: string) => /[a-z0-9]/i.test(c);
  if (isLetter(before) || isLetter(after)) {
    // Try next occurrence
    const rest = haystack.slice(idx + 1);
    return matchKeyword(rest, needle);
  }
  return true;
}

function firstKeywordHit(haystack: string, keywords: readonly string[]): string | null {
  for (const kw of keywords) {
    if (matchKeyword(haystack, kw)) return kw;
  }
  return null;
}

export interface ExtractedSignals {
  evidence: Evidence[];
  /** Whether any title or exact-raw-tag evidence existed for the *eventual*
   *  winning category. Needed for the deterministic accept gate. */
  hasTitleEvidenceFor: Map<Category, boolean>;
  hasRawTagEvidenceFor: Map<Category, boolean>;
  /** Set of categories blocked by some rule. */
  blocked: Map<Category, string[]>;
}

export function extractSignals(norm: NormalizedInput): ExtractedSignals {
  const evidence: Evidence[] = [];
  const hasTitleEvidenceFor = new Map<Category, boolean>();
  const hasRawTagEvidenceFor = new Map<Category, boolean>();
  const blocked = new Map<Category, string[]>();

  const titleText = norm.title;
  const descriptionText = norm.description;
  const sourceContext = [norm.sourceName, norm.organizer, norm.locationName]
    .filter(Boolean)
    .join(' ');

  // --- 1. Trusted raw-tag map (highest priority) ------------------------
  for (const rawTag of norm.tags) {
    const direct = TRUSTED_RAW_TAG_MAP[rawTag];
    if (direct) {
      evidence.push({
        category: direct,
        score: SCORE.TRUSTED_EXACT,
        kind: 'trusted_raw_tag',
        source: rawTag,
      });
      hasRawTagEvidenceFor.set(direct, true);
      continue;
    }
    // Lowercased fallback — Feratel tags we keep in canonical casing; anything
    // else we compare case-insensitively.
    const lower = rawTag.toLowerCase();
    for (const [key, cat] of Object.entries(TRUSTED_RAW_TAG_MAP)) {
      if (key.toLowerCase() === lower) {
        evidence.push({
          category: cat,
          score: SCORE.TRUSTED_EXACT,
          kind: 'trusted_raw_tag',
          source: rawTag,
        });
        hasRawTagEvidenceFor.set(cat, true);
        break;
      }
    }
  }

  // --- 2. Strong title phrases (+20) ------------------------------------
  for (const category of CATEGORIES) {
    const phrases = STRONG_TITLE_PHRASES[category];
    if (!phrases || phrases.length === 0) continue;
    const normalizedPhrases = phrases.map(p => normalizeText(p));
    const hit = anyIn(titleText, normalizedPhrases);
    if (hit) {
      evidence.push({
        category,
        score: SCORE.STRONG_TITLE_PHRASE,
        kind: 'strong_title_phrase',
        source: hit,
      });
      hasTitleEvidenceFor.set(category, true);
    }
  }

  // --- 3. Title / tag / description token matches -----------------------
  for (const category of CATEGORIES) {
    const tokens = CATEGORY_TOKENS[category];
    if (!tokens || tokens.length === 0) continue;
    const normalizedTokens = tokens.map(t => normalizeText(t)).filter(Boolean);

    const titleHit = firstKeywordHit(titleText, normalizedTokens);
    if (titleHit) {
      evidence.push({
        category,
        score: SCORE.TITLE_TOKEN,
        kind: 'title_token',
        source: titleHit,
      });
      hasTitleEvidenceFor.set(category, true);
    }

    // Token appearing inside a raw tag (not the trusted exact map) — treat as
    // exact-raw-tag mapping signal because the scraper saw it as a category
    // label in the source feed.
    for (const rawTag of norm.tags) {
      const normalizedRawTag = normalizeText(rawTag);
      if (!normalizedRawTag) continue;
      const rawHit = firstKeywordHit(normalizedRawTag, normalizedTokens);
      if (rawHit) {
        evidence.push({
          category,
          score: SCORE.EXACT_RAW_TAG_MAP,
          kind: 'raw_tag_token',
          source: `${rawTag}->${rawHit}`,
        });
        hasRawTagEvidenceFor.set(category, true);
        break;
      }
    }

    const descHit = firstKeywordHit(descriptionText, normalizedTokens);
    if (descHit) {
      evidence.push({
        category,
        score: SCORE.DESCRIPTION_SIGNAL,
        kind: 'description_signal',
        source: descHit,
      });
    }
  }

  // --- 4. Source / venue / organizer priors -----------------------------
  if (sourceContext) {
    const normalizedContext = normalizeText(sourceContext);
    for (const prior of SOURCE_PRIORS) {
      const hit = anyIn(normalizedContext, prior.whenAnyToken.map(normalizeText));
      if (hit) {
        evidence.push({
          category: prior.target,
          score: prior.trustedExact ? SCORE.TRUSTED_EXACT : SCORE.SOURCE_PRIOR,
          kind: prior.trustedExact ? 'trusted_source' : 'source_prior',
          source: `${hit} (${prior.reason})`,
        });
      }
    }
  }

  // Source-provided category is a (weak) source prior when it normalises to a
  // known category name — treat it like a +8 nudge, not a decision.
  if (norm.sourceCategory) {
    for (const category of CATEGORIES) {
      if (normalizeText(category).includes(norm.sourceCategory) ||
          norm.sourceCategory.includes(normalizeText(category))) {
        evidence.push({
          category,
          score: SCORE.SOURCE_PRIOR,
          kind: 'source_category_prior',
          source: norm.sourceCategory,
        });
        break;
      }
    }
  }

  // --- 5. Blockers (-18) ------------------------------------------------
  const blockerContext = [titleText, descriptionText, sourceContext]
    .filter(Boolean)
    .join(' ');
  const normalizedBlockerContext = normalizeText(blockerContext);
  for (const blocker of BLOCKERS) {
    const hit = anyIn(normalizedBlockerContext, blocker.whenAnyToken.map(normalizeText));
    if (hit) {
      evidence.push({
        category: blocker.target,
        score: SCORE.BLOCKER,
        kind: 'blocker',
        source: `${hit} (${blocker.reason})`,
      });
      const existing = blocked.get(blocker.target) ?? [];
      existing.push(blocker.reason);
      blocked.set(blocker.target, existing);
    }
  }

  return { evidence, hasTitleEvidenceFor, hasRawTagEvidenceFor, blocked };
}

/** Aggregate evidence into per-category totals, preserving evidence breakdown. */
export interface AggregatedScore {
  category: Category;
  score: number;
  evidence: Evidence[];
  hasTitleEvidence: boolean;
  hasRawTagEvidence: boolean;
  hasBlocker: boolean;
  blockerReasons: string[];
}

export function aggregate(signals: ExtractedSignals): AggregatedScore[] {
  const byCategory = new Map<Category, AggregatedScore>();
  for (const cat of CATEGORIES) {
    byCategory.set(cat, {
      category: cat,
      score: 0,
      evidence: [],
      hasTitleEvidence: signals.hasTitleEvidenceFor.get(cat) ?? false,
      hasRawTagEvidence: signals.hasRawTagEvidenceFor.get(cat) ?? false,
      hasBlocker: signals.blocked.has(cat),
      blockerReasons: signals.blocked.get(cat) ?? [],
    });
  }

  for (const ev of signals.evidence) {
    const slot = byCategory.get(ev.category);
    if (!slot) continue;
    slot.score += ev.score;
    slot.evidence.push(ev);
  }

  // Sonstiges never scores above zero via evidence — it is only a fallback.
  const sonstiges = byCategory.get('Sonstiges');
  if (sonstiges) sonstiges.score = 0;

  return Array.from(byCategory.values())
    .filter(s => s.category !== 'Sonstiges')
    .sort((a, b) => b.score - a.score || 0);
}
