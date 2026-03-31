# LassTreffen.at - Technischer Umsetzungsplan

## IST-Zustand (Re-Scan 31.03.2026, nach Agent-Run)

ERLEDIGT durch Agent (Tasks 1-16):
- ~98 Scraper total (44 regional + 37 Uni/FH/PH + 7 Nische + 10 Gemeinde)
- ignoreBuildErrors ENTFERNT, Bundle Analyzer konfiguriert
- Leaflet komplett entfernt, Mapbox GL JS v3.20 sauber
- Multi-Tag System komplett (TagChip, TagFilter, API Support)
- Framer Motion Animationen (EventList, AnimatedCard, Landing Hero)
- Chat Event-Suche implementiert (EventSearchInline, EventPreviewMessage)
- Cursor-basierte Pagination im Events API (50/page statt 50k)
- ISR + next/image Optimierung konfiguriert (50+ Remote Patterns)
- 127+ Tests (Vitest), davon 4 API-Tests veraltet
- Koordinaten-Grundlagen verbessert (Bundesland GeoJSON, PLZ-Mapping)

OFFEN:
- Kein Blog-System (null — keine Routes, keine Tabellen, keine Components)
- Kein Event-Scoring Algorithmus (nur Spotify-Match hat Score)
- Keine Automation Agents
- Keine Affiliate-Integration
- Karten-Marker nicht redesigned (immer noch weisse Kreise, keine Kategorie-Farben)
- Koordinaten-Pipeline nicht ueberarbeitet (Confidence Scoring, Venue-DB fehlt)
- Landing Page nicht redesigned
- Nicht deployed

---

## VISION: Was LassTreffen.at werden soll

Oesterreichs fuehrende Event-Discovery-Plattform mit Social Network, Blog/Magazin, automatisierter Content-Pipeline und Affiliate-Monetarisierung. Voll automatisiert durch AI-Agents die Events scrapen, pruefen, promoten und Content erstellen.

---

## PHASE 1: Fundament & Security (Prioritaet: KRITISCH)

> **STATUS:** Wird aktuell von einem Agent bearbeitet (Security, TypeScript, Performance, Code Quality). Nach Abschluss nochmal scannen um verbleibende Issues zu identifizieren.

### 1.1 Security Hardening

