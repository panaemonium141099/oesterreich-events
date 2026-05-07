/**
 * Tests for fn-14.5 image-quality helpers:
 *   - cdn-allowlist (sync URL upgrade for known CDNs)
 *   - extract-dims-from-url (sync dimension extraction)
 *   - srcset density / width parser (BaseScraper helper)
 */
import { describe, it, expect } from 'vitest';
import { tryUpgradeImageUrl, listCdnHandlers } from '@/lib/event-images/cdn-allowlist';
import { extractDimsFromUrl } from '@/lib/event-images/extract-dims-from-url';
import { pickLargestFromSrcset } from '@/lib/scrapers/BaseScraper';

describe('cdn-allowlist (fn-14.5)', () => {
  it('exposes at least 4 handlers (Cloudinary, Imgix, Cloudflare Images, WordPress)', () => {
    const handlers = listCdnHandlers();
    expect(handlers.length).toBeGreaterThanOrEqual(4);
    expect(handlers).toContain('cloudinary');
    expect(handlers).toContain('imgix');
    expect(handlers).toContain('cloudflare-images');
    expect(handlers).toContain('wordpress');
  });

  it('returns null for unknown CDNs', () => {
    expect(tryUpgradeImageUrl('https://random-cdn.example.com/photo.jpg')).toBeNull();
    expect(tryUpgradeImageUrl('https://google.com/foo.png')).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    expect(tryUpgradeImageUrl('not-a-url')).toBeNull();
    expect(tryUpgradeImageUrl('')).toBeNull();
  });

  it('upgrades small Cloudinary widths to a larger variant', () => {
    const upgraded = tryUpgradeImageUrl(
      'https://res.cloudinary.com/demo/image/upload/w_400/foo.jpg',
      2000,
    );
    expect(upgraded).toContain('w_2000');
    expect(upgraded).not.toContain('w_400');
  });

  it('drops the height constraint when bumping Cloudinary width', () => {
    const upgraded = tryUpgradeImageUrl(
      'https://res.cloudinary.com/demo/image/upload/w_400,h_300/foo.jpg',
      2000,
    );
    expect(upgraded).toContain('w_2000');
    expect(upgraded).not.toContain('h_300');
  });

  it('returns null when Cloudinary URL is already at-target width', () => {
    expect(tryUpgradeImageUrl(
      'https://res.cloudinary.com/demo/image/upload/w_2000/foo.jpg',
      2000,
    )).toBeNull();
  });

  it('upgrades Cloudinary transform chains and preserves sibling transforms', () => {
    const upgraded = tryUpgradeImageUrl(
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_800,h_600,q_auto/foo.jpg',
      2000,
    );
    expect(upgraded).toContain('w_2000');
    expect(upgraded).toContain('c_fill');
    expect(upgraded).toContain('q_auto');
    expect(upgraded).not.toContain('h_600');
    expect(upgraded).not.toContain('w_800');
  });

  it('upgrades Cloudinary chains with version segments', () => {
    const upgraded = tryUpgradeImageUrl(
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_400,h_300/v1234/foo.jpg',
      2000,
    );
    expect(upgraded).toContain('w_2000');
    expect(upgraded).toContain('v1234');
  });

  it('upgrades Imgix URLs by setting w=2000 and dropping h', () => {
    const upgraded = tryUpgradeImageUrl(
      'https://example.imgix.net/photo.jpg?w=400&h=300&q=80',
      2000,
    );
    expect(upgraded).toContain('w=2000');
    expect(upgraded).not.toContain('h=300');
    // Other params preserved
    expect(upgraded).toContain('q=80');
  });

  it('returns null for Imgix URL already at target width', () => {
    expect(tryUpgradeImageUrl(
      'https://example.imgix.net/photo.jpg?w=2000',
      2000,
    )).toBeNull();
  });

  it('upgrades Cloudflare Images flexible-variant URL', () => {
    const upgraded = tryUpgradeImageUrl(
      'https://imagedelivery.net/account/image-id/public',
      2000,
    );
    expect(upgraded).toContain('w=2000');
  });

  it('strips WordPress -WxH size suffix on self-hosted /wp-content/uploads/', () => {
    // Self-hosted WordPress is the dominant case (municipality sites,
    // BurgenlandWPEventsScraper). Path-based matching is needed. SSRF
    // protection is downstream in validate-upgrade (literal-IP, DNS,
    // redirect guards).
    const upgraded = tryUpgradeImageUrl(
      'https://example.com/wp-content/uploads/2024/01/photo-400x300.jpg',
    );
    expect(upgraded).toBe('https://example.com/wp-content/uploads/2024/01/photo.jpg');
  });

  it('strips WordPress -WxH suffix on *.wp.com (Jetpack/Photon)', () => {
    const upgraded = tryUpgradeImageUrl(
      'https://i0.wp.com/example.com/wp-content/uploads/2024/01/photo-400x300.jpg',
    );
    expect(upgraded).toBe('https://i0.wp.com/example.com/wp-content/uploads/2024/01/photo.jpg');
  });

  it('returns null when WordPress URL has no size suffix', () => {
    expect(tryUpgradeImageUrl(
      'https://example.com/wp-content/uploads/2024/01/photo.jpg',
    )).toBeNull();
  });
});

