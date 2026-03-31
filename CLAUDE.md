# burgenland-events-v5

## Beschreibung
Osterreich Events — Austrian event discovery platform. Aggregates events from ~98 scrapers across Austria, displays them on an interactive Mapbox GL JS map, and provides social features (DM, group chat, friends, feed, memories).

## Typ
node / next.js

## Tech-Stack
- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript
- **Map:** Mapbox GL JS (`mapbox-gl` v3.20)
- **Styling:** Tailwind CSS v4
- **Animations:** Framer Motion v12
- **API:** Next.js API Routes (cursor-based pagination, bbox viewport filter)
- **Datenbank (production):** Supabase PostgreSQL (22 tables)
- **Datenbank (staging):** SQLite via better-sqlite3
- **Auth:** Supabase Auth (Google OAuth + Email/Password)
- **Scraping:** Cheerio (SSR), Puppeteer-core (SPA/tickets)
- **Geocoding:** Nominatim (OpenStreetMap) + lokaler Cache
- **Testing:** Vitest 4.x + @vitest/coverage-v8

## Wichtige Pfade
- `src/app/page.tsx` — Hauptseite (Landing / Map)
- `src/app/api/events/route.ts` — Events API (cursor pagination, bbox, tags, eveningOnly)
- `src/lib/scrapers/` — ~98 Scraper-Module
- `src/lib/scrapers/uni/` — 42 University/FH/PH scrapers
- `src/lib/scrapers/niche/` — 12 niche category scrapers (festivals, nightlife, outdoor, culture, food, family)
- `src/lib/scrapers/BaseScraper.ts` — Base class mit Image extraction + validation
- `src/lib/db/` — SQLite Schema, Connection, Queries
- `src/lib/utils/date.ts` — Shared date formatting utilities
- `src/lib/utils/profile.ts` — Shared profile utilities
- `src/components/Map/EventMap.tsx` — Mapbox GL JS Karte
- `src/components/Events/` — EventCard, EventDetail, EventPreviewCard
- `src/components/Filters/FilterBar.tsx` — Category, Bundesland, Datum, Tags (multi-select)
- `src/scripts/scrape.ts` — CLI Scrape-Script
- `src/__tests__/` — Vitest test suite
- `data/events.db` — SQLite Datenbank (gitignored)
- `CHANGELOG.md` — Full architecture documentation + phase-by-phase change log

## Scraper-Quellen
- **burgenland.info** — Cheerio + JSON-LD (@graph), ~122 Events mit Koordinaten
- **burgenland.at** — Cheerio, article.event Struktur, ~448 Events (Landesregierung)
- **44 regional scrapers** — Wien, NOE, OOE, Steiermark, Salzburg, Karnten, Tirol, Vorarlberg, multi-region
- **42 university/FH/PH scrapers** — `src/lib/scrapers/uni/` (all 9 Bundeslaender covered)
- **12 niche scrapers** — `src/lib/scrapers/niche/` (festivals, nightlife, outdoor, culture, food, family)

## Build & Test
```bash
npm run dev              # Dev-Server starten
npm run build            # Produktions-Build (strict TypeScript)
npm run scrape           # Alle Scraper ausführen
npm run scrape:burgenland  # Nur burgenland.info scrapen
npm test                 # Vitest test suite (127 tests, 123 passing)
npm run test:coverage    # Tests mit V8 Coverage-Report
npm run test:watch       # Vitest watch mode
```

## Bekannte Issues
- 4 API-Tests schlagen fehl (events.test.ts) — Pagination- und Evening-Filter-Tests sind nach Cursor-Pagination-Einführung veraltet; Code ist korrekt, Tests müssen aktualisiert werden
- ~93 Events haben noch keine Koordinaten (unbekannte Orte)
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