- `ignoreBuildErrors: true` aus next.config.ts entfernen
- Alle TypeScript-Fehler im Projekt fixen (aktuell werden sie beim Build ignoriert)
- Service Role Key aus /api/events entfernen, stattdessen RLS Policies korrekt konfigurieren
- Admin API Routes (/api/admin/*) mit Auth-Middleware schuetzen (nur role=admin|god)
- Scrape API mit API-Key-Pflicht absichern (kein optionales Env-Var)
- RLS Policies fuer alle 16+ Tabellen pruefen und vervollstaendigen
- Besonders: groups INSERT Policy (aktuell blockiert Event Planner)

### 1.2 TypeScript & Code Quality

- Alle TS-Errors fixen die durch ignoreBuildErrors versteckt sind
- Unused Leaflet Dependencies entfernen (leaflet, react-leaflet, react-leaflet-cluster, @types/leaflet)
- Tote Imports und unused Code entfernen
- Konsistente Error-Handling Strategie etablieren (try/catch mit Logging)

### 1.3 Datenqualitaet

- Image-Enrichment Pipeline: Scraper sollen Bilder von der Quell-Website extrahieren statt Platzhalter
- Fuer Events ohne Bild: Fallback-Logik implementieren (Kategorie-spezifische Bilder, automatisch generierte OG-Images)
- MeinBezirk Scraper erweitern: Detail-Seiten scrapen fuer Beschreibungen
- Feratel Koordinaten verbessern: Venue-spezifische Geocodierung statt Region-Center
- Events ohne Koordinaten: Erweiterte Geocoding-Strategie (PLZ + Ort Fallback)

---

## PHASE 2: Event-Scoring & Promoted Events

### 2.1 Event-Score Algorithmus

Neues Feld `event_score` (float) in events Tabelle. Score berechnet sich aus:

- Venue-Groesse Heuristik: Bekannte Venues (Stadthalle, Arena, etc.) haben hoeheren Base Score
- Ticket-Link vorhanden: +Score (kommerzielles Event = wahrscheinlich groesser)
- Preis-Range: Hoeherer Preis deutet auf groesseres Event hin
- Anzahl Quellen: Event das von mehreren Scrapern gefunden wird = relevanter
- Bildqualitaet: Event mit eigenem Bild > Platzhalter
- Beschreibungslaenge: Ausfuehrliche Beschreibung = professioneller
- User-Engagement: view_count + save_count + share_count (gewichtet)
- Zeitliche Naehe: Events die bald stattfinden bekommen Boost
- Saisonaler Boost: Festivals im Sommer, Weihnachtsmaerkte im Winter

Berechnung: Cron Job der Score taeglich neu berechnet (Supabase Edge Function oder Script).

### 2.2 Promoted Events System

- Neue API Route: GET /api/events/featured - Top Events nach Score, filterbar nach Bundesland/Kategorie/Zeitraum
- Neue API Route: GET /api/events/upcoming-festivals - Festivals/Grosse Events der naechsten Wochen
- Admin Panel Tab: "Promoted Events" - manuelles Pinning/Boosting moeglich
- Neues Feld `is_promoted` (boolean) + `promoted_until` (timestamp) fuer manuelles Promoten

### 2.3 Multi-Tag System

- tags[] Array existiert bereits in der DB
- Frontend: Tag-Input bei Event-Erstellung (Autocomplete mit bestehenden Tags)
- Scraper: Automatisches Tagging basierend auf Titel/Beschreibung (z.B. "Festival", "Open Air", "Vernissage")
- Filter-Erweiterung: Tag-Filter in FilterBar (neben Kategorie)
- Jedes Event kann weiterhin EINE Hauptkategorie haben, aber mehrere Tags
- Vordefinierte Tag-Gruppen: "Nachtleben" (Club, Bar, Rave, DJ), "Outdoor" (Festival, Open Air, Wanderung), "Kultur" (Theater, Museum, Ausstellung), "Kulinarisch" (Weinverkostung, Street Food, Brunch)

---

## PHASE 3: Blog & Content System

### 3.1 Datenbank-Schema

Neue Supabase Tabellen:

```
blog_posts:
  id (UUID, PK)
  slug (text, unique) -- SEO URL: /blog/beste-festivals-sommer-2026
  title (text)
  subtitle (text, nullable)
  content (text) -- Markdown oder Rich Text
  excerpt (text) -- Kurzbeschreibung fuer Vorschau/SEO
  cover_image_url (text)
  category (text) -- "festivals", "nightlife", "regionen", "tipps"
  tags[] (text array)
  author_type (enum: system|admin|ai_generated)
  author_name (text) -- z.B. "LassTreffen Redaktion"
  status (enum: draft|published|archived)
  seo_title (text)
  seo_description (text)
  related_event_ids[] (UUID array) -- Verknuepfte Events
  related_bundesland (text, nullable)
  related_gemeinde (text, nullable)
  view_count (integer, default 0)
  published_at (timestamp)
  created_at (timestamp)
  updated_at (timestamp)

blog_categories:
  id (UUID, PK)
  name (text)
  slug (text, unique)
  description (text)
  icon (text, nullable)
  sort_order (integer)
```

### 3.2 Frontend-Seiten

- `/blog` -- Blog-Uebersicht mit Kategorie-Filter, Featured Post oben, Grid darunter
- `/blog/[slug]` -- Blog-Detail-Seite mit: Inhalt, verknuepfte Events als Karten, Social Share Buttons, Related Posts, Autor-Info
- `/blog/kategorie/[category]` -- Gefilterte Blog-Ansicht nach Kategorie

### 3.3 Landing Page Redesign

Die Landing Page (/) bekommt neue Sektionen (unterhalb Hero):

1. "Highlights diese Woche" -- Top 5-8 Events nach event_score, Karussell
2. "Upcoming Festivals" -- Festivals der naechsten 3 Monate, grosse Karten mit Countdown
3. "Aus dem Blog" -- Neueste 3 Blog-Posts als Vorschau-Karten
4. "Entdecke nach Region" -- Bundesland-Kacheln mit Event-Anzahl, Klick fuehrt zur gefilterten Karte
5. "Beliebte Kategorien" -- Kategorie-Kacheln mit Beispiel-Events
6. "Nachtleben" -- Club/Bar Events der Woche (wenn Nachtleben-Scraper aktiv)

Bestehende Sektionen (HeroSection, LandingStats, LiveActivity) bleiben, werden aber in den neuen Flow integriert.

### 3.4 SEO & Meta

- Dynamische Open Graph Tags pro Event-Seite, Blog-Post, Kategorie-Seite
- Sitemap.xml generieren (alle Events, Blog-Posts, Kategorien, Regionen)
- robots.txt optimieren
- Structured Data (JSON-LD): Event Schema, BlogPosting Schema, BreadcrumbList
- Canonical URLs fuer alle Seiten
- Hreflang Tags (de-AT)

---

## PHASE 4: Neue Event-Quellen

> **STATUS:** Uni/FH Scraper werden aktuell von einem Agent umgesetzt. Nach Abschluss verbleibende Quellen hier abarbeiten.

### 4.1 Universitaeten & Fachhochschulen (Neue Kategorie: "Uni & Campus")

Alle oesterreichischen Unis und FHs als Quellen. Neue Scraper fuer:

Universitaeten:
- Universitaet Wien (univie.ac.at/veranstaltungen)
- TU Wien (tuwien.ac.at/events)
- WU Wien (wu.ac.at/events)
- Universitaet Graz (uni-graz.at/events)
- TU Graz (tugraz.at/events)
- Universitaet Innsbruck (uibk.ac.at/events)
- Universitaet Salzburg (plus.ac.at/events)
- Universitaet Linz (JKU, jku.at/events)
- Universitaet Klagenfurt (aau.at/events)
- BOKU Wien (boku.ac.at/events)
- Meduni Wien (meduniwien.ac.at/events)
- Meduni Graz, Meduni Innsbruck
- Vetmeduni Wien
- Akademie der bildenden Kuenste Wien
- Universitaet fuer angewandte Kunst Wien
- Universitaet Mozarteum Salzburg
- Universitaet fuer Musik und darstellende Kunst Wien (MDW)
- Universitaet fuer Musik und darstellende Kunst Graz (KUG)
- Montanuniversitaet Leoben
- Donau-Universitaet Krems

Fachhochschulen:
- FH Burgenland (fh-burgenland.at)
- FH Technikum Wien
- FH Campus Wien
- FH des BFI Wien
- FH St. Poelten
- FH Wiener Neustadt
- FH Oberoesterreich (Hagenberg, Steyr, Wels, Linz)
- FH Joanneum (Graz)
- FH Salzburg
- FH Kaernten
- FH Kufstein
- MCI Innsbruck
- FH Vorarlberg
- Lauder Business School
- Ferdinand Porsche FernFH

Implementierung: BaseScraper-Subklassen, Cheerio wo moeglich, Puppeteer fuer SPAs. Event-Typen: Vorlesungen (oeffentlich), Konferenzen, Karrieremessen, Campus-Feste, Sportevents, Kulturveranstaltungen.

### 4.2 Nischen-Quellen

Nightlife/Clubs (Wien + groessere Staedte):
- Clubcommission Wien Quellen auswerten
- Resident Advisor (ra.co) fuer AT-Events
- Shotgun (shotgun.live) Events
- GoOut (goout.net/de/wien)

Festivals:
- festivalguide.at
- festivals.at / festivalkalender
- Frequency, Nova Rock, Donauinselfest, Electric Love als Einzel-Scraper

Maerkte & Kulinarik:
- Maerkte Wien (marktamt.wien.gv.at)
- Bauernmaerkte Oesterreich
- Street Food Festival Kalender

### 4.3 Regionale Luecken schliessen

Aktuell duenn abgedeckte Regionen:
- Niederoesterreich (nur donau.com) -- noe.co.at, noe-card Events, St. Poelten Veranstaltungen
- Kaernten (nur kaernten.live) -- klagenfurt.at Events, Woerthersee Events
- Vorarlberg (2 Quellen) -- bregenz.at, feldkirch.at, dornbirn.at

---

## PHASE 5: Performance & UX

### 5.1 Performance

- ISR (Incremental Static Regeneration) fuer Event-Detail-Seiten und Blog-Posts
- Edge Runtime fuer API Routes wo moeglich
- Bild-Optimierung: next/image mit Blur Placeholder, WebP/AVIF
- Event-Liste: Virtualisierung mit react-window oder @tanstack/virtual (keine 41k Events ins DOM)
- API Pagination: Cursor-based statt Offset (performanter bei grossen Datasets)
- Supabase Queries: Indexes pruefen, Query-Optimierung, Materialized Views fuer Aggregationen
- Bundle Analysis: next/bundle-analyzer, Tree Shaking, Dynamic Imports fuer schwere Komponenten (Mapbox, Recharts)
- Service Worker fuer Offline-Faehigkeit und Caching
- Preload/Prefetch Strategien fuer wahrscheinliche Navigation

### 5.2 Karten-Marker Redesign (PRIORITAET: HOCH)

> **Problem:** Aktuell sehen alle 41k Marker identisch aus — weisse 48px Kreise mit Event-Bild. Keine Kategorie-Unterscheidung, Cluster sind simple Zahlen-Bubbles. Bei hoher Dichte ist die Karte ueberfordernd und unlesbar.

**Inspiration von Plattformen mit guter Clustering-UX:**
- Airbnb: Preis-Bubbles statt generische Marker, Hover zeigt Vorschau, Cluster zeigen Preis-Range
- Google Maps: Farbcodierte Pins nach Typ (Restaurant rot, Hotel blau), Cluster mit Kategorie-Breakdown
- Spotangels: Heatmap bei Zoom-Out, Details bei Zoom-In — keine Marker-Ueberflutung
- Padlet Map: Runde Thumbnails die bei Zoom sauber auseinandergehen
- Citymapper: Simpel, wenige Farben, klare Hierarchie

**Neue Marker-Strategie:**

Zoom Level 0-8 (Oesterreich-Uebersicht):
- Heatmap-Layer statt einzelne Marker/Cluster
- Farb-Intensitaet zeigt Event-Dichte pro Region
- Bundesland-Labels mit Event-Anzahl
- Keine einzelnen Marker sichtbar

Zoom Level 9-12 (Bundesland/Bezirk):
- Cluster-Bubbles mit Kategorie-Breakdown (Donut-Chart statt nur Zahl)
  - Kreis zeigt farbige Segmente pro Kategorie (Musik=lila, Sport=gruen, Nightlife=pink etc.)
  - Zahl in der Mitte: Gesamtanzahl
  - Groesse skaliert mit Anzahl (aktuell schon so, aber Stufen verfeinern)
- Bei Hover ueber Cluster: Tooltip mit Top-3 Events darin

Zoom Level 13-15 (Stadt/Ort):
- Kleine Cluster brechen auf in einzelne Marker
- Einzelne Marker: Farbcodierte Kreise nach Kategorie (NICHT mehr alle weiss)
  - Musik: Lila (#8B5CF6)
  - Nightlife: Pink (#EC4899)
  - Kultur: Orange (#F59E0B)
  - Sport: Gruen (#10B981)
  - Feste: Rot (#EF4444)
  - Wein & Kulinarik: Weinrot (#991B1B)
  - Maerkte: Tuerkis (#06B6D4)
  - Familie: Hellblau (#3B82F6)
  - Natur: Dunkelgruen (#059669)
  - Bildung: Indigo (#6366F1)
  - Gesundheit: Mint (#34D399)
  - Religion: Gold (#D97706)
  - Sonstiges: Grau (#6B7280)
- Event-Bild nur bei Hover als Popup (nicht permanent im Marker)
- Marker-Groesse: Normal 32px, bei hohem event_score 40px (grosse Events stechen raus)

Zoom Level 16+ (Strassen-Level):
- Volle Detail-Marker: Bild + Kategorie-Farbe als Border
- Event-Name als Label unter dem Marker
- Jitter-Algorithmus fuer Events am gleichen Ort (existiert schon, Golden-Angle)

**Technische Umsetzung:**
- Mapbox GL Expressions fuer Kategorie-basierte Farben (kein JS Loop noetig)
- Heatmap als eigener Mapbox Layer (`heatmap` type), visibility per Zoom
- Cluster Donut-Chart: Custom HTML Marker mit SVG (Mapbox unclusteredPointCount + Kategorie-Aggregation)
- Performance: Nur Marker im Viewport rendern (aktuell schon so via querySourceFeatures)

### 5.3 Koordinaten-Rework (PRIORITAET: KRITISCH)

> **Problem:** Ortszuweisung und Koordinaten stimmen bei vielen Events nicht ueberein. Ursachen: Nominatim nimmt blind erstes Ergebnis, Known-Locations matcht per Substring (zu breit), Feratel hat ~2800 Events mit Region-Center statt Venue, keine Validierung nach Geocoding.

**Schritt 1: Geocoding-Pipeline komplett ueberarbeiten**

Aktueller Flow (kaputt):
1. Known-Locations Substring Match (34 hardcodierte Orte, `includes()` = false positives)
2. Cache Check
3. Nominatim erstes Ergebnis (kein Confidence Check)
4. Post-Process: Bundesland via Polygon

Neuer Flow:
1. **Exakte Known-Locations** (kein Substring, exakter Match oder Levenshtein-Distanz < 3)
   - Known-Locations Datenbank erweitern: Nicht nur 34 Burgenland-Venues, sondern alle bekannten Venues aus den Scrapern (Stadthalle Wien, Arena Wien, Posthof Linz etc.)
   - Neue Tabelle `known_venues`: name, aliases[], lat, lng, address, bundesland, gemeinde
   - Scraper fuettern die Tabelle automatisch wenn Venue + Koordinaten aus der Quelle kommen
2. **Strukturierte Adress-Geocodierung**
   - Wenn PLZ + Ort vorhanden: Geocode "{PLZ} {Ort}, Austria" (viel praeziser als nur Ortsname)
   - Wenn Adresse vorhanden: Geocode "{Strasse}, {PLZ} {Ort}, Austria"
   - Nominatim structured query nutzen: `street=...&city=...&postalcode=...&country=AT`
3. **Confidence Scoring**
   - Nominatim liefert importance + type Felder
   - Nur Ergebnisse mit importance > 0.3 akzeptieren
   - Nur Ergebnisse vom Typ "building", "amenity", "place" akzeptieren (nicht "boundary" oder "highway")
   - Ergebnis muss innerhalb des angegebenen Bundeslandes liegen (Polygon-Check sofort, nicht erst im Post-Processing)
4. **Fallback-Kette**
   - Known Venue -> Strukturierte Adresse -> PLZ-Zentrum -> Gemeinde-Zentrum -> KEIN Marker (besser kein Marker als falscher!)
5. **Mismatch-Detektion**
   - Neues Feld `geocoding_confidence` (float 0-1) pro Event
   - Neues Feld `geocoding_method` (enum: known_venue|address|plz|gemeinde|nominatim|manual|none)
   - Events mit confidence < 0.5 bekommen Flag und erscheinen im Admin Panel zur manuellen Pruefung

**Schritt 2: Bestehende Daten bereinigen**

- Script das alle 41k Events nochmal durch die neue Pipeline jagt
- Feratel ~2800 Events: Venue-Name + PLZ aus Beschreibung/Titel extrahieren, neu geocoden
- Events die vorher Region-Center hatten: Wenn bessere Koordinaten gefunden -> updaten
- Events wo Bundesland-Zuweisung und Koordinaten widersprechen: Flaggen fuer manuelle Pruefung
- Ergebnis: Jedes Event hat entweder korrekte Koordinaten ODER keinen Marker (wird in Sidebar gelistet aber nicht auf der Karte gezeigt)

**Schritt 3: Laufende Qualitaetssicherung**

- Jeder neue Scrape-Run: Neue Events durchlaufen die verbesserte Pipeline
- QA-Agent (Phase 8) prueft taeglich: "Liegt Event X in Stadt Y?" per Reverse Geocoding
- Admin Panel: "Events ohne Koordinaten" View + "Niedrige Confidence" View
- Bulk-Fix Tool: Admin kann PLZ/Ort korrigieren, Koordinaten werden automatisch neu berechnet

### 5.4 UI Animationen & Interaktionen

- Framer Motion als Animation Library (bereits im Plan)
- Page Transitions: Smooth Uebergaenge zwischen Seiten
- Event Card Hover: 3D Tilt Effect, Bild-Zoom
- Karte: Smooth Fly-To bei Event-Auswahl, Cluster-Animation
- Scroll-basierte Animationen auf Landing Page (Parallax, Fade-In)
- Skeleton Loading States fuer alle Listen und Karten
- Micro-Interactions: Like/Save Animation (Herz, Konfetti), Share Feedback
- Dark Mode / Light Mode Toggle (aktuell nur Dark)
- Mobile: Pull-to-Refresh, Swipe-Gesten fuer Event-Navigation

---

## PHASE 6: Chat & Event-Discovery Erweiterung

### 6.1 Event-Suche im Chat

- Im DM und Gruppen-Chat: Neuer Button "Event teilen"
- Oeffnet ein Such-Overlay: Events durchsuchen nach Titel, Ort, Datum
- Suchergebnisse als EventPreviewCard (existiert bereits)
- Klick auf Ergebnis sendet Event als message_type='event_share'
- Empfaenger sieht Event-Karte mit "Ansehen" und "Speichern" Buttons

### 6.2 Event-Dashboard Erweiterung

- Eigene Events (source_type='user'): Im Dashboard Events suchen und direkt im Chat verschicken
- "Zu Event einladen" Button auf jeder Event-Detail-Seite: Oeffnet Freunde-Liste zum Einladen
- Gruppen-Erstellung direkt aus Event heraus ("Gemeinsam hingehen?")

---

## PHASE 7: Monetarisierung (Affiliate)

### 7.1 Affiliate-Link Integration

- ticket_url Feld existiert bereits
- Affiliate-Parameter an bekannte Ticket-Plattformen anhaengen:
  - oeticket.com: Affiliate-ID Parameter
  - eventbrite.at: Affiliate Tracking
  - ntry.at: Partner-Link
  - ticketmaster.at: Affiliate Programm
- Tracking: Klicks auf ticket_url zaehlen (analytics_events mit event_type='ticket_click')
- Dashboard fuer Affiliate-Performance (Admin Panel)

### 7.2 Featured Listings (Spaeter)

- Veranstalter koennen Events promoten (gegen Gebuehr)
- Premium-Platzierung in Suche und auf Landing Page
- Eigenes Veranstalter-Dashboard (nutzt business Role)

---

## PHASE 8: Automation Agents (VOR Launch — Content-Pipeline muss stehen)

### 8.1 Quellen-Waechter Agent

Aufgabe: Bestehende Scraper-Quellen ueberwachen.

- Cron Job (taeglich oder alle 6h): Alle Scraper ausfuehren
- Pro Scraper: Ergebnis-Count mit historischem Durchschnitt vergleichen
- Wenn Scraper 0 Events liefert oder >50% weniger als ueblich: Alert
- Website-Format-Check: Stichprobe der gescrapten HTML-Struktur mit erwarteter Struktur vergleichen
- Ergebnis: Eintrag in neue Tabelle `agent_alerts` mit severity (info|warning|critical)
- Bei critical: Notification an Admin (E-Mail oder Push)

Technisch: Supabase Edge Function + Claude Haiku API fuer intelligente Analyse.

### 8.2 QA-Pruefer Agent

Aufgabe: Jedes neue Event einzeln auf Qualitaet pruefen.

- Trigger: Nach jedem Scrape-Run (oder Batch, alle neuen Events seit letztem Run)
- Pruefungen pro Event:
  - Bild vorhanden und erreichbar? (HTTP HEAD Check)
  - Datum plausibel? (Nicht in der Vergangenheit, nicht in 10 Jahren)
  - Duplikat-Erkennung: Aehnlicher Titel + gleiches Datum + gleicher Ort = wahrscheinlich Duplikat
  - Kategorie korrekt? (Claude Haiku: "Ist 'Weinverkostung' korrekt als 'Sport' kategorisiert?" -> Nein -> Fix)
  - Beschreibung vorhanden und sinnvoll? (Kein Platzhalter, keine Fehlermeldung)
  - Koordinaten plausibel? (Innerhalb Oesterreich-Bounding-Box)
  - Tags automatisch vergeben basierend auf Titel/Beschreibung
  - Event-Score berechnen
- Ergebnis: Qualitaets-Flags pro Event (quality_score, issues[])
- Bei groesseren Problemen: Eintrag in agent_alerts

Technisch: Supabase Edge Function + Claude Haiku. Kosten: ca. $0.001-0.005 pro Event = ca. $5-25/Monat bei 5000-50000 Events.

### 8.3 Content-Creator Agent

Aufgabe: Blog-Posts und Social Media Content automatisch erstellen.

- Trigger: Woechentlich (z.B. jeden Montag)
- Workflow:
  1. Top Events der Woche ermitteln (nach event_score)
  2. Pro Bundesland: Groesstes Event identifizieren
  3. Saisonale Themen: "Festivals diesen Sommer", "Weihnachtsmaerkte Dezember"
  4. Blog-Post generieren: SEO-Titel, Beschreibung, Inhalt (1000-2000 Woerter), verknuepfte Events
  5. Social Media Posts: Instagram-Caption + Hashtags, TikTok-Script-Vorschlag
  6. Status: draft -> Admin reviewed -> published (oder auto-publish nach Qualitaets-Check)

Technisch: Supabase Edge Function + Claude Sonnet (fuer bessere Textqualitaet). Social Media Posting via Instagram Graph API / TikTok API.

### 8.4 Technik Agent

Aufgabe: Issues von anderen Agents automatisch beheben.

- Input: agent_alerts Tabelle
- Fuer automatisch loesbare Issues:
  - Kaputtes Bild -> Alternative Bild-URL suchen oder Fallback setzen
  - Fehlende Koordinaten -> Nochmal Geocoding versuchen mit alternativer Adresse
  - Falsche Kategorie -> Umkategorisieren
  - Duplikate -> Merge (bessere Daten behalten)
- Fuer komplexe Issues: Detaillierten Report erstellen fuer manuelle Behandlung
- Kann als Ralph-Loop laufen fuer groessere Refactoring-Tasks

---

## PHASE 9: Infrastruktur & Deployment

### 9.1 Server-Setup: Hetzner CAX31 + Coolify

**Ein Server fuer alles** — Hetzner Cloud CAX31 (ARM64, 8 vCPU, 16GB RAM, 160GB SSD, €11/Monat):

- Coolify installieren (Open Source, self-hosted Vercel/PaaS)
  - coolify.io, 1-Click Install Script auf frischem Ubuntu 22.04
  - GitHub Repo verbinden: Auto-Deploy bei Push auf main
  - Preview Deployments fuer Feature Branches (wie Vercel, aber gratis)
  - SSL automatisch via Let's Encrypt (Coolify managed das)
  - Environment Variables ueber Coolify UI verwalten

- **Next.js App** als Docker Container
  - Dockerfile im Repo (multi-stage build: build + production)
  - Coolify erkennt Next.js automatisch oder nutzt das Dockerfile
  - Port 3000 intern, Coolify routet ueber Reverse Proxy (Traefik)
  - Health Check Endpoint: /api/health

- **Scraper** als separater Cron-Service
  - Eigener Docker Container mit Puppeteer + Chromium
  - Coolify "Scheduled Task" oder eigener Container mit cron
  - Schedule: Alle 6 Stunden (0 */6 * * *)
  - Laeuft: `npm run scrape:all` -> SQLite -> Supabase Sync
  - Separater Prozess = Scraper-Crash killt nicht die Website

- **AI Agents** als Cron-Services
  - QA-Pruefer: Taeglich um 04:00 (nach Scraper-Run von 00:00)
  - Content-Creator: Woechentlich Montag 06:00
  - Quellen-Waechter: Taeglich um 05:00
  - Technik Agent: Taeglich um 07:00 (nach QA-Run)
  - Alle als eigene Container oder als Node Scripts im Scraper-Container

### 9.2 Cloudflare (davor, gratis)

- DNS fuer lasstreffen.at ueber Cloudflare
- CDN: Statische Assets (Bilder, JS, CSS) gecached am Edge
- DDoS-Schutz: Gratis Tier reicht fuer >10k User
- Page Rules: Cache-TTL fuer Event-Seiten, Blog-Posts
- Cloudflare Tunnel (optional): Server hat keinen offenen Port, Cloudflare tunnelt Traffic rein — extra sicher
- Analytics: Server-side Analytics als Backup zu Supabase Analytics

### 9.3 Datenbank: Supabase Cloud Pro

- Supabase Pro Plan ($25/Monat)
  - 8GB Datenbank, 250GB Bandwidth, 100k MAU Auth
  - Realtime: 500 concurrent connections (reicht fuer 10k User weil nicht alle gleichzeitig chatten)
  - Daily Backups automatisch
- Spaeter wenn Kosten steigen: Migration auf self-hosted Supabase (auch via Coolify moeglich)
- Connection Pooling: Supavisor (in Supabase Pro inkludiert) fuer effiziente DB-Connections

### 9.4 Domain & DNS

- lasstreffen.at Domain registrieren (z.B. bei domain.at oder Cloudflare Registrar)
- DNS Records bei Cloudflare:
  - A Record: lasstreffen.at -> Hetzner Server IP (proxied durch Cloudflare)
  - CNAME: www.lasstreffen.at -> lasstreffen.at
- SSL: Cloudflare Full (Strict) + Let's Encrypt auf dem Server (End-to-End Verschluesselung)

### 9.5 Monitoring & Alerting

- Coolify Dashboard: Container Health, CPU/RAM/Disk Usage
- Uptime Kuma (Open Source, auf gleichem Server via Coolify):
  - Website erreichbar? Check alle 60 Sekunden
  - API Endpoints gesund? /api/health, /api/events
  - Supabase erreichbar?
  - Alert via Telegram/Discord/E-Mail bei Ausfall
- Scraper Monitoring: agent_alerts Tabelle + Notification an Admin

### 9.6 Backup-Strategie

- Supabase: Automatische Daily Backups (Pro Plan)
- SQLite (Staging): Taeglich rsync/rclone nach Hetzner Storage Box (€3.50/Monat fuer 1TB) oder S3-kompatibel
- Git: Code ist eh auf GitHub
- Coolify Config: Export/Backup der Coolify Konfiguration

### 9.7 Skalierung wenn's waechst

Stufe 1 (jetzt, bis ~10k concurrent):
- 1x Hetzner CAX31 (€11) + Supabase Pro ($25) + Cloudflare Free
- Gesamt: ~€40/Monat

Stufe 2 (10k-50k concurrent):
- Hetzner CAX41 upgrade (16 vCPU, 32GB RAM, €17.50/Monat)
- Oder: 2x CAX21 mit Cloudflare Load Balancing
- Supabase Pro reicht noch, eventuell Team Plan ($599/Monat) wenn DB-Last steigt

Stufe 3 (50k+ concurrent):
- Separater Scraper-Server (CAX21, €5.50)
- Separater DB-Server mit self-hosted Supabase (CAX31, €11)
- 2-3 Frontend-Server hinter Cloudflare Load Balancer
- Redis fuer Session-Cache und Realtime
- Gesamt: ~€40-60/Monat fuer die Server + API-Kosten

### 9.8 Social Media Praesenz

- Instagram: @lasstreffen.at oder @lasstreffenat
- TikTok: @lasstreffen
- WhatsApp Channel: "LassTreffen - Events Oesterreich"
- Facebook Page (niedrige Prioritaet)

---

## Zusammenfassung: Reihenfolge der Umsetzung

### ERLEDIGT (Agent-Run Tasks 1-16)
- ~~Security & TypeScript Fixes~~ DONE
- ~~Uni/FH/PH Scraper (37 Stueck)~~ DONE
- ~~Nische-Scraper (7 Stueck)~~ DONE
- ~~Multi-Tag System~~ DONE
- ~~Framer Motion Animationen~~ DONE
- ~~Chat Event-Suche~~ DONE
- ~~Cursor-Pagination + Performance~~ DONE
- ~~Bundle Analyzer + ISR + next/image~~ DONE

### NAECHSTER AGENT-RUN (heute Nacht durchackern, morgen deployen)

**Ziel: Seite muss morgen deploybar sein. Affiliate-Bewerbung kommt NACH Deploy (die wollen die live Seite sehen).**

1. **Event-Scoring Algorithmus** — event_score Feld, Berechnung (Venue-Groesse, Ticket, Preis, Engagement, Zeitnaehe), Script das alle Events scored
2. **Landing Page Upgrade** — "Highlights diese Woche" (Top Events nach Score), "Upcoming Festivals", "Entdecke nach Region" (Bundesland-Kacheln), bestehende Sektionen (Hero, Stats, LiveActivity) behalten und integrieren
3. **SEO Basics** — Dynamische OG Tags pro Event, sitemap.xml, robots.txt, JSON-LD Event Schema, Canonical URLs
4. **Deployment-Readiness** — Dockerfile (multi-stage build), /api/health Endpoint, Environment Variables dokumentieren, Build ohne Fehler sicherstellen

### NACH DEPLOY (Phase 2 — naechste Woche+)

5. **Affiliate-Integration** — Bei oeticket, eventbrite, ticketmaster Affiliate beantragen (Seite ist jetzt live als Referenz), nach Zusage: Affiliate-Parameter an ticket_urls, Klick-Tracking (ticket_click Event), Dashboard im Admin Panel
6. Koordinaten-Rework (Geocoding-Pipeline, Confidence Scoring, Venue-DB, Daten-Bereinigung)
7. Karten-Marker Redesign (Heatmap, Donut-Cluster, Kategorie-Farben — nach Koordinaten-Fix)
8. Blog-System (DB Tabellen, /blog Routes, Admin-Editor, SEO)
9. Automation Agents: QA-Pruefer + Content-Creator (Blog fuellen, Datenqualitaet)
10. Automation Agents: Quellen-Waechter + Technik Agent
11. Landing Page Phase 2 (Blog-Vorschau, Nachtleben-Sektion)
12. Social Media Praesenz (Instagram, TikTok)

### INFRASTRUKTUR (morgen aufsetzen)

- Hetzner CAX31 bestellen (€11/Monat)
- Coolify installieren, GitHub Repo verbinden
- Cloudflare DNS + CDN (gratis)
- Supabase Pro Plan ($25/Monat)
- Domain: lasstreffen.at
- SSL: Cloudflare Full Strict + Let's Encrypt
- Scraper als Cron-Container (alle 6h)

**Gesamt: ~€40/Monat. Morgen live.**
