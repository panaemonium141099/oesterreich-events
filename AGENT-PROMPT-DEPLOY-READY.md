# Agent Prompt: Deploy-Ready Sprint

## Kontext

LassTreffen.at (vormals burgenland-events-v5) ist eine oesterreichische Event-Discovery-Plattform. Next.js 16 + React 19 + Supabase + Mapbox GL JS. ~98 Scraper, 41k+ Events, Social Features (Chat, Gruppen, Freunde, Feed, Memories).

Ein vorheriger Agent hat 16 Tasks erledigt (Security, TypeScript, Scraper, Multi-Tag, Pagination, Animationen, Chat-Suche, Performance). Die App hat jetzt solide Features, muss aber deployment-ready gemacht werden.

**ZIEL: Die App muss nach diesem Run MORGEN auf einen Hetzner Server (Coolify + Docker) deployed werden koennen. Alles muss gebaut werden koennen, SEO muss stehen, Landing Page muss professionell aussehen, Events muessen gerankt sein.**

---

## KRITISCH: package.json ist korrupt

Die Datei bricht bei Zeile 82 ab (nach "eslint": "^10.1.0",). BEVOR DU IRGENDWAS ANDERES MACHST: Stelle die vollstaendige package.json aus Git wieder her:

```bash
git checkout HEAD -- package.json
```

Danach `npm install` ausfuehren und sicherstellen dass `npm run build` laeuft. Wenn der Build Fehler hat, fixe sie. NICHTS anderes anfassen bevor der Build sauber durchlaeuft.

---

## Task 1: Event-Scoring Algorithmus

### Was existiert
- events Tabelle hat: view_count, save_count, share_count
- Kein event_score Feld
- Kein Ranking-Algorithmus
- Kategorien: Musik, Nightlife, Kultur, Sport, Feste & Brauchtum, Maerkte, Wein & Kulinarik, Familie, Natur, Bildung, Gesundheit, Religion, Sonstiges

### Was zu tun ist

**1.1 Supabase Migration erstellen:**

