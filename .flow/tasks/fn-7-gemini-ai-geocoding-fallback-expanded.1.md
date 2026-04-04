# fn-7-gemini-ai-geocoding-fallback-expanded.1 Expand VENUE_PREFIXES + add gemini confidence level

## Description

Two small prep changes before building the Gemini script.

**Size:** S
**Files:** src/lib/location-normalizer.ts, src/lib/db/supabase-sync.ts

## Approach

**Expand VENUE_PREFIXES** at location-normalizer.ts:101-110. Add missing prefixes:
restaurant, wirtshaus, beisl, cafe, kaffeehaus, bar, pub, kino, bibliothek, volkshochschule, messezentrum, messe, sportplatz, schwimmbad, freibad, hallenbad, jugendzentrum, seniorenzentrum, gemeindeamt, pfarrsaal, vereinshaus, veranstaltungszentrum, mehrzweckhalle, turnhalle, schulzentrum, seminarhotel, weinkeller, buschenschank, heuriger

**Add "gemini" to CONFIDENCE_RANK** at supabase-sync.ts:27-35. Insert as rank 7 (below nominatim=6, above implicit null). This means Nominatim results can overwrite Gemini results, and Gemini can overwrite NULL-confidence events.

## Acceptance
- [ ] VENUE_PREFIXES contains ~55+ total entries (current 30 + ~25 new)
- [ ] "restaurant" prefix detected by isVenueName("Restaurant Steirereck")
- [ ] "heuriger" prefix detected by isVenueName("Heuriger Mayer am Pfarrplatz")
- [ ] CONFIDENCE_RANK includes gemini: 7
- [ ] All existing tests pass (npm test)
- [ ] test-normalizer.ts still passes

## Done summary
Expanded VENUE_PREFIXES from 30 to 64 entries with missing German venue types (restaurant, wirtshaus, cafe, heuriger, etc.) and added "gemini" as confidence rank 7 in CONFIDENCE_RANK.
## Evidence
- Commits: e40e8da799941855b804dfeb5066302805664728
- Tests: npm test (156 passed), npx tsx src/scripts/test-normalizer.ts (50 passed)
- PRs: