# fn-5-fix-geocoding-pipeline-100-accurate.5 Re-geocode all wrongly-placed events with backup and rollback

## Description
Re-geocode all existing events that have wrong coordinates (especially those placed at Bundesland capitals by the old fallback). Includes durable backup mechanism, dry-run mode, restore script, and service-role-only auth.

**Size:** M
**Files:** src/scripts/fix-geocoding.ts (modify existing), src/scripts/restore-coords.ts (new)

## Approach

**Durable backup:** Before any migration, create a backup of all event coordinates:
- Export to data/coord-backup-YYYY-MM-DD.json (durable, not temp)
- Format: array of { id, old_latitude, old_longitude, old_geocoding_confidence, old_geocoding_source }
- Create matching src/scripts/restore-coords.ts that reads the backup and restores coordinates

**Service-role-only auth:** The migration script MUST use SUPABASE_SERVICE_ROLE_KEY exclusively. The current fix-geocoding.ts falls back to anon key (line 15) which likely cannot update protected rows. Remove the anon key fallback and fail immediately if service key is not set.

**Dry-run mode:** Add a --dry-run flag to fix-geocoding.ts that logs what WOULD change without actually updating. Output: event_id, old_lat, old_lng, new_lat, new_lng, old_confidence, new_confidence, distance_km.

**Migration candidate detection:** The old fallback added +/- 0.02 degrees random jitter (force-geocode-all.ts:277-280). At Austrian latitudes, 0.02 degrees is approximately 2.2km lat and 1.5km lng. Use a detection envelope of +/- 0.02 degrees on both axes around each BUNDESLAND_CENTERS entry (matching the exact old jitter range), NOT a simple 2km radius.

**Migration strategy:**
1. Identify candidate events: those within the 0.02-degree jitter envelope of any BUNDESLAND_CENTERS entry, OR those with geocoding_confidence = NULL
2. Re-run normalizeEventLocation on each with the improved normalizer (from tasks 2+3)
3. For events that now resolve with confidence >= from_title: update coords + set confidence + source
4. For events that still cannot resolve: set coords to NULL + set confidence to NULL + log
5. Report: X events corrected, Y events set to NULL, Z events unchanged

**Batch processing:** Process in batches of 100. After each batch, log a checkpoint (batch number + last processed event ID). If the script crashes, it can resume from the last checkpoint by passing --resume flag.

## Key context

- fix-geocoding.ts already exists and re-normalizes all events with a 5km threshold
- force-geocode-all.ts added +/- 0.02 degrees random jitter to fallback coords (line 277-280)
- BUNDESLAND_CENTERS values are in force-geocode-all.ts:16-26
- There are ~56k events in production Supabase
- The normalizer depends on data/geonames-at.json being loaded
- Most re-geocoding should resolve via GeoNames (no Nominatim needed, fast)
- Legitimate Eisenstadt events will re-resolve to Eisenstadt correctly (they match GeoNames)

## Acceptance
- [ ] Durable backup created at data/coord-backup-YYYY-MM-DD.json before any changes
- [ ] Restore script (src/scripts/restore-coords.ts) can read backup and restore coordinates
- [ ] Script requires SUPABASE_SERVICE_ROLE_KEY, fails immediately without it (no anon key fallback)
- [ ] --dry-run mode outputs changes without modifying database
- [ ] Migration detects candidates using 0.02-degree jitter envelope around BUNDESLAND_CENTERS
- [ ] Events that now resolve correctly are updated with new coords + confidence + source
- [ ] Events that cannot resolve are set to NULL coords (not kept at wrong location)
- [ ] Migration report: count of corrected, nulled, and unchanged events
- [ ] Batch processing with checkpoint/resume capability (--resume flag)
- [ ] No event at Burgruine Landsee, Kobersdorf, or Oggau shows Eisenstadt coordinates after migration
- [ ] Legitimate Eisenstadt events are NOT moved (they re-resolve to Eisenstadt correctly)
