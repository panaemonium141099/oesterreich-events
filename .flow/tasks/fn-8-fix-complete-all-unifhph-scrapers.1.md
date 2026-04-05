# fn-8-fix-complete-all-unifhph-scrapers.1 UniBaseScraper shared fixes + 6 simple URL fixes

## Description
Fix shared utilities in UniBaseScraper that affect ALL uni scrapers, then fix 6 scrapers with simple URL path changes.

**Size:** M
**Files:** `src/lib/scrapers/uni/UniBaseScraper.ts`, `BOKUScraper.ts`, `JKUScraper.ts`, `TUWienScraper.ts`, `TUGrazScraper.ts`, `WUScraper.ts`, `MontanUniScraper.ts`

## Approach

### UniBaseScraper fixes (affects all scrapers):
1. **`parseJsonLdEvents()` line ~81**: Change strict `item['@type'] !== 'Event'` to accept Event subtypes (`EducationEvent`, `MusicEvent`, `SocialEvent`, etc.). Use: `const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']]; const isEvent = types.some(t => typeof t === 'string' && t.includes('Event'));`
2. **`parseDate()` lines ~125-159**: Add abbreviated German month names to the lookup: `jän`, `feb`, `mär`, `apr`, `mai`, `jun`, `jul`, `aug`, `sep`, `okt`, `nov`, `dez`. Also handle trailing dots (`Apr.`, `Okt.`).
3. **`parseDate()`**: Handle German time format with dot separator (`18.30 Uhr` in addition to `18:30`).

### Simple URL fixes (6 scrapers — path changes only, same domain):
| Scraper | Old URL | New URL |
|---------|---------|---------|
| BOKUScraper | `boku.ac.at/alle-veranstaltungen` | `boku.ac.at/en/event/list` |
| JKUScraper | `jku.at/news-events/events/` | `jku.at/veranstaltungsmanagement/` |
| TUWienScraper | `/en/tu-wien/news/events` | `/tu-wien/aktuelles/veranstaltungskalender` |
| TUGrazScraper | wrong path | `/news/tu-graz-events/aktuelle-veranstaltungen` |
| WUScraper | `/events` | `/universitaet/news-und-events/events` |
| MontanUniScraper | EN URL | `/universitaet/veranstaltungen/` |

For each: update `eventListUrl`, fetch the new URL, inspect HTML structure, adapt CSS selectors if needed. Run `npx tsx src/scripts/scrape.ts --source <name>` to verify.

## Key context
- Follow dual-parse pattern: JSON-LD first (`parseJsonLdEvents()`), HTML fallback
- `--source` flag (not `--only`) to run individual scrapers
- FHBurgenlandScraper is the canonical working example pattern
## Acceptance
- [ ] `parseJsonLdEvents()` accepts Event subtypes (EducationEvent, MusicEvent, etc.)
- [ ] `parseDate()` handles abbreviated German months (Jän, Feb, Mär, Apr, Mai, Jun, Jul, Aug, Sep, Okt, Nov, Dez)
- [ ] `parseDate()` handles dot time separator (18.30 Uhr)
- [ ] BOKU scraper produces ≥1 event
- [ ] JKU scraper produces ≥1 event
- [ ] TU Wien scraper produces ≥1 event
- [ ] TU Graz scraper produces ≥1 event
- [ ] WU scraper produces ≥1 event
- [ ] MontanUni scraper produces ≥1 event
- [ ] `npx tsc --noEmit` passes
## Done summary
Fixed UniBaseScraper shared utilities (parseJsonLdEvents accepts Event subtypes, parseDate handles abbreviated German months and dot time separator) and updated URLs + HTML parsers for 6 university scrapers (BOKU, JKU, TU Wien, TU Graz, WU Wien, MontanUni) using the correct event page URLs. All 6 scrapers now produce events successfully.
## Evidence
- Commits: f1e28ff80dcba0b56766a3395317e0a5b9fefffe
- Tests: npm test (156 passed), npx tsc --noEmit, npx tsx src/scripts/scrape.ts --source boku-wien (13 events), npx tsx src/scripts/scrape.ts --source jku-linz (1 event), npx tsx src/scripts/scrape.ts --source tu-wien (10 events), npx tsx src/scripts/scrape.ts --source tu-graz (1 event), npx tsx src/scripts/scrape.ts --source wu-wien (13 events), npx tsx src/scripts/scrape.ts --source montanuni-leoben (13 events)
- PRs: