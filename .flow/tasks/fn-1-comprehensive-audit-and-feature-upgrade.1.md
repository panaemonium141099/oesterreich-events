# fn-1-comprehensive-audit-and-feature-upgrade.1 Codebase Analysis and CHANGELOG Documentation

## Description
Read the entire codebase and create a comprehensive architecture document in CHANGELOG.md. Document all 22 Supabase tables, 44 scrapers, API routes, frontend components, auth system, chat system, and the dual-DB architecture (SQLite staging → Supabase production).

**Size:** M
**Files:** CHANGELOG.md (new), CLAUDE.md (update if needed)

## Approach
- Read every file in `src/` systematically: lib/, app/, components/, types/
- Document the dual-DB architecture: scrapers → SQLite (`src/lib/db/`) → manual sync → Supabase (production)
- List all 22 Supabase tables from `src/types/database.ts` and usage patterns
- List all 44 scrapers from `src/lib/scrapers/index.ts` with their source URLs
- Document API routes: `/api/events`, `/api/events/[id]`, `/api/analytics`, `/api/admin/*`, `/api/scrape`
- Document auth system: Supabase Auth, Google OAuth, role system (user/business/admin/god)
- Document chat: DMs (`direct_messages`), group chat (`group_messages`), realtime subscriptions
- Reference existing conventions from HANDOFF.md

## Key context
- Map was migrated from Leaflet to Mapbox GL JS but Leaflet deps still in package.json
- `ignoreBuildErrors: true` in next.config.ts — TypeScript errors are hidden
- 41,380 events in Supabase, ~570 from original 2 scrapers, rest from 42 newer scrapers
- German UI text, English code identifiers
## Acceptance
- [ ] CHANGELOG.md created with full architecture overview
- [ ] All 22 Supabase tables documented with purpose
- [ ] All 44 scrapers listed with source URLs and status
- [ ] All API routes documented with methods and parameters
- [ ] Auth system documented (OAuth, email, roles, profile completeness)
- [ ] Chat system documented (DMs, groups, realtime, message types)
- [ ] Known issues section (from HANDOFF.md + newly discovered)
- [ ] Build passes after changes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
