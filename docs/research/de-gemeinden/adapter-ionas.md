# DE-Adapter ionas (fn-29.5, Prüfstand 2026-10-28)

ionas TVM (FullCalendar) liefert je Kalender `events.json` und einen iCal-Export
`event.ics`, beide nur mit `start`/`end`. Der Adapter `de-ionas`
(`src/lib/scrapers/de/IonasDeScraper.ts`, Parser `ionas.ts`) liest den iCal-Export
aller ionas-Feeds der DE-Registry für ein Jahr ab heute. Er steht in `DE_SCRAPERS`,
nicht im Nachtlauf; den schaltet erst fn-29.18 frei.

## Was der Adapter liest

* Titel, Beginn, Ende, Ort, Straße, PLZ, Ort, Veranstalter, Kategorie, `GEO` aus dem
  iCal. Wandzeit `TZID=Europe/Berlin`; `VALUE=DATE` bleibt ganztägig, das Ende ist
  exklusiv. Gegenprobe Remagen: `events.json` der Seite zeigt 31.3.2027 09:00, die Zeile
  auch.
* `source_id` = UID + Termintag (die UID trägt das Anlagedatum, nicht den Termin).
* Bild aus `ATTACH` mit der Website als Bildnachweis, ohne Logo, Wappen und Platzhalter
  (`bild.ts`, seit 2026-10-29). Quelle ist die Detailseite des Termins: der Ordner, in
  dem ionas sein Bild ablegt (12 von 12 Proben auf 6 Websites); ohne solches Bild die
  Kalenderseite der Gemeinde.
* Ein Feed, den genau eine Gemeinde führt, gibt deren Kontext (Ort, PLZ, Mittelpunkt
  als Gebietsangabe). Ein Amtskalender gibt keinen Ort: der Termin bekommt eine
  Gemeinde nur, wenn er selbst eine nennt, im Ortsnamen als ganzes Wort oder im Titel
  nach einer Präposition („Weihnachtsmarkt in Schwarzbach“). Kandidaten sind alle
  Gemeinden des Amts laut Destatis, nicht nur die der Registry. Zwei genannte Gemeinden
  („Konfirmation in Stelzenberg in der Kirche in Trippstadt“) ergeben keine.
* Derselbe Termin zweimal in einem Feed (andere UID, gleicher Titel, Beginn, Ende, Ort;
  Bad Honnef) bleibt einmal.

## Befunde und Korrekturen

| Befund | Korrektur |
|---|---|
| Dubletten 4,4 %: Kennzahl zählte zwei Vorstellungen am selben Tag | Kennzahl zählt mit Uhrzeit die Minute, AT neu gemessen (1,1 %) |
| Bad Honnef listet Termine doppelt | im Feed zusammengefasst |
| 1.755 DE-PLZ ohne Gemeinde: Ortsteile („Mahlow“ unter 15831) fehlten | Stammdaten ordnen GeoNames-Orte per Punkt in der VG250-Gemeindefläche zu (nur im Kreis des Eintrags, nur Ortspunkte); `orteGemeinde` je PLZ; Resolver löst den Ortsteil vor der Hauptgemeinde auf |
| Amtskalender-Termine ohne Gemeinde öffentlich ohne Position | Freigabevertrag: DE ohne Position → Quarantäne `no_position` (online ausgenommen), Entscheidung 2026-10-28 |
| 208 Demo-Termine der Vorlage in Dreis-Brück („Prost, Musterstadt!“, Musterstraße 1, 12345 Musterort) | Freigabevertrag: Muster-Orte sind `placeholder_location`, auch mit PLZ (Prod: 0 Treffer) |
| `\"Talk am Turm\"`: Quelle maskiert Anführungszeichen | iCal-TEXT in einem Durchgang entmaskiert |

Nebenwirkung der DE-Regel: über 1.000 künftige Eventim-DE-Zeilen ohne Koordinaten
werden beim nächsten Import zurückgehalten. Auf lasstreffen.at sind sie ohnehin nicht
sichtbar (nur Österreich); für eine spätere .de-Seite gilt so dieselbe Regel.

## Ergebnis (offline aus dem Cache, 376 Feeds)

Geliefert 13.520, verworfen 57 (`start_in_past`), geschrieben 13.382, öffentlich
12.655, Quarantäne 727 (`municipal_service` 278, `placeholder_location` 216,
`no_location_evidence` 166, `no_position` 71).

| Prüfung | ionas | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 6,4 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,07 % (10 Online-Termine) | 0,10 % |
| Dubletten in der Quelle | 0,0 % | 1,1 % |

Stichprobe (30 öffentliche Zeilen, Seed 29) gegen den iCal-Export der Quelle: 30 von 30
Titel, Datum, Uhrzeit und Ort korrekt. Die erste Stichprobe fand die Demo-Termine
(2 von 30), die zweite das maskierte Anführungszeichen (1 von 30); beide behoben.

## Offen

* Öffentliche Sitzungen (Gemeinderat, Ausschüsse) bleiben wie in Österreich sichtbar;
  der Qualitätsvertrag nennt Sitzungen als Gemeinde-Dienst. Entscheidung offen, sie gilt
  für AT und DE gemeinsam.
* Titel ohne Präposition („Weihnachtsmarkt Bann“) bekommen im Amtskalender keine
  Gemeinde und bleiben in Quarantäne.