Datei: `supabase/migrations/20260401_add_event_score.sql`

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_score float DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS score_updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_events_event_score ON events(event_score DESC);
```

**1.2 Score-Berechnungs-Script:**

Datei: `src/scripts/calculate-scores.ts`

Der Score (0-100) berechnet sich aus folgenden gewichteten Faktoren:

- Bild vorhanden (image_url nicht leer und nicht Platzhalter): +15 Punkte
- Beschreibung vorhanden (description nicht leer, > 50 Zeichen): +10 Punkte
- Beschreibung ausfuehrlich (> 200 Zeichen): +5 Punkte extra
- Ticket-Link vorhanden (ticket_url nicht leer): +15 Punkte
- Preis angegeben (price_min > 0 oder price_text nicht leer): +5 Punkte
- Hoeherer Preis (price_min > 20): +5 Punkte extra (groesseres Event wahrscheinlich)
- Tags vorhanden (tags Array nicht leer): +5 Punkte
- Organizer angegeben (organizer nicht leer): +5 Punkte
- Source URL vorhanden: +5 Punkte
- User-Engagement: min(view_count * 0.5 + save_count * 2 + share_count * 3, 20) — max 20 Punkte
- Zeitliche Naehe: Events in den naechsten 7 Tagen: +10 Punkte, 8-30 Tage: +5 Punkte

Score wird auf 0-100 geclampt.

Das Script:
- Verbindet sich zu Supabase (SUPABASE_URL + SERVICE_ROLE_KEY aus .env.local)
- Holt alle Events mit start_date >= heute
- Berechnet Score pro Event
- Batch-Update in Supabase (1000er Batches)
- Loggt: "Scored X events. Top 10: [titel, score]"

**1.3 npm Script hinzufuegen:**

In package.json: `"score": "tsx src/scripts/calculate-scores.ts"`

**1.4 TypeScript Types updaten:**

In `src/types/events.ts` und `src/types/database.ts`: event_score (number, optional) und score_updated_at (string, optional) hinzufuegen.

**1.5 API anpassen:**

In `src/app/api/events/route.ts`: Neuer Query-Parameter `sort=score` der nach event_score DESC sortiert. Default bleibt start_date.

Neuer Endpoint: `src/app/api/events/featured/route.ts`
- GET /api/events/featured?limit=8&bundesland=Wien
- Gibt Top Events nach event_score zurueck
- Nur Events mit start_date >= heute und event_score > 30
- Default limit: 8

**1.6 Score einmal ausfuehren:**

Am Ende: `npm run score` ausfuehren damit alle Events einen Score haben.

### Akzeptanzkriterien
- [ ] Migration SQL erstellt
- [ ] Score-Script laeuft fehlerfrei
- [ ] Alle Events mit start_date >= heute haben einen Score
- [ ] /api/events?sort=score liefert Events sortiert nach Score
- [ ] /api/events/featured liefert Top Events
- [ ] TypeScript kompiliert ohne Fehler

---

## Task 2: Landing Page Upgrade

### Was existiert
- Aktuelle Sektionen: ParticleBackground, Onboarding, AuthErrorToast, LandingAuth, Brand Text, Headline ("Entdecke was los ist"), LandingStats, LiveActivity, HeroSection, Footer
- Design: Dunkles Theme, Gradient Mesh Background, Fade-In Animationen
- Layout in src/app/page.tsx

### Was zu tun ist

Die Landing Page bekommt 3 neue Sektionen UNTER dem bestehenden Hero. Die bestehenden Sektionen (ParticleBackground, Hero, LandingStats, LiveActivity) bleiben UNVERAENDERT.

**2.1 "Highlights diese Woche" Sektion:**

Neue Component: `src/components/Landing/WeeklyHighlights.tsx`

- Fetch von /api/events/featured?limit=8
- Horizontal scrollbares Karussell (CSS scroll-snap, kein externes Paket)
- Jede Karte: Bild (mit next/image), Titel, Datum, Ort, Kategorie-Badge mit Farbe
- Responsive: 1 Karte mobile, 2 tablet, 4 desktop sichtbar
- Ueberschrift: "Highlights diese Woche"
- Framer Motion fade-in beim Scrollen (viewport-triggered)
- Link zu /map am Ende: "Alle Events entdecken →"

**2.2 "Entdecke nach Region" Sektion:**

Neue Component: `src/components/Landing/RegionExplorer.tsx`

- 9 Kacheln fuer die 9 Bundeslaender
- Jede Kachel: Bundesland-Name, Event-Anzahl (Fetch von /api/events?bundesland=X&limit=0 fuer Count, oder eigener Count-Endpoint)
- Hover-Effect: Scale + Shadow
- Klick fuehrt zu /map?bundesland=Wien (oder entsprechendes Bundesland)
- Grid Layout: 3x3 desktop, 2 Spalten tablet, 1 Spalte mobile
- Dezente Hintergrundfarben pro Bundesland (verschiedene Grauschattierungen oder sehr dezente Farben passend zum Dark Theme)
- Ueberschrift: "Entdecke nach Region"

**2.3 "Beliebte Kategorien" Sektion:**

Neue Component: `src/components/Landing/PopularCategories.tsx`

- Grid mit den 13 Kategorien
- Jede Kachel: Kategorie-Icon (aus bestehender categoryImages.ts oder Lucide Icons), Name, Event-Anzahl
- Klick fuehrt zu /map?category=Musik (oder entsprechende Kategorie)
- Responsive Grid: 4 Spalten desktop, 3 tablet, 2 mobile
- Ueberschrift: "Beliebte Kategorien"

**2.4 Integration in page.tsx:**

Die neuen Sektionen kommen in dieser Reihenfolge nach dem bestehenden HeroSection:
1. WeeklyHighlights (nach ca. 1 Viewport Scroll)
2. PopularCategories
3. RegionExplorer
4. Footer (bestehend)

Lazy-Load die Sektionen mit `dynamic(() => import(...), { ssr: false })` oder Intersection Observer fuer Performance.

### Akzeptanzkriterien
- [ ] Alle 3 neue Components erstellt und in page.tsx eingebunden
- [ ] Daten werden korrekt von der API geladen
- [ ] Responsive auf Mobile, Tablet, Desktop
- [ ] Framer Motion Animationen beim Scrollen
- [ ] Bestehende Landing Page Sektionen unberührt
- [ ] Keine Hydration Errors
- [ ] Build laeuft ohne Fehler

---

## Task 3: SEO Basics

### Was existiert
- Minimale Metadata in layout.tsx (nur title + description)
- Keine OG Tags, kein sitemap, kein robots.txt
- Keine dynamischen Meta Tags pro Event

### Was zu tun ist

**3.1 Metadata Base in layout.tsx:**

```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://lasstreffen.at'),
  title: {
    default: 'LassTreffen.at — Entdecke Events in ganz Oesterreich',
    template: '%s | LassTreffen.at',
  },
  description: 'Ueber 40.000 Veranstaltungen in ganz Oesterreich auf einer interaktiven Karte. Konzerte, Raves, Maerkte, Kultur, Sport und mehr.',
  openGraph: {
    type: 'website',
    locale: 'de_AT',
    url: 'https://lasstreffen.at',
    siteName: 'LassTreffen.at',
    title: 'LassTreffen.at — Entdecke Events in ganz Oesterreich',
    description: 'Ueber 40.000 Veranstaltungen in ganz Oesterreich. Konzerte, Festivals, Maerkte, Kultur und mehr.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LassTreffen.at — Events in Oesterreich',
    description: 'Ueber 40.000 Veranstaltungen auf einer interaktiven Karte.',
  },
  robots: {
    index: true,
    follow: true,
  },
};
```

**3.2 Dynamische Event-Seiten Metadata:**

Wenn eine Event-Detail-Seite existiert (z.B. /events/[id] oder Modal), stelle sicher dass sie generateMetadata hat:
- title: Event-Titel
- description: Erste 160 Zeichen der Beschreibung
- openGraph.images: Event-Bild (image_url)
- JSON-LD: Event Schema (schema.org/Event)

Falls keine dedizierte Event-Seite existiert (Events werden als Modal auf /map angezeigt): Erstelle trotzdem eine `/events/[id]/page.tsx` Route die:
- Event aus Supabase laedt
- Full SEO Meta Tags hat
- Event-Detail rendert (kann EventDetail Component wiederverwenden)
- JSON-LD Event Schema einbettet
- Diese Seite ist fuer Google/SEO, User werden sie normal nicht direkt aufrufen

**3.3 sitemap.ts:**

Datei: `src/app/sitemap.ts`

Dynamische Sitemap die:
- Alle Events mit start_date >= heute inkludiert (URL: /events/{id})
- Statische Seiten: /, /map, /impressum, /datenschutz, /agb
- Bundesland-Seiten: /map?bundesland=Wien etc. (9 Stueck)
- changeFrequency: events = 'daily', statische Seiten = 'weekly'
- priority: events mit event_score > 50 = 0.8, rest = 0.5, homepage = 1.0

**3.4 robots.ts:**

Datei: `src/app/robots.ts`

```typescript
export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/auth/', '/profile/'],
    },
    sitemap: 'https://lasstreffen.at/sitemap.xml',
  };
}
```

**3.5 JSON-LD fuer Landing Page:**

In layout.tsx oder page.tsx: WebSite Schema + Organization Schema als JSON-LD Script Tag.

### Akzeptanzkriterien
- [ ] OG Tags auf jeder Seite (pruefe mit curl -s URL | grep "og:")
- [ ] /sitemap.xml liefert gueltige XML Sitemap
- [ ] /robots.txt liefert korrekte Regeln
- [ ] Event-Detail-Seiten haben JSON-LD Event Schema
- [ ] Homepage hat WebSite + Organization Schema
- [ ] Kein Build-Fehler

---

## Task 4: Deployment-Readiness

### Was existiert
- .env.example mit 6 Env Vars dokumentiert
- Kein Dockerfile
- Kein /api/health
- next.config.ts mit Bundle Analyzer
- Extensive next/image Remote Patterns

### Was zu tun ist

**4.1 package.json fixen (ZUERST!):**

```bash
git checkout HEAD -- package.json
npm install
npm run build
```

Wenn Build-Fehler: Fixen. Kein Weitermachen bis `npm run build` sauber durchlaeuft.

**4.2 Dockerfile erstellen:**

Datei: `Dockerfile`

Multi-stage Build fuer Next.js:

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Build args fuer public env vars (werden zur Build-Zeit benoetigt)
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Standalone output nutzen
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**4.3 next.config.ts anpassen fuer Standalone Output:**

In next.config.ts hinzufuegen:

```typescript
output: 'standalone',
```

Das ist noetig fuer den Docker-Build (produziert einen selbststaendigen Node.js Server).

**4.4 .dockerignore erstellen:**

```
node_modules
.next
.git
data/events.db
*.md
.env.local
.flow
```

**4.5 Health Endpoint:**

Datei: `src/app/api/health/route.ts`

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
}
```

**4.6 Environment Variables Dokumentation:**

Datei: `.env.example` aktualisieren (falls noetig):

```bash
# Mapbox (Map Rendering)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx

# Supabase (Database + Auth)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyxxx
SUPABASE_SERVICE_ROLE_KEY=eyxxx

# GitHub (Admin Panel - Scraper Management)
GITHUB_TOKEN=ghp_xxx
GITHUB_REPO=owner/repo

# Optional: Scraper API Protection
SCRAPE_API_KEY=your-secret-key

# Optional: Analytics Salt
ANALYTICS_SALT=random-string-here
```

**4.7 Finaler Build-Test:**

Am Ende:

```bash
npm run build
```

Muss FEHLERFREI durchlaufen. Wenn TypeScript Errors: Fixen. Wenn Missing Imports: Fixen. Kein `ignoreBuildErrors` wieder einbauen.

Dann:

```bash
docker build -t lasstreffen-test \
  --build-arg NEXT_PUBLIC_MAPBOX_TOKEN=test \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=test \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=test \
  .
```

Docker Build muss auch durchlaufen (wenn Docker verfuegbar, sonst reicht npm run build).

### Akzeptanzkriterien
- [ ] package.json vollstaendig und valid
- [ ] npm install laeuft ohne Fehler
- [ ] npm run build laeuft FEHLERFREI durch (kein ignoreBuildErrors!)
- [ ] Dockerfile existiert und ist korrekt strukturiert
- [ ] .dockerignore existiert
- [ ] standalone output in next.config.ts konfiguriert
- [ ] /api/health antwortet mit { status: 'ok' }
- [ ] .env.example vollstaendig dokumentiert

---

## Reihenfolge der Ausfuehrung

1. **package.json fixen + Build sicherstellen** (Task 4.1 - BLOCKER fuer alles andere)
2. **Event-Scoring** (Task 1 komplett - wird von Landing Page gebraucht)
3. **Landing Page Upgrade** (Task 2 - braucht /api/events/featured von Task 1)
4. **SEO** (Task 3 - braucht Event-Detail-Seite, kann parallel zu Landing Page)
5. **Deployment-Readiness** (Task 4 Rest - Dockerfile, Health, standalone output)
6. **Finaler Build-Test** (Task 4.7 - MUSS am Ende stehen)

---

## Wichtige Regeln

- KEIN `ignoreBuildErrors: true` zurueck einbauen. TypeScript Errors FIXEN, nicht ignorieren.
- Bestehende Features NICHT kaputtmachen. Wenn was bricht, fixen.
- Alle neuen Dateien in TypeScript (.ts/.tsx), nicht JavaScript.
- Framer Motion fuer Animationen nutzen (ist schon installiert).
- next/image fuer alle Bilder (ist schon konfiguriert mit Remote Patterns).
- Am Ende MUSS `npm run build` sauber durchlaufen.
- Committe nach jedem erledigten Task.
