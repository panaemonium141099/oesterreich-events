# DE-Adapter Hirsch & Wölfl hwveranstaltung (fn-29.12, Prüfstand 2026-10-29)

Hirsch & Wölfl (Medienwerk Vellberg) liefert den Gemeinden die TYPO3-Extension
`hwveranstaltung`. Einen Feed gibt es nicht, `?type=` sperrt robots.txt. Der Adapter
`de-hwveranstaltung` (`src/lib/scrapers/de/HwDeScraper.ts`, Parser `hw.ts`) liest die
Kalenderliste `<Kalenderpfad>/seite-N/suche-none` aller Registry-Einträge mit Merkmal
`hwext` (427 eigene Kalenderseiten, 2 über die Verwaltungsgemeinschaft, zusammen 429
Kalender), zehn Termine je Seite, höchstens 40 Seiten. Er steht in `DE_SCRAPERS`, nicht im
Nachtlauf (fn-29.18). Abrufe über `BaseScraper.fetchHtml`, robots.txt je Website,
mindestens 1 s Pause (kein Kunde setzt Crawl-delay).

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Die Liste trägt alles, was die Detailseite trägt: Titel, Kategorie, Datum, Uhrzeit, Veranstalter, Ort | Bempflingen „Martinimarkt“, Auenwald „Winterkonzert“, Höpfingen „Kerwe“: Detailseite ohne weitere Uhrzeit | nur Listenseiten, keine Detailabrufe |
| Datum „07.11.2026“ oder „07.11.2026 bis 08.11.2026“, Uhrzeit „16:00 Uhr“ oder „16:00 Uhr bis 20:00 Uhr“, sonst keine Uhrzeit | 801 Datensätze aus 85 Kalendern: nur diese vier Formen | ohne Uhrzeit ganztägig, Wandzeit als deutsche Ortszeit; Ende vor Beginn ohne Enddatum bleibt offen |
| Veranstaltungen mit mehreren Terminen: je Termin ein Datensatz, teils mit `…/termin-<n>`, teils ohne | Höpfingen `555/…/termin-3388` und `termin-3389`; Bempflingen `record__647-2855`; Pfalzgrafenweiler „Hallenbad Di.“ jeden Dienstag ohne Terminseite | `source_id` = `hw-<Host>-<Datensatz>-t<Termin>`, ohne Termin-ID `…-<Datensatz>-<Tag>` |
| Ohne Terminseite zeigt die Detailseite nur den ersten Termin | „Hallenbad Di.“: Liste 24.11.2026, Detailseite 03.11.2026 | `source_url` ist die Detailseite der Veranstaltung (eine eigene gibt es nicht), maßgeblich ist die Liste |
| Koordinate im OpenStreetMap-Link (`mlat`/`mlon`), Adresse im Apple-Maps-Link `q=<Titel>,<Straße><Nr>,<PLZ><Ort>`, Hausnummer ohne Leerzeichen | Frickenhausen „Kirbe TV Tischardt“ `Ermsstraße3,72636Frickenhausen`; ohne Adresse `Seniorenfeier,,` (Kupferzell) | von rechts gelesen (Titel kann Kommas tragen), Hausnummer abgetrennt; 0,0 und fehlende Werte verworfen |
| Ortsfeld mit angehängten Adresszeilen | Auenwald „Katholisches Gemeindehaus Ebersberg <br>Kirchberg7 <br>71549Auenwald“ | nur die erste Zeile ist der Ort |
| Ältere Modulversionen ohne Detailseite je Termin | Volkertshausen `record record_list kalenderKatIdN`, Osterburken `einzeleintrag kalenderKatIdN` | erkannt, nicht gelesen (21 Kalender) |
| Registry nennt teils eine Seite unter dem Kalender | „…/veranstaltungen/veranstaltung-melden“, „…/veranstaltungen/dorffest“, `leaflet.css` | trägt die Seite keine Liste, gilt die Seite eine Ebene höher, wenn dort die Liste steht |
| Leere Liste | Gundelfingen „Es sind derzeit keine Einträge vorhanden“ | als Liste erkannt, kein weiterer Abruf |
| robots.txt sperrt Bilder (`/fileadmin/Dateien/`, `/fileadmin/_processed_/`, `/*.jpg$` usw.) | alle geprüften Kunden; Ammerbuch, Dinkelsbühl, Sindelfingen liefern `…JPG` in Großbuchstaben | Bild nur, wenn robots.txt den Pfad in beiden Schreibweisen freigibt, dann über `bild.ts` (2 Bilder in Klettgau) |

Kalender ohne Termine im Lauf: 56 Registry-Seiten ohne Kalenderliste (auch eine Ebene
höher nicht), 14 nicht lesbar (HTTP 401 auf „veranstaltung-melden“, 404, CSS-Datei),
3 von robots.txt gesperrt (CSS-Pfade der Registry), 21 ältere Modulversion. 8 Kalender
haben mehr als 40 Seiten (Ehningen, Eppingen, Endingen, Vellberg und andere); die Liste
beginnt heute, spätere Termine rücken in den folgenden Nächten nach.

## Ergebnis

Termine aus 320 Websites, 429 Kalender. Geliefert 18.913, verworfen 46 (`start_in_past`),
geschrieben 18.867, öffentlich 17.898, Quarantäne 969 (`start_too_far_ahead` 530,
`municipal_service` 495, `no_position` 39, `no_location_evidence` 31,
`placeholder_location` 6). Die 530 sind echte Einträge mehr als drei Jahre voraus
(Bergatreute führt Feiertage bis 2030, Ehningen und Ochsenfurt Serien). Ein zweiter Lauf
offline aus dem Cache mit dem endgültigen Parser: 18.867 Zeilen unverändert.

| Prüfung | hwveranstaltung | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 23,8 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,07 % |
| Dubletten in der Quelle | 0,5 % | 1,1 % |

Gemeinde-Dienste aus echten Proben in Quarantäne: Bühlertann „Müllabfuhr: Rest- und
Biomüll, Gelber Sack“, Altpapiersammlungen, Bürgersprechstunden (Steinheim an der Murr
und andere). Gemeinderatssitzungen bleiben sichtbar wie in Österreich
(`municipal-service.ts` nimmt Sitzungen nur aus der Suche); 755 öffentliche Zeilen mit
„Sitzung“ im Titel.

Stichprobe (30 öffentliche Zeilen, Seed 29) gegen den Text der Kalenderliste und die
Detailseite: 30 von 30 Titel, Datum und Uhrzeit korrekt, Orte richtig, Ortsteile der
richtigen Gemeinde zugeordnet (Wetzisreute in Schlier, Darstadt und Hohestadt in
Ochsenfurt, Bergfelden in Sulz am Neckar), „Ganztägig“ ohne Uhrzeit (Altlußheim). Die
Nachbargemeinde mit eigener Adresse gilt (Auenwald „Kirchweihfest“, Uhlandstraße 15,
71566 Althütte, Golden-Test).

Dorffeste gegen die Quellseite:

* „Kirbe TV Tischardt“, Frickenhausen: Seite 08.11.2026, 10:00 Uhr, Autmuthalle
  Tischardt, Ermsstraße 3, 72636 Frickenhausen; Zeile 10:00 Ortszeit, Koordinate der
  Halle, Gemeinde Frickenhausen.
* „Dorffest“, Böhmenkirch: Seite 11.07.2027, ohne Uhrzeit, Steinenkirch am Dorfhaus;
  Zeile ganztägig, Gemeinde Böhmenkirch.
* „Dorffest“, Kaisersbach: Liste 26. und 27.06.2027, Ortsmitte; zwei Zeilen, ganztägig.

Dorffest-artige Titel im Lauf (Dorffest, Kirbe, Kerwe, Kirchweih, Feuerwehrfest,
Hocketse): 127, alle öffentlich.

## Offen

* Ältere Modulversionen (21 Kalender) haben keine Detailseite je Termin und bleiben
  ungelesen.
* 56 Registry-Einträge zeigen auf Seiten ohne Kalender; die Registry nachpflegen.
