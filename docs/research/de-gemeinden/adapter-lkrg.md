# DE-Adapter ILE Rhön-Grabfeld / lkrg.net (fn-29 Rest-Adapter, Prüfstand 2026-11-07)

17 Gemeinden im Landkreis Rhön-Grabfeld (Bayern) nutzen den Veranstaltungskalender der
ILE (lkrg.net, Software sqronline). Die TYPO3-Seiten binden das Snippet
`snippets.lkrg.net/<Token>/general_event_calendar_sqr/snippet.js` ein; das
Kalender-Element trägt `data-moddivuuids` (UUID des Kalender-Moduls der Gemeinde). Die
Vue-App lädt die Termine von
`https://aht1gh-api.sqronline.de/api/modules/events/getevents?module_division_uuid=<UUID>`
(aus `app.dab64e19.js` gelesen): JSON mit Titel, Veranstalter, Beschreibung (HTML), Ort,
Straße, „PLZ Ort", Start-/Enddatum, Uhrzeiten, Kategorie, Vorverkauf und Bildern
(files1.sqronline.de).

Adapter `de-lkrg` (`src/lib/scrapers/de/LkrgDeScraper.ts`, Parser `lkrg.ts`): Seite
lesen, UUID finden, JSON lesen; vergangene Termine (die API liefert sie mit) fallen weg.
Quelle ist die Kalenderseite der Gemeinde; `source_id` = `lkrg-<UUID des Termins>`.

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Ortsteil hinter dem Komma | `event_plzort` „97618 Hohenroth, Leutershausen" | Gemeinde vor dem Komma, PLZ davor |
| Ohne Uhrzeit | `event_startzeit` null | Datum ohne Uhrzeit |
| Enddatum ohne Endzeit | mehrtägig | Ende 23:59 des letzten Tags |
| Zweites Snippet | `snippets.sqronline.de/088d4a46-…` ist die Navigation, kein Kalender | nur das lkrg-Snippet zählt |
| Kein Kalender | Emersacker `meldeformular-veranstaltungen.html` (Meldeformular, 1 von 17) | „kein lkrg-Kalender" im Log |

## Ergebnis (2026-11-07)

17 Seiten, 16 mit Kalender, 298 Termine geliefert, 3 vom Sync verworfen, 282
geschrieben, öffentlich 274, Quarantäne 8 (`no_position` 7, `municipal_service` 1).

| Prüfung | lkrg | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 7,8 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,07 % |
| Dubletten in der Quelle | 0,0 % | 1,1 % |

Stichprobe (30 öffentliche Zeilen): Titel, Tag, Uhrzeit und Ort entsprechen der
JSON-Antwort der API, die auch der Kalender der Gemeinde anzeigt (Hohenroth
„Kirchweihessen" 07.11.2026 18:00, Seeheim, Seestraße 4, 97618 Hohenroth).
