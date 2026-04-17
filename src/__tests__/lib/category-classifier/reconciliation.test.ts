import { describe, it, expect } from 'vitest';
import {
  categoryConfidenceRank,
  CATEGORY_CONFIDENCE_RANK,
  CLASSIFIER_VERSION,
} from '@/lib/category-classifier';

describe('confidence rank precedence', () => {
  it('manual < rules_high < rules_medium < ai < ai_low < NULL', () => {
    expect(CATEGORY_CONFIDENCE_RANK.manual).toBeLessThan(CATEGORY_CONFIDENCE_RANK.rules_high);
    expect(CATEGORY_CONFIDENCE_RANK.rules_high).toBeLessThan(CATEGORY_CONFIDENCE_RANK.rules_medium);
    expect(CATEGORY_CONFIDENCE_RANK.rules_medium).toBeLessThan(CATEGORY_CONFIDENCE_RANK.ai);
    expect(CATEGORY_CONFIDENCE_RANK.ai).toBeLessThan(CATEGORY_CONFIDENCE_RANK.ai_low);
    expect(categoryConfidenceRank(null)).toBe(Infinity);
    expect(categoryConfidenceRank('unknown')).toBe(Infinity);
  });

  it('ai (rank 3) outranks ai_low (rank 4) so new ai_low cannot replace ai', () => {
    const existingRank = categoryConfidenceRank('ai');
    const newRank = categoryConfidenceRank('ai_low');
    expect(existingRank).toBeLessThan(newRank);
  });

  it('rules_high (rank 1) outranks ai (rank 3) so rules_high replaces ai', () => {
    expect(categoryConfidenceRank('rules_high')).toBeLessThan(categoryConfidenceRank('ai'));
  });

  it('manual is never replaced by any auto source', () => {
    expect(categoryConfidenceRank('manual')).toBe(0);
    for (const other of ['rules_high', 'rules_medium', 'ai', 'ai_low']) {
      expect(categoryConfidenceRank(other)).toBeGreaterThan(0);
    }
  });
});

describe('classifier version', () => {
  it('CLASSIFIER_VERSION is non-empty and stable', () => {
    expect(CLASSIFIER_VERSION).toMatch(/^cat-v\d+$/);
  });
});
