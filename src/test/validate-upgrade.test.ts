/**
 * Tests for validateAndUpgradeImageUrl (fn-14.5).
 *
 * Mocks fetch so we don't hit the network. Covers:
 *   - unknown CDN → return original URL + extracted dims
 *   - known CDN + 200 image/* → switch to upgraded URL
 *   - known CDN + 404 → fall back to original
 *   - known CDN + non-image content-type → fall back
 *   - already-large URL → no-op
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateAndUpgradeImageUrl } from '@/lib/event-images/validate-upgrade';

describe('validateAndUpgradeImageUrl (fn-14.5)', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it('returns original URL for unknown CDN (no fetch)', async () => {
    const result = await validateAndUpgradeImageUrl('https://random.example.com/photo.jpg');
    expect(result.url).toBe('https://random.example.com/photo.jpg');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('extracts pattern dims from original URL even when no CDN handler matches', async () => {
    // URL matches no allowlisted CDN — but Imgix-style w/h pattern can
    // still be extracted by extractDimsFromUrl from query params.
    const result = await validateAndUpgradeImageUrl(
      'https://random.example.com/photo.jpg?w=1200&h=800',
    );
    expect(result.url).toBe('https://random.example.com/photo.jpg?w=1200&h=800');
    expect(result.width).toBe(1200);
    expect(result.height).toBe(800);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('upgrades Cloudinary URL on 200 + image/* HEAD', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }));
    const result = await validateAndUpgradeImageUrl(
      'https://res.cloudinary.com/demo/image/upload/w_400/photo.jpg',
    );
    expect(result.url).toContain('w_2000');
    expect(result.width).toBe(2000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to original URL on 404', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const result = await validateAndUpgradeImageUrl(
      'https://res.cloudinary.com/demo/image/upload/w_400/photo.jpg',
    );
    expect(result.url).toBe('https://res.cloudinary.com/demo/image/upload/w_400/photo.jpg');
    expect(result.width).toBe(400); // pattern-extracted dims preserved
  });

  it('falls back to original URL on non-image content-type', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, {
      status: 200,
      headers: { 'content-type': 'text/html' },
    }));
    const result = await validateAndUpgradeImageUrl(
      'https://res.cloudinary.com/demo/image/upload/w_400/photo.jpg',
    );
    expect(result.url).toBe('https://res.cloudinary.com/demo/image/upload/w_400/photo.jpg');
  });

  it('falls back to original URL on network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('boom'));
    const result = await validateAndUpgradeImageUrl(
      'https://res.cloudinary.com/demo/image/upload/w_400/photo.jpg',
    );
    expect(result.url).toBe('https://res.cloudinary.com/demo/image/upload/w_400/photo.jpg');
  });

  it('preserves caller-supplied width/height when no pattern dims exist', async () => {
    const result = await validateAndUpgradeImageUrl(
      'https://random.example.com/photo.jpg',
      1024,
      768,
    );
    expect(result.width).toBe(1024);
    expect(result.height).toBe(768);
  });

  it('persists ONLY upgraded-URL dims; never carries pre-upgrade height (Codex regression test)', async () => {
    // Cloudinary drops `h_300` when bumping to w_2000 — we must not
    // persist (2000 × 300) impossible metadata, AND we must not
    // synthesise a "scaled" height because Cloudinary's `c_fill`
    // semantics mean the upgrade renders at the source's native
    // ratio, not the derivative crop's. The only safe answer is
    // width=2000, height=undefined.
    fetchSpy.mockResolvedValueOnce(new Response(null, {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }));
    const result = await validateAndUpgradeImageUrl(
      'https://res.cloudinary.com/demo/image/upload/w_400,h_300/foo.jpg',
    );
    expect(result.url).toContain('w_2000');
    expect(result.width).toBe(2000);
    expect(result.height).toBeUndefined();
  });

  it('omits height entirely when the upgraded URL has only a width', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }));
    const result = await validateAndUpgradeImageUrl(
      'https://res.cloudinary.com/demo/image/upload/w_400/foo.jpg',
    );
    expect(result.url).toContain('w_2000');
    expect(result.width).toBe(2000);
    expect(result.height).toBeUndefined();
  });

  it('ignores caller-supplied original dims for upgraded URLs (no synthesis)', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }));
    // Even when caller supplies the full original ratio, we do NOT
    // synthesise an upgraded height — Cloudinary's c_fill makes the
    // ratio of the original derivative meaningless on the new URL.
    const result = await validateAndUpgradeImageUrl(
      'https://res.cloudinary.com/demo/image/upload/w_400/foo.jpg',
      400,
      300,
    );
    expect(result.width).toBe(2000);
    expect(result.height).toBeUndefined();
  });

  it('does NOT scale dims for WordPress strip-suffix (master crop may differ)', async () => {
    // Codex regression: wp `-400x300` derivative may be a crop of a
    // master with a completely different aspect ratio. Stamping the
    // master URL with the thumbnail dims (400×300) or scaling them
    // would both be wrong. Width and height must come out undefined.
    fetchSpy.mockResolvedValueOnce(new Response(null, {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }));
    const result = await validateAndUpgradeImageUrl(
      'https://example.com/wp-content/uploads/2024/01/photo-400x300.jpg',
      400,  // caller-supplied dims (e.g. listing-page thumbnail attrs)
      300,
    );
    expect(result.url).toBe('https://example.com/wp-content/uploads/2024/01/photo.jpg');
    expect(result.width).toBeUndefined();
    expect(result.height).toBeUndefined();
    expect(result.upgraded).toBe(true);
  });

  it('blocks SSRF: never HEAD-probes loopback addresses (Codex regression test)', async () => {
    // Scraped page could embed http://127.0.0.1/wp-content/uploads/..
    // The WordPress handler matches by path, so without an SSRF guard
    // we'd happily probe localhost. The guard must reject before
    // touching fetch.
    const result = await validateAndUpgradeImageUrl(
      'http://127.0.0.1/wp-content/uploads/photo-400x300.jpg',
    );
    // HEAD-check must have failed → fall back to original URL.
    expect(result.url).toBe('http://127.0.0.1/wp-content/uploads/photo-400x300.jpg');
    expect(result.upgraded).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks SSRF: rejects link-local addresses (AWS metadata 169.254.169.254)', async () => {
    const result = await validateAndUpgradeImageUrl(
      'http://169.254.169.254/wp-content/uploads/photo-400x300.jpg',
    );
    expect(result.upgraded).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks SSRF: rejects RFC1918 private addresses', async () => {
    const result = await validateAndUpgradeImageUrl(
      'http://10.0.0.1/wp-content/uploads/photo-400x300.jpg',
    );
    expect(result.upgraded).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks SSRF: rejects "localhost" hostname', async () => {
    const result = await validateAndUpgradeImageUrl(
      'http://localhost/wp-content/uploads/photo-400x300.jpg',
    );
    expect(result.upgraded).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
