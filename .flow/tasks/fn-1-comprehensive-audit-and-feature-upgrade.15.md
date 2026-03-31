# fn-1-comprehensive-audit-and-feature-upgrade.15 Regional and Niche Event Sources

## Description
Add event scrapers for niche categories and underrepresented regions. Implement scrapers for festivals, nightlife/clubs, outdoor/sport, culture/theater, food/markets, and family events. Research and document regional coverage gaps.

**Size:** M
**Files:** src/lib/scrapers/niche/ (new directory), src/lib/scrapers/index.ts, src/lib/categories.ts, next.config.ts

## Approach
- Analyze current regional coverage by examining existing 44 scrapers' geographic focus
- Research event sources for each niche category:
  - **Festivals**: festival.at, festivalguide.at, oeticket.com festival section
  - **Nightlife/Clubs**: resident advisor Austria, club websites in major cities
  - **Outdoor/Sport**: naturfreunde.at, alpenverein.at, running events, sport event calendars
  - **Culture/Theater**: bundestheater.at, landestheater websites, museum event pages
  - **Food/Markets**: bauernmarkt listings, street food festival calendars, wine event sites
  - **Family**: familiii.at, family event aggregators, zoo/park event pages
- Create `src/lib/scrapers/niche/` directory
- Implement at least 2 scrapers per niche category (12+ total)
- Add niche-specific keywords to `categorizeEvent()` in `src/lib/categories.ts`
- Add new tags to the category system: "Festival", "Nightlife", "Outdoor", "Sport", "Theater", "Museum", "Markt", "Familie"
- Register in index.ts, add image domains to next.config.ts

## Key context
- Current scrapers already cover: burgenland.info, burgenland.at, events.at, meinbezirk.at, and ~40 other Austrian sources
- The platform already has 41K+ events — niche scrapers add depth, not breadth
- Niche sources may have different update frequencies (festivals: monthly, clubs: weekly)
- Some niche sources (oeticket) require Puppeteer — implement with Cheerio first, skip JS-rendered pages
- The `categorizeEvent()` function in `src/lib/categories.ts` uses keyword matching with priorities — add new keywords for niche categories
## Acceptance
- [ ] Regional coverage analysis documented (gaps identified)
- [ ] At least 2 scrapers per niche category (12+ total)
- [ ] New tags added: Festival, Nightlife, Outdoor, Sport, Theater, Museum, Markt, Familie
- [ ] `categorizeEvent()` updated with niche keywords
- [ ] All scrapers registered and following BaseScraper pattern
- [ ] Image domains added to remotePatterns
- [ ] `npm run build` succeeds
## Done summary
Added 12 niche event scrapers across 6 categories (Festival, Nightlife, Outdoor/Sport, Culture/Theater, Food/Markets, Family) in a new src/lib/scrapers/niche/ directory. Enhanced categorizeEvent() with niche-specific keywords and registered all scrapers in the main index with category tags (Festival, Nightlife, Outdoor, Sport, Theater, Kultur, Markt, Familie). Documented regional coverage gaps in docs/regional-coverage-analysis.md.
## Evidence
- Commits: d6ae7d4afea530ef2f8f92a94b4f57b09dd6fdf7
- Tests: npx tsc --noEmit (0 errors in niche scrapers), npm run build (succeeded)
- PRs: