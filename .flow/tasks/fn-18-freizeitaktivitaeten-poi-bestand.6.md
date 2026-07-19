# fn-18-freizeitaktivitaeten-poi-bestand.6 Smart-Suche: contentTypes + activityMatches + Entdecken-UI-Block

## Description
Smart-Suche versteht Aktivitaets-Absichten und liefert sie als separates, additives Feld ueber einen EIGENEN Retrieval-Pfad aus — ohne den Event-Pfad anzufassen.

**Size:** M
**Files:** src/lib/search/smart-query.ts, src/app/api/search/semantic/route.ts, src/components/Entdecken/ (ActivityResultCard + Block in V4EntdeckenSmartMode), src/__tests__/lib/smart-query*.ts + Route-Tests

## Approach
- SearchIntent (smart-query.ts:216-224): contentTypes: ('event'|'activity')[] ergaenzen; validateIntent (:251-283) whitelistet via cleanList-Muster, Default ['event'] (kein Drift fuer Bestandsqueries).
- intentIsEmpty (:286-291) MUSS non-default contentTypes als Signal werten (Epic E9) — sonst degradiert eine Activity-only-Query ("wo kann ich mountaincart fahren" ohne Event-Facetten) in den Event-Top-Score-Fallback der Route.
- Gemini: responseSchema (route.ts:96-107) + Prompt-Regel fuer Aktivitaets-Absichten ("wo kann ich mountaincart fahren", "was tun bei Regen in X").
- Eigener Retrieval-Pfad `fetchActivityMatches(intent)` NEBEN fetchCandidates (route.ts:195-275): trgm auf name/description + Tag-Filter aus derselben Whitelist, visible=true und duplicate_of IS NULL, OHNE Datumsfilter; eigenes Ranking (trgm-similarity + Tag-Match-Anzahl). fetchCandidates behaelt seinen event-only-Contract; rankCandidates bleibt event-only. SCORE_ORDER/baseQuery (:177-193, EXPLAIN-Kommentar) und filter_after_date>=NOW()-Invariante NICHT anfassen (Memory semantic_search_future_only).
- Response: additives Feld activityMatches; bestehende Consumer brechen nicht (Feld wird ignoriert bis UI-Block da ist).
- UI: Block "Passende Aktivitaeten" in V4EntdeckenSmartMode mit Typ-Badge, Links auf /aktivitaet/*.
## Approach
- SearchIntent (smart-query.ts:216-224): contentTypes: ('event'|'activity')[] ergaenzen; validateIntent (:251-283) whitelistet via cleanList-Muster, Default ['event'] (kein Drift fuer Bestandsqueries).
- Gemini: responseSchema (route.ts:96-107) + Prompt-Regel fuer Aktivitaets-Absichten ("wo kann ich mountaincart fahren", "was tun bei Regen in X").
- fetchCandidates (route.ts:195-275): NEUER paralleler poi_activities-Zweig (trgm auf name/description + Tag-Filter aus derselben Whitelist, visible=true, OHNE Datumsfilter). SCORE_ORDER/baseQuery (:177-193, EXPLAIN-Kommentar) und filter_after_date>=NOW()-Invariante der Event-Queries NICHT anfassen (Memory semantic_search_future_only).
- Response: additives Feld activityMatches (Ranking: trgm-similarity + Tag-Match-Anzahl; rankCandidates bleibt event-only, Epic E9). Bestehende Consumer brechen nicht (Feld wird ignoriert bis UI-Block da ist).
- UI: Block "Passende Aktivitaeten" in V4EntdeckenSmartMode mit Typ-Badge, Links auf /aktivitaet/*.
## Acceptance
- [ ] "wo kann ich mountaincart fahren" liefert activityMatches mit dem Fulseck-POI; "konzerte wien heute" liefert unveraenderte Event-Ergebnisse
- [ ] Activity-only-Query ohne Event-Facetten faellt NICHT in den Event-Fallback (intentIsEmpty-Test mit contentTypes=['activity'])
- [ ] Regressionstest: Event-Query-Aufbau identisch zu vorher (Snapshot/Spy auf Query-Parameter inkl. filter_after_date>=NOW()); fetchCandidates-Signatur/Contract unveraendert
- [ ] validateIntent: unbekannte contentTypes-Werte werden verworfen, Default ['event'] ohne Feld
- [ ] Ohne activityMatches im Response rendert /entdecken unveraendert (Abwaertskompatibilitaet)
- [ ] trgm-Query nutzt Index (EXPLAIN dokumentiert im PR — Micro-Instanz!)
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
