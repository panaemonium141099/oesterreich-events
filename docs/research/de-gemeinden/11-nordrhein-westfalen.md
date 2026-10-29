# Nordrhein-Westfalen: Gemeindekalender und Dorffeste (Stand 2026-10-29)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.12`. Methode und Format: Epic-Spec
`fn-28-de-gemeindekalender-dorffeste-in-jeder`. Bundesweite Anbieter stehen in
[00-bundesweit.md](00-bundesweit.md), die Zuordnung aller 396 NRW-Gemeinden in
[01-vollerhebung.md](01-vollerhebung.md) und
[data/vollerhebung-2026-10.csv](data/vollerhebung-2026-10.csv). Hier wird beides für NRW
nachgeprüft und vertieft, nicht gedoppelt.

Arbeitsweise: nur lesende GET-Anfragen und Websuche, keine Konten, keine Formulare, keine Mails.
Jede Zahl stammt aus einer eigenen Antwort vom 29.10.2026 oder aus einer verlinkten Seite.
„Selbst gezählt“ heißt aus einer abgerufenen Antwort gezählt, „Eigenangabe“ heißt Aussage des
Betreibers. Unbelegtes steht als „nicht belegt“ da. Alle Anfragen mit Status, darunter sechs
Abrufe gesperrter Pfade vor dem Auswerten der robots.txt:
[11-nordrhein-westfalen-anfragen.md](11-nordrhein-westfalen-anfragen.md).

## Kurzfazit

1. **NRW hat kaum kleine Gemeinden.** Von 396 Gemeinden haben 52 weniger als 10.000 Einwohner
   (2,3 % der Einwohner), der Median liegt bei 21.006 Einwohnern (Destatis, 31.12.2025). Die
   Pflichtstichprobe (30 der 52) zeigt daher nur den Rand. Eine Ergänzung aus 10 Gemeinden mit
   10.000 bis unter 50.000 Einwohnern (aus 267, zwei Drittel aller NRW-Gemeinden) prüft, ob die
   mittleren Gemeinden ihre Ortsteilfeste im Stadtkalender führen.
2. **Feste laufen auf Ortsteilebene und stehen meist im Gemeindekalender.** 19 der 30 kleinen
   Gemeinden haben in ihrer eigenen Hauptquelle mindestens ein datiertes Fest (Martinszüge,
   Weihnachtsmärkte, Kirmes, Schützentermine), fast immer mit Ortsteilnamen im Titel oder Ortsfeld.
   Bei den mittleren Gemeinden sind es 7 von 10; Jüchen führt 26 von 38 kommenden Terminen als
   Vereins- und Ortsteilfeste, darunter 6 Schützenfeste 2027. Willich, Emsdetten und Hückelhoven
   führen fast nur Kultur und Stadtmarketing.
3. **Drei Generics mit offenem Feed tragen den kleinen Rand: ionas, NOLIS und Heimat-Info.** In
   der Stichprobe liefern 15 von 30 Gemeinden ihre Termine maschinenlesbar (ionas 2, NOLIS 4,
   Heimat-Info 6, Cross7 1, Modern Events Calendar 1, Inline-JSON 1; Nettersheim zählt bei
   Heimat-Info, obwohl sein eigener HTML-Kalender die Hauptquelle ist). Heimat-Info ist in NRW ein
   Rheinland-Cluster: 22 Kommunen, davon 14 der 15 Gemeinden im Kreis Düren, keine in Westfalen.
   NOLIS sitzt im Münsterland (Kreise Borken, Steinfurt). Heimat-Info braucht die laufende
   WITTICH-Anfrage ([00-bundesweit.md](00-bundesweit.md) A1, B1).
4. **Danach kommt Hersteller-HTML: Weblication (31 NRW-Gemeinden laut Vollerhebung), active-City,
   iKISS.** Weblication liefert iCal nur je Termin und nicht überall (Altenbeken 200, Schlangen
   und Everswinkel 404); Tecklenburgs Kalender ist leer.
5. **Oberhalb der Gemeinde sind die evangelischen Kalender die beste Festquelle.** termine.ekir.de
   (Rheinland) hat 126 kommende Termine im Typ „Feste“, 112 mit NRW-PLZ; neu gefunden ist
   www.veranstaltungen-ekvw.de (Westfalen, gleiche Software) mit 554 im Typ „Feste“. Lizenz nicht
   belegt, die Exporte enthalten Namen und E-Mail-Adressen.
6. **Offene Daten helfen fast nicht.** Open.NRW führt 15 Kommunen mit Veranstaltungs- oder
   Festdatensatz, aktuelle Festdaten nur für Grevenbroich (Volks- und Heimatfeste 2026 und schon
   2027, Martinszüge 2026, alle CC0). Die robots.txt von opendata.rhein-kreis-neuss.de und
   ckan.open.nrw sperrt `/api/` für alle außer Googlebot; das betrifft auch den Neusser
   Veranstaltungskalender. Kölns Open-Data-Kalender hat kein Veedels-, Schützen- oder Kirmesfest.
   Schützenverbände (BHDS, WSB, SSB, RSB) führen keine öffentlichen Festkalender.
7. **destination.one deckt kleine NRW-Gemeinden besser ab als anderswo, aber selten mit
   Dorffesten.** 18 von 30 Stichprobengemeinden haben dort mindestens einen Termin (Hessen: 9
   von 30). NRW-weit stehen im Jahresfenster 207 Weihnachtsmärkte, aber nur 7 Schützenfeste, 5
   Kirmessen und 0 Feuerwehr- oder Dorffeste im Titel. Ausnahme Eifel: Heimbach hat dort sechs
   Martinszüge in sechs Ortsteilen.
8. **Ein Viertel der Stichprobe ist für uns nicht lesbar.** Fünf Websites (Titz, Vettweiß, Inden,
   Heimbach, Dahlem) sperren ClaudeBot per robots.txt mit derselben Bot-Liste, zwei sperren alle
   Bots (Schieder-Schwalenberg, Beelen). Saerbeck lieferte leere Antworten. Die vier
   Heimat-Info-Gemeinden darunter sind über die API trotzdem erreichbar.

## Stichprobe

**Ziehung (reproduzierbar):** Gemeindeverzeichnis-Auszug Destatis, Stichtag 30.09.2026
(`AuszugGV3QAktuell.xlsx`, Blatt `Onlineprodukt_Gemeinden30092026`). Zeilen mit Satzart `60`,
Land `05`, ohne Textkennzeichen `66` (NRW hat keine gemeindefreien Gebiete): 396 Gemeinden wie
im Epic. Davon 52 mit weniger als 10.000 Einwohnern (Spalte „Bevölkerung insgesamt“,
31.12.2025). Diese 52 nach Regionalschlüssel sortiert, dann
`random.Random(28012).sample(liste, 30)` (Python 3.14). Seed 28012 = fn-28, Ticket 12, nach dem
Muster von Hessen (28009).

**Begründung der Größengrenze:** Der Task verlangt 30 Gemeinden unter 10.000 Einwohnern; die
Grenze ist beibehalten, damit die Länder vergleichbar bleiben. Weil sie in NRW nur 52 Gemeinden
mit 408.004 Einwohnern umfasst, kommt eine **Ergänzung E1 bis E10** dazu: dieselbe Ziehung mit
Seed 28012 aus den 267 Gemeinden mit 10.000 bis unter 50.000 Einwohnern (6.106.564 Einwohner).
Verteilung NRW zum Vergleich: unter 10.000: 52; 10.000 bis 20.000: 132; 20.000 bis 50.000: 135;
50.000 bis 100.000: 48; ab 100.000: 29.

**Spalten:** Fundort = Hauptfundort. Zugriff mit Zahl der kommenden Termine (ab 29.10.2026),
sofern abgezählt; NOLIS liefert immer ein 28-Tage-Fenster. VE = Zuordnung der Vollerhebung
bestätigt (ja), abweichend (nein) oder nicht prüfbar. d.one = Treffer bei destination.one
`open-data`, `q=city:"<Name>"`, Fenster 29.10.2026 bis 28.10.2027 (Abschnitt „Abgleich
destination.one“).

