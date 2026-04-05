# fn-8-fix-complete-all-unifhph-scrapers.7 Debug PH scrapers + docs/UI updates

## Description
Debug all 7 PH scrapers (in PHScrapers.ts) and update documentation + SourceFilter UI to reflect all new/fixed scrapers.

**Size:** M
**Files:** `src/lib/scrapers/uni/PHScrapers.ts`, `src/components/Filters/SourceFilter.tsx`, `CLAUDE.md`, `CHANGELOG.md`

## Approach

### PH scrapers (all in PHScrapers.ts):
7 config-only subclasses sharing PHBaseScraper's `scrape()` + `parseHtml()`. Debug the shared parsing logic:
- `ph-noe` → `ph-noe.ac.at/de/ph-noe/veranstaltungen`
- `ph-salzburg` → `phsalzburg.at/termine/`
- `ph-kaernten` → `phk.ac.at/ueber-uns/medien-kommunikation/events`
- `ph-burgenland` → `ph-burgenland.at/termine`
- `kph-wien` → `kphvie.ac.at/termine.html`
- `pph-augustinum-graz` → `pph-augustinum.at/kalender/`
- `kph-edith-stein` → `kph-es.at/kph-edith-stein/termine/`

Note: PH sites may have seasonal calendars (empty during semester break). A scraper producing 0 events in April may be correct.

### SourceFilter regex update:
Add missing prefixes to SOURCE_GROUP_RULES "Universitäten & FH" pattern in `SourceFilter.tsx` line 14:
- Add: `angewandte-|mdw-|kug-|itu-`

### CLAUDE.md updates:
- Update scraper count from `~126` to actual count after all new scrapers
- Update `41 University/FH/PH scrapers` to actual count
- Add new source_names to Scraper-Quellen section if relevant

### CHANGELOG.md:
- Add new section for fn-8 following existing pattern (see fn-7 section as template)
## Acceptance
- [ ] PHBaseScraper parseHtml() selectors verified against current PH site structures
- [ ] PH scrapers producing events where sites have upcoming events listed
- [ ] SourceFilter regex includes angewandte-, mdw-, kug-, itu- prefixes
- [ ] CLAUDE.md scraper counts updated to reflect new totals
- [ ] CHANGELOG.md has fn-8 section documenting all changes
- [ ] `npx tsc --noEmit` passes
- [ ] All 156+ tests pass
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
