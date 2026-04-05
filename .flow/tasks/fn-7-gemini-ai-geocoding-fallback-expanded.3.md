# fn-7-gemini-ai-geocoding-fallback-expanded.3 Run Gemini geocoding on NULL-coord events + update docs

## Description

Execute the Gemini geocoding script on production data and update documentation.

**Size:** S
**Files:** CLAUDE.md, CHANGELOG.md, package.json (npm run script)

## Approach

**Add npm script**: Add `"gemini-geocode": "tsx --env-file=.env.local src/scripts/gemini-geocode.ts"` to package.json scripts.

**Update CLAUDE.md**:
- Add src/scripts/gemini-geocode.ts to Wichtige Pfade
- Update Geocoding tech description: "GeoNames AT lookup via location-normalizer (live sync), Nominatim (batch-only), Gemini Flash AI (batch fallback for unresolved locations)"
- Add `npm run gemini-geocode` to Build and Test commands

**Update CHANGELOG.md**:
- Add Gemini AI Geocoding Fallback section (fn-7)
- Document expanded VENUE_PREFIXES
- Document new confidence level

**Note**: The actual migration run (npx tsx src/scripts/gemini-geocode.ts) needs to be done manually by the user with env vars loaded, same as the fn-5 and fn-6 migrations. The task should verify dry-run works but not execute the real migration automatically.

## Acceptance
- [ ] npm run gemini-geocode script defined in package.json
- [ ] CLAUDE.md updated with Gemini geocoding in tech stack and paths
- [ ] CHANGELOG.md has fn-7 section documenting all changes
- [ ] Dry-run executes successfully (verify with --dry-run)
- [ ] All existing tests pass

## Done summary
Added npm run gemini-geocode script to package.json, updated CLAUDE.md with Gemini geocoding in tech stack/paths/build commands, and added fn-7 section to CHANGELOG.md documenting all epic changes (expanded VENUE_PREFIXES, gemini confidence level, batch script). Dry-run verified successfully against production Supabase.
## Evidence
- Commits: 427fe7d31963da8396d6907dc20319969549d36c
- Tests: npm test (156 passed), npx tsx --env-file=.env.local src/scripts/gemini-geocode.ts --dry-run (connected to Supabase, found 4306 events, 1590 unique locations)
- PRs: