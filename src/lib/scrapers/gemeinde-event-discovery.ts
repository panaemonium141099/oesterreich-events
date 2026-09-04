/**
 * Gemeinde event-page discovery + universal event-list parser.
 *
 * Many gemeinden in GEM2GO_GEMEINDEN migrated off gem2go (74% in our test
 * sample) to WordPress, TYPO3, custom CMSes. There's no universal URL path —
 * Eisenstadt uses /freizeit/veranstaltungskalender/, Donnerskirchen uses
 * /donnerskirchen/der-ort/veranstaltungen/, etc. So we discover dynamically:
 *
 *   1. Fetch homepage
 *   2. Extract every <a href> with "veranstalt|event|termin|kalender" in href or text
 *   3. HEAD-check + score candidates (URL keyword priority, then content)
 *   4. Parse the winning page with a universal extractor (Schema.org JSON-LD →
 *      microdata → tribe-events plugin → regex fallback)
 *
 * Returns ScrapedEvent[] or [] if nothing parseable found. Always silent on
 * errors — a broken site must not block the rest of the batch.
 */

import * as cheerio from 'cheerio';
import type { ScrapedEvent } from '@/types/events';
import { categorizeEvent } from '../categorize';

// Score by URL keyword. Collection paths (events ending in /) score higher
// than calendar variants (heurigenkalender is NOT what we want). Specific event
// subpages (events/adventmeile) get a penalty applied later.
const KEYWORD_PRIORITY: Record<string, number> = {
  veranstaltungen: 100,
  events: 95,
  termine: 90,
  veranstaltung: 85,
  veranstaltungskalender: 70,
  kalender: 30,
  aktuelles: 20,
  news: 10,
};

// Common URL paths to brute-force probe before fancier discovery.
const COMMON_EVENT_PATHS = [
  '/veranstaltungen',
  '/veranstaltungen/',
  '/events',
  '/events/',
  '/termine',
  '/termine/',
  '/aktuelles/veranstaltungen',
  '/tourismus/veranstaltungen',
  '/tourismus/events',
  '/tourismus/termine',
  '/gemeinde/veranstaltungen',
  '/buergerservice/veranstaltungen',
  '/freizeit/veranstaltungen',
  '/freizeit/veranstaltungskalender',
  '/leben/veranstaltungen',
  '/kultur/veranstaltungen',
];

// Section pages worth crawling 1-level deeper for event links.
const SECTION_PATHS = ['/tourismus', '/gemeinde', '/freizeit', '/leben', '/kultur', '/aktuelles', '/buergerservice'];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface FetchResult {
  ok: boolean;
  status: number;
  html?: string;
  finalUrl?: string;
}

async function fetchHtml(url: string, timeoutMs = 8000): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-AT,de;q=0.9,en;q=0.5',
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (!res.ok) return { ok: false, status: res.status };
    const html = await res.text();
    return { ok: true, status: res.status, html, finalUrl: res.url };
  } catch {
    return { ok: false, status: 0 };
  }
}

// ─── Step 1: Discover event-list URL ──────────────────────────────────────────

interface Candidate {
  url: string;
  score: number;
  anchorText: string;
}

/**
 * Detail-page link picker: rejects mailto:/tel:/javascript:/share/print/fragment-only
 * hrefs that often dominate as the "first <a>" inside event tiles.
 * Exportiert, damit die Gemeinde-Scraper dieselbe Definition von
 * "Kontakt-Anchor" nutzen statt je eigene Teilmengen zu pflegen.
 */
export function isUsableDetailHref(href: string | undefined): href is string {
  if (!href) return false;
  const lower = href.trim().toLowerCase();
  if (lower.startsWith('mailto:')) return false;
  if (lower.startsWith('tel:')) return false;
  if (lower.startsWith('javascript:')) return false;
  if (lower.startsWith('#')) return false;
  if (/[?&](share|print|mail)=/i.test(href)) return false;
  return true;
}

function pickDetailHref($container: cheerio.Cheerio<any>): string | undefined {
  // Prefer hrefs that look like event detail URLs (contain keywords)
  // before falling back to "first usable href".
  const candidates: string[] = [];
  $container.find('a[href]').each((_, a) => {
    const href = (a as any).attribs?.href ?? '';
    if (isUsableDetailHref(href)) candidates.push(href);
  });
  if (candidates.length === 0) return undefined;
  const preferred = candidates.find((h) => /event|veranstalt|termin|detail/i.test(h));
  return preferred ?? candidates[0];
}

function scoreUrl(href: string, anchorText: string): number {
  const hrefLower = href.toLowerCase();
  const textLower = anchorText.toLowerCase();
  let score = 0;
  for (const [kw, weight] of Object.entries(KEYWORD_PRIORITY)) {
    if (hrefLower.includes(kw)) score = Math.max(score, weight);
  }
  for (const [kw, weight] of Object.entries(KEYWORD_PRIORITY)) {
    if (textLower.includes(kw)) score = Math.max(score, Math.floor(weight * 0.5));
  }
  if (score === 0) return 0;

  // Penalty: looks like a SPECIFIC event subpage (e.g. /events/adventmeile, /veranstaltungen/sommerfest-2026)
  // — collection URLs end with veranstaltungen/ or events/, specific ones have a trailing slug.
  const path = (() => {
    try {
      return new URL(href, 'http://x').pathname;
    } catch {
      return hrefLower;
    }
  })();
  const segments = path.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? '';
  const collectionEnders = ['veranstaltungen', 'events', 'termine', 'veranstaltungskalender', 'kalender'];
  if (segments.length >= 2 && !collectionEnders.includes(lastSegment)) {
    // Path goes /tourismus/events/adventmeile → adventmeile isn't a collection
    // BUT if the URL has events/ in path AND has further slug, it's specific
    const hasEventCollectionEarlier = segments.slice(0, -1).some((s) => collectionEnders.includes(s));
    if (hasEventCollectionEarlier) score = Math.floor(score * 0.4);
  }
  // Boost when URL ends in collection
  if (collectionEnders.includes(lastSegment)) score = Math.floor(score * 1.2);

  return score;
}

// Pull event URLs out of /sitemap.xml when present. Many WordPress / TYPO3
// installations expose every event URL in the sitemap even when the human-
// navigable menu doesn't link to a clean collection page.
async function urlsFromSitemap(baseUrl: string): Promise<string[]> {
  const res = await fetchHtml(`${baseUrl}/sitemap.xml`, 6000);
  if (!res.ok || !res.html) return [];
  const matches = res.html.match(/<loc>([^<]+)<\/loc>/g);
  if (!matches) return [];
  const urls = matches
    .map((m) => m.replace(/<\/?loc>/g, ''))
    .filter((u) => /veranstalt|event|termin|kalender/i.test(u));
  // Prefer collection-like URLs (shorter paths, end with veranstaltungen/events)
  return urls.sort((a, b) => a.length - b.length).slice(0, 5);
}

