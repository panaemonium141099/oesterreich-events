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
import overridesJson from '../../../data/festival-overrides.json';

export interface FestivalEnrichment {
  imageUrl: string | null;
  description: string | null;
  artists: string[];           // unique, ordered as parsed
  priceText: string | null;    // free-text from JSON-LD offers if present
  fetchedFromUrl: string | null;
  fetchedAt: string;           // ISO timestamp — useful for debugging
}

/**
 * Hand-curated overrides for festivals whose websites can't be reached or
 * don't expose og:image / JSON-LD. Loaded from data/festival-overrides.json
 * at build time and merged on top of runtime enrichment (override wins).
 *
 * Keys are festival slugs (must match festivals.slug exactly).
 */
interface FestivalOverride {
  imageUrl?: string | null;
  description?: string | null;
  priceText?: string | null;
}
const OVERRIDES: Record<string, FestivalOverride> = Object.fromEntries(
  Object.entries(overridesJson as Record<string, unknown>).filter(
    ([k, v]) => !k.startsWith('_') && v && typeof v === 'object',
  ),
) as Record<string, FestivalOverride>;

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
 * Try common lineup subpaths (`/lineup`, `/line-up`, `/artists`,
 * `/programm`) and return the first that yields JSON-LD performers
 * or h2 artist-name candidates. Returns null on no hit.
 *
 * Used as a second pass when the home page yields no lineup signal —
 * many festival sites put their structured data only on the lineup
 * subpage.
 */
const LINEUP_PATHS = ['/lineup', '/line-up', '/artists', '/kuenstler', '/künstler', '/programm', '/programme'];
const H2_NOISE = /^(Vote|Tickets?|Newsletter|Login|Anmeld|Travel|Anreise|Sponsoren|Sponsors?|Partners?|FAQ|Kontakt|Contact|Über|About|Hauptpartner|Logo|Datenschutz|Impressum|Cookie|Programm|Line[- ]?up|Aftermovie|Opening|Closing)\b/i;
// Strip date-like and weekday-like h2 strings — these surface in
// "lineup grouped by day" listings (Friday 24.07., 21.-23. August
// 2026, etc.) and pollute the artist list.
const DATE_NOISE = /^(\d{1,2}[.\-/]\d{1,2}[.\-/]?(\d{2,4})?|\d{1,2}\.\s?(?:Jan|Feb|Mar|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Mo|Di|Mi|Do|Fr|Sa|So|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,.\s]/i;

async function tryLineupSubpaths(baseUrl: string): Promise<{ artists: string[] }> {
  for (const path of LINEUP_PATHS) {
    let absUrl: string;
    try {
      absUrl = new URL(path, baseUrl).toString();
    } catch {
      continue;
    }
    const html = await safeFetch(absUrl);
    if (!html) continue;
    let $: cheerio.CheerioAPI;
    try {
      $ = cheerio.load(html);
    } catch {
      continue;
    }
    const sub = harvestJsonLd($);
    if (sub.performers.length > 0) {
      return { artists: Array.from(new Set(sub.performers.map(s => s.trim()).filter(Boolean))) };
    }
    // h2 fallback: only trust the subpath if it gives a plausibly-sized
    // list (≥5, ≤200) and the entries don't look like nav noise OR pure
    // date / weekday strings.
    const h2s: string[] = [];
    $('h2').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (!t || t.length < 2 || t.length > 80) return;
      if (H2_NOISE.test(t)) return;
      if (DATE_NOISE.test(t)) return;
      // Discard h2s that are JUST a city + state combo (location header).
      if (/^[A-ZÄÖÜ][\wäöüß]+(\s[A-ZÄÖÜ][\wäöüß]+)?$/.test(t) && t.split(' ').length <= 2 && t.length < 20) {
        // single short capitalized word/pair — could be an artist OR a city.
        // Keep it but the calling code is conservative anyway.
      }
      h2s.push(t);
    });
    if (h2s.length >= 5 && h2s.length <= 200) {
      // If MORE THAN HALF the captured h2s pattern-match dates after
      // the initial filter, we're probably reading a calendar page,
      // not a lineup. Drop the whole result.
      const dateLike = h2s.filter(t => /\d{1,2}[.\-/]\d{1,2}/.test(t)).length;
      if (dateLike / h2s.length > 0.5) continue;
      return { artists: Array.from(new Set(h2s)) };
    }
  }
  return { artists: [] };
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
  // Layered fallback: og:description → meta description → JSON-LD
  // → first substantive <p> (>= 80 chars, skip cookie banners /
  // legal noise). Each layer wins only if the candidate looks like
  // a real description (>30 chars). The "first <p>" branch is what
  // covers sites whose CMS doesn't render meta tags — quite common
  // for festival microsites built on Wordpress + page builders.
  const ogDesc = meta($, 'og:description');
  const nameDesc = meta($, 'description');
  const jsonLdDesc = jsonLd.descriptions[0] ?? null;

  function pickP(): string | null {
    const SKIP = /^(cookie|datenschutz|impressum|agb|newsletter|bestuhlung)/i;
    let best: string | null = null;
    $('p').each((_, el) => {
      if (best) return;
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length < 80) return;
      if (SKIP.test(text)) return;
      best = text.slice(0, 600);
    });
    return best;
  }

  let description: string | null = null;
  for (const cand of [ogDesc, nameDesc, jsonLdDesc, pickP()]) {
    if (cand && cand.trim().length >= 30) {
      description = cand.trim();
      break;
    }
  }

  // ── Artists ──
  // Layer 1: JSON-LD performers on the home page (rare but cleanest).
  let artists = Array.from(new Set(jsonLd.performers.map(s => s.trim()).filter(Boolean)));
  // Layer 2: try /lineup, /line-up, /programm, /artists subpaths. Common
  // pattern on Austrian festival sites — the home page is editorial /
  // marketing while the structured artist list lives one level down.
  if (artists.length === 0) {
    const sub = await tryLineupSubpaths(websiteUrl);
    artists = sub.artists;
  }

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
// Cache version — bump when buildEnrichment changes how it derives
// fields (e.g. new fallback paths). The version is part of the
// cache key, so a bump invalidates every existing entry instead of
// waiting out the 24h TTL.
const CACHE_VERSION = 'v4-noise-filter';

function applyOverride(enrichment: FestivalEnrichment, slug: string): FestivalEnrichment {
  const ov = OVERRIDES[slug];
  if (!ov) return enrichment;
  return {
    ...enrichment,
    imageUrl: ov.imageUrl ?? enrichment.imageUrl,
    description: ov.description ?? enrichment.description,
    priceText: ov.priceText ?? enrichment.priceText,
  };
}

export async function getFestivalEnrichment(websiteUrl: string | null, slug: string): Promise<FestivalEnrichment> {
  if (!websiteUrl) return applyOverride(EMPTY, slug);
  // Short-circuit: if the override has the three user-visible fields
  // (image, description, price), skip the network fetch entirely. The
  // runtime extractor only existed to fill those — keeping it adds up
  // to ~7s navigation latency on the detail page because slow festival
  // sites stall the 6s timeout and then chase /lineup subpaths each
  // with their own timeout.
  const ov = OVERRIDES[slug];
  if (ov?.imageUrl && ov?.description && ov?.priceText) {
    return applyOverride(EMPTY, slug);
  }
  const cached = unstable_cache(
    async (url: string) => buildEnrichment(url),
    ['festival-enrichment', CACHE_VERSION, slug],
    { revalidate: 60 * 60 * 24, tags: [`festival-enrichment:${slug}`] },
  );
  const runtime = await cached(websiteUrl);
  return applyOverride(runtime, slug);
}
