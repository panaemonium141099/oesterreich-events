import { createHash } from 'crypto';

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid',
  'ref', '_ga', '_gl',
]);

export function normalizeUrl(url: string): string | null {
  if (!url || url.length === 0) return null;
  try {
    const withScheme = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(withScheme.replace(/^http:\/\//, 'https://'));

    // Remove fragment
    parsed.hash = '';

    // Remove tracking params (whitelist-based)
    const params = new URLSearchParams(parsed.search);
    for (const key of [...params.keys()]) {
      if (TRACKING_PARAMS.has(key)) {
        params.delete(key);
      }
    }
    parsed.search = params.toString() ? `?${params.toString()}` : '';

    // Remove trailing slash (but not for root path)
    let result = parsed.toString();
    if (result.endsWith('/') && parsed.pathname !== '/') {
      result = result.slice(0, -1);
    }
    return result;
  } catch {
    return null;
  }
}

export function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}
