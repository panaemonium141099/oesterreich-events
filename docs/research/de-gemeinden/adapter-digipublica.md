# DE-Adapter DigiPublica (fn-29.15, Prüfstand 2026-10-30)

DigiPublica betreibt eine Neos-Plattform für bayerische Gemeinden. Der Adapter
`de-digipublica` (`src/lib/scrapers/de/DigipublicaDeScraper.ts`, Parser `digipublica.ts`)
liest das Veranstaltungsmodul „gdc“ der Registry-Einträge mit Merkmal `digipublica`
(60 Gemeinden auf 52 Registry-Seiten, eine über die Verwaltungsgemeinschaft). Er steht
in `DE_SCRAPERS`, nicht im Nachtlauf (fn-29.18). Abrufe über `BaseScraper.fetchHtml`,
robots.txt je Website, mindestens 1 s Pause. Teil von fn-29.15.

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Kalenderblatt `[data-calendar]` trägt alle kommenden Termine als JSON (`title`, `start`, `end`, `url` mit `selectedDate`) | Grafing 184, Cham 170, Feldkirchen 145 Termine; die sichtbare Liste zeigt 12 bis 15 | Kalenderblatt ist die Quelle; die Liste ergänzt Text, Bild und Absage |
| „Mehr laden“ der Liste lädt per Skript nach | Kalchreuth, Baar-Ebenhausen: 15 sichtbar | ohne Kalenderblatt nur die sichtbaren Termine |
| Ganztägig als Platzhalterzeit | Beginn 00:00, 00:01, 00:05; Ende 23:55, 23:59, 00:05 (Effeltrich, Feldkirchen „Gemeinderatssitzung“ 00:01 bis 23:59, Sommerhausen „Kirchweih“ 00:05 bis 23:55) | ganztägig, Ende als Tag |
| Ende `1970-01-01T` | VG Altfraunhofen 46 von 52 | kein Ende |
| Ende genau fünf Minuten nach dem Beginn | Hirschau „Halloween“ 18:00 bis 18:05, Eisenheim „Rathaussturm“ 18:11 bis 18:16 | kein Ende |
| Uhrzeit ohne Minuten | Kalchreuth „19 Uhr ‐ 23:59 Uhr“ | gelesen, 23:59 heißt Ende offen |
| Liste ohne Jahr (`dateFormat=shortDate`) | Dingolfing 6 Einträge, Link ohne `selectedDate` | nicht gelesen (Jahr nicht belegt) |
| Absage | Kalchreuth „Termin abgesagt“ an der Rentenberatung | Termin fällt weg |
| Websites eines Verbunds teilen eine Datenbank | VG Altfraunhofen und Baierbach: dasselbe Kalenderblatt; VGem Boos: „Trauerkaffee“, „Blutspenden Boos“ auf allen fünf Websites | derselbe Termin einmal, keine Website als Ort (wie communice) |
| Kein Ort in Kalenderblatt oder Liste; die Detailseite nennt ihn | Boos „Schützenheim Boos, 87737 Boos, Jahnstraße 5“ | Gemeinde des Kalenders (`municipality`), im Verbund nur die Gemeinde, die der Titel nennt |
| Gemeindelogo als Bild | `gdc-image-placeholder` (Mindelheim `Logo Mindelheim.svg`) | kein Bild |
| Gemeinde-Dienst | Feldkirchen „Gartenabfall-Abfuhr“ | erkannt über `gartenabf[äa]ll` (fn-29.16), Testfall ergänzt |

Ohne gdc-Modul blieben 21 Registry-Seiten (Unterseiten wie Musikschule, Bildergalerie,
Veranstaltungsorte, eine Detailseite in Gaißach, PDF-Listen).

## Ergebnis

Erster Lauf online (104 Abrufe): 52 Registry-Seiten, 31 Kalender. Geliefert 1.452,
verworfen 3 (`start_in_past`), geschrieben 1.435, öffentlich 1.339, Quarantäne 96
(`no_location_evidence` 61, im Verbund ohne Gemeinde im Titel; `municipal_service` 33;
`start_too_far_ahead` 2).

| Prüfung | DigiPublica | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 4,5 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,1 % |
| Dubletten in der Quelle | 0,0 % | 1,1 % |

Stichprobe (30 öffentliche Zeilen) gegen die Detailseiten: 30 von 30 Titel, Datum und
Uhrzeit korrekt (Termintabelle der Detailseite), auch Reihen (Boos „Fit durch Tanz im
Sitzen“, Niederrieden „Sitztanz“). Ort: 30 von 30 die Gemeinde des Kalenders; wo die
Detailseite einen Ort nennt, liegt er dort (Eching „Feuerwehrraum in Viecht“, Ortsteil).

## Dorffest-Probe gegen die Quellseite

| Termin | Adapter | Quellseite |
|---|---|---|
| Sommerhäuser Weihnachtsmarkt | 12.12.2026 13:00 | 12.12.2026, 13:00 Uhr, Markt Sommerhausen, Hauptstraße 15 |
| Sommerhäuser Kirchweih | 01.10.2027 bis 05.10.2027 ganztägig | Kalenderblatt 00:05 bis 23:55 |

## Offen

* Öffentliche Sitzungen (Gemeinderatssitzung Feldkirchen, Poxdorf) bleiben wie in
  Österreich sichtbar (Entscheidung 2026-10-14).
* Listen ohne Kalenderblatt zeigen nur die ersten Termine; „Mehr laden“ ist kein GET.
* 21 Registry-Seiten ohne gdc-Modul; eine nächste Erhebung kann sie anderen
  Integrationen zuordnen.
