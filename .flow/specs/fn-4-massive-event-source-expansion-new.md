# Massive Event Source Expansion - New Niches & APIs

## Overview

Triple the event count from ~36k to ~108k by adding new event source niches across Austria. Research identified ~15-35k achievable new events from untapped sources across 6 niches: Tourism APIs, Media Portals, Cultural Institutions, Sports/Outdoor, Business/Trade, and Open Data portals.

**Current state:** 98 scrapers, ~36k events (Unis, Clubs, Gemeinden, Tourism boards, Niche categories)
**Target:** ~108k events via 40-50 new scrapers across identified niches

### Source Research Summary

| Niche | Sources | Est. Events | Effort |
|-------|---------|-------------|--------|
| Tourism APIs | tourdata.at, Wien OGD, Wien-Ticket, Feratel expansion | 8,000-23,000 | Low |
| Media Portals | tips.at, bergfex.at, stadtbekannt.at, regionews.at | 500-1,500 | Medium |
| Cultural Institutions | Bundestheater (3), KonzerthÃ¤user (2), Museums (7+) | 2,000-5,000 | Medium |
| Sports & Outdoor | Alpenverein branches, bergfex, Ã–FB | 2,000-5,000 | Medium |
| Business & Trade | WKO, AMS, Messen, ntry.at | 1,500-5,000 | Medium |
| Ticketing/Community | ntry.at, Meetup GraphQL | 700-2,800 | Medium |

### Critical Gaps Identified

1. **ScrapedEvent missing `ticket_url`** â€” scoring awards +15 for ticket_url but ScrapedEvent interface lacks it. Must add before new ticketing scrapers.
2. **Cross-source dedup is broken** â€” current dedup uses `source_id` which is source-specific. Same event on 5 portals = 5 DB entries. Need fuzzy title+date+location matching.
3. **Geocoding bottleneck** â€” Nominatim at 1 req/sec means 30k new events = 9+ hours geocoding. New API sources (tourdata, Feratel) provide coords natively â€” prioritize these.
4. **No "Wirtschaft" category** â€” WKO/Messen events don't map to existing 13 categories.

## Scope

### In Scope
- Infrastructure: ticket_url field, new category, pipeline improvements
- 40-50 new scrapers across 6 niches
- Register all scrapers in index.ts, add image domains to next.config.ts
- Verify events validate correctly through existing pipeline
- Documentation updates (CLAUDE.md, CHANGELOG.md, SCRAPER-QUELLEN.md)

### Out of Scope
- Cross-source fuzzy dedup (separate epic â€” complex, needs its own design)
- Self-hosted Nominatim (infrastructure change)
- Supabase performance optimization (count:exact, etc.)
- Facebook Events scraping (legally risky, technically complex)

## Quick commands

```bash
npm run build          # Must pass after each batch
npm test               # Verify no regressions
npm run scrape -- --source <name>  # Test individual scraper
```

## Acceptance

- [ ] 40+ new scrapers registered in index.ts, each extending BaseScraper
- [ ] Each scraper returns valid ScrapedEvent[] with source_id, source_name, source_url, title, start_date
- [ ] ticket_url field added to ScrapedEvent interface and flows through pipeline
- [ ] New "Wirtschaft" category in categories.ts with relevant keywords
- [ ] All new image domains added to next.config.ts remotePatterns
- [ ] `npm run build` passes
- [ ] `npm test` passes (no regressions)
- [ ] CLAUDE.md, CHANGELOG.md, SCRAPER-QUELLEN.md updated with new counts
- [ ] Total event count significantly increased toward 108k target

## References

- BaseScraper pattern: `src/lib/scrapers/BaseScraper.ts`
- UniBaseScraper pattern: `src/lib/scrapers/uni/UniBaseScraper.ts`
- Niche scraper examples: `src/lib/scrapers/niche/`
- Scraper registry: `src/lib/scrapers/index.ts`
- ScrapedEvent interface: `src/types/events.ts:34-56`
- Categories: `src/lib/categories.ts`
- Eventim public API docs: https://gist.github.com/DeveloperMarius/7e8aff4c69ccbf59238d76163c86d9c9
- tourdata.at API: https://api.austria.info/
- data.gv.at Wien Events: https://www.data.gv.at/katalog/dataset/stadt-wien_veranstaltungenwien
