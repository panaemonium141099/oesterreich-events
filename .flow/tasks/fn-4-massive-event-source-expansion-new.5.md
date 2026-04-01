# fn-4-massive-event-source-expansion-new.5 Kultur-Institutionen: Theater, Konzerthaeuser, Museen

## Description
Build scrapers for major Austrian cultural institutions: theaters, concert halls, and museums. These are high-quality events with rich metadata (images, descriptions, ticket URLs).

**Size:** M
**Files:** `src/lib/scrapers/niche/TheaterScrapers.ts` (extend existing or new file), `src/lib/scrapers/niche/MuseumScrapers.ts` (new), `src/lib/scrapers/index.ts`

## Sources

### Theaters & Concert Halls (est. 1,000-2,000 performances)

1. **Wiener Staatsoper** — `wiener-staatsoper.at/en/calendar/{year}/{month}/`
   - Month-by-month calendar pages, likely JSON-LD Event schema
   - opera, ballet performances, bundesland='wien'

2. **Burgtheater** — `burgtheater.at/spielplan`
   - Season calendar, structured HTML
   - Theater performances, bundesland='wien'

3. **Volksoper Wien** — `volksoper.at/spielplan`
   - Operetta, musical, opera, bundesland='wien'

4. **Konzerthaus Wien** — `konzerthaus.at/spielplan`
   - Classical, jazz, world music concerts, bundesland='wien'

5. **Musikverein Wien** — `musikverein.at/en/spielplan`
   - Classical concerts, Neujahrskonzert venue, bundesland='wien'

### Museums (est. 500-2,000 events/exhibitions)

6. **Kunsthistorisches Museum** — `khm.at/besuchen/veranstaltungen/`
7. **Albertina** — `albertina.at/ausstellungen/`
8. **MUMOK** — `mumok.at/de/veranstaltungen`
9. **Belvedere** — `belvedere.at/veranstaltungen`
10. **Naturhistorisches Museum** — `nhm-wien.ac.at/veranstaltungen`
11. **Technisches Museum** — `technischesmuseum.at/veranstaltungen`
12. **Leopold Museum** — `leopoldmuseum.org/de/ausstellungen`
13. **Ars Electronica Center** — `ars.electronica.art/center/de/programm/`

## Approach

- Follow existing niche scraper pattern at `src/lib/scrapers/niche/CultureTheaterScrapers.ts`
- Note: BundestheaterScraper and TheaterAtScraper already exist — check what they cover first, avoid overlap
- For theaters: scrape monthly calendar/Spielplan pages, look for JSON-LD first
- For museums: scrape events/Veranstaltungen pages, distinguish exhibitions (longer duration) from single events
- All Wien institutions: set bundesland='wien', use known venue coordinates
- Extract ticket_url where available (most institutions sell tickets)
- Category: "Kultur" for theater/opera, "Kunst" or "Kultur" for museums
## Acceptance
- [ ] At least 5 theater/concert hall scrapers built (Staatsoper, Burgtheater, Volksoper, Konzerthaus, Musikverein)
- [ ] At least 5 museum scrapers built (KHM, Albertina, MUMOK, Belvedere, NHM + others)
- [ ] No overlap with existing BundestheaterScraper/TheaterAtScraper (verified before building)
- [ ] All scrapers registered in index.ts
- [ ] ticket_url populated where source provides it
- [ ] venue coordinates hardcoded for known institutions
- [ ] Categories correctly assigned (Kultur, Kunst)
- [ ] Images extracted from event/exhibition pages
- [ ] `npm run scrape -- --source <name>` works for each
- [ ] `npm run build` passes
## Done summary
Added 10 new cultural institution scrapers: 2 concert houses (Konzerthaus Wien, Musikverein Wien) and 8 museums (KHM, Albertina, MUMOK, Belvedere, NHM, Technisches Museum, Leopold Museum, Ars Electronica Center Linz). All scrapers use hardcoded venue coordinates, extract ticket_url, and are registered in index.ts. No overlap with existing BundestheaterScraper (which covers Staatsoper, Burgtheater, Volksoper).
## Evidence
- Commits: 33beddfd765fa5fbd989d30f8637fd9b4a7dd6cb
- Tests: npx tsc --noEmit, npm test (127 passed), npm run build (compiled successfully)
- PRs: