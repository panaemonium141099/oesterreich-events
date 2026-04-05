# fn-8-fix-complete-all-unifhph-scrapers.3 New scrapers batch 1 — universities (MedUni IBK, Angewandte, MDW, KUG)

## Description
Create 4 new scrapers for Austrian universities that have no scraper yet.

**Size:** M
**Files:** New files in `src/lib/scrapers/uni/`: `MedUniInnsbruckScraper.ts`, `AngewandteWienScraper.ts`, `MDWWienScraper.ts`, `KUGGrazScraper.ts` + updates to `uni/index.ts`, `scrapers/index.ts`

## Approach

| Institution | source_name | Event URL | City | Bundesland |
|------------|-------------|-----------|------|-----------|
| Med Uni Innsbruck | meduni-innsbruck | `events.i-med.ac.at/all/` | Innsbruck | Tirol |
| Angewandte Wien | angewandte-wien | `dieangewandte.at/veranstaltungen` | Wien | Wien |
| MDW Wien | mdw-wien | `mdw.ac.at/6/` | Wien | Wien |
| KUG Graz | kug-graz | `kug.ac.at/veranstaltungen` | Graz | Steiermark |

For each new scraper:
1. Create file extending `UniBaseScraper` — set all abstract props (shortName, baseUrl, eventListUrl, city, bundesland, defaultLat, defaultLng)
2. Fetch the event URL, inspect HTML structure
3. Implement `scrape()` with JSON-LD first, HTML fallback pattern
4. Use `Map<string, ScrapedEvent>` for dedup by source_id
5. Export from `uni/index.ts` and register instance in `scrapers/index.ts`

Follow pattern at `src/lib/scrapers/uni/FHBurgenlandScraper.ts` (canonical working example).
## Acceptance
- [ ] MedUniInnsbruckScraper created and produces ≥1 event
- [ ] AngewandteWienScraper created and produces ≥1 event
- [ ] MDWWienScraper created and produces ≥1 event
- [ ] KUGGrazScraper created and produces ≥1 event
- [ ] All 4 scrapers exported from uni/index.ts
- [ ] All 4 scrapers registered in scrapers/index.ts
- [ ] `npx tsc --noEmit` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
