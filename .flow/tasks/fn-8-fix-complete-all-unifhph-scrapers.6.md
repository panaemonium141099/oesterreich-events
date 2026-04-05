# fn-8-fix-complete-all-unifhph-scrapers.6 Debug 0-event FH scrapers

## Description
Debug FH scrapers that have correct URLs but produce 0 events. Same approach as Task 5 — check if Task 1 fixes resolved them first.

**Size:** M
**Files:** `FHVorarlbergScraper.ts`, `FHKaerntenScraper.ts`, `FHSalzburgScraper.ts`, `FHKufsteinScraper.ts`, `FHJoanneumScraper.ts`, `Campus02Scraper.ts`, `MCIScraper.ts`, `FernFHScraper.ts`, `FHWNScraper.ts`, `HCWScraper.ts`, `IMCKremsScraper.ts`

## Approach
For each scraper:
1. Run `npx tsx src/scripts/scrape.ts --source <name>` — check if already working after Task 1
2. If still 0: fetch URL, inspect HTML structure, fix selectors
3. If site requires JS rendering: note as Puppeteer-deferred
4. If JSON-LD available: prefer it over HTML parsing

### Sites to check:
- `fhv.at/en/fh/the-fhv/events` (FH Vorarlberg)
- `fh-kaernten.at/aktuelles/veranstaltungen` (FH Kaernten)
- `fh-salzburg.ac.at/en/about-fh-salzburg/news-and-events/events` (FH Salzburg)
- `fh-kufstein.ac.at/service/events` (FH Kufstein)
- `fh-joanneum.at/en/university/events/` (FH Joanneum)
- `campus02.at/en/news-events/events/` (Campus02)
- `mci.edu/en/events` (MCI)
- `fernfh.ac.at/veranstaltungen` (FernFH)
- `fhwn.ac.at/en/events` (FHWN)
- `hcw.ac.at/alle-events` (HCW)
- `imc.ac.at/en/about-us/media-press/events/` (IMC Krems)
## Acceptance
- [ ] Each of the 11 FH scrapers either produces ≥1 event OR is documented as Puppeteer-deferred
- [ ] CSS selectors updated where HTML structure changed
- [ ] `npx tsc --noEmit` passes
## Done summary
Fixed 5 FH scrapers (FHWN, MCI, FH Salzburg, IMC Krems, HCW) with site-specific CSS selectors matching actual server-rendered HTML structure, producing 100 total events. Documented 6 scrapers (FH Vorarlberg, FH Kaernten, FH Kufstein, FH Joanneum, Campus02, FernFH) as Puppeteer-deferred since their event data is loaded via client-side JavaScript.
## Evidence
- Commits: aa7a7c79eb1f2ac98f7de99565422eae642ddfa1
- Tests: npx tsc --noEmit, npm test, npx tsx src/scripts/scrape.ts --source fh-wiener-neustadt, npx tsx src/scripts/scrape.ts --source mci-innsbruck, npx tsx src/scripts/scrape.ts --source fh-salzburg, npx tsx src/scripts/scrape.ts --source imc-krems, npx tsx src/scripts/scrape.ts --source hcw-wien, npx tsx src/scripts/scrape.ts --source fh-vorarlberg, npx tsx src/scripts/scrape.ts --source fh-kaernten, npx tsx src/scripts/scrape.ts --source fh-kufstein, npx tsx src/scripts/scrape.ts --source fh-joanneum, npx tsx src/scripts/scrape.ts --source campus02-graz, npx tsx src/scripts/scrape.ts --source fernfh-wien-neustadt
- PRs: