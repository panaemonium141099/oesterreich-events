/**
 * reconcile.ts — Single source of overwrite truth (R2 + R10).
 *
 * Both write paths (`src/lib/db/supabase-sync.ts` and `src/lib/db/queries.ts`)
 * AND the deterministic-backfill script route through `resolveCanonicalCategory`.
 * This is the only place that decides KEEP vs OVERWRITE, ensuring the two
 * write paths can never drift.
 *
 * Overwrite rules (encoded here once, applied everywhere):
 *
 *   1. existing.category_locked === true        → KEEP existing (no write).
 *   2. existing.confidence === 'manual'         → KEEP existing (manual untouchable).
 *   3. incoming rank < existing rank            → OVERWRITE (strictly better).
 *   4. same rank AND same version AND same category → KEEP (no-op stable).
 *   5. same rank AND incoming version > existing version → OVERWRITE (refresh).
 *   6. incoming rank > existing rank            → KEEP (never downgrade).
 *
 * Special tightening:
 *   - When existing is `ai` / `ai_low` and incoming is `rules_low`,
 *     OVERWRITE only if the category differs (never silently downgrade
 *     an AI decision to rules_low for the same category).
 */

import type {
  Category,
  CategoryCandidate,
  CategoryConfidence,
  CategorySource,
} from '@/types/events';
import {
  categoryConfidenceRank,
  CLASSIFIER_VERSION,
  CLASSIFIER_VERSION_PREFIX,
} from './taxonomy';
import { classifyDeterministic } from './classify';
import type { ClassifierInputShape } from './normalization';

export interface ExistingCategoryRow {
  category: string | null;
  tags: string[] | null;
  category_confidence: CategoryConfidence | string | null;
  category_source: CategorySource | string | null;
  category_version: string | null;
  category_locked: boolean | null;
  category_needs_review: boolean | null;
  category_reason: string | null;
  category_candidates: unknown;
}

export interface CanonicalCategory {
  category: Category | null;
  tags: Category[] | null;
  category_confidence: CategoryConfidence | null;
  category_source: CategorySource | null;
  category_version: string | null;
  category_locked: boolean;
  category_needs_review: boolean;
  category_reason: string | null;
  category_candidates: CategoryCandidate[] | null;
  /** True when this outcome materially differs from `existing`. */
  changed: boolean;
  /** Human-readable summary of the reconciliation decision. */
  reconcileReason:
    | 'locked'
    | 'manual_untouchable'
    | 'strictly_better_new'
    | 'noop_same_rank_same_version'
    | 'version_refresh'
    | 'ai_kept_no_downgrade'
    | 'new_no_existing'
    | 'incoming_needs_ai_keep_existing'
    | 'existing_newer_higher_rank';
}

/** Compare two compound classifier versions (cat-vX-rulesY-promptZ). */
function compareVersions(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a < b ? -1 : 1;
}

/** Return true when `a` parses to the same category as `b` (case-sensitive). */
function sameCategory(a: string | null, b: string | null): boolean {
  return a === b;
}

interface IncomingOutcome {
  category: Category | null;
  tags: Category[] | null;
  confidence: CategoryConfidence;
  source: CategorySource;
  version: string;
  needsReview: boolean;
  reason: string;
  candidates: CategoryCandidate[];
  /** True when the deterministic run returned needs_ai (no rules accept). */
  needsAi: boolean;
}

/**
 * Decide whether to KEEP the existing row's category data or OVERWRITE with
 * `incoming`. Returns the chosen CanonicalCategory plus a `changed` flag.
 *
 * The backfill script uses `changed` to skip no-op writes, making the
 * backfill idempotent (R4).
 */