export async function discoverEventListUrl(homepageUrl: string): Promise<{ url: string; eventCount: number } | null> {
  const baseUrl = homepageUrl.replace(/\/+$/, '');

  // Strategy A: brute-force common event paths in parallel.
  const probes = await Promise.all(
    COMMON_EVENT_PATHS.map(async (p) => {
      const u = `${baseUrl}${p}`;
      const res = await fetchHtml(u, 6000);
      if (!res.ok || !res.html) return null;
      return { url: res.finalUrl ?? u, html: res.html };
    }),
  );
  const probeHits = probes.filter((p): p is { url: string; html: string } => p !== null);

  // Strategy B: homepage link discovery
  const home = await fetchHtml(homepageUrl);
  const candidates: Candidate[] = [];
  let homeHost = '';
  if (home.ok && home.html) {
    const $ = cheerio.load(home.html);
    homeHost = new URL(home.finalUrl ?? homepageUrl).host;
    $('a').each((_, a) => {
      const href = $(a).attr('href');
      if (!href) return;
      const text = $(a).text().trim();
      const s = scoreUrl(href, text);
      if (s === 0) return;
      let abs: string;
      try {
        abs = new URL(href, home.finalUrl ?? homepageUrl).href;
      } catch {
        return;
      }
      if (!abs.startsWith('http')) return;
      let final = s;
      if (new URL(abs).host !== homeHost) final = Math.floor(final * 0.6);
      candidates.push({ url: abs, score: final, anchorText: text.slice(0, 60) });
    });
  }

  // Strategy C: 1-level deep section pages (if no good candidates yet)
  if (candidates.filter((c) => c.score >= 80).length === 0) {
    const sectionProbes = await Promise.all(
      SECTION_PATHS.map(async (p) => {
        const u = `${baseUrl}${p}`;
        const res = await fetchHtml(u, 6000);
        if (!res.ok || !res.html) return null;
        return { url: res.finalUrl ?? u, html: res.html };
      }),
    );
    for (const sec of sectionProbes) {
      if (!sec) continue;
      const $ = cheerio.load(sec.html);
      $('a').each((_, a) => {
        const href = $(a).attr('href');
        if (!href) return;
        const text = $(a).text().trim();
        const s = scoreUrl(href, text);
        if (s === 0) return;
        let abs: string;
        try {
          abs = new URL(href, sec.url).href;
        } catch {
          return;
        }
        if (!abs.startsWith('http')) return;
        let final = s;
        if (homeHost && new URL(abs).host !== homeHost) final = Math.floor(final * 0.6);
        candidates.push({ url: abs, score: final, anchorText: text.slice(0, 60) });
      });
    }
  }

  // Merge probe hits as high-priority candidates (they already responded 200)
  for (const p of probeHits) {
    candidates.push({ url: p.url, score: scoreUrl(p.url, ''), anchorText: '[probe]' });
  }

  // Strategy D: sitemap.xml — last-ditch source for event URLs the menu hides.
  if (candidates.filter((c) => c.score >= 80).length === 0) {
    const sitemapUrls = await urlsFromSitemap(baseUrl);
    for (const u of sitemapUrls) {
      candidates.push({ url: u, score: scoreUrl(u, '') || 50, anchorText: '[sitemap]' });
    }
  }

  if (candidates.length === 0) return null;

  // Dedupe + sort
  const dedup = new Map<string, Candidate>();
  for (const c of candidates) {
    const ex = dedup.get(c.url);
    if (!ex || c.score > ex.score) dedup.set(c.url, c);
  }
  const sorted = Array.from(dedup.values()).sort((a, b) => b.score - a.score);

  // Try top 8 candidates. For each: fetch, parse events, return the one with
  // most events (not just first passing event-shape — the parser is the truth).
  let best: { url: string; eventCount: number } | null = null;
  for (const cand of sorted.slice(0, 8)) {
    const res = await fetchHtml(cand.url, 6000);
    if (!res.ok || !res.html) continue;
    const events = parseEventList(res.html, res.finalUrl ?? cand.url);
    if (events.length > 0 && (!best || events.length > best.eventCount)) {
      best = { url: res.finalUrl ?? cand.url, eventCount: events.length };
    }
  }
  // If absolutely nothing parsed events, still return the highest-scored URL
  // so the caller can attempt with a different strategy.
  if (!best && sorted[0]) return { url: sorted[0].url, eventCount: 0 };
  return best;
}

function hasEventShape(html: string): boolean {
  // Cheap heuristics — any of these strongly suggest an event listing:
  if (/"@type":\s*"Event"/i.test(html)) return true;
  if (/itemtype="https?:\/\/schema\.org\/Event"/i.test(html)) return true;
  if (/tribe-events|tribe-event|event-card|event-list|veranstaltung-item|eventon-events/i.test(html)) return true;
  // 3+ German date matches on the page
  const dateMatches = html.match(
    /\d{1,2}\.\s*(Jänner|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}|\d{1,2}\.\d{1,2}\.20\d{2}/g,
  );
  if (dateMatches && dateMatches.length >= 3) return true;
  return false;
}

// ─── Step 2: Universal event-list parser ──────────────────────────────────────

export interface ParsedEvent {
  title: string;
  start_date: string;
  end_date?: string;
  description?: string;
  location_name?: string;
  address?: string;
  postal_code?: string;
  image_url?: string;
  source_url?: string;
  organizer?: string;
}

