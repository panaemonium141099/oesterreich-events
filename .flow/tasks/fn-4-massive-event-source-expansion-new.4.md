# fn-4-massive-event-source-expansion-new.4 Media Portal Scrapers: tips.at + bergfex.at + RSS Feeds

## Description
Build scrapers for Austrian media event portals and RSS feeds that have structured event data.

**Size:** M
**Files:** `src/lib/scrapers/TipsAtScraper.ts` (new), `src/lib/scrapers/BergfexScraper.ts` (new), `src/lib/scrapers/niche/RSSEventScrapers.ts` (new), `src/lib/scrapers/index.ts`

## Sources

### 1. tips.at/events (est. 100-500+ events, OÖ focus)
- Listing: `https://tips.at/events` with AJAX POST for "load more" pagination
- Detail pages have JSON-LD `@type: Event` schema (startDate, Place, Offer, etc.)
- AJAX endpoint uses params: `last`, `lastid`, `page`, `filter`
- Method: Cheerio — list page crawl + detail page JSON-LD extraction
- Integrates with OeTicket so has ticket URLs and images

### 2. bergfex.at/veranstaltungen (est. 200-250 events, outdoor/mountain)
- URL: `https://www.bergfex.at/sommer/oesterreich/veranstaltungen/`
- Pagination: `?page=N` (5 pages, 45-50 per page)
- Detail: `/[region]/veranstaltungen/[id]/`
- No JSON-LD but structured HTML with date, location, region, description
- Method: Cheerio — straightforward pagination + detail page parsing
- Coverage: All Austria, outdoor/mountain/sport niche

### 3. stadtbekannt.at RSS (est. 4-8 events, Wien)
- RSS: `https://stadtbekannt.at/feed/` (RSS 2.0 with content:encoded)
- WordPress site, Wien cultural events
- Method: RSS/XML parsing via Cheerio

### 4. regionews.at RSS (est. varies)
- RSS: `https://www.regionews.at/rss/general.news.rss.php`
- Regional news with some event announcements
- Method: RSS/XML parsing, filter for event-like content

## Approach

- Follow niche scraper barrel pattern at `src/lib/scrapers/niche/`
- tips.at: Reverse-engineer AJAX POST endpoint, crawl listing, parse JSON-LD on detail pages
- bergfex.at: Simple page-by-page crawl with Cheerio, set category to "Natur" or "Sport"
- RSS scrapers: Parse RSS XML, extract event fields from item elements
- Set bundesland from source data (tips.at = "oberoesterreich", bergfex = varies by region)
## Acceptance
- [ ] TipsAtScraper built with AJAX pagination + JSON-LD detail parsing
- [ ] BergfexScraper built with page-based pagination
- [ ] RSS scrapers for stadtbekannt.at and regionews.at built
- [ ] All scrapers registered in index.ts
- [ ] Each scraper returns valid ScrapedEvent[] with stable source_ids
- [ ] bundesland correctly set from source data
- [ ] Images extracted where available
- [ ] `npm run scrape -- --source <name>` works for each
- [ ] `npm run build` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
