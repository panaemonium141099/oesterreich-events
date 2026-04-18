/**
 * Google Indexing API client.
 *
 * Authenticates via a Service Account JWT (RS256-signed) exchanged for an
 * OAuth access token. The token is cached in-process until near expiry to
 * avoid re-signing on every submission.
 *
 * Official spec allows only `JobPosting` and `BroadcastEvent` schema types.
 * Event-detail pages use `Event` schema — Google generally accepts the
 * requests but may silently deprioritize or drop them. No penalty observed
 * in practice; worst case the call is a no-op.
 *
 * Rate limit: 200 requests/day on new projects, up to 600/day with quota
 * request. We enforce this client-side in the calling script.
 *
 * Setup required by the operator (once):
 *   1. Google Cloud Console → new project → enable "Indexing API".
 *   2. Create Service Account → JSON key download.
 *   3. Google Search Console → Settings → Users & permissions →
 *      add the service-account email as Owner.
 *   4. Store the JSON (or base64-encoded JSON) in
 *      `GOOGLE_INDEXING_API_SA_KEY` env var.
 */

import { createSign } from 'crypto';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

/**
 * Load the service-account JSON from the env var. Accepts both raw JSON
 * and base64-encoded JSON so Vercel UI multi-line quirks don't matter.
 * Also repairs private_key fields where literal "\n" was stored instead
 * of real newlines (common when pasting into CI/secrets UIs).
 */
function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_INDEXING_API_SA_KEY;
  if (!raw || raw.trim().length === 0) return null;

  let json = raw.trim();
  if (!json.startsWith('{')) {
    // Assume base64.
    try {
      json = Buffer.from(json, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  }

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(json) as ServiceAccount;
  } catch {
    return null;
  }

  if (!sa.client_email || !sa.private_key || !sa.token_uri) return null;

  // Repair escaped newlines that survive round-trips through shells/UIs.
  if (sa.private_key.includes('\\n')) {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }

  return sa;
}

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function fetchAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const toSign = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = createSign('RSA-SHA256').update(toSign).sign(sa.private_key);
  const jwt = `${toSign}.${base64UrlEncode(signature)}`;

  const response = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`token exchange HTTP ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('token exchange returned no access_token');
  return data.access_token;
}

async function getToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  const sa = loadServiceAccount();
  if (!sa) return null;
  try {
    const token = await fetchAccessToken(sa);
    // Expire 2 min early to avoid race with expiry.
    cachedToken = { token, expiresAt: Date.now() + 58 * 60_000 };
    return token;
  } catch (err) {
    console.error('[indexing-api] getToken failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export interface IndexingApiResult {
  ok: boolean;
  status: number;
  error?: string;
}

/**
 * Notify Google that a URL has been updated or deleted.
 * Returns `{ ok:false, status:0, error:'no_credentials' }` if the
 * service account env var is missing — caller decides whether to
 * treat that as fatal.
 */
export async function submitToGoogleIndexing(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED',
): Promise<IndexingApiResult> {
  const token = await getToken();
  if (!token) return { ok: false, status: 0, error: 'no_credentials' };

  try {
    const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, type }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
      };
    }
    return { ok: true, status: response.status };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function isGoogleIndexingConfigured(): boolean {
  return loadServiceAccount() !== null;
}
