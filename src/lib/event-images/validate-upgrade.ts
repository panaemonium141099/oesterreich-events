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

import * as dns from 'node:dns/promises';
import * as net from 'node:net';
import { tryUpgradeImageUrl } from './cdn-allowlist';
import { extractDimsFromUrl } from './extract-dims-from-url';

const HEAD_TIMEOUT_MS = 5000;
const USER_AGENT = 'BurgenlandEvents-ImageValidator/1.0 (educational project)';
const MAX_REDIRECTS = 3;

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
 * Reject an IPv4 literal in a private / loopback / link-local /
 * multicast / reserved range.
 */
function isUnsafeIpv4(host: string): boolean {
  const v4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!v4Match) return false;
  const a = parseInt(v4Match[1], 10);
  const b = parseInt(v4Match[2], 10);
  if (a === 10) return true;                           // 10.0.0.0/8 — private
  if (a === 127) return true;                          // 127.0.0.0/8 — loopback
  if (a === 169 && b === 254) return true;             // 169.254.0.0/16 — link-local (AWS metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;    // 172.16.0.0/12 — private
  if (a === 192 && b === 168) return true;             // 192.168.0.0/16 — private
  if (a === 100 && b >= 64 && b <= 127) return true;   // 100.64.0.0/10 — CGNAT
  if (a >= 224) return true;                           // 224.0.0.0/4 multicast + 240+ reserved
  if (a === 0) return true;                            // 0.0.0.0/8 — "this network"
  return false;
}

/**
 * Reject an IPv6 literal that points at loopback / link-local / ULA /
 * unspecified / multicast / IPv4-mapped private ranges. Accepts both
 * compact (`::1`) and exploded (`0:0:0:0:0:0:0:1`) forms.
 *
 * IPv4-mapped IPv6 (`::ffff:127.0.0.1`) is delegated to the IPv4
 * checker so loopback / private targets can't sneak through via
 * dual-stack syntax.
 */
function isUnsafeIpv6(host: string): boolean {
  // Strip brackets if URL kept them (rare with URL.hostname but
  // belt-and-suspenders for callers that use raw inputs).
  const stripped = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!stripped) return true;

  // IPv4-mapped: `::ffff:127.0.0.1`. Pull the trailing dotted-quad
  // and reuse the IPv4 checker.
  const v4Mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(stripped);
  if (v4Mapped) return isUnsafeIpv4(v4Mapped[1]);

  // Unspecified / loopback in any form.
  // Normalise `::` shorthand by counting hex groups: any all-zero
  // address is unspecified, and a hex form ending in `::1` (or
  // exploded `0:0:0:0:0:0:0:1`) is loopback.
  if (stripped === '::' || /^0(:0){0,7}$/.test(stripped)) return true;
  if (stripped === '::1' || /^0(:0){0,6}:1$/.test(stripped)) return true;

  // ULA (fc00::/7 — high bits 1111 110x → leading hex `fc` or `fd`).
  if (/^fc[0-9a-f]{2}:/.test(stripped) || /^fd[0-9a-f]{2}:/.test(stripped)) return true;

  // Link-local: fe80::/10 — leading 10 bits are `1111 1110 10`. In
  // practice all link-local addresses literally start with `fe80:`,
  // `fe9*:`, `fea*:`, or `feb*:` (covering the /10 range).
  if (/^fe[89ab][0-9a-f]:/i.test(stripped)) return true;

  // Multicast: ff00::/8 — leading byte ff.
  if (/^ff[0-9a-f]{2}:/.test(stripped)) return true;

  return false;
}

/**
 * Returns true when the literal IP / hostname looks unsafe to probe.
 * Used as the first sync-only filter; DNS-resolution SSRF is handled
 * separately by `isSafeToFetch()` via Node's resolver.
 */
function isUnsafeIpLiteral(host: string): boolean {
  if (!host) return true;
  const stripped = host.replace(/^\[|\]$/g, '');
  const lc = stripped.toLowerCase();
  if (lc === 'localhost') return true;

  const family = net.isIP(lc);
  if (family === 4) return isUnsafeIpv4(lc);
  if (family === 6) return isUnsafeIpv6(lc);
  return false;
}

/**
 * Sync-only structural validation: scheme + literal-IP / localhost
 * checks. Catches the obvious SSRF attempts without touching DNS.
 */
function isUnsafeUpgradeTarget(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
  return isUnsafeIpLiteral(parsed.hostname);
}

/**
 * Async DNS-based SSRF guard: resolve every A/AAAA record for the
 * URL's hostname and reject if ANY resolves to a private/loopback/
 * link-local/multicast/reserved address. Defends against
 * `attacker.example → 127.0.0.1` redirects that pass the literal-IP
 * check but still target internal infrastructure.
 *
 * Returns true when the hostname is safe to fetch.
 *
 * `dns.lookup` with `all: true` follows the system resolver (which
 * respects /etc/hosts), is fast in the typical "already cached" case,
 * and never throws — DNS failures return false (treat as unsafe).
 */
async function isSafeToFetch(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname;

  // Literal IPs / localhost are caught by the sync check first; this
  // call covers the DNS resolution path.
  if (isUnsafeIpLiteral(host)) return false;

  // If the host is already a literal IP, dns.lookup just echoes it
  // back — we already validated that above. Otherwise resolve.
  try {
    const addresses = await dns.lookup(host, { all: true });
    if (addresses.length === 0) return false;
    for (const addr of addresses) {
      if (isUnsafeIpLiteral(addr.address)) return false;
    }
    return true;
  } catch {
    // Resolution failure → treat as unsafe.
    return false;
  }
}

/**
 * HEAD-check with manual redirect handling so each hop is re-checked
 * by the SSRF guard. Mirrors `BaseScraper.validateImageUrl()` but
 * never trusts auto-redirects to a possibly-private target.
 */
async function headCheckIsImage(url: string, timeoutMs = HEAD_TIMEOUT_MS): Promise<boolean> {
  if (!url) return false;
  if (isUnsafeUpgradeTarget(url)) return false;
  if (!(await isSafeToFetch(url))) return false;

  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
        // CRITICAL: manual redirects so we can SSRF-validate every Location.
        redirect: 'manual',
      });
    } catch {
      clearTimeout(timer);
      return false;
    }
    clearTimeout(timer);

    // Direct 2xx with image content-type → success.
    if (response.status >= 200 && response.status < 300) {
      const contentType = response.headers.get('content-type') || '';
      return contentType.startsWith('image/');
    }

    // Redirect — extract Location and re-check.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return false;
      let nextUrl: string;
      try {
        nextUrl = new URL(location, currentUrl).toString();
      } catch {
        return false;
      }
      if (isUnsafeUpgradeTarget(nextUrl)) return false;
      if (!(await isSafeToFetch(nextUrl))) return false;
      currentUrl = nextUrl;
      continue;
    }

    // 4xx / 5xx etc. → not an image.
    return false;
  }

  // Exhausted redirect budget.
  return false;
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
