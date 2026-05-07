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
});
