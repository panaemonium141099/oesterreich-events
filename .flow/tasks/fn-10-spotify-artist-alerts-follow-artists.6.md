# fn-10-spotify-artist-alerts-follow-artists.6 Artist-Event Matching Engine with pg_trgm Word Similarity

## Description
Build the artist-event matching engine using PostgreSQL pg_trgm word_similarity for title matching and cheap substring check for description matching. Includes notification grouping: max 1 notification per (user, event) with all matched artists listed in the body.

**Size:** M
**Files:** `src/lib/artist-matching.ts`, `src/scripts/match-artists.ts`, tests

## Approach

- Create `src/lib/artist-matching.ts` with the core matching logic
- Matching strategy (tiered, title-first):
  1. Names < 3 chars: skip (too many false positives)
  2. Names 3 chars: exact word boundary match on title (case-insensitive, `~*` regex with word boundaries)
  3. Names 4+ chars: pg_trgm `word_similarity()` on title with threshold >= 0.6
  4. Secondary: for names >= 6 chars, also check description via `POSITION(lower(artist_name) IN lower(description)) > 0`
- Normalization: lowercase, strip diacritics if unaccent available
- Only match future events (`start_date >= now()`)
- Incremental: only match events with `updated_at > matching_cursor.last_processed_at`
- Per-artist dedup: ON CONFLICT DO NOTHING on `artist_event_notifications(user_id, event_id, artist_name)`
- Notification grouping: after matching, GROUP BY (user_id, event_id) and create ONE notification per group. Body lists all matched artist names. Uses ON CONFLICT DO NOTHING on the partial unique index `notifications(user_id, event_id) WHERE type = 'spotify_match'`
- Create CLI script `src/scripts/match-artists.ts` with `--dry-run` and `--reset-cursor` flags
- Update `matching_cursor` after successful completion

## Key context

- No GIN index on events.description (by design) -- description matching uses cheap substring check only
- The unique partial index on notifications prevents duplicate user+event notifications even in concurrent runs
- `match_score` in artist_event_notifications stores the word_similarity score for quality analysis
- Notification body format: "Kuenstler X, Y und Z treten bei {event_title} auf!"

## Acceptance
- [ ] Tiered matching: skip <3 chars, exact 3 chars, pg_trgm 4+ chars on title, substring 6+ chars on description
- [ ] Matching normalizes artist names (lowercase, diacritics stripped)
- [ ] Only future events matched, only events newer than matching_cursor
- [ ] Per-artist dedup via unique constraint on artist_event_notifications
- [ ] Max 1 notification per (user, event) via unique partial index on notifications
- [ ] Notification body lists all matched artist names for that event
- [ ] CLI script with --dry-run and --reset-cursor flags
- [ ] Matching cursor updated after successful completion
- [ ] Idempotent: re-running with same cursor produces no duplicates
- [ ] Matching query < 500ms against 109K events (title GIN index used)
- [ ] Tests cover: exact match, fuzzy match, short name rejection, description secondary, notification grouping, dedup, cursor management

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
