# fn-9-hyperlocal-student-events-venue-centric.2 OSM Overpass Import: Austrian bars/pubs/nightclubs venue registry

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Implemented OSM Overpass import script that queries Austrian bars/pubs/nightclubs/biergartens via the Overpass API and upserts them into the Supabase venues table. Includes amenity-to-VenueType mapping, coordinate-based Bundesland assignment, social URL extraction, localness scoring, student relevance detection, batch upsert with osm_id conflict resolution, and 42 Vitest tests covering all mapping/normalization/dedup logic.
## Evidence
- Commits: ac62d406e4ceeaadb5fb9dd23c21ba60b41b0c36
- Tests: npx vitest run (323 passed), npx tsc --noEmit (clean)
- PRs: