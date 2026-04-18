/**
 * Deterministic decision layer — cat-v2.
 *
 * Four acceptance gates evaluated in order (first match wins):
 *
 *   Gate 1  rules_exact  — trusted raw-tag OR trusted source OR trusted phrase
 *                           AND no blocker AND no trusted-map conflict
 *   Gate 2  rules_high   — single precise winner
 *                           (≥1 high-precision phrase/pattern/token on winner;
 *                            NO high-precision signal on any other category;
 *                            no blocker)
 *   Gate 3  rules_medium — corroborated
 *                           (≥2 distinct evidence families, gap ≥ 6,
 *                            runner-up has no high-precision signal, no blocker)
 *   Gate 4  rules_low    — weak deterministic
 *                           (winner has ≥1 high-precision signal, all other
 *                            categories have only weak_context / weak_stem /
 *                            description / source_prior, no blocker)
 *   needs_ai             — otherwise
 *
 * Between Gate 1 (if it failed) and Gate 2 the pairwise disambiguator
 * matrix runs when top1 − top2 ≤ 5 and the pair is registered. The
 * disambiguator may override `top` (without mutating scores).
 *
 * Description alone can never open any gate — enforced inside every gate
 * predicate by requiring at least one title-level precision evidence.
 * Sonstiges is never a scoring participant; it only returns as a final
 * fallback when `topScore === 0`.
 */

import type { Category, CategoryCandidate } from '@/types/events';
import type { NormalizedInput } from './normalization';
import { CLASSIFIER_VERSION } from './taxonomy';
import {
  aggregate,
  extractSignals,
  type AggregatedScore,
} from './signals';
import { DISAMBIGUATOR_PAIRS } from './rules';

export type GateId = 'gate1_trusted' | 'gate2_single_precise' | 'gate3_corroborated' | 'gate4_weak_deterministic' | 'needs_ai';

export interface DeterministicResult {
  category: Category;
  tags: Category[];
  confidence: 'rules_exact' | 'rules_high' | 'rules_medium' | 'rules_low';
  source: 'rules';
  version: string;
  candidates: CategoryCandidate[];
  reason: string;
  gate: GateId;
  disambiguatorFired: boolean;
  needsReview: boolean;
  inputHash: string;
  needsAi: false;
}

export interface NeedsAiResult {
  provisionalCategory: Category;
  provisionalTags: Category[];
  candidates: CategoryCandidate[];
  reason: string;
  gate: 'needs_ai';
  disambiguatorFired: boolean;
  inputHash: string;
  topScore: number;
  gap: number;
  needsAi: true;
}

export type ClassifierDecision = DeterministicResult | NeedsAiResult;

/** Gate 3 gap threshold. Gate 1/2/4 use structural exclusivity, not gap. */
export const GATE3_MIN_GAP = 6;
/** Disambiguator trigger: only run when top1 − top2 ≤ this. */
export const DISAMBIGUATOR_MAX_GAP = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────

function toCandidates(scores: AggregatedScore[]): CategoryCandidate[] {
  return scores
    .filter(s => s.score > 0)
    .slice(0, 5)
    .map(s => ({
      category: s.category,
      score: s.score,
      evidence: s.evidence.map(e => `${e.family}:${e.kind}:${e.source}`),
    }));
}

function pickTop(scores: AggregatedScore[]): AggregatedScore | null {
  // Scores are already sorted descending by `aggregate`.
  if (scores.length === 0) return null;
  if (scores[0].score <= 0) return null;
  return scores[0];
}

function findRunnerUp(scores: AggregatedScore[], top: AggregatedScore): AggregatedScore | null {
  for (const s of scores) {
    if (s.category !== top.category) return s;
  }
  return null;
}

function hasTrustedExactFor(category: Category, scores: AggregatedScore[]): boolean {
  const s = scores.find(x => x.category === category);
  return !!s && s.evidence.some(e => e.family === 'trusted_raw_tag' || e.family === 'trusted_source');
}

function trustedMapConflicts(top: AggregatedScore, scores: AggregatedScore[]): boolean {
  // True if a trusted signal exists for a category OTHER than the top.
  for (const s of scores) {
    if (s.category === top.category) continue;
    const trusted = s.evidence.some(e => e.family === 'trusted_raw_tag' || e.family === 'trusted_source');
    if (trusted) return true;
  }
  return false;
}

/** Does any non-top category have title_precision evidence? */
function otherHasTitlePrecision(top: AggregatedScore, scores: AggregatedScore[]): boolean {
  return scores.some(s => s.category !== top.category && s.titlePrecisionCount > 0);
}

/**
 * Collect secondary tags for the final result. A tag is included when it
 * has at least one high-precision evidence (phrase/pattern/token) OR a
 * trusted raw-tag OR a trusted source prior, AND it's not blocked, AND
 * it's different from primary. Up to N.
 */
function collectSecondaryTags(primary: Category, scores: AggregatedScore[], max: number): Category[] {
  const out: Category[] = [];
  for (const s of scores) {
    if (s.category === primary) continue;
    if (s.hasBlocker) continue;
    const strong = s.evidence.some(e =>
      e.family === 'trusted_raw_tag' ||
      e.family === 'trusted_source' ||
      e.family === 'title_precision' ||
      e.family === 'raw_tag_match',
    );
    if (strong && !out.includes(s.category)) out.push(s.category);
    if (out.length >= max) break;
  }
  return out;
}

function runDisambiguator(norm: NormalizedInput, scores: AggregatedScore[]): Category | null {
  const top = pickTop(scores);
  if (!top) return null;
  const runner = findRunnerUp(scores, top);
  if (!runner) return null;
  const gap = top.score - runner.score;
  if (gap > DISAMBIGUATOR_MAX_GAP) return null;

  for (const d of DISAMBIGUATOR_PAIRS) {
    const [a, b] = d.pair;
    const pairMatches =
      (top.category === a && runner.category === b) ||
      (top.category === b && runner.category === a);
    if (!pairMatches) continue;
    const picked = d.resolve({
      title: norm.title,
      description: norm.description,
      sourceName: norm.sourceName,
      organizer: norm.organizer,
    });
    if (picked === a || picked === b) return picked;
  }
  return null;
}

