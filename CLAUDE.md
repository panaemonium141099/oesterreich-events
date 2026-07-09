# lasstreffen.at (oesterreich-events)

> **📋 Strategischer Kontext:** `docs/MASTERPLAN.md` ist die gemeinsame
> Kontext-Basis über alle Sessions: Ist-Zahlen (Traffic, User, Umsatzstand),
> Grundsatz-Entscheidungen (kein KI-Enrichment mehr; Affiliate-ID J70 bestätigt;
> Scraping/Feed-Imports weg von Vercel), Betriebsbefunde und die priorisierte
> Roadmap. **Vor Strategie-, Monetarisierungs-, Pipeline- oder
> Priorisierungs-Fragen zuerst dort nachlesen** und das Dokument bei relevanten
> Änderungen mitpflegen.

> **🛑 NIEMALS RATEN.** Wenn der User ein Problem meldet, nenne KEINE Ursache
> ohne sie zuerst mit Daten belegt zu haben — kein "wahrscheinlich Browser-Cache",
> kein "vermutlich liegt's an X", kein "könnte sein dass Y". Bevor du eine Ursache
> ausspricht: ein konkreter Check (curl mit headers, SQL-Query, Log-Read, File-Diff,
> Network-Tab). Wenn der User sagt "es ist nicht X" → glaube ihm, schau woanders;
> NIE die gleiche Hypothese ein zweites Mal anbieten. Banale Erklärungen
> ("Browser-Cache", "noch nicht gepushed", "musst neu laden") hat der User schon
> selbst geprüft bevor er fragt — überspring sie. Hypothese erst nach Beobachtung.

> **⚠️ Taxonomie-Source-of-Truth (Tags/Kategorien):**
> `src/lib/category-classifier/enrichment-taxonomy.ts` ist runtime-SoT für alle
> Vokabulare (Primary-Categories, Tags, Audiences, Vibes, Occasions, Settings,
> Price-Flags). `docs/TAXONOMY.md` §3 wird daraus per `npm run regen:taxonomy`
> regeneriert (`--check` für CI-Drift); §1/§2/§4-§10 sind handgeschrieben.
> Konsumenten: deterministischer Classifier (`category-classifier/`), Eventim-
> Genre→Tag-Mapping (`src/lib/eventim/`), Smart-Suche-Intent-Whitelist
> (`src/lib/search/smart-query.ts`). Das frühere KI-Enrichment wurde 2026-07
> entfernt (MASTERPLAN §6) — Datenqualität kommt deterministisch aus den Quellen.

## Beschreibung
LassTreffen.at — österreichische Event-Discovery-Plattform. ~144 Scraper +
Eventim-PFT-Feed aggregieren Events in Supabase (Single Source of Truth),
ausgespielt über Next.js: SEO-Landingpages (Bundesland/Stadt/Gemeinde/Thema/
Studenten), Mapbox-Karte, Event-Detailseiten, Blog (64 Posts), Smart-Suche
(Gemini-Intent pro Query), Festival-/Artist-Features. Wachstum läuft über
Google-SEO (~70 % des Traffics). Monetarisierung: Eventim-Affiliate (ID J70,
Links in Event-Detail-TicketBox + Blog-Ticket-Boxen, Klick-Tracking via
globalem ClickTracker), Veranstalter-Pakete auf /fuer-firmen (Boost/Abo/
Live-Anbindung, Verkauf via Outreach-Maschine — noch ohne Payment-Checkout).
Social-Features (DM, Gruppen, Feed, Memories) existieren, sind aber
eingefroren (Masterplan §8.6).

## Typ
node / next.js

## Tech-Stack
- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript, Tailwind v4
- **Map:** Mapbox GL JS v3
- **Datenbank:** Supabase PostgreSQL (Micro-Instanz — sparsam mit count(*)/Scans
  umgehen, Statement-Timeouts sind real; siehe MASTERPLAN §3.5/§10)
- **Auth:** Supabase Auth (Google OAuth + Email/Password); Middleware refresht
  Sessions nur bei vorhandenem sb-Cookie (SEO-Bypass für Anonyme)
- **Scraping:** Cheerio (SSR) + Puppeteer-core (SPA); Eventim via offiziellen
  PFT-Feed (`src/lib/eventim/`, Basic Auth, Affiliate-Deeplinks)
- **KI (nur Query-Zeit / Batch-Utility, KEIN Enrichment):** Gemini 2.5 Flash
  für Smart-Suche-Intent + Concierge; OpenAI für Batch-Geocoding + Outreach-Drafts
- **E-Mail:** Brevo (primär) + Resend (Fallback); SMS: Twilio
- **Analytics:** eigene `analytics_events`-Tabelle (PageviewTracker +
  ClickTracker sammeln alle `data-track`-Attribute ein, u. a. `ticket_click`)
- **Testing:** Vitest (~1600 Tests; einige Suiten brauchen DB/Netz bzw.
  Router-Mocks und schlagen in Sandbox-Umgebungen fehl — Vergleich immer
  gegen Baseline, nicht absolut)

## Betrieb / Automatisierung (Stand 2026-07)
- **GitHub Actions `scrape-events.yml`** (täglich 03:17): 10 parallele
  Scrape-Shards (`scrape.ts --shard i/10`, deterministisch alphabetisch,
  Per-Scraper-Timeout 25 min via `SCRAPER_TIMEOUT_MIN`) + Venues-Job + EIN
  Post-Processing-Job (`scrape-pipeline.ts --skip-scrapers --skip-venues`:
  normalize → categorize → geocode → master_coords → score → dedup →
  artist_matching → indexing → report) mit `if: always()`.
- **GitHub Actions `import-eventim.yml`** (alle 6 h): PFT-Feed-Import mit
  Affiliate-Links. Secrets: `EVENTIM_FEED_USER`/`EVENTIM_FEED_PASS`.
- **Vercel-Crons** (vercel.json): send-reminders, seo-daily-snapshot
  (GSC/CrUX-Snapshot — Collector hart deadline-begrenzt, `count: 'planned'`
  statt exact!), warm-cache, sync-feratel (stündlich), lifecycle-emails,
  outreach-* (Kaltakquise-Funnel), expire-boosts.
- **pg_cron in Supabase:** MV-Refreshes (event_stats_cache 30 min,
  event_map_points stündlich), match-artists stündlich.

## Wichtige Pfade
- `src/app/page.tsx` — Landing: statische ISR-Shell (KEIN cookies()/auth im
  RSC-Pfad — Personalisierung client-seitig via `/api/me/landing` +
  `PersonalizedMatches`); Datenqueries über cookie-freien Anon-Client
- `src/app/api/events/route.ts` — Events-API (Cursor-Pagination, bbox, Filter)
- `src/app/api/events/map-points/route.ts` — columnar Karten-Snapshot aus MV (fn-16)
- `src/app/api/search/semantic/route.ts` — Smart-Suche (Gemini-Intent →
  Taxonomie-Whitelist → parallele indexierte Queries; Sortier-Kommentar
  beachten — NICHT ohne EXPLAIN "optimieren")
- `src/app/api/search/concierge/route.ts` — Concierge-Tipp (Gemini + Grounding, SSE)
- `src/app/api/me/landing/route.ts` — Client-Personalisierung der Landing
- `src/app/entdecken/page.tsx` — Liste + Smart-Suche (Tabs)
- `src/app/[bundesland]/…`, `src/app/gemeinde/[slug]`, `src/app/thema/[slug]`,
  `src/app/studenten/…` — SEO-Hub-Seiten (~2 000 Gemeinden)
- `src/app/fuer-firmen/page.tsx` — Veranstalter-Pakete (Boost 29 €, Abo 49 €/M,
  Live-Anbindung); Leads → `/api/business/lead`; Admin-Boost: `/api/admin/boost`
- `src/app/blog/…` + `src/content/blog/posts/` — 64 Posts;
  `src/components/Blog/BlogTicketBox.tsx` = Affiliate-Ticket-Box (Eventim)
- `src/components/Events/v4/V4TicketBox.tsx` — Ticket-CTA Event-Detail
  (Eventim-exklusiv, data-track="ticket_click")
- `src/components/Analytics/` — PageviewTracker + ClickTracker (global im Layout)
- `src/lib/eventim/` — PFT-Feed-Client, Parser, Kategorie/Genre-Mapping, Import
- `src/lib/scrapers/` — ~144 Scraper (Registry in index.ts; `getScrapersForShard`)
- `src/lib/db/supabase-sync.ts` — EINZIGER Write-Pfad Scraper→Supabase
  (confidence-basierte Upsert-Guards); kein SQLite mehr im Projekt
- `src/lib/search/smart-query.ts` — Parser/Whitelist/Ranking der Smart-Suche (pur, getestet)
- `src/lib/seo/` — GSC/CrUX-Clients (fetchWithTimeout!), Snapshot-Builder
- `src/lib/outreach/` + `/admin/outreach` — B2B-Kaltakquise (Discovery→Draft→Send)
- `src/lib/category-classifier/` — deterministischer Classifier + Taxonomie-SoT
- `src/lib/dedup/`, `src/lib/series-detection/`, `src/lib/lineup/`,
  `src/lib/artist-matching.ts` — Dedup / Serien / Festival-Lineups / Matching
- `.github/workflows/` — scrape-events.yml (Shards+post), import-eventim.yml, lhci.yml
- `docs/MASTERPLAN.md` — Strategie & Betriebszustand; `docs/TAXONOMY.md` — Taxonomie

## Build & Test
```bash
npm run dev / build / start
npm test                     # Vitest (Baseline beachten, s. Tech-Stack)
npm run scrape               # alle Scraper | --source <name> | --shard i/N
npm run scrape:pipeline      # scrape + post-processing (CI nutzt --skip-scrapers im post-Job)
npm run import:eventim       # Eventim-PFT-Feed (braucht EVENTIM_FEED_USER/PASS)
npm run score | dedup        # Scoring / Cross-Source-Dedup
npm run scrape:venues        # Venue-Feed-Ingestion
npm run regen:taxonomy       # TAXONOMY.md §3 aus Code regenerieren (--check für CI)
npm run openai-geocode       # Batch-Geocoding für NULL-Koordinaten
npm run scrape:festival-lineups | match-artists
```

## Deployment
- **Hosting:** Vercel (Push auf master → Deploy), Functions in fra1
- **Domain:** lasstreffen.at · Health: GET /api/health
- **Secrets:** Vercel-Env (Web + Vercel-Crons) und GitHub-Actions-Secrets
  (Pipelines) sind GETRENNTE Speicher — Änderungen in beiden pflegen.

## Bekannte Issues
- Supabase Micro: `count(*) exact`/breite Scans auf `events` (~280k rows)
  laufen in Statement-Timeouts — `count: 'planned'`, MVs oder indexierte
  Pfade nutzen (MASTERPLAN §10.1/§10.4).
- Teile der Vitest-Suite brauchen DB/Netz bzw. App-Router-Mocks und schlagen
  in Sandboxen fehl; immer Diff gegen Baseline statt Absolut-Grün erwarten.
- Personalisierte Karten-Badges (inplan/match/lineup) auf der Landing sind
  seit dem Statik-Umbau nicht mehr im Server-HTML (ID-Sets liegen in
  /api/me/landing für spätere Client-Hydration bereit).
- Eventim-Feed-Passwort stand bis 2026-07-08 in der öffentlichen Repo-History
  — Rotation bei Eventim angeraten (MASTERPLAN P0-Merker).
- Dev-Umgebung Windows/Node 24: Browser-Streaming von RSC-Seiten kann lokal
  hängen (undici-TypeError) — Prod/Vercel nicht betroffen; HTML via fetch prüfen.

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
