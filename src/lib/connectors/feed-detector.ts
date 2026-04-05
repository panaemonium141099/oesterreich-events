/**
 * Feed Detector — Auto-discovers ICS, JSON-LD, and RSS/Atom event feeds
 * on venue websites.
 *
 * For each venue with a website URL, fetches the homepage and scans for:
 *  1. ICS: <link rel="alternate" type="text/calendar"> or href ending in .ics
 *  2. JSON-LD: <script type="application/ld+json"> containing Schema.org Event types
 *  3. RSS/Atom: <link rel="alternate" type="application/rss+xml|application/atom+xml">
 *
 * Priority order: ICS > JSON-LD > RSS (ICS gives structured calendar data,
 * JSON-LD gives rich Schema.org Events, RSS gives basic event info).
 *
 * Used by the registry-based scraper pipeline (fn-9) to determine which
 * connector to use for each venue's event ingestion.
 */

import * as cheerio from 'cheerio';
import type { EventFeedType } from '@/types/venues';

// ── Public types ────────────────────────────────────────────────────────────

export interface DetectedFeed {
  /** The feed type that was detected */
  type: EventFeedType;
  /** Absolute URL to the feed */
  url: string;
  /** Confidence: 'high' if detected via standard <link> tags, 'medium' if heuristic */
  confidence: 'high' | 'medium';
}

export interface FeedDetectionResult {
  /** All detected feeds, ordered by priority (ICS > JSON-LD > RSS) */
  feeds: DetectedFeed[];
  /** The best (highest-priority) feed, or null if none found */
  best: DetectedFeed | null;
  /** Number of JSON-LD blocks found (regardless of whether they contain Events) */
  jsonLdBlocksFound: number;
  /** Whether any JSON-LD block contains a Schema.org Event type */
  hasJsonLdEvents: boolean;
  /** Errors/warnings encountered during detection */
  errors: string[];
}

export interface FeedDetectorOptions {
  /** User-Agent header for HTTP requests */
  userAgent?: string;
  /** Request timeout in milliseconds (default: 15000) */
  timeoutMs?: number;
  /** Whether to follow redirects (default: true) */
  followRedirects?: boolean;
}

// ── Schema.org Event types ──────────────────────────────────────────────────

const EVENT_TYPES = new Set([
  'Event',
  'MusicEvent',
  'SportsEvent',
  'SocialEvent',
  'BusinessEvent',
  'ChildrensEvent',
  'ComedyEvent',
  'CourseInstance',
  'DanceEvent',
  'DeliveryEvent',
  'EducationEvent',
  'ExhibitionEvent',
  'Festival',
  'FoodEvent',
  'Hackathon',
  'LiteraryEvent',
  'PublicationEvent',
  'SaleEvent',
  'ScreeningEvent',
  'TheaterEvent',
  'VisualArtsEvent',
]);

// ── Core detection (pure function, no HTTP) ─────────────────────────────────

/**
 * Detect event feeds from raw HTML content.
 * This is a pure function -- it does not fetch any URLs.
 *
 * @param html The HTML content to scan
 * @param baseUrl The page URL, used to resolve relative feed URLs
 */
export function detectFeedsFromHtml(
  html: string,
  baseUrl: string,
): FeedDetectionResult {
  const result: FeedDetectionResult = {
    feeds: [],
    best: null,
    jsonLdBlocksFound: 0,
    hasJsonLdEvents: false,
    errors: [],
  };

  const $ = cheerio.load(html);

  // 1. Scan for ICS feeds
  detectIcsFeeds($, baseUrl, result);

  // 2. Scan for JSON-LD Event data
  detectJsonLdEvents($, baseUrl, result);

  // 3. Scan for RSS/Atom feeds
  detectRssFeeds($, baseUrl, result);

  // 4. Scan <a> links for .ics hrefs (heuristic fallback)
  detectIcsLinks($, baseUrl, result);

  // Set best feed (first in priority order)
  result.best = result.feeds.length > 0 ? result.feeds[0] : null;

  return result;
}

/**
 * Fetch a venue's website and detect event feeds.
 *
 * @param url The venue website URL to scan
 * @param options Detection options
 */