| Nr | Gemeinde | AGS | EW | Fundort | CMS/Plattform (Merkmal) | Kalender | Zugriff (kommend) | VE | d.one |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Sonsbeck | 05170040 | 8.628 | Gemeinde-Website | Eigenbau auf Yii 1.1 | https://www.sonsbeck.de/freizeit-tourismus/veranstaltungen | Inline-JSON im FullCalendar-Aufruf (39) | nein (VE: html_generic) | 2 |
| 2 | Schlangen | 05766064 | 9.249 | Gemeinde-Website | Weblication (Generator-Meta), Betrieb OWL-IT | https://www.gemeinde-schlangen.de/gemeinde/aktuelles/veranstaltungen.php | HTML `listEntry*` (112 Terminzeilen) | ja | 0 |
| 3 | Wachtendonk | 05154060 | 8.154 | Gemeinde-Website | ionas TVM (`PRODID:-//IONAS//TVM//DE`) | https://www.wachtendonk.de/tourismus-freizeit/veranstaltungen/veranstaltungskalender/ | `events.json`, `event.ics` (78) | ja | 3 |
| 4 | Langenberg | 05754024 | 8.363 | Gemeinde-Website | ionas TVM | https://www.langenberg.de/startseite/leben-in-langenberg/freizeit-sport-gastronomie-veranstaltungen/veranstaltungen/ | `events.json` (11) | nein (VE: kein_link) | 0 |
| 5 | Rheurdt | 05154048 | 6.350 | Gemeinde-Website | Cross7 (`data-c7-page="534"`), TYPO3 | https://www.rheurdt.de/freizeit-kultur/veranstaltungen | Cross7-API (2) | ja | 0 |
| 6 | Erndtebrück | 05970012 | 6.804 | Regionalkalender | termine-wittgenstein.de, eigene PHP-Software | https://termine-wittgenstein.de/kalender/1/?form%5Bregion%5D=4 | HTML (2) | Fundort ja, Etikett outdooractive nein | 1 |
| 7 | Saerbeck | 05566080 | 6.906 | nicht lesbar | active-City laut VE; ColdFusion | https://www.saerbeck.de/Seiten/Veranstaltungskalender-2.html | drei GET mit 200 und leerem Body | nicht prüfbar | 32 |
| 8 | Legden | 05554036 | 7.532 | Gemeinde-Website | NOLIS (`fonts.nol-is.de`, Kommune 24110) | https://www.legden.de/unsere-gemeinde/aktuelles/termine-und-veranstaltungen/aktuelle-veranstaltungen/ | NOLIS-iCal (31 in 28 Tagen) | ja | 2 |
| 9 | Altenbeken | 05774004 | 9.073 | Gemeinde-Website | Weblication | https://www.altenbeken.de/de/veranstaltungen/ | HTML, iCal je Termin (27) | ja | 1 |
| 10 | Heek | 05554024 | 8.715 | Gemeinde-Website | NOLIS (Kommune 24120) | https://www.heek.de/kultur-tourismus/veranstaltungen/veranstaltungskalender/ | NOLIS-iCal (22 in 28 Tagen) | ja | 3 |
| 11 | Titz | 05358056 | 9.025 | Heimat-Info | Website sperrt ClaudeBot, nicht abgerufen | https://heimatinfo-api-platform.azurewebsites.net/communes/9d8406e1-5bce-4898-b90e-d12721452b52/events | Heimat-Info-API (14) | ja (API) | 0 |
| 12 | Vettweiß | 05358060 | 9.957 | Heimat-Info | Website sperrt ClaudeBot | https://heimatinfo-api-platform.azurewebsites.net/communes/79ef49ec-d48d-4b47-ab8d-441fb8c46611/events | Heimat-Info-API (9) | ja (API) | 0 |
| 13 | Horstmar | 05566024 | 7.428 | Stadtmarketingverein | Stadt ionas ohne TVM; Kalender WordPress, Modern Events Calendar | https://horstmarerleben.de/neuigkeiten-event-kalender | RSS `/events/feed/` mit `mec:*`, nur die nächsten 10 | nein (VE-URL ist eine Meldung) | 0 |
| 14 | Blankenheim | 05366008 | 8.382 | Gemeinde-Website | cm city media alt (`calendarV4_0`), nicht Cross7 | https://www.blankenheim.de/de/freizeit/events/veranstaltungskalender | Daten auf exchange.cmcitymedia.de, robots sperrt alles | Hersteller ja, Zugriff gesperrt | 38 |
| 15 | Tecklenburg | 05566088 | 9.099 | nirgends | Weblication | https://www.tecklenburg.de/de/veranstaltungen/ | leer („Es gibt noch keine Veranstaltungen“) | Hersteller ja, Inhalt leer | 69 |
| 16 | Barntrup | 05766012 | 8.248 | Gemeinde-Website | active-City 3.115.1 (HTML-Kommentar) | https://www.barntrup.de/Tourismus-Kultur-Freizeit/Veranstaltungskalender.htm | HTML, 4 Seiten (64) | ja | 0 |
| 17 | Hopsten | 05566020 | 7.620 | Regionalkalender | ionas ohne TVM; Widget Datenportal Münsterland | https://www.hopsten.de/gemeindeleben/veranstaltungen/ | Widget-Host sperrt per robots, 0 im Server-HTML | nein | 2 |
| 18 | Schieder-Schwalenberg | 05766060 | 7.986 | nicht belegt | robots.txt sperrt alle Bots | nicht belegt | nicht abgerufen | ja (VE: robots) | 4 |
| 19 | Inden | 05358020 | 7.572 | Heimat-Info | Website sperrt ClaudeBot | https://heimatinfo-api-platform.azurewebsites.net/communes/06f83ada-43bf-4430-98e2-3c8717fa44ee/events | Heimat-Info-API (2) | ja, aber fast leer | 0 |
| 20 | Heimbach | 05358012 | 4.467 | Heimat-Info | Website sperrt ClaudeBot | https://heimatinfo-api-platform.azurewebsites.net/communes/3ecdca3d-91f8-4491-a8a5-412edf037c3a/events | Heimat-Info-API (2) | ja | 54 |
| 21 | Medebach | 05958028 | 7.874 | Gemeinde-Website | TYPO3 mit `tx_citkoevents3` (CITKO) | https://www.medebach.de/leben-in-medebach/veranstaltungen | HTML, nur Seite 1 erlaubt (20) | nein (VE: html_generic) | 13 |
| 22 | Breckerfeld | 05954004 | 8.703 | destination.one-Widget | Joomla; Experience `stadtmarketing-breckerfeld` | https://www.breckerfeld.de/touismus-kultur/test.html | Widget, in `open-data` 0 | nein (VE: js_oder_feed) | 0 |
| 23 | Metelen | 05566052 | 6.540 | Vereins-App | GoodBarber-App des Marketingvereins; NOLIS unverlinkt | https://www.metelen-app.de/veranstaltungskalender/c/0 | App (4); NOLIS-iCal (22, nur Ladencafé und Wochenmarkt) | teils | 0 |
| 24 | Schöppingen | 05554052 | 6.746 | Gemeinde-Website | NOLIS (Kommune 28230) | https://www.schoeppingen.de/regional/veranstaltungen/sucheplus.html | NOLIS-iCal (28 in 28 Tagen) | ja | 1 |
| 25 | Wettringen | 05566096 | 8.190 | Verkehrsverein | Gemeinde ionas ohne TVM; Verkehrsverein ProcessWire, gespeist aus Datenportal Münsterland | https://www.wettringen-tourismus.de/veranstaltungen/ | Server-HTML (12) | nein | 12 |
| 26 | Dahlem | 05366012 | 4.438 | Heimat-Info | Website sperrt ClaudeBot | https://heimatinfo-api-platform.azurewebsites.net/communes/1799f6a6-b177-4c29-8590-87846bc934a6/events | Heimat-Info-API (17) | ja | 17 |
| 27 | Everswinkel | 05570024 | 9.803 | Gemeinde-Website | Weblication | https://www.everswinkel.de/de/veranstaltungen/ | HTML (11), iCal-Skript 404 | ja | 9 |
| 28 | Marienmünster | 05762024 | 4.758 | Gemeinde-Website | TYPO3 mit `hwveranstaltung` | https://www.marienmuenster.de/de/freizeit-gaeste/touristinformation/veranstaltungen/seite-1/suche-none | HTML, 4 Seiten (33) | ja | 0 |
| 29 | Nettersheim | 05366032 | 8.216 | Gemeinde-Website | TYPO3 mit `tx_ilveranstaltungen`; Heimat-Info daneben | https://www.nettersheim.de/home/veranstaltungen/ | HTML, 2 Seiten (105); Heimat-Info-API (26) | nein (VE: Heimat-Info, VE-URL 404) | 52 |
| 30 | Beelen | 05570012 | 6.001 | nicht belegt | robots.txt sperrt alle Bots | nicht belegt | nicht abgerufen | nicht prüfbar | 0 |

