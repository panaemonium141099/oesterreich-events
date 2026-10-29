# Niedersachsen: Gemeindekalender und Dorffeste (Stand 2026-10-29)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.6`. Gesucht ist, wo kleine Gemeinden
in Niedersachsen ihre Dorffeste, Feuerwehrfeste, Schützenfeste, Erntefeste, Osterfeuer,
Laternenumzüge und Weihnachtsmärkte veröffentlichen und welche Integrationen viele davon
auf einmal liefern. Baut auf dem Querschnitt [00-bundesweit.md](00-bundesweit.md) (NOLIS
C2, Erkennungsregeln D5) und der Vollerhebung [01-vollerhebung.md](01-vollerhebung.md) auf.

Arbeitsweise: nur lesende GET-Anfragen, robots.txt vorher gelesen, keine Konten, keine
Formulare, keine Mails. Abrufe am 27.10.2026 (Stichprobe) und 29.10.2026 (Nachprüfung,
NOLIS-Pool). Alle Anfragen mit Status: [05-niedersachsen-anfragen.md](05-niedersachsen-anfragen.md).
„Nicht belegt“ heißt: nicht geprüft oder ohne Quelle.

## Kurzfazit

1. **Technik ist in Niedersachsen fast überall da, Inhalt nur bei knapp der Hälfte.** Die
   Vollerhebung zählt für NI 91 % „erreicht“ (technisch lesbarer Kalender). In der
   Zufallsstichprobe (30 Gemeinden unter 10.000 Einwohnern) stehen nur bei 14 von 30
   (46,7 %) Termine genau dieser Gemeinde in einem Gemeinde-, Samtgemeinde- oder
   destination.one-Kalender; ein typisches Fest mit Datum steht dort bei 9 von 30 (30 %).
   Bei 8 von 30 (26,7 %) ist online gar kein datierter Termin der Gemeinde zu finden.
2. **NOLIS ist der Landes-Generic, aber jede zweite NOLIS-Seite hat einen leeren Kalender.**
   10 der 30 Gemeinden liegen auf einer NOLIS-Website (eigene oder der Samtgemeinde), aber
   nur bei 5 davon stehen Termine der Gemeinde im NOLIS-Kalender. Rodenberg hat kein
   Veranstaltungsmodul, Elbtalaue zeigt statt NOLIS ein infomax-Widget, Oldendorf-Himmelpforten
   liefert 0 Treffer für 365 Tage.
3. **NOLIS liefert regionale Pools in einem Feed.** Der iCal-Export mit
   `selected_kommune=0` gab am 29.10.2026 auf sg-mittelweser.de 473 Termine aus 17
   Kommunen (Landkreise Nienburg, Diepholz, Verden, dazu Minden und Petershagen in NRW),
   darunter 15 Laternenumzüge, Laternenfeste und Basare von Feuerwehren und Vereinen. Ein
   Feed je Pool statt je Kommune ist damit belegt (Abschnitt C1).
4. **Samtgemeinden bündeln selten.** Von 20 Samtgemeinden der Stichprobe führen 4 die
   Termine ihrer Mitgliedsgemeinden wirklich (Radolfshausen, Grafschaft Hoya, Tarmstedt,
   Nordkehdingen), 4 teilweise, 12 nicht oder mit leerem Kalender. Einheitsgemeinden sind
   besser: alle 4 haben eigene Kalender mit Ortsteil- und Vereinsterminen.
5. **destination.one (TMN Niedersachsen Hub) deckt kleine Gemeinden kaum.** 8 von 30
   Gemeinden haben im Fenster 28.10.2026 bis 27.10.2027 mindestens einen Treffer in
   `experience=open-data`, ein Fest nur 1 von 30 (Weihnachtsmarkt Oederquart). Der Grund
   ist auch die Lizenz: Laut TMN waren im Februar 2025 nur 42 % der Hub-Veranstaltungen Open
   Data; das „Schützenfest in Börgermoor“ (Surwold) steht in destination.one, aber nicht in
   `open-data`.
6. **Schützen- und Feuerwehrfeste stehen oft nur beim Verein.** Bei 5 von 30 Gemeinden kam
   der einzige Festbeleg von einer Vereinsseite (Feuerwehr, Schützenverein,
   Dorfgemeinschaft), ohne gemeinsame Plattform.

## Stichprobe

**Ziehung (reproduzierbar):** Destatis Gemeindeverzeichnis-Auszug, Stichtag 30.09.2026
(`AuszugGV3QAktuell.xlsx`, Blatt `Onlineprodukt_Gemeinden30092026`). Filter: Land `03`,
Satzart `60`, Textkennzeichen `61`, `63` oder `64` (Gemeinden; ohne gemeindefreie Gebiete
`65`/`66`), Bevölkerung 31.12.2025 unter 10.000. Ergebnis 734 Gemeinden, sortiert nach ARS,
gezogen mit Python `random.Random(280603).sample(liste, 30)`. Die Datei enthält 939
Gemeinden plus 2 bewohnte gemeindefreie Bezirke (Lohheide, Osterheide), zusammen die 941
aus dem Epic. Samtgemeinde laut Satzart `50`, Textkennzeichen `52`. 26 der 30 Gemeinden
gehören zu einer Samtgemeinde (SG), 4 sind Einheitsgemeinden.

Fundort-Klasse = Hauptfundort für Termine dieser Gemeinde. d.one = Treffer in
`experience=open-data` mit `q=city:"<Gemeinde>"`, Fenster 28.10.2026 bis 27.10.2027
(Methode Abschnitt E). „Voll“ = Klassifikation der Vollerhebung (Spalte `integration`,
bei Stufe V `vb_integration`).

| Gemeinde | AGS | EW | SG | Fundort | Link | CMS Gemeinde / SG | d.one | Voll |
|---|---|---|---|---|---|---|---|---|
| Brome, Flecken | 03151005 | 3.095 | Brome | Tourismusdatenbank (nur Museum Burg Brome; Gemeinde verlinkt SG-Kalender, dort kein Brome-Termin) | https://www.samtgemeinde-brome.de/freizeit-kultur/veranstaltungen/ | WordPress / WordPress, eigene Liste | 2 | js_oder_feed |
| Parsau | 03151021 | 1.934 | Brome | Gemeinde-Website, nur Meldungen und Rückblicke | https://www.parsau.de/veranstaltungen/ | CMS nicht erkannt / WordPress | 0 | html_generic |
| Ebergötzen | 03159011 | 1.973 | Radolfshausen | SG-Kalender | https://www.radolfshausen.de/tourismus-freizeit/veranstaltungskalender/ | WordPress ohne Kalender / NOLIS 25570 | 1 | html_generic |
| Hassel (Weser) | 03256010 | 1.764 | Grafschaft Hoya | SG-Kalender | https://www.grafschaft-hoya.de/freizeit-tourismus/veranstaltungen/ | keine / NOLIS 21520 | 0 | V nolis |
| Hoya, Stadt | 03256014 | 3.837 | Grafschaft Hoya | SG-Kalender | wie Hassel | keine / NOLIS 21520 | 2 | nolis |
| Apelern | 03257002 | 2.403 | Rodenberg | Verein (FF Apelern) | https://www.feuerwehr-apelern.de/ | SG-Unterseite / NOLIS ohne Kalender | 0 | nolis |
| Hülsede | 03257017 | 1.016 | Rodenberg | nirgends | (SG-Unterseite) | SG-Unterseite / NOLIS ohne Kalender | 0 | nolis |
| Pohle | 03257029 | 831 | Rodenberg | Verein (FF Pohle, nur Einsatzbericht) | http://www.freiwillige-feuerwehr-pohle.de/ | SG-Unterseite / NOLIS ohne Kalender | 0 | nolis |
| Belum | 03352004 | 791 | Land Hadeln | nirgends | (SG-Kalender ohne Belum) | SG-Unterseite / TYPO3 :seeyou | 0 | html_generic |
| Otterndorf, Stadt | 03352046 | 7.690 | Land Hadeln | Gemeinde-Website (TMN-TYPO3, Daten destination.one) | https://www.otterndorf.de/dein-otterndorf/veranstaltungen/veranstaltungskalender | TMN-TYPO3 / TYPO3 :seeyou | 47 | html_generic |
| Gusborn | 03354008 | 1.210 | Elbtalaue | nirgends | (SG-Portrait ohne Termine) | keine / NOLIS leer, infomax-Widget | 0 | nolis |
| Betzendorf | 03355008 | 1.093 | Amelinghausen | Verein (Schützenverein) | https://schuetzenverein-betzendorf.de/ | SG-Unterseite / TMN-TYPO3, destination.one | 0 | destinationone |
| Bothel | 03357006 | 2.390 | Bothel | nirgends | (SG nur Jahres-PDFs anderer Mitgliedsgemeinden) | SG-Unterseite / Contao | 0 | R kein_link |
| Hepstedt | 03357026 | 991 | Tarmstedt | Gemeinde-Website, dazu SG-Kalender | http://www.hepstedt.de/termine.html | WebSite X5 / Contao | 2 | contao_events |
| Oederquart | 03359035 | 909 | Nordkehdingen | SG-Kalender | https://www.nordkehdingen.de/veranstaltungen/index.php | keine / verwaltungsportal.de | 1 | verwaltungsportal |
| Engelschoff | 03359015 | 754 | Oldendorf-Himmelpforten | Gemeinde-Website | https://www.engelschoff.de/termine/ | IONOS MyWebsite / NOLIS leer | 0 | V nolis |
| Oetzen | 03360015 | 1.108 | Rosche | Verein (Dorfgemeinschaft Stöcken) | http://dorfgemeinschaft-stoecken.de/events/categories/freiwillige-feuerwehr-stoecken/ | keine / Neos, imx-Widget | 0 | R leer |
| Schwienau | 03360019 | 662 | Bevensen-Ebstorf | nirgends | (nur festivalsindeutschland.de) | keine / contentXXL, infomax-Widget | 0 | contentxxl |
| Marienhafe, Flecken | 03452017 | 2.464 | Brookmerland | Verein (IG Marienhafe) | https://www.ig-marienhafe.de/ | keine / verwaltungsportal.de, destination.one | 0 | verwaltungsportal |
| Lütetsburg | 03452016 | 720 | Hage | Tourismusdatenbank (ohne Fest) | https://pages.et4.de/de/sg-hage/default/search/Event/view:list/sort:chronological/mode:next_months,3/calView:agendaWeek | keine / ionas, destination.one | 1 | js_oder_feed |
| Molbergen | 03453012 | 9.363 | Einheitsgemeinde | Gemeinde-Website | https://www.molbergen.de/regional/veranstaltungen/sucheplus2.html | NOLIS 31160 | 0 | nolis |
| Niederlangen | 03454039 | 1.319 | Lathen | nirgends | (SG-App meinLathen ohne Niederlangen) | keine / WordPress, destination.one, GoodBarber-App | 0 | destinationone |
| Surwold | 03454051 | 4.331 | Nordhümmling | Tourismusdatenbank (destination.one über emsland.com) | https://www.emsland.com/event/schuetzenfest-in-boergermoor | WordPress (bettet et4 ein) / WordPress, destination.one | 0 | tribe |
| Getelo | 03456006 | 494 | Uelsen | nirgends | (SG-Kalender ohne Getelo) | keine / ionas, destination.one | 0 | R kein_link |
| Filsum | 03457008 | 2.215 | Jümme | nirgends | (SG-Kalender leer) | leitet auf SG / TYPO3 calendarize | 0 | calendarize |
| Nortmoor | 03457016 | 1.741 | Jümme | Gemeinde-App (Inhalt nicht prüfbar) | https://nortmoor.orts.app/events | Orts.App / TYPO3 calendarize | 0 | calendarize |
| Harpstedt, Flecken | 03458008 | 4.781 | Harpstedt | Tourismusdatenbank (verlinkt) | https://pages.destination.one/de/wildegeest/portal/search/Event/mode:next_months,3/sort:chronological/view:gallery | SG-Unterseite / Joomla | 0 | destinationone |
| Glandorf | 03459034 | 6.500 | Einheitsgemeinde | Gemeinde-Website | https://www.glandorf.de/glandorf-bewegt/veranstaltungskalender | Joomla JEvents | 8 | jevents |
| Bakum | 03460001 | 6.905 | Einheitsgemeinde | Gemeinde-Website | https://www.bakum.de/leben-in-bakum/aktuelles-termine/ | REDAXO | 0 | html_generic |
| Ovelgönne | 03461008 | 5.446 | Einheitsgemeinde | Gemeinde-Website | https://www.ovelgoenne.de/kultur-freizeit/veranstaltungskalender/ | NOLIS 39720 | 0 | nolis |

Fundorte: Gemeinde-Website 8 (davon Parsau nur Meldungen), SG-Kalender 4, Verein 5,
Tourismusdatenbank 4, Gemeinde-App 1, nirgends 8. Amtsblatt oder Mitteilungsblatt war bei
keiner Gemeinde der Hauptfundort.

**Abweichungen zur Vollerhebung** (Stichprobe nachgeprüft): Rodenberg (3 Gemeinden),
Elbtalaue und Oldendorf-Himmelpforten stehen dort als NOLIS, haben aber keinen oder einen
leeren NOLIS-Kalender. Surwold steht als The Events Calendar; die Startseite trägt
`tribe-events`-Klassen, aber `/wp-json/tribe/events/v1/events` antwortet 404 und
`/veranstaltungen/?ical=1` liefert HTML statt iCal, der Kalender selbst ist ein
destination.one-Iframe. Lütetsburg ist dort luetetsburg.com, die Seite von Schloss
Lütetsburg, nicht der Gemeinde. Otterndorf steht als Land-Hadeln-HTML, sein eigentlicher
Kalender ist otterndorf.de (destination.one).

### Samtgemeinden und Einheitsgemeinden

| Verwaltung | Kalender | CMS (Merkmal) | Feed | Termine (Zeitraum) | bündelt Mitgliedsgemeinden |
|---|---|---|---|---|---|
| SG Brome | /freizeit-kultur/veranstaltungen/?par=M-JJJJ | WordPress, eigene Liste | nein | Okt 1, Jun 8, Nov 3 (2026), alle Schützengesellschaft Voitze | nein |
| SG Radolfshausen | /tourismus-freizeit/veranstaltungskalender/ | NOLIS 25570 | iCal | 12 (27.10. bis 26.11.2026) | ja (X-ORT Ebergötzen, Seeburg, Landolfshausen, Seulingen) |
| SG Grafschaft Hoya | /freizeit-tourismus/veranstaltungen/ | NOLIS 21520 | iCal | 30 (27.10. bis 26.11.2026) | ja (alle 10 Mitgliedsgemeinden als X-ORT) |
| SG Rodenberg | keiner | NOLIS 28040 | nein | 0 | nein |
| SG Land Hadeln | /freizeit-sport/veranstaltungen-land-hadeln.html | TYPO3 :seeyou `tx_syvin_eventlist` | nein | 51 bis 189 (Seite 6 reicht bis 02.11.2026, Seite 20 leer) | teilweise (Otterndorf ja, Belum nein) |
| SG Elbtalaue | infomax-Widget `hamburgwhl.infomaxnet.de` | NOLIS 38110 (leer) | nein | infomax 26 (27.10. bis 01.11.2026, 20 km um 29451) | nicht belegt |
| SG Amelinghausen | Link auf amelinghausen.de | TMN-TYPO3, destination.one | nein | 12 auf der Seite, regionaler Pool | nein (Betzendorf 0) |
| SG Bothel | /termine/veranstaltungen.html (Jahres-PDFs) | Contao | nein | nicht belegt | teilweise (PDFs für Brockel, Hemsbünde, Hemslingen, Walsede; Bothel fehlt) |
| SG Tarmstedt | /index.php/termine.html | Contao `mod_eventlist` | nein | 288 (27.10.2026 bis Dez. 2027, Monatsmenü) | ja (Hepstedt, Westertimke, Wilstedt, Kirchtimke u. a.) |
| SG Nordkehdingen | /veranstaltungen/index.php | verwaltungsportal.de 20350 | JSON-LD je Termin | 34 (27.10. bis 26.11.2026) | ja |
| SG Oldendorf-Himmelpforten | /die-samtgemeinde/aktuelles/veranstaltungskalender/ | NOLIS 20480 (Kreispool Stade) | nein (Liste leer) | 0 (365 Tage) | nein |
| SG Rosche | /aktuelles/veranstaltungskalender.html | Neos, imx-Widget `hht.whitelabel.imxplatform.de` | nicht belegt | nicht belegt | nicht belegt |
| SG Bevensen-Ebstorf | …/freizeit/veranstaltungskalender.aspx | contentXXL, infomax-Widget | nein | 14 (27.10. bis 02.11.2026) | nein |
| SG Brookmerland | marienhafe.de/veranstaltungen/ | verwaltungsportal.de, destination.one „marienhafe“ | JSON-LD je Termin | 107 Termin-URLs (12 Monate), davon 105 aus zwei Serien | teilweise (Ortsfilter, keine Feste) |
| SG Hage | pages.et4.de/de/sg-hage | ionas, destination.one | iCal per JS | nicht gezählt | nicht belegt |
| SG Lathen | et4 sg-lathen; App meinLathen | WordPress, destination.one, GoodBarber | JSON im HTML (App) | 24 (29.10. bis 14.12.2026) | nein (nur Lathen, Fresenburg) |
| SG Nordhümmling | et4 sg-nordhuemmling | WordPress Divi, destination.one | nicht abgerufen | nicht belegt | nicht belegt |
| SG Uelsen | Iframe pages.et4.de/de/uelsen | ionas, destination.one „uelsen“ | nein | Seite 1: 20 (27.10. bis 06.12.2026) | teilweise (Itterbeck ja, Getelo nein) |
| SG Jümme | /freizeit/veranstaltungen | TYPO3 calendarize | ICS mit 0 VEVENT | 0 | nein |
| SG Harpstedt | Link auf destination.one „wildegeest“ | Joomla | nein | nicht belegt | nicht belegt |
| Gemeinde Molbergen | /regional/veranstaltungen/sucheplus2.html | NOLIS 31160 | iCal je Termin, JSON-LD | 18 (06.11. bis 31.12.2026) | Ortsteile ja (Dwergte, Peheim) |
| Gemeinde Glandorf | /glandorf-bewegt/veranstaltungskalender | Joomla `com_jevents` | RSS (5 Items) | Seite 1: 20 (05.09.2026 bis 12.05.2027) | Ortsteile ja (Schwege, Averfehrden, Sudendorf) |
| Gemeinde Bakum | /leben-in-bakum/aktuelles-termine/ | REDAXO | iCal je Termin als data-URI | 6 im HTML, Rest per JS | Ortsteile ja (Lüsche, Carum) |
| Gemeinde Ovelgönne | /kultur-freizeit/veranstaltungskalender/ | NOLIS 39720 | Listen-iCal | 9 (30.10.2026 bis 19.09.2027) | Ortsteile ja (Großenmeer) |

Zählung SG (20): bündelt ja 4, teilweise 4 (Land Hadeln, Bothel, Brookmerland, Uelsen),
nein oder leer 7 (Brome, Rodenberg, Amelinghausen, Oldendorf-Himmelpforten,
Bevensen-Ebstorf, Lathen, Jümme), nicht belegt 5 (Elbtalaue, Rosche, Hage, Nordhümmling,
Harpstedt; Kalender sind nachgeladene Widgets oder Links auf Tourismusportale).

**Amts- und Mitteilungsblätter:** SG Brome gibt wöchentlich ein Mitteilungsblatt bei LINUS
WITTICH heraus, laut SG mit „Nachrichten der Mitgliedsgemeinden und Vereine“
(https://www.samtgemeinde-brome.de/buerger-info/mitteilungsblatt/ ,
https://www.wittich.de/produkte/zeitungen/5313-mitteilungsblatt-samtgemeinde-brome).
Glandorf: „Mitteilungen aus Glandorf“, MEDIENHOCHBURG GmbH & Co. KG
(https://www.glandorfer-mitteilungen.de/, nicht abgerufen). Land Hadeln: Land Hadeln
Magazin (CNV-Medien). Sonst nur Amtsblätter der Landkreise (Schaumburg, Cuxhaven,
Lüneburg, Wesermarsch) mit amtlichen Bekanntmachungen. Ein aktuelles Heft mit Terminen
wurde nicht ausgewertet. Die Vollerhebung fand für NI 0 meinOrt-Gemeinden.

## Generics

### C1. NOLIS (Landes-Generic)

* **Betreiber:** NOLIS GmbH, Nienburg/Weser (siehe [00-bundesweit.md](00-bundesweit.md) C2).
* **Gemeinden:** Vollerhebung NI: 307 Gemeinden mit NOLIS-Website, 36 weitere über die SG
  (zusammen 343 von 941). Stichprobe: 10 von 30 auf einer NOLIS-Website, davon 5 mit
  Terminen der Gemeinde im NOLIS-Kalender (Ebergötzen, Hassel, Hoya, Molbergen,
  Ovelgönne). Formel: 5 / 30 = 16,7 % der Gemeinden; 5 / 10 = 50 % der NOLIS-Gemeinden.
* **Zugriff:** iCal `/veranstaltungen/veranstaltungen.ical` mit vollem Parametersatz wie im
  Link „vCalendar exportieren“. Neu belegt (29.10.2026, sg-mittelweser.de, Fenster
  29.10. bis 27.11.2026): `selected_kommune=21550` 106 VEVENT (nur SG Mittelweser),
  `selected_kommune=0` **473 VEVENT aus 17 Kommunen**: Stadt Nienburg 135, SG Mittelweser
  106, SG Grafschaft Hoya 32, Flecken Steyerberg 29, SG Heemsen 29, Stadt Syke 25, SG Uchte
  24, Stadt Achim 23, SG Weser-Aue 17, Gemeinde Weyhe 15, Stadt Minden 13, SG Steimbke 12,
  SG Bruchhausen-Vilsen 4, SG Thedinghausen 4, Verden 3, Petershagen 1, Rehburg-Loccum 1.
  `portal_all=1` (Hoya) brachte nichts zusätzlich, `verband=1` einen leeren Body. Die
  Kommune-Auswahl in Oldendorf-Himmelpforten listet alle 11 Kommunen des Landkreises Stade,
  in Elbtalaue Gartow, Lüchow und den Landkreis Lüchow-Dannenberg: Die Pools folgen den
  Landkreisen. Ob jeder Pool per `selected_kommune=0` abrufbar ist, ist nur für
  Mittelweser belegt.
* **Felder (Probe Hoya, Radolfshausen, Ovelgönne, Pool):** `DTSTART`, `DTEND`, `SUMMARY`,
  `DESCRIPTION`, `LOCATION`, `URL`, `CONTACT`, `UID`, `CATEGORIES`, `GEO`,
  `X-GEO-PROJECTION`, `X-ID` (`<KommuneID>_<TerminID>`), `X-KOMMUNE`, `X-KOMMUNE-ID`,
  `X-ORT`, `X-ORT-ID`, `X-ORGANIZER`, `X-ORGANIZER-ID`, `X-SCHLAGWORTE`,
  `X-KURZBESCHREIBUNG`, `X-SERIENCONTAINER`, `X-RESSORT`, `X-NOLISEXPORT`, `PRIORITY`.
  Qualität: im Pool `X-ORT` bei 284 von 473 gesetzt, `GEO` bei 225 von 473 `0;0`; in Hoya
  steht `GEO` als Länge;Breite (`9.137026000;52.810856425`), umgekehrt zu RFC 5545;
  `URL` zeigt auf Veranstalter oder SG, nicht auf den Termin; ganztägige Termine als
  `T220000Z`; Zeiten in UTC. Beispiel (gekürzt):
  ```
  DTSTART:20261107T160000Z
  SUMMARY:31. Laternenfest Feuerwehr Hoya
  LOCATION:Feuerwehrgerätehaus Hoya, Auf dem Kuhkamp 9, 27318 Hoya
  X-ID:21520_915146408
  CATEGORIES:Familienveranstaltungen,Essen / Trinken,Feuerwehr
  X-KOMMUNE:Samtgemeinde Grafschaft Hoya
  X-ORT:Hoya/Weser
  X-ORGANIZER:Freiwillige Feuerwehr Hoya\nAuf dem Kuhkamp 9\n27318 Hoya
  ```
* **Erkennung:** In allen sieben NOLIS-Seiten der Stichprobe steht in `<meta name="author">`
  der Name der Kommune, nicht „NOLIS GmbH“ (Regel 3 in D5 greift so nur über
  `fonts.nol-is.de`, `NOLIS_KERN_UX`, `NOLISManager`). Leerer Kalender: kein
  `NOLIS_Kalenderdates`, kein „vCalendar exportieren“, oder Meldung „keine Veranstaltungen“.
  Die NOLIS-Suchmaske kennt Rubriken wie „Dorf-Feste“, „Schützenfeste / Erntefeste“,
  „Feuerwehr“, „Adventsbasare / Weihnachtsmärkte“ (Oldendorf-Himmelpforten).
* **Lizenz/robots:** robots.txt aller geprüften NOLIS-Seiten identisch, `/regional/` und
  `/veranstaltungen/` frei; Nutzungsbedingungen nicht belegt.
* **Beispiele:** Grafschaft Hoya
  https://www.grafschaft-hoya.de/freizeit-tourismus/veranstaltungen/ ; Ovelgönne
  https://www.ovelgoenne.de/kultur-freizeit/veranstaltungskalender/ ; Molbergen
  https://www.molbergen.de/regional/veranstaltungen/sucheplus2.html (kein Listen-iCal im
  HTML, nur `/veranstaltungen/veranstaltung/<slug>-<id>-31160.ical` und JSON-LD, dort
  `endDate` vor `startDate`).
* **Dorffest-Test:** „31. Laternenfest Feuerwehr Hoya“ 07.11.2026
  https://www.grafschaft-hoya.de/regional/veranstaltungen/31-laternenfest-feuerwehr-hoya-915146408-21520.html ;
  „29. Weihnachtsmarkt“ Molbergen 12./13.12.2026
  https://www.molbergen.de/regional/veranstaltungen/29-weihnachtsmarkt-900000756-31160.html ;
  „Herbstumzug Großenmeer“ 19.09.2027 (Ovelgönne, Listen-iCal); im Mittelweser-Pool
  „Laternenumzug“ in Husum (Veranstalter „Schützenverein und Feuerewehr Groß Varlingen“) und
  Stöckse („Stöckser Vereine“).

### C2. destination.one: TMN Niedersachsen Hub und TMN-TYPO3-Plattform

* **Betreiber:** Daten im Niedersachsen Hub der TourismusMarketing Niedersachsen (TMN):
  „Gemeinsamer Daten-Pool für ganz Niedersachsen“, Open Data für Datensätze mit CC0, CC-BY
  oder CC-BY-SA (TMN-Vortrag 18.02.2025,
  https://arl-we.niedersachsen.de/download/215682/NdsHub_OpenData_C.Foltin_TMN.pdf.pdf).
  Stand 10.02.2025: 8.679 Veranstaltungen, davon 3.684 Open Data (42 %); Stand 26.03.2024:
  13.371, davon 5.330 (40 %) (Unterausschuss Tourismus, Landtag,
  https://www.landtag-niedersachsen.de/parlamentsdokumente/niederschriften_ausschuesse/19_wp/uatourismus/014_UATourismus_04.04.2024_Anlage_1.pdf).
  reiseland-niedersachsen.de lädt die Teaserbilder der Veranstaltungen von
  `img.destination.one`/`dam.destination.one`. Regionale Websites (Südheide Gifhorn,
  Mittelweser, otterndorf.de, amelinghausen.de) laufen auf derselben TYPO3-Installation
  (`/dist/css/<mandant>`, robots.txt mit `/*?data-api=calendar`, `/*?ndsajax`, `*/All/*`).
* **Gemeinden:** `q=area:"Niedersachsen"` in `open-data`: 9.348 Events gesamt, 7.940 im
  Fenster 28.10.2026 bis 27.10.2027 (29.10.2026). Stichprobe: 8 von 30 mit Treffer
  (26,7 %), Fest 1 von 30 (Oederquart, 3,3 %). destination.one im Kalender der Gemeinde oder
  SG eingebunden: 8 von 30 (Otterndorf, Betzendorf, Lütetsburg, Niederlangen, Surwold,
  Marienhafe, Getelo, Harpstedt). Vollerhebung NI: 52 Gemeinden direkt, 10 über die SG.
* **Zugriff:** `meta.et4.de/rest.ashx/search/` mit `experience=open-data` (Syntax
  https://help.destination.one/portal/de/kb/articles/meta-service-search). Die
  Experiences der Samtgemeinden (`sg-hage`, `sg-lathen`, `sg-nordhuemmling`, `uelsen`,
  `wildegeest`, `marienhafe`, `samtgemeinde-amelinghausen`) enthalten auch Datensätze ohne
  offene Lizenz; das „Schützenfest in Börgermoor“ (JSON-LD `addressLocality "Surwold"`,
  `identifier e_100674235`, `author "Sögel Marketing GmbH"`) fehlt in `open-data`
  (`city:"Surwold"` 0 Treffer).
* **Felder (Suche, `ET2014A.json`):** `id`, `title`, `city`, `timeIntervals[].start`, dazu
  Lizenz je Datensatz (`attributes`, siehe `docs/research/deutschland-event-quellen-2026-10.md`).
  `timeIntervals[].start` ist der Serienbeginn (Hoya: „Wochenmarkt Hoya“ ab 2020).
* **Dorffest-Test:** „Weihnachtsmarkt“ Oederquart 05.12.2026, id 101372001
  (https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=10&startdate=10/28/2026&enddate=10/27/2027&q=city%3A%22Oederquart%22);
  „Schützenfest in Börgermoor“ 17. bis 20.07.2027
  https://www.emsland.com/event/schuetzenfest-in-boergermoor ; „Lüttes Altstadtfest“
  Otterndorf 30./31.07.2027
  https://www.otterndorf.de/dein-otterndorf/veranstaltungen/luettes-altstadtfest .
  Festarten im Titel, ganz Niedersachsen, gleiches Fenster: Weihnachtsmarkt 206,
  Laternenumzug 26, Schützenfest 23 (darunter Dersum, Dörpen, Wippingen, Walchum, Lehe
  (Emsland), Heede (Emsland)), Osterfeuer 6,
  Martinsmarkt 3, Dorffest 1, Erntedankfest 1, Feuerwehrfest 0, Erntefest 0, Maifest 0,
  Kirchweih 0, Kartoffelfest 0. Der Filter `area` ist unscharf (ein Treffer aus Ochtrup,
  NRW).
* **Nächster Schritt:** läuft über den bundesweiten destination.one-Import. Für die
  Samtgemeinde-Experiences bei der TMN klären, ob die Regionen Veranstaltungen mit offener
  Lizenz freigeben können (58 % der Hub-Veranstaltungen sind es nicht).

### C3. verwaltungsportal.de

Nordkehdingen und Brookmerland (marienhafe.de), Verein FF Pohle; Stichprobe 2 von 30
Gemeinden; Vollerhebung NI 50 direkt, 3 über die SG. Zugriff und Felder wie
[00-bundesweit.md](00-bundesweit.md) C7. JSON-LD Nordkehdingen: `name`, `description`
(leer), `startDate` (`2026-11-06T19:00:00+0100`), `image`, `location.name`; bei einem
Vereinstermin nur „Samtgemeinde Nordkehdingen“ als Ort. Brookmerland zusätzlich
`address{streetAddress, postalCode, addressLocality, addressCountry}`. Dorffest-Test in NI:
nicht bestanden (Nordkehdingen: Wochenmarkt, Bücherei, Konzert, „Weihnachtsbasar vom
Schützenverein Eichel Wolfsbruch“ ohne Ortszuordnung; Brookmerland: Museum, Skat,
Wattwanderung).

### C4. infomax (imx) Widgets

Elbtalaue (`hamburgwhl.infomaxnet.de`, Token `LRf3Jg4YmSs.`), Bevensen-Ebstorf (gleicher
Mandant, contentXXL), Rosche (`hht.whitelabel.imxplatform.de`, id 135), dazu
wendland-elbe.de. Stichprobe 3 von 30 (Gusborn, Schwienau, Oetzen). Zugriff: JS-Widget,
das ein Iframe lädt; das Objekt `portal.defaults.search` nennt `dateFrom`, `dateTo`,
`zipcodes`, `locationId`, `distance`, `addressId`, `latitude`, `longitude`. Kein Feed
gefunden; robots.txt `Crawl-delay: 5`, gesperrt `/data/`, `/ServiceInterface/`. Betreiber
der Mandanten nicht belegt. Elbtalaue zeigt 20 km um Dannenberg, also kein Gemeindefilter.
Dorffest-Test: nicht möglich (Termine nachgeladen, nicht abgerufen). Gleicher Anbieter wie
beim Tourismusverband MV, siehe [06-mecklenburg-vorpommern.md](06-mecklenburg-vorpommern.md).

### C5. Allgemeine CMS-Kalender (je einmal oder zweimal)

| CMS | Stichprobe | Zugriff | Dorffest-Test |
|---|---|---|---|
| Contao `mod_eventlist` | Tarmstedt (Hepstedt), Bothel (nur PDFs) | HTML, `?month=JJJJMM`, Reader `/index.php/events-leser-samtgemeinde/<alias>.html`; kein Feed | „Laternelaufen in Hepstedt“ 06.11.2026 https://www.tarmstedt.de/index.php/events-leser-samtgemeinde/laternelaufen-in-hepstedt.html (Gemeindeseite nennt 06.12.2026, Widerspruch offen) |
| Joomla JEvents | Glandorf | RSS mit 5 Items; robots.txt sperrt Listenpfade `/*cat*/` | „Weihnachtsmarkt in Averfehrden“ 13.12.2026, Heimatverein, https://www.glandorf.de/glandorf-bewegt/veranstaltungskalender |
| REDAXO | Bakum | HTML, iCal je Termin als data-URI (ZapCalLib), Rest per JS | „Herbstmarkt“ 31.10. bis 02.11.2026, https://www.bakum.de/leben-in-bakum/aktuelles-termine/ |
| IONOS MyWebsite Event-Kalender | Engelschoff | JS von `*.mod.mywebsite-editor.online`, Felder `title`, `desc`, `repetition`, `fromDate`, `fromTime` | „Feuerwehrball Neuland“, jährlich, https://www.engelschoff.de/termine/ |
| TYPO3 :seeyou `tx_syvin_*` | Land Hadeln (2) | HTML, Paging, kein JSON-LD | nicht bestanden |
| TYPO3 calendarize | Jümme (2) | ICS vorhanden, 0 VEVENT | nicht möglich (leer) |
| WordPress eigene Liste | Brome (2) | HTML `?par=M-JJJJ` | „Schützenfest in Voitze“ 19.06.2026, Schützengesellschaft Voitze, https://www.samtgemeinde-brome.de/freizeit-kultur/veranstaltungen/?par=6-2026 |
| WebSite X5 (privat gepflegt) | Hepstedt | Textseite | „Erntefest in Hepstedt“ 26./27.09.2026, Osterfeuer 05.04.2026, Tunnelfest der Feuerwehr 20.06.2026, http://www.hepstedt.de/termine.html |

### C6. Vereinsseiten

Kein Generic: FF Apelern (Joomla), FF Pohle (verwaltungsportal.de), Schützenverein
Betzendorf (WordPress), Dorfgemeinschaft Stöcken (WordPress Events Manager mit offenem
`/events.ics`), IG Marienhafe. Belege: „Osterglühen 2026“ FF Apelern 04.04.2026
https://www.feuerwehr-apelern.de/cms/aktuelles/ostergluehen-2026 ; Schützenfest Betzendorf
28. bis 30.08.2026, Festumzug 30.08.2026 https://schuetzenverein-betzendorf.de/ ;
„Laternenumzug und Zusammentreffen im Grilleck“ Stöcken 23.10.2026 und „125 Jahre Feuerwehr
Oetzen“ 11. bis 13.06.2027
http://dorfgemeinschaft-stoecken.de/events/categories/freiwillige-feuerwehr-stoecken/ ;
„Weinfest Marienhafe“ 07./08.08.2026 https://www.ig-marienhafe.de/ ; Erntefest-Umzug Pohle
05.09.2026 nur als Einsatzbericht
http://www.freiwillige-feuerwehr-pohle.de/einsaetze/ansicht/59422/absicherung-des-erntefest-umzuges.html .
Events Manager ist in der Vollerhebung schon eine A-Integration (53 Gemeinden bundesweit),
Vereinsseiten erfasst sie aber nicht.

### C7. Gemeinde-Apps und Dorfplattformen

Orts.App (Nortmoor `nortmoor.orts.app`, „Allesamt“ Oldendorf-Himmelpforten; robots.txt
sperrt `/app/` und KI-Crawler; Betreiber nicht belegt), meinLathen (GoodBarber, Termine als
JSON im HTML mit `date`, `endDate`, `address`, `latitude`, `longitude`; robots.txt sperrt
`/apiv3/`, `/apiv4/`; Niederlangen 0 von 24), Samtgemeinde-Apps Radolfshausen und
Nordhümmling (Anbieter nicht belegt), StadtLandNews (SG Hage seit 07/2024; API
https://niedersachsen.stadtlandnews.com/wp-json/tribe/events/v1/events für Lütetsburg 0
Treffer). Keiner davon ist ein Generic für NI.

## Dorffest-Test, Übersicht

| Quelle | Beispiel | Datum | Gemeinde |
|---|---|---|---|
| NOLIS-iCal | 31. Laternenfest Feuerwehr Hoya | 07.11.2026 | Hoya |
| NOLIS | 29. Weihnachtsmarkt | 12./13.12.2026 | Molbergen |
| NOLIS-iCal | Weihnachtsmarkt Ovelgönne; Herbstumzug Großenmeer | 13.12.2026; 19.09.2027 | Ovelgönne |
| destination.one open-data | Weihnachtsmarkt | 05.12.2026 | Oederquart |
| destination.one (emsland.com) | Schützenfest in Börgermoor | 17. bis 20.07.2027 | Surwold |
| TMN-TYPO3 (destination.one) | Lüttes Altstadtfest | 30./31.07.2027 | Otterndorf |
| Contao SG-Kalender | Laternelaufen in Hepstedt | 06.11.2026 | Hepstedt |
| Gemeinde-Website | Erntefest in Hepstedt | 26./27.09.2026 | Hepstedt |
| JEvents | Weihnachtsmarkt in Averfehrden | 13.12.2026 | Glandorf |
| REDAXO | Herbstmarkt | 31.10. bis 02.11.2026 | Bakum |
| IONOS | Feuerwehrball Neuland | jährlich | Engelschoff |
| Verein | Osterglühen FF Apelern; Schützenfest Betzendorf; Laternenumzug Stöcken; Weinfest Marienhafe | siehe C6 | Apelern, Betzendorf, Oetzen, Marienhafe |
| verwaltungsportal.de | nicht bestanden | | |
| infomax | nicht möglich | | |

Nur auf festivalsindeutschland.de (Lückenliste, siehe 00 F): Schützenfest Brome
(Jägerausmarsch 21.06.2026), Schützenfest Melzingen (Schwienau, 27.06.2026), Schiebenscheeten
Harpstedt (25. bis 30.05.2026) und Weihnachtsmarkt Harpstedt (05./06.12.2026), Schützenfest
Hoya (02. bis 04.07.2026). Parsau berichtet auf der eigenen Seite nur rückblickend
(„Gelungenes Kinderfest 2026“ im Rahmen des Schützenfestes).

## E. Abgleich destination.one

`https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=10&startdate=10/28/2026&enddate=10/27/2027&q=city:"<Gemeinde>"`,
29.10.2026, 4 s Pause je Anfrage. Ortsteile (Börgermoor, Voitze, Großenmeer) zählen nicht
mit, der Wert ist eine Untergrenze.

| Gemeinde | Treffer | Titel (Auswahl) |
|---|---|---|
| Otterndorf | 47 | 18. Otterndorfer Sternenmarkt (11.12.2026), Halloween Gruselspaziergang, Kreativ- und Handwerksmarkt |
| Glandorf | 8 | Kabarett, Wochenmarkt, Adventsmarkt im Haus Wibbelsmann (07.12.2025, vergangen) |
| Brome | 2 | Julfest (19.12.2026), Nachts im Museum Burg Brome |
| Hoya | 2 | Wochenmarkt Hoya, „Grafschaft Hoya ist mobil“ (Serien) |
| Hepstedt | 2 | Pilzseminar, Ummellauf |
| Ebergötzen | 1 | Buchvorstellung |
| Oederquart | 1 | Weihnachtsmarkt (05.12.2026) |
| Lütetsburg | 1 | Lütetsburger Wildfleischverkauf (Serie) |
| übrige 22 | 0 | |

Ergebnis: 8 / 30 = 26,7 % mit Treffer, Fest 1 / 30 = 3,3 % (mit dem Otterndorfer
Sternenmarkt 2 / 30). Zum Vergleich der Querschnitt: 5 von 20 nach Quellenfund gewählten
Gemeinden.

## Abdeckung (nur Stichprobenanteile)

| Kennzahl | Gemeinden | Formel | Anteil |
|---|---|---|---|
| online kein datierter Termin der Gemeinde | Hülsede, Belum, Gusborn, Bothel, Schwienau, Niederlangen, Getelo, Filsum | 8 / 30 | 26,7 % |
| Termine der Gemeinde in Gemeinde- oder SG-Kalender | Ebergötzen, Hassel, Hoya, Otterndorf, Hepstedt, Oederquart, Marienhafe, Engelschoff, Molbergen, Glandorf, Bakum, Ovelgönne | 12 / 30 | 40,0 % |
| dazu nur destination.one open-data | Brome, Lütetsburg | (12 + 2) / 30 | 46,7 % |
| typisches Fest mit Datum in Gemeinde-, SG- oder destination.one-Kalender | Hoya, Otterndorf, Hepstedt, Oederquart, Engelschoff, Molbergen, Glandorf, Bakum, Ovelgönne | 9 / 30 | 30,0 % |
| Fest nur auf Vereinsseite | Apelern, Pohle, Betzendorf, Oetzen, Marienhafe | 5 / 30 | 16,7 % |
| Fest nur in Tourismusdatenbank außerhalb open-data | Surwold | 1 / 30 | 3,3 % |
| Gemeinde mit Terminen im NOLIS-Kalender | Ebergötzen, Hassel, Hoya, Molbergen, Ovelgönne | 5 / 30 | 16,7 % |
| SG bündelt Mitgliedsgemeinden (ja) | Radolfshausen, Grafschaft Hoya, Tarmstedt, Nordkehdingen | 4 / 20 | 20,0 % |

Ein Fest mit Datum fand sich insgesamt bei 15 von 30 Gemeinden (50 %), wenn Vereinsseiten
und Tourismusdatenbank mitzählen. 30 Gemeinden sind eine kleine Stichprobe; die Anteile
zeigen die Größenordnung, keine Landeswerte.

## Priorisierte Integrationsliste Niedersachsen

| # | Integration | Gemeinden (Beleg) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | NOLIS-iCal je Pool (`selected_kommune=0`) | 343 laut Vollerhebung; Stichprobe 5 / 30 mit Inhalt; Pool Mittelweser 17 Kommunen, 473 Termine | Kommune, Ort, Veranstalter, Kategorien; GEO lückenhaft und teils vertauscht | robots frei, Nutzungsbedingungen nicht belegt | Pools je Landkreis kartieren (eine NOLIS-Seite je Kreis, Feed mit `selected_kommune=0`), Dedup über `X-ID`; NOLIS nach Nutzung und Pool-Liste fragen (Anfrage aus 00 H) |
| 2 | destination.one open-data | 9.348 Events NI; Stichprobe 8 / 30 | strukturiert, Lizenz je Datensatz | CC0 je Datensatz in open-data | über den bundesweiten Import; TMN nach Freigabe der übrigen 58 % fragen (Schützenfeste Emsland) |
| 3 | Contao, JEvents, calendarize, verwaltungsportal.de (Vollerhebung-Adapter) | je 1 bis 2 von 30 | HTML/RSS/JSON-LD | Gemeinde-Websites | Adapter aus 01 Abschnitt 2 nutzen, nichts NI-spezifisches |
| 4 | Allgemeiner HTML-Parser für Einheitsgemeinden | Bakum, Engelschoff, Hepstedt | gemischt, teils JS | Gemeinde-Websites | Registry mit Kalender-URL (wie AT `GemeindeRegistryScraper`) |
| 5 | infomax/imx | 3 / 30 | Umkreis statt Gemeinde | nicht belegt | zusammen mit der MV-Anfrage beim Tourismusverband klären |
| 6 | Vereinsseiten | 5 / 30 nur dort | einzeln | einzeln | kein Generic; Events-Manager-iCal über Plugin-Detektor, Rest nur als Lückenliste |
| | Nicht weiter | | | | StadtLandNews (0 in der Stichprobe), Orts.App (robots sperrt KI), meinLathen, Mitteilungsblätter (nur Brome bei WITTICH, PDF) |

**Lücken:** 8 von 30 Gemeinden ohne online datierten Termin; Schützenfeste stehen vor allem
bei Vereinen und auf festivalsindeutschland.de; Kalender leerer NOLIS-Seiten (Rodenberg,
Oldendorf-Himmelpforten, Elbtalaue) könnten im Kreispool eines Nachbarn stehen, das ist
nicht geprüft. Nicht belegt: Inhalte der infomax- und imx-Widgets, Mitteilungsblatt
Radolfshausen, Schaumburger Land Tourismus (Anubis-Botschranke, nicht umgangen).

## Liste der Anfragen

Vollständig in [05-niedersachsen-anfragen.md](05-niedersachsen-anfragen.md): vier
Teilrecherchen (Gruppen A bis D, 41 + 67 + 80 + 44 GET, dazu Websuchen) und die
Abrufe der Hauptsession (Destatis, meta.et4.de 44, TMN-PDFs, reiseland-niedersachsen.de,
Nachprüfung vier Gemeinden, NOLIS-Pool).
