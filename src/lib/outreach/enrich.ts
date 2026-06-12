// Contact enrichment: scrape a prospect's website for an email + contact page.
// extractEmails / findContactPath are pure (tested); scrapeContact does I/O.

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// junk: asset filenames (icon@2x.png), tracking/CDN noise, placeholders.
const JUNK = /(\.(png|jpe?g|gif|webp|svg|css|js|ico))$|sentry|wixpress|wix\.com|example\.(com|org|net)|@2x|@3x|placeholder|your-?email|sentry\.io/i;

/** Emails found in `html`, deduped + lowercased, junk filtered, same-domain first. */
export function extractEmails(html: string, ownDomain?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of html.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase();
    if (seen.has(e) || JUNK.test(e)) continue;
    seen.add(e);
    out.push(e);
  }
  if (ownDomain) {
    const d = ownDomain.toLowerCase();
    // stable: same-domain emails first, original order preserved otherwise.
    out.sort((a, b) => Number(b.endsWith('@' + d) || b.endsWith('.' + d)) - Number(a.endsWith('@' + d) || a.endsWith('.' + d)));
  }
  return out;
}

const CONTACT_RE = /impressum|kontakt|contact|imprint/i;

/** Path/href of the first link that looks like an Impressum/Kontakt page. */
export function findContactPath(html: string): string | null {
  const anchorRe = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, ' ');
    if (CONTACT_RE.test(href) || CONTACT_RE.test(text)) return href;
  }
  return null;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'lasstreffen.at-bot/1.0 (+https://lasstreffen.at)' },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    if (!(res.headers.get('content-type') ?? '').includes('text/html')) return null;
    return (await res.text()).slice(0, 500_000);
  } catch {
    return null;
  }
}

/** Fetch homepage; if no email, follow the Impressum/Kontakt link and scrape that. */
export async function scrapeContact(domain: string): Promise<{ email: string | null; contactUrl: string | null }> {
  const base = `https://${domain}`;
  const home = await fetchText(base);
  if (!home) return { email: null, contactUrl: null };

  let emails = extractEmails(home, domain);
  let contactUrl: string | null = null;
  if (emails.length === 0) {
    const path = findContactPath(home);
    if (path) {
      try {
        contactUrl = new URL(path, base).href;
        const page = await fetchText(contactUrl);
        if (page) emails = extractEmails(page, domain);
      } catch {
        /* bad URL — ignore */
      }
    }
  }
  return { email: emails[0] ?? null, contactUrl };
}
