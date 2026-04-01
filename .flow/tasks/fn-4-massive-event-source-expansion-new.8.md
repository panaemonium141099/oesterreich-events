# fn-4-massive-event-source-expansion-new.8 Integration Test, Full Scrape Run + Docs Update

## Description
Run a full scrape pipeline with all new scrapers, verify event quality, and update all documentation with new counts and source references.

**Size:** M
**Files:** `CLAUDE.md`, `CHANGELOG.md`, `SCRAPER-QUELLEN.md`, `HANDOFF.md`, `docs/regional-coverage-analysis.md`

## Approach

1. Run `npm run scrape` with all new scrapers active
2. Verify new event counts in SQLite: `SELECT source_name, COUNT(*) FROM events GROUP BY source_name ORDER BY COUNT(*) DESC`
3. Verify per-bundesland distribution
4. Check for obvious quality issues (empty titles, invalid dates, missing source_urls)
5. Verify geocoding works for new events (spot-check a few)
6. Run `npm run build` to verify no image domain issues
7. Update documentation:
   - CLAUDE.md: scraper counts, source descriptions, known issues
   - CHANGELOG.md: new phase entry with before/after table
   - SCRAPER-QUELLEN.md: new source rows, updated per-Bundesland counts
   - HANDOFF.md: updated event and scraper counts
   - docs/regional-coverage-analysis.md: updated coverage gaps

## Key context

- CHANGELOG.md uses phase summary table pattern: `| Area | Before | After |`
- SCRAPER-QUELLEN.md has `# | Quelle | URL | Events | Typ | Abdeckung` table
- CLAUDE.md uses inline `~N` approximation counts
## Acceptance
- [ ] Full scrape run completed with all new scrapers
- [ ] New event counts documented (per source, per bundesland)
- [ ] No build errors from new image domains
- [ ] CLAUDE.md updated with new scraper count, source descriptions
- [ ] CHANGELOG.md has new phase entry with before/after comparison
- [ ] SCRAPER-QUELLEN.md updated with all new sources in table format
- [ ] HANDOFF.md updated with current counts
- [ ] `npm run build` passes
- [ ] `npm test` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
