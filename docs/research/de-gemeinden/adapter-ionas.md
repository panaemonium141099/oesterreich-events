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

## Nachtrag 2026-11-05: Feeds von GitHub aus bestätigt

Workflow `registry-de-feeds.yml`, Läufe 42076962523 und 42079807137, 224 offene Seiten. Der
ekom21-Server 80.69.201.211, von lokal seit dem 03.11. ohne Verbindung, antwortet aus GitHub
Actions. Der Nachtlauf liest von dort, die Feeds sind also für ihn lesbar.

* **Neu mit Feed: 142 Gemeinden, dazu 2 über ihre VG** (139 neue Kalender, 135 der Gemeinden
  in Hessen). 18 der 139 Kalender sind leer, zusammen 12.650 Termine im Jahresfenster.
* **Prüfstand aller ionas-Kalender:** automatische Schwellen bestanden (26.117 geliefert,
  24.826 öffentlich, Müll-Titel 0,0 %, ohne Uhrzeit 6,8 %, Dubletten 0,0 %).
* **Stichprobe 30 Termine aus den neuen Kalendern** (fester Zufall, aus GitHub, da die Seiten
  lokal nicht antworten): Titel 30 von 30 wie im iCal, auf 13 Detailseiten zusätzlich wörtlich
  bestätigt (HTTP 200). Datum und Uhrzeit bei 20 Terminen gleich dem iCal-Eintrag; 10 sind
  Serien, deren Eintrag im Protokoll ein anderer Tag derselben UID war, der einzelne Tag ist
  dort nicht nachgeprüft. Ein Treffer falsch: Demo-Termine der Vorlage in Willingshausen
  („Veranstaltung ohne Bild mit Kategorie“, „test-ort“). Eine Suche über alle neuen Kalender
  fand genau diese drei; der Freigabevertrag hält `test-ort` jetzt wie `Musterort` zurück.
* **Quelle unverändert übernommen:** Bad Vilbel führt die Straße im Ortsfeld, Münchhausen die
  PLZ „3117“. In beiden Fällen stimmt die Gemeinde. „Veranstaltungen November 2026“ (Breuberg)
  ist ein Sammeleintrag der Quelle. Reinheim nennt „Musterstrasse 1, 12345 Reinheim“ bei einem
  echten Konzert: bleibt zurückgehalten.

**Noch ohne Feed: 314 Gemeinden, dazu 150 über ihre VG** (260 in Rheinland-Pfalz). 301 davon:
Seite und verlinkte Kalenderseiten nennen keinen `events.json`, das CMS ist ionas, der Kalender
aber nicht das Modul TVM. Geprüft sind die 14 größten Websites, je ein Abruf: bitburgerland.de
(52 Gemeinden) und otterbach-otterberg.de betten einen Kalender anderer Herkunft per iframe ein
(eifel-direkt.de, ehrenamt.vgo-o.de), hunsrueckmittelrhein.de verlinkt eine Skript-Ansicht,
vg-wittlich-land.de ist ionas3 ohne Kalender-Export; bei den übrigen fand die Stichprobe keinen
Export-Hinweis, ihr Kalender ist nicht einzeln untersucht. 7 HTTP 404, 2 ohne Verbindung,
4 ohne Seite. Der Adapter liest sie nicht; der Bericht führt sie als „kein Kalender des Adapters“.