function reasonFrom(
  gate: GateId,
  chosen: AggregatedScore,
  runnerUp: AggregatedScore | null,
  disambiguatorFired: boolean,
): string {
  const ev = chosen.evidence.map(e => e.family).reduce<Record<string, number>>((acc, k) => {
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const evStr = Object.entries(ev).map(([k, v]) => `${k}×${v}`).join(', ');
  const gap = runnerUp ? chosen.score - runnerUp.score : chosen.score;
  const disambig = disambiguatorFired ? ' [disambig:' + chosen.category + ']' : '';
  return `${gate}: ${chosen.category}@${chosen.score} gap=${gap} [${evStr}]${disambig}`;
}

// ─── Main entry point ────────────────────────────────────────────────────

export function decideDeterministic(norm: NormalizedInput): ClassifierDecision {
  const signals = extractSignals(norm);
  const scores = aggregate(signals);
  const candidates = toCandidates(scores);

  const topInitial = pickTop(scores);
  if (!topInitial) {
    return {
      provisionalCategory: 'Sonstiges',
      provisionalTags: ['Sonstiges'],
      candidates,
      reason: 'needs_ai: no evidence from rules',
      gate: 'needs_ai',
      disambiguatorFired: false,
      inputHash: norm.inputHash,
      topScore: 0,
      gap: 0,
      needsAi: true,
    };
  }

  // ----- Gate 1 — trusted exact -----------------------------------------
  const topHasTrustedExact = hasTrustedExactFor(topInitial.category, scores);
  const topHasBlocker = topInitial.hasBlocker;
  const conflict = trustedMapConflicts(topInitial, scores);

  if (topHasTrustedExact && !topHasBlocker && !conflict) {
    const runner = findRunnerUp(scores, topInitial);
    return {
      category: topInitial.category,
      tags: [topInitial.category, ...collectSecondaryTags(topInitial.category, scores, 2)],
      confidence: 'rules_exact',
      source: 'rules',
      version: CLASSIFIER_VERSION,
      candidates,
      reason: reasonFrom('gate1_trusted', topInitial, runner, false),
      gate: 'gate1_trusted',
      disambiguatorFired: false,
      needsReview: false,
      inputHash: norm.inputHash,
      needsAi: false,
    };
  }

  // ----- Disambiguator pass (only when Gate 1 failed) -------------------
  let disambiguatorFired = false;
  let effectiveTop = topInitial;
  const picked = runDisambiguator(norm, scores);
  if (picked) {
    const pickedScore = scores.find(s => s.category === picked);
    if (pickedScore && pickedScore.score > 0) {
      effectiveTop = pickedScore;
      disambiguatorFired = true;
    }
  }

  const effectiveTopHasBlocker = effectiveTop.hasBlocker;
  const runnerUp = findRunnerUp(scores, effectiveTop);
  const gap = runnerUp ? effectiveTop.score - runnerUp.score : effectiveTop.score;

  // ----- Gate 2 — single precise winner ---------------------------------
  if (
    effectiveTop.titlePrecisionCount >= 1 &&
    !otherHasTitlePrecision(effectiveTop, scores) &&
    !effectiveTopHasBlocker
  ) {
    return {
      category: effectiveTop.category,
      tags: [effectiveTop.category, ...collectSecondaryTags(effectiveTop.category, scores, 2)],
      confidence: 'rules_high',
      source: 'rules',
      version: CLASSIFIER_VERSION,
      candidates,
      reason: reasonFrom('gate2_single_precise', effectiveTop, runnerUp, disambiguatorFired),
      gate: 'gate2_single_precise',
      disambiguatorFired,
      needsReview: false,
      inputHash: norm.inputHash,
      needsAi: false,
    };
  }

  // ----- Gate 3 — corroborated medium -----------------------------------
  const runnerUpHasTitlePrecision = runnerUp ? runnerUp.titlePrecisionCount > 0 : false;
  if (
    effectiveTop.familyCount >= 2 &&
    effectiveTop.titlePrecisionCount >= 1 &&
    gap >= GATE3_MIN_GAP &&
    !effectiveTopHasBlocker &&
    !runnerUpHasTitlePrecision
  ) {
    return {
      category: effectiveTop.category,
      tags: [effectiveTop.category, ...collectSecondaryTags(effectiveTop.category, scores, 2)],
      confidence: 'rules_medium',
      source: 'rules',
      version: CLASSIFIER_VERSION,
      candidates,
      reason: reasonFrom('gate3_corroborated', effectiveTop, runnerUp, disambiguatorFired),
      gate: 'gate3_corroborated',
      disambiguatorFired,
      needsReview: false,
      inputHash: norm.inputHash,
      needsAi: false,
    };
  }

  // ----- Gate 4 — weak deterministic ------------------------------------
  // Winner must have ≥1 title-precision; others may have only weak families.
  const othersOnlyWeak = scores.every(s => {
    if (s.category === effectiveTop.category) return true;
    if (s.score <= 0) return true;
    return s.titlePrecisionCount === 0;
  });
  if (
    effectiveTop.titlePrecisionCount >= 1 &&
    othersOnlyWeak &&
    !effectiveTopHasBlocker
  ) {
    return {
      category: effectiveTop.category,
      tags: [effectiveTop.category, ...collectSecondaryTags(effectiveTop.category, scores, 2)],
      confidence: 'rules_low',
      source: 'rules',
      version: CLASSIFIER_VERSION,
      candidates,
      reason: reasonFrom('gate4_weak_deterministic', effectiveTop, runnerUp, disambiguatorFired),
      gate: 'gate4_weak_deterministic',
      disambiguatorFired,
      needsReview: false,
      inputHash: norm.inputHash,
      needsAi: false,
    };
  }

  // ----- Otherwise: needs AI -------------------------------------------
  const provisionalTags: Category[] = [effectiveTop.category, ...collectSecondaryTags(effectiveTop.category, scores, 2)];
  return {
    provisionalCategory: effectiveTop.category,
    provisionalTags,
    candidates,
    reason: `needs_ai: top=${effectiveTop.category}@${effectiveTop.score} gap=${gap} ` +
      (effectiveTopHasBlocker ? '[blocker] ' : '') +
      (conflict ? '[trusted-conflict] ' : '') +
      (runnerUpHasTitlePrecision ? '[runner-precision] ' : '') +
      (effectiveTop.titlePrecisionCount === 0 ? '[no-title-precision]' : ''),
    gate: 'needs_ai',
    disambiguatorFired,
    inputHash: norm.inputHash,
    topScore: effectiveTop.score,
    gap,
    needsAi: true,
  };
}
