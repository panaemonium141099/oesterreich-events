# fn-8-fix-complete-all-unifhph-scrapers.4 New scrapers batch 2 — FHs + Uni Salzburg URL fix (ITU, FH Technikum, FH OOE)

## Description
Create 3 new FH scrapers + fix Uni Salzburg URL (already has scraper, domain changed to plus.ac.at).

**Size:** M
**Files:** New files: `ITULinzScraper.ts`, `FHTechnikumWienScraper.ts`, `FHOOEScraper.ts` + fix `UniSalzburgScraper.ts` + updates to `uni/index.ts`, `scrapers/index.ts`

## Approach

### New scrapers:
| Institution | source_name | Event URL | City | Bundesland |
|------------|-------------|-----------|------|-----------|
| IT:U Linz | itu-linz | `it-u.at/en/events/` | Linz | OOE |
| FH Technikum Wien | fh-technikum-wien | `technikum-wien.at/events/` | Wien | Wien |
| FH OOE | fh-ooe | `fh-ooe.at/events` | Wels | OOE |

### Uni Salzburg URL fix:
UniSalzburgScraper already exists — update `baseUrl` and `eventListUrl` from `uni-salzburg.at` to `plus.ac.at/veranstaltungen/`. Keep `source_name: 'uni-salzburg'`.

### FH OOE multi-campus note:
FH OOE has campuses in Wels, Linz, Steyr, Hagenberg. Use Wels as defaultLat/defaultLng. If individual events mention campus in location text, the geocoding pipeline will resolve them.

Follow pattern at `src/lib/scrapers/uni/FHBurgenlandScraper.ts`.
## Acceptance
- [ ] ITULinzScraper created and produces ≥1 event
- [ ] FHTechnikumWienScraper created and produces ≥1 event
- [ ] FHOOEScraper created and produces ≥1 event
- [ ] UniSalzburgScraper updated to plus.ac.at and produces ≥1 event
- [ ] All new scrapers exported from uni/index.ts and registered in scrapers/index.ts
- [ ] `npx tsc --noEmit` passes
## Done summary
Created 3 new scrapers (ITULinzScraper, FHTechnikumWienScraper, FHOOEScraper) and fixed UniSalzburgScraper to use WP REST API since events load via AJAX. All scrapers produce events: ITU Linz 1, FH Technikum Wien 48, FH OOE 33, Uni Salzburg 92.
## Evidence
- Commits: eebdb566d62885f4ccff1d06769d34957734e156
- Tests: npx tsc --noEmit, npm test, npx tsx src/scripts/scrape.ts --source itu-linz, npx tsx src/scripts/scrape.ts --source fh-technikum-wien, npx tsx src/scripts/scrape.ts --source fh-ooe, npx tsx src/scripts/scrape.ts --source uni-salzburg
- PRs: