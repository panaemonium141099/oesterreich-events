import { describe, it, expect } from 'vitest';
import {
  categoryConfidenceRank,
  CATEGORY_CONFIDENCE_RANK,
  CLASSIFIER_VERSION,
} from '@/lib/category-classifier';

describe('confidence rank precedence', () => {
  it('manual < rules_exact < rules_high < rules_medium < rules_low < ai < ai_low < NULL', () => {
    expect(CATEGORY_CONFIDENCE_RANK.manual).toBeLessThan(CATEGORY_CONFIDENCE_RANK.rules_exact);
    expect(CATEGORY_CONFIDENCE_RANK.rules_exact).toBeLessThan(CATEGORY_CONFIDENCE_RANK.rules_high);
    expect(CATEGORY_CONFIDENCE_RANK.rules_high).toBeLessThan(CATEGORY_CONFIDENCE_RANK.rules_medium);
    expect(CATEGORY_CONFIDENCE_RANK.rules_medium).toBeLessThan(CATEGORY_CONFIDENCE_RANK.rules_low);
    expect(CATEGORY_CONFIDENCE_RANK.rules_low).toBeLessThan(CATEGORY_CONFIDENCE_RANK.ai);
    expect(CATEGORY_CONFIDENCE_RANK.ai).toBeLessThan(CATEGORY_CONFIDENCE_RANK.ai_low);
    expect(categoryConfidenceRank(null)).toBe(Infinity);
    expect(categoryConfidenceRank('unknown')).toBe(Infinity);
  });

  it('ai outranks ai_low so new ai_low cannot replace ai', () => {
    expect(categoryConfidenceRank('ai')).toBeLessThan(categoryConfidenceRank('ai_low'));
  });

  it('rules_exact outranks everything auto', () => {
    expect(categoryConfidenceRank('rules_exact')).toBeLessThan(categoryConfidenceRank('rules_high'));
    expect(categoryConfidenceRank('rules_exact')).toBeLessThan(categoryConfidenceRank('ai'));
  });

  it('rules_low (new weak-deterministic gate) outranks ai', () => {
    expect(categoryConfidenceRank('rules_low')).toBeLessThan(categoryConfidenceRank('ai'));
  });

  it('manual is never replaced by any auto source', () => {
    expect(categoryConfidenceRank('manual')).toBe(0);
    for (const other of ['rules_exact', 'rules_high', 'rules_medium', 'rules_low', 'ai', 'ai_low']) {
      expect(categoryConfidenceRank(other)).toBeGreaterThan(0);
    }
  });
});

describe('classifier version', () => {
  it('CLASSIFIER_VERSION is the compound cat-vN-rulesN-promptN form', () => {
    expect(CLASSIFIER_VERSION).toMatch(/^cat-v\d+-rules\d+-prompt\d+$/);
  });
});
