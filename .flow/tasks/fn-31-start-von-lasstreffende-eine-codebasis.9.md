# fn-31-start-von-lasstreffende-eine-codebasis.9 Regionsfilter je Site: Events-API und Suche

## Description
Regionsfilter der Events-API und der Suche je Site: ein Helfer weiß, welche Spalten gelten.

**Size:** M
**Files:** `src/lib/site/region-filter.ts` (neu), `src/app/api/events/route.ts`, `src/app/api/events/search/route.ts`, `src/lib/search/smart-search.ts`, `src/lib/landing-data.ts`, `src/__tests__/api/events.test.ts`

## Approach
- `regionFilter(site, params)` bildet `bundesland(s)`, `district(s)` und neu `gemeinde` auf Spalten ab: AT auf `bundesland` und `district` wie heute (`route.ts:347` bis 359 und 847 bis 851), DE auf `region_id`, `kreis_key`, `gemeinde_key`.
- Unbekannte Regions-ID der Site ergibt 400, nie ein ungefiltertes Ergebnis.
- Kein `country`-Parameter von außen; der Länderfilter (`route.ts:338`, `842`) kommt aus der Site.
- Antwortfelder um die drei Spalten ergänzen.
- Smart-Suche: Regionserkennung im Intent je Site (AT-Bundesländer bzw. DE-Länder), `search_event_ids` mit `[site.country]`.
- `EXPLAIN` der DE-Varianten gegen Prod (als anon) in den PR.

## Key context
- Sortier-Kommentar in `/api/search/semantic` beachten: nicht ohne EXPLAIN umbauen.
- Der Zähler-Zweig (`route.ts:280`) zählt nur mit Regionsfilter: für DE dieselbe Regel, `planned` statt exact.
## Acceptance
- [ ] AT: Antworten der bestehenden API-Tests unverändert
- [ ] DE: Filter nach Land, Kreis und Gemeinde liefern nur DE-Events der Region (Tests mit Fixture-Zeilen beider Länder)
- [ ] Unbekannte Region ergibt 400
- [ ] `EXPLAIN` der DE-Abfragen nutzt die Indizes aus Task 7
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