**Ergänzung 10.000 bis unter 50.000 Einwohner:**

| Nr | Gemeinde | AGS | EW | Fundort | CMS/Plattform | Kalender | Zugriff (kommend) | Vereins- und Ortsteilfeste | d.one |
|---|---|---|---|---|---|---|---|---|---|
| E1 | Willich | 05166036 | 49.374 | Stadt-Website | Drupal, Theme `m280_www_theme` | https://www.stadt-willich.de/kultur-freizeit/veranstaltungen | HTML (49) | Filter „Vereine“ und „Volksfest“ leer | 2 |
| E2 | Jüchen | 05162012 | 23.901 | Stadt-Website | TYPO3, eine Seite | https://www.juechen.de/aktuelles/veranstaltungen | HTML (38) | 26 von 38 | 0 |
| E3 | Holzwickede | 05978016 | 17.543 | nirgends | verwaltungsportal.de ohne Veranstaltungsmodul (`/veranstaltungen/index.php` 404) | keiner | Termine nur als Nachrichten | keine | 0 |
| E4 | Bedburg-Hau | 05154004 | 13.634 | Gemeinde-Website | Drupal, Theme `m510_www_theme`, Brauchtumskategorien | https://www.bedburg-hau.de/gemeinde-rathaus/aktuelles-aus-dem-rathaus/veranstaltungen | HTML (142 Termintage) | mindestens 16 | 1 |
| E5 | Niederkrüchten | 05166020 | 14.601 | Gemeinde-Website | Drupal, Theme `m290_www_theme` | https://www.niederkruechten.de/tourismus-freizeit/veranstaltungen | HTML (54) | 18 von 54 | 1 |
| E6 | Meschede | 05958032 | 29.446 | Stadt-Website mit destination.one | TYPO3, Experience `meschede` | https://www.meschede.de/veranstaltungskalender | `data-overall-count="349"`, Paging per robots gesperrt | nicht abgezählt | 65 |
| E7 | Emsdetten | 05566008 | 35.925 | Stadt-Website plus Verkehrsverein | ionas TVM | https://www.emsdetten.de/tourismus-kultur-veranstaltungen/veranstaltungen/veranstaltungskalender/ | `events.json` (7) | 1 von 7 | 64 |
| E8 | Havixbeck | 05558020 | 12.280 | Crossiety, eingebettet | Weblication-Liste mit Crossiety-Karten | https://www.havixbeck.de/de/tourismus/kultur/veranstaltungskalender.php | HTML (146) | nicht belegt (3 Martinszüge nach Titel) | 2 |
| E9 | Hückelhoven | 05370020 | 41.148 | Stadt-Website | WordPress, offenes REST `/wp-json/wp/v2/termin` | https://www.hueckelhoven.de/stadtleben/events/veranstaltungen/ | JSON (24 auf Seite 1) | 4 von 24, keine Feste | 2 |
| E10 | Wegberg | 05370040 | 28.001 | Stadt-Website | ionas TVM | https://www.wegberg.de/tourismus-kultur/veranstaltungskalender/ | `events.json` (75) | 20 von 75 | 0 |

Befunde je Gemeinde (Auswahl; alle Einzelbefunde mit Links stehen in den Rohnotizen der
Teilrecherchen und sind über die Anfragenliste nachvollziehbar):

* **Ortsteile überall:** NOLIS führt sie in `X-ORT` (Legden: Asbeck; Heek: Nienborg; Schöppingen:
  Eggerode, Haverbeck), ionas in `X-LOCALITY` und Ortsnamen (Wachtendonk: Wankum, Harzbeck),
  Weblication als Listenzeile „Ortsteil Kohlstädt“ (Schlangen), sonst im Titel (Barntrup:
  Sonneborn; Medebach: Oberschledorn; Marienmünster: Bremerberg; Nettersheim: Roderath, Buir,
  Engelgau). Bei ionas heißen Titel teils nur „St. Martin“ (Wachtendonk dreimal), der Ortsteil
  steht dann nur im Ortsfeld.
* **Abweichungen von der Vollerhebung (10 von 30):** Sonsbeck (Inline-JSON statt generisch),
  Langenberg (ionas mit Feed statt „kein_link“), Erndtebrück (eigene Software statt outdooractive),
  Horstmar (Kalender beim Stadtmarketingverein), Hopsten und Wettringen (Datenportal Münsterland
  statt ionas-Kalender), Medebach (CITKO-Modul), Breckerfeld (destination.one-Widget), Metelen
  (Vereins-App statt NOLIS), Nettersheim (eigener TYPO3-Kalender, Heimat-Info nur daneben).
  Bestätigt 18, nicht prüfbar 2 (Saerbeck, Beelen). In der Ergänzung weichen Holzwickede (kein
  Kalender), Meschede (destination.one statt tx_news), Havixbeck (Crossiety) und Hückelhoven
  (WP-REST statt generisch) ab.
* **Saerbeck:** robots.txt `Crawl-delay: 300`; drei GET im Abstand von je etwa 8 Minuten lieferten
  200 mit 0 Byte, ein HEAD 200 `text/html`. Nicht weiter verfolgt.
