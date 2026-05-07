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

  // Cloudinary URLs encode dims as `w_<n>` / `h_<n>` tokens inside a
  // slash-delimited, comma-separated transform list. The tokens may
  // appear anywhere in the list (e.g. `c_fill,w_800,h_600,q_auto`),
  // so we scan for `w_<n>` and `h_<n>` independently rather than
  // expecting a fixed pair pattern. Word-boundaries prevent matching
  // unrelated `*_w_…` or `…_w_…` substrings; the leading delimiter
  // can be `/` or `,`.
  const cloudinaryW = /[/,]w_(\d+)\b/i.exec(url);
  const cloudinaryH = /[/,]h_(\d+)\b/i.exec(url);
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

  // Cloudflare Images flexible-variant: `/w=2000` or `/w=2000,h=1500`
  // appended at the end of the path. Distinct from the Cloudinary
  // `w_NNN` underscore syntax — Cloudflare uses `=`.
  const cfMatch = /\/w=(\d+)(?:,h=(\d+))?(?:[/?#]|$)/i.exec(url);
  if (cfMatch) {
    return {
      width: parseInt(cfMatch[1], 10),
      ...(cfMatch[2] ? { height: parseInt(cfMatch[2], 10) } : {}),
    };
  }
  // Cloudflare Images flexible-variant: just `/h=NNN` (rare).
  const cfHMatch = /\/h=(\d+)(?:[/?#]|$)/i.exec(url);
  if (cfHMatch) {
    return { height: parseInt(cfHMatch[1], 10) };
  }

  // WordPress `-1200x800.jpg` size suffix immediately before the
  // extension. Allow common image extensions case-insensitively.
  const wp = /-(\d+)x(\d+)\.(?:jpe?g|png|webp|gif|avif)(?:\?.*)?$/i.exec(url);
  if (wp) {
    return { width: parseInt(wp[1], 10), height: parseInt(wp[2], 10) };
  }

  return {};
}
