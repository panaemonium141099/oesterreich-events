# DE-Adapter TYPO3- und Contao-Kalender (fn-29.14, Prüfstand 2026-10-30)

Der Adapter `de-typo3` (`src/lib/scrapers/de/Typo3DeScraper.ts`, Parser `contao.ts` und
`typo3.ts`) liest die Kalenderseiten aller Registry-Einträge mit den Merkmalen
`contao_events` (117), `txnews` (153, davon 23 ohne Kalenderseite), `calendarize` (52),
`events2` (17) und `sfeventmgt` (8), dazu 5 Ausweichwege über Amt bzw. VG: zusammen
271 Kalenderseiten. Er steht in `DE_SCRAPERS`, nicht im Nachtlauf (fn-29.18). Abrufe
über `BaseScraper.fetchHtml`, robots.txt je Website, mindestens 1 s Pause, Crawl-delay
der Website, seriell.

Welche Vorlage eine Seite trägt, entscheidet ihr HTML, nicht das Registry-Merkmal: die
Merkmale stammen aus Quelltext-Treffern der Startseite und sagen über den Kalender oft
nichts (Gifhorn `txnews` bettet destination.one ein, Hartenholm `sfeventmgt` nutzt das
alte Hirsch-&-Wölfl-Modul).

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Kein Feed ohne Konfiguration | calendarize-ICS der Jümme leer (`BEGIN:VCALENDAR` ohne VEVENT), tx_news-iCal `?type=9819` in Ohmbach HTTP 500 (2026-10-30) | nur HTML bzw. JSON-LD |
| Contao: maschinenlesbar sind `<time datetime>`, der Linktitel „Name (Freitag, 06.11.2026, 16:00–17:30)“ und in der Monatsansicht `?day=…&times=<Beginn>,<Ende>` | Klinkrade, Asendorf, Uetersen, Baesweiler (nur Linktitel „(Donnerstag, 2026-10-01)“) | Beginn aus `times=` bzw. `datetime` (Wandzeit, Versatz zählt nicht), Ende aus dem Datumstext; `times=` 00:00 bis 23:59 ist ganztägig, gleiches Ende heißt ohne Ende |
| Contao-Vorlagen je Website angepasst, Blöcke nicht immer `.event` | Georgenthal `.item` mit Datum und Name in Nachbarspalten, Wutha-Farnroda und Satow `.card`, Nienhagen `.event-row` | Block = größter Vorfahr eines Ankers (Status-Klasse, Schema.org-Event, `datetime`, `times=`), der genau einen Namen, eine Detailseite und einen Tag trägt |
| `<base href>` | Klinkrade `leben-in-klinkrade/termin/…` relativ zur Basis | Links zur Basis aufgelöst |
| Mehrtägige Termine je Tag gelistet (`event_upcoming`), `datetime` bleibt der erste Tag | Markt Velden „Gründungsfest der FF Eberspoint“: Liste 17., 18., 19., 20.06.2027, Detailseite „17.06.2027–20.06.2027“ | ein Termin bis zum letzten gezeigten Tag |
| Datum nicht als Name, Ort nicht im Namen | Pommern `<small class="time">` in der Überschrift; Wurmsham, Neufraunhofen, Markt Velden „Name\| Ort: Gasthaus …“; Sulzbach `div.title` mit Beschreibung | Datumsteile aus dem Namen entfernt, „\| Ort:“ abgetrennt, Schema.org-Name vor Überschrift vor Namensklasse |
| Beschriftungen und Rahmen sind kein Name | Rerik `<h5 class="category">` neben `itemprop="name"` (150 Zeilen „Details“ im ersten Lauf), Erding Bildlink mit Screenreader-Text | mit Schema.org-Namen zählen nur diese; Screenreader-Text nie |
| Ortszeilen mit Beschriftung und Zeilenumbrüchen | Nienhagen „Ort: … \| Adresse: Dorfstraße 41, 29336 Nienhagen“, Rerik „Erlebnisgolf Rerik<br>Parkweg 7<br>18230 Rerik“, Eichenbühl „Ort: Sportheim VfB Eichenbühl: In den Rittern 3, 63928 Eichenbühl“ | Beschriftung entfällt, Umbruch trennt, der Abschnitt mit Hausnummer vor der PLZ ist die Straße; folgt der PLZ eine Straße, bleibt der Ort leer |
| Download statt Detailseite, fremder Link im Text | Lichtenau `?file=…pdf`, Georgenthal Facebook-Link | Dateien nie, sonst nur Links derselben Website |
| Teaser ohne Link neben dem Listeneintrag | Bleicherode „Kirmes Pustleben“ | ein Termin (gleicher Name und Beginn) |
| calendarize: Terminzeile in der Grammatik der AT-Kalenderkarten | Oberzissen „13.11.2026 17:30 - Open End“, Dülmen „01.10.2026 - 10.11.2026 Ganztags“ und „02.10.2026 00:00 - 30.10.2026 00:00“, Gönnheim „30.10.2026 // 19:00 Uhr“, Helmstedt „All day“ | `parseCalendarizeTerm` aus `calendarize-card.ts` (AT-Vorlage über `readCalendarizeCard`), 00:00 ohne bzw. bis 00:00 ganztägig wie in `jsonld.ts` |
| Detail-Links je Extension | calendarize `tx_calendarize_calendar[index]` bzw. `/termin/<slug>`, events2 `tx_events2_show[event]` + `[timestamp]` bzw. `/2026-11-02_1500/<slug>`, sf_event_mgt `tx_sfeventmgt_pieventdetail[event]` | Karte je Detail-Link, `source_id` aus Extension, Website und Datensatz (events2 mit Tag) |
| events2 zeigt in der Liste nur den Tag | Wedel „Beginn: 16:00 Uhr“ ohne Datum, Donnersdorf nur „Sa. 07. Nov. 2026“ | Beginn, Ende und Ort aus dem JSON-LD der Detailseite (Wandzeit ohne Versatz), höchstens 150 Detailseiten je Kalender (Pforzheim 225) |
| Datum und Uhrzeit in getrennten Feldern | Burgsponheim `.day`/`.month`/`.year` + „18:00 Uhr“, Grevenbroich „Datum \| Fr 30.10.2026“ und „Uhrzeit \| 19:00 Uhr - 21:00 Uhr“ | Uhrzeitfeld zur Datumszeile |
| tx_news-Listen sind Nachrichten | Kusel „Termine“ mit `datePublished`, Gifhorn Nachrichtenkarussell | nicht als Termine gelesen (das Datum ist das der Meldung) |
| Schema.org-Events auf der Seite | Britz-Chorin-Oderberg (48, Sprungmarken `#event-16543`), Nördlingen | über `jsonld.ts`, Kennung mit Sprungmarke |
| Platzhalterbilder | Klinkrade `files/web/Platzhalter/termine.png` an allen Terminen | `bild.ts` (ab drei Terminen), robots.txt für Bilder wie bei Hirsch & Wölfl |

## Kalenderseiten

| Ergebnis | Seiten |
|---|---|
| Contao | 74 |
| TYPO3-Extension (calendarize, events2, sf_event_mgt) | 30 |
| Schema.org-Events | 5 |
| ohne lesbaren Kalender | 156 |
| nicht lesbar (HTTP-Fehler, robots.txt) | 6 |

Ohne lesbaren Kalender sind vor allem die `txnews`-Seiten: Nachrichtenlisten, eingebettete
Fremdkalender (destination.one, Deskline, RCE, iframes), statische Seiten und Startseiten.
Dazu Contao-Listen ohne kommende Termine („Aktuell sind keine Termine vorhanden“) und
calendarize-Seiten, deren Kalender per JavaScript nachlädt.

## Ergebnis

Termine aus 88 Websites. Geliefert 2.947, verworfen 507 (`start_in_past` 475: Listen
zeigen laufende und vergangene Termine; `garbage_title` 32), geschrieben 2.440, öffentlich
2.285, Quarantäne 155 (`municipal_service` 64, `start_too_far_ahead` 62, alle Prem am
Lech mit Serien bis 2029, `no_location_evidence` 15 und `no_position` 14 aus Amt Niepars,
Bleicherode und Zarrentin). Ein zweiter Lauf offline aus dem Cache mit dem endgültigen
Parser: 2.440 Zeilen, keine weg, keine neu (47 geändert durch die Uhrzeitfelder in
Grevenbroich).

| Prüfung | TYPO3/Contao | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 20,0 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,07 % |
| Dubletten in der Quelle | 0,0 % | 1,1 % |

Gemeinde-Dienste aus echten Proben in Quarantäne: „Bioabfall“, „Restabfall 4-wöchentlich“,
„Papiertonne“, „Leerung Restmülltonnen“, „Abgabe Elektroschrott Kläranlage“ (Himmelkron),
„Bürgermeistersprechstunde Eberspoint“ (Markt Velden), „Sprechstunde des Seniorenbeirates“
(Uetersen). Sitzungen bleiben sichtbar wie in Österreich (38 öffentliche Zeilen).

Stichprobe (30 öffentliche Zeilen des Prüfstands) gegen die Kalenderliste bzw. die
Detailseite im Cache: 30 von 30 Titel, Datum und Uhrzeit korrekt, Orte richtig. Darunter
Ganztägiges ohne Uhrzeit (Sulzbach „Saisoneröffnung“, Georgenthal „Dämmerschoppen“),
Termine anderer Gemeinden im Kalender mit eigener Adresse (Bad Liebenstein „Das
Märchenbrösel“ in der Werratalkaserne Bad Salzungen, Winsen (Aller) „Weihnachtsmarkt in
Celle“), Ortsteile (Altenbergen in Georgenthal, Jakobsdorf im Amt Niepars), Rerik ohne
Gemeindenamen in der Auflösung (Ort „Ostseebad Rerik“, PLZ 18230 deckt mehrere
Gemeinden; Gemeinde-Mittelpunkt, kein Pin). Der erste Lauf der Stichprobe fand drei
Grevenbroicher Zeilen ohne Uhrzeit, die Uhrzeit stand in einer eigenen Tabellenzeile;
behoben und Golden-Test.

Dorffeste gegen die Quellseite:

* „Gründungsfest der FF Eberspoint“, Markt Velden: Detailseite
  https://www.markt-velden.de/2234/10332.html „17.06.2027–20.06.2027“; Liste je Tag
  gelistet, Zeile ganztägig 17. bis 20.06.2027, Gemeinde Velden (Golden-Test).
* „Babinger Waldfest“, Markt Velden: Detailseite „17.07.2027 15:00“, Ort Eberlsöder
  Waldung; Zeile 15:00 Ortszeit, Ort Eberlsöder Waldung.
* „Kirmes Pustleben“, Bleicherode: Liste 31.10. bis 01.11.2026, Kulturscheune Wipperdorf;
  Zeile ganztägig (die Uhrzeit steht nur im Beschreibungstext).

Fest-artige Titel im Lauf (Dorffest, Kirmes, Kirchweih, Kirta, Gründungs-, Wald-,
Brunnen-, Volks-, Schützenfest, Weihnachts- und Adventsmarkt, Martinsumzug): 150, davon
149 öffentlich.

## Offen

* tx_news als Terminliste (eventnews, Kalender-Popover in Hottenbach) wird nicht gelesen;
  ein Nachrichtendatum ist kein Termin.
* Contao-Vorlagen ohne Jahr in der Liste (Markt Kaltental, Tarmstedt `event_date_box`)
  und Kalender, die nur einen Tag zeigen (Bienenbüttel), bleiben teils ungelesen.
* Die Registry-Merkmale `txnews` und `calendarize` treffen den Kalender oft nicht; die
  Registry nachpflegen.
