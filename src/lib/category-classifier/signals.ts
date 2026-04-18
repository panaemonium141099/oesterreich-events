/**
 * Signal extraction — cat-v2.
 *
 * Turns a normalised classifier input into evidence rows per category. The
 * matcher uses four distinct strategies in priority order:
 *
 *   1. Trusted raw-tag exact match               → +100  (trusted_raw_tag)
 *   2. Trusted source_name exact match            → +100 (trusted_source)
 *   3. High-precision phrase (word-boundary)      → +20  (precision_phrase)
 *   4. High-precision pattern (curated regex)     → +20  (precision_pattern)
 *   5. High-precision token (exact whole-word)    → +14  (precision_token)
 *   6. Weak stem contains (substring, ≥6 chars)   → +8   (weak_stem) ← corroboration only
 *   7. Weak context token (exact whole-word)      → +6   (weak_context) ← corroboration only
 *   8. Description signal (any of the above on cleaned description) → +4 ← corroboration only
 *   9. Negative blocker (substring on full text)  → -18  (blocker)
 *
 * After raw extraction the signals are:
 *   - Deduped within a category by match span (phrase vs token on same range counts once).
 *   - Deduped by stem-family (konzert + sommerkonzert count once).
 *   - Deduped across title/description (keyword in both counts once).
 *   - Capped by family (max 2 title, 1 raw-tag, 1 source, 1 description, 1 weak-stem, 1 disambiguator).
 *
 * Location detox runs at the top of `extractSignals` — trailing place names
 * are stripped via GeoNames-backed `stripLocationTails` before lexing.
 */

import type { Category } from '@/types/events';
import type { NormalizedInput } from './normalization';
import { normalizeText } from './normalization';
import {
  SCORE,
  LEXICON,
  NEGATIVE_BLOCKERS,
} from './rules';
import { trustedSourceCategoryFor } from './source-registry';
import { CATEGORIES } from './taxonomy';
import { stripLocationTails } from './location-detox';

export type EvidenceFamily =
  | 'trusted_raw_tag'
  | 'trusted_source'
  | 'title_precision'
  | 'raw_tag_match'
  | 'source_prior'
  | 'description'
  | 'weak_stem'
  | 'weak_context'
  | 'blocker';

export interface Evidence {
  category: Category;
  score: number;
  family: EvidenceFamily;
  /** Short match descriptor (e.g. "phrase:weihnachtsmarkt"). */
  kind: string;
  /** Raw substring / token that matched. */
  source: string;
  /** `[start, end)` span in the searched text (title or description). -1 if N/A. */
  span: readonly [number, number];
  /** Stem-family id if this evidence belongs to one (for dedupe). */
  stem?: string;
  /** Whether this evidence originated from the cleaned description. */
  fromDescription?: boolean;
}

export interface ExtractedSignals {
  evidence: Evidence[];
  blocked: Map<Category, string[]>;
  /** Normalized title AFTER location detox (for disambiguators to inspect). */
  detoxedTitle: string;
}

// ─── Low-level matchers ───────────────────────────────────────────────────

/**
 * Exact-word match: tokens must appear as standalone words. Short needles
 * (< 4 chars) are rejected here as unsafe; the lexicon should not list them
 * as highPrecisionTokens. Returns the `[start, end)` span of the first hit.
 */
function exactWordMatch(text: string, needle: string): [number, number] | null {
  if (!text || !needle) return null;
  if (needle.length < 3) return null;
  const re = new RegExp(`\\b${escapeRegex(needle)}\\b`, 'u');
  const m = re.exec(text);
  if (!m) return null;
  return [m.index, m.index + m[0].length];
}

/**
 * Word-boundary phrase match. Uses \b at start and end, which means short
 * phrases and those with non-letter chars are matched safely.
 */
function phraseMatch(text: string, phrase: string): [number, number] | null {
  if (!text || !phrase) return null;
  const re = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'u');
  const m = re.exec(text);
  if (!m) return null;
  return [m.index, m.index + m[0].length];
}

/** Curated pattern — applied as-is. */
function patternMatch(text: string, pattern: RegExp): [number, number] | null {
  if (!text) return null;
  const re = new RegExp(pattern.source, pattern.flags.includes('u') ? pattern.flags : pattern.flags + 'u');
  const m = re.exec(text);
  if (!m) return null;
  return [m.index, m.index + m[0].length];
}

/** Weak-stem contains: substring match allowed ONLY for needles ≥ 6 chars. */
function weakStemContains(text: string, needle: string): [number, number] | null {
  if (!text || !needle) return null;
  if (needle.length < 6) return null;
  const idx = text.indexOf(needle);
  if (idx === -1) return null;
  return [idx, idx + needle.length];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Extraction ───────────────────────────────────────────────────────────

function stemFor(category: Category, matchedText: string): string | undefined {
  const lex = LEXICON[category];
  if (!lex) return undefined;
  for (const [stemId, variants] of Object.entries(lex.stemFamilies)) {
    for (const v of variants) {
      const norm = normalizeText(v);
      if (norm && matchedText.includes(norm)) return stemId;
    }
  }
  return undefined;
}

/** Push an evidence, avoiding duplicate stems within the same family+category. */
function pushEvidence(bag: Evidence[], ev: Evidence): void {
  bag.push(ev);
}

export function extractSignals(norm: NormalizedInput): ExtractedSignals {
  const evidence: Evidence[] = [];
  const blocked = new Map<Category, string[]>();

  // --- Location detox ---------------------------------------------------
  const detoxedTitle = stripLocationTails(norm.title);

  // --- 1. Trusted raw-tag matches --------------------------------------
  const rawTagNormalized = norm.tags.map(t => normalizeText(t));
  for (let i = 0; i < CATEGORIES.length; i++) {
    const category = CATEGORIES[i];
    const lex = LEXICON[category];
    if (!lex) continue;
    for (const trustedTag of lex.trustedRawTags) {
      const needle = normalizeText(trustedTag);
      if (!needle) continue;
      const hit = rawTagNormalized.find(t => t === needle);
      if (hit) {
        pushEvidence(evidence, {
          category,
          score: SCORE.TRUSTED_EXACT,
          family: 'trusted_raw_tag',
          kind: 'trusted_raw_tag',
          source: trustedTag,
          span: [-1, -1],
        });
      }
    }
  }

  // --- 2. Trusted source exact -----------------------------------------
  const trustedSourceCategory = trustedSourceCategoryFor(norm.sourceName);
  if (trustedSourceCategory) {
    pushEvidence(evidence, {
      category: trustedSourceCategory,
      score: SCORE.TRUSTED_EXACT,
      family: 'trusted_source',
      kind: 'trusted_source',
      source: norm.sourceName,
      span: [-1, -1],
    });
  }

  // --- 3-5. Title-based precision matches (phrase → pattern → token) ---
  for (const category of CATEGORIES) {
    if (category === 'Sonstiges') continue;
    const lex = LEXICON[category];
    if (!lex) continue;

    // Phrases (normalized)
    for (const phrase of lex.highPrecisionPhrases) {
      const n = normalizeText(phrase);
      if (!n) continue;
      const span = phraseMatch(detoxedTitle, n);
      if (span) {
        pushEvidence(evidence, {
          category,
          score: SCORE.HIGH_PRECISION_PHRASE,
          family: 'title_precision',
          kind: 'precision_phrase',
          source: phrase,
          span,
          stem: stemFor(category, n),
        });
      }
    }

    // Patterns
    for (const pattern of lex.highPrecisionPatterns) {
      const span = patternMatch(detoxedTitle, pattern);
      if (span) {
        const matched = detoxedTitle.slice(span[0], span[1]);
        pushEvidence(evidence, {
          category,
          score: SCORE.HIGH_PRECISION_PATTERN,
          family: 'title_precision',
          kind: 'precision_pattern',
          source: matched,
          span,
          stem: stemFor(category, matched),
        });
      }
    }

    // Tokens
    for (const token of lex.highPrecisionTokens) {
      const n = normalizeText(token);
      const span = exactWordMatch(detoxedTitle, n);
      if (span) {
        pushEvidence(evidence, {
          category,
          score: SCORE.HIGH_PRECISION_TOKEN,
          family: 'title_precision',
          kind: 'precision_token',
          source: token,
          span,
          stem: stemFor(category, n),
        });
      }
    }

    // Weak stems (corroboration only)
    for (const stem of lex.weakStemContains) {
      const n = normalizeText(stem);
      const span = weakStemContains(detoxedTitle, n);
      if (span) {
        pushEvidence(evidence, {
          category,
          score: SCORE.WEAK_STEM_CONTAINS,
          family: 'weak_stem',
          kind: 'weak_stem',
          source: stem,
          span,
          stem: stemFor(category, n),
        });
      }
    }

    // Weak context tokens
    for (const token of lex.weakContextTokens) {
      const n = normalizeText(token);
      const span = exactWordMatch(detoxedTitle, n);
      if (span) {
        pushEvidence(evidence, {
          category,
          score: SCORE.WEAK_CONTEXT_TOKEN,
          family: 'weak_context',
          kind: 'weak_context',
          source: token,
          span,
          stem: stemFor(category, n),
        });
      }
    }
  }

  // --- 6. Raw-tag token matches (raw tag contains a category keyword) ---
  for (const category of CATEGORIES) {
    if (category === 'Sonstiges') continue;
    const lex = LEXICON[category];
    if (!lex) continue;

    let rawHit: string | null = null;
    for (const rawTag of rawTagNormalized) {
      if (!rawTag) continue;
      for (const token of lex.highPrecisionTokens) {
        const n = normalizeText(token);
        if (exactWordMatch(rawTag, n)) {
          rawHit = `${rawTag} ~ ${token}`;
          break;
        }
      }
      if (rawHit) break;
    }
    if (rawHit) {
      pushEvidence(evidence, {
        category,
        score: SCORE.HIGH_PRECISION_TOKEN,
        family: 'raw_tag_match',
        kind: 'raw_tag_token',
        source: rawHit,
        span: [-1, -1],
      });
    }
  }

  // --- 7. Description corroboration -------------------------------------
  // Apply the same lexicon to the cleaned description, but scored at
  // DESCRIPTION_SIGNAL (+4). Skip weak-stem + weak-context for description
  // to keep description firmly in corroboration territory only.
  if (norm.description) {
    for (const category of CATEGORIES) {
      if (category === 'Sonstiges') continue;
      const lex = LEXICON[category];
      if (!lex) continue;

      let hit: { source: string; span: [number, number]; stem?: string } | null = null;

      for (const phrase of lex.highPrecisionPhrases) {
        const n = normalizeText(phrase);
        const span = phraseMatch(norm.description, n);
        if (span) { hit = { source: phrase, span, stem: stemFor(category, n) }; break; }
      }
      if (!hit) {
        for (const pattern of lex.highPrecisionPatterns) {
          const span = patternMatch(norm.description, pattern);
          if (span) {
            const matched = norm.description.slice(span[0], span[1]);
            hit = { source: matched, span, stem: stemFor(category, matched) };
            break;
          }
        }
      }
      if (!hit) {
        for (const token of lex.highPrecisionTokens) {
          const n = normalizeText(token);
          const span = exactWordMatch(norm.description, n);
          if (span) { hit = { source: token, span, stem: stemFor(category, n) }; break; }
        }
      }
      if (hit) {
        pushEvidence(evidence, {
          category,
          score: SCORE.DESCRIPTION_SIGNAL,
          family: 'description',
          kind: 'description_signal',
          source: hit.source,
          span: hit.span,
          stem: hit.stem,
          fromDescription: true,
        });
      }
    }
  }

  // --- 8. Source category hint (treated as weak raw-tag prior) ---------
  if (norm.sourceCategory) {
    for (const category of CATEGORIES) {
      const n = normalizeText(category);
      if (n && (n.includes(norm.sourceCategory) || norm.sourceCategory.includes(n))) {
        pushEvidence(evidence, {
          category,
          score: SCORE.WEAK_CONTEXT_TOKEN,
          family: 'source_prior',
          kind: 'source_category_prior',
          source: norm.sourceCategory,
          span: [-1, -1],
        });
        break;
      }
    }
  }

  // --- 9. Negative blockers (substring-OK on full text) -----------------
  const blockerHaystack = [detoxedTitle, norm.description, norm.sourceName, norm.organizer, norm.locationName]
    .filter(Boolean)
    .join(' ');
  for (const blocker of NEGATIVE_BLOCKERS) {
    for (const tok of blocker.whenAnyToken) {
      const n = normalizeText(tok);
      if (n && blockerHaystack.includes(n)) {
        pushEvidence(evidence, {
          category: blocker.target,
          score: SCORE.BLOCKER,
          family: 'blocker',
          kind: 'blocker',
          source: `${tok} (${blocker.reason})`,
          span: [-1, -1],
        });
        const list = blocked.get(blocker.target) ?? [];
        list.push(blocker.reason);
        blocked.set(blocker.target, list);
        break;
      }
    }
  }

  return { evidence, blocked, detoxedTitle };
}

// ─── Aggregation with dedupe + capping ───────────────────────────────────

export interface AggregatedScore {
  category: Category;
  score: number;
  evidence: Evidence[];
  /** High-precision evidences in the title (after dedupe + cap). */
  titlePrecisionCount: number;
  /** Distinct evidence families represented after dedupe. */
  familyCount: number;
  hasBlocker: boolean;
  blockerReasons: string[];
}

function dedupeSpansAndStems(category: Category, evidences: Evidence[]): Evidence[] {
  // 1. If two title_precision evidences share an overlapping span, keep the
  //    higher-scoring one.
  const sorted = [...evidences].sort((a, b) => b.score - a.score);
  const kept: Evidence[] = [];
  const occupied: Array<[number, number]> = [];
  for (const ev of sorted) {
    if (ev.family !== 'title_precision' || ev.span[0] < 0) { kept.push(ev); continue; }
    const [s, e] = ev.span;
    const overlap = occupied.some(([os, oe]) => s < oe && e > os);
    if (overlap) continue;
    occupied.push([s, e]);
    kept.push(ev);
  }

  // 2. Within title_precision: dedupe by stem-family, keeping the highest score.
  const byStem = new Map<string, Evidence>();
  const noStem: Evidence[] = [];
  const result: Evidence[] = [];
  for (const ev of kept) {
    if (ev.family !== 'title_precision') { result.push(ev); continue; }
    if (!ev.stem) { noStem.push(ev); continue; }
    const cur = byStem.get(ev.stem);
    if (!cur || ev.score > cur.score) byStem.set(ev.stem, ev);
  }
  result.push(...byStem.values(), ...noStem);

  // 3. Title-description dedupe: if the same stem appears in both title and
  //    description for this category, drop the description signal (title wins).
  const titleStems = new Set<string>();
  for (const ev of result) {
    if (ev.family === 'title_precision' && ev.stem) titleStems.add(ev.stem);
    if (ev.family === 'weak_stem' && ev.stem) titleStems.add(ev.stem);
  }
  return result.filter(ev => !(ev.family === 'description' && ev.stem && titleStems.has(ev.stem)));
}

function capByFamily(category: Category, evidences: Evidence[]): Evidence[] {
  const caps: Record<EvidenceFamily, number> = {
    trusted_raw_tag: 1,
    trusted_source: 1,
    title_precision: 2,
    raw_tag_match: 1,
    source_prior: 1,
    description: 1,
    weak_stem: 1,
    weak_context: 2,
    blocker: 10, // blockers don't get capped; summed -18 is the desired behaviour
  };
  const countsByFamily = new Map<EvidenceFamily, Evidence[]>();
  const sorted = [...evidences].sort((a, b) => b.score - a.score);
  const out: Evidence[] = [];
  for (const ev of sorted) {
    const bucket = countsByFamily.get(ev.family) ?? [];
    if (bucket.length < caps[ev.family]) {
      bucket.push(ev);
      countsByFamily.set(ev.family, bucket);
      out.push(ev);
    }
  }
  return out;
}

export function aggregate(signals: ExtractedSignals): AggregatedScore[] {
  // Group by category
  const byCat = new Map<Category, Evidence[]>();
  for (const ev of signals.evidence) {
    const list = byCat.get(ev.category) ?? [];
    list.push(ev);
    byCat.set(ev.category, list);
  }

  const result: AggregatedScore[] = [];
  for (const category of CATEGORIES) {
    if (category === 'Sonstiges') continue; // never scored
    const raw = byCat.get(category) ?? [];
    const deduped = dedupeSpansAndStems(category, raw);
    const capped = capByFamily(category, deduped);
    const score = capped.reduce((acc, ev) => acc + ev.score, 0);
    const titlePrecisionCount = capped.filter(e => e.family === 'title_precision').length;
    const familyCount = new Set(capped.filter(e => e.family !== 'blocker').map(e => e.family)).size;
    const blockerReasons = signals.blocked.get(category) ?? [];
    result.push({
      category,
      score,
      evidence: capped,
      titlePrecisionCount,
      familyCount,
      hasBlocker: blockerReasons.length > 0,
      blockerReasons,
    });
  }
  return result.sort((a, b) => b.score - a.score);
}
