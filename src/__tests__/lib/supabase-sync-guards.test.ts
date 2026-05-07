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
  shouldOverwriteDescription,
  shouldOverwritePrice,
} from '@/lib/db/upsert-guards';

describe('shouldUpgradeImage (fn-14.5 UPSERT-Guard)', () => {
  it('writes when there is no existing URL', () => {
    expect(shouldUpgradeImage('a.jpg', 800, null, null)).toBe(true);
  });

  it('skips when new URL is empty', () => {
    expect(shouldUpgradeImage(null, 800, 'a.jpg', 400)).toBe(false);
    expect(shouldUpgradeImage('', 800, 'a.jpg', 400)).toBe(false);
  });

  it('writes back when same URL but we now know dims', () => {
    expect(shouldUpgradeImage('a.jpg', 1200, 'a.jpg', null)).toBe(true);
  });

  it('skips when same URL and dims were already known', () => {
    expect(shouldUpgradeImage('a.jpg', 1200, 'a.jpg', 1200)).toBe(false);
    expect(shouldUpgradeImage('a.jpg', null, 'a.jpg', 1200)).toBe(false);
  });

  it('writes when existing has no width but a different new URL', () => {
    expect(shouldUpgradeImage('b.jpg', null, 'a.jpg', null)).toBe(true);
  });

  it('writes when new URL is wider', () => {
    expect(shouldUpgradeImage('big.jpg', 1600, 'small.jpg', 800)).toBe(true);
    expect(shouldUpgradeImage('eq.jpg', 800, 'small.jpg', 800)).toBe(true);
  });

  it('skips when new URL is narrower than existing', () => {
    expect(shouldUpgradeImage('small.jpg', 400, 'big.jpg', 1600)).toBe(false);
  });

  it('skips when new URL has unknown width but existing was wide', () => {
    expect(shouldUpgradeImage('unknown.jpg', null, 'big.jpg', 1600)).toBe(false);
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
