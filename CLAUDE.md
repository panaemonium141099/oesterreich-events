# burgenland-events-v5

## Beschreibung
Web-App mit interaktiver Karte vom Burgenland die Events aus mehreren Quellen scrapt und visuell darstellt. Events werden als Marker mit Vorschaubildern angezeigt. Klick zeigt Detailinfos mit Link zum Original-Event.

## Typ
node / next.js

## Tech-Stack
- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript
- **Map:** Leaflet + react-leaflet + react-leaflet-cluster
- **Styling:** Tailwind CSS v4
- **API:** Next.js API Routes
- **Datenbank:** SQLite via better-sqlite3
- **Scraping:** Cheerio (SSR-Seiten)
- **Geocoding:** Nominatim (OpenStreetMap) + lokaler Cache

## Wichtige Pfade
- `src/app/page.tsx` — Hauptseite (Karte + Sidebar)
- `src/app/api/events/route.ts` — Events API mit Filter
- `src/lib/scrapers/` — Scraper-Module (BaseScraper, BurgenlandInfo, Landesregierung)
- `src/lib/db/` — SQLite Schema, Connection, Queries
- `src/components/Map/` — Leaflet-Karte, Marker, Cluster
- `src/components/Events/` — EventCard, EventList, EventDetail
- `src/components/Filters/` — FilterBar, Kategorie, Bezirk, Datum
- `src/scripts/scrape.ts` — CLI Scrape-Script
- `data/events.db` — SQLite Datenbank (gitignored)

## Scraper-Quellen
- **burgenland.info** — Cheerio + JSON-LD (@graph), ~122 Events mit Koordinaten
- **burgenland.at** — Cheerio, article.event Struktur, ~448 Events (Landesregierung)

## Build & Test
```bash
npm run dev          # Dev-Server starten
npm run build        # Produktions-Build
npm run scrape       # Alle Scraper ausführen
npm run scrape:burgenland  # Nur burgenland.info scrapen
```

## Bekannte Issues
- Events von burgenland.at haben keine Koordinaten aus der Quelle — werden via Known-Locations-Mapping geocoded
- ~93 Events haben noch keine Koordinaten (unbekannte Orte)
- Eventim/oeticket-Scraper noch nicht implementiert (brauchen Puppeteer)

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
