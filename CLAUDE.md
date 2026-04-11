# burgenland-events-v5

## Beschreibung
Osterreich Events — Austrian event discovery platform. Aggregates events from ~141 scrapers across Austria, displays them on an interactive Mapbox GL JS map, and provides social features (DM, group chat, friends, feed, memories).

## Typ
node / next.js

## Tech-Stack
- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript
- **Map:** Mapbox GL JS (`mapbox-gl` v3.20)
- **Styling:** Tailwind CSS v4
- **Animations:** Framer Motion v12
- **API:** Next.js API Routes (cursor-based pagination, bbox viewport filter)
- **Datenbank (production):** Supabase PostgreSQL (28 tables)
- **Datenbank (staging):** SQLite via better-sqlite3
- **Auth:** Supabase Auth (Google OAuth + Email/Password)
- **Notifications:** Resend (email), Twilio (SMS), Supabase Realtime (in-app)
- **Artist Matching:** PostgreSQL pg_trgm word_similarity + GIN indexes
- **Scraping:** Cheerio (SSR), Puppeteer-core (SPA/tickets)
- **Geocoding:** GeoNames AT lookup via location-normalizer (live sync), Nominatim (batch-only), Gemini Flash AI (batch fallback for unresolved locations)
- **Testing:** Vitest 4.x + @vitest/coverage-v8

## Wichtige Pfade
- `src/app/page.tsx` — Hauptseite (Landing mit WeeklyHighlights, RegionExplorer, PopularCategories)
- `src/app/api/events/route.ts` — Events API (cursor pagination, bbox, tags, eveningOnly, sort=score)
- `src/app/api/events/featured/route.ts` — Featured events API (top events by score, start_date >= today)
- `src/app/api/health/route.ts` — Health check endpoint fur Docker / Coolify
- `src/app/api/stats/counts/route.ts` — Stats counts API (9 regions + 13 categories in one query)
- `src/app/events/[id]/page.tsx` — SEO event detail page (generateMetadata + JSON-LD Event schema)
- `src/app/sitemap.ts` — XML sitemap mit generateSitemaps() (chunked bei 5000 Events)
- `src/app/robots.ts` — robots.txt (disallows /api/, /admin/, /auth/)
- `src/scripts/calculate-scores.ts` — Event-Scoring-Algorithmus (schreibt event_score nach Supabase)
- `Dockerfile` — Multi-stage Docker-Build (node:20-slim + sharp) fur Coolify-Deployment
- `src/lib/scrapers/` — ~141 Scraper-Module (registered instances in index.ts)
- `src/lib/scrapers/uni/` — 56 University/FH/PH scrapers
- `src/lib/scrapers/niche/` — 34 niche category scrapers (festivals, nightlife, outdoor, culture, food, family, sport, museums, concert houses, business, RSS feeds)
- `src/lib/scrapers/BaseScraper.ts` — Base class mit Image extraction + validation
- `src/lib/scrapers/RegistryBasedScraper.ts` — Venue feed ingestion orchestrator (ICS/JSON-LD connectors, dedup)
- `src/lib/connectors/` — Universal feed connectors (ICS, JSON-LD, feed-detector)
- `src/lib/dedup/` — Content deduplication (fingerprint + Jaro-Winkler fuzzy)
- `src/lib/series-detection/` — Recurring event series detection
- `src/scripts/scrape-venues.ts` — CLI script for venue feed ingestion
- `src/lib/db/` — SQLite Schema, Connection, Queries
- `src/lib/utils/date.ts` — Shared date formatting utilities
- `src/lib/utils/profile.ts` — Shared profile utilities
- `src/components/Map/EventMap.tsx` — Mapbox GL JS Karte
- `src/components/Events/` — EventCard, EventDetail, EventPreviewCard
- `src/components/Filters/FilterBar.tsx` — Category, Bundesland, Datum, Tags (multi-select)
- `src/components/Landing/WeeklyHighlights.tsx` — Top-scored events (uses /api/events/featured)
- `src/components/Landing/RegionExplorer.tsx` — Region-Grid (uses /api/stats/counts)
- `src/components/Landing/PopularCategories.tsx` — Kategorie-Grid (uses /api/stats/counts)
- `src/lib/location-normalizer.ts` — GeoNames-based location normalizer (compound names, disambiguation, word boundaries)
- `src/lib/geocoding.ts` — Nominatim geocoding + KNOWN_LOCATIONS (batch scripts only)
- `src/scripts/fix-geocoding.ts` — Re-geocode wrongly-placed events with backup/rollback (dry-run support)
- `src/scripts/openai-geocode.ts` — OpenAI batch geocoding for NULL-coord events (cache, bbox + bundesland validation)
- `src/scripts/force-geocode-all.ts` — Force-geocode all events (no Bundesland-capital fallback)
- `src/scripts/normalize-locations.ts` — Batch normalize event locations in Supabase
- `src/scripts/scrape.ts` — CLI Scrape-Script
- `src/__tests__/` — Vitest test suite
- `data/events.db` — SQLite Datenbank (gitignored)
- `CHANGELOG.md` — Full architecture documentation + phase-by-phase change log
- `src/content/blog/types.ts` — FestivalPost, LineupAct, FestivalKeyFacts, GalleryImage interfaces
- `src/content/blog/index.ts` — Barrel: exports ALL_POSTS (52 posts), getPostBySlug, getPostsByCategory
- `src/content/blog/posts/` — One TypeScript file per blog post (52 files)
- `src/app/blog/page.tsx` — Blog index page (/blog) with category filter tabs
- `src/app/blog/[slug]/page.tsx` — Blog detail page with generateMetadata + JSON-LD Event schema
- `src/components/Landing/FestivalBlogSection.tsx` — Blog preview section on landing page
- `src/scripts/import-student-orgs.ts` — Import OeH/ESN/IAESTE/AIESEC/AEGEE sections as venue entries (~72 orgs)
- `src/lib/artist-matching.ts` — Artist-event matching engine (pg_trgm word_similarity, tiered strategy)
- `src/lib/email.ts` — Email notification service (Resend API, artist alerts + reminders)
- `src/lib/sms.ts` — SMS notification service (Twilio API, E.164 validation)
- `src/lib/spotify.ts` — Spotify API integration (OAuth, Client Credentials search, token management)
- `src/emails/artist-alert.tsx` — Artist alert email template (HTML)
- `src/emails/artist-reminder.tsx` — Artist reminder email template (7d/1d)
- `src/scripts/match-artists.ts` — CLI script for manual artist-event matching pipeline
- `src/app/api/artists/follow/route.ts` — Follow/unfollow artist API (POST/DELETE)
- `src/app/api/artists/following/route.ts` — List followed artists API (GET, cursor pagination)
- `src/app/api/artists/search/route.ts` — Spotify artist search API (GET, Client Credentials)
- `src/app/api/artists/events/route.ts` — Matched artist events API (GET, upcoming events)
- `src/app/api/spotify/status/route.ts` — Spotify connection status API (GET)
- `src/app/api/notifications/preferences/route.ts` — Notification preferences CRUD (GET/PUT)
- `src/app/api/notifications/unsubscribe/route.ts` — Email unsubscribe endpoint (GET)
- `src/components/Artists/` — Artist management UI (ArtistCard, ArtistSearch, ImportedArtistsList, ArtistEventsSection)
- `src/components/Notifications/NotificationBell.tsx` — In-app notification bell with Realtime subscriptions

