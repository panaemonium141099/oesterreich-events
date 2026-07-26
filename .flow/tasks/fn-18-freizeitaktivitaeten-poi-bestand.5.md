## Description
Monetarisierung analog Eventim-TicketBox: Viator-Basic-Client + Matching, BookingBox-Komponente, GYG-Deeplinks, taeglicher Preis-Refresh.

MENSCHLICHE VORAUSSETZUNG (blockiert nur diesen Task): Viator-Partner-Konto (Basic Access, sofort) + GYG-Affiliate-Konto registrieren, Keys/partner_id in BEIDE Secret-Stores (GitHub Actions + Vercel-Env).

**Size:** M
**Files:** src/lib/affiliate/viator-client.ts, src/lib/affiliate/gyg-links.ts, src/scripts/match-viator.ts, .github/workflows/ingest-activities.yml (Refresh-Step oder eigener Workflow), src/components/Activities/BookingBox.tsx, messages/de.json (+ en.json DE-Fallback; gleiche i18n-Regel wie Task 3), src/__tests__/lib/affiliate/*

## Approach
- Viator: Auth-Header exp-api-key, Base https://api.viator.com/partner, Endpoints /products/search, /products/{code}, /availability/schedules; Rate-Limit-Queue (<=150 req / 10 s rollierend).
- **Caching-Politik (Epic "Affiliate-Fakten", verbindlich):** Produkt-Stammdaten (Titel, Beschreibung, Bilder, product_code) lokal in affiliate_product speichern, taeglicher Refresh via GH-Action (NICHT Vercel — Masterplan-Linie). Preise/Verfuegbarkeit sind kurzlebig: Anzeige nur als "ab EUR" mit taeglichem Refresh + sichtbarem Hinweis "Preis kann abweichen". Exakte vertragliche TTLs beim Viator-Onboarding verifizieren und als dokumentierte Konstanten im Client hinterlegen.
- Deeplink-pid-Format vor Implementierung in docs.viator.com/partner-api/affiliate/technical/ (Browser, JS-Doku) verifizieren.
- Matching: nur kommerzielle Tags (Action/Erlebnis), Namens+Orts-Aehnlichkeit mit konservativem Threshold — kein Match ist besser als ein falscher (Gap-Analyse); Ergebnis in poi_activities.affiliate_product jsonb (matched_at Zeitstempel).
  <!-- Updated by plan-sync: fn-18.2 fuehrt is_closed live in poi_activities ein (dauerhaft geschlossene POIs: is_closed=true bei visible=true, SEPARAT von visible, Migration 20260724120000:94-98). Kanonische Anzeige-Bedingung ist immer `visible AND NOT is_closed` (Migration :168). Matching-Lauf UND BookingBox-Anzeige muessen geschlossene POIs ausschliessen (is_closed=false) — keine Buchungs-Box fuer geschlossene Aktivitaeten (Task-2-Spec: "via is_closed von ...Affiliate ausgeschlossen"). -->
- BookingBox: Muster V4TicketBox.tsx inkl. data-track (:83-85) -> data-track="activity_click" (ClickTracker frisst neue Werte automatisch); rel="sponsored nofollow" (Google-Pflicht) + sichtbare Affiliate-Kennzeichnung (EU/AT); i18n-Keys analog EventDetail-Namespace.
  <!-- Updated by plan-sync: fn-18.3 lieferte die Detailseite src/app/[locale]/aktivitaet/[slug]/page.tsx mit FIXEM Komponenten-Set (ActivityHero/ActivityFacts/ActivityMap/OpenNowBadge + ActivityExtrasSlot). Der ActivityExtrasSlot ist EXKLUSIV fuer Task 4 reserviert (Events in der Naehe; Task 4 fasst page.tsx nicht an) — die BookingBox hat also KEINEN vorbereiteten Slot. Task 5 muss die BookingBox daher selbst in page.tsx einhaengen (Datei fehlt oben in der Files-Liste -> ergaenzen). BookingBox nimmt den client-sicheren Typ PublicActivity (src/lib/activities/public-types.ts) an; das Feld affiliate_product existiert dort bereits (als `unknown` -> hier zum konkreten Viator-Produkt-Shape verengen), ebenso is_closed (geschlossene POIs von der Box ausschliessen, s. fn-18.2-Note oben). -->

- GYG: bewusst NUR vorbereitet, nicht abgenommen — das exakte Deeplink-Format (Ziel-Typ, URL-Template, Pflicht-Parameter neben partner_id) ist erst nach Konto-Freischaltung aus dem Partner-Portal verifizierbar. In diesem Task: gyg-links.ts als duenner Helper mit dokumentiertem TODO + Verifikationsschritt im Partner-Portal; BookingBox rendert GYG-Fallback erst, wenn das Template verifiziert ist (Feature-Flag/Env). KEIN Acceptance-Kriterium haengt an GYG. Gemeinde-/Themen-Flaechen-Einsatz bleibt Follow-up ausserhalb fn-18.
- Graceful degradation: fehlender Key / API down -> Box wird weggelassen, Seite rendert normal.

## Acceptance
- [ ] BookingBox rendert bei Produkt-Match mit "ab EUR"-Preis + "Preis kann abweichen"-Hinweis, Rating, rel="sponsored nofollow" und sichtbarer Kennzeichnung
- [ ] Klick erzeugt activity_click-Event in analytics_events (data-track verifiziert)
- [ ] Ohne VIATOR_API_KEY rendert die Seite ohne Box und ohne Fehler
- [ ] Matching-Report: Stichprobe von 20 Matches manuell geprueft, keine offensichtlichen Fehlzuordnungen; Threshold dokumentiert
- [ ] Preis-Refresh laeuft als taegliche GH-Action mit Rate-Limit-Queue; Caching-Politik (Stammdaten taeglich, Preise kurzlebig) im Client als Konstanten dokumentiert; vertragliche TTLs nach Onboarding verifiziert und im Code-Kommentar referenziert
- [ ] Vitest: Queue-Verhalten, Viator-Deeplink-Builder (pid), Match-Threshold; GYG-Helper existiert hinter Flag mit dokumentiertem Verifikations-TODO (kein AC an GYG-Live-Links)

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
