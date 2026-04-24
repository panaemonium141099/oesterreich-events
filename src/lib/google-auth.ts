/**
 * Shared Google-Service-Account loader.
 *
 * Extracted from `src/lib/indexing-api.ts` so the SEO (`gsc.ts`) and
 * Indexing (`indexing-api.ts`) code paths share the same robust parse
 * logic. Single source of truth for env-var format quirks.
 *
 * Handles the common mangling modes of a service-account JSON env var:
 *   - Raw JSON string (`{"type":"service_account",...}`)
 *   - Base64-encoded JSON (Vercel UI occasionally prefers this)
 *   - Surrounding single/double quotes (shell-added)
 *   - `\\n` in the private_key (literal backslash-n from single-line
 *     env paste)
 *   - Windows `\r\n` or lone `\r` line endings
 *   - Missing trailing newline (some PEM parsers insist on it)
 */

export interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
  project_id?: string;
  [key: string]: unknown;
}

export interface LoadResult {
  sa: GoogleServiceAccount | null;
  reason?: string;
}

/**
 * Loads + repairs a Google service-account JSON from an env var.
 *
 * Prefer the first populated env var name. Accept both env var names
 * because the project historically had `GOOGLE_INDEXING_API_SA_KEY`
 * and we reuse the same SA for Search Console + CrUX scopes.
 */
export function loadGoogleServiceAccount(
  envVarNames: string[] = ['GOOGLE_INDEXING_API_SA_KEY', 'GOOGLE_SEARCH_CONSOLE_SA_KEY'],
): LoadResult {
  let raw: string | undefined;
  let usedEnvName = '';
  for (const name of envVarNames) {
    const v = process.env[name];
    if (v && v.trim().length > 0) {
      raw = v;
      usedEnvName = name;
      break;
    }
  }

  if (!raw) {
    return {
      sa: null,
      reason: `[google-auth] none of ${envVarNames.join(', ')} set or empty`,
    };
  }

  // Strip surrounding quotes (some shells add them automatically).
  let json = raw.trim();
  if (
    (json.startsWith('"') && json.endsWith('"'))
    || (json.startsWith("'") && json.endsWith("'"))
  ) {
    json = json.slice(1, -1);
  }

  // Allow base64-encoded form.
  if (!json.startsWith('{')) {
    try {
      const decoded = Buffer.from(json, 'base64').toString('utf-8');
      if (decoded.trim().startsWith('{')) {
        json = decoded;
      } else {
        return {
          sa: null,
          reason: `[google-auth] ${usedEnvName} is neither JSON nor valid base64 JSON (starts with: ${json.slice(0, 20)}…)`,
        };
      }
    } catch {
      return {
        sa: null,
        reason: `[google-auth] ${usedEnvName} is not JSON and base64 decode failed`,
      };
    }
  }

  let sa: GoogleServiceAccount;
  try {
    sa = JSON.parse(json) as GoogleServiceAccount;
  } catch (err) {
    return {
      sa: null,
      reason: `[google-auth] ${usedEnvName} JSON.parse failed: ${err instanceof Error ? err.message : err}`,
    };
  }

  if (!sa.client_email || !sa.private_key || !sa.token_uri) {
    return {
      sa: null,
      reason: `[google-auth] ${usedEnvName} JSON missing required fields (need: client_email, private_key, token_uri)`,
    };
  }

  // Repair the private_key PEM:
  //   1. Literal \n → real newlines (common when single-line env-var pasting)
  //   2. Normalise \r\n (Windows) and lone \r to plain \n
  //   3. Ensure there's a trailing newline (some PEM parsers insist on it)
  let pk = sa.private_key;
  if (pk.includes('\\n')) pk = pk.replace(/\\n/g, '\n');
  pk = pk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!pk.endsWith('\n')) pk += '\n';

  if (!pk.startsWith('-----BEGIN')) {
    return {
      sa: null,
      reason: `[google-auth] ${usedEnvName} private_key does not start with "-----BEGIN" (starts with: ${JSON.stringify(pk.slice(0, 40))}). Check env-var format.`,
    };
  }

  sa.private_key = pk;
  return { sa };
}

/** Throwing variant — use when callers want a hard fail (e.g. GSC API client). */
export function requireGoogleServiceAccount(
  envVarNames?: string[],
): GoogleServiceAccount {
  const { sa, reason } = loadGoogleServiceAccount(envVarNames);
  if (!sa) throw new Error(reason ?? '[google-auth] service account not configured');
  return sa;
}