export function parseEventList(html: string, listingUrl: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];

  // Layer 1: JSON-LD Event array
  $('script[type="application/ld+json"]').each((_, s) => {
    const raw = $(s).text();
    if (!raw) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const items = unwrapJsonLd(parsed);
    for (const item of items) {
      const evt = jsonLdToEvent(item, listingUrl);
      if (evt) events.push(evt);
    }
  });
  if (events.length > 0) return dedupeEvents(events);

  // Layer 2: microdata
  $('[itemtype*="schema.org/Event"]').each((_, el) => {
    const $el = $(el);
    const title = $el.find('[itemprop="name"]').first().text().trim();
    const startRaw = $el.find('[itemprop="startDate"]').first().attr('content')
      ?? $el.find('[itemprop="startDate"]').first().text().trim();
    if (!title || !startRaw) return;
    const start = normalizeDate(startRaw);
    if (!start) return;
    const link = pickDetailHref($el);
    const detailUrl = link ? new URL(link, listingUrl).href : undefined;
    const location = $el.find('[itemprop="location"] [itemprop="name"]').first().text().trim() || undefined;
    const street = $el.find('[itemprop="streetAddress"]').first().text().trim() || undefined;
    const plz = $el.find('[itemprop="postalCode"]').first().text().trim() || undefined;
    const desc = $el.find('[itemprop="description"]').first().text().trim() || undefined;
    const image = $el.find('[itemprop="image"]').first().attr('src') || $el.find('[itemprop="image"]').first().attr('content');
    events.push({
      title,
      start_date: start,
      description: desc,
      location_name: location,
      address: street,
      postal_code: plz,
      source_url: detailUrl,
      image_url: image,
    });
  });
  if (events.length > 0) return dedupeEvents(events);

  // Layer 3: tribe-events (The Events Calendar — WP plugin)
  $('.tribe-events-calendar-list__event, .tribe-events-loop .type-tribe_events').each((_, el) => {
    const $el = $(el);
    const title = $el.find('.tribe-events-calendar-list__event-title, .tribe-event-url').first().text().trim();
    const dt = $el.find('time[datetime]').first().attr('datetime');
    if (!title || !dt) return;
    const start = normalizeDate(dt);
    if (!start) return;
    const linkRaw = $el.find('a.tribe-event-url, .tribe-events-calendar-list__event-title a').first().attr('href');
    const link = isUsableDetailHref(linkRaw) ? linkRaw : undefined;
    const detailUrl = link ? new URL(link, listingUrl).href : undefined;
    const venue = $el.find('.tribe-events-venue-details, .tribe-events-calendar-list__event-venue').first().text().trim() || undefined;
    const desc = $el.find('.tribe-events-calendar-list__event-description').first().text().trim() || undefined;
    const image = $el.find('img').first().attr('src');
    events.push({ title, start_date: start, source_url: detailUrl, location_name: venue, description: desc, image_url: image });
  });
  if (events.length > 0) return dedupeEvents(events);

  // Layer 4.5: scan ALL <script> bodies for embedded Event JSON. Catches
  // Squarespace (Bocksdorf), Wix, custom React/Vue apps that embed initial
  // state. We look for shapes that contain both a date-ish field AND a
  // title-ish field. Skipped scripts: > 200kb (full bundle dumps).
  $('script').each((_, s) => {
    const raw = $(s).text();
    if (!raw || raw.length > 200_000) return;
    // Fast prefilter — only attempt parse if string mentions a date field
    if (!/"startDate"|"start_date"|"date"\s*:\s*"\d/.test(raw)) return;
    // Try direct JSON parse first
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Some scripts wrap JSON inside assignments. Pull the first {...} or [...]
      const m = raw.match(/[{[][\s\S]*[}\]]/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          // ignore
        }
      }
    }
    if (!parsed) return;
    const found = recursivelyFindEvents(parsed, listingUrl);
    for (const f of found) events.push(f);
  });
  if (events.length > 0) return dedupeEvents(events);

  // Layer 4: generic — repeating articles or list items with date+title
  $('article, li.event, .event, .veranstaltung').each((_, el) => {
    const $el = $(el);
    const heading = $el.find('h2, h3, h4').first();
    const title = heading.text().trim();
    if (!title || title.length < 3) return;
    const text = $el.text();
    const start = extractGermanDate(text);
    if (!start) return;
    const link = pickDetailHref($el);
    const detailUrl = link ? new URL(link, listingUrl).href : undefined;
    const image = $el.find('img').first().attr('src');
    const fullImg = image ? new URL(image, listingUrl).href : undefined;
    events.push({
      title,
      start_date: start,
      source_url: detailUrl,
      image_url: fullImg,
    });
  });
  return dedupeEvents(events);
}

// Recursively walk a parsed JSON tree, collecting any object that looks like
// an event (has startDate + title/name/summary). Caps recursion depth + count.
function recursivelyFindEvents(
  node: unknown,
  baseUrl: string,
  depth = 0,
  out: ParsedEvent[] = [],
): ParsedEvent[] {
  if (depth > 8 || out.length > 200) return out;
  if (Array.isArray(node)) {
    for (const x of node) recursivelyFindEvents(x, baseUrl, depth + 1, out);
    return out;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const title =
      (typeof obj.title === 'string' && obj.title) ||
      (typeof obj.name === 'string' && obj.name) ||
      (typeof obj.summary === 'string' && obj.summary) ||
      null;
    const startRaw =
      (typeof obj.startDate === 'string' && obj.startDate) ||
      (typeof obj.start_date === 'string' && obj.start_date) ||
      (typeof obj.date === 'string' && obj.date) ||
      (typeof obj.startDateLocal === 'string' && obj.startDateLocal) ||
      // Squarespace events store unix-ms timestamps
      (typeof obj.startDate === 'number' && new Date(obj.startDate).toISOString()) ||
      null;
    if (title && startRaw && typeof title === 'string') {
      const start = normalizeDate(String(startRaw));
      if (start) {
        const desc =
          typeof obj.description === 'string'
            ? stripHtml(obj.description)
            : typeof obj.body === 'string'
              ? stripHtml(obj.body)
              : undefined;
        // Image fields vary wildly; try common ones
        let image: string | undefined;
        const imgCands = [obj.image, obj.imageUrl, obj.assetUrl, obj.thumbnail];
        for (const c of imgCands) {
          if (typeof c === 'string') { image = c; break; }
          if (Array.isArray(c) && typeof c[0] === 'string') { image = c[0]; break; }
        }
        let url: string | undefined;
        const urlCands = [obj.fullUrl, obj.url, obj.permalink, obj.link];
        for (const c of urlCands) {
          if (typeof c === 'string') {
            try {
              url = new URL(c, baseUrl).href;
              break;
            } catch {
              // ignore
            }
          }
        }
        const loc = obj.location;
        let venue: string | undefined;
        if (loc && typeof loc === 'object') {
          const l = loc as Record<string, unknown>;
          if (typeof l.name === 'string') venue = l.name;
          else if (typeof l.addressTitle === 'string') venue = l.addressTitle;
        }
        out.push({
          title: title.trim(),
          start_date: start,
          description: desc,
          image_url: image,
          source_url: url,
          location_name: venue,
        });
      }
    }
    for (const v of Object.values(obj)) {
      recursivelyFindEvents(v, baseUrl, depth + 1, out);
    }
  }
  return out;
}

function unwrapJsonLd(parsed: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(parsed)) {
    return parsed.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object');
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj['@graph'])) {
      return (obj['@graph'] as unknown[]).filter(
        (x): x is Record<string, unknown> => x !== null && typeof x === 'object',
      );
    }
    return [obj];
  }
  return [];
}

function jsonLdToEvent(item: Record<string, unknown>, listingUrl: string): ParsedEvent | null {
  const t = item['@type'];
  const isEvent =
    t === 'Event' ||
    (typeof t === 'string' && t.toLowerCase().includes('event')) ||
    (Array.isArray(t) && t.some((x) => typeof x === 'string' && x.includes('Event')));
  if (!isEvent) return null;
  const name = item.name;
  const startDate = item.startDate;
  if (typeof name !== 'string' || typeof startDate !== 'string') return null;
  const start = normalizeDate(startDate);
  if (!start) return null;

  let image: string | undefined;
  if (typeof item.image === 'string') image = item.image;
  else if (Array.isArray(item.image) && typeof item.image[0] === 'string') image = item.image[0];

  let url: string | undefined;
  if (typeof item.url === 'string') {
    try {
      url = new URL(item.url, listingUrl).href;
    } catch {
      // ignore
    }
  }

  const loc = Array.isArray(item.location) ? item.location[0] : item.location;
  let venue: string | undefined;
  let street: string | undefined;
  let plz: string | undefined;
  if (loc && typeof loc === 'object') {
    const l = loc as Record<string, unknown>;
    if (typeof l.name === 'string') venue = l.name;
    const addr = l.address;
    if (addr && typeof addr === 'object') {
      const a = addr as Record<string, unknown>;
      if (typeof a.streetAddress === 'string') street = a.streetAddress;
      if (typeof a.postalCode === 'string') plz = a.postalCode;
      else if (typeof a.postalCode === 'number') plz = String(a.postalCode);
    }
  }

  const desc = typeof item.description === 'string' ? stripHtml(item.description) : undefined;

  return {
    title: name.trim(),
    start_date: start,
    description: desc,
    location_name: venue,
    address: street,
    postal_code: plz,
    image_url: image,
    source_url: url,
  };
}

