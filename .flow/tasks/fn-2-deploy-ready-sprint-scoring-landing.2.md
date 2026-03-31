# fn-2-deploy-ready-sprint-scoring-landing.2 Event Scoring Algorithm & Featured API

## Description
Add `event_score` column to Supabase events table, implement score calculation script, add `/api/events/featured` endpoint, and extend `/api/events` with `sort=score` parameter.

**Size:** M
**Files:** `supabase/migrations/20260401_add_event_score.sql` (new), `src/scripts/calculate-scores.ts` (new), `src/app/api/events/featured/route.ts` (new), `src/app/api/events/route.ts`, `src/types/events.ts`, `src/types/database.ts`, `package.json`

## Approach

**Migration:** `supabase/migrations/20260401_add_event_score.sql` — ADD COLUMN IF NOT EXISTS `event_score float DEFAULT 0`, `score_updated_at timestamptz`, CREATE INDEX on `event_score DESC`

**Score formula (0–100, clamped):**
- Image present (non-empty, not placeholder stub): +15
- Description > 50 chars: +10; > 200 chars: +5 extra
- `ticket_url` present: +15
- `price_min > 0` OR `price_text` non-empty: +5; `price_min > 20`: +5 extra
- `tags` array non-empty: +5
- `organizer` non-empty: +5
- `source_url` present: +5
- Engagement: `min(view_count * 0.5 + save_count * 2 + share_count * 3, 20)`
- Time bonus: next 7 days +10, 8–30 days +5

**Script (`calculate-scores.ts`):** Uses `createClient` with `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `process.env`. Fetches all events with `start_date >= today` selecting the fields needed for scoring (view_count, save_count, share_count, ticket_url, image_url, description, price_min, price_text, tags, organizer, source_url). Batch-updates in 1000-row batches. Logs "Scored X events. Top 10: [title, score]".

**`/api/events/featured`:** Service-role Supabase client (reuse pattern from `src/app/api/events/route.ts:9-12`). Query: `events` WHERE `start_date >= today` AND `event_score > 30`, ORDER BY `event_score DESC`, LIMIT from query param (default 8, max 20). Supports optional `bundesland` filter. Returns `{ events, total }`.

**`sort=score` in `/api/events`:** When `sort=score`, change ORDER to `event_score DESC, id DESC`. Cursor pagination must change: currently uses `(start_date, id)` for position. For score sort, use `(event_score, id)` — look up cursor event's score, filter `event_score < cursor_score OR (event_score = cursor_score AND id < cursor_id)`.

**Types:** Add `event_score?: number` and `score_updated_at?: string` to both `Event` interface (`src/types/events.ts`) and database Row type (`src/types/database.ts`). Also add `ticket_url?: string` to `Event` interface (currently missing from frontend type despite existing in DB).

**Add npm script:** `"score": "tsx src/scripts/calculate-scores.ts"` in package.json. Run `npm run score` at end of task to populate scores.

## Key Context
- `src/app/api/events/route.ts:79` — the SELECT clause does not include `view_count`, `save_count`, `share_count`, or `ticket_url`. Add `event_score` to this select so it's returned to the frontend.
- Score cursor: `gt(event_score, X)` is WRONG for DESC sort — use `lt` or the composite OR pattern matching the existing `start_date` cursor logic at lines 181–198
- `src/types/database.ts` lines 77-79 already have `view_count`, `save_count`, `share_count` — just add `event_score` and `score_updated_at`
## Acceptance
- [ ] `supabase/migrations/20260401_add_event_score.sql` created with ADD COLUMN + INDEX
- [ ] `src/scripts/calculate-scores.ts` runs without errors via `npm run score`
- [ ] All events with `start_date >= today` have `event_score > 0` in Supabase after script run
- [ ] Top 10 events logged to console after scoring
- [ ] `GET /api/events/featured?limit=8` returns 8 events ordered by `event_score DESC`
- [ ] `GET /api/events?sort=score` returns events ordered by `event_score DESC`
- [ ] Cursor pagination works correctly with `sort=score` (no duplicates on page 2)
- [ ] `event_score` field present in API response JSON
- [ ] `npm run build` still passes
- [ ] `npm test` — 127 tests pass
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
