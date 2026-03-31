# fn-1-comprehensive-audit-and-feature-upgrade.14 University and FH Scrapers Batch 2

## Description
Implement event scrapers for remaining Austrian universities and Fachhochschulen (FHs). This is the second batch after the top 15 universities in task 13. Focus on FHs and smaller universities.

**Size:** M
**Files:** src/lib/scrapers/uni/ (add files), src/lib/scrapers/index.ts, next.config.ts

## Approach
- Read `data/uni-event-sources.json` for remaining institutions not covered in task 13
- Create scrapers for FHs: FH Joanneum, FH Campus Wien, FH St. Pölten, FH Salzburg, FH OÖ, FH Technikum Wien, FH Burgenland, FH Vorarlberg, FH Wiener Neustadt, FH Kufstein, FH IMC Krems, FH Kärnten, MCI Innsbruck, Lauder Business School, FHG Tirol
- Create scrapers for remaining universities: Akademie der bildenden Künste Wien, Mozarteum Salzburg, Universität für Musik Wien (MDW), Kunstuni Graz
- Follow same patterns as batch 1: BaseScraper, Cheerio, rate limiting, multi-tag assignment
- Register all new scrapers in index.ts
- Add new image domains to next.config.ts remotePatterns
- Document total coverage: number of institutions scraped vs. total in Austria

## Key context
- FH websites tend to have simpler event pages than universities — some may use WordPress or Typo3 with standard patterns
- Some institutions may not have public event pages — document these as "not available" rather than failing
- Cross-check with existing scrapers in index.ts to avoid duplicating sources already covered
## Acceptance
- [ ] ~20 additional university/FH scrapers implemented
- [ ] All registered in src/lib/scrapers/index.ts
- [ ] Each scraper follows BaseScraper pattern with rate limiting
- [ ] Multi-tag assignment including "Bildung"
- [ ] Image domains added to remotePatterns
- [ ] Coverage report: institutions scraped vs. total Austrian unis/FHs
- [ ] Institutions without public event pages documented
- [ ] `npm run build` succeeds
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
