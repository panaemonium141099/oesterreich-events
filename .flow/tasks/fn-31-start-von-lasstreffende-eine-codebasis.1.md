# fn-31-start-von-lasstreffende-eine-codebasis.1 Bestandsaufnahme Prod: DE-Zahlen, Index-Stand, Kapazität

## Description
Bestandsaufnahme gegen Prod, nur lesend. Ersetzt die Zahlen aus dem Auftrag durch Messwerte mit Datum und trägt sie in die Epic-Spec ein.

**Size:** M
**Files:** `src/scripts/de-bestand.ts` (neu, nur lesend), `.flow/specs/fn-31-…md`, `docs/MASTERPLAN.md` (neuer Abschnitt Deutschland, Zahlen)

## Approach
- DE-Events: gesamt, kommend, veröffentlicht, mit Koordinaten, mit `location_resolution.gemeinde`. Nur `count: 'planned'`, MV oder Blättern nach id (`forEachPageById`, `src/lib/db/fetch-all.ts`), nie `count exact`.
- Mehrdeutigkeit für den Backfill vorab messen: Anteil der DE-Zeilen, deren Gemeinde (Name, PLZ, Land) genau eine AGS in `gemeinden-de.json` trifft.
- Index-Stand: ist `20261112160000_events_country_indexes.sql` (PR #467) in Prod ausgeführt? Abfrage über `pg_indexes` (lesend).
- Kapazität lesend (SSH nur lesend, sonst den Nutzer um die Ausgabe bitten): RAM und Swap je Container, Writable-Layer, freie Platte, Größe der `events`-Indizes, Dauer und Größe von `event_map_points` und Payload.
- fn-29.9 und fn-29.15 sind noch offen: Messdatum und Adapter-Stand dazuschreiben.

## Key context
- Schreibzugriffe per SSH sind gesperrt, EXPLAIN nur als anon (Memory 2026-11-12).
- PostgREST liefert höchstens 1000 Zeilen je Antwort.
## Acceptance
- [ ] Messwerte mit Datum und Abfrage in der Epic-Spec (Abschnitt Ist-Zustand)
- [ ] Trefferquote der AGS-Ableitung gemessen (eindeutig, mehrdeutig, ohne Gemeinde)
- [ ] Index-Stand aus PR #467 belegt
- [ ] Kapazitätsaussage mit Zahlen: zweiter Container plus Indizes plus MV ja oder nein
- [ ] Keine Abfrage mit `count exact` oder breitem Scan
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
