/**
 * Google Search Console API client.
 *
 * Provides three high-level queries the SEO dashboard + daily snapshot
 * cron both consume:
 *
 *  - `searchAnalytics({ startDate, endDate, dimensions })`
 *      The bread-and-butter Search Console query: impressions, clicks,
 *      CTR, avg position, sliced by any combination of query/page/
 *      country/device/date.
 *
 *  - `urlInspection(url)`
 *      Per-URL indexation status: "Indexed", "Not indexed — noindex
 *      detected", "Crawled — currently not indexed", etc. Rate-limited
 *      to 600/day by GSC, use sparingly (batch in the admin UI).
 *
 *  - `listSitemaps()`
 *      Lists the sitemaps GSC knows about + each sitemap's last-
 *      submitted/last-downloaded timestamps and indexed-URL count.
 *
 * **Auth** — Reuses the `GOOGLE_INDEXING_API_SA_KEY` service-account that
 * was set up for the Indexing API (fn-13 phase 1). The SAME JSON key
 * works for Search Console too — we just need the Search Console API
 * enabled in GCP and the service-account email added as a user on the
 * GSC property. See `docs/seo/gsc-setup.md` for the 2-step setup.
 *
 * The env var name is "INDEXING_API" historically but the key is a plain
 * Google Service Account — scope is granted at JWT-request time, not at
 * SA creation, so one key serves multiple APIs.
 *
 * **Why direct fetch over google-auth-library:** the auth-library pulls
 * in ~15 MB of deps and requires the legacy `googleapis` wrapper for
 * actual API calls. For two endpoints and 100 LoC of code the overhead
 * is not worth it — JWT → access token → fetch() is a few dozen lines.
 */

import { SignJWT, importPKCS8 } from 'jose';
import { requireGoogleServiceAccount, type GoogleServiceAccount } from '@/lib/google-auth';

// Search Console API uses TWO different path prefixes that share the
// same host:
//
//   /webmasters/v3/  → sites, searchAnalytics, sitemaps (the legacy
//                       Webmaster Tools API — rehomed under searchconsole.googleapis.com
//                       but the path kept its historical v3 shape)
//   /v1/             → urlInspection (the newer dedicated endpoint)
//
// Verified empirically 2026-04-24:
//   curl -H "Authorization: Bearer invalid" .../webmasters/v3/sites  → 401 (path exists)
//   curl -H "Authorization: Bearer invalid" .../v1/sites             → 404 HTML (path does not exist)
//
// An earlier revision used /v1/ for everything, which produced the
// user-visible "Search Console nicht erreichbar" 404 banner on the
// admin SEO dashboard. Keep these constants distinct so the right
// prefix lands on each call.
const GSC_HOST = 'https://searchconsole.googleapis.com';
const GSC_SITES_API = `${GSC_HOST}/webmasters/v3`;
const GSC_INSPECT_API = `${GSC_HOST}/v1`;
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

// ─────────────────────────────────────────────────────────────────
// Types — mirror the GSC REST API minus the undocumented/empty fields
// ─────────────────────────────────────────────────────────────────

// Re-exported alias so existing imports keep working; the shared loader
// in @/lib/google-auth owns the actual shape.
export type ServiceAccountKey = GoogleServiceAccount;

export interface SearchAnalyticsRow {
  keys: string[]; // order matches the `dimensions` request field
  clicks: number;
  impressions: number;
  ctr: number; // 0..1
  position: number; // avg SERP rank, 1.0 = top
}

export type SearchAnalyticsDimension =
  | 'query'
  | 'page'
  | 'country'
  | 'device'
  | 'date'
  | 'searchAppearance';

export interface SearchAnalyticsRequest {
  siteUrl: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;   // yyyy-mm-dd
  dimensions: SearchAnalyticsDimension[];
  rowLimit?: number; // max 25000 per API — we default to 1000 for UI widgets
  dataState?: 'all' | 'final'; // 'all' includes fresh/last-72h, 'final' excludes them
  dimensionFilterGroups?: Array<{
    filters: Array<{
      dimension: SearchAnalyticsDimension;
      operator: 'equals' | 'contains' | 'notEquals' | 'notContains' | 'includingRegex' | 'excludingRegex';
      expression: string;
    }>;
  }>;
}

export interface InspectionResult {
  indexStatusResult: {
    verdict: 'PASS' | 'FAIL' | 'PARTIAL' | 'NEUTRAL' | 'VERDICT_UNSPECIFIED';
    coverageState: string; // "Indexed" | "Crawled — not indexed" | ...
    robotsTxtState?: string;
    indexingState?: string;
    lastCrawlTime?: string;
    pageFetchState?: string;
    googleCanonical?: string;
    userCanonical?: string;
    referringUrls?: string[];
    sitemap?: string[];
    crawledAs?: string;
  };
  mobileUsabilityResult?: {
    verdict: string;
    issues?: Array<{ issueType: string; message: string; severity: string }>;
  };
}

export interface SitemapEntry {
  path: string; // sitemap URL
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  contents?: Array<{ type: string; submitted?: string; indexed?: string }>;
}

// ─────────────────────────────────────────────────────────────────
// Auth — service-account JWT → access token (cached for 50 min)
// ─────────────────────────────────────────────────────────────────

interface CachedToken {
  accessToken: string;
  expiresAt: number; // ms epoch
}
let tokenCache: CachedToken | null = null;

function getServiceAccountKey(): ServiceAccountKey {
  // Delegates to the shared loader in @/lib/google-auth — same robust
  // parse/repair logic that's battle-tested by the Indexing API. Handles
  // base64 form, literal \\n repair, Windows line endings, PEM trailing
  // newline, etc. Throws on miss so the caller can render a setup-banner.
  return requireGoogleServiceAccount();
}

async function getAccessToken(): Promise<string> {
  // 50-min TTL (access tokens expire at 60). Plenty of headroom for the
  // ~10 GSC calls our worst-case cron run makes.
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const sa = getServiceAccountKey();
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(sa.private_key, 'RS256');
  const jwt = await new SignJWT({ scope: OAUTH_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience(sa.token_uri ?? OAUTH_TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[seo/gsc] token exchange failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 600) * 1000,
  };
  return json.access_token;
}

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

type ApiFamily = 'sites' | 'inspect';

async function gscFetch<T>(
  path: string,
  init?: RequestInit,
  family: ApiFamily = 'sites',
): Promise<T> {
  const token = await getAccessToken();
  const base = family === 'inspect' ? GSC_INSPECT_API : GSC_SITES_API;
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[seo/gsc] ${res.status} ${family}${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Search-analytics query. Slice metrics by any combination of dimensions.
 *
 * Common recipes:
 *   - `dimensions: ['date']` — daily trend line
 *   - `dimensions: ['query']` — top keywords
 *   - `dimensions: ['page']` — top pages
 *   - `dimensions: ['page', 'query']` — per-page keyword breakdown
 *
 * Dates are inclusive on both ends. Max 16 months lookback.
 */
export async function searchAnalytics(
  req: SearchAnalyticsRequest,
): Promise<SearchAnalyticsRow[]> {
  const siteUrlEncoded = encodeURIComponent(req.siteUrl);
  const body = {
    startDate: req.startDate,
    endDate: req.endDate,
    dimensions: req.dimensions,
    rowLimit: req.rowLimit ?? 1000,
    dataState: req.dataState ?? 'all',
    ...(req.dimensionFilterGroups
      ? { dimensionFilterGroups: req.dimensionFilterGroups }
      : {}),
  };
  const result = await gscFetch<{ rows?: SearchAnalyticsRow[] }>(
    `/sites/${siteUrlEncoded}/searchAnalytics/query`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return result.rows ?? [];
}

/**
 * URL Inspection API. Returns per-URL indexation verdict + mobile-
 * usability signals. Rate-limited to ~600/day — avoid running this in
 * loops, use the admin UI on-demand only.
 */
export async function urlInspection(
  siteUrl: string,
  inspectUrl: string,
): Promise<InspectionResult> {
  const body = { inspectionUrl: inspectUrl, siteUrl };
  const result = await gscFetch<{ inspectionResult: InspectionResult }>(
    '/urlInspection/index:inspect',
    { method: 'POST', body: JSON.stringify(body) },
    'inspect',
  );
  return result.inspectionResult;
}

/**
 * Lists all sitemaps GSC has been told about for this site. Includes the
 * indexed-URL count per sitemap file when available.
 */
export async function listSitemaps(siteUrl: string): Promise<SitemapEntry[]> {
  const siteUrlEncoded = encodeURIComponent(siteUrl);
  const result = await gscFetch<{ sitemap?: SitemapEntry[] }>(
    `/sites/${siteUrlEncoded}/sitemaps`,
  );
  return result.sitemap ?? [];
}

/**
 * Convenience: "is Search Console configured and reachable?". Returns
 * `{ ok: true }` on success or `{ ok: false, error }` with a friendly
 * string. Used by the admin dashboard to render a setup-required state
 * when the env var is missing.
 */
export async function healthCheck(siteUrl: string): Promise<
  { ok: true; sitesVerified: number } | { ok: false; error: string }
> {
  try {
    // Lightweight call — lists sites the service account has access to.
    const res = await gscFetch<{ siteEntry?: Array<{ siteUrl: string }> }>(`/sites`);
    const sites = res.siteEntry ?? [];
    if (!sites.some(s => s.siteUrl === siteUrl)) {
      return {
        ok: false,
        error:
          `Service account can reach Search Console, but it's not granted ` +
          `access to "${siteUrl}". Add the service-account email as a user ` +
          `on the GSC property. See docs/seo/gsc-setup.md.`,
      };
    }
    return { ok: true, sitesVerified: sites.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
