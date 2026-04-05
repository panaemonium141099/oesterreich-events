# fn-8-fix-complete-all-unifhph-scrapers.2 Complex URL fixes — domain renames and structural changes

## Description
Fix 7 scrapers with complex URL changes: domain renames, different subdomains, or fundamentally different page structures (e.g., JSP).

**Size:** M
**Files:** `AAUScraper.ts`, `MedUniGrazScraper.ts`, `FHStPoeltenScraper.ts`, `KunstUniLinzScraper.ts`, `FHBFIWienScraper.ts`, `FHBurgenlandScraper.ts`, `FHWienWKWScraper.ts`

## Approach

| Scraper | Change | New URL |
|---------|--------|---------|
| AAUScraper | Different system (JSP) | `campus.aau.at/va/va_liste.jsp` |
| MedUniGrazScraper | Different subdomain | `medunigraz.at/en/events-1` |
| FHStPoeltenScraper | **Domain renamed** fhstp→ustp | `ustp.at/de/stories/events` |
| KunstUniLinzScraper | **Domain renamed** kunstuni-linz→ufg | `events.ufg.at/` |
| FHBFIWienScraper | Path fix | `/en/pages/veranstaltungen` |
| FHBurgenlandScraper | DE URL | `hochschule-burgenland.at/ueber-uns/events/uebersicht/` |
| FHWienWKWScraper | DE URL | `/veranstaltungen/` |

For each: update `eventListUrl` (and `baseUrl` if domain changed), fetch new URL, inspect HTML/JSON-LD, rewrite `scrape()` method if page structure is fundamentally different.

## Key context
- AAU uses a JSP system — pagination may be `?offset=N` or POST-based, not `?page=N`
- Domain renames (FH St. Poelten, KunstUni Linz): keep same `source_name` and `shortName`. Old events with old source_ids will expire naturally via date validation.
- FHBurgenlandScraper currently scrapes EN URL — switch to DE for better user experience
## Acceptance
- [ ] AAU scraper produces ≥1 event from campus.aau.at JSP system
- [ ] MedUni Graz scraper produces ≥1 event
- [ ] FH St. Poelten scraper works with new ustp.at domain
- [ ] KunstUni Linz scraper works with new events.ufg.at domain
- [ ] FH BFI Wien scraper produces ≥1 event
- [ ] FH Burgenland scraper produces ≥1 event from DE URL
- [ ] FH Wien WKW scraper produces ≥1 event
- [ ] `npx tsc --noEmit` passes
## Done summary
Fixed 7 complex uni/FH scrapers: AAU Klagenfurt (new JSP system, 42 events), MedUni Graz (new domain + .article-eventcalendar parsing, 10 events), FH St. Poelten (domain rename fhstp->ustp, 6 events), KunstUni Linz (domain rename kunstuni-linz->ufg + SSL bypass, 13 events), FH BFI Wien (.event-wrapper parsing, 16 events), FH Burgenland (DE URL + .toggle-box parsing, 1 event), FH Wien WKW (DE URL + WordPress parsing, 21 events). All produce >=1 event, tsc passes, 156 tests pass.
## Evidence
- Commits: 470192e73057778e5f261a57b16065a89b07cee8
- Tests: npx tsc --noEmit, npm test (156 passed), npx tsx src/scripts/scrape.ts --source aau-klagenfurt (42 events), npx tsx src/scripts/scrape.ts --source meduni-graz (10 events), npx tsx src/scripts/scrape.ts --source fh-stpoelten (6 events), npx tsx src/scripts/scrape.ts --source kunstuni-linz (13 events), npx tsx src/scripts/scrape.ts --source fh-bfi-wien (16 events), npx tsx src/scripts/scrape.ts --source fh-burgenland (1 event), npx tsx src/scripts/scrape.ts --source fh-wien-wkw (21 events)
- PRs: