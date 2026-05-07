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

/**
 * SSRF guard: reject URLs that point at private / loopback /
 * link-local / unspecified addresses, or use non-http(s) schemes.
 *
 * The CDN allowlist's WordPress handler matches by path
 * (`/wp-content/uploads/`), not hostname, so a scraped page can
 * embed an upgrade-eligible URL that resolves to internal
 * infrastructure (127.0.0.1, 169.254.169.254 — AWS metadata, etc.).
 * Without this guard, `validateAndUpgradeImageUrl()` would happily
 * issue HEAD probes to those hosts and leak whatever they expose.
 *
 * We only catch the literal-IP cases here. Hostname → private-IP
 * resolution is intentionally out of scope: it would require DNS
 * lookups in the sync path, and the operational risk we're guarding
 * against (attacker-supplied scrape URLs pointing at infrastructure)
 * is dominated by literal-IP forms.
 */
function isUnsafeUpgradeTarget(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  // Reject non-public schemes.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
  const host = parsed.hostname.toLowerCase();
  if (!host) return true;

  // Loopback / unspecified literals.
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    return true;
  }

  // IPv4 literal — check private / link-local / loopback / multicast / reserved ranges.
  const v4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4Match) {
    const a = parseInt(v4Match[1], 10);
    const b = parseInt(v4Match[2], 10);
    if (a === 10) return true;                      // 10.0.0.0/8 — private
    if (a === 127) return true;                     // 127.0.0.0/8 — loopback
    if (a === 169 && b === 254) return true;        // 169.254.0.0/16 — link-local (incl. AWS metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 — private
    if (a === 192 && b === 168) return true;        // 192.168.0.0/16 — private
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 — CGNAT
    if (a >= 224) return true;                      // 224.0.0.0/4 multicast + 240+ reserved
    if (a === 0) return true;                       // 0.0.0.0/8 — "this network"
    return false;
  }

  // IPv6 literal (bracketed in URL hostname) — basic checks for
  // common danger ranges. URL strips the brackets so we get the
  // address text directly.
  if (host.includes(':')) {
    if (host.startsWith('fc') || host.startsWith('fd')) return true; // fc00::/7 — ULA
    if (host.startsWith('fe80')) return true;                         // fe80::/10 — link-local
    if (host === '::' || host === '::1') return true;
  }

  return false;
}

/** HEAD-check used by the upgrade path. Mirrors `BaseScraper.validateImageUrl()`. */
async function headCheckIsImage(url: string, timeoutMs = HEAD_TIMEOUT_MS): Promise<boolean> {
  if (!url) return false;
  if (isUnsafeUpgradeTarget(url)) return false;
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

  const upgradedUrl = tryUpgradeImageUrl(originalUrl);
  if (!upgradedUrl) {
    // Unknown CDN or already-at-target — nothing to validate, return baseline.
    return baseline;
  }

  // The upgrade rewrote the URL; HEAD-check before adopting it.
  const isValid = await headCheckIsImage(upgradedUrl);
  if (!isValid) {
    return baseline;
  }

  // Compute upgraded dims. The cardinal rule: persist ONLY what the
  // upgraded URL itself encodes. Synthesising width/height from the
  // pre-upgrade variant is unsound:
  //
  // - Cloudinary `c_fill,w_400,h_300` is a 4:3 crop of an arbitrary
  //   source. When we drop `h` and request `w_2000`, the CDN
  //   renders at the SOURCE's native ratio (e.g. 16:9 → 2000×1125),
  //   NOT a scaled-up 4:3 crop. So scaling old 300 to a new 1500
  //   height would be wrong.
  // - Imgix `?w=400&h=300` has the same fit-mode ambiguity.
  // - WordPress strip-suffix points at a different crop entirely.
  //
  // The guarantee handlers DO give us is "the URL serves a higher-
  // res asset than the original" — that's enough for the UPSERT
  // guard to accept the upgrade, even with unknown dims. The
  // downstream renderer can fall back to intrinsic sizing.
  const upgradedDims = extractDimsFromUrl(upgradedUrl);
  return {
    url: upgradedUrl,
    upgraded: true,
    ...(upgradedDims.width !== undefined ? { width: upgradedDims.width } : {}),
    ...(upgradedDims.height !== undefined ? { height: upgradedDims.height } : {}),
  };
}
