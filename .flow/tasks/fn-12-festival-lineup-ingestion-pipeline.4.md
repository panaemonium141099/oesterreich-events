# fn-12-festival-lineup-ingestion-pipeline.4 BaseLineupScraper and first 4 festival scrapers

## Description

Create `BaseLineupScraper` abstract class and implement lineup scrapers for Frequency, Nova Rock, Electric Love, and Shutdown. Each scraper extracts structured artist data, splits collaborative bookings, and produces one `FestivalArtist` per individual artist.

**Size:** M
**Files:** `src/lib/lineup/BaseLineupScraper.ts`, `src/lib/lineup/scrapers/frequency.ts`, `src/lib/lineup/scrapers/nova-rock.ts`, `src/lib/lineup/scrapers/electric-love.ts`, `src/lib/lineup/scrapers/shutdown.ts`

## Approach

- `BaseLineupScraper`: `fetchPage()` with retry/backoff (pattern from `BaseScraper.ts`), `rateLimit()`, abstract `scrapeLineup(html: string): FestivalArtist[]`, `run(festival: Festival): FestivalLineupResult`
- Return type `FestivalLineupResult`: `{ festivalId, artists: FestivalArtist[], scrapedAt, success, error? }`
- Each scraper: site-specific Cheerio selectors (standard `$().each()`, `$().map()`, `$(el).find().text().trim()` patterns -- no experimental extract() API)
- JSON-LD first (`$('script[type="application/ld+json"]')` + `JSON.parse()` for performer arrays), HTML fallback
- **Collaborative booking split**: For each raw artist name, call `splitCollaborativeBooking(raw)` from task 3. If it returns multiple entries (e.g., "A b2b B" -> ["A", "B"]), emit one `FestivalArtist` per individual artist. Each gets its own `artist_name_raw` (the individual name) and `artist_name_normalized` (via `normalizeArtistName()`).
- Set `confidence_score = 1.0`, `source_type = 'official_lineup'`

## Key context

- Frequency: `https://www.frequency.at/lineup/` -- day tabs
- Nova Rock: `https://www.novarock.at/lineup/` -- day sections
- Electric Love: `https://www.electriclove.at/en/line-up/` -- A-Z listing
- Shutdown: `https://www.shutdownfestival.at/en/line-up/` -- direct lineup
- Do NOT register in `src/lib/scrapers/index.ts` -- separate pipeline

## Acceptance
- [ ] `BaseLineupScraper` with `fetchPage()`, `rateLimit()`, abstract `scrapeLineup()`
- [ ] `FestivalLineupResult` return type
- [ ] Collaborative bookings split into separate `FestivalArtist` entries (one per artist)
- [ ] Each scraper extracts and normalizes artist names
- [ ] JSON-LD extraction attempted before HTML selector fallback
- [ ] Rate limiting (1-2s) between requests to same domain
- [ ] All 4 scrapers functional against current official lineup pages

## Done summary
Implemented BaseLineupScraper abstract class with fetchPage/retry/backoff, rateLimit, JSON-LD extraction, and collaborative booking processing; plus 4 festival scrapers (Frequency, Nova Rock, Electric Love via Algolia API, Shutdown) with scraper-local types and 30 unit tests.
## Evidence
- Commits: a8d393e084a44995bf8dad03582b235480fa4129
- Tests: npx vitest run src/__tests__/lineup/
- PRs: