# DE-Adapter NOLIS (fn-29.6, Prüfstand 2026-10-29)

NOLIS-Manager V3.5 (NOLIS GmbH, Nienburg) bietet je Kommune den iCal-Export
„vCalendar exportieren“ `/veranstaltungen/veranstaltungen.ical?…&selected_kommune=<ID>`.
Der Adapter `de-nolis` (`src/lib/scrapers/de/NolisDeScraper.ts`, Parser `nolis.ts`)
liest alle 192 NOLIS-Feeds der DE-Registry (331 Gemeinden mit eigenem Feed, 42 über
Amt oder Samtgemeinde). Er steht in `DE_SCRAPERS`, nicht im Nachtlauf; den schaltet
erst fn-29.18 frei.

Gemeinsam mit ionas genutzt und dafür herausgelöst: der iCal-Kern
(`de/ical.ts`), der Kalender-Kontext (`de/kontext.ts`: Amtskalender, Dubletten im
Feed) und der Abruf (`de/feed-scraper.ts`). ionas lieferte danach dieselben 13.382
Zeilen wie vorher.

## Was der Export liefert (gemessen)

| Befund | Beleg | Umsetzung |
|---|---|---|
| Zeitfenster nur über `auswahl_woche_tage` ab heute; `beginn`, `ende`, `beginn_datum`, auch `zeitauswahl=4`, werden ignoriert | Melle: jedes Fenster lieferte dieselben Termine ab heute | 366 Tage ab heute (Barsbüttel 91 statt 47 Termine bei 28 Tagen) |
| höchstens 1.000 Termine je Abruf, nach Beginn sortiert gekappt | Melle, Märkische Schweiz, Sachsenhagen, Visselhövede: alle Termine vor dem letzten Tag vollständig, 0 fehlend in 36 Vergleichen mit kürzeren Abrufen | gekappte Antwort ohne den letzten, angeschnittenen Tag; spätere Termine kommen in den folgenden Nächten (2026-10-29: 4 Feeds gekappt, Melle bis 17.11.) |
| Zeiten in UTC (`Z`) | Barsbüttel: iCal 14:00Z, Seite „15:00 Uhr“ | Instant; Kalendertag in deutscher Ortszeit |
| lokale Mitternacht (23:00Z Winter, 22:00Z Sommer) heißt „ohne Uhrzeit“ | Märkische Schweiz: Seite nur „Mi., 28.10.2026“ | ganztägig |
| `DTEND` um lokale Mitternacht ist der letzte Tag einschließlich | Rheder Weihnachtsmarkt: DTEND 05.12. 23:00Z, Seite „Do., 03.12. bis So., 06.12.“ | Ende = dieser Tag |
| `DTEND` 23:59:59 ist das Tagesende | Marburg: 566 von 577 Terminen | Ende unbekannt |
| `GEO` als Länge;Breite, oft `0;0` | Barsbüttel „GEO:10.2087;53.5617“ | Reihenfolge über die deutschen Wertebereiche, `0;0` ist kein Punkt |
| Ort als `LOCATION` „Name, Straße,\nPLZ Ort“, dazu `X-ORT` (auch Ortsteil) | Barsbüttel, Stellau „22885 22885 Barsbüttel“ | zerlegt, doppelte PLZ entfernt; `X-ORT` als Ort, wenn die Adresse keinen nennt |
| `X-ID` = Kommune_Termin, je Termin eindeutig | 91 von 91 in Barsbüttel | `source_id` = `nolis-<TerminID>` |
| Termine werden zwischen Portalen geteilt, auch unter anderer ID | 26.995 gelesen, 21.800 eindeutig; „Basketball Training“ bei Delligsen und SG Leinebergland | einmal geschrieben, aus dem Feed der eigenen Kommune; gleicher Titel, Beginn, Ende und Ort unter zwei IDs ebenfalls einmal |
| Detailseite `/regional/veranstaltungen/<slug>-<Termin>-<Kommune>.html`, Slug frei | 30 Stichproben | `source_url`; Marburg zeigt Termine in einer eigenen Oberfläche, dort der Terminlink aus `URL` |
| `STATUS:CANCELLED` | | nicht geschrieben |

Den Gemeinde-Kontext bekommt ein Termin nur aus dem Feed seiner eigenen Kommune und
nur, wenn genau eine Gemeinde diesen Feed führt. Sonst zählt der Ort des Termins, und
im Amtskalender die Gemeinde, die der Termin selbst nennt (wie bei ionas).
`robots.txt` sperrte keinen Feed; `Crawl-delay` wird jetzt für jeden DE-Adapter
eingehalten (mindestens 1 s zwischen Abrufen).

## Ergebnis (2026-10-29, frischer Abruf aller 192 Feeds)

Geliefert 21.800, verworfen 52 (`start_in_past` 49, `garbage_title` 3), geschrieben
21.748, öffentlich 21.128, Quarantäne 620 (`municipal_service` 445, `no_position` 203,
`placeholder_location` 3).

| Prüfung | NOLIS | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 4,7 % | 61,1 % |
| sichtbar ohne Koordinaten (ohne Online-Termine) | 0,0 % | 0,07 % |
| Dubletten in der Quelle | 0,2 % | 1,1 % |

Stichprobe (30 öffentliche Zeilen, Seed 29) gegen die Detailseite der Quelle: 30 von
30 Titel, Datum und Uhrzeit korrekt, auch ganztägige („Kleiderkammer (Mo., 09.08.2027)“).
Orte: alle aus der Adresse der Quelle oder `X-ORT`, Gemeinde und Koordinate passen
(Großbardau in Grimma, Druchhorn in Ankum, Neuenkirchen im Kreis Steinfurt, Termine des
Melle-Portals in Bad Iburg und Osnabrück).

Dorffest gegen die Quellseite: „Dorffest 750 Jahre Hülptingsen“, Seite „Sa., 05.06.2027
bis So., 06.06.2027“, Veranstaltungsort Hülptingsen; Zeile ganztägig 05. bis 06.06.2027,
Gemeinde Burgdorf (Hülptingsen ist Ortsteil).

Die Kennzahl „sichtbar ohne Koordinaten“ zählt Online-Termine nicht mehr (sie bleiben
nach dem Freigabevertrag ohne Position sichtbar); die AT-Referenz ist neu gemessen
(0,07 %, vorher mit Online-Terminen 0,10 %).

## Offen

* Öffentliche Sitzungen (Ortsrat, Ausschüsse, Gemeinderat) bleiben wie in Österreich
  sichtbar; 4 der 30 Stichproben. Entscheidung offen, gilt für AT und DE gemeinsam.
* Gekappte Feeds (Melle bis 17.11.) reichen nur so weit, wie 1.000 Termine tragen.
