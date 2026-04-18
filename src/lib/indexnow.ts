/**
 * IndexNow client.
 *
 * IndexNow is an open protocol supported by Bing, Yandex, Seznam, and
 * Naver (but NOT Google). One POST notifies all participating search
 * engines that a URL has new or updated content. Up to 10,000 URLs per
 * request — much more generous than Google's Indexing API.
 *
 * Ownership verification: the plain-text file at
 * `public/${INDEXNOW_KEY}.txt` serves the key under our domain. IndexNow
 * fetches `keyLocation` and checks the content matches `key`. Since the
 * "key" just proves domain ownership (not a secret), the file is checked
 * into git — losing it doesn't cause any security issue, only a broken
 * notification flow.
 *
 * Failure mode: IndexNow returns 200 or 202 on success, 4xx on malformed
 * payload, 5xx on their side. We never retry — the next scrape-pipeline
 * run picks up whatever was missed.
 */

/** 40-char hex key. Must match the filename in `public/`. */
export const INDEXNOW_KEY = 'b99f41aea5a92b0345f17df073e25a6ab5a9fab7' as const;

/** Canonical host without protocol — IndexNow expects bare hostname. */
const HOST = 'lasstreffen.at';

/** Shared endpoint; Bing / Yandex syndicate automatically. */
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/** Max URLs per request, per the protocol spec. */
const MAX_URLS_PER_REQUEST = 10_000;

export interface IndexNowResult {
  ok: boolean;
  status: number;
  submitted: number;
  error?: string;
}

/**
 * Submit a batch of URLs to IndexNow. Silently no-ops for empty arrays.
 * Splits into chunks of 10k if necessary (no cost difference, the spec
 * just caps per-request).
 */
export async function submitToIndexNow(urls: readonly string[]): Promise<IndexNowResult> {
  if (urls.length === 0) return { ok: true, status: 200, submitted: 0 };

  // Deduplicate; IndexNow doesn't reject duplicates, but we save API work.
  const unique = [...new Set(urls)].filter(u => u.startsWith('https://'));
  if (unique.length === 0) return { ok: true, status: 200, submitted: 0 };

  let totalSubmitted = 0;
  for (let i = 0; i < unique.length; i += MAX_URLS_PER_REQUEST) {
    const chunk = unique.slice(i, i + MAX_URLS_PER_REQUEST);
    const body = {
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
      urlList: chunk,
    };
    try {
      const response = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          ok: false,
          status: response.status,
          submitted: totalSubmitted,
          error: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
        };
      }
      totalSubmitted += chunk.length;
    } catch (err) {
      return {
        ok: false,
        status: 0,
        submitted: totalSubmitted,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { ok: true, status: 200, submitted: totalSubmitted };
}
