/**
 * Runtime festival enrichment via OG-tags and JSON-LD.
 *
 * Pulls a festival's website ONCE per day (via unstable_cache) and extracts:
 *   - hero image (og:image preferred, JSON-LD image fallback)
 *   - description (og:description / JSON-LD description / first meaningful <p>)
 *   - artists / performers from MusicEvent JSON-LD (best-effort)
 *
 * Why runtime: the lineup-orchestrator pipeline (src/lib/lineup/*) only
 * covers ~9 festivals with bespoke scrapers; the seed-registry has 170+.
 * Until each gets a dedicated scraper, we fill the detail page from the
 * official festival website at request time. The cache keeps Vercel
 * function cost predictable (one fetch per festival per day).
 *
 * Designed to NEVER throw — every code path returns a partial result.
 * A broken website should degrade the detail page, not 404 it.
 */
import * as cheerio from 'cheerio';
import { unstable_cache } from 'next/cache';

export interface FestivalEnrichment {
  imageUrl: string | null;
  description: string | null;
  artists: string[];           // unique, ordered as parsed
  priceText: string | null;    // free-text from JSON-LD offers if present
  fetchedFromUrl: string | null;
  fetchedAt: string;           // ISO timestamp — useful for debugging
}

const EMPTY: FestivalEnrichment = {
  imageUrl: null,
  description: null,
  artists: [],
  priceText: null,
  fetchedFromUrl: null,
  fetchedAt: new Date(0).toISOString(),
};

const FETCH_TIMEOUT_MS = 6_000;
const FETCH_USER_AGENT =
  'lasstreffen.at/1.0 (+https://lasstreffen.at; festival-enrichment-bot)';

/**
 * Fetch a URL with a hard timeout, returning the response text or null.
 * Never throws — timeout / network / non-2xx all produce `null`.
 */
async function safeFetch(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': FETCH_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html') && !ct.includes('xml')) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Extract meta tag content by property OR name.
 */
function meta($: cheerio.CheerioAPI, key: string): string | null {
  const byProp = $(`meta[property="${key}"]`).attr('content');
  if (byProp && byProp.trim()) return byProp.trim();
  const byName = $(`meta[name="${key}"]`).attr('content');
  if (byName && byName.trim()) return byName.trim();
  return null;
}

/**
 * Resolve a possibly-relative URL against a base. Returns null on bad input.
 */
function absolutize(maybeRelative: string | null, baseUrl: string): string | null {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Walk JSON-LD blocks in the document and collect MusicEvent / Festival data.
 * Tolerates @graph wrappers and arrays.
 */
interface JsonLdShard {
  image?: string | string[] | null;
  description?: string | null;
  performer?: Array<{ name?: string } | string> | { name?: string } | string | null;
  offers?: Array<{ price?: string | number; priceCurrency?: string }> | { price?: string | number; priceCurrency?: string } | null;
}

function harvestJsonLd($: cheerio.CheerioAPI): {
  images: string[];
  descriptions: string[];
  performers: string[];
  prices: string[];
} {
  const images: string[] = [];
  const descriptions: string[] = [];
  const performers: string[] = [];
  const prices: string[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const stack: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      const obj = node as Record<string, unknown> & JsonLdShard;
      if (Array.isArray((obj as Record<string, unknown>)['@graph'])) {
        stack.push(...((obj as Record<string, unknown>)['@graph'] as unknown[]));
      }
      // image
      const img = obj.image;
      if (typeof img === 'string') images.push(img);
      else if (Array.isArray(img)) {
        for (const i of img) if (typeof i === 'string') images.push(i);
      } else if (img && typeof img === 'object' && 'url' in (img as object)) {
        const u = (img as { url?: unknown }).url;
        if (typeof u === 'string') images.push(u);
      }
      // description
      if (typeof obj.description === 'string') descriptions.push(obj.description);
      // performer
      const performer = obj.performer;
      if (typeof performer === 'string') performers.push(performer);
      else if (Array.isArray(performer)) {
        for (const p of performer) {
          if (typeof p === 'string') performers.push(p);
          else if (p && typeof p === 'object' && typeof p.name === 'string') performers.push(p.name);
        }
      } else if (performer && typeof performer === 'object' && typeof performer.name === 'string') {
        performers.push(performer.name);
      }
      // offers — pull a human-readable price string when possible
      const offers = obj.offers;
      const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
      for (const o of offerList) {
        if (o && typeof o === 'object' && 'price' in o) {
          const p = (o as { price?: unknown; priceCurrency?: unknown }).price;
          const cur = (o as { priceCurrency?: unknown }).priceCurrency;
          if (typeof p === 'number' || typeof p === 'string') {
            prices.push(typeof cur === 'string' && cur ? `${cur} ${p}` : String(p));
          }
        }
      }
    }
  });
  return { images, descriptions, performers, prices };
}

/**
 * Core enrichment — fetch + parse. Uncached version; the exported
 * `getFestivalEnrichment` wraps this with unstable_cache.
 */
async function buildEnrichment(websiteUrl: string): Promise<FestivalEnrichment> {
  const html = await safeFetch(websiteUrl);
  if (!html) {
    return { ...EMPTY, fetchedFromUrl: websiteUrl, fetchedAt: new Date().toISOString() };
  }
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    return { ...EMPTY, fetchedFromUrl: websiteUrl, fetchedAt: new Date().toISOString() };
  }

  // ── Image ──
  const ogImage = absolutize(meta($, 'og:image'), websiteUrl)
    ?? absolutize(meta($, 'twitter:image'), websiteUrl);
  const jsonLd = harvestJsonLd($);
  const jsonLdImage = jsonLd.images.length > 0 ? absolutize(jsonLd.images[0], websiteUrl) : null;

  // ── Description ──
  const ogDesc = meta($, 'og:description') ?? meta($, 'description');
  const jsonLdDesc = jsonLd.descriptions[0] ?? null;
  const description = (ogDesc && ogDesc.length > 30 ? ogDesc : null)
    ?? (jsonLdDesc && jsonLdDesc.length > 30 ? jsonLdDesc : null)
    ?? ogDesc
    ?? jsonLdDesc
    ?? null;

  // ── Artists ──
  const artists = Array.from(new Set(jsonLd.performers.map(s => s.trim()).filter(Boolean)));

  return {
    imageUrl: ogImage ?? jsonLdImage ?? null,
    description: description ? description.replace(/\s+/g, ' ').trim() : null,
    artists,
    priceText: jsonLd.prices[0] ?? null,
    fetchedFromUrl: websiteUrl,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Cached enrichment for a festival website. Cache TTL: 24h.
 * The slug is included in the cache key so different festivals don't
 * collide — even if two share a website.
 */
export function getFestivalEnrichment(websiteUrl: string | null, slug: string): Promise<FestivalEnrichment> {
  if (!websiteUrl) return Promise.resolve(EMPTY);
  // unstable_cache hashes the arg list, so slug+url uniquely keys.
  const cached = unstable_cache(
    async (url: string) => buildEnrichment(url),
    ['festival-enrichment', slug],
    { revalidate: 60 * 60 * 24, tags: [`festival-enrichment:${slug}`] },
  );
  return cached(websiteUrl);
}