const MONTHS_DE: Record<string, string> = {
  'jänner': '01', 'januar': '01', 'jan': '01',
  'februar': '02', 'feb': '02',
  'märz': '03', 'mar': '03', 'mär': '03',
  'april': '04', 'apr': '04',
  'mai': '05',
  'juni': '06', 'jun': '06',
  'juli': '07', 'jul': '07',
  'august': '08', 'aug': '08',
  'september': '09', 'sep': '09',
  'oktober': '10', 'okt': '10',
  'november': '11', 'nov': '11',
  'dezember': '12', 'dez': '12',
};

function normalizeDate(input: string): string | null {
  // Already ISO-ish "2026-05-20T..."
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
    const d = new Date(input);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  // Generic Date constructor (handles RFC2822, ISO-with-tz)
  const d = new Date(input);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    if (y >= 2024 && y <= 2030) return d.toISOString();
  }
  return extractGermanDate(input);
}

function extractGermanDate(text: string): string | null {
  // "25. Juli 2026" or "25. Jul 2026" or "25.7.2026"
  let m = text.match(/(\d{1,2})\.\s*(Jänner|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Jan|Feb|Mär|Apr|Jun|Jul|Aug|Sep|Okt|Nov|Dez)\.?\s+(\d{4})/i);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = MONTHS_DE[m[2].toLowerCase().replace('.', '')];
    if (month) {
      const y = parseInt(m[3], 10);
      if (y >= 2024 && y <= 2030) return `${m[3]}-${month}-${day}`;
    }
  }
  m = text.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    return `${m[3]}-${month}-${day}`;
  }
  return null;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function dedupeEvents(events: ParsedEvent[]): ParsedEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = `${e.title.toLowerCase()}|${e.start_date.slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Step 3: Combined helper for scraper integration ──────────────────────────

export async function discoverAndParseGemeindeEvents(
  homepageUrl: string,
): Promise<{ events: ParsedEvent[]; eventListUrl: string | null }> {
  const discovered = await discoverEventListUrl(homepageUrl);
  if (!discovered) return { events: [], eventListUrl: null };
  // discoverEventListUrl already parsed during candidate evaluation, but we
  // re-parse here so the caller gets the events plus the URL in one round.
  const res = await fetchHtml(discovered.url);
  if (!res.ok || !res.html) return { events: [], eventListUrl: discovered.url };
  const events = parseEventList(res.html, res.finalUrl ?? discovered.url);
  return { events, eventListUrl: discovered.url };
}

export function asScrapedEvent(
  parsed: ParsedEvent,
  gemeinde: { name: string; plz: string; bezirk: string; bundesland: string; lat: number; lng: number; gkz: string },
): ScrapedEvent {
  const slug = parsed.title
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return {
    source_id: `gemeinde-${gemeinde.gkz}-${slug}-${parsed.start_date.slice(0, 10)}`,
    source_name: 'gemeinde-fallback',
    source_url: parsed.source_url ?? null,
    title: parsed.title,
    description: parsed.description,
    start_date: parsed.start_date,
    end_date: parsed.end_date,
    location_name: parsed.location_name || gemeinde.name,
    address: parsed.address,
    postal_code: parsed.postal_code || gemeinde.plz,
    bundesland: gemeinde.bundesland,
    district: gemeinde.bezirk,
    latitude: gemeinde.lat,
    longitude: gemeinde.lng,
    image_url: parsed.image_url,
    organizer: parsed.organizer,
    category: categorizeEvent(parsed.title, parsed.description),
  };
}
