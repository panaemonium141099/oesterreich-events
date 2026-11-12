# fn-31-start-von-lasstreffende-eine-codebasis.6 Regionsspalten: Migration, Ortsentscheidung mit Schlüssel, Schreibweg

## Description
Regionsspalten `region_id`, `kreis_key`, `gemeinde_key` auf `events`, gefüllt vom einen Schreibweg für AT und DE.

**Size:** M
**Files:** `supabase/migrations/<ts>_events_region_columns.sql` (neu), `src/lib/location/types.ts`, `src/lib/location/resolver.ts`, `src/lib/location/ortsdaten.ts`, `src/lib/location/region-keys.ts` (neu), `src/lib/db/supabase-sync.ts`, `src/__tests__/lib/location/region-keys.test.ts`, Golden-Tests des Sync

## Approach
- Migration: drei nullable Textspalten ohne Standardwert, ohne CHECK, ohne FK, mit kurzem `lock_timeout`. Abwärtskompatibel.
- `LocationDecision.gemeinde` (`types.ts:91`) bekommt `key` und `kreisKey`; `LOCATION_RESOLUTION_VERSION` (`types.ts:76`) steigt. AT: Kennziffer aus `src/lib/gemeinden/data.ts`, Bezirk als erste drei Stellen der Kennziffer nur wenn die Stammdatei das so führt, sonst das Feld der Stammdatei. DE: `GemeindeDe.ags` und `kreisKey`.
- Eine pure Funktion `regionKeys(decision, country)` in `region-keys.ts` leitet die drei Werte ab; Sync und Backfill (Task 7) teilen sie. Auch für Entscheidungen der alten Version (ohne `key`): Ableitung über Name, PLZ und Land, mehrdeutig ergibt NULL.
- `supabase-sync.ts` (um Zeile 777 bis 949): die drei Spalten in jeder Zeile ausdrücklich setzen, fehlend als NULL (fn-25-Vertrag: Entscheidung atomar). `bundesland` und `district` bleiben wie sie sind.
- Wächter: jeder geschriebene Wert existiert in der Stammdatei seines Landes.

## Key context
- fn-26.1 und fn-26.2 (todo) ändern ebenfalls `supabase-sync.ts`: nicht parallel bearbeiten.
- Ein DE-Wert in `bundesland` oder `district` weist den ganzen Batch ab (`writesAustrianRegionColumns`).
- Die Migration wird in Prod per psql ausgeführt, danach `NOTIFY pgrst, 'reload schema'`; vorher darf kein Code deployt sein, der die Spalten schreibt (Reihenfolge im PR nennen).
## Acceptance
- [ ] Migration liegt vor, ist abwärtskompatibel und in Prod ausgeführt (Beleg im PR)
- [ ] Sync schreibt die drei Spalten für AT und DE, fehlend als NULL (Golden-Tests mit je mindestens fünf echten Fällen, darunter namensgleiche DE-Gemeinden und ein DE-Ortsteil)
- [ ] Kein DE-Wert in `bundesland` oder `district`; bestehende Sync-Tests unverändert grün
- [ ] `regionKeys` ist pur, getestet und von keinem Netzabruf abhängig
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
