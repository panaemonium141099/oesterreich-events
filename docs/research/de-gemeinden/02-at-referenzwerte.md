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

| Quelle | Zeilen | Müll-Titel | ohne Uhrzeit | ohne Koordinaten | Gemeinde-Mittelpunkt | sichtbare Gemeinde-Dienste | Dubletten in der Quelle |
|---|---|---|---|---|---|---|---|
| gem2go | 9.132 | 0,0 % | 46,1 % | 0,2 % | 75,4 % | 0 | 3,3 % |
| gemeinde-registry | 20.857 | 0,2 % | 67,1 % | 0,2 % | 78,1 % | 0 | 1,1 % |
| gemeinden-generic | 7.828 | 0,1 % | 61,9 % | 0,4 % | 76,7 % | 0 | 1,3 % |
| **gepoolt** | **37.817** | **0,1 %** | **60,9 %** | **0,3 %** | 77,2 % | **0** | **1,7 %** |

Gepoolt heißt: Zähler addiert, Raten nach Zeilen gewichtet; Dubletten werden je
Quelle gezählt, weil Treffer zwischen Quellen erst der Dedup auflöst.

## Was die Kennzahlen messen

* **Müll-Titel:** `isGarbageTitle` (Datum, Navigation, Beschriftung statt Name).
* **ohne Uhrzeit:** `hasTimeOfDay` ist falsch (UTC- oder Wien-Mitternacht). Gemeinde-
  kalender nennen oft keine Uhrzeit; der Wert misst, dass ein Adapter keine erfindet
  und keine verliert. Ein DE-Adapter darf höchstens so oft ohne Uhrzeit sein wie AT.
* **ohne Koordinaten:** keine Position in der Zeile.
* **Gemeinde-Mittelpunkt:** `location_precision = 'municipality'`. Nur Information,
  keine Schwelle (abhängig von der Quelle, nicht vom Adapter).
* **sichtbare Gemeinde-Dienste:** öffentlich und `isMunicipalService`. Schwelle 0.
* **Dubletten in der Quelle:** gleicher Name, gleicher Wiener Kalendertag, gleicher Ort.

## Schwellen (`src/lib/pruefstand/schwellen.ts`)

| Prüfung | Grenze |
|---|---|
| sichtbare Gemeinde-Dienste | 0 |
| Müll-Titel, ohne Uhrzeit, ohne Koordinaten, Dubletten | höchstens AT gepoolt |
| Stichprobe 30 öffentliche Zeilen gegen die Quellseite | 30 von 30 Titel, Datum, Uhrzeit korrekt; Ort korrekt oder Quarantäne |

Die automatischen Schwellen prüft `npm run pruefstand:de` (Exit 1 bei Riss), die
Stichprobe der Mensch im Bericht. Erst beide zusammen geben einen Adapter für den
Nachtlauf frei. Die Referenz wird neu gemessen, wenn sich die AT-Scraper ändern;
die Datei trägt den Messzeitpunkt.

## Probelauf des Prüfstands

`gemeinden-wp-burgenland` (AT, 14 Seiten): geliefert 47, verworfen 5 (`start_in_past`),
geschrieben 35, alle öffentlich, alle automatischen Schwellen eingehalten; zweiter
Lauf offline aus dem Cache: 35 unverändert. Damit ist der Prüfstand deterministisch.
