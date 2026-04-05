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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
