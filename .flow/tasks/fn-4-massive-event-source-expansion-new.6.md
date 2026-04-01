# fn-4-massive-event-source-expansion-new.6 Sport & Outdoor: Alpenverein Branches + Sportverbaende

## Description
Build scrapers for Austrian sports and outdoor event sources beyond the existing Alpenverein/Naturfreunde scrapers.

**Size:** M
**Files:** `src/lib/scrapers/niche/SportScrapers.ts` (new), `src/lib/scrapers/niche/OutdoorSportScrapers.ts` (extend), `src/lib/scrapers/index.ts`

## Sources

### Alpenverein Expanded (est. 1,500-3,000 events)
1. **oeav-events.at** — aggregated ÖAV events across all branches
   - Tours, courses, hikes, climbing events
   - Multiple Sektionen (branches) across Austria
   - Check if existing AlpenvereinScraper already covers this
   - If not: scrape the aggregated events page

### Sports Federations (est. 500-2,000 events)
2. **ÖFB / Bundesliga** — Austrian football matches
   - openfootball project (GitHub) has free Austrian league data
   - OR scrape oefb.at/spielplan directly
   - ~300-500 matches/season across Bundesliga, 2. Liga, ÖFB Cup

3. **laufen.at / running events** — running races, marathons
   - Austrian running calendar
   - Marathons, trail runs, fun runs

4. **ski events / FIS calendar** — ski races, events at ski resorts
   - Winter sport events in Tirol, Salzburg, Vorarlberg, Steiermark, Kärnten
   - fis-ski.com has Austrian events

5. **rad-net.at** — cycling events
   - Road races, MTB events, gravel events

## Approach

- First check existing OutdoorSportScrapers.ts for Alpenverein/Naturfreunde coverage
- Follow niche scraper pattern
- For sports: set category to "Sport"
- For outdoor: set category to "Natur" or "Sport" based on activity
- Extract coordinates from source data (many outdoor events have GPS data)
- bundesland derived from event location
## Acceptance
- [ ] Alpenverein coverage expanded (verify current AlpenvereinScraper, add branches if needed)
- [ ] At least 3 sport federation scrapers built (football, running, cycling or ski)
- [ ] No overlap with existing Naturfreunde/Alpenverein scrapers
- [ ] All scrapers registered in index.ts
- [ ] Category correctly set to "Sport" or "Natur"
- [ ] Coordinates extracted where available
- [ ] `npm run scrape -- --source <name>` works for each
- [ ] `npm run build` passes
## Done summary
Added 5 sport federation scrapers: OeAVEventsScraper (expanded Alpenverein Sektionen coverage), LaufenAtScraper (running calendar), RadNetScraper (cycling events), OeFBScraper (football matches with stadium coordinates), and RunnersFunScraper (running/triathlon backup). All registered in index.ts with category "Sport" and appropriate tags.
## Evidence
- Commits: 5deeab03799eb9fe42f1d08d71119a109ccb4354
- Tests: npx tsc --noEmit
- PRs: