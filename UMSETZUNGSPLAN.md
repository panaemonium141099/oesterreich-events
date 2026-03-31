# LassTreffen.at - Technischer Umsetzungsplan

## IST-Zustand (Scan 31.03.2026)

- 44 Scraper, 41.380+ Events, alle 9 Bundeslaender abgedeckt
- Next.js 16 + React 19 + Supabase + Mapbox GL JS
- Social Features vorhanden: Chat (DMs + Gruppen), Freunde, Feed, Memories, Kalender
- Events haben: view_count, save_count, share_count (aber kein Scoring/Ranking-Algorithmus)
- 13 Kategorien, tags[] Array existiert in DB aber Multi-Tag noch nicht implementiert
- Admin Panel mit 6 Tabs (Overview, Users, Events, Analytics, Scrapers, Moderation)
- Kein Blog-System, kein CMS, keine Affiliate-Integration
- Kein Event-Scoring-Algorithmus
- Kein automatisiertes Content-System
- 41% der Events ohne Bild, MeinBezirk ohne Beschreibungen
- Security Issues: ignoreBuildErrors:true, Service Role Key in API Routes, Admin Routes ungeschuetzt
- Leaflet Dependencies noch in package.json obwohl auf Mapbox migriert
- Nicht deployed (Vercel ausstehend)

---

## VISION: Was LassTreffen.at werden soll

Oesterreichs fuehrende Event-Discovery-Plattform mit Social Network, Blog/Magazin, automatisierter Content-Pipeline und Affiliate-Monetarisierung. Voll automatisiert durch AI-Agents die Events scrapen, pruefen, promoten und Content erstellen.

---

## PHASE 1: Fundament & Security (Prioritaet: KRITISCH)

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

### 5.2 UI Animationen & Interaktionen

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

## PHASE 8: Automation Agents (Langfristig)

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

## PHASE 9: Deployment & Launch

### 9.1 Vercel Deployment

- Vercel Projekt aufsetzen, Environment Variables konfigurieren
- Preview Deployments fuer Feature Branches
- Production auf lasstreffen.at Domain

### 9.2 Domain & DNS

- lasstreffen.at -> Vercel
- SSL automatisch via Vercel

### 9.3 Social Media Praesenz

- Instagram: @lasstreffen.at oder @lasstreffenat
- TikTok: @lasstreffen
- WhatsApp Channel: "LassTreffen - Events Oesterreich"
- Facebook Page (niedrige Prioritaet)

---

## Zusammenfassung: Reihenfolge der Umsetzung

1. Security & TypeScript Fixes (MUSS vor Launch)
2. Datenqualitaet (Bilder, Beschreibungen, Koordinaten)
3. Multi-Tag System
4. Event-Scoring Algorithmus
5. Blog-System (DB, Seiten, SEO)
6. Landing Page Redesign (Featured Events, Festivals, Blog-Vorschau)
7. Neue Scraper (Unis, Nischen, regionale Luecken)
8. Performance-Optimierung
9. UI Animationen
10. Chat Event-Suche
11. Affiliate-Integration
12. Deployment auf Vercel
13. Automation Agents (nach Launch, schrittweise)

Jede Phase ist eigenstaendig commitbar und bringt sichtbaren Mehrwert.
