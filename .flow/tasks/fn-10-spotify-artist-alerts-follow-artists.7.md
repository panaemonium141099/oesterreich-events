# fn-10-spotify-artist-alerts-follow-artists.7 Post-Scrape Matching Pipeline: Edge Function and pg_cron

## Description
Build the automated matching pipeline: a Supabase Edge Function invoked both as a post-scrape hook (from `src/scripts/scrape.ts`) and via pg_cron every 5 minutes as a fallback. Uses `matching_cursor` for incremental state with idempotent replay on failure.

**Size:** M
**Files:** `supabase/functions/match-artists/index.ts`, `src/scripts/scrape.ts` (add post-scrape hook), `src/lib/notification-sender.ts`, migration for pg_cron job

## Approach

- Supabase Edge Function `match-artists`:
  - Reads `matching_cursor.last_processed_at` for incremental window
  - Queries followed_artists (all active) and events with `updated_at > last_processed_at`
  - Runs matching engine (SQL queries via supabase-js service_role)
  - Inserts artist_event_notifications (ON CONFLICT DO NOTHING)
  - Groups matches by (user_id, event_id), creates 1 notification per group (ON CONFLICT DO NOTHING on partial index)
  - Checks notification_preferences per user, delegates email/SMS to tasks .8/.9 (stubs for now)
  - On success: update matching_cursor. On failure: do NOT advance cursor (idempotent replay)
- Post-scrape hook: add HTTP call to Edge Function at end of `syncEventsToSupabase()` in `src/scripts/scrape.ts`
- pg_cron schedule: every 5 minutes (`*/5 * * * *`) via pg_net calling the Edge Function
- Store Edge Function URL and service key in Supabase Vault
- `src/lib/notification-sender.ts`: shared module for channel routing (in-app = INSERT, email = stub, SMS = stub)
- Add npm script `npm run match-artists` as manual fallback

## Key context

- Edge Functions run Deno -- use fetch() directly, not npm packages
- The notifications INSERT triggers Supabase Realtime automatically (NotificationBell picks it up)
- pg_cron + pg_net: verify both extensions are enabled before creating the job
- Matching cursor prevents re-processing: only events newer than cursor are checked
- If cursor is corrupted/missing, initialize to `now() - interval '1 day'` as safe default

## Acceptance
- [ ] Supabase Edge Function `match-artists` deployed and callable
- [ ] Post-scrape hook calls Edge Function after syncEventsToSupabase() completes
- [ ] pg_cron job scheduled every 5 minutes as fallback
- [ ] Function reads matching_cursor for incremental window
- [ ] Matches all active followed artists against new/updated events
- [ ] Per-artist dedup via ON CONFLICT DO NOTHING on artist_event_notifications
- [ ] Max 1 notification per (user, event) via ON CONFLICT DO NOTHING on partial index
- [ ] In-app notifications appear immediately via Realtime
- [ ] Matching cursor advanced on success, NOT advanced on failure
- [ ] Email and SMS sending are stubs (implemented in tasks .8 and .9)
- [ ] `npm run match-artists` works as manual fallback
- [ ] Edge Function completes within 150s timeout
- [ ] Matching latency < 5 minutes from event insertion

## Done summary
Built the post-scrape matching pipeline: deployed Supabase Edge Function `match-artists` that runs the full pg_trgm matching engine incrementally using matching_cursor, added post-scrape hook in scrape.ts and scrape-all.ts, configured pg_cron every 5 minutes via pg_net as fallback, stored Vault secrets for gateway auth, created notification-sender module with email/SMS stubs, and excluded supabase/functions from tsconfig.json for Deno compatibility.
## Evidence
- Commits: 7a0e3f823f4e62c003dca87d4d5f06ebb8fb726b, 17f7260b8613fa8798f0a866f725a8d22aa679c4
- Tests: npx vitest run (484 passed), npx tsc --noEmit (clean), Edge Function deployed and returning 200, pg_cron job active (*/5 * * * *)
- PRs: