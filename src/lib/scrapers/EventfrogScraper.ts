/**
 * EventfrogScraper — eventfrog.{at,ch,de} Schema.org Event ingest.
 *
 * Eventfrog (originally Swiss, with .at + .de presence) is the same
 * source `wasmachma.at` uses for its event widget — visible via the
 * `connect-src https://api.eventfrog.net` line in their CSP header.
 *
 * Discovery:
 *   robots.txt at https://eventfrog.at/robots.txt declares the sitemap at
 *   http://eventfrog.ch/myinterfaces/cms/googlesitemap-overview.xml,
 *   which is a sitemap-index listing 12 gzipped XML files split by
 *   language. The `de-1`, `de-2`, `de-3` files contain ~150k URLs covering
 *   AT + CH + DE events (the host portion of each URL switches per event).
 *
 * Strategy:
 *   1. Fetch the 3 de-N.xml.gz sitemaps, decompress, collect all <loc> URLs.
 *   2. Heuristically filter to AT-related URLs (host=eventfrog.at OR slug
 *      contains an Austrian city/Bundesland). This drops ~70% of the set
 *      before any HTTP work — Eventfrog AT slice is roughly 30k URLs.
 *   3. Walk each URL, fetch HTML, extract Schema.org Event JSON-LD.
 *   4. Verify via location.address.addressCountry === 'AT' (or postal code
 *      starts with a 4-digit Austrian range). Drop non-AT events.
 *
 * Rate limit: no published crawl-delay. We use 1.5s default and cap at
 * MAX_EVENTS_PER_RUN per run; subsequent runs continue.
 */
import * as cheerio from 'cheerio';
import { gunzipSync } from 'zlib';
import { BaseScraper } from './BaseScraper';
import { extractEventsFromHtml } from '../connectors/json-ld-connector';
import type { ScrapedEvent } from '@/types/events';

const SITEMAP_INDEX_URL =
  'http://eventfrog.ch/myinterfaces/cms/googlesitemap-overview.xml';
const CRAWL_DELAY_MS = 1500;
const MAX_EVENTS_PER_RUN = 5000;

/** German-language sitemap files we care about. We skip fr/it/en because
 *  AT events are typically German-tagged. */
const GERMAN_SITEMAP_PATTERN = /eventfrog\.ch-de-\d+\.xml\.gz$/i;

/** Austrian heuristics for URL slugs — used as a coarse pre-filter to avoid
 *  fetching ~100k Swiss/German URLs. The verify step (JSON-LD location)
 *  confirms each event is actually in Austria. */
const AT_KEYWORDS = [
  // Major cities
  'wien', 'vienna', 'graz', 'salzburg', 'innsbruck', 'linz', 'klagenfurt',
  'bregenz', 'eisenstadt', 'st-poelten', 'sankt-poelten',
  // Bundesländer
  'burgenland', 'kaernten', 'kärnten', 'niederoesterreich', 'niederösterreich',
  'oberoesterreich', 'oberösterreich', 'steiermark', 'tirol',
  'vorarlberg',
  // Touristy regions
  'gastein', 'zillertal', 'oetztal', 'pinzgau', 'pongau', 'lungau',
  'kitzbuehel', 'kitzbühel', 'soelden', 'sölden', 'stubai',
  'salzkammergut', 'wachau', 'neusiedl', 'schladming', 'mariazell',
  'attersee', 'wolfgangsee', 'mondsee', 'bregenzerwald',
  'oesterreich', 'österreich', 'austria',
];

const AT_KEYWORD_RE = new RegExp(
  '(?:^|[/-])(?:' + AT_KEYWORDS.join('|') + ')(?:[/-]|$)',
  'i',
);

export class EventfrogScraper extends BaseScraper {
  readonly name = 'eventfrog';
  protected userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  protected delayMs = CRAWL_DELAY_MS;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte eventfrog scrape (AT slice via DE sitemaps)…');

    // 1. Fetch sitemap index, pick German sub-sitemaps
    const indexXml = await this.fetchPage(SITEMAP_INDEX_URL);
    const subSitemaps = this.parseSitemapXml(indexXml).filter((u) =>
      GERMAN_SITEMAP_PATTERN.test(u),
    );
    this.log(`${subSitemaps.length} de-Sub-Sitemaps gefunden`);

    // 2. Walk sub-sitemaps, collect candidate URLs
    const candidateUrls = new Set<string>();
    for (const sub of subSitemaps) {
      try {
        const urls = await this.fetchAndDecompressSitemap(sub);
        const eventLikes = urls.filter((u) => /\/p\/[a-z-]+\//i.test(u));
        const atLikes = eventLikes.filter(
          (u) => /https?:\/\/eventfrog\.at\//i.test(u) || AT_KEYWORD_RE.test(u),
        );
        atLikes.forEach((u) => candidateUrls.add(u));
        this.log(`  ${sub.split('/').pop()}: ${eventLikes.length} event URLs, ${atLikes.length} AT-like`);
      } catch (err) {
        this.log(`  Sub-Sitemap-Fehler ${sub}: ${err instanceof Error ? err.message : err}`);
      }
      await this.rateLimit();
    }
    this.log(`${candidateUrls.size} eindeutige AT-Kandidat-URLs`);

    // 3. Fetch each candidate, verify it's actually AT, extract events
    const events: ScrapedEvent[] = [];
    const cap = Math.min(candidateUrls.size, MAX_EVENTS_PER_RUN);
    const urls = Array.from(candidateUrls);
    let fetchErrors = 0;
    let nonAtSkipped = 0;
    let parseEmpty = 0;

    for (let i = 0; i < cap; i++) {
      const url = urls[i];
      try {
        const html = await this.fetchPage(url);
        const result = extractEventsFromHtml(html, url, null);
        if (result.events.length === 0) {
          parseEmpty++;
        } else {
          // Drop non-AT events (sitemap heuristic catches a lot of CH/DE
          // events with city names that overlap Austria — e.g. "salzburg"
          // appears in DE festivals named "Salzburger…" too).
          const atEvents = result.events.filter((e) => this.looksAustrian(e));
          nonAtSkipped += result.events.length - atEvents.length;
          for (const e of atEvents) {
            e.source_name = this.name;
            if (!e.source_url) e.source_url = url;
            events.push(e);
          }
        }
      } catch (err) {
        fetchErrors++;
        if (fetchErrors <= 5 || (i + 1) % 100 === 0) {
          this.log(`  [${i + 1}/${cap}] FEHLER ${url}: ${err instanceof Error ? err.message : err}`);
        }
      }
      if ((i + 1) % 50 === 0) {
        this.log(`  Fortschritt: ${i + 1}/${cap} (${events.length} AT-Events, ${nonAtSkipped} non-AT verworfen)`);
      }
      await this.rateLimit();
    }

    this.log(
      `Fertig: ${events.length} AT-Events von ${cap} URLs ` +
      `(${nonAtSkipped} non-AT verworfen, ${parseEmpty} ohne JSON-LD, ${fetchErrors} Fetch-Fehler)`,
    );
    return events;
  }

  /** Fetch a gzipped sitemap, gunzip, return all <loc> URLs. */
  private async fetchAndDecompressSitemap(url: string): Promise<string[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': this.userAgent, 'Accept-Encoding': 'gzip' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // The .xml.gz might be served pre-decompressed by the CDN (some
      // Apache configs auto-deflate based on Accept-Encoding). Detect
      // the gzip magic number 1f 8b and only gunzip if it's actually
      // compressed.
      const isGzip = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
      const xml = isGzip ? gunzipSync(buf).toString('utf-8') : buf.toString('utf-8');
      return this.parseSitemapXml(xml);
    } finally {
      clearTimeout(timer);
    }
  }

  private parseSitemapXml(xml: string): string[] {
    const $ = cheerio.load(xml, { xmlMode: true });
    const urls: string[] = [];
    $('loc').each((_, el) => {
      const url = $(el).text().trim();
      if (url) urls.push(url);
    });
    return urls;
  }

  /** Heuristic: is this event in Austria? Based on JSON-LD location data
   *  the connector already extracted. */
  private looksAustrian(e: ScrapedEvent): boolean {
    // 1. Explicit Austrian Bundesland from connector
    if (e.bundesland) {
      const bl = e.bundesland.toLowerCase();
      if (/burgenland|kaernten|kärnten|niederoesterreich|niederösterreich|oberoesterreich|oberösterreich|salzburg|steiermark|tirol|vorarlberg|wien/.test(bl)) {
        return true;
      }
    }
    // 2. Austrian PLZ — 4 digits starting with 1-9, narrowly ranged.
    //    Swiss PLZ are also 4 digits but start 1-9 too, so PLZ alone is
    //    insufficient. Combine with country hint.
    if (e.postal_code && /^[1-9]\d{3}$/.test(e.postal_code)) {
      // Address mentions Austrian city/region
      if (e.address && /(österreich|austria|wien|graz|salzburg|innsbruck|linz|klagenfurt|bregenz|eisenstadt)/i.test(e.address)) {
        return true;
      }
    }
    // 3. URL host = eventfrog.at — strong signal
    if (e.source_url && /eventfrog\.at/i.test(e.source_url)) return true;

    // Default reject — better miss a real AT event than pollute the DB
    // with Swiss/German events.
    return false;
  }
}
