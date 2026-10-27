# Mecklenburg-Vorpommern: Gemeindekalender und Dorffeste (Stand 2026-10-27)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.7`. Methode laut Epic-Spec. Bundesweite
Anbieter stehen in [00-bundesweit.md](00-bundesweit.md) und werden hier nur verlinkt und aus
Landessicht ergänzt. Alle Anfragen mit Statuscode und die Rohnotizen der drei Prüfgruppen:
[06-mecklenburg-vorpommern-anfragen.md](06-mecklenburg-vorpommern-anfragen.md).

„Selbst gezählt“ heißt aus einer eigenen Antwort vom 27.10.2026 gezählt, „Eigenangabe“ heißt
Aussage des Betreibers, „nicht belegt“ heißt nicht belegt.

## Kurzfazit

1. **In MV ist das Amt die Kalenderebene, nicht die Gemeinde.** Keine der 30 Gemeinden der
   Stichprobe hat einen eigenen Veranstaltungskalender mit Feed. Von 30 Gemeinden haben 13 einen
   datierten Termin online, davon 10 im Kalender ihres Amtes (bzw. der Stadt, die das Amt führt),
   3 auf einer eigenen Seite. 17 von 30 Gemeinden haben online keinen datierten Termin.
2. **Es gibt keinen Landes-Generic für Gemeindetermine.** Die Ämter nutzen 9 verschiedene
   Systeme (23 Ämter der Stichprobe). Häufigster Hersteller ist **verwaltungsportal.de**
   (Programm „Mecklenburg-Vorpommern vernetzt“, 7 von 23 Ämtern) mit JSON-LD je Termin, in MV
   mit Adresse und Veranstalter. Danach Advantic iKISS und NOLIS mit je 3 Ämtern.
3. **Der Tourismusverband MV (TMV) bündelt Feste, aber nur touristische.** Seine Datenbank
   (infomax imx.Platform) speist auf-nach-mv.de (3.154 Termin-URLs in der Sitemap, selbst gezählt,
   auch vergangene) und Widgets auf Amts- und Stadtseiten. Traditionsfeste wie
   Tonnenabschlagen, Hafenfest und Osterfeuer sind drin, Dorffeste kleiner Binnengemeinden kaum
   (Stichprobe: Termine für 2 von 30 Gemeinden über den Titel gefunden). Die JSON-API braucht
   Zugangsdaten; Lizenz nicht belegt.
4. **destination.one hilft in MV nicht:** 0 von 30 Stichprobengemeinden mit Treffer
   (`open-data`, Ortsfilter `city:`).
5. **Feste stehen oft nur im Amtsblatt (PDF) oder ohne Datum auf der Gemeindeseite.** Beispiele:
   Dorffest Rövershagen nur im Mitteilungsblatt, „Tonnenabschlagen … alljährlich zu Pfingsten“
   in Divitz-Spoldershagen und „in jedem Jahr am 3.Oktober“ Brückenfest in Kneese ohne Datum.
   LINUS WITTICH (Sitz Sietow, MV) druckt die Blätter von mindestens 7 der 23 Ämter; Zugriff nur
   per Vereinbarung ([00-bundesweit B1](00-bundesweit.md#b1-linus-wittich-medien-mit-meinort)).
6. **Empfehlung:** (a) TMV um Datenzugang und Lizenz bitten, (b) eine Amts-Registry nach dem
   Muster der österreichischen `GemeindeRegistryScraper` aufbauen (76 Ämter, eine Kalender-URL und
   Parser-Strategie je Amt), beginnend mit dem verwaltungsportal-Parser, (c) das WITTICH-Gespräch
   aus 00-bundesweit um die MV-Amtsblätter erweitern.

## Grundgesamtheit und Stichprobe

**Quelle:** Destatis Gemeindeverzeichnis-Auszug, Gebietsstand 30.09.2026, Bevölkerung
31.12.2025 (https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/AuszugGV3QAktuell.xlsx?__blob=publicationFile),
Blatt `Onlineprodukt_Gemeinden30092026`.

* Land 13, Satzart 60 (Gemeinde): 726 Datensätze (Textkennzeichen 64: 640, 63: 82, 61: 2, 66: 2).
  Die Spec nennt 724 Gemeinden aus der Verwaltungsgliederung; die Abweichung von 2 ist nicht
  geklärt.
* Satzart 50 (Gemeindeverband): 117, davon Textkennzeichen 51 (Amt) 76 und 50 (amtsfreie
  Gemeinde) 41.
* Gemeinden mit Bevölkerung unter 10.000: **706**.

**Ziehungsregel (reproduzierbar):** Alle Datensätze Land `13`, Satzart `60`, Bevölkerung
(Spalte „insgesamt“) numerisch und kleiner 10.000; sortiert nach dem 12-stelligen ARS (Land, RB,
Kreis, VB, Gem); daraus `random.Random(13).sample(liste, 30)` (Python 3.14, Seed 13 =
Landesschlüssel); Ergebnis wieder nach ARS sortiert. Amt = Satzart-50-Datensatz mit gleichem
Kreis und VB.

```python
import random, openpyxl
ws = openpyxl.load_workbook('AuszugGV3QAktuell.xlsx', read_only=True)['Onlineprodukt_Gemeinden30092026']
gem = [r for r in ws.iter_rows(values_only=True) if r[2] == '13' and r[0] == '60']
klein = sorted([r for r in gem if isinstance(r[9], (int, float)) and r[9] < 10000],
               key=lambda r: '13' + r[3] + r[4] + r[5] + r[6])
stichprobe = random.Random(13).sample(klein, 30)
```

**Fundort-Klassen:** Amts-Kalender, Gemeinde-Website, Amtsblatt, Tourismusdatenbank,
Kreiskalender, Gemeinde-App, nirgends. „nirgends“ heißt: kein datierter Termin der Gemeinde in
Gemeinde-, Amts-, Kreis- oder Tourismusquelle und in der Websuche (Facebook nicht geprüft).
Dorffest = datierter Termin 2026 einer typischen Festart (Dorffest, Feuerwehr, Erntefest,
Herbst-/Osterfeuer, Hafenfest, Tonnenabschlagen, Weihnachts-/Adventsmarkt, Ortsjubiläum).
destination.one-Spalte: `overallcount` für
`https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=1&q=city:"<Gemeinde>"`
(ohne Datumsfenster, also alles im Bestand).

| # | Gemeinde | AGS | EW | Amt | Fundort | CMS Gemeinde / Amt | Link | Dorffest 2026 | d.one |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Schönfeld | 13071131 | 342 | Demmin-Land | Gemeinde-Website (Termine als Bild) | WebSite X5 / verwaltungsportal; Amt auch Heimat-Info | http://schoenfeld-trittelwitz.de/termine.html | nein (Plakat Hofflohmarkt 11.04.2026) | 0 |
| 2 | Fünfseen | 13071036 | 978 | Malchow | nirgends | keine / verwaltungsportal, Termine über TMV-Widget | https://www.amt-malchow.de/seite/179243/fünfseen.html | nein („alljährlich das Dorffest“ Rogeez, ohne Datum) | 0 |
| 3 | Fincken | 13071034 | 475 | Röbel-Müritz | nirgends | keine / verwaltungsportal | https://www.amt-roebel-mueritz.de/veranstaltungen/index.php | nein | 0 |
| 4 | Südmüritz | 13071176 | 792 | Röbel-Müritz | nirgends | keine / verwaltungsportal | wie Fincken | nein | 0 |
| 5 | Kriesow | 13071081 | 284 | Treptower Tollensewinkel | nirgends (Amts-Kalender ohne Kriesow) | keine / Advantic iKISS | https://www.altentreptow.de/Freizeit-Tourismus/Veranstaltungen/ | nein | 0 |
| 6 | Tützpatz | 13071146 | 533 | Treptower Tollensewinkel | nirgends (wie Kriesow) | keine / iKISS | wie Kriesow | nein | 0 |
| 7 | Voigtsdorf | 13071153 | 96 | Woldegk | nirgends | keine / manet | https://www.amt.windmuehlenstadt-woldegk.de/events-termine/ | nein | 0 |
| 8 | Satow | 13072093 | 6.372 | amtsfrei | Gemeinde-Website | Contao | https://www.gemeinde-satow.de/veranstaltungen | ja: Herbstfeuer der Feuerwehr Radegast, 10.10.2026 | 0 |
| 9 | Mistorf | 13072071 | 612 | Güstrow-Land | Amts-Kalender | keine / Joomla | https://www.amt-guestrow-land.de/gemeinden/veranstaltungen/veranstaltungen-mistorf.html | ja: Herbstfeuer 02.10.2026; Tag der offenen Tür FF 20.06.2026 | 0 |
| 10 | Mühl Rosin | 13072073 | 1.098 | Güstrow-Land | Amts-Kalender | WordPress (Freitext) / Joomla | https://www.amt-guestrow-land.de/gemeinden/veranstaltungen/veranstaltungen-muehl-rosin.html | ja: Osterfeuer 03.04.2026 | 0 |
| 11 | Warnkenhagen | 13072113 | 307 | Mecklenburgische Schweiz | nirgends (Amts-Kalender leer) | keine / NOLIS | https://www.amt-mecklenburgische-schweiz.de/regional/veranstaltungen/sucheplus.html | nein | 0 |
| 12 | Rövershagen | 13072088 | 2.808 | Rostocker Heide | Amts-Kalender und Amtsblatt | keine / OpenCms-Pfade | https://www.amt-rostocker-heide.de/amt-rostocker-heide/Veranstaltungskalender-Amt-Rostocker-Heide/ | ja: Dorffest 11.07.2026 (Mitteilungsblatt 07/2026) | 0 |
| 13 | Vorbeck | 13072110 | 407 | Schwaan | nirgends | keine / WordPress | https://www.schwaan.de/amt-schwaan/die-gemeinden/vorbeck/ | nein (FFW-Seite endet 2023) | 0 |
| 14 | Groß Mohrdorf | 13073037 | 765 | Altenpleen | Amts-Kalender | keine / verwaltungsportal | https://www.amt-altenpleen.de/veranstaltungen/index.php?rubrik=0&ort=18777 | ja: Weihnachts-Töpfermarkt Hohendorf 28.11.2026 | 0 |
| 15 | Preetz | 13073066 | 1.099 | Altenpleen | Amts-Kalender | keine / verwaltungsportal | https://www.amt-altenpleen.de/veranstaltungen/index.php?rubrik=0&ort=20215 | ja: Wintermarkt Schmedshagen 28.11.2026 | 0 |
| 16 | Divitz-Spoldershagen | 13073018 | 529 | Barth | nirgends | keine / TYPO3 mit TMV-Widget | https://www.amt-barth.de/gemeinden/divitz-spoldershagen/ | nein (Tonnenabschlagen „alljährlich zu Pfingsten“, ohne Datum) | 0 |
| 17 | Patzig | 13073064 | 410 | Bergen auf Rügen | nirgends | nicht ermittelt / iKISS | https://www.stadt-bergen-auf-ruegen.de/Amt-Bergen-auf-R%C3%BCgen/Patzig/ | nein | 0 |
| 18 | Papenhagen | 13073062 | 521 | Franzburg-Richtenberg | nirgends | keine / verwaltungsportal | https://www.amt-franzburg-richtenberg.de/seite/737923/papenhagen.html | nein | 0 |
| 19 | Weitenhagen | 13073097 | 219 | Franzburg-Richtenberg | nirgends | keine / verwaltungsportal | https://www.amt-franzburg-richtenberg.de/veranstaltungen/index.php | nein | 0 |
| 20 | Kneese | 13074040 | 329 | Gadebusch | nirgends (nur Gremiensitzung) | keine / NOLIS | https://www.gadebusch.de/amt-gemeinden/kneese/ | nein (Brückenfest „in jedem Jahr am 3.Oktober“) | 0 |
| 21 | Sauzin | 13075124 | 392 | Am Peenestrom | nirgends | keine / TYPO3 mit destination.one-Widget | https://www.wolgast.de/amt-am-peenestrom/sauzin/ | nein | 0 |
| 22 | Hintersee | 13075051 | 293 | Am Stettiner Haff | Amts-Kalender | Umleitung aufs Amt / TYPO3 tt_news | https://www.amt-am-stettiner-haff.de/aktuelles/veranstaltungen/ | nein (nur Dorfkino 30.10.2026) | 0 |
| 23 | Iven | 13075053 | 181 | Anklam-Land | nirgends | keine / WordPress ohne Kalender | https://amt-anklam-land.de/iven/ | nein | 0 |
| 24 | Korswandt | 13075065 | 567 | Usedom-Süd | nirgends | keine / WordPress ohne Kalender | https://www.amtusedom.de/?page_id=74 | nein | 0 |
| 25 | Hülseburg | 13076065 | 150 | Hagenow-Land | nirgends (Amtsblatt nicht geöffnet) | keine / NOLIS ohne Kalender | https://www.amt-hagenow-land.de/amt-gemeinden/huelseburg/ | nein | 0 |
| 26 | Zölkow | 13076162 | 748 | Parchimer Umland | Amts-Kalender | keine / verwaltungsportal | https://www.amt-parchimer-umland.de/veranstaltungen/2860616/2026/12/05/gemeinde-kinderweihnachtsfeier.html | nein (Kinderweihnachtsfeier Förderverein FFw 05.12.2026) | 0 |
| 27 | Kuhlen-Wendorf | 13076078 | 757 | Sternberger Seenlandschaft | Amts-Kalender | keine / SIQUANDO | https://www.amt-ssl.de/wasistlos/veranstaltungen/ | nein (Tanztee Bernsteinschloss) | 0 |
| 28 | Wittenburg, Stadt | 13076152 | 6.211 | Wittenburg | Amts-Kalender (Amt und Stadt eine Seite) | iKISS | https://www.amt-wittenburg.de/Erlebnis-Tourismus/Veranstaltungen/ | ja: Weihnachtsmarkt Bürgerwiese 11. bis 13.12.2026 | 0 |
| 29 | Pinnow | 13076112 | 1.994 | Crivitz | Gemeinde-Website/App | orts.app / verwaltungsportal (Kalender) | https://gemeinde-pinnow.orts.app/ | ja: „650 Jahre Godern … Ein Tag, zwei Feste“ 05.07.2026 | 0 |
| 30 | Plate | 13076113 | 3.255 | Crivitz | Amts-Kalender | keine / verwaltungsportal | https://veranstaltungen.amt-crivitz.de/veranstaltungen/index.php | ja: Herbstfeuer mit Laternenumzug 07.11.2026; 24. Plater Adventsmarkt 29.11.2026 | 0 |

Dorffest-Belege mit Link: Satow
https://www.gemeinde-satow.de/veranstaltungen/herbstfeuer-der-feuerwehr-radegast ; Rövershagen
https://www.amt-rostocker-heide.de/export/sites/arh/Mitteilungsblatt/Mitteilungsblaetter-2026/07-2026-web.pdf ;
Groß Mohrdorf
https://www.amt-altenpleen.de/veranstaltungen/2989769/2026/11/28/weihnachts-t%C3%B6pfermarkt-am-28.-november-2026-in-hohendorf.html ;
Preetz
https://www.amt-altenpleen.de/veranstaltungen/2991083/2026/11/28/wintermarkt-in-schmedshagen-am-28.-november-2026.html ;
Wittenburg
https://www.amt-wittenburg.de/Erlebnis-Tourismus/Veranstaltungen/Wittenburger-Weihnachtsmarkt-auf-der-B%C3%BCrgerwiese.php?ModID=11&FID=3627.396.1 ;
Pinnow
https://gemeinde-pinnow.orts.app/am-5-juli-am-strand-in-godern-650-jahre-godern-ein-tag-zwei-feste-und-5300-tage-gemeinde-pinnow_X1vI ;
Plate
https://veranstaltungen.amt-crivitz.de/veranstaltungen/2985108/2026/11/07/herbstfeuer-mit-laternenumzug.html ;
Mistorf und Mühl Rosin unter den Tabellenlinks.

**Ämter der Stichprobe (23 plus amtsfreies Satow):**

| Amt | Kalender-URL | CMS (Merkmal) | Feed | Gemeindetermine |
|---|---|---|---|---|
| Demmin-Land | https://www.amt-demmin-land.de/veranstaltungen/index.php | verwaltungsportal; zusätzlich Heimat-Info | nein | nein (Ortsfilter nur Verchen) |
| Malchow | https://www.visit-malchow.de/aktivitaeten/veranstaltungen | verwaltungsportal; Kalender TMV-Widget | nein | nein |
| Röbel-Müritz | https://stadt-roebel.de/veranstaltungen/ | verwaltungsportal; Stadt WordPress mit `imxplatform-cust-tmv` | nein | nur Bollewick, Röbel; Priborn, Wredenhagen über TMV |
| Treptower Tollensewinkel | https://www.altentreptow.de/Freizeit-Tourismus/Veranstaltungen/ | iKISS | iCal je Termin, robots-gesperrt | ja, andere Dörfer |
| Woldegk | https://www.amt.windmuehlenstadt-woldegk.de/events-termine/ | manet (`tpl.mmcdn.de`) | Microdata/hCalendar | nein (fast nur Strasburg, Uckermark) |
| Güstrow-Land | https://www.amt-guestrow-land.de/gemeinden/veranstaltungen.html | Joomla | nein | ja, 14 Gemeindeseiten |
| Mecklenburgische Schweiz | /regional/veranstaltungen/sucheplus.html | NOLIS | iCal (Kalender leer) | nein |
| Rostocker Heide | /amt-rostocker-heide/Veranstaltungskalender-Amt-Rostocker-Heide/ | OpenCms-Pfade `/export/sites/arh/`, Hersteller nicht belegt | nein | ja |
| Schwaan | keiner | WordPress | News-RSS | nein |
| Altenpleen | https://www.amt-altenpleen.de/veranstaltungen/index.php | verwaltungsportal | JSON-LD | ja |
| Barth | https://www.amt-barth.de/aktuell/veranstaltungen/ | TYPO3, iframe `tmvwhl.infomaxnet.de/amt-barth-de/` | nein | nein |
| Bergen auf Rügen | /Stadtleben/Veranstaltungen/ (227 Termine) | iKISS | robots-gesperrt | nein für Patzig |
| Franzburg-Richtenberg | /veranstaltungen/index.php | verwaltungsportal, eigene App | JSON-LD | ja, andere Dörfer |
| Gadebusch | https://www.gadebusch.de/regional/veranstaltungen/uebersicht.html | NOLIS | iCal | nur Gremiensitzungen |
| Am Peenestrom | https://www.wolgast.de/veranstaltungen/ | TYPO3, destination.one-Web-Component `data-experience="wolgast"` | nicht geprüft | nicht belegt |
| Am Stettiner Haff | /aktuelles/veranstaltungen/ | TYPO3 tt_news | nein | ja |
| Anklam-Land | keiner | WordPress + Elementor | News-RSS | nein |
| Usedom-Süd | keiner | WordPress | News-RSS | nein |
| Hagenow-Land | keiner | NOLIS | News-RSS | nein |
| Parchimer Umland | /veranstaltungen/index.php | verwaltungsportal | JSON-LD | ja |
| Sternberger Seenlandschaft | /wasistlos/veranstaltungen/ (209 Einträge) | SIQUANDO Pro | nein | ja |
| Wittenburg | /Erlebnis-Tourismus/Veranstaltungen/ | iKISS | RSS `/media/rss/veranstaltungen.xml` | ja |
| Crivitz | https://veranstaltungen.amt-crivitz.de/veranstaltungen/index.php | verwaltungsportal (Kalender), Hauptseite OpenCms-Pfade | JSON-LD | ja |
| Satow (amtsfrei) | /veranstaltungen | Contao | JSON-LD je Termin | ja |

CMS der 23 Ämter, selbst gezählt: verwaltungsportal 7, iKISS 3, NOLIS 3, WordPress 3, TYPO3 3,
Joomla 1, manet 1, SIQUANDO 1, OpenCms-Pfade 1. Ein Amtskalender mit Gemeindeterminen besteht
bei 10 der 23 Ämter (oben „ja“; Röbel-Müritz führt nur den Amtssitz und Bollewick und ist
nicht mitgezählt).

**Kreiskalender:** Mecklenburgische Seenplatte (iKISS) ohne Veranstaltungskalender gefunden;
Landkreis Rostock (GeoCMS 5.52, brain-SCC, `Crawl-delay: 15`) nur Theater und Kreistermine;
Vorpommern-Rügen (iKISS) 21 Termine, Messen und Beratung; Vorpommern-Greifswald (iKISS) 80
Termine, fast nur Theater Anklam; Ludwigslust-Parchim (iKISS) 1.475 Termine mit Regionsfilter,
auch Orte außerhalb des Kreises, Datenquelle nicht belegt; Nordwestmecklenburg verweist auf
https://www.kultur-nwm.de/ (WordPress, 144 Einträge auf `/veranstaltungen-2026/`, darunter
„30. Münzfest Gadebusch“ und „Kreiserntedankfest 2026“ in Diedrichshagen; REST
`/wp-json/wp/v2/veranstaltungen` liefert `title`, `content`, `link`, `date`, leeres `acf`, kein
Veranstaltungsdatum). In keinem Kreiskalender stand ein Termin einer Stichprobengemeinde.

## Generics und Kandidaten

### G1. Tourismusverband MV: Landesdatenbank auf infomax imx.Platform

* **Betreiber:** Tourismusverband Mecklenburg-Vorpommern e.V.; Software infomax imx.Platform
  (Bild-Host `imxplatform-cust-tmv.fsn1.your-objectstorage.com`, Widget-Host
  `tmvwhl.infomaxnet.de`). Ein Data Hub von dataCycle (pixelpoint) wurde laut feratel-News vom
  03.11.2023 beauftragt, das TMV-Team greife auf „information from ten different databases“ zurück
  (https://www.feratel.at/en/our-service/news/10-becomes-1-a-new-content-hub-for-mecklenburg-vorpommern-as-a-key-tool-in-tourism/).
  Ob der Hub heute Termine ausliefert: nicht belegt.
* **Gemeinden:** nicht belegt. Die Sitemap von auf-nach-mv.de listet 3.154
  `/veranstaltungssuche/e-…`-URLs (selbst gezählt), darunter vergangene Termine („Loddiner
  Hafenfest“ mit `startDate` 2018-08-04), ohne `lastmod`. In der Stichprobe nennt der URL-Slug
  Wittenburg (3 Termine) und Rövershagen (2, Karls Erlebnis-Dorf); das ist eine Untergrenze, weil
  der Slug nur den Titel trägt. Auf Amtsseiten eingebunden: Malchow (visit-malchow.de, Widget
  `token=ErUYHXYrvG8.`), Röbel (stadt-roebel.de), Barth (iframe).
* **Zugriff:** (a) Detailseiten mit JSON-LD, (b) JavaScript-Widget mit GET-Suchform
  (`widgetToken`, `dateFrom`, `dateTo`, `query`, `criterionId` u. a., laut Gruppe b),
  (c) JSON-API `https://tmv.imxplatform.de/imxplatformj/api?imxFormat=json` mit `user` und
  `password`, Methoden `FindEventIds`, `FindEvent`, `FindCategories` (laut quelloffenem
  Drittanbieter-Import https://github.com/se7enxweb/cjw_tmv , Dateien
  `settings/cjw_tmv.ini.append.php` und `classes/cjwtmvclient.php`; nicht offiziell, nicht
  abgerufen). Advantic nennt einen Import aus „Tourismusverband MV“ in iKISS
  ([00-bundesweit C3](00-bundesweit.md#c3-advantic-ikiss)).
* **Felder (JSON-LD, Probe Wustrower Tonnenabschlagen):** `@type: Event`, `identifier` (91513),
  `name`, `url`, `description`, `eventStatus`, `eventAttendanceMode`, `startDate`
  (`2027-07-11T13:00+02:00`), `endDate`, `image[]` (`url`, `width`, `height`, `name`),
  `location` (`@type: Place`, `name` „Festplatz Wustrow“, `identifier`, `address.addressLocality`,
  `postalCode`, `streetAddress`, `geo.latitude`, `geo.longitude`), `organizer` und `contributor`
  (`Organization`, `name` „Tonnenbund Ostseebad Wustrow“, `identifier`, `address`),
  `isAccessibleForFree`. Koordinaten am Termin, Veranstalter als Verein.
* **Lizenz/robots:** robots.txt von auf-nach-mv.de sperrt `/data/`, `/extern/`, `/integration/`,
  `/datamodules/`, `/tron/` u. a., erlaubt `/veranstaltungssuche/`. tmvwhl.infomaxnet.de:
  `Crawl-delay: 5`, `/data/` und `/ServiceInterface/` gesperrt (Gruppe b). Lizenz der Termine:
  nicht belegt. Eine TMV-Präsentation zur Landestourismuskonzeption (PDF vom 06.10.2023, S. 15,
  https://api.tourismus.mv/fileadmin/Media/Landestourismuskonzeption/Session_5_OK.pdf) nennt als
  Vorhaben, Daten „mit freien Lizenzen (Open Data …) ausstatten“; umgesetzt ist das nicht belegt.
  Bei destination.one `open-data` hat MV nur 8 Events
  ([deutschland-event-quellen-2026-10.md](../deutschland-event-quellen-2026-10.md)), die
  TMV-Daten sind dort also nicht.
* **Festarten in den Sitemap-Slugs (3.154, selbst gezählt):** weihnachtsmarkt 32, laterne 11,
  osterfeuer 5, feuerwehr 2, hafenfest 2, tonnen 2, erntefest 1, sommerfest 1, dorffest 0,
  schuetzen 0, maibaum 0.
* **Beispiele:** Wustrow (Fischland)
  https://www.auf-nach-mv.de/veranstaltungssuche/e-188-wustrower-tonnenabschlagen ; Wittenburg
  https://www.auf-nach-mv.de/veranstaltungssuche/e-wittenburger-weihnachtsmarkt (11.12.2026,
  Veranstalter Stadt Wittenburg); Loddin
  https://www.auf-nach-mv.de/veranstaltungssuche/e-loddiner-hafenfest .
* **Bewertung:** hoch für touristische Feste landesweit, niedrig für Dorffeste im Binnenland.

### G2. verwaltungsportal.de, Programm „Mecklenburg-Vorpommern vernetzt“

Bundesweit beschrieben in [00-bundesweit C7](00-bundesweit.md#c7-verwaltungsportalde-programm-azubi-projekte-nachtrag-27102026).

* **Gemeinden:** Gesamtzahl in MV nicht belegt (Websuche nach dem Programmnamen ohne Treffer).
  Stichprobe: 7 von 23 Ämtern, 11 von 30 Gemeinden gehören zu einem dieser Ämter, bei 5 von 30
  stehen Termine der Gemeinde im Amtskalender (Groß Mohrdorf, Preetz, Zölkow, Pinnow, Plate).
* **Zugriff:** Liste `/veranstaltungen/index.php` mit GET-Filtern `ort`, `rubrik`, `monat`;
  in der Liste steckt ein Kalender-JSON (`startDate`, `endDate`, `title`); Detail
  `/veranstaltungen/<id>/<JJJJ>/<MM>/<TT>/<slug>.html` mit JSON-LD. Ämter können eine eigene
  Kalender-Subdomain haben (`veranstaltungen.amt-crivitz.de`). Kein RSS/iCal.
* **Felder (Probe Plate):** `name`, `startDate` (`2026-11-07T17:30:00+0100`), `image`,
  `location.name`, `location.address.streetAddress` („Störstraße 1“), `postalCode` („19086“),
  `addressLocality` („Plate“), `organizer.name` („Freunde der FFW Plate e.V.“). In Altenpleen war
  `location.name` leer; der Ort steckt dann nur im Listenfilter `ort`. In MV also reicher als in
  der hessischen Probe Gedern.
* **robots:** keine Regel für `*`; benannte Bots (u. a. GPTBot, AhrefsBot) gesperrt,
  `Crawl-delay: 10` u. a. für ClaudeBot. Nutzungsbedingungen nicht belegt.
* **Beispiele:** Amt Altenpleen https://www.amt-altenpleen.de/veranstaltungen/index.php ; Amt
  Parchimer Umland https://www.amt-parchimer-umland.de/veranstaltungen/index.php ; Amt Crivitz
  https://veranstaltungen.amt-crivitz.de/veranstaltungen/index.php .
* **Bewertung:** mittel bis hoch. Ein Parser deckt alle Ämter der Plattform ab; drei der
  verwaltungsportal-Ämter (Demmin-Land, Malchow, Röbel-Müritz) pflegen aber keine Dorftermine.

### G3. Advantic iKISS

Bundesweit: [00-bundesweit C3](00-bundesweit.md#c3-advantic-ikiss).

* **Gemeinden in MV (Referenzkarte, selbst gezählt nach Koordinaten und Namen):** 8 Ämter
  (Bützow-Land, Treptower Tollensewinkel, Eldenburg Lübz, Stralendorf, Wittenburg,
  Neustadt-Glewe, Schönberger Land, Penzliner Land), 7 Städte/Gemeinden (Wismar, Demmin, Anklam,
  Ludwigslust, Ostseebad Heringsdorf, Bergen auf Rügen, Neubrandenburg), 4 Landkreise
  (Ludwigslust-Parchim, Vorpommern-Greifswald, Vorpommern-Rügen, Mecklenburgische Seenplatte).
  Stichprobe: 3 von 23 Ämtern, 4 von 30 Gemeinden zugeordnet, 1 von 30 mit Termin (Wittenburg).
* **Zugriff:** einheitliches HTML (`ModID=11`), iCal unter `/output/` per robots gesperrt.
  **Neu:** Wittenburg hat einen offenen RSS `https://www.amt-wittenburg.de/media/rss/veranstaltungen.xml`
  (`<generator>IKISS</generator>`, ISO-8859-15, Felder `title`, `link`, `description`; Datum, Zeit
  und Ort nur am Anfang der `description`). Ob der Pfad bei allen iKISS-Mandanten besteht: nicht
  belegt.
* **Felder (HTML, Probe Grapzow):** Titel, Freitext, `Datum: 06.11.2026`,
  `Veranstaltungsort: Grapzow`, kein JSON-LD.
* **Dorffest-Test:** Wittenburger Weihnachtsmarkt (s. o.); „Laternenumzug in Grapzow“ 06.11.2026
  https://www.altentreptow.de/Freizeit-Tourismus/Veranstaltungen/Laternenumzug-in-Grapzow.php?object=tx,4357.4.1&ModID=11&FID=2973.1157.1&NavID=2973.14&bn=1 .
* **Bewertung:** mittel; RSS-Pfad an den übrigen MV-Kunden prüfen.

### G4. NOLIS

Bundesweit: [00-bundesweit C2](00-bundesweit.md#c2-nolis-cms).

* **Stichprobe:** 3 von 23 Ämtern (Mecklenburgische Schweiz, Gadebusch, Hagenow-Land), 3 von 30
  Gemeinden zugeordnet, 0 mit Veranstaltungstermin. Mecklenburgische Schweiz: Kalender leer;
  Gadebusch: iCal liefert für Kneese nur eine Gremiensitzung (5 von 16 Einträgen
  `CATEGORIES:Politische Sitzungen`); Hagenow-Land ohne Kalender.
* **Felder:** wie C2, zusätzlich `X-KURZ-DETAIL`, `X-LOCATION-ID`, `X-LOCATION-OWNER`,
  `X-GEO-PROJECTION`, `X-NOLISEXPORT` (Gadebusch, Kommune 28390).
* **Dorffest-Test:** nicht bestanden. **Bewertung:** niedrig in MV, aber ohne Zusatzaufwand,
  sobald der NOLIS-Generic gebaut ist.

### G5. Amtskalender ohne Generic (Registry-Kandidaten)

* **Amt Güstrow-Land (Joomla):** „Termine …, die uns gemeldet wurden“, eine Unterseite je
  Gemeinde (14), Felder `Wann:`, `Was:`, `Wo:`; bester Fundort der Stichprobe. Dorffest-Test:
  Mistorf „Herbstfeuer“ 02.10.2026, Sportplatz.
* **Amt Rostocker Heide:** Absätze „TT.MM.JJJJ - Titel“, Termine aus Mönchhagen, Rövershagen,
  Bentwisch, Blankenhagen, z. B. „Oktoberfeuer mit Laternenumzug in Mönchhagen“ 30.10.2026.
* **Amt Sternberger Seenlandschaft (SIQUANDO):** 209 Einträge, Zeile
  „TT.MM.JJJJ: HH:MM - HH:MM Ort · Venue · Titel“, robots `Allow: /`. Dorffest-Test nicht bestanden.
* **Amt Am Stettiner Haff (TYPO3 tt_news):** Datum in der Detail-URL, Liste über `/seite/<n>/`.
  Dorffest-Test nicht bestanden.
* **Gemeinde Satow (Contao):** JSON-LD `name`, `startDate` mit Offset, `location.name`, Adresse nur
  als Text in `address.description`.
* **manet (Amt Woldegk):** Microdata `schema.org/Event`, `data-event-id`; Inhalt fast nur
  Strasburg (Uckermark, BB). Dorffest-Test nicht bestanden.

### G6. Amtsblätter und WITTICH

* **LINUS WITTICH (Sietow, MV) belegt für 7 von 23 Ämtern:** Treptower Tollensewinkel
  (Amtskurier), Güstrow-Land (Amtsanzeiger), Schwaan (Amtsreport, mit meinOrt-Hinweis),
  Hagenow-Land (Hagenower Kommunalanzeiger,
  https://www.wittich.de/produkte/zeitungen/3495-hagenower-kommunalanzeiger ), Sternberger
  Seenlandschaft, Wittenburg (Stadt- und Landbote), Crivitz (Crivitzer Amtsbote). Am Peenestrom
  (Amtsbote) nur laut Bibliothekskatalog 2024
  (https://www.bibkat.de/wolgast/medium/der-amtsbote-2024-0454/). Gemeinden der Stichprobe in
  diesen 7 Ämtern: 10 von 30.
* **Andere:** Rostocker Heide „Herstellung: KLATSCHMOHN Verlag, Druck + Werbung GmbH“;
  Mecklenburgische Schweiz und Franzburg-Richtenberg geben selbst heraus; übrige nicht belegt.
* **Zugriff:** PDF; meinOrt nur per Vereinbarung (00-bundesweit B1). Der dortige Test „Sietow (MV)
  2.961 Termine im Umkreis von etwa 50 km“ zeigt, dass meinOrt MV-Daten führt; Anteil
  Dorftermine nicht belegt.
* **Dorffest-Test:** Dorffest Rövershagen 11.07.2026 im Mitteilungsblatt 07/2026 (Klatschmohn,
  Link in der Stichprobe).

### G7. Kleinere Funde

* **Heimat-Info:** 2 von 648 Kommunen mit PLZ 17/18/19 (selbst gezählt): Amt Demmin-Land und
  Seebad Loddin. Demmin-Land: 3 Termine (Filmfest Nossendorf 24.10.2026, zweimal ReparaturCafé
  Gatschow); Dorffest-Test nicht bestanden. Felder wie A1.
* **orts.app (apicodo AG, Mainz):** Pinnow als Gemeinde-Website und App; SPA, RSS `/Newsfeed`
  (`title`, `link`, `guid`, `pubDate`, `dc:creator`, `category`, `description`,
  `content:encoded`), Termindatum nur im Text. Zahl der Gemeinden nicht belegt.
* **Smartes Land / Digitale Dörfer:** 7 Portfolio-Einträge MV (Kategorie 123, selbst gezählt),
  in der Stichprobe nicht vorgekommen.
* **destination.one-Web-Component:** Wolgast (`newpages.destination.one/web-components.js`,
  `data-experience="wolgast"`), eigene Experience, nicht `open-data`.
* **kultur-nwm.de (Kreis Nordwestmecklenburg):** Kreisfeste, Datum nur im HTML.
* **Nordkurier:** KI-Crawler gesperrt (00-bundesweit F), nicht abgerufen.

## Dorffest-Test je Quelle

| Quelle | Ergebnis | Beispiel |
|---|---|---|
| TMV / auf-nach-mv.de | bestanden | Wustrower Tonnenabschlagen 11.07.2027, Tonnenbund Ostseebad Wustrow |
| verwaltungsportal.de | bestanden | Herbstfeuer mit Laternenumzug Plate 07.11.2026, Freunde der FFW Plate |
| iKISS | bestanden | Wittenburger Weihnachtsmarkt 11. bis 13.12.2026; Laternenumzug Grapzow |
| Amtskalender Güstrow-Land (Joomla) | bestanden | Herbstfeuer Mistorf 02.10.2026; Osterfeuer Mühl Rosin 03.04.2026 |
| Amtskalender Rostocker Heide | bestanden | Oktoberfeuer mit Laternenumzug Mönchhagen 30.10.2026 |
| Contao Satow | bestanden | Herbstfeuer der Feuerwehr Radegast 10.10.2026 |
| orts.app Pinnow | bestanden | 650 Jahre Godern, 05.07.2026 |
| Amtsblatt (Klatschmohn) | bestanden | Dorffest Rövershagen 11.07.2026 |
| kultur-nwm.de | bestanden | Kreiserntedankfest 2026, Diedrichshagen (https://www.kultur-nwm.de/veranstaltungen-2026/) |
| NOLIS (MV) | nicht bestanden | nur Gremiensitzungen |
| SIQUANDO SSL, TYPO3 Stettiner Haff, manet Woldegk | nicht bestanden | Tanztee, Dorfkino, Kinoabend |
| Heimat-Info (Demmin-Land) | nicht bestanden | Filmfest, ReparaturCafé |
| destination.one `open-data` | nicht bestanden | 0 Treffer in 30 Gemeinden |

## Abdeckung (nur Stichprobenanteil)

Formel: Anteil p = k / n mit n = 30; 95-%-Intervall nach Wilson,
(p + z²/2n ± z·√(p(1−p)/n + z²/4n²)) / (1 + z²/n), z = 1,96. Keine Hochrechnung auf die 706
Gemeinden.

| Merkmal | k / 30 | p | 95 %-Intervall |
|---|---|---|---|
| datierter Termin online (irgendwo) | 13 | 43,3 % | 27,4 bis 60,8 % |
| davon im Amtskalender (eine Integration je Amt) | 10 | 33,3 % | 19,2 bis 51,2 % |
| datiertes Dorffest 2026 online | 9 | 30,0 % | 16,7 bis 47,9 % |
| Amt auf verwaltungsportal, Termin vorhanden | 5 | 16,7 % | 7,3 bis 33,6 % |
| TMV-Termin über Titel-Slug | 2 | 6,7 % | 1,8 bis 21,3 % |
| destination.one `open-data` | 0 | 0,0 % | 0 bis 11,4 % |
| nirgends online | 17 | 56,7 % | 39,2 bis 72,6 % |

## Priorisierte Integrationsliste MV

Datenqualität vor Menge, dann Gemeinden je Integration, dann Rechtslage.

| # | Integration | Gemeinden (Beleg) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | Amts-Registry MV (Muster `GemeindeRegistryScraper`) | 10/30 Gemeinden mit Termin über ihren Amtskalender; 10 von 23 Ämtern mit Gemeindeterminen | je Amt verschieden, Ort meist im Titel oder Filter | Websites der Ämter, robots je Amt | Startseiten aller 76 Ämter einmal abrufen, CMS nach D5 plus manet/SIQUANDO/tt_news erkennen, Kalender-URL und Strategie je Amt eintragen |
| 2 | verwaltungsportal-Parser (Liste + JSON-LD) | 7/23 Ämter, 5/30 Gemeinden mit Termin | gut: Adresse, Veranstalter, Offset-Zeit | keine Regel für `*` | Parser bauen (gilt bundesweit, C7); als erste Strategie der Registry |
| 3 | TMV-Datenbank (imx.Platform) | landesweit, Gemeindezahl nicht belegt; 2/30 über Slug | sehr gut: Koordinaten, Verein als Veranstalter | Lizenz nicht belegt, API mit Zugangsdaten | TMV (Bereich Daten & Digitales) nach API- oder Data-Hub-Zugang und Lizenz fragen; ohne Zusage nichts massenhaft abrufen |
| 4 | WITTICH Amtsblätter / meinOrt | 7/23 Ämter, 10/30 Gemeinden | PDF bzw. meinOrt-JSON | AGB IV.9, nur per Vereinbarung | MV-Blätter in das WITTICH-Gespräch aus 00-bundesweit aufnehmen |
| 5 | iKISS-RSS | 3/23 Ämter, 1/30 mit Termin; 8 MV-Ämter laut Referenzkarte | mittel: Datum und Ort im Text | RSS offen, iCal gesperrt | RSS-Pfad an den 8 Ämtern prüfen; sonst Advantic nach Export fragen (00-bundesweit) |
| 6 | NOLIS-iCal | 3/23 Ämter, 0/30 mit Festtermin | gut, Sitzungen filtern | robots frei | kommt mit dem bundesweiten NOLIS-Generic ohne Zusatzaufwand |
| 7 | Einzelquellen: kultur-nwm.de, Satow (Contao), orts.app Pinnow | je eine | mittel | nicht belegt | erst nach 1 bis 3 |
| | Nicht weiter verfolgen | | | | destination.one für MV (0/30), Kreiskalender MSE, LRO, VR, VG (keine Dorftermine), Heimat-Info MV (3 Termine), Nordkurier (KI gesperrt) |

## Lücken

* 17 von 30 Gemeinden haben online keinen datierten Termin. Feste werden dort als jährlicher
  Brauch ohne Datum beschrieben (Divitz-Spoldershagen, Kneese, Fünfseen) oder stehen nur im
  Amtsblatt-PDF; Facebook wurde nicht geprüft.
* Amtskalender zeigen nur kommende Termine; Frühjahrs- und Sommerfeste 2026 waren am 27.10.2026
  nicht mehr sichtbar. Ein Teil der „nirgends“-Fälle kann daran liegen (nicht belegt).
* Zahl der MV-Ämter auf verwaltungsportal.de, NOLIS und anderen Systemen außerhalb der
  Stichprobe: nicht belegt (Schritt 1 der Liste klärt das).
* Lizenz und API-Zugang der TMV-Datenbank, Zahl der künftigen Termine und Anteil kleiner
  Gemeinden: nicht belegt. Datenquelle des Kreiskalenders Ludwigslust-Parchim (1.475 Termine):
  nicht belegt.
* Verlag der Amtsblätter von 14 der 23 Ämtern: nicht belegt.

## Was der User selbst tun muss

1. Tourismusverband MV: Zugang zur Veranstaltungs-API (imx.Platform) oder zum Data Hub und
   Nutzungsrecht für lasstreffen anfragen.
2. WITTICH-Gespräch aus 00-bundesweit um die MV-Amtsblätter (Sietow) erweitern.

## Anfragen und Regeltreue

Vollständige Liste: [06-mecklenburg-vorpommern-anfragen.md](06-mecklenburg-vorpommern-anfragen.md).
Hauptsession: 51 Anfragen (davon 32 an meta.et4.de für den Pflichtabgleich, mit 2 s Abstand),
6 Websuchen. Prüfgruppen: je Host meist 2 bis 6 Anfragen, 21 Websuchen in Gruppe b.

Abweichungen, offen benannt: ludorf.online wurde im selben Befehl wie seine robots.txt abgerufen,
die `Disallow: /` setzt (Ergebnis: Parkseite); bei schoenfeld-trittelwitz.de lief die Startseite
vor der robots.txt (diese ergab 404); tmvwhl.infomaxnet.de bekam die zweite Anfrage 1 s nach der
robots.txt trotz `Crawl-delay: 5`; kultur-nwm.de wurde über eine Umleitung vor dem Lesen der
robots.txt erreicht (Pfad erlaubt); altentreptow.de und amt-mecklenburgische-schweiz.de bekamen
je 7 statt etwa 6 Anfragen. Keine Konten, keine Formulare, keine Mails.