## Scraper-Quellen
- **burgenland.info** — Cheerio + JSON-LD (@graph), ~122 Events mit Koordinaten
- **burgenland.at** — Cheerio, article.event Struktur, ~448 Events (Landesregierung)
- **44 regional scrapers** — Wien, NOE, OOE, Steiermark, Salzburg, Karnten, Tirol, Vorarlberg, multi-region
- **56 university/FH/PH scrapers** — `src/lib/scrapers/uni/` (all 9 Bundeslaender covered)
- **34 niche scrapers** — `src/lib/scrapers/niche/` (festivals, nightlife, outdoor, culture, food, family, sport, museums, concert houses, business, RSS feeds)
- **Feratel Deskline API** — 71 regions across all Bundeslaender via TOSC5 API
- **TourData / austria.info API** — Official Austrian tourism API (alle Bundeslaender)
- **Wien OGD** — Open Government Data VADB category queries (CC-BY 4.0)
- **Wien-Ticket** — Concerts, theater, sport, exhibitions in Wien
- **tips.at** — Regional event portal (OOE, NOE, Steiermark)
- **bergfex.at** — Outdoor and sport events across Austria
- **ntry.at** — Event ticketing platform (concerts, parties)
- **Meetup** — Community events via GraphQL API

## Build & Test
```bash
npm run dev              # Dev-Server starten
npm run build            # Produktions-Build (strict TypeScript)
npm run scrape           # Alle Scraper ausfuhren
npm run scrape:burgenland  # Nur burgenland.info scrapen
npm run score            # Event-Scores berechnen und nach Supabase schreiben
npm run scrape:venues    # Registry-based venue feed ingestion
npm test                 # Vitest test suite (547 tests, all passing)
npm run test:coverage    # Tests mit V8 Coverage-Report
npm run test:watch       # Vitest watch mode
npx tsx src/scripts/normalize-locations.ts  # Batch normalize event locations in Supabase
npx tsx src/scripts/fix-geocoding.ts --dry-run  # Re-geocode wrongly-placed events (dry-run)
npx tsx src/scripts/test-normalizer.ts  # Run normalizer test cases
npm run openai-geocode        # OpenAI batch geocoding for NULL-coord events (requires OPENAI_API_KEY)
npm run openai-geocode -- --dry-run  # Dry-run mode (no writes)
npm run import-student-orgs   # Import OeH/ESN/IAESTE/AIESEC/AEGEE sections as venues (~72 orgs)
npm run import-student-orgs -- --dry-run  # Dry-run mode (no writes)
npx tsx src/scripts/match-artists.ts --dry-run  # Artist-event matching pipeline (dry-run)
npx tsx src/scripts/match-artists.ts --reset-cursor --dry-run  # Reset cursor + re-process all events
```

