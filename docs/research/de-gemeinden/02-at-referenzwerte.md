# AT-Referenzwerte für den DE-Prüfstand (fn-29.3, gemessen 2026-10-28)

Der Qualitätsvertrag DE (Epic fn-29) verlangt, dass jeder deutsche Adapter
nicht schlechter ist als die österreichischen Gemeinde-Scraper. Diese Werte
sind die Messlatte. Gemessen mit derselben Funktion, die der Prüfstand auf
DE-Adapter anwendet (`measureRows` in `src/lib/pruefstand/metrics.ts`), Daten:
[data/pruefstand/at-referenz.json](../../../data/pruefstand/at-referenz.json).

## Messung

`npm run pruefstand:at-referenz` (nur lesend gegen die Prod-DB `api.lasstreffen.at`).
Grundmenge je Quelle: `events` mit `source_name` = Quelle, `country = 'AT'`,
`start_date` ab Messzeitpunkt, `last_seen_at` in den letzten 7 Tagen (aktuell
geliefert, kein verwaister Altbestand), `publish_status <> 'duplicate'`.

| Quelle | Zeilen | Müll-Titel | ohne Uhrzeit | ohne Koordinaten | sichtbar ohne Koordinaten | Gemeinde-Mittelpunkt | sichtbare Gemeinde-Dienste | Dubletten in der Quelle |
|---|---|---|---|---|---|---|---|---|
| gem2go | 9.088 | 0,0 % | 46,3 % | 0,2 % | 0,01 % | 75,5 % | 0 | 2,8 % |
| gemeinde-registry | 20.807 | 0,2 % | 67,2 % | 0,2 % | 0,06 % | 78,2 % | 4 | 0,4 % |
| gemeinden-generic | 7.820 | 0,1 % | 62,0 % | 0,4 % | 0,18 % | 76,7 % | 0 | 1,3 % |
| **gepoolt** | **37.715** | **0,1 %** | **61,1 %** | 0,3 % | **0,07 %** | 77,2 % | 4 (Schwelle DE: 0) | **1,1 %** |

Dritte Messung 2026-10-28 21:53 UTC (fn-29.6, Online-Termine zählen bei „sichtbar ohne
Koordinaten“ nicht mehr; fn-29.5 maß mit ihnen 0,10 %). Die vier sichtbaren Gemeinde-Dienste
der gemeinde-registry sind „Restabfall“-Termine, die die Nachprüfung seit fn-29.2
hält, sobald sie im Nachtlauf läuft.

Gepoolt heißt: Zähler addiert, Raten nach Zeilen gewichtet; Dubletten werden je
Quelle gezählt, weil Treffer zwischen Quellen erst der Dedup auflöst.

## Was die Kennzahlen messen

* **Müll-Titel:** `isGarbageTitle` (Datum, Navigation, Beschriftung statt Name).
* **ohne Uhrzeit:** `hasTimeOfDay` ist falsch (UTC- oder Wien-Mitternacht). Gemeinde-
  kalender nennen oft keine Uhrzeit; der Wert misst, dass ein Adapter keine erfindet
  und keine verliert. Ein DE-Adapter darf höchstens so oft ohne Uhrzeit sein wie AT.
* **ohne Koordinaten:** keine Position in der Zeile. Nur Information: eine Zeile ohne
  belegten Ort in Quarantäne ist richtig („Ort korrekt oder Quarantäne“).
* **sichtbar ohne Koordinaten:** öffentlich und ohne Position. Schwelle. AT-Gemeinde-
  kalender haben immer den Gemeinde-Mittelpunkt, ein DE-Amtskalender hält Termine
  ohne genannte Gemeinde zurück; deshalb zählt nur, was öffentlich würde (fn-29.5).
  Online-Termine brauchen keine Position und zählen nicht (fn-29.6).
* **Gemeinde-Mittelpunkt:** `location_precision = 'municipality'`. Nur Information,
  keine Schwelle (abhängig von der Quelle, nicht vom Adapter).
* **sichtbare Gemeinde-Dienste:** öffentlich und `isMunicipalService`. Schwelle 0.
* **Dubletten in der Quelle:** gleicher Name, gleicher Beginn, gleicher Ort. Mit echter
  Uhrzeit zählt die Minute (Führung um 13 und um 15 Uhr sind zwei Events, so
  entscheidet auch der Dedup), ohne Uhrzeit der Wiener Kalendertag. Bis fn-29.5 zählte
  immer der Tag (AT gepoolt damals 1,7 %).

## Schwellen (`src/lib/pruefstand/schwellen.ts`)

| Prüfung | Grenze |
|---|---|
| sichtbare Gemeinde-Dienste | 0 |
| Müll-Titel, ohne Uhrzeit, sichtbar ohne Koordinaten, Dubletten | höchstens AT gepoolt |
| Stichprobe 30 öffentliche Zeilen gegen die Quellseite | 30 von 30 Titel, Datum, Uhrzeit korrekt; Ort korrekt oder Quarantäne |

Die automatischen Schwellen prüft `npm run pruefstand:de` (Exit 1 bei Riss), die
Stichprobe der Mensch im Bericht. Erst beide zusammen geben einen Adapter für den
Nachtlauf frei. Die Referenz wird neu gemessen, wenn sich die AT-Scraper ändern;
die Datei trägt den Messzeitpunkt.

## Probelauf des Prüfstands

`gemeinden-wp-burgenland` (AT, 14 Seiten): geliefert 47, verworfen 5 (`start_in_past`),
geschrieben 35, alle öffentlich, alle automatischen Schwellen eingehalten; zweiter
Lauf offline aus dem Cache: 35 unverändert. Damit ist der Prüfstand deterministisch.
