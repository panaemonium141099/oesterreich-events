# fn-1-comprehensive-audit-and-feature-upgrade.13 University and FH Scrapers Batch 1

## Description
Implement event scrapers for the first batch of Austrian universities (largest/most active institutions). Follow the existing BaseScraper pattern. Each scraper should extract events with titles, dates, locations, descriptions, images, and assign appropriate tags using the new multi-tag system.

**Size:** M
**Files:** src/lib/scrapers/uni/ (new directory), src/lib/scrapers/index.ts, data/uni-event-sources.json, next.config.ts

## Approach
- Read `data/uni-event-sources.json` to identify the first 15 institutions to implement
- Create `src/lib/scrapers/uni/` directory for university scrapers
- For each institution: create a scraper extending BaseScraper — implement `scrape()` to fetch event pages
- Follow existing scraper patterns: use Cheerio for HTML parsing, JSON-LD extraction where available
- Assign tags: at minimum `["Bildung"]`, plus additional tags based on event content (e.g., "Konzert", "Sport", "Kultur")
- Register new scrapers in `src/lib/scrapers/index.ts` — add to the scrapers array
- Add rate limiting: `this.rateLimit(1000)` between requests per BaseScraper convention
- Add image domains to `next.config.ts` remotePatterns for university websites
- Respect `robots.txt` for each domain — skip if disallowed
- Priority institutions (by student count): Uni Wien, TU Wien, Uni Graz, Uni Innsbruck, WU Wien, MedUni Wien, BOKU, TU Graz, Uni Salzburg, Uni Linz (JKU), Uni Klagenfurt, MedUni Graz, Montanuni Leoben, Kunstuni Linz, Vetmeduni Wien

## Key context
- BaseScraper at `src/lib/scrapers/BaseScraper.ts` provides: `fetchPage()` with retry/backoff, `rateLimit()`, `cleanImageUrl()`, `log()`
- Scrapers write to SQLite via `src/lib/db/queries.ts` upsert with `source_id` deduplication
- `data/uni-event-sources.json` has 40+ entries with URLs and scraping metadata
- New scrapers should use the multi-tag system from task 7 (assign `tags: string[]`)
## Acceptance
- [ ] 15 university scrapers implemented following BaseScraper pattern
- [ ] All scrapers registered in `src/lib/scrapers/index.ts`
- [ ] Each scraper: extracts title, date, location, description, image
- [ ] Each scraper: assigns multiple tags including "Bildung"
- [ ] Rate limiting implemented (1000ms between requests)
- [ ] robots.txt checked for each domain
- [ ] Image domains added to next.config.ts remotePatterns
- [ ] At least 10 scrapers successfully extract events when run
- [ ] `npm run build` succeeds
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