describe('extractDimsFromUrl (fn-14.5)', () => {
  it('returns empty object for null/undefined/empty', () => {
    expect(extractDimsFromUrl(null)).toEqual({});
    expect(extractDimsFromUrl(undefined)).toEqual({});
    expect(extractDimsFromUrl('')).toEqual({});
  });

  it('extracts width+height from Cloudinary /w_NNN,h_NNN/ pattern', () => {
    expect(extractDimsFromUrl(
      'https://res.cloudinary.com/demo/image/upload/w_1200,h_800/foo.jpg',
    )).toEqual({ width: 1200, height: 800 });
  });

  it('handles reversed Cloudinary order /h_NNN,w_NNN/', () => {
    expect(extractDimsFromUrl(
      'https://res.cloudinary.com/demo/image/upload/h_800,w_1200/foo.jpg',
    )).toEqual({ width: 1200, height: 800 });
  });

  it('extracts dims from Cloudinary transform chains (c_fill,w_NNN,h_NNN,q_auto)', () => {
    expect(extractDimsFromUrl(
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_800,h_600,q_auto/foo.jpg',
    )).toEqual({ width: 800, height: 600 });
  });

  it('extracts dims even when w_/h_ are not adjacent in the chain', () => {
    expect(extractDimsFromUrl(
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_800,q_auto,h_600/foo.jpg',
    )).toEqual({ width: 800, height: 600 });
  });

  it('extracts width-only from Cloudinary /w_NNN/', () => {
    expect(extractDimsFromUrl(
      'https://res.cloudinary.com/demo/image/upload/w_1200/foo.jpg',
    )).toEqual({ width: 1200 });
  });

  it('extracts width+height from Imgix query params', () => {
    expect(extractDimsFromUrl(
      'https://example.imgix.net/photo.jpg?w=1200&h=800',
    )).toEqual({ width: 1200, height: 800 });
  });

  it('extracts only width when only w= is present', () => {
    expect(extractDimsFromUrl(
      'https://example.imgix.net/photo.jpg?w=1200&q=80',
    )).toEqual({ width: 1200 });
  });

  it('extracts WordPress -WxH suffix dimensions', () => {
    expect(extractDimsFromUrl(
      'https://example.com/wp-content/uploads/photo-1200x800.jpg',
    )).toEqual({ width: 1200, height: 800 });
  });

  it('extracts Cloudflare Images flexible-variant /w=NNN (Codex regression test)', () => {
    expect(extractDimsFromUrl(
      'https://imagedelivery.net/account/image-id/w=2000',
    )).toEqual({ width: 2000 });
  });

  it('extracts Cloudflare Images /w=NNN,h=NNN combo', () => {
    expect(extractDimsFromUrl(
      'https://imagedelivery.net/account/image-id/w=2000,h=1500',
    )).toEqual({ width: 2000, height: 1500 });
  });

  it('handles WebP and AVIF extensions in WordPress pattern', () => {
    expect(extractDimsFromUrl(
      'https://example.com/wp-content/uploads/photo-1024x768.webp',
    )).toEqual({ width: 1024, height: 768 });
  });

  it('returns empty object for URLs without recognised patterns', () => {
    expect(extractDimsFromUrl(
      'https://example.com/photo.jpg',
    )).toEqual({});
  });
});

describe('pickLargestFromSrcset (fn-14.5)', () => {
  it('returns null on empty input', () => {
    expect(pickLargestFromSrcset('')).toBeNull();
  });

  it('picks largest by width descriptor', () => {
    expect(pickLargestFromSrcset('a.jpg 400w, b.jpg 800w, c.jpg 1600w'))
      .toEqual({ url: 'c.jpg', width: 1600 });
  });

  it('picks highest density when only x descriptors are present', () => {
    expect(pickLargestFromSrcset('a.jpg 1x, b.jpg 2x, c.jpg 3x'))
      .toEqual({ url: 'c.jpg', density: 3 });
  });

  it('handles fractional density descriptors (1.5x)', () => {
    expect(pickLargestFromSrcset('a.jpg 1x, b.jpg 1.5x, c.jpg 2x'))
      .toEqual({ url: 'c.jpg', density: 2 });
  });

  it('prefers width over density when both are mixed', () => {
    expect(pickLargestFromSrcset('a.jpg 2x, b.jpg 1200w'))
      .toEqual({ url: 'b.jpg', width: 1200 });
  });

  it('treats missing descriptor as 1x (lowest density)', () => {
    expect(pickLargestFromSrcset('a.jpg, b.jpg 2x'))
      .toEqual({ url: 'b.jpg', density: 2 });
  });

  it('handles Cloudinary URLs with embedded commas (Codex regression test)', () => {
    // Cloudinary's `c_fill,w_800,h_600/...` paths embed commas in
    // the URL itself. A naïve split(',') chops the URL apart and
    // emits garbage. The tokeniser must re-glue fragments until a
    // valid trailing descriptor is seen.
    const srcset = [
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_400,h_300/photo.jpg 400w',
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_800,h_600/photo.jpg 800w',
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_1600,h_1200/photo.jpg 1600w',
    ].join(', ');
    expect(pickLargestFromSrcset(srcset)).toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/c_fill,w_1600,h_1200/photo.jpg',
      width: 1600,
    });
  });

  it('handles a single Cloudinary URL with commas and no descriptor', () => {
    expect(pickLargestFromSrcset(
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_800/photo.jpg',
    )).toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/c_fill,w_800/photo.jpg',
      density: 1,
    });
  });

  it('handles mixed comma-bearing URLs and density descriptors', () => {
    const srcset = [
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_400/photo.jpg 1x',
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_800/photo.jpg 2x',
    ].join(', ');
    expect(pickLargestFromSrcset(srcset)).toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/c_fill,w_800/photo.jpg',
      density: 2,
    });
  });
});
