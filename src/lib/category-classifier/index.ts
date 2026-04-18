/**
 * Public API of the central category classifier (cat-v2).
 *
 * Shape:
 *
 *   classifyDeterministic(input)            — fast, no I/O, no AI.
 *                                             Returns ClassifierOutcome always.
 *   classifyWithAiFallback(input, {ai})     — deterministic + AI residue.
 *                                             Used by categorize-events.ts AI mode.
 *   resolveCanonicalCategory(input, row)    — deterministic + reconcile.
 *                                             Used by both write paths + backfill.
 *
 * Invariants:
 *   - Only `reconcile.ts` decides KEEP vs OVERWRITE.
 *   - Only `ai.ts` touches OpenAI.
 *   - Only `decide.ts` implements gate logic.
 *   - Lexicon lives only in `rules.ts`.
 */

export {
  CATEGORIES,
  CLASSIFIER_VERSION,
  CLASSIFIER_VERSION_PREFIX,
  PRIORITY_ORDER,
  CATEGORY_DEFINITIONS,
  CATEGORY_CONFIDENCE_RANK,
  categoryConfidenceRank,
} from './taxonomy';

export { normalizeInput, hashClassifierInput, cleanDescriptionForSignals } from './normalization';
export { extractSignals, aggregate } from './signals';
export { decideDeterministic } from './decide';
export { getCached, setCached, purgeStaleVersions } from './cache';
export { classifyWithAi, AI_DEFAULT_MODEL, AI_STRONG_MODEL } from './ai';
export { classifyDeterministic, classifyWithAiFallback } from './classify';
export { resolveCanonicalCategory, reconcile } from './reconcile';
export { stripLocationTails } from './location-detox';
export {
  trustedSourceCategoryFor,
  isTrustedSource,
  trustedSourceEntries,
  MULTI_CATEGORY_AGGREGATORS,
} from './source-registry';

export type { AiClient, AiCategorizationResult, AiCategorizationRequest } from './ai';
export type { ClassifierDecision, DeterministicResult, NeedsAiResult, GateId } from './decide';
export type { ClassifierInputShape, NormalizedInput } from './normalization';
export type { ClassifierOutcome, AiFallbackOptions } from './classify';
export type { CanonicalCategory, ExistingCategoryRow } from './reconcile';
