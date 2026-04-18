import { describe, it, expect } from 'vitest';
import { reconcile, CLASSIFIER_VERSION, type ExistingCategoryRow } from '@/lib/category-classifier';

function make(existing: Partial<ExistingCategoryRow>): ExistingCategoryRow {
  return {
    category: null,
    tags: null,
    category_confidence: null,
    category_source: null,
    category_version: null,
    category_locked: false,
    category_needs_review: false,
    category_reason: null,
    category_candidates: null,
    ...existing,
  };
}

const incoming = (overrides: Partial<Parameters<typeof reconcile>[1]> = {}): Parameters<typeof reconcile>[1] => ({
  category: 'Musik',
  tags: ['Musik'],
  confidence: 'rules_high',
  source: 'rules',
  version: CLASSIFIER_VERSION,
  needsReview: false,
  reason: 'gate2',
  candidates: [],
  needsAi: false,
  ...overrides,
});

describe('reconcile overwrite semantics', () => {
  it('category_locked=true → KEEP existing, changed=false', () => {
    const existing = make({ category: 'Sport', category_confidence: 'manual', category_locked: true });
    const out = reconcile(existing, incoming());
    expect(out.category).toBe('Sport');
    expect(out.changed).toBe(false);
    expect(out.reconcileReason).toBe('locked');
  });

  it('manual confidence is untouchable', () => {
    const existing = make({ category: 'Sport', category_confidence: 'manual' });
    const out = reconcile(existing, incoming());
    expect(out.category).toBe('Sport');
    expect(out.changed).toBe(false);
    expect(out.reconcileReason).toBe('manual_untouchable');
  });

  it('incoming rules_high overwrites existing rules_medium (strictly better)', () => {
    const existing = make({ category: 'Kultur', category_confidence: 'rules_medium', category_version: CLASSIFIER_VERSION });
    const out = reconcile(existing, incoming());
    expect(out.category).toBe('Musik');
    expect(out.changed).toBe(true);
    expect(out.reconcileReason).toBe('strictly_better_new');
  });

  it('incoming rules_low does NOT overwrite existing ai on same category', () => {
    const existing = make({ category: 'Musik', category_confidence: 'ai', category_version: CLASSIFIER_VERSION });
    const out = reconcile(existing, incoming({ confidence: 'rules_low' }));
    expect(out.category_confidence).toBe('ai');
    expect(out.changed).toBe(false);
    expect(out.reconcileReason).toBe('ai_kept_no_downgrade');
  });

  it('incoming rules_low DOES overwrite existing ai on different category', () => {
    const existing = make({ category: 'Kultur', category_confidence: 'ai', category_version: CLASSIFIER_VERSION });
    const out = reconcile(existing, incoming({ confidence: 'rules_low' })); // Musik vs Kultur
    expect(out.category).toBe('Musik');
    expect(out.changed).toBe(true);
  });

  it('same rank + same version + same category → no-op', () => {
    const existing = make({
      category: 'Musik',
      tags: ['Musik'],
      category_confidence: 'rules_high',
      category_version: CLASSIFIER_VERSION,
    });
    const out = reconcile(existing, incoming());
    expect(out.changed).toBe(false);
    expect(out.reconcileReason).toBe('noop_same_rank_same_version');
  });

  it('incoming same rank but newer version → overwrite (version refresh)', () => {
    const existing = make({
      category: 'Musik',
      tags: ['Musik'],
      category_confidence: 'rules_high',
      category_version: 'cat-v1',
    });
    const out = reconcile(existing, incoming());
    expect(out.category_version).toBe(CLASSIFIER_VERSION);
    // changed can be true or false depending on tag equality; at minimum version refreshed.
  });

  it('incoming worse rank than existing → keep existing', () => {
    const existing = make({
      category: 'Musik',
      category_confidence: 'rules_exact',
      category_version: CLASSIFIER_VERSION,
    });
    const out = reconcile(existing, incoming({ confidence: 'rules_medium' }));
    expect(out.category_confidence).toBe('rules_exact');
    expect(out.changed).toBe(false);
  });

  it('ai_low never overwrites manual', () => {
    const existing = make({ category: 'Sport', category_confidence: 'manual' });
    const out = reconcile(existing, incoming({ confidence: 'ai_low' }));
    expect(out.category).toBe('Sport');
    expect(out.changed).toBe(false);
  });

  it('ai_low never overwrites rules_high', () => {
    const existing = make({
      category: 'Kultur',
      category_confidence: 'rules_high',
      category_version: CLASSIFIER_VERSION,
    });
    const out = reconcile(existing, incoming({ confidence: 'ai_low' }));
    expect(out.category_confidence).toBe('rules_high');
    expect(out.changed).toBe(false);
  });

  it('needs_ai incoming keeps existing row, refreshes version if newer', () => {
    const existing = make({
      category: 'Musik',
      category_confidence: 'ai',
      category_version: 'cat-v1',
    });
    const out = reconcile(existing, incoming({ needsAi: true, confidence: 'ai_low' }));
    expect(out.category).toBe('Musik');
    expect(out.category_confidence).toBe('ai');  // not replaced
    expect(out.category_version).toBe(CLASSIFIER_VERSION);
    expect(out.reconcileReason).toBe('version_refresh');
  });

  it('fresh row with no existing data → takes incoming', () => {
    const out = reconcile(null, incoming());
    expect(out.category).toBe('Musik');
    expect(out.changed).toBe(true);
    expect(out.reconcileReason).toBe('new_no_existing');
  });
});