export async function detectFeeds(
  url: string,
  options: FeedDetectorOptions = {},
): Promise<FeedDetectionResult> {
  const {
    userAgent = 'BurgenlandEvents-FeedDetector/1.0 (educational project)',
    timeoutMs = 15000,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-AT,de;q=0.9,en;q=0.5',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        feeds: [],
        best: null,
        jsonLdBlocksFound: 0,
        hasJsonLdEvents: false,
        errors: [`HTTP ${response.status}: ${response.statusText} for ${url}`],
      };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return {
        feeds: [],
        best: null,
        jsonLdBlocksFound: 0,
        hasJsonLdEvents: false,
        errors: [`Non-HTML content type: ${contentType} for ${url}`],
      };
    }

    const html = await response.text();
    // Use the final URL (after redirects) as the base for resolving relative URLs
    const finalUrl = response.url || url;
    return detectFeedsFromHtml(html, finalUrl);
  } catch (err) {
    return {
      feeds: [],
      best: null,
      jsonLdBlocksFound: 0,
      hasJsonLdEvents: false,
      errors: [
        `Fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Resolve a potentially relative URL against a base URL.
 * Returns null if the URL is invalid.
 */
function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Check if a URL looks like an ICS calendar feed.
 */
function looksLikeIcsUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.endsWith('.ics') ||
    lower.includes('/calendar.ics') ||
    lower.includes('/events.ics') ||
    lower.includes('format=ical') ||
    lower.includes('format=ics') ||
    lower.includes('ical_export') ||
    lower.includes('webcal://')
  );
}

/**
 * Detect ICS feeds from <link> tags.
 */
function detectIcsFeeds(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  result: FeedDetectionResult,
): void {
  // Standard: <link rel="alternate" type="text/calendar" href="...">
  $('link[type="text/calendar"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const resolved = resolveUrl(href.replace(/^webcal:\/\//, 'https://'), baseUrl);
    if (resolved) {
      result.feeds.push({ type: 'ics', url: resolved, confidence: 'high' });
    }
  });

  // Also check for webcal:// protocol in link tags
  $('link[href^="webcal://"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const resolved = resolveUrl(href.replace(/^webcal:\/\//, 'https://'), baseUrl);
    if (resolved && !result.feeds.some((f) => f.url === resolved)) {
      result.feeds.push({ type: 'ics', url: resolved, confidence: 'high' });
    }
  });
}

/**
 * Detect JSON-LD Event data from <script type="application/ld+json"> blocks.
 */
function detectJsonLdEvents(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  result: FeedDetectionResult,
): void {
  $('script[type="application/ld+json"]').each((_, el) => {
    result.jsonLdBlocksFound++;
    const text = $(el).html();
    if (!text) return;

    try {
      const parsed = JSON.parse(text);
      if (containsEventType(parsed)) {
        result.hasJsonLdEvents = true;
      }
    } catch (err) {
      result.errors.push(
        `Failed to parse JSON-LD block: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  // If JSON-LD Events were found, add the page itself as a JSON-LD feed
  if (result.hasJsonLdEvents) {
    result.feeds.push({ type: 'json-ld', url: baseUrl, confidence: 'high' });
  }
}

/**
 * Detect RSS/Atom feeds from <link> tags.
 */
function detectRssFeeds(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  result: FeedDetectionResult,
): void {
  const rssTypes = [
    'application/rss+xml',
    'application/atom+xml',
    'application/xml',
  ];

  for (const type of rssTypes) {
    $(`link[type="${type}"]`).each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const resolved = resolveUrl(href, baseUrl);
      if (!resolved) return;

      // Only include if it looks event-related (heuristic: check title attribute)
      const title = ($(el).attr('title') || '').toLowerCase();
      const isEventRelated =
        title.includes('event') ||
        title.includes('veranstaltung') ||
        title.includes('termin') ||
        title.includes('kalender') ||
        title.includes('calendar') ||
        title.includes('programm');

      // For generic RSS feeds (no event keyword in title), still include but with medium confidence
      if (!result.feeds.some((f) => f.url === resolved)) {
        result.feeds.push({
          type: 'rss',
          url: resolved,
          confidence: isEventRelated ? 'high' : 'medium',
        });
      }
    });
  }
}

/**
 * Heuristic: scan <a> links for .ics file references.
 * Lower priority than <link> tag detection.
 */
function detectIcsLinks(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  result: FeedDetectionResult,
): void {
  // Skip if we already found ICS feeds via <link> tags
  if (result.feeds.some((f) => f.type === 'ics')) return;

  const seen = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    if (looksLikeIcsUrl(href)) {
      const resolved = resolveUrl(href.replace(/^webcal:\/\//, 'https://'), baseUrl);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        result.feeds.push({ type: 'ics', url: resolved, confidence: 'medium' });
      }
    }
  });

  // Re-sort so ICS feeds come before JSON-LD and RSS
  result.feeds.sort((a, b) => {
    const priority: Record<string, number> = { ics: 0, 'json-ld': 1, rss: 2 };
    return (priority[a.type] ?? 3) - (priority[b.type] ?? 3);
  });
}

/**
 * Recursively check if a parsed JSON-LD structure contains Schema.org Event types.
 */
function containsEventType(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  if (Array.isArray(data)) {
    return data.some((item) => containsEventType(item));
  }

  const obj = data as Record<string, unknown>;

  // Check @graph
  if (Array.isArray(obj['@graph'])) {
    return obj['@graph'].some((item: unknown) => containsEventType(item));
  }

  // Check @type
  const type = obj['@type'];
  if (typeof type === 'string' && EVENT_TYPES.has(type)) return true;
  if (Array.isArray(type) && type.some((t) => typeof t === 'string' && EVENT_TYPES.has(t))) return true;

  return false;
}