export function reconcile(
  existing: ExistingCategoryRow | null,
  incoming: IncomingOutcome,
): CanonicalCategory {
  // Fresh row — just take incoming.
  if (!existing) {
    return {
      category: incoming.category,
      tags: incoming.tags,
      category_confidence: incoming.confidence,
      category_source: incoming.source,
      category_version: incoming.version,
      category_locked: false,
      category_needs_review: incoming.needsReview,
      category_reason: incoming.reason,
      category_candidates: incoming.candidates,
      changed: true,
      reconcileReason: 'new_no_existing',
    };
  }

  // Rule 1: lock wins.
  if (existing.category_locked) {
    return keepExisting(existing, 'locked');
  }

  // Rule 2: manual untouchable.
  if (existing.category_confidence === 'manual') {
    return keepExisting(existing, 'manual_untouchable');
  }

  // If incoming is a "needs AI" provisional, keep existing untouched except
  // for version refresh if the incoming classifier version is newer. This
  // avoids the cat-v1 bug where "missing version → AI" cascaded.
  if (incoming.needsAi && existing.category_confidence && existing.category_version) {
    const cmp = compareVersions(existing.category_version, incoming.version);
    if (cmp >= 0) {
      return keepExisting(existing, 'incoming_needs_ai_keep_existing');
    }
    // version-refresh only (no category/tags/confidence change).
    return {
      category: (existing.category ?? null) as Category | null,
      tags: (existing.tags ?? null) as Category[] | null,
      category_confidence: (existing.category_confidence ?? null) as CategoryConfidence | null,
      category_source: (existing.category_source ?? null) as CategorySource | null,
      category_version: incoming.version,
      category_locked: Boolean(existing.category_locked),
      category_needs_review: Boolean(existing.category_needs_review),
      category_reason: existing.category_reason ?? null,
      category_candidates: (existing.category_candidates ?? null) as CategoryCandidate[] | null,
      changed: existing.category_version !== incoming.version,
      reconcileReason: 'version_refresh',
    };
  }

  const existingRank = categoryConfidenceRank(existing.category_confidence);
  const incomingRank = categoryConfidenceRank(incoming.confidence);

  // Rule 3: strictly better incoming → OVERWRITE.
  // Special tightening: ai/ai_low should not be silently downgraded to
  // rules_low on the same category. When existing is ai/ai_low and
  // incoming is rules_low AND same category, treat as keep.
  if (incomingRank < existingRank) {
    if (
      (existing.category_confidence === 'ai' || existing.category_confidence === 'ai_low') &&
      incoming.confidence === 'rules_low' &&
      sameCategory(existing.category, incoming.category)
    ) {
      return keepExisting(existing, 'ai_kept_no_downgrade');
    }
    return overwriteWith(existing, incoming, 'strictly_better_new');
  }

  // Same rank path.
  if (incomingRank === existingRank) {
    const versionCmp = compareVersions(existing.category_version, incoming.version);
    if (
      versionCmp === 0 &&
      sameCategory(existing.category, incoming.category)
    ) {
      return keepExisting(existing, 'noop_same_rank_same_version');
    }
    if (versionCmp < 0) {
      // Incoming version is newer → refresh version/tags/candidates/reason but
      // only when the new version actually produces the same category or a
      // better one. Treat same-rank version bumps as eligible overwrites.
      return overwriteWith(existing, incoming, 'version_refresh');
    }
    // Existing has newer version at same rank → keep existing.
    return keepExisting(existing, 'existing_newer_higher_rank');
  }

  // incomingRank > existingRank (incoming is worse) → keep existing.
  return keepExisting(existing, 'existing_newer_higher_rank');
}

function keepExisting(
  existing: ExistingCategoryRow,
  reason: CanonicalCategory['reconcileReason'],
): CanonicalCategory {
  return {
    category: (existing.category ?? null) as Category | null,
    tags: (existing.tags ?? null) as Category[] | null,
    category_confidence: (existing.category_confidence ?? null) as CategoryConfidence | null,
    category_source: (existing.category_source ?? null) as CategorySource | null,
    category_version: existing.category_version ?? null,
    category_locked: Boolean(existing.category_locked),
    category_needs_review: Boolean(existing.category_needs_review),
    category_reason: existing.category_reason ?? null,
    category_candidates: (existing.category_candidates ?? null) as CategoryCandidate[] | null,
    changed: false,
    reconcileReason: reason,
  };
}

function overwriteWith(
  existing: ExistingCategoryRow,
  incoming: IncomingOutcome,
  reason: CanonicalCategory['reconcileReason'],
): CanonicalCategory {
  const changed =
    existing.category !== incoming.category ||
    existing.category_confidence !== incoming.confidence ||
    existing.category_source !== incoming.source ||
    existing.category_version !== incoming.version ||
    !tagsEqual(existing.tags, incoming.tags) ||
    Boolean(existing.category_needs_review) !== incoming.needsReview;
  return {
    category: incoming.category,
    tags: incoming.tags,
    category_confidence: incoming.confidence,
    category_source: incoming.source,
    category_version: incoming.version,
    category_locked: false,
    category_needs_review: incoming.needsReview,
    category_reason: incoming.reason,
    category_candidates: incoming.candidates,
    changed,
    reconcileReason: reason,
  };
}

function tagsEqual(a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Convenience: run the deterministic classifier AND reconcile in one call.
 * Used by both write paths to guarantee consistency.
 */
export function resolveCanonicalCategory(
  input: ClassifierInputShape,
  existing: ExistingCategoryRow | null,
): CanonicalCategory {
  const outcome = classifyDeterministic(input);
  // `classifyDeterministic` never throws; it returns a provisional with
  // `needsReview=true` + `confidence='ai_low'` when rules cannot accept.
  const isProvisional = outcome.needsReview && !outcome.usedAi && outcome.confidence === 'ai_low';
  return reconcile(existing, {
    category: outcome.category,
    tags: outcome.tags,
    confidence: outcome.confidence,
    source: outcome.source,
    version: CLASSIFIER_VERSION,
    needsReview: outcome.needsReview,
    reason: outcome.reason,
    candidates: outcome.candidates,
    needsAi: isProvisional,
  });
}

// Re-export for convenience; avoids a cycle with index.ts.
export { CLASSIFIER_VERSION, CLASSIFIER_VERSION_PREFIX };
