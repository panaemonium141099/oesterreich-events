# fn-1-comprehensive-audit-and-feature-upgrade.9 Performance API Pagination and Query Optimization

## Description
Replace the 50,000 row default limit on the events API with cursor-based pagination. Implement viewport-based event loading for the map (load events within current bounding box). Move the evening filter from client-side to database-level.

**Size:** M
**Files:** src/app/api/events/route.ts, src/components/Map/EventMap.tsx, src/app/map/page.tsx, supabase migration (indexes)

## Approach
- Add cursor-based pagination to `/api/events`: `?cursor=<last_id>&limit=50` (default 50, max 200)
- Add bounding box filter: `?bbox=lat1,lng1,lat2,lng2` — filter using Supabase `gte`/`lte` on latitude/longitude columns
- Move evening filter (currently client-side at lines 124-134) to Supabase query — use `time` column comparison in SQL
- Add Supabase indexes via migration: composite index on `(latitude, longitude)` for geo queries, index on `start_date` for date filtering
- Update EventMap.tsx to fetch events based on current viewport bounds — on map move/zoom, debounce 300ms, fetch visible events
- Update map page to use paginated/viewport loading instead of fetching all 41K+ events at once
- Add response headers: `X-Total-Count`, `X-Next-Cursor` for pagination metadata

## Key context
- Current API at `src/app/api/events/route.ts:108` requests up to 50,000 rows
- Evening filter at lines 124-134 filters after fetching all rows — wastes bandwidth and DB resources
- Mapbox GL JS supports `moveend` and `zoomend` events for viewport tracking
- The `events` table has `latitude` and `longitude` columns (nullable — ~93 events have no coords)
## Acceptance
- [ ] Events API supports cursor-based pagination with `cursor` and `limit` params
- [ ] Bounding box filter via `bbox` param works
- [ ] Evening filter runs at database level (not client-side)
- [ ] Supabase indexes created for geo and date queries
- [ ] Map loads events based on viewport (not all 41K+ at once)
- [ ] Debounced viewport loading (300ms)
- [ ] Pagination headers: `X-Total-Count`, `X-Next-Cursor`
- [ ] Default page size 50, max 200
- [ ] `npm run build` succeeds
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
