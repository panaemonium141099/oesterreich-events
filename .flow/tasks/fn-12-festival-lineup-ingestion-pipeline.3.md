# fn-12-festival-lineup-ingestion-pipeline.3 Artist name normalization module with tests

## Description
Build a standalone artist name normalization module for festival lineups. Handles stripping performance modifiers (DJ Set, Live), splitting collaborative bookings (b2b, feat., vs.), diacritics removal, and edge cases like bands with "&" in their name. Comprehensive test suite required.

**Size:** M
**Files:** `src/lib/lineup/normalize.ts`, `src/__tests__/lineup/normalize.test.ts`

## Approach

- Create `src/lib/lineup/` directory for all lineup-related modules
- Normalization pipeline (ordered transformations):
  1. Trim whitespace
  2. Strip performance modifiers in parens/brackets: (DJ Set), (Live), (Acoustic), (Hybrid Set), (Hosted by ...)
  3. Strip featured artist suffixes: (feat. X), [ft. Y], featuring Z
  4. Split collaborative bookings into separate entries: "A b2b B", "A vs. B", "A x B", "A presents ..."
  5. Strip diacritics via NFD + regex (reuse pattern from existing `stripDiacritics` in `artist-matching.ts:28`)
  6. Lowercase
  7. Collapse multiple spaces
- Exception list for "&" bands: check against known list before splitting on "&" (Above & Beyond, Simon & Garfunkel, Mumford & Sons, Seiler & Speer, Pizzera & Jaus, etc.)
- Export: `normalizeArtistName(raw: string): string` and `splitCollaborativeBooking(raw: string): string[]`
- Test cases must cover: Austrian acts (Bilderbuch, Wanda, STS), umlauts (Seiler & Speer), b2b splits, feat. stripping, DJ Set removal, edge cases (empty string, whitespace-only, single character)

## Key context

- Existing `normalizeArtistName` in `artist-matching.ts:87` does only `lower() + stripDiacritics()`. The new module is more comprehensive and should be used by lineup scrapers. The existing function in artist-matching.ts should NOT be changed yet (that happens in task 7).
<!-- Updated by plan-sync: fn-12.1 moved normalizeArtistName from line 46 to line 87 due to MatchResult interface + other additions above it -->
- `stripDiacritics` at `artist-matching.ts:80` uses `NFD + /[\u0300-\u036f]/g` -- reuse this pattern
<!-- Updated by plan-sync: fn-12.1 moved stripDiacritics from line 28 to line 80 due to MatchResult interface + other additions above it -->
- Austrian-specific: "und" should be treated as "&" equivalent for normalization ("Seiler und Speer" == "Seiler & Speer")
## Acceptance
- [ ] `normalizeArtistName()` exported from `src/lib/lineup/normalize.ts`
- [ ] `splitCollaborativeBooking()` exported, returns array of individual artist names
- [ ] Performance modifiers stripped: (DJ Set), (Live), (Acoustic), (Hybrid Set)
- [ ] Featured artists stripped: feat., ft., featuring (in parens, brackets, or bare)
- [ ] Collaborative bookings split: b2b, vs., x (with correct whitespace handling)
- [ ] Exception list prevents splitting bands with "&" in their name (5+ entries)
- [ ] Diacritics removed, lowercase applied, whitespace collapsed
- [ ] Test suite covers 20+ cases including Austrian-specific names
- [ ] All existing tests pass (`npm test`)
## Done summary
Built standalone artist name normalization module at src/lib/lineup/normalize.ts with normalizeArtistName() and splitCollaborativeBooking(). Handles performance modifiers, feat/ft/featuring stripping, b2b/vs/x/presents splitting, ampersand band exceptions (47 entries), Austrian "und" equivalence, diacritics removal, and lowercase normalization. Test suite covers 57 cases including Austrian acts, edge cases, and combined scenarios.
## Evidence
- Commits: ac578dc662dea69c6aa729970455586a5eea4712
- Tests: npx vitest run src/__tests__/lineup/normalize.test.ts (57 passed), npm test (38 passed, 2 pre-existing failures unchanged)
- PRs: