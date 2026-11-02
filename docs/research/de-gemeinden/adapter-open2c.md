# DE-Adapter Open2C (fn-29.15, Prüfstand 2026-10-30)

Open2C ist ein CMS bayerischer Gemeinden. Der Adapter `de-open2c`
(`src/lib/scrapers/de/Open2cDeScraper.ts`, Parser `open2c.ts`) liest den
Veranstaltungskalender des CMS für die Registry-Einträge mit Merkmal `open2c`
(57 Gemeinden, 57 Registry-Seiten) mit allen Folgeseiten. Er steht in `DE_SCRAPERS`,
nicht im Nachtlauf (fn-29.18). Abrufe über `BaseScraper.fetchHtml`, robots.txt je
Website, mindestens 1 s Pause. Teil von fn-29.15.

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Termin als Block `.event_teaser_block` mit Zeilen „Termin:“, „Kategorie:“, „Ort:“, „Beschreibung:“ | alle 41 Kalender | Zeilen nach ihrer Beschriftung gelesen |
| Terminzeile mit hCalendar und Offset | `time.dtstart datetime="2026-11-10T19:30:00+01:00"`, Sommerzeit `+02:00` (Scheyern „Spiel-Nachmittag“ 27.09. bis 22.11.) | Zeit aus `datetime`, kein eigenes Umrechnen |
| Ganztägig: Text ohne Uhrzeit, `datetime` mit `T00:00` | Pliening „Halloween-Party“ „31.10.2026“ | ganztägig |
| Ende ohne Uhrzeit | Mittelstetten „01.12.2026 17:00 Uhr – 26.12.2026“ | Ende als Tag |
| „Ort:“ oft mit Adresse | Scheyern „Bürgerhaus Rathausplatz 2 85298 Scheyern“ | PLZ und Ort an den Resolver, wie bei cEasy |
| Detailansicht `<Kalender>.o<ID>.html?…&detailevent=<ID>` | Aindling `?detailevent=10291` | `source_url` ohne Seitenzahl, `source_id` aus der Termin-ID |
| Folgeseiten `.pag__item` (`?page=N`) | Wolnzach, Pliening | gelesen bis 40 Seiten |
| iCal-Export `export_ical.php` | bei Pörnbach per robots.txt gesperrt | nicht genutzt |
| Vorschaubilder heißen `l_<ID>.<32 Hex>.png` | Penzing, Irschenberg | übernommen über `bild.ts`; in den Fixtures entfernt (Secret-Scanner) |
| Gemeinde-Dienst | Jesenwang „Problemmüllsamlung“ (so in der Quelle) | Vokabular um `Problemmüll` ergänzt (`municipal-service.ts`) |

Ohne Kalendermodul blieben 16 Registry-Seiten: RCE-Kalender (Sulzemoos, Lizenzquelle),
Nachrichtenartikel (Oberschleißheim), Hallenseiten (Moosburg), Meldeformulare
(Tacherting) und Unterseiten ohne Termine.

## Ergebnis

Erster Lauf online (145 Abrufe): 57 Registry-Seiten, 41 Kalender. Geliefert 946,
verworfen 2 (`start_in_past`), geschrieben 944, öffentlich 931, Quarantäne 13
(`municipal_service` 10, `no_position` 3).

| Prüfung | Open2C | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 26,1 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,1 % |
| Dubletten in der Quelle | 0,0 % | 1,1 % |

Stichprobe (30 öffentliche Zeilen) gegen die Detailansichten: 30 von 30 Titel, Datum und
Uhrzeit wie in der Terminzeile der Quelle, Ort 30 von 30 in der Gemeinde des Kalenders
oder an der genannten Adresse. Der „Scheyrer Christkindlmarkt“ steht in der Terminzeile
ganztägig („28.11.2026 – 29.11.2026“); die Uhrzeiten je Tag nennt nur die Beschreibung,
sie bleiben dort.

## Dorffest-Probe gegen die Quellseite

| Termin | Adapter | Quellseite |
|---|---|---|
| Weihnachtsmarkt Maroldsweisach | 05.12.2026 ganztägig | Termin 05.12.2026 |
| Christkindlmarkt Gangkofen | 05.12.2026 bis 06.12.2026 ganztägig, Kommendehof, 84140 Gangkofen | Termin 05.12.2026 – 06.12.2026, Ort Kommendehof an der kath. Pfarrkirche |

## Offen

* 16 Registry-Seiten ohne Kalendermodul; eine nächste Erhebung kann sie anderen
  Integrationen zuordnen (Sulzemoos: RCE, Lizenz).
