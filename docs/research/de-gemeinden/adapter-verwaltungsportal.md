# DE-Adapter verwaltungsportal.de (fn-29.11, Stand 2026-10-29: Prüfstand offen)

verwaltungsportal.de ist ein Baukasten für Gemeinde-Websites, vor allem in Thüringen
und Sachsen-Anhalt. Die DE-Registry führt 1.165 Gemeinden mit dieser Integration (eigene
Website oder Amt/VG), zusammen 752 Websites, davon 103 Amts- bzw. VG-Kalender mit
mehreren Gemeinden. Der Adapter `de-verwaltungsportal`
(`src/lib/scrapers/de/VerwaltungsportalDeScraper.ts`, Parser `verwaltungsportal.ts`)
steht in `DE_SCRAPERS`, nicht im Nachtlauf (fn-29.18).

**Der Prüfstand ist noch nicht gelaufen.** Der Server der Plattform sperrt unsere IP seit
2026-10-29 18:57 UTC (siehe unten). Bis der Prüfstand bestanden ist, kommt der Adapter
nicht in den Nachtlauf.

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| alle Websites auf einem Server, 144.76.55.199 | DNS von amt-brueck.de, harzgerode.de | plattformweit nacheinander, 2 s Pause, robots.txt (`DeFeedScraper.gate`) |
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
Detailseite übereinstimmt (`vpSameClock`); sonst wird der Tag selbst gelesen. In einer
Stichprobe von 30 Websites standen 1.345 Termin-Links unter 576 IDs. Was eine Nacht nicht
schafft, setzt die nächste nach der zuletzt gelesenen Website fort (`resumeAfterCursor`).

Golden-Tests: `src/__tests__/lib/scrapers/verwaltungsportal-de.test.ts` (26 Tests, 14
Fixtures aus 11 Gemeinden: Uhrzeit mit Sommer- und Winterzeit, ganztägig, mehrtägig,
Ort aus Name oder Adresse, Gemeinde-Dienst, Serie über die Zeitumstellung).

## Server-Sperre

Der erste Prüfstand-Lauf rief acht Websites parallel ab (je eine Anfrage pro Sekunde,
also rund acht pro Sekunde an denselben Server). Ab 18:57 UTC nahm der Server keine
Verbindungen mehr an; der Lauf wurde abgebrochen und der Adapter auf einen Abrufstrang
umgebaut. Prüfungen mit je einer Anfrage alle zehn Minuten blieben bis 21:15 UTC ohne
Antwort 200; um 21:16 UTC antwortete robots.txt von remptendorf.de mit 403.

## Ergebnis

Noch keins. Geplant: `DE_VP_WEBSITES=80 npm run pruefstand:de -- --adapter
de-verwaltungsportal` (80 gleichmäßig verteilte Websites, nacheinander), Stichprobe von 30
Terminen gegen die Detailseiten und das Dorffest „Kirmes in Ruppersdorf“ (Remptendorf,
29.10. bis 01.11.2026) gegen die Quellseite.

## Offen

* Prüfstand, sobald der Server wieder antwortet.
* Hält die Sperre an, fragt man besser beim Betreiber nach (Kontakt entscheidet der Nutzer).
* Sitzungen von Gemeinderat und Ausschüssen bleiben sichtbar, wie bei ionas; keine Wortliste.
