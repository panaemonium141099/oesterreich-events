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

import { tryUpgradeImageUrl } from './cdn-allowlist';
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

  const upgraded = tryUpgradeImageUrl(originalUrl);
  if (!upgraded) {
    // Unknown CDN or already-at-target — nothing to validate, return baseline.
    return baseline;
  }

  // The upgrade rewrote the URL; HEAD-check before adopting it.
  const isValid = await headCheckIsImage(upgraded);
  if (!isValid) {
    return baseline;
  }

  // Compute upgraded dims. CRITICAL: do NOT fall back to the
  // baseline (pre-upgrade) height when the upgraded URL has only a
  // width. Cloudinary/Imgix intentionally drop the `h` constraint so
  // the CDN re-derives the height from the original aspect ratio —
  // reusing the old `h_300` for a `w_2000` URL would persist
  // impossible metadata like (2000 × 300) and break aspect-ratio
  // rendering downstream.
  //
  // If we know the original aspect ratio (both old width and old
  // height), we scale the height proportionally. Otherwise we leave
  // height undefined and let the supabase-sync guard preserve any
  // pre-existing height column value (it won't NULL-clobber).
  const upgradedDims = extractDimsFromUrl(upgraded);
  const result: ValidatedImage = {
    url: upgraded,
    upgraded: true,
    ...(upgradedDims.width !== undefined ? { width: upgradedDims.width } : {}),
    ...(upgradedDims.height !== undefined ? { height: upgradedDims.height } : {}),
  };

  // Width fallback chain: explicit upgraded width → caller hint
  // (cleanWidth). Skip baselineDims.width because the URL change
  // means baseline width is now stale.
  if (result.width === undefined) {
    if (upgradedDims.width === undefined && cleanWidth !== undefined) {
      result.width = cleanWidth;
    }
  }

  // Height: scale from original aspect ratio when available. Both
  // baselineDims.width and baselineDims.height must be present for
  // the ratio to be meaningful.
  if (result.height === undefined && result.width !== undefined) {
    const oldW = baselineDims.width ?? cleanWidth;
    const oldH = baselineDims.height ?? cleanHeight;
    if (oldW && oldW > 0 && oldH && oldH > 0) {
      result.height = Math.round((oldH * result.width) / oldW);
    }
  }

  return result;
}