## Environment Variables (Artist Alerts)
```
SPOTIFY_CLIENT_ID        # Spotify OAuth client ID
SPOTIFY_CLIENT_SECRET    # Spotify OAuth client secret
RESEND_API_KEY           # Resend email API key
TWILIO_ACCOUNT_SID       # Twilio account SID
TWILIO_AUTH_TOKEN         # Twilio auth token
TWILIO_PHONE_NUMBER       # Twilio sender phone number (E.164)
```

## Docker
```bash
# Lokaler Build-Test
docker build -t lasstreffen-test \
  --build-arg NEXT_PUBLIC_MAPBOX_TOKEN=test \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=test \
  .

# Deployment: Coolify (Hetzner) — Git-Push triggert automatischen Docker-Build
# Health check: GET /api/health -> { "status": "ok" }
```

## Bekannte Issues
- 4 API-Tests schlagen fehl (events.test.ts) — Pagination- und Evening-Filter-Tests sind nach Cursor-Pagination-Einführung veraltet; Code ist korrekt, Tests müssen aktualisiert werden
- Eventim/oeticket-Scraper noch nicht implementiert (brauchen Puppeteer)
- Admin-Scraper-Routes haben keine Rollen-Prüfung (auth key reicht, kein admin/god required)
- Business-Profile-Onboarding nicht vollständig implementiert

<!-- BEGIN FLOW-NEXT -->
## Flow-Next

This project uses Flow-Next for task tracking. Use `.flow/bin/flowctl` instead of markdown TODOs or TodoWrite.

**Quick commands:**
```bash
.flow/bin/flowctl list                # List all epics + tasks
.flow/bin/flowctl epics               # List all epics
.flow/bin/flowctl tasks --epic fn-N   # List tasks for epic
.flow/bin/flowctl ready --epic fn-N   # What's ready
.flow/bin/flowctl show fn-N.M         # View task
.flow/bin/flowctl start fn-N.M        # Claim task
.flow/bin/flowctl done fn-N.M --summary-file s.md --evidence-json e.json
```

**Creating a spec** ("create a spec", "spec out X", "write a spec for X"):

A spec = an epic. Create one directly — do NOT use `/flow-next:plan` (that breaks specs into tasks).

```bash
.flow/bin/flowctl epic create --title "Short title" --json
.flow/bin/flowctl epic set-plan <epic-id> --file - --json <<'EOF'
# Title

## Goal & Context
Why this exists, what problem it solves.

## Architecture & Data Models
System design, data flow, key components.

## API Contracts
Endpoints, interfaces, input/output shapes.

## Edge Cases & Constraints
Failure modes, limits, performance requirements.

## Acceptance Criteria
- [ ] Testable criterion 1
- [ ] Testable criterion 2

## Boundaries
What's explicitly out of scope.

## Decision Context
Why this approach over alternatives.
EOF
```

After creating a spec, choose next step:
- `/flow-next:plan <epic-id>` — research + break into tasks
- `/flow-next:interview <epic-id>` — deep Q&A to refine the spec

**Rules:**
- Use `.flow/bin/flowctl` for ALL task tracking
- Do NOT create markdown TODOs or use TodoWrite
- Re-anchor (re-read spec + status) before every task

**More info:** `.flow/bin/flowctl --help` or read `.flow/usage.md`
<!-- END FLOW-NEXT -->
