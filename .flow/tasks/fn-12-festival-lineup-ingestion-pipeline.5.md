# fn-12-festival-lineup-ingestion-pipeline.5 Second batch lineup scrapers (5 festivals)

## Description

Implement lineup scrapers for Isle of Summer, One Love, Woodstock der Blasmusik, Poolbar, and SBAM Fest. Follow `BaseLineupScraper` pattern from task 4 including collaborative booking splits.

**Size:** M
**Files:** `src/lib/lineup/scrapers/isle-of-summer.ts`, `src/lib/lineup/scrapers/one-love.ts`, `src/lib/lineup/scrapers/woodstock-blasmusik.ts`, `src/lib/lineup/scrapers/poolbar.ts`, `src/lib/lineup/scrapers/sbam-fest.ts`, `src/lib/lineup/scrapers/index.ts`

## Approach

- Each scraper extends `BaseLineupScraper`
- Create `src/lib/lineup/scrapers/index.ts` as registry mapping festival slug to scraper class
- **Collaborative booking split**: Same as task 4 -- `splitCollaborativeBooking()` produces multiple `FestivalArtist` entries per collaborative booking
- Isle of Summer: `https://www.isleofsummer.at/` -- homepage lineup
- One Love: `https://www.onelovefestival.at/lineup-programm/`
- Woodstock der Blasmusik: merge `kuenstlerinnen/` + `spielplan/` pages
- Poolbar: `https://www.poolbar.at/programm` -- filter music-only entries
- SBAM Fest: `https://fest.sbam.rocks/`

## Key context

- Woodstock der Blasmusik has TWO pages to merge
- Poolbar mixes concerts and cultural events -- filter for music
- The registry (`scrapers/index.ts`) maps slug to scraper class for the orchestrator

## Acceptance
- [ ] All 5 scrapers extract and normalize artist names
- [ ] Collaborative bookings split into separate entries
- [ ] `src/lib/lineup/scrapers/index.ts` exports registry mapping slug to scraper
- [ ] All 9 scrapers (4 from task 4 + 5 here) registered in index
- [ ] Woodstock der Blasmusik merges artists + timetable pages

## Done summary
Implemented 5 additional festival lineup scrapers (Isle of Summer, One Love, Woodstock der Blasmusik, Poolbar, SBAM Fest) and updated the barrel index to export all 9 scrapers plus a LINEUP_SCRAPER_REGISTRY mapping slug to constructor for the orchestrator.
## Evidence
- Commits: dfc62baa360e3aeafcc610898c3477700e752975
- Tests: npx vitest run src/__tests__/lineup/ (87 passed), npx tsc --noEmit (no errors in lineup scrapers)
- PRs: