# fn-5-fix-geocoding-pipeline-100-accurate.6 Update CLAUDE.md, CHANGELOG.md with geocoding pipeline changes

## Description
Update project documentation to reflect the overhauled geocoding pipeline.

**Size:** S
**Files:** CLAUDE.md, CHANGELOG.md

## Approach

**CLAUDE.md updates:**
- Add location-normalizer.ts, force-geocode-all.ts, fix-geocoding.ts to Wichtige Pfade section
- Update Geocoding description from "Nominatim (OpenStreetMap) + lokaler Cache" to describe the live pipeline: GeoNames lookup via normalizer (no Nominatim in live sync). Note: Nominatim remains a batch-only tool in geocode.ts for offline re-geocoding scripts.
- Add normalize-locations and fix-geocoding to Build and Test commands
- Update Bekannte Issues: remove the ~93 events without coordinates issue (should be resolved)

**CHANGELOG.md updates:**
- Add Geocoding Pipeline Enhancement section documenting all changes
- Update file tree listing to include location-normalizer.ts and new scripts
- Update geocode_cache table description if schema changed
- Document the new geocoding_confidence and geocoding_source columns

**docs/superpowers/specs/2026-04-03-geolocation-normalisierung-design.md:**
- Check off completed acceptance criteria

## Done summary
Updated CLAUDE.md with geocoding pipeline paths, corrected Geocoding tech description (GeoNames live, Nominatim batch-only), added geocoding scripts to Build & Test, removed resolved ~93 events issue. Added Geocoding Pipeline Enhancement section to CHANGELOG.md documenting all 6 tasks. Checked off all acceptance criteria in the geolocation design spec.
## Evidence
- Commits: cffb1de8310fbbd6841573d3b621afcfb2709669
- Tests: npm test (156 passed)
- PRs:
## Acceptance
- [ ] CLAUDE.md Wichtige Pfade includes location-normalizer.ts and geocoding scripts
- [ ] CLAUDE.md Geocoding description reflects live pipeline (GeoNames via normalizer, NOT Nominatim in sync)
- [ ] CLAUDE.md notes Nominatim is batch-only (in geocode.ts scripts)
- [ ] CLAUDE.md Bekannte Issues updated (remove resolved geocoding issues)
- [ ] CHANGELOG.md has Geocoding Pipeline Enhancement section
- [ ] Design spec acceptance criteria checked off
