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
