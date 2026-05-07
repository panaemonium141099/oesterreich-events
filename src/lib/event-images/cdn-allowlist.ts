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
 * Transforms are slash-separated; each transform is a comma-separated
 * list of `<key>_<value>` pairs, e.g.:
 *   `/w_400/`
 *   `/w_400,h_300/`
 *   `/c_fill,w_800,h_600,q_auto/`
 *   `/c_fill,w_800,h_600/v1234/`
 * We rewrite `w_<n>` wherever it appears in the comma-separated list,
 * leaving sibling transforms (c_fill, q_auto, …) intact, and drop
 * `h_<n>` from that same transform so the aspect ratio scales freely.
 */
const cloudinary: CdnHandler = {
  name: 'cloudinary',
  match: (_url, hostname) => /(?:^|\.)cloudinary\.com$/i.test(hostname),
  upgrade(url, targetWidth) {
    try {
      // Match a full slash-segment that contains `w_<n>` somewhere in
      // the comma-list. The replacement runs once per such segment
      // (most URLs only have one transform segment but Cloudinary
      // supports chains via multiple slashes).
      return url.replace(
        /\/([^/]*\bw_(\d+)[^/]*)\//g,
        (_full, segment: string, w: string) => {
          const current = parseInt(w, 10);
          if (current >= targetWidth) return `/${segment}/`;
          // Bump w_<n> in place; drop sibling h_<n> if present so the
          // aspect ratio is recomputed by the CDN.
          const bumped = segment
            .replace(/\bw_\d+\b/, `w_${targetWidth}`)
            .replace(/(^|,)h_\d+(?=,|$)/, '$1')
            .replace(/^,|,$/g, '')        // tidy stray leading/trailing commas
            .replace(/,,/g, ',');         // tidy double commas
          return `/${bumped}/`;
        },
      );
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
  // Hostname-restricted to mitigate DNS-rebind SSRF: an arbitrary
  // host with `/wp-content/uploads/` in the path could be the
  // attacker's domain pointing at internal infrastructure.
  // `*.wp.com` (Jetpack/Photon) is unambiguously a public CDN —
  // restrict upgrades to that suffix. Arbitrary self-hosted
  // WordPress URLs still pass through unchanged (no upgrade); they
  // were already being persisted as-is before fn-14.5.
  match: (_url, hostname) => /(?:^|\.)wp\.com$/i.test(hostname),
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
    // Only return when the upgrade actually changed something —
    // otherwise there's nothing to validate.
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
