# fn-4-massive-event-source-expansion-new.2 Tourism API Scrapers: tourdata.at + Wien OGD + Wien-Ticket

## Description
Build scrapers for the highest-volume API-based tourism sources. These are the biggest potential volume sources identified in research.

**Size:** M
**Files:** `src/lib/scrapers/TourDataScraper.ts` (new), `src/lib/scrapers/WienOGDScraper.ts` (new), `src/lib/scrapers/WienTicketScraper.ts` (new), `src/lib/scrapers/index.ts`

## Sources

### 1. tourdata.at / austria.info API (est. 3,000-10,000 events)
- API: `https://oew.tourdata.at/api/dataspace/GetJsonProxy.php?ApiKey=[key]&ObjectType=Veranstaltung&County=Osterreich`
- License: CC-BY 4.0 (Open Data)
- Auth: API key (contact api@austria.info or check if public)
- Aggregates events from all regional tourism organizations (LTOs)
- If API key not freely available, try the public endpoint first, or scrape tourism pages directly

### 2. data.gv.at Wien Veranstaltungen (est. 2,000-5,000 events)
- Dataset: https://www.data.gv.at/katalog/dataset/stadt-wien_veranstaltungenwien
- Format: CSV/JSON/RSS download, no auth needed
- License: CC-BY 4.0
- Source: City of Vienna (data.wien.gv.at)
- Check for REST API endpoint or direct download URL

### 3. Wien-Ticket OGD (est. 1,000-3,000 events)
- Listed on data.opendataportal.at with REST API endpoint
- Vienna cultural events, theater, concerts
- Check actual data format and availability

## Approach

- Follow BaseScraper pattern at `src/lib/scrapers/BaseScraper.ts`
- For API sources: use `fetchPage()` with JSON parsing
- Set bundesland='wien' for Wien sources, derive from data for tourdata.at
- Extract coordinates when available in source data (tourdata.at likely includes geo)
- Set ticket_url when available
- Generate deterministic source_id from event URL or unique ID in source data
- Register all scrapers in `src/lib/scrapers/index.ts`
## Acceptance
- [ ] TourDataScraper built and returns valid ScrapedEvent[] (or documented reason if API unavailable)
- [ ] WienOGDScraper built, downloads and parses Wien events open data
- [ ] WienTicketScraper built (or merged with WienOGD if same source)
- [ ] All scrapers registered in index.ts
- [ ] Each scraper has stable source_id generation for dedup
- [ ] Coordinates extracted from source data where available
- [ ] ticket_url populated where source provides it
- [ ] `npm run scrape -- --source <name>` works for each new scraper
- [ ] `npm run build` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
