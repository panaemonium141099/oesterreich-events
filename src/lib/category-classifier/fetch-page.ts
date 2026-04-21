/**
 * Fetch + extract main text from an event source URL.
 *
 * The LLM doesn't browse the web itself — we do. This module turns a
 * `source_url` into up to ~4000 chars of clean plain text (+ JSON-LD
 * dump if present), which the classifier then reads alongside the
 * scraper-captured metadata.
 *
 * Coverage note: works on static HTML and server-rendered pages. Fails
 * gracefully on JS-heavy SPAs (returns too-little-content). Good enough
 * for ~60-70% of Austrian event sources; the rest still get classified
 * from the scraper's existing title/description.
 */

import { load as cheerioLoad } from 'cheerio';

const TIMEOUT_MS = 15_000;
const MAX_TEXT_CHARS = 4000;

const USER_AGENT =
  'Mozilla/5.0 (compatible; LassTreffenBot/1.0; +https://lasstreffen.at/bot)';

// Crude per-domain rate limiter — one request per domain every 600ms so
// we're not hammering a single server even when running 5 workers. Shared
// state across concurrent calls because this module is single-instance.
const domainLastRequest = new Map<string, number>();
const DOMAIN_DELAY_MS = 600;

async function rateLimit(url: string): Promise<void> {
  try {
    const host = new URL(url).hostname;
    const last = domainLastRequest.get(host) ?? 0;
    const now = Date.now();
    const wait = Math.max(0, last + DOMAIN_DELAY_MS - now);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    domainLastRequest.set(host, Date.now());
  } catch {
    /* unparseable URL — skip rate limit, call site handles error */
  }
}

export interface FetchedPage {
  ok: boolean;
  text: string | null;
  status: number;
  error?: string;
}

export async function fetchEventPage(url: string): Promise<FetchedPage> {
  try {
    await rateLimit(url);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'de-AT,de;q=0.9,en;q=0.8',
      },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);

    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok) {
      return { ok: false, text: null, status: res.status, error: `HTTP ${res.status}` };
    }
    if (!contentType.toLowerCase().includes('html')) {
      return { ok: false, text: null, status: res.status, error: `not HTML (${contentType})` };
    }

    const html = await res.text();
    const text = extractMainText(html);

    // SPAs that only serve the app shell will produce ~50 chars or less of
    // extractable text (just <title>, maybe a loading indicator). Signal
    // that so the caller falls back to metadata-only classification.
    if (text.length < 100) {
      return {
        ok: false,
        text: null,
        status: res.status,
        error: `too little content (${text.length} chars, likely JS-rendered)`,
      };
    }

    return { ok: true, text, status: res.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, text: null, status: 0, error: msg };
  }
}

/**
 * Strip chrome, extract readable content, include any JSON-LD Event
 * schema we find. Falls back to <body> text when no main/article element
 * has enough content.
 */
export function extractMainText(html: string): string {
  const $ = cheerioLoad(html);

  // Drop obvious non-content.
  $(
    'script, style, noscript, nav, header, footer, aside, iframe, svg, ' +
      '.menu, .nav, .navbar, .header, .site-header, .footer, .site-footer, ' +
      '.sidebar, .cookie, .cookie-banner, .banner, .ads, .advertisement',
  ).remove();

  // JSON-LD Event schema is gold — structured, unambiguous, often includes
  // description/offers/location that the rendered HTML lacks.
  let jsonLdText = '';
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const raw = $(el).html() ?? '';
      if (!raw.trim()) return;
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        // Direct Event or @graph-wrapped Event
        const graph = (item as { '@graph'?: unknown[] })['@graph'];
        const candidates: unknown[] = graph ? [...graph, item] : [item];
        for (const c of candidates) {
          const type = (c as { '@type'?: unknown })['@type'];
          if (
            type === 'Event' ||
            (Array.isArray(type) && type.includes('Event'))
          ) {
            jsonLdText += JSON.stringify(c) + '\n';
          }
        }
      }
    } catch {
      /* bad JSON-LD — skip */
    }
  });

  // Main-content selectors in order of specificity. First one with enough
  // text wins; otherwise we fall back to body.
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '#main',
    '#content',
    '.main-content',
    '.content',
    '.event-detail',
    '.event-content',
    '.post-content',
    '.entry-content',
  ];
  let mainText = '';
  for (const sel of mainSelectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) {
      mainText = el.text();
      break;
    }
  }
  if (!mainText) {
    mainText = $('body').text();
  }

  // Normalize whitespace — collapse runs of whitespace to single spaces,
  // trim, and cap length so we don't blow out Qwen's context window.
  const prefix = jsonLdText ? `[JSON-LD]\n${jsonLdText}\n\n[PAGE]\n` : '';
  let combined = prefix + mainText;
  combined = combined.replace(/\s+/g, ' ').trim();
  if (combined.length > MAX_TEXT_CHARS) {
    combined = combined.slice(0, MAX_TEXT_CHARS) + '…';
  }
  return combined;
}
