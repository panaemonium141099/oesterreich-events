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
 * Repairs a few common mangling modes of the private_key field caused by
 * env-var pipelines (literal backslash-n, Windows \r\n line-endings,
 * surrounding quotes).
 *
 * Logs a specific reason when it returns null — makes the
 * "no_credentials" failure in the submit script debuggable.
 */
function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_INDEXING_API_SA_KEY;
  if (!raw || raw.trim().length === 0) {
    console.error('[indexing-api] GOOGLE_INDEXING_API_SA_KEY is empty or unset');
    return null;
  }

  // Strip surrounding quotes (some shells add them automatically).
  let json = raw.trim();
  if ((json.startsWith('"') && json.endsWith('"')) || (json.startsWith("'") && json.endsWith("'"))) {
    json = json.slice(1, -1);
  }

  if (!json.startsWith('{')) {
    try {
      const decoded = Buffer.from(json, 'base64').toString('utf-8');
      if (decoded.trim().startsWith('{')) {
        json = decoded;
      } else {
        console.error('[indexing-api] env var is neither JSON nor valid base64 JSON (starts with:', json.slice(0, 20), '...)');
        return null;
      }
    } catch {
      console.error('[indexing-api] env var is not JSON and base64 decode failed');
      return null;
    }
  }

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(json) as ServiceAccount;
  } catch (err) {
    console.error('[indexing-api] JSON.parse failed:', err instanceof Error ? err.message : err);
    return null;
  }

  if (!sa.client_email || !sa.private_key || !sa.token_uri) {
    console.error('[indexing-api] JSON is missing required fields (need: client_email, private_key, token_uri)');
    return null;
  }

  // Repair the private_key in three steps so the key actually parses as a PEM:
  //   1. Literal \n → real newlines (common when single-line env-var pasting)
  //   2. Normalise \r\n (Windows) and lone \r to plain \n
  //   3. Ensure there's a trailing newline (some PEM parsers insist on it)
  let pk = sa.private_key;
  if (pk.includes('\\n')) pk = pk.replace(/\\n/g, '\n');
  pk = pk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!pk.endsWith('\n')) pk += '\n';

  if (!pk.startsWith('-----BEGIN')) {
    console.error(
      '[indexing-api] private_key does not start with "-----BEGIN" (starts with:',
      JSON.stringify(pk.slice(0, 40)),
      '). Check env-var format.',
    );
    return null;
  }

  sa.private_key = pk;
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
