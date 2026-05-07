/**
 * Tests for fn-14.5 UPSERT-Guard predicates in supabase-sync.
 *
 * Imports the production predicates directly from
 * `src/lib/db/upsert-guards.ts` so any drift in the production code
 * fails this test instead of silently passing.
 */
import { describe, it, expect } from 'vitest';
import {
  shouldUpgradeImage,
  pickFinalImageWidth,
  pickFinalImageHeight,
  shouldOverwriteDescription,
  shouldOverwritePrice,
} from '@/lib/db/upsert-guards';

describe('shouldUpgradeImage (fn-14.5 UPSERT-Guard)', () => {
  it('writes when there is no existing URL', () => {
    expect(shouldUpgradeImage('a.jpg', 800, 600, null, null, null)).toBe(true);
  });

  it('skips when new URL is empty', () => {
    expect(shouldUpgradeImage(null, 800, 600, 'a.jpg', 400, 300)).toBe(false);
    expect(shouldUpgradeImage('', 800, 600, 'a.jpg', 400, 300)).toBe(false);
  });

  it('writes back when same URL but we now know width', () => {
    expect(shouldUpgradeImage('a.jpg', 1200, null, 'a.jpg', null, null)).toBe(true);
  });

  it('writes back when same URL but we now know height (Codex regression test)', () => {
    expect(shouldUpgradeImage('a.jpg', null, 800, 'a.jpg', 1200, null)).toBe(true);
  });

  it('skips when same URL and both dims were already known', () => {
    expect(shouldUpgradeImage('a.jpg', 1200, 800, 'a.jpg', 1200, 800)).toBe(false);
    expect(shouldUpgradeImage('a.jpg', null, null, 'a.jpg', 1200, 800)).toBe(false);
  });

  it('writes when existing has no width but a different new URL', () => {
    expect(shouldUpgradeImage('b.jpg', null, null, 'a.jpg', null, null)).toBe(true);
  });

  it('writes when new URL is wider', () => {
    expect(shouldUpgradeImage('big.jpg', 1600, 1200, 'small.jpg', 800, 600)).toBe(true);
    expect(shouldUpgradeImage('eq.jpg', 800, null, 'small.jpg', 800, null)).toBe(true);
  });

  it('skips when new URL is narrower than existing', () => {
    expect(shouldUpgradeImage('small.jpg', 400, 300, 'big.jpg', 1600, 1200)).toBe(false);
  });

  it('skips when new URL has unknown width but existing was wide', () => {
    expect(shouldUpgradeImage('unknown.jpg', null, null, 'big.jpg', 1600, 1200)).toBe(false);
  });
});

describe('pickFinalImageWidth / pickFinalImageHeight (fn-14.5)', () => {
  it('on URL upgrade: prefers new dim, falls back to existing if new is null', () => {
    expect(pickFinalImageWidth(true, 1600, 800)).toBe(1600);
    expect(pickFinalImageWidth(true, null, 800)).toBe(800);
    expect(pickFinalImageHeight(true, null, 600)).toBe(600); // Codex regression: don't NULL-clobber
    expect(pickFinalImageHeight(true, 1200, 600)).toBe(1200);
  });

  it('on URL keep: backfills missing existing dim from new', () => {
    expect(pickFinalImageWidth(false, 1200, null)).toBe(1200);
    expect(pickFinalImageHeight(false, 800, null)).toBe(800);
  });

  it('on URL keep: preserves existing dim when new is null', () => {
    expect(pickFinalImageWidth(false, null, 1200)).toBe(1200);
    expect(pickFinalImageHeight(false, null, 800)).toBe(800);
  });

  it('on URL keep: keeps existing dim when both are known (no needless re-write)', () => {
    expect(pickFinalImageWidth(false, 800, 1200)).toBe(1200);
    expect(pickFinalImageHeight(false, 600, 800)).toBe(800);
  });

  it('returns null when neither dim is known', () => {
    expect(pickFinalImageWidth(true, null, null)).toBeNull();
    expect(pickFinalImageHeight(false, null, null)).toBeNull();
  });
});

describe('shouldOverwriteDescription (fn-14.5 UPSERT-Guard)', () => {
  it('writes when existing is empty/null/whitespace', () => {
    expect(shouldOverwriteDescription('new', null, null, null)).toBe(true);
    expect(shouldOverwriteDescription('new', '', null, null)).toBe(true);
    expect(shouldOverwriteDescription('new', '   ', null, null)).toBe(true);
  });

  it('skips when new is empty/null', () => {
    expect(shouldOverwriteDescription(null, 'old', null, null)).toBe(false);
    expect(shouldOverwriteDescription('', 'old', null, null)).toBe(false);
  });

  it('writes when new is more than 20% longer', () => {
    const old = 'a'.repeat(100);
    const newer = 'a'.repeat(125);
    expect(shouldOverwriteDescription(newer, old, null, null)).toBe(true);
  });

  it('skips when new is only marginally longer (<= 20%)', () => {
    const old = 'a'.repeat(100);
    const newer = 'a'.repeat(115);
    expect(shouldOverwriteDescription(newer, old, null, null)).toBe(false);
  });

  it('writes when new comes from claude-v1 and old did not', () => {
    expect(shouldOverwriteDescription('newish', 'oldish', 'claude-v1', null)).toBe(true);
    expect(shouldOverwriteDescription('newish', 'oldish', 'claude-v1', 'openai-v1')).toBe(true);
  });

  it('skips claude-v1 → claude-v1 same-version write', () => {
    expect(shouldOverwriteDescription('newish', 'oldish', 'claude-v1', 'claude-v1')).toBe(false);
  });
});

describe('shouldOverwritePrice (fn-14.5 UPSERT-Guard)', () => {
  it('writes when existing price is empty/null/whitespace', () => {
    expect(shouldOverwritePrice('25 EUR', null)).toBe(true);
    expect(shouldOverwritePrice('25 EUR', '')).toBe(true);
    expect(shouldOverwritePrice('25 EUR', '   ')).toBe(true);
  });

  it('skips when new price is empty/null', () => {
    expect(shouldOverwritePrice(null, '15 EUR')).toBe(false);
    expect(shouldOverwritePrice('', '15 EUR')).toBe(false);
  });

  it('skips when existing already has a price', () => {
    expect(shouldOverwritePrice('25 EUR', '15 EUR')).toBe(false);
    expect(shouldOverwritePrice('Eintritt frei', 'Spende erbeten')).toBe(false);
  });
});
