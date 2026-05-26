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
  shouldOverwriteAddress,
} from '@/lib/db/upsert-guards';

describe('shouldOverwriteDescription re-sync path (2026-05-26)', () => {
  it('overwrites shorter text when old was unenriched (TVB correction)', () => {
    // Sanja Russegger case: TVB corrects "Frühschoppen wurde gestrichen".
    // New text may be shorter — must still propagate.
    const oldText = 'Die Trachtenmusikkapelle feiert. Danach gibt es einen Frühschoppen am Marktplatz.';
    const newText = 'Die Trachtenmusikkapelle feiert. Danach Hl. Messe.';
    expect(shouldOverwriteDescription(newText, oldText, null, null)).toBe(true);
  });
  it('keeps existing when new is identical', () => {
    const t = 'Identischer Text bleibt erhalten.';
    expect(shouldOverwriteDescription(t, t, null, null)).toBe(false);
  });
  it('still does NOT overwrite enriched description with shorter raw scrape', () => {
    const oldEnriched = 'Längerer, von Claude generierter, schöner Beschreibungstext mit Details.';
    const newScrape = 'Kurzer Listing-Text.';
    expect(shouldOverwriteDescription(newScrape, oldEnriched, null, 'claude-v1')).toBe(false);
  });
});

describe('shouldOverwriteAddress (don\'t-NULL-on-missing)', () => {
  it('keeps existing when new address is null', () => {
    expect(shouldOverwriteAddress(null, 'Hauptstraße 5')).toBe(false);
    expect(shouldOverwriteAddress(undefined, 'Hauptstraße 5')).toBe(false);
  });
  it('keeps existing when new address is whitespace', () => {
    expect(shouldOverwriteAddress('   ', 'Hauptstraße 5')).toBe(false);
  });
  it('writes new when existing is empty', () => {
    expect(shouldOverwriteAddress('Hauptstraße 5', null)).toBe(true);
    expect(shouldOverwriteAddress('Hauptstraße 5', '')).toBe(true);
  });
  it('writes new when both present (re-sync wins for listing field)', () => {
    expect(shouldOverwriteAddress('Hauptstraße 7', 'Hauptstraße 5')).toBe(true);
  });
});

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

  it('writes a HEAD-validated CDN upgrade even with unknown new dims (Codex WordPress regression)', () => {
    // WordPress strip-suffix: photo-400x300.jpg → photo.jpg. The
    // original loses its size suffix, so newWidth is null, but we
    // KNOW the URL was HEAD-validated to deliver a higher-res asset.
    // Without the validatedUpgrade signal the guard would reject this.
    expect(shouldUpgradeImage(
      'photo.jpg', null, null,
      'photo-400x300.jpg', 400, 300,
      true, // validatedUpgrade
    )).toBe(true);
  });

  it('still rejects a non-validated narrower-or-unknown replacement', () => {
    expect(shouldUpgradeImage(
      'tiny.jpg', null, null,
      'big.jpg', 1600, 1200,
      false, // not a validated upgrade
    )).toBe(false);
  });
});

describe('pickFinalImageWidth / pickFinalImageHeight (fn-14.5)', () => {
  it('on URL upgrade: takes new dim verbatim, never falls back to old', () => {
    // The old dim described the previous image — it's meaningless on
    // the new URL. Codex regression: a srcset upgrade that replaces
    // (small=400x300) with (large=1600w, no height) must NOT stamp
    // the new URL with the old 300 height.
    expect(pickFinalImageWidth(true, 1600, 400)).toBe(1600);
    expect(pickFinalImageWidth(true, null, 400)).toBeNull();
    expect(pickFinalImageHeight(true, null, 300)).toBeNull(); // never carry old over
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

  it('skips when new is only marginally longer AND old was enriched (protects claude-v1)', () => {
    const old = 'a'.repeat(100);
    const newer = 'a'.repeat(115);
    expect(shouldOverwriteDescription(newer, old, null, 'claude-v1')).toBe(false);
  });
  it('writes when both unenriched and texts differ (re-sync source-of-truth)', () => {
    // 2026-05-26 behaviour: when the existing description is unenriched, the
    // scraper IS the source of truth — any difference propagates.
    const old = 'a'.repeat(100);
    const newer = 'a'.repeat(115);
    expect(shouldOverwriteDescription(newer, old, null, null)).toBe(true);
  });

  it('writes when new comes from claude-v1 and old did not', () => {
    expect(shouldOverwriteDescription('newish', 'oldish', 'claude-v1', null)).toBe(true);
    expect(shouldOverwriteDescription('newish', 'oldish', 'claude-v1', 'openai-v1')).toBe(true);
  });

  it('skips claude-v1 → claude-v1 same-version write', () => {
    expect(shouldOverwriteDescription('newish', 'oldish', 'claude-v1', 'claude-v1')).toBe(false);
  });

  it('treats whitespace-only new description as absent (Codex regression test)', () => {
    expect(shouldOverwriteDescription('   ', null, null, null)).toBe(false);
    expect(shouldOverwriteDescription('   ', 'real description', null, null)).toBe(false);
  });

  it('compares against trimmed lengths when old is enriched (whitespace cannot win 20% rule)', () => {
    // Old has 100 real chars (enriched); new has 50 real chars + 200 spaces.
    // Trimmed-new < trimmed-old AND enriched → guard rejects.
    const oldDesc = 'a'.repeat(100);
    const newDesc = 'a'.repeat(50) + ' '.repeat(200);
    expect(shouldOverwriteDescription(newDesc, oldDesc, null, 'claude-v1')).toBe(false);
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

  it('treats whitespace-only new price as absent (Codex regression test)', () => {
    expect(shouldOverwritePrice('   ', null)).toBe(false);
    expect(shouldOverwritePrice('   ', '15 EUR')).toBe(false);
    // Even into an empty column, whitespace must not displace.
    expect(shouldOverwritePrice('   ', '')).toBe(false);
  });
});
