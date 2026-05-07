/**
 * Async helper that conditionally upgrades an image URL via the CDN
 * allowlist and HEAD-validates the upgraded URL before returning it.
 *
 * Lives outside `BaseScraper` because the sync extract-path must stay
 * sync (302 scrapers depend on it). The supabase-sync layer is already
 * async and is the natural home for the network-touching upgrade step.
 *
 * Behaviour:
 *   1. Try `tryUpgradeImageUrl()`. If no handler matches → return
 *      original URL unchanged (with whatever dims were extracted from
 *      the URL pattern).
 *   2. If a handler returned an upgraded URL, fire a HEAD request with
 *      a short timeout. On 2xx + image content-type, switch to the
 *      upgraded URL and try to extract its dims.
 *   3. On 404 / non-image / network error / timeout, fall back to the
 *      original URL.
 *
 * This module never persists anything itself — the caller writes the
 * returned `{ url, width?, height? }` into the upsert payload.
 */

import { tryUpgradeImageUrlWithMeta } from './cdn-allowlist';
import { extractDimsFromUrl } from './extract-dims-from-url';

const HEAD_TIMEOUT_MS = 5000;
const USER_AGENT = 'BurgenlandEvents-ImageValidator/1.0 (educational project)';

export interface ValidatedImage {
  url: string;
  width?: number;
  height?: number;
  /**
   * True iff `url` is a HEAD-validated CDN-allowlist upgrade of the
   * caller's `originalUrl` (i.e. the URL was changed). Lets the
   * downstream UPSERT-guard accept the new URL even when its width
   * cannot be extracted (e.g. WordPress `-400x300` suffix strip
   * where the original size suffix is gone but the underlying file
   * is the higher-res master).
   */
  upgraded?: boolean;
}

/** HEAD-check used by the upgrade path. Mirrors `BaseScraper.validateImageUrl()`. */
async function headCheckIsImage(url: string, timeoutMs = HEAD_TIMEOUT_MS): Promise<boolean> {
  if (!url) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!response.ok) return false;
    const contentType = response.headers.get('content-type') || '';
    return contentType.startsWith('image/');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try to upgrade `originalUrl` via the CDN allowlist; on success +
 * positive HEAD-check, return the upgraded URL with extracted dims.
 * Otherwise return the original URL with whatever dims could be
 * extracted from it.
 *
 * Never throws; falls back to original URL on any error.
 *
 * @param originalUrl   Image URL to validate / upgrade.
 * @param originalWidth Optional pre-known width (e.g. from HTML
 *                      `width=` attr). Persisted as fallback when neither
 *                      pattern extraction nor upgrade yields a width.
 */
export async function validateAndUpgradeImageUrl(
  originalUrl: string,
  originalWidth?: number | null,
  originalHeight?: number | null,
): Promise<ValidatedImage> {
  const cleanWidth = typeof originalWidth === 'number' && originalWidth > 0 ? originalWidth : undefined;
  const cleanHeight = typeof originalHeight === 'number' && originalHeight > 0 ? originalHeight : undefined;

  if (!originalUrl) {
    return { url: '', ...(cleanWidth ? { width: cleanWidth } : {}), ...(cleanHeight ? { height: cleanHeight } : {}) };
  }

  // Pattern-extract dims from the original URL as a baseline. We'll
  // overwrite with upgraded-URL dims if/when we successfully switch.
  const baselineDims = extractDimsFromUrl(originalUrl);
  const baseline: ValidatedImage = {
    url: originalUrl,
    width: baselineDims.width ?? cleanWidth,
    height: baselineDims.height ?? cleanHeight,
  };

  const upgrade = tryUpgradeImageUrlWithMeta(originalUrl);
  if (!upgrade) {
    // Unknown CDN or already-at-target — nothing to validate, return baseline.
    return baseline;
  }

  // The upgrade rewrote the URL; HEAD-check before adopting it.
  const isValid = await headCheckIsImage(upgrade.url);
  if (!isValid) {
    return baseline;
  }

  // Compute upgraded dims. CRITICAL: do NOT fall back to the
  // baseline (pre-upgrade) dims when the upgraded URL has only a
  // width — those dims described the previous variant.
  //
  // For aspect-ratio-preserving handlers (Cloudinary, Imgix,
  // Cloudflare Images) we MAY scale the original height to the new
  // width, because the CDN guarantees the upgrade is just a resize
  // of the same source pixels.
  //
  // For handlers that do NOT preserve aspect ratio (WordPress
  // strip-suffix → master image, which can be an entirely different
  // crop), we leave height undefined. Persisting a scaled height
  // would be wrong; persisting the original height would be even
  // wronger.
  const upgradedDims = extractDimsFromUrl(upgrade.url);
  const result: ValidatedImage = {
    url: upgrade.url,
    upgraded: true,
    ...(upgradedDims.width !== undefined ? { width: upgradedDims.width } : {}),
    ...(upgradedDims.height !== undefined ? { height: upgradedDims.height } : {}),
  };

  // Width fallback chain only for aspect-ratio-preserving handlers
  // when no width could be extracted from the upgraded URL itself.
  // For non-AR-preserving handlers (WordPress) we deliberately leave
  // width undefined — the master is a different crop, the old
  // 400×300 thumbnail width has no relation to it.
  if (result.width === undefined && upgrade.preservesAspectRatio) {
    if (cleanWidth !== undefined) {
      result.width = cleanWidth;
    }
  }

  // Height scaling — only when handler preserves aspect ratio AND we
  // have the full original ratio.
  if (
    result.height === undefined &&
    result.width !== undefined &&
    upgrade.preservesAspectRatio
  ) {
    const oldW = baselineDims.width ?? cleanWidth;
    const oldH = baselineDims.height ?? cleanHeight;
    if (oldW && oldW > 0 && oldH && oldH > 0) {
      result.height = Math.round((oldH * result.width) / oldW);
    }
  }

  return result;
}
