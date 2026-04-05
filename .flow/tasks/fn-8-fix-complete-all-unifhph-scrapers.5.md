# fn-8-fix-complete-all-unifhph-scrapers.5 Debug 0-event university scrapers

## Description
Debug university scrapers that have correct URLs but produce 0 events. The UniBaseScraper fixes from Task 1 (Event subtypes + parseDate abbreviations) may already fix some of these — re-run each scraper first to check before changing selectors.

**Size:** M
**Files:** `UniWienScraper.ts`, `UniGrazScraper.ts`, `UniInnsbruckScraper.ts`, `MedUniWienScraper.ts`, `DonauUniKremsScraper.ts`, `MozarteumScraper.ts`, `VetMedUniScraper.ts`, `AkBildScraper.ts`

## Approach
For each scraper:
1. Run `npx tsx src/scripts/scrape.ts --source <name>` — check if Task 1 fixes already resolved it
2. If still 0 events: fetch the URL manually, inspect HTML for JSON-LD and current selectors
3. If site returns 403/empty/redirect: check if site requires JS rendering (Puppeteer) — if so, note it and skip
4. If HTML changed: update CSS selectors in `scrape()` method
5. If JSON-LD is now available: switch to `parseJsonLdEvents()` first pattern

### Sites to check:
- `kalender.univie.ac.at` (UniWien) — TYPO3, likely has JSON-LD
- `uni-graz.at/de/veranstaltungen/` (UniGraz)
- `uibk.ac.at/de/events/` (UniInnsbruck)
- `meduniwien.ac.at/web/ueber-uns/events/` (MedUniWien)
- `donau-uni.ac.at/de/aktuelles/veranstaltungen.html` (DonauUni)
- `moz.ac.at/de/veranstaltungen` (Mozarteum)
- `vetmeduni.ac.at/veranstaltungen` (VetMedUni)
- `akbild.ac.at/de/veranstaltungen` (AkBild)
## Acceptance
- [ ] Each of the 8 university scrapers either produces ≥1 event OR is documented as requiring Puppeteer (deferred)
- [ ] CSS selectors updated where HTML structure changed
- [ ] JSON-LD parsing used where available
- [ ] `npx tsc --noEmit` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
