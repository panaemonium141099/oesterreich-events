/**
 * Public API of the central category classifier.
 *
 * This module has two entry points:
 *
 *   - classifyDeterministic(input)      — fast, no I/O, no AI. Always returns
 *                                         a ClassifierOutcome (possibly a
 *                                         "needs AI" verdict with a provisional
 *                                         category so callers never block).
 *
 *   - classifyWithAiFallback(input, ai) — deterministic first, then AI if
 *                                         needed. Writes through the SQLite
 *                                         cache. Used by the batch script.
 *
 * The returned shape is always a `ClassifierOutcome` so callers don't have to
 * branch on which stage produced the decision.
 */

import type { Category, CategoryCandidate } from '@/types/events';
import { normalizeInput, type ClassifierInputShape } from './normalization';
import {
  decideDeterministic,
  type ClassifierDecision,
  type DeterministicResult,
} from './decide';
import { getCached, setCached } from './cache';
import {
  classifyWithAi,
  type AiClient,
  type AiCategorizationResult,
} from './ai';
import { CLASSIFIER_VERSION } from './taxonomy';

export {
  CATEGORIES,
  CLASSIFIER_VERSION,
  PRIORITY_ORDER,
  CATEGORY_DEFINITIONS,
  CATEGORY_CONFIDENCE_RANK,
  categoryConfidenceRank,
} from './taxonomy';
export { extractSignals, aggregate } from './signals';
export { decideDeterministic } from './decide';
export { normalizeInput, hashClassifierInput } from './normalization';
export { getCached, setCached, purgeStaleVersions } from './cache';
export { classifyWithAi, AI_DEFAULT_MODEL, AI_STRONG_MODEL } from './ai';
export type { AiClient, AiCategorizationResult, AiCategorizationRequest } from './ai';
export type { ClassifierDecision, DeterministicResult, NeedsAiResult } from './decide';
export type { ClassifierInputShape, NormalizedInput } from './normalization';

export interface ClassifierOutcome {
  category: Category;
  tags: Category[];
  confidence: 'rules_high' | 'rules_medium' | 'ai' | 'ai_low';
  source: 'rules' | 'ai';
  version: string;
  candidates: CategoryCandidate[];
  reason: string;
  needsReview: boolean;
  inputHash: string;
  /** Whether the AI stage was consulted for this decision. */
  usedAi: boolean;
}

function fromDeterministic(result: DeterministicResult): ClassifierOutcome {
  return {
    category: result.category,
    tags: result.tags,
    confidence: result.confidence,
    source: result.source,
    version: result.version,
    candidates: result.candidates,
    reason: result.reason,
    needsReview: false,
    inputHash: result.inputHash,
    usedAi: false,
  };
}

/**
 * Run only the deterministic stage. Always resolves — never calls OpenAI.
 * When confidence is too low, returns a provisional `Sonstiges`-or-best-guess
 * outcome with `needsReview=true` so the caller can hand it to the batch script.
 */
export function classifyDeterministic(input: ClassifierInputShape): ClassifierOutcome {
  const norm = normalizeInput(input);
  const decision = decideDeterministic(norm);

  if (!decision.needsAi) {
    return fromDeterministic(decision);
  }

  return {
    category: decision.provisionalCategory,
    tags: decision.provisionalTags,
    confidence: 'ai_low', // placeholder until AI weighs in
    source: 'rules',       // came from the deterministic stage as provisional
    version: CLASSIFIER_VERSION,
    candidates: decision.candidates,
    reason: decision.reason,
    needsReview: true,
    inputHash: decision.inputHash,
    usedAi: false,
  };
}

export interface AiFallbackOptions {
  ai: AiClient;
  /** Use the stronger model (gpt-4o) instead of the default (gpt-4o-mini). */
  useStrongModel?: boolean;
  /** Skip reading and writing the SQLite cache. */
  bypassCache?: boolean;
}

/**
 * Merge AI output with the deterministic candidate into the final outcome.
 * Applies the write-rules required by the spec:
 *   - AI high/medium       => accept AI result
 *   - AI low + det exists  => keep deterministic, mark needsReview
 *   - AI low + no det      => Sonstiges + needsReview
 */
function mergeAi(
  decision: ClassifierDecision,
  ai: AiCategorizationResult,
  candidates: CategoryCandidate[],
  inputHash: string,
): ClassifierOutcome {
  const deterministicCandidate = !decision.needsAi
    ? decision.category
    : decision.topScore > 0
      ? decision.provisionalCategory
      : null;

  if (ai.confidence === 'high' || ai.confidence === 'medium') {
    const tags = [ai.primaryCategory, ...ai.secondaryCategories].slice(0, 3);
    return {
      category: ai.primaryCategory,
      tags,
      confidence: 'ai',
      source: 'ai',
      version: CLASSIFIER_VERSION,
      candidates,
      reason: `ai: ${ai.confidence} — ${ai.shortReason}`,
      needsReview: ai.shouldReview,
      inputHash,
      usedAi: true,
    };
  }

  // AI low-confidence path
  if (deterministicCandidate) {
    return {
      category: deterministicCandidate,
      tags: decision.needsAi
        ? decision.provisionalTags
        : decision.tags,
      confidence: 'ai_low',
      source: 'rules',
      version: CLASSIFIER_VERSION,
      candidates,
      reason: `ai_low: kept deterministic ${deterministicCandidate} (${ai.shortReason})`,
      needsReview: true,
      inputHash,
      usedAi: true,
    };
  }

  return {
    category: 'Sonstiges',
    tags: ['Sonstiges'],
    confidence: 'ai_low',
    source: 'ai',
    version: CLASSIFIER_VERSION,
    candidates,
    reason: `ai_low: no deterministic candidate (${ai.shortReason})`,
    needsReview: true,
    inputHash,
    usedAi: true,
  };
}

/**
 * Deterministic first. If the deterministic stage accepts, return its result
 * directly. Otherwise consult the cache, then OpenAI.
 */
export async function classifyWithAiFallback(
  input: ClassifierInputShape,
  opts: AiFallbackOptions,
): Promise<ClassifierOutcome> {
  const norm = normalizeInput(input);
  const decision = decideDeterministic(norm);

  if (!decision.needsAi) {
    return fromDeterministic(decision);
  }

  // Cache lookup
  if (!opts.bypassCache) {
    const cached = getCached(norm.inputHash);
    if (cached) {
      return {
        category: cached.category,
        tags: cached.tags,
        confidence: cached.confidence as ClassifierOutcome['confidence'],
        source: cached.source as ClassifierOutcome['source'],
        version: cached.classifierVersion,
        candidates: cached.candidates ?? decision.candidates,
        reason: cached.reason ?? `cached: ${cached.category}`,
        needsReview: cached.confidence === 'ai_low',
        inputHash: cached.inputHash,
        usedAi: true,
      };
    }
  }

  const aiResult = await classifyWithAi(
    opts.ai,
    {
      title: input.title,
      description: input.description ?? null,
      sourceTagsRaw: input.source_tags_raw ? [...input.source_tags_raw] : [],
      sourceCategoryRaw: input.source_category_raw ?? null,
      sourceName: input.source_name ?? null,
      organizer: input.organizer ?? null,
      locationName: input.location_name ?? null,
      candidateHint: decision.candidates.slice(0, 3),
      reason: decision.reason,
    },
    { useStrongModel: opts.useStrongModel },
  );

  if (!aiResult) {
    // AI failed → fall back to deterministic provisional
    const provisional: ClassifierOutcome = {
      category: decision.provisionalCategory,
      tags: decision.provisionalTags,
      confidence: 'ai_low',
      source: 'rules',
      version: CLASSIFIER_VERSION,
      candidates: decision.candidates,
      reason: `ai_error: kept provisional ${decision.provisionalCategory}`,
      needsReview: true,
      inputHash: decision.inputHash,
      usedAi: true,
    };
    return provisional;
  }

  const merged = mergeAi(decision, aiResult, decision.candidates, norm.inputHash);

  if (!opts.bypassCache) {
    setCached({
      inputHash: merged.inputHash,
      category: merged.category,
      tags: merged.tags,
      confidence: merged.confidence,
      source: merged.source,
      reason: merged.reason,
      candidates: merged.candidates,
    });
  }

  return merged;
}
