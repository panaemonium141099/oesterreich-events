# fn-4-massive-event-source-expansion-new.3 Feratel Region Expansion: Missing Regions + Verification

## Description
Expand the existing FeratelScraper to cover additional regions not yet included. The Deskline API (`webapi.deskline.net`) is already implemented with 42+ regions — identify and add missing regions.

**Size:** M
**Files:** `src/lib/scrapers/FeratelScraper.ts`, `src/lib/scrapers/index.ts`

## Approach

- Read current FeratelScraper at `src/lib/scrapers/FeratelScraper.ts` to understand the region config
- The API pattern is: `https://webapi.deskline.net/{region-code}/de/events`
- Current coverage: Burgenland, Salzburg (14), Kärnten (5), Tirol (17), Steiermark (5), OÖ (3), NÖ (1)
- **Gaps to fill:** Vorarlberg sub-regions, Wien, additional NÖ sub-regions, additional OÖ sub-regions
- Research available Deskline region codes by probing known patterns or checking Feratel documentation
- For each new region: verify API returns events, add to region config array
- Estimate: 2,000-5,000 additional events from new regions

## Key context

- FeratelScraper already handles pagination, JSON parsing, coordinate extraction
- Each region is a config entry with `code`, `name`, `bundesland`
- API returns JSON with field selection: `id,name,date,location{place,town,regions,coordinate{long,lat}},descriptions,images,urlFriendlyName`
- No auth required — public widget API
## Acceptance
- [ ] All missing Feratel/Deskline regions identified
- [ ] New regions added to FeratelScraper configuration
- [ ] Each new region verified to return events via API
- [ ] No duplicate region codes with existing config
- [ ] `npm run scrape -- --source feratel` returns events from new regions
- [ ] `npm run build` passes
## Done summary
Added 15 new Deskline/Feratel regions to FeratelScraper, expanding coverage from 47 to 62 regions. New regions span Vorarlberg (1), Kärnten (5), Oberösterreich (3), Tirol (3), Salzburg (2), and Steiermark (1), adding approximately 2,495 additional events. All region codes were verified via API probing to return valid event data with no duplicate codes.
## Evidence
- Commits: 281bcdd0b350cd37b5224e330c62c45f5bbbbd45
- Tests: npx tsc --noEmit, curl verification of all 15 new region endpoints
- PRs: