# Handoff — Österreich Events

## Projekt-Status
- **47k Events** in SQLite, **~42k in Supabase** (Migration 94% fertig)
- **Next.js 16** + React 19 + TypeScript + Tailwind CSS v4 + Supabase + Mapbox GL JS
- **Auth**: Google OAuth + Email/Passwort via Supabase Auth
- **Supabase Projekt**: `booljdtrktpotsenbnut` (Frankfurt EU)

## Was fertig ist
- Interaktive Karte mit 42k+ Events, Clustering, Bundesland-Overlay
- Landing Page mit Vorhang-Animation
- Login/Register (Google + Email) mit Profile Completion Flow
- Profil-Seite mit allen Pflichtfeldern
- Event Detail mit Merken, Erinnern, Teilen, .ics Export
- Persönlicher Kalender (/calendar) mit Freunde-Sharing
- Event Planen (/groups) — Eigenes Event oder Bestehendes Event
- Event Dashboard (/groups/[id]) mit Chat, Teilnehmer, RSVP, Memories, Log
- Freunde-System (/friends) mit Suche, Anfragen, Annehmen
- Direktnachrichten (/messages) mit Realtime
- Feed (/feed) mit Create Post, Trending, Aktivitäten
- Memories (/memories) mit Foto-Upload
- Spotify Artist Alerts (OAuth, top artist import, manual search, pg_trgm matching, in-app/email/SMS notifications, event reminders 7d/1d)
- Admin Panel (/admin) mit 6 Tabs: Übersicht, Users, Events, Statistiken, Scraper, Moderation
- Analytics Tracking (page_view, event_click, search, etc.)
- Legal: Impressum, Datenschutz, AGB, Cookie Banner, Consent Checkboxen
- 126 Scraper registriert (GEM2GO, Feratel 71 Regionen, Meinbezirk, OeTicket, TourData, Wien OGD, 8 Museen, 5 Sport-Verbaende, 4 Messen/Business, Meetup, ntry.at, etc.)
- GitHub Actions Workflow für automatisches Scraping (3:00 Uhr)

## Was NICHT fertig ist / Bugs

### Kritisch (vor Launch fixen):
1. **Event Planen UI** — "Eigenes Event" Formular funktioniert evtl. nicht (RLS auf groups INSERT prüfen), UI braucht Polish mit UI/UX Pro Max Skill
2. **Freunde-Suchleiste** — Fehlt bei der Freunde-Einladung im Event Planen und zum Filtern der eigenen Freundesliste
3. **Social Features Endlos-Spinner** — Friends/Messages/Groups zeigen manchmal Endlos-Spinner wenn Supabase Queries durch RLS geblockt werden
4. **Cookie Banner** — existiert, sieht aber noch billig aus, braucht UI/UX Pro Max Polish
5. **Bezirk-Filter** — Karte soll ALLE Events zeigen wenn nach Bezirk gefiltert, nur Sidebar filtert. Kamera soll zum Bezirk fliegen.
6. **Profilbild** — Avatar zeigt manchmal broken image statt Initialen-Fallback

### Wichtig (sollte vor Launch):
7. **Nightlife/Club Scraper** — Research wurde gemacht (data/nightlife-sources.json prüfen), Scraper noch nicht gebaut
8. **Feratel Koordinaten** — ~2800 Events haben Region-Center-Coords statt echte Ortskoordinaten
9. **Meinbezirk Beschreibungen** — 100% der 3842 Events haben keine Description (Scraper holt nur Listenansicht)
10. **Event-Bilder Fallback** — 41% der Events ohne Bild, Kategorie-Fallback-Bilder fehlen
11. **Supabase ↔ SQLite Sync** — Scraper schreiben in SQLite, Events müssen nach Supabase migriert werden nach jedem Scrape-Run
12. **Deployment auf Vercel** — noch nicht gemacht

### Nice to have:
13. **Spotify Extended Quota** — Spotify Dev Mode limited to 5 users; apply for Extended Quota for public launch. Manual artist following works for all users.
14. **Facebook Integration** — noch nicht implementiert
15. **Business Profiles** — Grundstruktur da, aber Flow nicht fertig
16. **Mobile App-Verweis Screen** — fehlt noch
17. **Uni Event Scraper** — 41 Uni/FH/PH Scraper implementiert (fertig)

## Wichtige Dateien
- `CLAUDE.md` — Projekt-Beschreibung und Tech-Stack
- `data/AUDITS.md` — 5 Audit-Ergebnisse (Security, UX, Code, Daten, Architektur)
- `data/AUDIT-EVENT-PLANNER.md` — Audit der Event Planen Features
- `data/affiliate-research.txt` — Affiliate Programme (oeticket, Ticketmaster)
- `data/austrian-tourism-regions.json` — 104 Tourismus-Regionen
- `data/gemeinden-event-pages.json` — 923 Gemeinde-Event-Seiten
- `RESEARCH-austrian-tourism-regions.md` — Tourismus-Regionen Recherche
- `src/scripts/validate-events.js` — Event-Validator (Garbage, Duplikate, Zeiten)
- `src/lib/scrapers/FeratelScraper.ts` — Universeller Feratel API Scraper (71 Regionen)

## UI/UX Pro Max Skill
Installiert unter: `C:\Users\jonag\AppData\Local\Temp\skills-RV52JK\.claude\skills\ui-ux-pro-max\SKILL.md`
MUSS bei JEDER UI-Änderung verwendet werden. Regeln:
- SVG Icons only (KEINE Emoji im UI)
- Touch targets min 44x44px
- Animationen 150-300ms ease-out
- Glassmorphism: bg-white/[0.03] border border-white/[0.06]
- prefers-reduced-motion Support
- Skeleton Loading statt Spinner

## Supabase Credentials
- Project URL: https://booljdtrktpotsenbnut.supabase.co
- Anon Key: in .env.local (NEXT_PUBLIC_SUPABASE_ANON_KEY)
- Service Role Key: in .env.local (SUPABASE_SERVICE_ROLE_KEY)
- GitHub Token: in .env.local (GITHUB_TOKEN)
- Google OAuth Client ID: 848258672047-1fnpbbd7mvqldpue113p5nf7l86k6tl3.apps.googleusercontent.com

## Nächste Schritte (Priorität)
1. Event Planen UI fixen + polishen (UI/UX Pro Max Skill verwenden!)
2. RLS Policies für Social Features debuggen und fixen
3. Cookie Banner + Standort-Banner polishen
4. Bezirk-Filter Verhalten anpassen
5. Deployment auf Vercel
6. AWIN Affiliate Bewerbung (braucht live URL)
