# DE-Adapter verwaltungsportal.de (fn-29.11, Prüfstand 2026-11-02)

verwaltungsportal.de ist ein Baukasten für Gemeinde-Websites, vor allem in Thüringen
und Sachsen-Anhalt. Die DE-Registry führt 1.165 Gemeinden mit dieser Integration (eigene
Website oder Amt/VG), zusammen 752 Websites, davon 103 Amts- bzw. VG-Kalender mit
mehreren Gemeinden. Der Adapter `de-verwaltungsportal`
(`src/lib/scrapers/de/VerwaltungsportalDeScraper.ts`, Parser `verwaltungsportal.ts`)
steht in `DE_SCRAPERS`, nicht im Nachtlauf (fn-29.18).

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| alle Websites auf einem Server, 144.76.55.199 | DNS von amt-brueck.de, harzgerode.de | plattformweit nacheinander, 4 s Pause, robots.txt (`DeFeedScraper.gate`) |
| robots.txt sperrt nur benannte Bots (Disallow /, Crawl-delay 10), keine Regel für `*` | robots.txt von remptendorf.de | Crawl-delay gilt, falls er uns einmal nennt |
| Liste `/veranstaltungen/index.php` zeigt zwölf Monate in drei Layouts (`.event-box` mit `.event-time`, `.event-entry-new-2` mit Uhrzeit, `events-entry-3` ohne) | Remptendorf, Breitungen, Heiligengrabe | Links und Listen-Uhrzeit aus allen dreien |
| Detail-Link `/veranstaltungen/<ID>/<JJJJ>/<MM>/<TT>/<Name>`, eine Serie teilt die ID | Remptendorf | `source_id` = `vp-<Host>-<ID>-<Termintag>` |
| Druckansicht `?modus=drucken` (rund 8 KB statt 80 KB) mit demselben JSON-LD, Canonical und `og:image` samt Maßen | 128 Druckansichten aus 40 Websites | gelesen wird nur die Druckansicht |
| JSON-LD `Event`: Name, Beginn (Datum allein oder mit Offset), Ende, Bild, Ort mit Straße, PLZ, „Gemeinde OT Ortsteil“; keine Koordinaten | Kirmes Ruppersdorf: „Remptendorf OT Ruppersdorf“ | Gemeinde vor OT/GT; Ort nur, wenn der Termin ihn nennt (`terminContext`) |
| sichtbare Datumszeile in vier Detail-Layouts (klassisch, `single-view-1/2/4`) | Joldelund, Wandlitz, Mulfingen | Termintag des Links, JSON-LD und Zeile müssen übereinstimmen, sonst fällt der Termin weg |
| Ende „00:00“ heißt Mitternacht des Folgetags; mehrtägig mit früherer Endzeit endet am letzten Tag | Harzgerode Vereinsfest 18:00 bis 00:00; Wörnersberg | in den Golden-Tests |
| ohne eigenes Bild zeigt die Seite das Wappen der Gemeinde | Haina | `withoutPlaceholderImages`; Bild sonst in Größe „gross“ mit Breite und Höhe |
| „Bürgersprechstunde“ als Termin | Fredersdorf | Quarantäne `municipal_service` |

Serien: der erste Termin einer ID wird gelesen, weitere Tage werden nur abgeleitet, wenn
die Liste dort dieselbe Uhrzeit zeigt wie am gelesenen Termin und diese mit dessen
Detailseite übereinstimmt (`vpSameClock`); sonst wird der Tag selbst gelesen. Was eine
Nacht nicht schafft, setzt die nächste nach der zuletzt gelesenen Website fort
(`resumeAfterCursor`).

Golden-Tests: `src/__tests__/lib/scrapers/verwaltungsportal-de.test.ts` (26 Tests, 14
Fixtures aus 11 Gemeinden: Uhrzeit mit Sommer- und Winterzeit, ganztägig, mehrtägig,
Ort aus Name oder Adresse, Gemeinde-Dienst, Serie über die Zeitumstellung).

## Server-Sperre 2026-10-29

Der erste Prüfstand-Lauf rief acht Websites parallel ab (rund acht Anfragen pro Sekunde
an denselben Server). Ab 18:57 UTC nahm der Server keine Verbindungen mehr an, um 21:16
UTC antwortete robots.txt mit 403. Am 2026-11-02 um 16:35 UTC kam robots.txt wieder mit
200. Seitdem ruft der Adapter mit einem Strang und 4 s Pause ab: der Prüfstand lief 91
Minuten mit 1.265 Abrufen ohne Fehler durch den Server.

Für den Nachtlauf heißt das rund 4,3 s je Abruf und etwa 21 Abrufe je Website: in 240
Minuten etwa 160 Websites, alle 752 in fünf Nächten.

## Ergebnis

`DE_VP_WEBSITES=60 DE_VP_DELAY_MS=4000 npm run pruefstand:de -- --adapter
de-verwaltungsportal`: 60 gleichmäßig über die Registry verteilte Websites. Drei davon
haben keine Kalenderliste (amt-joachimsthal.de und vg-erkheim.de 404, buchholz-dithmarschen.de
nicht erreichbar).

Geliefert 1.515, verworfen 8 (`start_in_past`), geschrieben 1.507, öffentlich 1.418,
Quarantäne 89 (`no_position` 57, `municipal_service` 32). Kein Termin fiel wegen
widersprüchlichem Datum weg.

| Prüfung | verwaltungsportal | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 21,4 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,1 % |
| Dubletten in der Quelle | 0,0 % | 1,1 % |

`no_position` trifft nur Kalender, die mehrere Gemeinden lesen (Amt Beetzsee 36, Grub am
Forst mit Niederfüllbach 9, An der Schmücke 7, Teuschnitz 3, zwei weitere je 1), wenn der
Termin keine Gemeinde nennt („Dorfstammtisch Butzow“, „am Rathaus“). Das ist die
Etiketten-Regel, kein Fehler.

Stichprobe (30 öffentliche Zeilen aus dem Bericht) gegen die Druckansichten der
Detailseiten: Titel, Datum und Uhrzeit 30 von 30, Ort 30 von 30. 23 Seiten stammen aus dem
Prüfstand-Cache desselben Tages, die 7 abgeleiteten Serientermine (Stocksee „Fahrbücherei“,
„Feierabendbier“, „Spielenachmittag“, Obersülzen „Sitztanzgruppe“ zweimal,
„Patrizia´s Spieleabend“) wurden einzeln abgerufen und bestätigen die Ableitung. „Blutspende
in Bornhöved“ im Kalender von Stocksee landet richtig in Bornhöved, nicht in Stocksee.

Dorffeste gegen die Quellseite:

* „Kirmes in Hauteroda“ (An der Schmücke): Seite „06.11.2026 bis 08.11.2026“,
  Kulturhaus Hauteroda, 06577 An der Schmücke; Zeile ganztägig 06.11. bis 08.11.,
  Gemeinde An der Schmücke, Bild der Quelle mit Bildnachweis.
* „Kerwe mit Hammeltanz in Vilchband“ (Wittighausen): Seite „So, 08.11.2026“ ohne Uhrzeit,
  Dorfgemeinschaftshaus; Zeile 08.11. ganztägig, Gemeinde Wittighausen.

## Offen

* Sitzungen von Gemeinderat und Ausschüssen bleiben sichtbar, wie bei ionas; keine
  Wortliste (Stichprobe Nr. 30, Fredersdorf-Vogelsdorf).
* „100 Jahre TSV Theilheim“: „26.06.2027 bis 27.06.2027 von 12:00 bis 01:00 Uhr“ endet
  nach der Regel am letzten Tag um 01:00. Ob das Fest an beiden Tagen bis 01:00 geht,
  sagt die Seite nicht.
