/**
 * Sync helper that extracts (width, height) hints from CDN image URLs.
 *
 * Many image CDNs encode the rendered dimensions in the URL itself, so
 * we can populate `image_width` / `image_height` without a network
 * roundtrip. This is the cheap-and-deterministic counterpart to the
 * async HEAD-based `validateAndUpgradeImageUrl()` helper.
 *
 * Patterns recognised:
 *   - Cloudinary `/w_1200,h_800/` and `/w_1200/`
 *   - Imgix     `?w=1200&h=800`
 *   - WordPress `photo-1200x800.jpg`
 *
 * Returns an object with whichever dimensions were resolved.
 * Both fields are optional — partial extraction (only width, only
 * height) is permitted and downstream code persists what is available.
 *
 * Pure / sync. Never throws.
 */

export interface UrlDims {
  width?: number;
  height?: number;
}

/**
 * Extract width/height hints from an image URL based on common CDN
 * patterns. Returns an empty object when nothing matches.
 */
export function extractDimsFromUrl(url: string | null | undefined): UrlDims {
  if (!url || typeof url !== 'string') return {};

  // Cloudinary `/w_1200,h_800/` (both) — match first, beats single-param
  // pattern below.
  const cloudinaryBoth = /\/w_(\d+),h_(\d+)\//i.exec(url);
  if (cloudinaryBoth) {
    return { width: parseInt(cloudinaryBoth[1], 10), height: parseInt(cloudinaryBoth[2], 10) };
  }
  // Cloudinary `/h_800,w_1200/` (reversed order)
  const cloudinaryReversed = /\/h_(\d+),w_(\d+)\//i.exec(url);
  if (cloudinaryReversed) {
    return { width: parseInt(cloudinaryReversed[2], 10), height: parseInt(cloudinaryReversed[1], 10) };
  }
  // Cloudinary `/w_1200/` only
  const cloudinaryW = /\/w_(\d+)\//i.exec(url);
  // Cloudinary `/h_800/` only (rare but possible)
  const cloudinaryH = /\/h_(\d+)\//i.exec(url);
  if (cloudinaryW || cloudinaryH) {
    return {
      ...(cloudinaryW ? { width: parseInt(cloudinaryW[1], 10) } : {}),
      ...(cloudinaryH ? { height: parseInt(cloudinaryH[1], 10) } : {}),
    };
  }

  // Imgix-style query params (`?w=1200&h=800`). Use URL parsing for
  // robust handling of encoded chars / param order.
  try {
    const u = new URL(url);
    const w = u.searchParams.get('w');
    const h = u.searchParams.get('h');
    if (w || h) {
      const result: UrlDims = {};
      if (w && /^\d+$/.test(w)) result.width = parseInt(w, 10);
      if (h && /^\d+$/.test(h)) result.height = parseInt(h, 10);
      if (result.width || result.height) return result;
    }
  } catch {
    // Not a parseable URL — fall through to other patterns.
  }

  // WordPress `-1200x800.jpg` size suffix immediately before the
  // extension. Allow common image extensions case-insensitively.
  const wp = /-(\d+)x(\d+)\.(?:jpe?g|png|webp|gif|avif)(?:\?.*)?$/i.exec(url);
  if (wp) {
    return { width: parseInt(wp[1], 10), height: parseInt(wp[2], 10) };
  }

  return {};
}
