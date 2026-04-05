# fn-9-hyperlocal-student-events-venue-centric.13 ODbL Compliance: OSM attribution in footer + data provenance tracking

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Added ODbL-compliant OSM attribution to the site footer with links to the OSM copyright page and ODbL license. Created a data provenance registry (data-provenance.ts) that tracks all external data sources, their licenses, and attribution requirements, with utility functions for querying required attributions and validating coverage.
## Evidence
- Commits: 8419c5955e5d11376576ef74e30b8c8d180bf0d2, 7cc515083556c0cb516dd36e41676e348f9a1861
- Tests: npx vitest run src/__tests__/lib/data-provenance.test.ts src/__tests__/components/Footer.test.tsx, npx vitest run
- PRs: