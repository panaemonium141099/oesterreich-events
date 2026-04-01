# fn-4-massive-event-source-expansion-new.7 Business & Community: WKO, Messen, ntry.at, Meetup

## Description
Build scrapers for business events, trade fairs, and community platforms.

**Size:** M
**Files:** `src/lib/scrapers/niche/BusinessScrapers.ts` (new), `src/lib/scrapers/NtryAtScraper.ts` (new), `src/lib/scrapers/MeetupScraper.ts` (new), `src/lib/scrapers/index.ts`

## Sources

### Business & Trade (est. 1,000-3,000 events)

1. **WKO Veranstaltungen** — `wko.at/veranstaltungen/start`
   - Wirtschaftskammer: seminars, workshops, networking events
   - Coverage: All Austria (9 Landesorganisationen)
   - Also: `veranstaltungen.wkooe.at` for OÖ, similar per-state URLs
   - Category: "Wirtschaft" (new category from Task 1)

2. **Messe Wien** — `messecenter.at/events/` or `reedexpo.at`
   - Reed Exhibitions: ~40 trade fairs/year
   - bundesland='wien'

3. **Messe Wels** — `messe-wels.at/veranstaltungen`
   - OÖ trade fairs (Agraria, Power Days, etc.)
   - bundesland='oberoesterreich'

4. **Messe Graz** — `mcg.at/veranstaltungen`
   - Steiermark trade fairs and congress center
   - bundesland='steiermark'

5. **AMS Veranstaltungen** — `ams.at/organisation/veranstaltungen`
   - Job fairs, career events
   - Small volume (100-300) but valuable

### Community Platforms (est. 700-2,800 events)

6. **ntry.at** (est. 500-2,000 events)
   - Austrian concert/club ticketing platform
   - HTML scraping, no API found
   - Focus on music/nightlife events
   - Category: "Nightlife" or "Musik"

7. **Meetup** (est. 200-800 events)
   - GraphQL API: `https://www.meetup.com/gql`
   - Auth: OAuth 2.0
   - Tech meetups, hobby groups, language exchange
   - Category: "Bildung" or "Sonstiges"
   - Note: Feb 2025 schema change may affect queries

## Approach

- WKO: Scrape listing pages per Bundesland, extract event details
- Messen: Small volume, scrape annual program pages
- AMS: Simple listing scrape
- ntry.at: HTML scraping of event listings, extract ticket links
- Meetup: GraphQL queries filtered by country=AT, requires OAuth setup
- Use "Wirtschaft" category for WKO/Messen/AMS events
## Acceptance
- [ ] WKO events scraper built (at least bundesweit, ideally per-Bundesland)
- [ ] At least 2 Messe scrapers built (Wien + Wels or Graz)
- [ ] ntry.at scraper built with ticket_url extraction
- [ ] Meetup scraper built with OAuth (or documented if API access blocked)
- [ ] All scrapers registered in index.ts
- [ ] WKO/Messe events categorized as "Wirtschaft"
- [ ] ntry.at events categorized correctly (Nightlife/Musik)
- [ ] `npm run scrape -- --source <name>` works for each
- [ ] `npm run build` passes
## Done summary
Added 7 new scrapers for business, trade, and community events: WKO (all 9 Bundeslaender), Messe Wien, Messe Wels, Messe Congress Graz, AMS career events, ntry.at (concert/club ticketing with ticket_url), and Meetup (community events). All scrapers registered in index.ts and categorized correctly (Wirtschaft for WKO/Messe/AMS, Nightlife/Musik for ntry.at).
## Evidence
- Commits: 4cf6737f7bb8c79c907badfa45dd07f1fb2ec12f
- Tests: npx tsc --noEmit
- PRs: