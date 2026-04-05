# Fix & Complete All Uni/FH/PH Scrapers

## Overview
Currently only 6 of 41 university/FH/PH scrapers produce events. The rest have wrong URLs, broken HTML selectors, or are missing entirely. This epic fixes all of them so every Austrian public university, FH, and PH with a public event calendar delivers events.

**Supersedes** fn-1 tasks 13+14 (University and FH Scrapers Batch 1+2).

## Scope
- **Category A**: 13 URL fixes (wrong eventListUrl)
- **Category B**: 8 new scrapers (missing institutions)  
- **Category C**: ~18 parsing fixes (correct URLs, 0 events due to broken selectors)
- **Shared**: UniBaseScraper improvements (parseDate abbreviations, @type subtype check)
- **Docs**: SourceFilter regex, CLAUDE.md counts, CHANGELOG entry

## Approach
1. Fix shared UniBaseScraper first (parseDate + @type) â€” may auto-fix multiple 0-event scrapers
2. Fix URL-mismatched scrapers (quick wins)
3. Create new scrapers following existing patterns
4. Debug remaining 0-event scrapers
5. Update docs and UI last

All scrapers extend UniBaseScraper. Pattern: JSON-LD first, HTML fallback, Map dedup by source_id.

## Quick commands
```bash
# Run individual scraper
npx tsx src/scripts/scrape.ts --source <source-name>

# Run all scrapers
npm run scrape

# Type check
npx tsc --noEmit

# Tests
npm test
```

## Key decisions
- Prefer JSON-LD parsing over manual HTML (more robust)
- German-language event pages preferred where available
- Puppeteer-requiring sites deferred (noted but not implemented)
- Domain renames (FH St. Poelten, KunstUni Linz): keep same source_name, old events expire naturally
- Uni Salzburg: URL fix (Category A), not new scraper â€” UniSalzburgScraper already exists

## Acceptance
- [ ] All 13 URL-mismatched scrapers updated and producing events
- [ ] All 8 new scrapers created, registered, and producing events
- [ ] 0-event scrapers debugged (CSS selectors fixed for current site structure)
- [ ] Each scraper produces â‰¥1 event when run individually
- [ ] SourceFilter regex updated with new prefixes (angewandte-, mdw-, kug-, itu-)
- [ ] CLAUDE.md scraper counts updated
- [ ] No TypeScript errors (tsc --noEmit)
- [ ] All 156+ tests pass
