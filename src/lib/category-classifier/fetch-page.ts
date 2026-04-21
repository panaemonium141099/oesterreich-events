/**
 * Fetch + extract main text from an event source URL.
 *
 * Two-stage strategy, "no compromises":
 *   1. Plain HTTPS fetch with realistic browser headers. Fast (~0.5-2s),
 *      works for static HTML and server-rendered pages. ~60-70% of
 *      Austrian sources succeed here.
 *   2. Puppeteer fallback (real headless Chrome) on failure or thin
 *      content. Renders JavaScript, bypasses simple bot-walls, executes
 *      client-side routing. Slower (~3-8s), but handles SPAs, cookie
 *      interstitials, and sites that 400 plain `node:fetch` requests.
 *
 * Shared Puppeteer browser instance across all callers — launching Chrome
 * is expensive (~1s), so we do it once lazily and keep it alive. Each
 * fetch opens/closes a single Page. Call `closeSharedBrowser()` on script
 * shutdown to release resources.
 */

import { load as cheerioLoad } from 'cheerio';
import { existsSync } from 'fs';
import { join } from 'path';

const TIMEOUT_MS = 15_000;
const PUPPETEER_TIMEOUT_MS = 30_000;
const MAX_TEXT_CHARS = 4000;
const MIN_GOOD_CONTENT = 300;  // below this we attempt the Puppeteer fallback

// Realistic Chrome UA — beats most bot filters that reject "node:fetch".
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

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
  } catch { /* bad URL */ }
}

export interface FetchedPage {
  ok: boolean;
  text: string | null;
  status: number;
  /** Which strategy actually produced the content: 'http' | 'browser' | null */
  via?: 'http' | 'browser';
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Stage 1: plain HTTPS fetch
// ─────────────────────────────────────────────────────────────────────

async function fetchPlain(url: string): Promise<FetchedPage> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'de-AT,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);

    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok) return { ok: false, text: null, status: res.status, error: `HTTP ${res.status}` };
    if (!contentType.toLowerCase().includes('html')) {
      return { ok: false, text: null, status: res.status, error: `not HTML (${contentType})` };
    }

    const html = await res.text();
    const text = extractMainText(html);
    if (text.length < 100) {
      return { ok: false, text: null, status: res.status, error: `too little content (${text.length} chars)` };
    }
    return { ok: true, text, status: res.status, via: 'http' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, text: null, status: 0, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Stage 2: Puppeteer fallback
// ─────────────────────────────────────────────────────────────────────

// We import puppeteer-core lazily via dynamic import so the module loads
// even when puppeteer isn't installed (e.g. in CI that doesn't need it).
// The actual type is imported for compile-time only.
type PuppeteerBrowser = {
  newPage: () => Promise<PuppeteerPage>;
  close: () => Promise<void>;
};
type PuppeteerPage = {
  goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>;
  content: () => Promise<string>;
  close: () => Promise<void>;
  setUserAgent: (ua: string) => Promise<void>;
  setExtraHTTPHeaders: (headers: Record<string, string>) => Promise<void>;
  setDefaultNavigationTimeout: (ms: number) => void;
};

let sharedBrowserPromise: Promise<PuppeteerBrowser | null> | null = null;

/** Guess where Chrome is installed on the current OS. */
function detectChromePath(): string | null {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : null,
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ].filter((p): p is string => typeof p === 'string');
    for (const p of candidates) if (existsSync(p)) return p;
  } else if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    for (const p of candidates) if (existsSync(p)) return p;
  } else {
    const candidates = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
    for (const p of candidates) if (existsSync(p)) return p;
  }
  return null;
}

async function getSharedBrowser(): Promise<PuppeteerBrowser | null> {
  if (sharedBrowserPromise) return sharedBrowserPromise;
  sharedBrowserPromise = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const puppeteerMod = (await import('puppeteer-core')) as any;
      const puppeteer = (puppeteerMod.default ?? puppeteerMod) as {
        launch: (opts: Record<string, unknown>) => Promise<PuppeteerBrowser>;
      };
      const chromePath = detectChromePath();
      if (!chromePath) {
        console.error('[fetch-page] No Chrome binary found — Puppeteer fallback disabled.');
        return null;
      }
      const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      });
      console.error(`[fetch-page] Puppeteer browser ready (${chromePath})`);
      return browser;
    } catch (err) {
      console.error(`[fetch-page] Puppeteer launch failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  })();
  return sharedBrowserPromise;
}

async function fetchWithBrowser(url: string): Promise<FetchedPage> {
  const browser = await getSharedBrowser();
  if (!browser) {
    return { ok: false, text: null, status: 0, error: 'puppeteer unavailable' };
  }
  let page: PuppeteerPage | null = null;
  try {
    page = await browser.newPage();
    await page.setUserAgent(BROWSER_UA);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'de-AT,de;q=0.9,en;q=0.8',
    });
    page.setDefaultNavigationTimeout(PUPPETEER_TIMEOUT_MS);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PUPPETEER_TIMEOUT_MS });
    // Small settle delay so client-side routing has a chance to render content
    await new Promise((r) => setTimeout(r, 800));
    const html = await page.content();
    const text = extractMainText(html);
    if (text.length < 100) {
      return { ok: false, text: null, status: 200, via: 'browser', error: `browser rendered but thin (${text.length} chars)` };
    }
    return { ok: true, text, status: 200, via: 'browser' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, text: null, status: 0, via: 'browser', error: `browser: ${msg}` };
  } finally {
    if (page) { try { await page.close(); } catch { /* ignore */ } }
  }
}

/** Close the shared browser. Call at script exit. */
export async function closeSharedBrowser(): Promise<void> {
  if (!sharedBrowserPromise) return;
  try {
    const browser = await sharedBrowserPromise;
    if (browser) await browser.close();
  } catch { /* ignore */ }
  sharedBrowserPromise = null;
}

// ─────────────────────────────────────────────────────────────────────
// Public API — orchestrator
// ─────────────────────────────────────────────────────────────────────

/**
 * URLs that look like API/backend endpoints rather than web pages.
 * These typically require specific auth headers and return empty HTML or
 * errors to Chrome — Puppeteer fallback is a waste. Known Austrian culprits:
 *   webapi.deskline.net/*   — Feratel API for Tourismus-Portale (needs DW-Source header)
 *   api.*.at/events         — raw JSON APIs
 *   */api/events/*          — RESTful endpoints
 */
function looksLikeApiEndpoint(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.startsWith('webapi.') || host.startsWith('api.')) return true;
    if (u.pathname.toLowerCase().includes('/api/')) return true;
    if (u.pathname.endsWith('.json') || u.pathname.endsWith('.xml')) return true;
    return false;
  } catch {
    return false;
  }
}

export async function fetchEventPage(url: string): Promise<FetchedPage> {
  await rateLimit(url);

  // API endpoints can't be rendered — skip straight to 'fail' without
  // eating the Chrome-startup cost on every one of these.
  if (looksLikeApiEndpoint(url)) {
    return {
      ok: false, text: null, status: 0,
      error: 'URL is an API endpoint (scraper data bug — should point to event page, not backend)',
    };
  }

  // Stage 1: plain fetch
  const plain = await fetchPlain(url);

  // Fast path: plain fetch produced solid content
  if (plain.ok && plain.text && plain.text.length >= MIN_GOOD_CONTENT) {
    return plain;
  }

  // 404 is almost always a dead event — browser fallback won't resurrect it.
  if (plain.status === 404) {
    return plain;
  }

  // Everything else: try Puppeteer. Even if plain got thin content (JS shell),
  // the browser can render and produce a richer extraction.
  const browser = await fetchWithBrowser(url);

  // Prefer browser result if it's better than plain
  if (browser.ok && browser.text) {
    if (!plain.ok || !plain.text || browser.text.length > plain.text.length) {
      return browser;
    }
  }

  // Neither worked — surface BOTH errors so the operator can diagnose
  // whether the plain fetch was misleading or Puppeteer also hit the wall.
  return {
    ok: false,
    text: null,
    status: plain.status || browser.status,
    via: browser.via,
    error: `http: ${plain.error ?? 'ok-but-thin'} | browser: ${browser.error ?? 'ok-but-thin'}`,
  };
}

/**
 * Strip chrome, extract readable content, include any JSON-LD Event
 * schema we find. Falls back to <body> text when no main/article element
 * has enough content.
 */
export function extractMainText(html: string): string {
  const $ = cheerioLoad(html);

  $(
    'script, style, noscript, nav, header, footer, aside, iframe, svg, ' +
      '.menu, .nav, .navbar, .header, .site-header, .footer, .site-footer, ' +
      '.sidebar, .cookie, .cookie-banner, .banner, .ads, .advertisement',
  ).remove();

  let jsonLdText = '';
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const raw = $(el).html() ?? '';
      if (!raw.trim()) return;
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
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
    } catch { /* bad JSON-LD — skip */ }
  });

  const mainSelectors = [
    'main', 'article', '[role="main"]', '#main', '#content',
    '.main-content', '.content', '.event-detail', '.event-content',
    '.post-content', '.entry-content',
  ];
  let mainText = '';
  for (const sel of mainSelectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) {
      mainText = el.text();
      break;
    }
  }
  if (!mainText) mainText = $('body').text();

  const prefix = jsonLdText ? `[JSON-LD]\n${jsonLdText}\n\n[PAGE]\n` : '';
  let combined = prefix + mainText;
  combined = combined.replace(/\s+/g, ' ').trim();
  if (combined.length > MAX_TEXT_CHARS) {
    combined = combined.slice(0, MAX_TEXT_CHARS) + '…';
  }
  return combined;
}
