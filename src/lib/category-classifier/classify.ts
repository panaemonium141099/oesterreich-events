/**
 * High-level classifier entry points. Separated from `index.ts` so
 * `reconcile.ts` can import without triggering circular deps.
 */

import type { Category, CategoryCandidate } from '@/types/events';
import { normalizeInput, type ClassifierInputShape } from './normalization';
import { decideDeterministic, type ClassifierDecision, type DeterministicResult } from './decide';
import { CLASSIFIER_VERSION } from './taxonomy';
import { getCached, setCached } from './cache';
import {
  classifyWithAi,
  type AiClient,
  type AiCategorizationResult,
} from './ai';

export interface ClassifierOutcome {
  category: Category;
  tags: Category[];
  confidence: 'rules_exact' | 'rules_high' | 'rules_medium' | 'rules_low' | 'ai' | 'ai_low';
  source: 'rules' | 'ai';
  version: string;
  candidates: CategoryCandidate[];
  reason: string;
  needsReview: boolean;
  inputHash: string;
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
 * Deterministic-only classifier. Returns a ClassifierOutcome for both the
 * accepted path and the "needs AI" path (as a provisional) so callers
 * never need to branch on success/failure.
 */
export function classifyDeterministic(input: ClassifierInputShape): ClassifierOutcome {
  const norm = normalizeInput(input);
  const decision = decideDeterministic(norm);
  if (!decision.needsAi) return fromDeterministic(decision);
  return {
    category: decision.provisionalCategory,
    tags: decision.provisionalTags,
    confidence: 'ai_low',
    source: 'rules',
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
  useStrongModel?: boolean;
  bypassCache?: boolean;
}

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

  if (deterministicCandidate) {
    return {
      category: deterministicCandidate,
      tags: decision.needsAi ? decision.provisionalTags : decision.tags,
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

/** Deterministic first; only consult AI if the deterministic stage fell through. */
export async function classifyWithAiFallback(
  input: ClassifierInputShape,
  opts: AiFallbackOptions,
): Promise<ClassifierOutcome> {
  const norm = normalizeInput(input);
  const decision = decideDeterministic(norm);
  if (!decision.needsAi) return fromDeterministic(decision);

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
    return {
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
