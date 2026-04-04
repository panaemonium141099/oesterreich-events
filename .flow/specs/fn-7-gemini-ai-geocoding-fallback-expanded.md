# Gemini AI Geocoding Fallback + Expanded Venue Prefixes

## Overview

For ~2,600 events where the GeoNames normalizer cannot resolve coordinates (NULL lat/lng), add a Gemini Flash AI fallback that asks "Where is [location] in Austria?" and stores the result. Also expand the venue prefix list with missing entries (Restaurant, Wirtshaus, Cafe, etc.).

## Approach

**Gemini batch script** (new `src/scripts/gemini-geocode.ts`):
1. Query Supabase for events with NULL latitude/longitude
2. Group by unique `location_name + bundesland` pairs (deduplicate -- many events share same venue)
3. Check SQLite geocode_cache first (key: `gemini::{location}||{bundesland}`)
4. For uncached: call Gemini 2.5 Flash with structured JSON output requesting lat/lng/confidence
5. Validate: Austria bbox (lat 46.3-49.1, lng 9.5-17.2), reject NULL/NaN coords
6. Cache result in SQLite geocode_cache
7. Write to Supabase with geocoding_confidence="gemini", geocoding_source="gemini"
8. Batch processing with checkpoint/resume (follow fix-geocoding.ts pattern)

**NOT in live sync** -- too slow. Runs as CLI batch after scraping.

**Expanded venue prefixes**: Add ~25 missing prefixes to VENUE_PREFIXES in location-normalizer.ts.

## Design Decisions

1. **Confidence level**: `gemini` gets rank 7 (between nominatim=6 and null). AI geocoding is less reliable than structured geodata (Nominatim). A future Nominatim run CAN overwrite Gemini results.

2. **Cache key**: `gemini::{normalized_location}||{bundesland}` -- includes bundesland for disambiguation ("Hauptplatz" in Wien vs Graz). Does NOT include title (defeats caching for same-venue events).

3. **Hallucination guard**: Beyond Austria bbox, also verify returned bundesland matches event bundesland using reverse GeoNames lookup (check if returned coords fall within expected bundesland boundaries).

4. **Gemini prompt**: Structured system prompt constraining to Austrian geography only. Include bundesland, PLZ, address context when available. Request lat/lng with 6 decimal places. Include "return null if uncertain" instruction.

5. **SDK**: Use `@google/genai` (new unified SDK, NOT deprecated `@google/generative-ai`). Use `responseMimeType: "application/json"` with `responseJsonSchema` for guaranteed structured output.

6. **Rate limiting**: Use `p-limit` or manual delay. Paid tier allows 150-300+ RPM. With ~2,600 events deduped by location, likely <1,000 unique locations to resolve.

7. **Dry-run mode**: Consistent with fix-geocoding.ts pattern.

## Scope

### In Scope
- New batch script src/scripts/gemini-geocode.ts
- Install @google/genai package
- Add "gemini" to CONFIDENCE_RANK in supabase-sync.ts
- Cache Gemini results in SQLite geocode_cache (prefixed key)
- Austria bbox + bundesland validation
- Dry-run mode, checkpoint/resume
- Expand VENUE_PREFIXES (~25 new entries)
- Update CLAUDE.md + CHANGELOG.md

### Out of Scope
- Live sync integration (Gemini stays batch-only)
- Gemini Batch API (overkill for <1,000 unique locations)
- Grounding with Google Maps ($25/1K requests, way too expensive)
- Expanding KNOWN_VENUES beyond current entries

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Gemini hallucinates wrong coords in Austria | Medium | Medium | Bbox + bundesland cross-validation |
| API quota exceeded mid-batch | Low | Low | Checkpoint/resume, rate limiting |
| Generic locations ("Hauptplatz") resolve to wrong city | Medium | Medium | Include bundesland+PLZ in prompt, cache key includes bundesland |
| Expanded venue prefixes break existing normalizer paths | Low | Low | Test against existing test suite before + after |

## Quick commands

```bash
# Install Gemini SDK
npm install @google/genai

# Run Gemini geocoding (dry-run)
npx tsx src/scripts/gemini-geocode.ts --dry-run

# Run for real
npx tsx src/scripts/gemini-geocode.ts

# Run tests
npm test
```

## Acceptance

- [ ] Gemini batch script resolves NULL-coord events with structured JSON output
- [ ] Results cached in SQLite (same location not queried twice)
- [ ] Austria bbox validation on all Gemini results
- [ ] Bundesland cross-validation (returned coords match expected bundesland)
- [ ] "gemini" confidence level added to CONFIDENCE_RANK (rank 7)
- [ ] Dry-run mode shows what would change
- [ ] Checkpoint/resume for interrupted runs
- [ ] VENUE_PREFIXES expanded with ~25 new entries (restaurant, wirtshaus, cafe, etc.)
- [ ] All existing tests pass (npm test)
- [ ] CLAUDE.md + CHANGELOG.md updated

## References

- src/scripts/fix-geocoding.ts -- pattern for batch geocoding with backup/resume
- src/lib/db/supabase-sync.ts:27-35 -- CONFIDENCE_RANK
- src/lib/db/schema.ts:54-59 -- geocode_cache table
- src/lib/location-normalizer.ts:101-110 -- VENUE_PREFIXES
- @google/genai SDK: https://github.com/googleapis/js-genai
- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
