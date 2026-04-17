/**
 * Deterministic decision layer.
 *
 * Turns the aggregated evidence scores into a final ClassifierResult, or
 * a "needs-AI" verdict that the batch script can pick up. This is the single
 * place where the accept thresholds live.
 */

import type { Category, CategoryCandidate } from '@/types/events';
import type { NormalizedInput } from './normalization';
import { PRIORITY_ORDER, CLASSIFIER_VERSION } from './taxonomy';
import {
  aggregate,
  extractSignals,
  type AggregatedScore,
  type Evidence,
} from './signals';
import { SCORE } from './rules';

export interface DeterministicResult {
  category: Category;
  tags: Category[];
  confidence: 'rules_high' | 'rules_medium';
  source: 'rules';
  version: string;
  candidates: CategoryCandidate[];
  reason: string;
  needsReview: false;
  inputHash: string;
  /** True when downstream should run AI; never true when deterministic passed. */
  needsAi: false;
}

export interface NeedsAiResult {
  /** Provisional deterministic best guess (or 'Sonstiges') shown while AI is pending. */
  provisionalCategory: Category;
  provisionalTags: Category[];
  candidates: CategoryCandidate[];
  reason: string;
  inputHash: string;
  topScore: number;
  gap: number;
  winningHasTitleEvidence: boolean;
  winningHasRawTagEvidence: boolean;
  winningHasBlocker: boolean;
  winningRelyOnlyOnDescriptionOrSource: boolean;
  trustedSourceConflictsLexical: boolean;
  needsAi: true;
}

export type ClassifierDecision = DeterministicResult | NeedsAiResult;

/** Minimum score and gap required for deterministic accept condition #2. */
export const DETERMINISTIC_MIN_SCORE = 24;
export const DETERMINISTIC_MIN_GAP = 10;

function toCandidates(scores: AggregatedScore[]): CategoryCandidate[] {
  return scores
    .filter(s => s.score > 0)
    .slice(0, 5)
    .map(s => ({
      category: s.category,
      score: s.score,
      evidence: s.evidence.map(e => `${e.kind}:${e.source}`),
    }));
}

function collectMultiTags(
  scores: AggregatedScore[],
  primary: Category,
): Category[] {
  // Consider any category that is independently above half the primary's score
  // OR has TRUSTED_EXACT / STRONG_TITLE_PHRASE / EXACT_RAW_TAG_MAP evidence of
  // its own. Up to 3 tags, ordered by PRIORITY_ORDER.
  const primaryScore = scores.find(s => s.category === primary)?.score ?? 0;
  const keep = new Set<Category>([primary]);
  const halfPrimary = Math.max(primaryScore / 2, SCORE.EXACT_RAW_TAG_MAP);
  for (const s of scores) {
    if (s.category === primary) continue;
    if (s.score <= 0) continue;
    const strongEvidence = s.evidence.some(
      (e: Evidence) =>
        e.kind === 'trusted_raw_tag' ||
        e.kind === 'strong_title_phrase' ||
        e.kind === 'raw_tag_token',
    );
    if (strongEvidence || s.score >= halfPrimary) {
      keep.add(s.category);
    }
  }
  return PRIORITY_ORDER.filter(c => keep.has(c)).slice(0, 3);
}

function reasonFrom(top: AggregatedScore, runnerUp: AggregatedScore | undefined): string {
  const ev = top.evidence
    .map(e => e.kind)
    .reduce<Record<string, number>>((acc, k) => {
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  const evStr = Object.entries(ev)
    .map(([k, v]) => `${k}×${v}`)
    .join(', ');
  const gap = runnerUp ? top.score - runnerUp.score : top.score;
  return `rules: ${top.category}@${top.score} gap=${gap} [${evStr}]`;
}

function pickPrimary(scores: AggregatedScore[]): AggregatedScore {
  // Prefer the highest score. Break ties with PRIORITY_ORDER (specific first).
  const top = scores[0];
  if (scores.length < 2) return top;
  const tied = scores.filter(s => s.score === top.score);
  if (tied.length === 1) return top;
  for (const cat of PRIORITY_ORDER) {
    const hit = tied.find(s => s.category === cat);
    if (hit) return hit;
  }
  return top;
}

export function decideDeterministic(norm: NormalizedInput): ClassifierDecision {
  const signals = extractSignals(norm);
  const scores = aggregate(signals);
  const candidates = toCandidates(scores);

  const top = pickPrimary(scores);
  const runnerUp = scores.find(s => s.category !== top.category);
  const topScore = top.score;
  const gap = runnerUp ? topScore - runnerUp.score : topScore;

  // Extract "was a trusted_raw_tag present for the top category?"
  const topEvidence = top.evidence;
  const hasTrustedExactForTop = topEvidence.some(e =>
    e.kind === 'trusted_raw_tag' || e.kind === 'trusted_source',
  );
  const winningHasBlocker = top.hasBlocker;
  const winningHasTitleEvidence = top.hasTitleEvidence;
  const winningHasRawTagEvidence = top.hasRawTagEvidence;
  const winningRelyOnlyOnDescriptionOrSource = topEvidence.every(e =>
    e.kind === 'description_signal' ||
    e.kind === 'source_prior' ||
    e.kind === 'source_category_prior',
  );

  // Trusted-source mapping conflict detection: a trusted exact row exists for
  // category X, but the highest-scoring category after mixing priors is Y != X.
  const trustedExactEvidence = signals.evidence.filter(
    e => e.kind === 'trusted_raw_tag' || e.kind === 'trusted_source',
  );
  let trustedSourceConflictsLexical = false;
  if (trustedExactEvidence.length > 0) {
    const trustedCats = new Set(trustedExactEvidence.map(e => e.category));
    if (!trustedCats.has(top.category)) {
      trustedSourceConflictsLexical = true;
    }
  }

  // ----- Deterministic accept condition #1: trusted exact + no blocker -----
  const acceptCondition1 =
    hasTrustedExactForTop && !winningHasBlocker && !trustedSourceConflictsLexical;

  // ----- Deterministic accept condition #2: score + gap + title/raw-tag + no blocker -----
  const acceptCondition2 =
    topScore >= DETERMINISTIC_MIN_SCORE &&
    gap >= DETERMINISTIC_MIN_GAP &&
    (winningHasTitleEvidence || winningHasRawTagEvidence) &&
    !winningHasBlocker &&
    !trustedSourceConflictsLexical;

  if (acceptCondition1 || acceptCondition2) {
    const confidence: DeterministicResult['confidence'] = acceptCondition1
      ? 'rules_high'
      : 'rules_medium';
    const tags = collectMultiTags(scores, top.category);
    return {
      category: top.category,
      tags,
      confidence,
      source: 'rules',
      version: CLASSIFIER_VERSION,
      candidates,
      reason: reasonFrom(top, runnerUp),
      needsReview: false,
      inputHash: norm.inputHash,
      needsAi: false,
    };
  }

  // Deterministic accept did not pass — this event is a hard case.
  const provisional: Category = topScore > 0 ? top.category : 'Sonstiges';
  const provisionalTags: Category[] = topScore > 0
    ? collectMultiTags(scores, provisional)
    : ['Sonstiges'];

  const reason = topScore > 0
    ? `needs_ai: low-confidence rules: ${top.category}@${topScore} gap=${gap} ` +
      (winningHasBlocker ? '[blocker fired] ' : '') +
      (trustedSourceConflictsLexical ? '[trusted-map conflict] ' : '') +
      (winningRelyOnlyOnDescriptionOrSource ? '[desc/source only] ' : '')
    : 'needs_ai: no evidence from rules';

  return {
    provisionalCategory: provisional,
    provisionalTags,
    candidates,
    reason,
    inputHash: norm.inputHash,
    topScore,
    gap,
    winningHasTitleEvidence,
    winningHasRawTagEvidence,
    winningHasBlocker,
    winningRelyOnlyOnDescriptionOrSource,
    trustedSourceConflictsLexical,
    needsAi: true,
  };
}