* **Heimbach:** Die Nutzung von Heimat-Info nennt das Stadtjournal (laut Websuche
  https://www.heimbach-eifel.de/downloads/stadtjournal/19_23_inet.pdf , nicht selbst geöffnet).
* **Amtsblätter:** eigene PDF-Reihen (Horstmar, Hopsten über `hopsten.ratsinfomanagement.net/amtsblatt/`,
  Schöppingen, Heimbach „Stadtjournal“, Inden „Inden Info“, Holzwickede), einmal ein Verlag:
  Rheurdt beim Rautenberg Verlag (https://archiv.rautenberg.media/Rhe/Rhe_42_2026.pdf). Marienmünster
  verweist auf die Lokalzeitungen. Kein WITTICH-Blatt in der Stichprobe; die Vollerhebung ordnet
  keiner NRW-Gemeinde einen meinOrt-Eintrag zu (Spalte `meinort` = 0 für alle 396).
* **Datenschutz:** Das ionas-ICS (Wachtendonk) und die Kirchenexporte enthalten Telefonnummern und
  E-Mails von Privatpersonen; für einen Import `events.json` bzw. ohne Personenfelder.

## Generics

### G1. ionas TVM (Chamaeleon AG)

* **Gemeinden:** Vollerhebung NRW 37 mit ionas (Steinfurt 7, Städteregion Aachen 5, Kleve 4,
  Rhein-Sieg-Kreis 4 u. a.); Stichprobe 2 von 30 mit Kalender (Wachtendonk, Langenberg), dazu 3
  ionas-Seiten ohne TVM (Horstmar, Hopsten, Wettringen); Ergänzung 2 von 10 (Emsdetten, Wegberg).
  ionas heißt also nicht Kalender; der TVM-Anteil der 37 ist nicht gemessen. Bundesweite
  Einordnung: [01-vollerhebung.md](01-vollerhebung.md) Abschnitt 3, [08-hessen.md](08-hessen.md) G1.
* **Zugriff:** `data-source="https://<host>/<pfad>/events.json?weekends=false&tagMode=ALL"` auf
  der Kalenderseite, daneben `event.ics`. Der Kalender liegt oft eine Ebene tiefer als die
  Übersichtsseite (Wachtendonk, Wegberg).
* **Felder `events.json` (Wachtendonk, Langenberg, Wegberg):** `id` (`43315:0`), `start`, `end`
  (lokal ohne Offset), `allDay`, `title`, `website`, `imageSrc`, `category` {`id`, `name`} (bei
  Langenberg und Emsdetten fehlt sie), `tags`, `location` {`name`, `description`, `href`}.
  **ICS (Wachtendonk, 518 VEVENT):** `UID`, `SUMMARY`, `DTSTART;TZID=Europe/Berlin`, `DTEND`,
  `LOCATION`, `X-LOCATION-NAME`, `X-STREET-ADDRESS`, `X-POSTAL-CODE`, `X-LOCALITY`,
  `X-ORGANIZER-NAME`, `X-ORGANIZER-EMAIL`, `X-ORGANIZER-TELEPHONE`, `X-IONAS-CATEGORY`,
  `CATEGORIES`, `URL`, `GEO` (29 von 518), `X-PRICE`.
* **robots/Lizenz:** robots.txt fehlt bei Wachtendonk, Langenberg, Emsdetten, Wegberg (404).
  Wachtendonk stellt den ICS selbst auf offenesdatenportal.de unter Datenlizenz Deutschland Zero
  2.0 bereit (https://www.offenesdatenportal.de/dataset/veranstaltungen-wachtendonk). Sonst keine
  Nutzungsbedingungen belegt.
* **Beispiele:** https://www.wachtendonk.de/kalender/veranstaltungskalender-gesamt/events.json?weekends=false&tagMode=ALL ;
  https://www.langenberg.de/startseite/kalender/events.json?weekends=false&tagMode=ALL ;
  https://www.wegberg.de/kalender/events.json?weekends=false&tagMode=ALL .
* **Dorffest-Test:** bestanden. Martinszug Harzbeck 06.11.2026 und Wankum 07.11.2026 (Wachtendonk,
  IDs 48883:0, 48886:0), „St. Martinsumzug“ Langenberg 06.11.2026, „Roaner Weihnachtsdorf“
  Rath-Anhoven 21.11.2026 (Wegberg); im Wegberger Rückblick „Schützenfest Klinkum“, „Schützenfest
  in Wildenrath“, „100 Jahre Feuerwehr Arsbeck“.

### G2. NOLIS (Münsterland)

* **Gemeinden:** Vollerhebung NRW 22 (Borken 8, Steinfurt 3, Ennepe-Ruhr-Kreis 3 u. a.);
  Stichprobe 4 von 30 (Legden, Heek, Schöppingen, Metelen unverlinkt). Bundesweit:
  [00-bundesweit.md](00-bundesweit.md) C2.
* **Zugriff:** iCal `/veranstaltungen/veranstaltungen.ical?zeitauswahl=1&auswahl_woche_tage=28&…&selected_kommune=<ID>&beginn=…&ende=…`.
  Das Fenster folgt `auswahl_woche_tage=28`, nicht `ende` (in Legden und Schöppingen selbst
  geprüft); `zeitauswahl=0` lieferte 0 Byte. Neu: iCal je Termin
  `/veranstaltungen/veranstaltung/<slug>-<id>-<kommune>.ical`.
* **Felder (Legden, Heek, Schöppingen):** `X-ID`, `SUMMARY`, `DTSTART`, `DTEND` (UTC),
  `DESCRIPTION`, `X-KURZBESCHREIBUNG`, `LOCATION`, `X-LOCATION-ID`, `X-ORT`, `X-ORT-ID`, `GEO`,
  `X-KOMMUNE`, `X-KOMMUNE-ID`, `X-ORGANIZER`, `X-ORGANIZER-ID`, `CATEGORIES`, `X-SCHLAGWORTE`,
  `X-RESSORT`, `X-SERIENCONTAINER`, `URL` (Vereinswebsite, nicht Detailseite), `STATUS`,
  `LAST-MODIFIED`. `GEO` steht als Länge;Breite (gegen RFC 5545 vertauscht) oder `0;0` (Legden 12
  von 31).
* **robots:** sperrt nur Kontakt, Suche, Weiterempfehlen (legden.de, heek.de, schoeppingen.de,
  metelen.de); `/regional/` und `/veranstaltungen/` frei. Lizenz nicht belegt.
* **Beispiele:** https://www.legden.de/unsere-gemeinde/aktuelles/termine-und-veranstaltungen/aktuelle-veranstaltungen/ ;
  https://www.heek.de/kultur-tourismus/veranstaltungen/veranstaltungskalender/ ;
  https://www.schoeppingen.de/regional/veranstaltungen/sucheplus.html .
* **Dorffest-Test:** bestanden. „Martinsumzug in Nienborg“ 11.11.2026
  https://www.heek.de/regional/veranstaltungen/martinsumzug-in-nienborg-900003763-24120.html ;
  „Martinsumzüge, Begleitung und Bewirtung“ 11.11.2026
  https://www.schoeppingen.de/regional/veranstaltungen/martinsumzuege-begleitung-und-bewirtung-900001151-28230.html ;
  „St. Brigida erstrahlt: Weihnachtsmarkt“
  https://www.legden.de/regional/veranstaltungen/st-brigida-erstrahlt-weihnachtsmarkt-900003901-24110.html .
  Metelen nicht bestanden (nur Ladencafé, Wochenmarkt).

### G3. Heimat-Info (Cosmema WITTICH), Rheinland-Cluster

* **Gemeinden:** `communes/search` liefert 653 Kommunen, davon 22 in NRW (Zuordnung per Koordinate
  in die BKG-Landesflächen, Gegenprobe PLZ ohne Grenzfall): Aldenhoven, Dahlem, Düren, Eschweiler,
  Heimbach, Hürtgenwald, Inden, Jülich, Kall, Korschenbroich, Kreuzau, Kürten, Landgemeinde Titz,
  Langerwehe, Linnich, Merzenich, Nettersheim, Nideggen, Niederzier, Stolberg, Vettweiß,
  Weilerswist. Selbst nachgezählt: Kreis Düren 14 (alle außer Nörvenich), Kreis Euskirchen 4,
  Städteregion Aachen 2, Rhein-Kreis Neuss 1, Rheinisch-Bergischer Kreis 1, Westfalen 0. Das deckt
  sich mit den 22 Heimat-Info-Zuordnungen der Vollerhebung. Stichprobe: 6 von 30 (5 als
  Hauptfundort, Nettersheim parallel zum eigenen Kalender).
* **Zugriff und Felder:** wie [00-bundesweit.md](00-bundesweit.md) A1, selbst nachgeprüft:
  Termin `id`, `organizationId`, `title`, `content`, `contentPreview`, `startDate`, `endDate`,
  `location` (Freitext), `externalId` (leer), `visibleUntil`; Kommune zusätzlich `logoUrl`,
  `imprintUrl`, `isHidden`, `externalSearchUrl`, `isClone`. Vereine mit Adresse nur im Widget
  `https://www.heimat-info.de/embeddings/events/v1/?c=<id>`.
* **Inhalt:** sehr ungleich. Kommende Termine: Stolberg 186, Korschenbroich 40, Kürten 38,
  Nettersheim 26, Dahlem 17, Titz 14, Vettweiß 9, Inden 2, Heimbach 2. Dahlem und Heimbach haben
  `externalEventsCalendarUrl` gesetzt und trotzdem Termine in der API; die Annahme aus A1, dass
  diese Kommunen dort keine liefern, gilt hier nicht.
* **robots/Lizenz:** API-Host ohne robots.txt; die Gemeinde-Websites Titz, Vettweiß, Inden,
  Heimbach und Dahlem sperren ClaudeBot, Claude-Web und anthropic-ai (gleiche Liste), ob sie
  Heimat-Info einbinden, ist deshalb nicht belegt. Lizenz: nur über die WITTICH-Anfrage.
* **Beispiele:** Titz, Dahlem, Heimbach (Links in der Stichprobentabelle).
* **Dorffest-Test:** bestanden. „Kirmes Hergarten“ 07.11.2026 (Heimbach)
  https://www.heimat-info.de/veranstaltungen/bdd0ea03-8c9f-4099-a0ee-cb5e97070346 ; „St. Martin in
  Hasselsweiler“ (Titz) https://www.heimat-info.de/veranstaltungen/2cd80db8-4fe5-4f22-91d6-31dcc9676291 ;
  „Martinsumzug in Kelz“ (Vettweiß) https://www.heimat-info.de/veranstaltungen/ce55fb93-e960-4615-bf06-fb5aa11ce6cf ;
  „Lieberger Weihnachtsmarkt“ 28.11.2026 (Korschenbroich, Ortsteil Liedberg). Inden und Dahlem
  nicht bestanden (Wanderungen, Thekenabende).

### G4. Weblication

* **Gemeinden:** Vollerhebung NRW 31 (Paderborn 9, Steinfurt 4, Borken 3, Höxter 3 u. a.);
  Stichprobe 4 von 30 (Schlangen, Altenbeken, Tecklenburg, Everswinkel), Ergänzung 1 (Havixbeck,
  Inhalt aus Crossiety). Hersteller laut Generator-Meta „Weblication® CMS“; die Firma dahinter ist
  in dieser Recherche nicht nachgeprüft. Schlangen läuft über OWL-IT (`webportal.owl-it.de`).
* **Zugriff:** HTML-Liste `listEntry*` (`listEntryTitle`, `listEntryDate` mit `dayFrom`,
  `timeFrom`, `dayTo`), Paging je Seite eigener Parameter (`?pageIde816547c=N`). iCal je Termin über
  `/de-wGlobal/wGlobal/scripts/php/createICal.php?path=<Detailpfad>&from=…&to=…`: Altenbeken 200
  (`PRODID:-//Weblication CMS`, Felder `SUMMARY` mit HTML-Entities, `DTSTART`/`DTEND` ohne TZID,
  `LOCATION`, `UID`, `URL`), Schlangen und Everswinkel 404. Kein Listen-Feed.
* **robots:** schlangen und tecklenburg 404, altenbeken sperrt `/cloud` und `/*searchTerm=`,
  everswinkel erlaubt alles. Lizenz nicht belegt.
* **Beispiele:** https://www.gemeinde-schlangen.de/gemeinde/aktuelles/veranstaltungen.php ;
  https://www.altenbeken.de/de/veranstaltungen/ ; https://www.everswinkel.de/de/veranstaltungen/ .
* **Dorffest-Test:** bestanden. „Weihnachtsmarkt in Schlangen“ 13.12.2026
  https://www.gemeinde-schlangen.de/gemeinde/aktuelles/veranstaltungen/termine/Weihnachtsmarkt-in-Schlangen.php?splitId=1 ;
  „Hubertusfest 2026“ des Bürgerschützen- und Heimatvereins St. Hubertus 07./08.11.2026
  https://www.everswinkel.de/de/veranstaltungen/termine/import/event_43026.php . Altenbeken nicht
  bestanden (Calisthenics, Sitzungen), Tecklenburg leer.

### G5. active-City (net-com)

* **Gemeinden:** Vollerhebung NRW 12 (Steinfurt 4, Lippe 3 u. a.); Stichprobe 2 von 30 (Barntrup
  lesbar, Saerbeck nicht). Bundesweit: [00-bundesweit.md](00-bundesweit.md) C5.
* **Zugriff/Felder (Barntrup):** HTML, `event_wrapper teaser_element`, `event_teaser_title_link`,
  `event_date_from`, Pager `?az=all&page=N`. robots.txt `Crawl-delay: 30`, sperrt
  `/city_info/display/event/`, `/city_info/display/v_kalender/`, `/city_info/ajax/`; die
  SEO-Pfade `/Veranstaltungskalender.htm/Veranstaltungen/...` sind frei. Saerbeck: `Crawl-delay: 300`.
* **Beispiele:** https://www.barntrup.de/Tourismus-Kultur-Freizeit/Veranstaltungskalender.htm ;
  Saerbeck (oben); Westerkappeln ([00-bundesweit.md](00-bundesweit.md) C5).
* **Dorffest-Test:** bestanden. „Weihnachtsumzug & Weihnachtsmarkt“ in Sonneborn 19.12.2026
  https://www.barntrup.de/Tourismus-Kultur-Freizeit/Veranstaltungskalender.htm/Veranstaltungen/Weihnachtsumzug-und-Weihnachtsmarkt.html? .

### G6. Datenportal Münsterland (Münsterland e.V.)

* **Gemeinden:** Stichprobe 2 von 30 (Hopsten bettet das Widget ein, der Verkehrsverein
  Wettringen speist seinen Kalender daraus: „Einmal im Datenportal eingetragen, überall online
  abrufbar!“). Zahl der liefernden Gemeinden nicht belegt.
* **Zugriff:** REST `https://www.datenportal-muensterland.de/api/v1/events` (dazu `pois`,
  `routes`, `event_organizers`); laut Doku HTTP-Basic, ohne Zugang 401. Widget-Host
  `share-it.datenportal-muensterland.de` sperrt alle Bots per robots.txt. Felder nicht belegt.
* **Lizenz:** Open.NRW-Eintrag nennt eine „semi-offene Schnittstelle“ mit „einmaliger Anmeldung“
  und CC-BY-SA
  (https://ckan.open.nrw/dataset/veranstaltungs-datenbank-und-touristisch-interessante-standorte-im-munsterland-ms).
* **Dorffest-Test:** über den Verkehrsverein Wettringen bestanden: „Nikolausmarkt am Heimathaus in
  Wettringen“ 28./29.11.2026
  https://www.wettringen-tourismus.de/veranstaltungen/nikolausmarkt-wettringen-sa-so-28-29.11.2026/ .
  Das Portal muensterland.com zeigt nur Highlights.

### G7. Evangelische Kalender (EKiR und EKvW)

* **Betreiber:** Software „Evangelische Termine“ (Quellenbericht
  `docs/research/deutschland-event-quellen-2026-10.md` Abschnitt 8). Neu für NRW:
  **www.veranstaltungen-ekvw.de** (Evangelische Kirche von Westfalen), gleiche Software.
* **Zahlen:** termine.ekir.de `eventtype=7`: 126 Termine vom 30.10.2026 bis 26.08.2028, 112 mit
  NRW-PLZ, 104 mit Koordinaten. veranstaltungen-ekvw.de: `totalItems` 39.665, `eventtype=7`: 554
  (in 300 abgerufenen: PLZ 4… 117, 3… 102, 5… 79).
* **Zugriff/Felder:** `/xml?…`, `/json?…` ohne Key; `START_RFC`, `END_RFC`, `_event_TITLE`,
  `_event_EVENTTYPE`, `_event_TEXTBOX_1`, `_place_NAME`, `_place_ZIP`, `_place_CITY`,
  `_place_GLAT`, `_place_GLONG`, `_user_REALNAME`, dazu personenbezogen `_person_NAME`,
  `_person_EMAIL`, `_user_EMAIL` (nicht übernehmen). Detail
  `https://<host>/veranstaltung_im_detail<ID>.html`.
* **robots/Lizenz:** termine.ekir.de `Allow: /`, EKvW ohne robots.txt; Lizenz für beide nicht
  belegt.
* **Dorffest-Test:** bestanden. „11. Martinsmarkt in Alfter“ 08.11.2026
  https://termine.ekir.de/veranstaltung_im_detail1043624.html ; „Weihnachtsmarkt Hennen“ (Ortsteil
  von Iserlohn) 05./06.12.2026 https://www.veranstaltungen-ekvw.de/veranstaltung_im_detail1345182.html ;
  „Weihnachtsmarkt Heedfeld“ (Schalksmühle). Katholische Bistümer: kein offener Export gefunden.

### G8. Drupal-Theme-Familie `mNNN_www_theme` (Niederrhein)

* **Gemeinden:** Ergänzung 3 von 10 (Willich `m280`, Niederkrüchten `m290`, Bedburg-Hau `m510`),
  alle in den Kreisen Viersen und Kleve. Betreiber und Gesamtzahl nicht belegt; die Vollerhebung
  führt die drei als `html_generic`.
* **Zugriff:** nur HTML, Pager `?page=N` (0-basiert), Filterparameter je Seite anders (`type`,
  `field_evt_type_ref_target_id`, `date_begin`); kein Feed, kein JSON-LD. robots.txt
  Drupal-Standard.
* **Dorffest-Test:** bestanden in zwei von drei. „St. Martinszug in Hau“ 04.11.2026
  https://www.bedburg-hau.de/tourismus-freizeit/veranstaltungen/st-martinszug-hau ; „Schützenfest
  der St. Agatha Schützenbruderschaft 1608 e.V. in Oberkrüchten“ 23. bis 27.04.2027
  https://www.niederkruechten.de/tourismus-freizeit/veranstaltungen/schuetzenfest-der-st-agatha-schuetzenbruderschaft-1608-ev .
  Willich nicht bestanden.
* **Nächster Schritt:** In der nächsten Erhebung das Merkmal `m\d+_www_theme` über alle NRW-Seiten
  zählen; bei mehr als einer Handvoll Gemeinden lohnt ein gemeinsamer Parser.

### Kleinere Funde

| Quelle | Gemeinden | Zugriff | Dorffest-Test |
|---|---|---|---|
| termine-wittgenstein.de (eigene PHP-Software, Betreiber laut Consent-Eintrag Erndtebrück BLB-Tourismus GmbH; Impressum lieferte 500) | Bad Berleburg, Bad Laasphe, Erndtebrück | HTML, Filter `form[rubrik]`, `form[region]`, Detail `?dfxid=`; robots 404 | bestanden: Rubrik „Fest“ mit „Romantischer Weihnachtsmarkt Diedenshausen“ 28.11.2026, „Arfelder Weihnachtsmarkt“ 05.12.2026 https://termine-wittgenstein.de/kalender/1/?form%5Brubrik%5D=Fest |
| Cross7 ([00-bundesweit.md](00-bundesweit.md) C1) | Vollerhebung NRW 7; Stichprobe 1 (Rheurdt) | API, `from` nur mit Millisekunden und `Z` (sonst 422) | bestanden, dünn: „St. Martinszug in Schaephuysen“ 11.11.2026 (`?c7-item=41998389`), nur 2 kommend |
| Modern Events Calendar | Horstmar (Stadtmarketingverein) | RSS `/events/feed/` mit `mec:*`, nur die nächsten 10 | bestanden: „VORWEIHNACHTSMARKT“ 20.11.2026 https://horstmarerleben.de/events/vorweihnachtsmarkt |
| Inline-JSON Eigenbau | Sonsbeck | FullCalendar `events:[…]`, alle 2.084 Termine seit 2016 | bestanden: „Weihnachtsmarkt“ 11.12.2026 https://www.sonsbeck.de/veranstaltung/2677/weihnachtsmarkt ; Ortsteil: „Dorf- und Feuerwehrfest in Hamb“ 04.07.2026 |
| WordPress REST Post-Typ `termin` | Hückelhoven | `/wp-json/wp/v2/termin`, `acf.date_start` als Unix-Sekunden | nur städtisch: „Hückelhoven weihnachtet“ |
| hwveranstaltung (Hirsch & Wölfl, [01-vollerhebung.md](01-vollerhebung.md) Abschnitt 3) | Vollerhebung NRW 2; Marienmünster | HTML `hw_record__*` | bestanden: „Martinsumzug Bremerberg“ 14.11.2026 https://www.marienmuenster.de/de/freizeit-gaeste/touristinformation/veranstaltungen/1899/martinsumzug-bremerberg |
| CITKO `tx_citkoevents3` | Medebach | HTML; robots sperrt `?tx_`, also nur Seite 1 | bestanden: „St. Martin mit Martinsspiel und Laternenzug“ Oberschledorn 11.11.2026 (Liste) |
| TYPO3 `tx_ilveranstaltungen` | Nettersheim | HTML, 105 kommend bis 21.11.2027 | bestanden: „Roderather Glühweinmarkt 2026“, „St. Martinszug in Buir“, „Kirmesball der Vereinsgemeinschaft Engelgau“ 15.05.2027 |
| TYPO3 eine Seite | Jüchen | HTML, Anker `#eventdetail-<id>` | bestanden: „Schützenfest Garzweiler 2027“ https://www.juechen.de/aktuelles/veranstaltungen#eventdetail-1629 , „Klompenkirmes Otzenrath-Spenrath 2027“ |
| Crossiety ([00-bundesweit.md](00-bundesweit.md) A3) | Havixbeck (in Weblication eingebettet) | HTML-Karten `crossiety.app/event_cards/<id>` | bestanden: „Martinsumzug Havixbeck“ 08.11.2026 https://crossiety.app/event_cards/1847634 |
| Vereins-App GoodBarber | Metelen | robots sperrt `/apiv3/`, `/apiv4/` | nicht bestanden (4 Termine) |
| fotho.de „Kirmeskalender NRW“ (privat, The Events Calendar) | NRW-weit, 136 kommende Termine | Tribe-REST offen; Impressum: Urheberrecht, keine offene Lizenz | fast nur Stadtkirmessen; nur als Lückenliste |

### Geprüft, nicht weiter verfolgen

* **Rhein-Kreis Neuss Open Data:** Festdatensätze nur von Grevenbroich
  (`grevenbroich-volks-und-heimatfeste-2026` und `-2027`, `grevenbroich-sankt-martinsumzuege-2026`,
  CC0) und Neuss (`stadt-neuss-kirmes-schuetzenfest-poi`, nur Standplan, CC BY 4.0); für Dormagen,
  Kaarst, Meerbusch, Korschenbroich, Jüchen, Rommerskirchen keiner (Sitemap
  https://opendata.rhein-kreis-neuss.de/sitemap.xml , 434 Einträge). Der 2027er Satz wurde am
  13.10.2026 angelegt, also im Herbst des Vorjahres, jedes Jahr unter neuem Namen. Die robots.txt
  sperrt `/api/`, `/explore/download` und `/explore/dataset/*/download` für alle außer Googlebot;
  alle Exportformate liegen unter `/api/`. Das betrifft auch den Neusser Veranstaltungskalender
  (CC BY 4.0), den der Quellenbericht als Kandidat führt.
* **Open.NRW:** CKAN-API per robots gesperrt (`Disallow: /api/`), govdata.de sperrt ganz. Über die
  HTML-Suche: 10 Kommunen mit Veranstaltungskalender als Datensatz (Neuss, Köln, Hamm, Geldern,
  Wesel, Wachtendonk, Moers, Kleve, Krefeld, Bonn), 6 mit Festdatensätzen (Grevenbroich, Neuss,
  Münster, Duisburg, Düsseldorf, Essen), zusammen 15 von 396; bei „veranstaltungen“ nur 2 von 5
  Ergebnisseiten gelesen, die Zahl ist eine Untergrenze. Aktueller Festbezug nur Grevenbroich.
* **Stadt Köln** (`events-od.php`, dl-zero-de/2.0): `ndays=365` liefert 411 Termine bis
  09.10.2027, Felder u. a. `stadtbezirk`, `stadtteil`, `latitude`, `longitude`. Kein Veedelsfest,
  keine Kirmes, kein Schützenfest, kein Weihnachtsmarkt; nächster Treffer „Waldweihnacht“ in Eil.
  offenedaten-koeln.de hat keine Brauchtumsdaten.
* **Schützenverbände:** BHDS (https://www.bund-bruderschaften.de/ , Eigenangabe 1.250
  Mitgliedsbruderschaften) nennt nur Bundesveranstaltungen; WSB-Seite „Schützenfeste 2026“ ist
  leer; Sauerländer Schützenbund verlinkt Kreisseiten von 2018; Rheinischer Schützenbund ohne
  Festliste. Höchstens Lückenliste „welcher Ort hat ein Schützenfest“.
* **Regionalportale:** Sauerland (`sauerland.com`) bettet destination.one ein (Experience
  `sauerland`), Teutoburger Wald laut Indiz ebenfalls, Eifel Tourismus nutzt Deskline (Liste nur
  per JavaScript). Ein Merkblatt der Stadt Lünen zum Data Hub NRW sagt, lokale Veranstaltungen
  würden „nur auf der Homepage der Stadt Lünen ausgespielt“
  (https://www.luenen.de/de-wAssets/docs/PDFs/tourismus/Erlaeuterung_DatenHub_CC_Lizenzen.pdf).
  Die Kreiskalender Höxter (regiogate) und Lippe (Weblication) führen nur Verwaltungstermine.
* **Kommunale IT-Dienstleister:** Belegt ist nur, dass krz Lemgo die iKISS-Seite von Petershagen
  hostet (https://www.petershagen.de/Kurzmen%C3%BC/Impressum/). Aachen hat ionas mit geplantem
  Hosting bei regio iT (Ratsunterlage laut Websuche, nicht selbst gelesen). Für citeq,
  Südwestfalen-IT, KDN, ITK Rheinland, Civitec, GKD ist kein Website-CMS-Angebot belegt. Im
  krz-Gebiet laufen verschiedene Systeme (Schlangen Weblication, Barntrup active-City, Petershagen
  iKISS); ein Dienstleister heißt also nicht ein CMS.

## Dorffest-Test

Gezählt ist ein datiertes Fest der Arten aus der Spec (dazu Martinszug und Martinsmarkt, die in
NRW Ende Oktober das häufigste Ortsteilfest sind) in der Hauptquelle der Gemeinde.

* **Stichprobe:** bestanden 19 von 30: Sonsbeck, Schlangen, Wachtendonk, Langenberg, Rheurdt,
  Legden, Heek, Titz, Vettweiß, Horstmar, Blankenheim (redaktionelle Advent-Seite der Gemeinde:
  Weihnachtsmärkte Ripsdorf und Dollendorf 21.11.2026,
  https://www.blankenheim.de/de/freizeit/events/gemeinde-blankenheim-im-advent), Barntrup,
  Heimbach, Medebach, Schöppingen, Wettringen, Everswinkel, Marienmünster, Nettersheim. Nicht
  bestanden 7: Erndtebrück, Altenbeken, Tecklenburg, Hopsten, Inden, Metelen, Dahlem; Breckerfeld
  nur undatiert („Junggesellen-Schützenfest und Jakobuskirmes im Juli“). Nicht prüfbar 3:
  Saerbeck, Schieder-Schwalenberg, Beelen.
* **Mit destination.one zusätzlich:** Dahlem („Weihnachtsmarkt Kronenburg“ 27.11.2026, ID
  100502395), Hopsten („Weihnachtsmarkt in Schale“, ID 101376212), Saerbeck („Saerbecker
  Adventsmarkt“, ID 100721605), Altenbeken („Garagen-Weihnachtsmarkt | Dorfmarkt“, ID 100938666):
  23 von 30.
* **Ergänzung:** bestanden 7 von 10 (Jüchen, Bedburg-Hau, Niederkrüchten, Meschede „Martinsmarkt“
  Eversberg, Emsdetten knapp mit „125 Jahre Lehmkuhler Schützengesellschaft“ 11.06.2027, Havixbeck,
  Wegberg); Hückelhoven nur städtisch; Willich und Holzwickede nicht bestanden.
* **Saisoneffekt:** Am Stichtag dominieren Martinszüge und Advents- und Weihnachtsmärkte.
  Schützenfeste und Kirmessen 2027 stehen erst teilweise drin (Jüchen 6 Schützenfeste 2027,
  Niederkrüchten 4); im Sommer 2026 standen sie in den Rückblicken (Wegberg, Sonsbeck „Schützenfest
  Labbeck“ 19.09.2025). Ein Test im Frühjahr würde mehr Schützenfeste zeigen.

## Abgleich destination.one

Abfrage `https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=50&q=city:"<Name>"&startdate=10/29/2026&enddate=10/28/2027`
(Name ohne Zusätze wie „, Stadt“). Ohne Ortsfilter 35.635 Events, mit `q=area:"Nordrhein-Westfalen"`
7.159.

* **Stichprobe:** 18 von 30 mit mindestens einem Treffer (Sonsbeck 2, Wachtendonk 3, Erndtebrück 1,
  Saerbeck 32, Legden 2, Altenbeken 1, Heek 3, Blankenheim 38, Tecklenburg 69, Hopsten 2,
  Schieder-Schwalenberg 4, Heimbach 54, Medebach 13, Schöppingen 1, Wettringen 12 (ohne einen Treffer
  in Wettringen, Bayern), Dahlem 17, Everswinkel 9, Nettersheim 52). Außer dem Wettringer Treffer
  liegen alle per PLZ in NRW. In der Eifel stehen Termine doppelt (Quelle `destination.one` und
  `DataCycleProxy`), die Zahlen sind Treffer, nicht verschiedene Events. **Ergänzung:** 7 von 10
  (Willich 2, Bedburg-Hau 1, Niederkrüchten 1, Meschede 65, Emsdetten 64, Havixbeck 2, Hückelhoven 2).
* **Dorffeste darin:** 11 der 18 Orte haben einen Festtitel, meist Weihnachtsmärkte. Heimbach
  führt sechs Martinszüge in sechs Ortsteilen („St. Martin in Blens“, „… in Vlatten“, „… in
  Hasenfeld“ u. a., IDs 101382487 bis 101382503), Blankenheim „Kirmes in Ripsdorf“ (ID 100926663)
  und „St. Martinszug in Ripsdorf“. Die Ortsteil-Abdeckung der Eifel ist eine Ausnahme.
* **Festarten im Titel**, `q=area:"Nordrhein-Westfalen" AND title:<Wort>`, gleiches Fenster:

| Titelwort | Events | Titelwort | Events |
|---|---|---|---|
| Weihnachtsmarkt | 207 | Schützenfest | 7 |
| Adventsmarkt | 30 | Kirmes | 5 |
| Martin | 31 | Stadtfest | 4 |
| Krammarkt | 18 | Erntedankfest | 2 |
| Martinsmarkt | 16 | Sommerfest | 1 |
| Nikolausmarkt | 14 | Dorffest, Feuerwehrfest, Heimatfest, Pfarrfest, Maifest, Kirchweih, Volksfest | je 0 |
| Martinszug | 9 | | |

* **Lizenz:** Attribut `license` in den ersten 500 NRW-Treffern: PD (Public Domain Mark) 270,
  CC-BY-SA 211, CC-BY 11, CC0 8. In den Stichprobenorten überwiegt PD; die `DataCycleProxy`-Kopien
  der Eifel tragen CC-BY-SA.
* **Einordnung:** Die Tourismusdaten decken in NRW mehr kleine Gemeinden als in Hessen, aber sie
  führen selten das, was die Gemeindekalender führen: Wachtendonk hat dort 3 Termine, im eigenen
  ionas-Kalender 78; Heek 3 gegenüber 22 in 28 Tagen; Wegberg 0 gegenüber 75. Umgekehrt hat
  Tecklenburg dort 69 Termine bei leerem Gemeindekalender.

## Abdeckung (nur Stichprobenanteile)

Grundgesamtheit der Anteile: die 30 Gemeinden der Stichprobe (unter 10.000 Einwohnern).

* **Kommende Termine aus einer Quelle lesbar, die weder einen Vertrag braucht noch per robots.txt
  gesperrt ist:** Feed oder API 14 (Wachtendonk, Langenberg, Rheurdt, Legden, Heek, Schöppingen,
  Metelen, Horstmar, Sonsbeck sowie die Heimat-Info-Gemeinden Titz, Vettweiß, Inden, Heimbach und
  Dahlem nur vorbehaltlich der Lizenz, siehe unten), Hersteller- oder Regional-HTML 9 (Schlangen,
  Altenbeken, Everswinkel, Barntrup, Marienmünster, Medebach nur Seite 1, Nettersheim, Erndtebrück,
  Wettringen).
  * ohne Heimat-Info: (9 + 9) / 30 = 18 / 30 = 60,0 %
  * mit Heimat-Info nach Lizenz: (14 + 9) / 30 = 23 / 30 = 76,7 %
  * davon Feed oder API: 14 / 30 = 46,7 %
* **Nicht lesbar:** Saerbeck (leere Antworten), Blankenheim und Hopsten (Datenhost per robots
  gesperrt), Breckerfeld (destination.one-Experience außerhalb `open-data`), Tecklenburg (leer),
  Schieder-Schwalenberg, Beelen (robots): 7 / 30 = 23,3 % (Nettersheim und Metelen zählen als
  lesbar).
* **Dorffest in der Hauptquelle:** 19 / 30 = 63,3 %; mit destination.one 23 / 30 = 76,7 %.
* **destination.one mit mindestens einem Treffer:** 18 / 30 = 60,0 %; Ergänzung 7 / 10.
* **Zum Vergleich die Vollerhebung NRW (alle 396):** A 98, B 113, C 12, E 96, R 77; erreicht 81 %
  ([01-vollerhebung.md](01-vollerhebung.md) Abschnitt 1). In der Stichprobe stimmt die Zuordnung
  bei 18 von 30, 10 weichen ab, meist zu einem besseren Weg (Feed statt keiner, Regionalportal
  statt leerer Gemeindeseite).

Die Anteile gelten für Gemeinden unter 10.000 Einwohnern, die in NRW nur 2,3 % der Einwohner
stellen. Für die mittleren Gemeinden liefert die Ergänzung 10 Fälle, zu wenig für einen Anteil:
9 von 10 haben einen lesbaren Kalender (Holzwickede keinen), 5 davon mit vielen Vereins- und
Ortsteilfesten.

## Priorisierte Liste für Nordrhein-Westfalen

Reihenfolge nach Datenqualität und Festanteil vor Menge, dann Gemeinden je Integration, dann
Rechtslage. Gemeinden: Vollerhebung NRW (alle 396) und Anteil in der Stichprobe.

| # | Integration | Gemeinden NRW (Beleg) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | ionas TVM `events.json` | 37 ionas laut VE, TVM-Anteil nicht gemessen; Stichprobe 2/30, Ergänzung 2/10 | Ortsteil in `X-LOCALITY`, Kategorie teils, viele Vereinsfeste (Wachtendonk 78, Wegberg 75 kommend) | nicht belegt; Wachtendonk selbst unter dl-zero-de/2.0 auf offenesdatenportal.de | Adapter nach [01-vollerhebung.md](01-vollerhebung.md) Rang 1; `events.json` statt ICS (Personendaten); Kalenderseite eine Ebene unter der VE-URL suchen |
| 2 | NOLIS-iCal | 22 laut VE (Münsterland); Stichprobe 4/30 | `X-ORT`, `X-ORGANIZER` (Schützenvereine), Fenster 28 Tage | nicht belegt | Adapter mit rollierendem 28-Tage-Fenster je Lauf; `GEO` vertauscht oder 0;0, Ort über `X-ORT` und Resolver |
| 3 | Heimat-Info | 22 (Kreis Düren 14 von 15); Stichprobe 6/30 | Vereine als Veranstalter, Ortsteile im Ort; Menge ungleich (2 bis 186) | nur mit Zustimmung WITTICH | in die laufende WITTICH-Anfrage aufnehmen; deckt 5 Gemeinden, deren Websites ClaudeBot sperren |
| 4 | Weblication-HTML | 31 laut VE; Stichprobe 4/30 | Liste einheitlich, iCal je Termin nur teilweise, ein Kalender leer | nicht belegt | Parser für `listEntry*`; createICal nur nutzen, wo es 200 liefert |
| 5 | Evangelische Kalender EKiR + EKvW, `eventtype=7` | oberhalb der Gemeinde; 112 + 554 Fest-Termine | Koordinaten oft, Ortsteile im Ort; viel Gemeindeleben, Personenfelder | Lizenz nicht belegt | Nutzungsanfrage an Vernetzte Kirche um veranstaltungen-ekvw.de erweitern; nur Typ 7 ohne Personenfelder |
| 6 | Datenportal Münsterland | nicht belegt; Stichprobe 2/30 | nicht belegt (Basic-Auth) | CC-BY-SA laut Open.NRW, Anmeldung beim Münsterland e.V. | Zugang anfragen (Ansprechpartner laut Open.NRW-Eintrag); würde Gemeinden ohne eigenen Kalender im Münsterland schließen |
| 7 | active-City-HTML | 12 laut VE; Stichprobe 2/30 | HTML einheitlich, `Crawl-delay` 30 bis 300 | nicht belegt | Parser für SEO-Pfade; Crawl-delay einhalten, Saerbeck erneut prüfen |
| 8 | Allgemeiner Parser plus Registry (Stufe E) | 96 laut VE, dazu Drupal-Familie `mNNN_www_theme` | Jüchen, Niederkrüchten, Bedburg-Hau mit vielen Brauchtumsterminen, ohne Feed | Gemeinde-Websites | Kalender-URL je Gemeinde aus der VE nachpflegen (Abweichungen oben); Drupal-Merkmal zählen |
| 9 | iKISS-HTML | 27 laut VE (Siegen-Wittgenstein, Olpe, Höxter); Stichprobe 0/30 | siehe [00-bundesweit.md](00-bundesweit.md) C3 | `/output/` per robots gesperrt | mit dem bundesweiten iKISS-Adapter |
| 10 | destination.one `open-data` | 18/30 mit Treffer | Weihnachtsmärkte, Eifel mit Ortsteil-Martinszügen; kaum Schützenfeste | PD, CC-BY-SA je Eintrag | ohnehin bundesweit; Lizenzattribut je Eintrag übernehmen |
| 11 | termine-wittgenstein.de | 3 | Rubrik „Fest“ mit Dorf-Weihnachtsmärkten | Betreiber nicht belegt | ein kleiner Adapter, vorher Betreiber und Rechte klären |
| 12 | Grevenbroich Open Data | 1 | Festliste mit Koordinaten, ein Jahr Vorlauf | CC0, aber `/api/` per robots gesperrt | Rhein-Kreis Neuss fragen, ob maschineller Abruf offener Daten gemeint ist (Kontakt laut Neuss-Datensatz opendata@stadt.neuss.de) |
| | Nicht weiter verfolgen | | | | Schützenverbände, fotho.de (nur Lückenliste), Köln Open Data für Feste, Open.NRW als Sammelquelle, IT-Dienstleister, katholische Bistümer |

## Lücken

* **Gesperrte Gemeinde-Websites:** 7 von 30 Stichprobengemeinden (Titz, Vettweiß, Inden, Heimbach,
  Dahlem sperren ClaudeBot, Claude-Web und anthropic-ai; Schieder-Schwalenberg und Beelen alle
  Bots); Vollerhebung NRW: 23 Gemeinden mit `robots`. Ob die Sperrlisten der fünf Rheinland-Seiten
  auch einen eigenen Crawler von lasstreffen.de träfen, hängt an dessen User-Agent und ist für den
  späteren Betrieb je Seite zu prüfen, nicht zu umgehen.
* **Großstädte ohne Gemeindekalender:** Die Vollerhebung führt Köln, Düsseldorf, Münster,
  Bielefeld, Solingen, Moers, Wuppertal, Remscheid im Rest. Ihre Stadtteilfeste stehen weder im
  Kölner Open-Data-Kalender noch in den Tourismusdaten; offen ist, wo sie veröffentlicht werden
  (Stadtbezirke, Lokalzeitungen, Brauchtumsvereine). Nicht recherchiert.
* **Schützenfeste im Sommer:** Am Stichtag nur teilweise eingetragen; die Verbände führen keine
  Kalender. Eine Wiederholung des Dorffest-Tests im April 2027 würde zeigen, wie viele die
  Gemeindekalender tragen.
* **Lizenzen:** Für ionas, NOLIS, Weblication, active-City und die Kirchenkalender keine
  Nutzungsbedingungen belegt.
* **Nicht gemessen:** TVM-Anteil der 37 ionas-Gemeinden; Zahl der Gemeinden im Datenportal
  Münsterland; Verbreitung der Drupal-Familie `mNNN_www_theme`; Anbieter der Gemeinde-Apps
  (Langenberg-App von Lokalpioniere laut App-ID, HopstenApp nicht belegt).
* **Amtsblätter:** in NRW eigene PDF-Reihen der Gemeinden, ein Verlagsfund (Rautenberg). Kein
  Verlag mit strukturierten Terminen gefunden; Rautenberg nicht weiter geprüft.

## Was der User selbst tun muss

1. WITTICH-Anfrage (läuft) ausdrücklich auf Heimat-Info in NRW beziehen (22 Kommunen im Rheinland).
2. Münsterland e.V.: Zugang zur API des Datenportals Münsterland und Nutzungsbedingungen.
3. Vernetzte Kirche: Nutzungsrechte für termine.ekir.de und veranstaltungen-ekvw.de.
4. Rhein-Kreis Neuss: Klärung der robots-Sperre für `/api/` bei offenen Daten (Grevenbroich CC0,
   Neuss CC BY 4.0).

## Anfragen

Alle Anfragen mit HTTP-Status, Websuchen und die sechs Abrufe gesperrter Pfade:
[11-nordrhein-westfalen-anfragen.md](11-nordrhein-westfalen-anfragen.md). Keine Mails, keine
Formulare, keine Konten.
