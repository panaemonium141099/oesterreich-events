# fn-18-freizeitaktivitaeten-poi-bestand.5 Viator/GYG-Monetarisierung: Client, Matching, BookingBox, Preis-Refresh

## Description
Monetarisierung analog Eventim-TicketBox: Viator-Basic-Client + Matching, BookingBox-Komponente, GYG-Deeplinks, taeglicher Preis-Refresh.

MENSCHLICHE VORAUSSETZUNG (blockiert nur diesen Task): Viator-Partner-Konto (Basic Access, sofort) + GYG-Affiliate-Konto registrieren, Keys/partner_id in BEIDE Secret-Stores (GitHub Actions + Vercel-Env).

**Size:** M
**Files:** src/lib/affiliate/viator-client.ts, src/lib/affiliate/gyg-links.ts, src/scripts/match-viator.ts, .github/workflows/ingest-activities.yml (Refresh-Step oder eigener Workflow), src/components/Activities/BookingBox.tsx, src/__tests__/lib/affiliate/*

## Approach
- Viator: Auth-Header exp-api-key, Base https://api.viator.com/partner, Endpoints /products/search, /products/{code}, /availability/schedules; Rate-Limit-Queue (<=150 req / 10 s rollierend); Produkt-Stammdaten <=24h, Preise taeglich refreshen (GH-Action, NICHT Vercel — Masterplan-Linie). Deeplink-pid-Format vor Implementierung in docs.viator.com/partner-api/affiliate/technical/ (Browser, JS-Doku) verifizieren.
- Matching: nur kommerzielle Tags (Action/Erlebnis), Namens+Orts-Aehnlichkeit mit konservativem Threshold — kein Match ist besser als ein falscher (Gap-Analyse); Ergebnis in poi_activities.affiliate_product jsonb.
- BookingBox: Muster V4TicketBox.tsx inkl. data-track (:83-85) -> data-track="activity_click" (ClickTracker frisst neue Werte automatisch); rel="sponsored nofollow" (Google-Pflicht) + sichtbare Affiliate-Kennzeichnung (EU/AT); i18n-Keys analog EventDetail-Namespace.
- GYG: Deeplink-Helper mit partner_id (kein API-Zugang: 100k-Visits-Minimum); Einsatz auf Gemeinde-/Themen-Flaechen wo kein Viator-Match existiert.
- Graceful degradation: fehlender Key / API down -> Box wird weggelassen, Seite rendert normal.
## Acceptance
- [ ] BookingBox rendert bei Produkt-Match mit "ab EUR"-Preis, Rating, rel="sponsored nofollow" und sichtbarer Kennzeichnung
- [ ] Klick erzeugt activity_click-Event in analytics_events (data-track verifiziert)
- [ ] Ohne VIATOR_API_KEY rendert die Seite ohne Box und ohne Fehler
- [ ] Matching-Report: Stichprobe von 20 Matches manuell geprueft, keine offensichtlichen Fehlzuordnungen; Threshold dokumentiert
- [ ] Preis-Refresh laeuft als GH-Action (taeglich) mit Rate-Limit-Queue; Viator-Caching-Regeln (Stammdaten <=24h, Preise kurzlebig) eingehalten
- [ ] Vitest: Queue-Verhalten, Deeplink-Builder (Viator pid + GYG partner_id), Match-Threshold
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
