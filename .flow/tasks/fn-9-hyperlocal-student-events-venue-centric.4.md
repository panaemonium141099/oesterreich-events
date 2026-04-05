# fn-9-hyperlocal-student-events-venue-centric.4 Feed Detection: Auto-discover ICS/JSON-LD/RSS feeds on venue websites

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Implemented feed detection module that auto-discovers ICS, JSON-LD, and RSS/Atom event feeds on venue websites. The `detectFeedsFromHtml` pure function scans HTML for calendar link tags, Schema.org Event JSON-LD blocks, and RSS/Atom alternate links with priority ordering (ICS > JSON-LD > RSS) and confidence levels. Added CLI script `detect-feeds.ts` for batch scanning venues in Supabase with concurrency, dry-run, and filtering support. 24 tests cover all feed types, edge cases, and priority ordering.
## Evidence
- Commits: 7cc5150, 79e7f9b
- Tests: npm test (401 passed, 20 files)
- PRs: