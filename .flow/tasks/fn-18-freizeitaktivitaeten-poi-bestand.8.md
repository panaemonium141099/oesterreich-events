## Description
UI-Einstieg fuer den Freizeit-Bestand (expliziter User-Wunsch 2026-07-26): Uebersichtsseite /aktivitaeten + Navigations-Eintrag. Bisher sind Aktivitaeten nur ueber Gemeinde-Hubs, Event-Cross-Links, Suche und Sitemap erreichbar.

**Size:** S/M
**Files:** src/app/[locale]/aktivitaeten/page.tsx (+ ggf. Client-Liste-Komponente), src/components/Activities/ActivityCard.tsx (wiederverwenden falls aus Task 4 vorhanden), Nav-Eintrag in der globalen Top-Navigation (V4TopNav — Chrome lebt NUR dort, Memory feedback_no_chrome_duplication), Footer-Link, messages/de.json (+ en.json DE-Fallback), sitemap-core.xml-Route (eine URL ergaenzen)

## Approach
- Seite: ISR analog /aktivitaet/[slug] (revalidate 3600, setRequestLocale, kein cookies()/auth im RSC); Server-Rendering der ersten Seite ueber die Public-View (anon-Client), "Mehr laden" client-seitig via /api/activities-Cursor.
- Filter: Bundesland-Chips + Kategorie-/Tag-Chips (aus der Task-1-Whitelist abgeleitet) + Indoor/Outdoor-Toggle (setting) — als Query-Parameter an /api/activities durchgereicht; die Seite selbst bleibt statisch (Filter-Interaktion rein client-seitig, KEINE searchParams im RSC-Pfad — sonst kippt sie dynamic).
- Karten-Optik konsistent zu Task 4 (Bilder + Copyright, onerror-Fallback, Distanz entfaellt hier).
- Nav: Eintrag "Freizeit" (o. ae.) in V4TopNav + Footer; i18n-Keys in beiden messages-Dateien.
- SEO: indexierbar, canonical auf DE (E13-Muster), eine statische URL in sitemap-core.
- E13: /en/aktivitaeten rendert DE-Content mit canonical auf DE, kein hreflang.

## Acceptance
- [ ] /aktivitaeten rendert serverseitig die ersten Aktivitaeten als Karten mit Bild; "Mehr laden" paginiert per Cursor ohne Full-Reload
- [ ] Bundesland-/Kategorie-/Indoor-Filter wirken (Client-seitig via API); Seite bleibt statisch (kein dynamic-Flip, HTML-Check)
- [ ] Nav-Eintrag in V4TopNav + Footer sichtbar, fuehrt auf /aktivitaeten; keine Chrome-Duplikate
- [ ] /en/aktivitaeten: canonical auf DE-URL, kein hreflang (E13)
- [ ] sitemap-core enthaelt /aktivitaeten; Vitest fuer Filter-Query-Bau + Seite (gegen Baseline)

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
