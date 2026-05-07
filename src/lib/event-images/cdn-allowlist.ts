/**
 * CDN-Allowlist for image URL upgrades.
 *
 * Many CDNs encode the rendered dimensions in the URL itself (e.g.
 * Cloudinary `/w_400/`, Imgix `?w=400`, WordPress `-400x300.jpg`). This
 * module provides a sync-safe upgrade helper that rewrites such URLs to
 * request a larger variant — without touching the network — for known
 * CDNs only. Unknown hosts return null so the caller falls back to the
 * original URL untouched.
 *
 * Used by `validate-upgrade.ts` (async layer that HEAD-validates before
 * persisting the upgraded URL) and by `extract-dims-from-url.ts` (sync
 * dimension extractor used in supabase-sync to populate
 * image_width/image_height).
 *
 * Adding a new CDN: add a handler with a `match` predicate and an
 * `upgrade` rewriter. Keep handlers pure (no I/O), they run inside the
 * sync scrape path.
 */

interface CdnHandler {
  /** Short identifier for telemetry / logs. */
  name: string;
  /** Returns true when this handler can upgrade the URL. */
  match(url: string, hostname: string): boolean;
  /**
   * Rewrites the URL to request a larger variant.
   * Must be sync, must not throw — return original on failure.
   * `targetWidth` is a hint; handlers may pick the closest variant.
   */
  upgrade(url: string, targetWidth: number): string;
}

const TARGET_WIDTH = 2000;

/**
 * Cloudinary: URLs look like
 *   https://res.cloudinary.com/<cloud>/image/upload/<transforms>/<public_id>.<ext>
 * Transforms include `w_400`, `w_400,h_300`, `c_fill,w_800,h_600,q_auto`,
 * etc. We rewrite the width transform (or insert one if absent) to
 * request a larger image.
 */
const cloudinary: CdnHandler = {
  name: 'cloudinary',
  match: (_url, hostname) => /(?:^|\.)cloudinary\.com$/i.test(hostname),
  upgrade(url, targetWidth) {
    try {
      // Pattern: replace existing `w_<num>` (with optional `,h_<num>`) with
      // a larger width. We only rewrite when the existing width is below
      // the target; otherwise the URL is already large enough.
      return url.replace(/\/w_(\d+)(,h_(\d+))?\//, (full, w) => {
        const current = parseInt(w, 10);
        if (current >= targetWidth) return full;
        // Preserve the rest of the transform string by re-emitting only
        // `w_<target>` and dropping the `h_<...>` constraint so the
        // aspect ratio scales naturally.
        return `/w_${targetWidth}/`;
      });
    } catch {
      return url;
    }
  },
};

/**
 * Imgix: URLs are query-string driven, e.g.
 *   https://example.imgix.net/photo.jpg?w=400&h=300
 * We bump `w` (and drop `h`) to request a larger image while preserving
 * any other params (q, auto, fit, …).
 */
const imgix: CdnHandler = {
  name: 'imgix',
  match: (_url, hostname) => /\.imgix\.net$/i.test(hostname),
  upgrade(url, targetWidth) {
    try {
      const u = new URL(url);
      const currentW = parseInt(u.searchParams.get('w') || '0', 10);
      if (currentW > 0 && currentW >= targetWidth) return url;
      u.searchParams.set('w', String(targetWidth));
      // Drop height constraint; let the CDN preserve aspect ratio.
      u.searchParams.delete('h');
      return u.toString();
    } catch {
      return url;
    }
  },
};

/**
 * Cloudflare Images: URLs follow
 *   https://imagedelivery.net/<account>/<image-id>/<variant>
 * The trailing `<variant>` slug controls size. Variants are
 * account-specific, but `public` is the default and there's a
 * `width=<n>` flexible variant supported on all accounts. We rewrite
 * the trailing segment to `w=<targetWidth>` to opt into the flexible
 * sizing route.
 */
const cloudflareImages: CdnHandler = {
  name: 'cloudflare-images',
  match: (_url, hostname) => /^imagedelivery\.net$/i.test(hostname),
  upgrade(url, targetWidth) {
    try {
      // Replace the last path segment with `w=<targetWidth>`. Cloudflare
      // Images expects flexible-variants in the form `key=value,key=value`.
      return url.replace(/\/[^/?#]+(\?[^#]*)?(#.*)?$/, `/w=${targetWidth}$1$2`);
    } catch {
      return url;
    }
  },
};

/**
 * WordPress: WP rewrites uploaded images to size-suffixed filenames
 * like `photo-400x300.jpg`. The original is at `photo.jpg` (no suffix).
 * We strip the `-WxH` suffix to request the original. Only apply when
 * the URL clearly looks like a WordPress upload to avoid touching
 * unrelated `-NxN`-style filenames.
 */
const wordpress: CdnHandler = {
  name: 'wordpress',
  // wp-content path is canonical, .wp.com is jetpack/photon.
  match: (url) => /\/wp-content\/uploads\//i.test(url) || /\.wp\.com\//i.test(url),
  upgrade(url) {
    try {
      // Strip a trailing `-WxH` size suffix immediately before the file
      // extension. Allow common image extensions (jpg, jpeg, png, webp,
      // gif, avif) case-insensitively.
      return url.replace(/-(\d+)x(\d+)(\.(?:jpe?g|png|webp|gif|avif))(\?.*)?$/i, '$3$4');
    } catch {
      return url;
    }
  },
};

const HANDLERS: readonly CdnHandler[] = [
  cloudinary,
  imgix,
  cloudflareImages,
  wordpress,
];

/**
 * Returns an upgraded image URL if the host matches a known CDN AND the
 * upgrade actually changes the URL. Returns `null` for unknown CDNs or
 * when the URL is already at-target so callers can short-circuit (e.g.
 * skip the HEAD-validation roundtrip).
 *
 * Pure / sync. Never throws.
 */
export function tryUpgradeImageUrl(url: string, targetWidth: number = TARGET_WIDTH): string | null {
  if (!url || typeof url !== 'string') return null;

  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  for (const h of HANDLERS) {
    if (!h.match(url, hostname)) continue;
    const upgraded = h.upgrade(url, targetWidth);
    // Only return when the upgrade actually changed something — otherwise
    // there's nothing to validate.
    if (upgraded && upgraded !== url) {
      return upgraded;
    }
    return null;
  }
  return null;
}

/** Exposed for tests / introspection. */
export function listCdnHandlers(): readonly string[] {
  return HANDLERS.map(h => h.name);
}
