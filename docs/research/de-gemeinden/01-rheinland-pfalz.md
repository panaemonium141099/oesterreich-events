# Gemeindekalender Rheinland-Pfalz (Stand 2026-10-29)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.2`. Frage: Wie kommen wir an die
Termine der kleinen Gemeinden in Rheinland-Pfalz (Kirmes, Kerb und Kerwe, Weinfeste,
Feuerwehr- und Dorffeste, Weihnachtsmärkte), über welche Plattformen, Verbandsgemeinde-
Kalender, Amtsblatt-Verlage oder Schnittstellen?

Baut auf dem Querschnitt [00-bundesweit.md](00-bundesweit.md) und der Vollerhebung
[01-vollerhebung.md](01-vollerhebung.md) auf. Die Vollerhebung ordnet jede Gemeinde
automatisch einer Integration zu; diese Datei liefert die Landessicht: wo kleine Gemeinden
in RP ihre Feste wirklich veröffentlichen (Handprüfung einer Zufallsstichprobe), wie weit
ionas auf Ebene der Verbandsgemeinden reicht, was Tourismusdaten und Landesdienste
abdecken und wo die automatische Zuordnung danebenliegt.

Arbeitsweise: nur lesende GET-Anfragen, keine Konten, Formulare oder Mails, robots.txt
beachtet. Jede Zahl stammt aus einer eigenen Antwort vom 27. bis 29.10.2026 oder aus einer
verlinkten Seite; was sich nicht belegen ließ, steht als „nicht belegt“ da. Alle Anfragen:
[01-rheinland-pfalz-anfragen.md](01-rheinland-pfalz-anfragen.md). Ergebnis je Verwaltung:
[data/rp-verwaltungen-2026-10.csv](data/rp-verwaltungen-2026-10.csv).

## Kurzfazit

1. **Die Kalenderebene in RP ist die Verbandsgemeinde, und sie läuft fast überall auf
   ionas.** Von 123 abrufbaren VG-Startseiten tragen 106 das ionas-Merkmal, dazu 31 von
   41 verbandsfreien Gemeinden und Städten. 1.857 der 2.300 Gemeinden gehören damit zu einer
   Verwaltung mit ionas-Website (80,7 %). Hersteller ist die Chamaeleon GmbH in Montabaur.
   Das Kalendermodul TVM liefert offenes `events.json` und `event.ics`; ein Adapter dafür
   existiert schon (`de-ionas`, [adapter-ionas.md](adapter-ionas.md)).
2. **ionas ist aber nur zum Teil eine Dorffest-Quelle.** In den 39 TVM-Feeds, die schon
   auf der Startseite verlinkt sind, stehen 9.423 Termine ab dem 28.10.2026. Davon sind
   7.491 (79,5 %) Deskline-Termine von Rheinland-Pfalz Tourismus (UUID-Kennung, Bilder
   `resc.deskline.net/images/RPT`) und nur 1.932 eigene Termine der Verwaltung. In der
   Stichprobe hat eine Gemeinde ein typisches Fest im TVM-Feed ihrer VG (Oberraden,
   Feuerwehr), zwei weitere ein Vereinsfest (Heuzert, Gimbsheim).
3. **Die Feste kleiner Orte liegen verstreut.** Stichprobe 30 Gemeinden unter 10.000
   Einwohnern: Bei 11 ist ein typisches Fest (Kirmes, Kerwe, Weinfest, Dorffest,
   Feuerwehr, Weihnachtsmarkt) in einer Gemeinde-, VG-, Vereins- oder Tourismusquelle
   belegt, bei 4 weiteren ein anderes Vereinsfest. Bei 4 steht das Fest nur in Presse oder
   Aggregatoren, bei 11 nirgends. Über einen Feed oder eine API erreichbar sind von den 15
   Gemeinden mit Fest 9 (3 × The Events Calendar, 3 × destination.one, 3 × ionas TVM).
4. **LINUS WITTICH ist der gemeinsame Nenner.** 24 der 30 Stichprobengemeinden haben ein
   WITTICH-Amtsblatt, 17 stehen in der meinOrt-Ortsliste. ionas-Seiten spielen die
   Amtsblatt-Inhalte automatisch ein (VG Vordereifel: „in regelmäßigen Abständen
   automatisch mit dieser Homepage synchronisiert“). In der Pfalz und Rheinhessen weicht das
   ab (Fieguth, Wochenblatt, nicht belegt). Die WITTICH-Anfrage aus
   [00-bundesweit.md](00-bundesweit.md) B1 ist für RP die wichtigste Einzelanfrage.
5. **Tourismus und Landesdienste decken Dörfer kaum.** destination.one `open-data` hat für
   5 der 30 Gemeinden mindestens einen Termin, rlpDirekt für keine. Der Deskline-Linkkey
   `mosel` führt Dorffeste, die destination.one fehlen (Kellerkirmes Mesenich).
6. **Die automatische Zuordnung der Vollerhebung trifft bei 15 von 30 Gemeinden.** Bei
   5 stimmt die Plattform, der Kalender führt aber keine Termine des Orts; bei 9 weicht sie
   ab (falscher Host, falsche Seite, Kalender veraltet oder leer), 1 ließ sich nicht
   prüfen. „Erreicht“ heißt in RP oft nur „VG-Kalender vorhanden“.

## 1. Stichprobe

**Ziehung (reproduzierbar).** Quelle: Destatis Gemeindeverzeichnis-Auszug, Stichtag
30.09.2026 (`AuszugGV3QAktuell.xlsx`, Blatt `Onlineprodukt_Gemeinden30092026`). Regel:
alle Zeilen mit Satzart `60` und Land `07` (2.301 Datensätze, darunter das gemeinsame
deutsch-luxemburgische Hoheitsgebiet ohne Einwohner), Einwohner (31.12.2025) als ganze Zahl
unter 10.000: 2.254 Gemeinden. Sortiert nach ARS, dann `random.Random(20261027).sample(…, 30)`
(Python 3.14), Ergebnis nach ARS sortiert. Skript in Abschnitt 8.

**Prüfung je Gemeinde:** eigene Website, VG-Website und VG-Kalender, Amtsblatt,
Tourismus-Widget, App, Dorffest-Termin; Merkmale nach [00-bundesweit.md](00-bundesweit.md)
D5. Drei Teilprüfungen zu je 10 Gemeinden, Rohnotizen und Anfragen im Anhang. Herschbach,
Monreal und Gossersweiler-Stein habe ich am 29.10. nach dem Abgleich mit der Vollerhebung
selbst nachgeprüft (Abschnitt 6).

**Spalten:** Fundort = Hauptfundort der Veranstaltungen; d.one = Treffer in
destination.one `open-data` mit `q=city:"<Gemeinde>"` im Fenster 28.10.2026 bis
27.10.2027, PLZ geprüft; meinOrt = Ort steht in https://meinort.de/orte-list ; Fest =
belegter Termin einer typischen Festart 2026 oder 2027.

| # | Gemeinde | AGS | EW | VG | Fundort | Plattform Gemeinde / VG | Link | d.one | meinOrt | Fest |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Alsdorf | 07132002 | 1.483 | Betzdorf-Gebhardshain | VG-Portal, nur Meldung | keine Gemeindeseite / ionas4, Portal bg-aktuell.de (The Events Calendar) | https://bg-aktuell.de/aktuelle-meldung/ueberblick-der-st-martinszuege-in-der-verbandsgemeinde/ | 0 | nein | nein (nur St. Martinszug 10.11.2026) |
| 2 | Malberg | 07132066 | 1.063 | Betzdorf-Gebhardshain | VG-Portal, nur Meldung | keine Gemeindeseite / wie 1 | wie 1 | 0 (5 Treffer gehören zu Malberg 54655, Eifel) | nein | nein (nur St. Martinszug 11.11.2026) |
| 3 | Pleckhausen | 07132090 | 855 | Altenkirchen-Flammersfeld | Ortsgemeinde-Website | Mobirise / TYPO3 + datefix.de | https://www.pleckhausen.de/veranstaltungen.html | 0 | ja | nein |
| 4 | Boos | 07133014 | 357 | Rüdesheim | Ortsgemeinde-Website | WebSite X5 / ionas4 + Deskline DW5 | https://www.boos-nahe.de/termine.html | 0 | ja | Dorffest 25./26.07.2026, Kirmes 04.10.2026 |
| 5 | Birkenfeld, Stadt | 07134010 | 7.042 | Birkenfeld | Ortsgemeinde-Website | Joomla + JEM / NOLIS | https://www.stadt-birkenfeld.de/tourismus/kultur/veranstaltungen.html | 0 | ja | nein (nur Martinsumzug 13.11.2026) |
| 6 | Mesenich | 07135060 | 306 | Cochem | Verein (Heimat- und Verkehrsverein betreibt mesenich.de) | Joomla / ionas3 ohne Kalender | https://mesenich.de/freizeit/veranstaltungen | 1 | ja | Weinfest 31.07. bis 02.08.2026, Kellerkirmes 11. bis 13.09.2026 |
| 7 | Monreal | 07137074 | 733 | Vordereifel | VG-Kalender als PDF | WordPress, Kalender Stand 2024 / ionas4 | https://www.vordereifel.de/aktuelles/ab-mai-vg-veranstaltungskalender2026.pdf?cid=4rd | 9 | ja | Kirmes 31.05.2026, Dorffest 27./28.06.2026, Weinfest 05./06.09.2026 |
| 8 | Münk | 07137077 | 257 | Vordereifel | VG-Kalender als PDF | muenk-eifel.de 404 / ionas4 | wie 7 | 0 | ja | Kirmes 01. bis 04.05.2026 |
| 9 | Oberraden | 07138054 | 659 | Rengsdorf-Waldbreitbach | Gemeinde-App | orts.app / ionas4 TVM | https://oberraden.orts.app/ | 0 | ja | Kirmes Ober- und Niederraden 04. bis 07.09.2026 |
| 10 | Klosterkumbd | 07140070 | 268 | Simmern-Rheinböllen | nirgends | IONOS cm4all („Keine Einträge“) / ionas4 + Deskline | https://www.klosterkumbd.com/ | 0 | nein | nein |
| 11 | Morshausen | 07140205 | 330 | Hunsrück-Mittelrhein | nirgends (Kalender leer) | verwaltungsportal.de / ionas4 + Deskline DW5 | https://www.gemeinde-morshausen.de/veranstaltungen/index.php | 0 | ja | nein |
| 12 | Hirschberg | 07141057 | 400 | Diez | nirgends | Joomla, am 27.10. 503 / ionas3 ohne Kalender | https://www.vgdiez.de/vg_diez/Gemeinden/Hirschberg/ | 0 | nein | nein |
| 13 | Winterwerb | 07141140 | 148 | Nastätten | nirgends | Domain zum Verkauf / ionas4 TVM, 0 Termine des Orts | https://www.vgnastaetten.de/tourismus-freizeit/veranstaltungen/veranstaltungskalender/ | 0 | ja | nein |
| 14 | Dessighofen | 07141026 | 199 | Bad Ems-Nassau | Ortsgemeinde-Website | IONOS MyWebsite NOW / ionas4 | https://www.dessighofen.de/aktuelles/terminubersicht/ | 0 | ja | Vereinsfest: IGM-Lichterfest 21.11.2026 |
| 15 | Heuzert | 07143240 | 121 | Hachenburg | VG-Kalender | keine Gemeindeseite / ionas4 TVM | https://www.hachenburg-vg.de/aktuelles/veranstaltungskalender/ | 0 | ja | Vereinsfest: „Heuzerter Vasen“ rund um den Backes 26.09.2026 |
| 16 | Winkelbach | 07143313 | 234 | Hachenburg | nirgends | keine Gemeindeseite / ionas4 TVM, 0 Termine des Orts | https://www.hachenburg-vg.de/unsere-gemeinden/winkelbach/ | 0 | ja | nein |
| 17 | Herschbach (Oberwesterwald) | 07143239 | 961 | Wallmerod | Ortsgemeinde-Website | WordPress + The Events Calendar / ionas4 ohne Kalender | https://herschbach-oberwesterwald.de/events/ | 0 | ja | Kirmes 15.07.2027, Feuerwehr-Disco 05.12.2026 |
| 18 | Gemünden | 07143224 | 1.053 | Westerburg | Ortsgemeinde-Website | SIQUANDO Web 12 / ionas4 | http://www.gemuenden-ww.de/veranstaltungen---termine/index.html | 0 (2 Treffer anderer Gemünden) | ja | Vereinsfest: Oktoberfest SV 24./25.10.2026 |
| 19 | Gilzem | 07232225 | 433 | Südeifel | nirgends | keine Gemeindeseite / ionas4 | keiner | 0 | ja | nein |
| 20 | Prüm, Stadt | 07232296 | 5.276 | Prüm | Tourismusdatenbank | keine eigene Seite / ionas4, Kalender als iframe | https://www.ferienregion-pruem.de/veranstaltungen | 89 | ja | nur Dritte: Salvator-Kirmes 07. bis 10.08.2026 auf festivalsindeutschland.de |
| 21 | Feusdorf | 07233023 | 518 | Gerolstein | Ortsgemeinde-Website | WordPress + The Events Calendar / ionas4 | https://feusdorf-vulkaneifel.de/veranstaltungen/ | 0 | nein | Kirmes 12.06.2026 |
| 22 | Morscheid | 07235090 | 878 | Ruwer | nirgends | Platzhalterseite / ionas4 + Deskline DW5 | https://www.morscheid.de/ | 0 | ja | nein |
| 23 | Gimbsheim | 07331034 | 3.130 | Eich | VG-Kalender | Umleitung auf VG / ionas4 TVM | https://www.vg-eich.de/aktuelles/veranstaltungen/veranstaltungskalender/ | 0 | nein | Vereinsfest: Oktoberfest Landjugend 17.10.2026 |
| 24 | Flörsheim-Dalsheim | 07331023 | 3.223 | Monsheim | Ortsgemeinde-Website | Weblication / ionas4 + dataCycle-Widget | https://www.floersheim-dalsheim.de/og/highlights/dalsheimer-kerwe/ | 0 | nein | Dalsheimer Kerwe 12./13.09.2026 |
| 25 | Herxheim am Berg | 07332026 | 721 | Freinsheim | Ortsgemeinde-Website, leer | Joomla + JEvents (RSS leer) / ionas4 | https://www.herxheimamberg.de/index.php/termine | 0 | nein | nur Presse: Kerwe 31.07. bis 03.08.2026 |
| 26 | Frankeneck | 07332018 | 851 | Lambrecht (Pfalz) | Ortsgemeinde-Website | WordPress + The Events Calendar / ionas3 | https://frankeneck.de/veranstaltungen/ | 0 | nein | Kerwe 08.08.2026, Maifest 01.05.2026 |
| 27 | Bischheim | 07333007 | 758 | Kirchheimbolanden | nirgends | Unterseite der VG (GeoCMS) / GeoCMS brain-SCC | https://www.kirchheimbolanden.de/de/bischheim-rathaus-aktuelles-und-veranstaltungen.html | 0 | nein | nur Presse, Vorjahr (Bischemer Kerb 2025) |
| 28 | Erdesbach | 07336022 | 588 | Kusel-Altenglan | nirgends | eigener Baukasten (Laravel) / ionas4 TVM, 0 Termine des Orts | https://www.erdesbach.de/termine | 0 | nein | nur Aggregator: Dorffest 18.07.2026 auf regioactive.de |
| 29 | Gossersweiler-Stein | 07337033 | 1.382 | Annweiler am Trifels | Tourismusdatenbank | WordPress („keine Veranstaltungen geplant“) / ionas4 + Deskline RPT | https://www.suedlicheweinstrasse.de/trifelsland-veranstaltungen | 3 | nein | Gaggertkerwe 06.08.2027 |
| 30 | Annweiler am Trifels, Stadt | 07337501 | 7.233 | Annweiler am Trifels | Tourismusdatenbank | WordPress ohne Kalender / ionas4 + Deskline RPT | wie 29 | 36 | nein | Burgunderweinfest 21. bis 23.05.2027 |

Die Fest-Belege mit Link je Gemeinde stehen in den Rohnotizen im Anhang; die je Quelle
gewählten Beispiele in Abschnitt 3.

**Hauptfundort (Zählung):** Ortsgemeinde-Website 10, VG-Kalender oder VG-Portal 6,
Tourismusdatenbank 3, Verein 1, Gemeinde-App 1, nirgends 9.

**Amtsblatt (Zählung):** LINUS WITTICH 24 (alle 20 Gemeinden der Kreise im Norden und der
Eifel, VG Hachenburg nur über den Amtsblatt-Reiter der Website belegt, dazu Feusdorf,
Morscheid, Gimbsheim, Frankeneck), Fieguth-Amtsblätter Neustadt 1
(Herxheim am Berg), Wochenblatt-ePaper „Trifels Kurier“ 2 (Annweiler,
Gossersweiler-Stein), nicht belegt 3 (Flörsheim-Dalsheim, Bischheim, Erdesbach).

**Verbandsgemeinden der Stichprobe (26):** ionas 23 (20 × ionas4, 3 × ionas3), TYPO3 mit
datefix 1 (Altenkirchen-Flammersfeld), NOLIS 1 (Birkenfeld), GeoCMS 1
(Kirchheimbolanden). Einen TVM-Kalender mit offenem JSON führen davon 6 (Nastätten,
Hachenburg, Eich, Kusel-Altenglan, Rengsdorf-Waldbreitbach, Vordereifel), die anderen
haben keinen Kalender, binden ein Deskline-Widget ein oder verlinken die Tourismusseite.

## 2. Generics

### G1. ionas (Chamaeleon) mit Kalendermodul TVM

* **Betreiber:** Chamaeleon Gesellschaft für innovative Netzlösungen mbH, Robert-Bosch-
  Straße 12, 56410 Montabaur, HRB 31432 (https://www.chamaeleon.de/impressum/). Die
  Startseite nennt „Content Management Suite ionas“ und den Bereich „Öffentliche
  Verwaltung“. Die Seite setzt im Robots-Meta-Tag `noai` und `noindex` für GPTBot,
  Anthropic-AI, Claude-Web u. a.; die Referenzliste habe ich deshalb nicht abgerufen.
  Bundesweite Zahl: 931 Gemeinden in der Vollerhebung, ekom21 cms21 läuft ebenfalls auf
  ionas ([01-vollerhebung.md](01-vollerhebung.md) Abschnitt 3).
* **Zahl in RP (selbst gezählt, 27.10.2026):** Für alle 170 Verwaltungen (129 VG, 41
  verbandsfreie Gemeinden und kreisfreie Städte) die offizielle Website aus Wikidata (P856),
  je Startseite ein Abruf: 164 erreichbar. ionas-Merkmal (`ionas4`, `data-ionas4-external`,
  `:res/modules/common…ionas`, Generator `CMS ionas3`) bei 106 von 123 VG und 31 von 41
  verbandsfreien. Gemeinden in diesen Verwaltungen: 1.857 von 2.300. Die Vollerhebung zählt
  in RP 622 Gemeinden mit ionas als eigener Integration und 333 über die VG.
* **Zugriff:** Kalenderseite mit `data-source="https://<host>/<pfad>/events.json?weekends=false&tagMode=ALL"`,
  Export `…/event.ics`. Der Pfad ist je Verwaltung verschieden: auf den 39 Startseiten mit
  Link 18 × `/kalender/events.json`, 6 × `/kalender/veranstaltungen/events.json`, dazu
  `deskline-und-eigene`, `kombinierte-terminquelle`, `veranstaltungen-deskline` u. a. Ohne
  Parameter liefert `events.json` ein Jahr zurück und ein Jahr voraus (Koblenz 27.10.2025
  bis 27.10.2027).
* **Felder (Probe, 25.166 Termine aus 39 Feeds):** `events.json`: `id`, `start`, `end`
  (Ortszeit ohne Offset), `allDay`, `title`, `website`, `imageSrc`, `tags`, `category`
  (`id`, `name`), `location` (`name`, `description`, `href`). `event.ics` (`PRODID:-//IONAS//TVM//DE`,
  Probe Hachenburg 177 VEVENT): `SUMMARY`, `DTSTART;TZID=Europe/Berlin`, `DESCRIPTION`,
  `X-LOCATION-NAME`, `X-STREET-ADDRESS`, `X-POSTAL-CODE`, `X-LOCALITY`, `X-ORGANIZER-NAME`
  und `-EMAIL`, `-TELEPHONE`, `-WEBSITE`, `URL`, `ATTACH`, `X-IONAS-CATEGORY`, `RRULE`,
  `RDATE`, `UID`. Keine Koordinaten. `CONTACT` und `X-CONTACT-*` enthalten Privatpersonen
  mit Telefonnummer und dürfen nicht übernommen werden.
* **Eigene und Deskline-Termine:** In `events.json` tragen eigene Termine eine numerische
  ID (`105322:0`), Termine aus der Deskline von Rheinland-Pfalz Tourismus eine UUID und
  Bilder von `resc.deskline.net/images/RPT/…`. In den 39 Feeds ab 28.10.2026: 1.932 eigene,
  7.491 Deskline. Koblenz (3.447 von 3.448), Ingelheim (1.864 von 1.920) und Vordereifel
  (alle 1.523) sind fast nur Deskline; Alzey, Mayen, Speyer, Limburgerhof, Schifferstadt
  nur eigene. Der Adapter `de-ionas` liest den iCal-Export und unterscheidet beides bisher
  nicht (kein Treffer für `deskline`/`uuid` in `src/lib/scrapers/de/`).
* **Lizenz/robots:** Die geprüften ionas-Hosts haben keine robots.txt (404) oder lassen
  `/kalender/` frei; vg-lambrecht.de antwortet auf robots.txt mit 403. Nutzungsbedingungen
  für Dritte: nicht belegt. Rechteinhaber der eigenen Termine sind die Verwaltungen bzw.
  die einstellenden Vereine; für die Deskline-Termine gilt die Lage von Rheinland-Pfalz
  Tourismus (G3).
* **Gemeinde-Beispiele:** VG Hachenburg
  https://www.hachenburg-vg.de/kalender/kombinierte-terminquelle/events.json?weekends=false&tagMode=ALL ;
  VG Lauterecken-Wolfstein https://www.vg-lw.de/kalender/events.json?weekends=false&tagMode=ALL ;
  VG Weilerbach https://www.weilerbach.de/kalender/events.json?weekends=false&tagMode=ALL .
* **Dorffest-Test:** bestanden. Eigene Termine: „Kerwe Hoppstädten“ 30.10.2026 (VG
  Lauterecken-Wolfstein), „Weihnachtsmarkt in Rodenbach“ 27.11.2026 und „Adventsmarkt in
  Erzenhausen“ 29.11.2026 (VG Weilerbach), „Glühweinfest, Förderverein Feuerwehr“
  21.11.2026 (Schifferstadt), „95 Jahre Feuerwehr Großmaischeid“ 27.05.2027 (VG Dierdorf),
  „Heuzerter Vasen“ 26.09.2026 (VG Hachenburg). Unter allen 9.423 Terminen ab 28.10.2026
  tragen 155 eine Festart im Titel, 25 davon eigene.

### G2. LINUS WITTICH: Amtsblätter, meinOrt, Sync in ionas

* Querschnitt in [00-bundesweit.md](00-bundesweit.md) B1. Landessicht: 24 von 30
  Stichprobengemeinden haben ein WITTICH-Amtsblatt (Abschnitt 1), alle VG der Kreise
  Altenkirchen bis Eifelkreis. Titel-Belege u. a. „Blaues Ländchen aktuell“ (436),
  „Mitteilungsblatt Südeifel“ (708), „Prümer Rundschau“ (710), „Hunsrück-Mittelrhein-
  Nachrichten“ (452/456) unter https://www.wittich.de/produkte/zeitungen/archiv/ .
* **Sync nach ionas:** Die VG Vordereifel schreibt, die Inhalte des Wittich-Mitteilungsblatts
  würden „in regelmäßigen Abständen automatisch mit dieser Homepage synchronisiert“
  (https://www.vordereifel.de/aktuelles/heimat-und-buergerzeitung/). ionas4-Seiten haben in
  der Suche einen Reiter „Amtsblatt“ (`"id":"wittich"`), ionas3 in Diez ein Modul
  „<Ort> im Amtsblatt“ (`?wittich_view=orte`). Das Merkmal `wittich` steht im Quelltext von
  83 der 106 ionas-VG-Startseiten. Zwischen WITTICH und ionas gibt es also eine laufende
  Schnittstelle; ob sie Veranstaltungen trägt, ist nicht belegt.
* **meinOrt in RP:** 1.514 der 2.300 RP-Gemeindenamen stehen in der Ortsliste (1.396 davon
  bundesweit eindeutig; Abgleich über den Namen, Namenszusätze wie „Boos-Nahe“ eingerechnet
  nur in der Stichprobe). Stichprobe 17 von 30; es fehlen alle 9 Gemeinden aus Rheinhessen
  und der Pfalz. Die Vollerhebung zählt 260 RP-Gemeinden, die nur über meinOrt erreichbar
  wären.
* **Zugriff, Felder, Lizenz:** wie B1 (robots.txt sperrt `/*?*`, AGB IV.9). Termine habe ich
  nicht abgerufen. **Dorffest-Test:** im Amtsblatt Altenahr belegt (B1), hier nicht erneut.
* **Nächster Schritt:** die laufende WITTICH-Anfrage um zwei RP-Punkte ergänzen: den
  Veranstaltungsteil des Amtsblatt-Syncs nach ionas und die Zuordnung Termin zu Ortsgemeinde.

### G3. Feratel Deskline von Rheinland-Pfalz Tourismus

* **Befund:** Dieselbe Datenbank taucht in vier Formen auf: Linkkey `mosel` der Deskline-
  WebAPI; DW5-Widgets auf VG- und Tourismusseiten (`resc.deskline.net/DW5/start/<Code>/…`,
  Codes `EMMELSHAUS`, `WÄLLERLAND`, `RUWER`, `RUEDNAHE`); TYPO3-Extension
  `tx_sfdeskline_event` (suedlicheweinstrasse.de); Deskline-Termine in ionas-Feeds (G1). Die
  Startseiten von Kastellaun, Morbach, Traben-Trarbach, Arzfeld, Maikammer und Dahner
  Felsenland nennen `deskline.net` direkt.
* **Probe `mosel` (27.10.2026, `pageNo` beginnt bei 1, 0 liefert dieselbe Seite):**
  1.926 Termine vom 27.10.2026 bis 24.10.2027 in 109 Orten, Regionen u. a. „Ferienland
  Cochem“, „Saar-Obermosel“, „Zeller Land“, „Romantischer Rhein“. 77 Festtitel:
  Weihnachtsmarkt 31, Weinfest 20, Kirmes 10, Adventsmarkt 5, Feuerwehr 3, Winzerfest 3,
  Straßenfest 3, Martinsmarkt 1, Maifest 1. Felder wie im `FeratelScraper`.
* **Lizenz:** nicht belegt ([deutschland-event-quellen-2026-10.md](../deutschland-event-quellen-2026-10.md)
  Abschnitt 12).
* **Gemeinde-Beispiele:** Mesenich (`mosel`), Gossersweiler-Stein
  https://www.suedlicheweinstrasse.de/trifelsland-veranstaltungen/event/2027-08-06-00-00/Gaggertkerwe_Gossersweiler-Stein4/event.html ,
  VG Rengsdorf-Waldbreitbach
  https://www.rengsdorf-waldbreitbach.de/kalender/deskline-veranstaltungen/events.json?weekends=false&tagMode=ALL
  (592 Termine; Kirmes in Hümmerich, Ehlscheid, Hausen).
* **Dorffest-Test:** bestanden. „Kellerkirmes“ Mesenich 10.09.2027, Ort „Straßen und Keller
  von Mesenich“, Region „Ferienland Cochem“ (Deskline-ID `9c68518d-af79-4c0d-a436-fdc4aca9f611`);
  in destination.one fehlt dieser Termin, dort steht nur das Weinfest.
* **Nächster Schritt:** bei Rheinland-Pfalz Tourismus nach Freigabe und landesweitem Linkkey
  fragen (schon im Tourismusbericht vorgesehen) und dabei die DW5-Codes oben nennen.

### G4. destination.one `open-data`

* **Zahlen:** `area:"Rheinland-Pfalz"` 14.275 Datensätze ohne Zeitfenster, 2.699 im Fenster
  28.10.2026 bis 27.10.2027 (gesamt Deutschland im selben Fenster 34.725). Stichprobe: 5 von
  30 Gemeinden mit mindestens einem Termin (Mesenich 1, Monreal 9, Prüm 89,
  Gossersweiler-Stein 3, Annweiler 36). Der Ortsfilter trifft Namensvettern: „Malberg“ liefert
  Malberg 54655 (Eifel), „Gemünden“ Gemünden (Wohra) und Daun-Gemünden. Monreal enthält
  dieselben Termine doppelt mit zwei ID-Formen (`e_100383568` und 32 Hex-Zeichen).
* **Dorffest-Test:** bestanden. „Gaggertkerwe“ 06.08.2027 und „Hawwerflichelkerwe“ 17.09.2027
  (Gossersweiler-Stein), „Weinfest“ Mesenich 30.07.2027, „Uriger Adventsmarkt auf dem
  Monrealer Marktplatz“ 12.12.2026.
* **Nächster Schritt:** keiner neu; destination.one bleibt Grundlast (Lizenz CC0 je Datensatz).

### G5. The Events Calendar auf Ortsgemeinde-Websites

* **Stichprobe:** 3 von 30 (Herschbach, Feusdorf, Frankeneck), alle mit offener REST
  `/wp-json/tribe/events/v1/events` und iCal `?ical=1`; Felder wie
  [00-bundesweit.md](00-bundesweit.md) D1. Herschbach 9 Termine, Feusdorf 32, Frankeneck 45.
  Vollerhebung RP: 134 Gemeinden. Dazu das VG-Portal bg-aktuell.de (Betzdorf-Gebhardshain)
  mit nur 9 Terminen.
* **robots:** WordPress-Standard; Frankeneck sperrt `/wp-content/plugins/`, nicht `/wp-json/`.
* **Dorffest-Test:** bestanden, in allen drei: „Kirmes“ 15.07.2027 und „Feuerwehr-Disco“
  05.12.2026 https://herschbach-oberwesterwald.de/event/kirmes-2/ ; „Kirmes in Feusdorf,
  Kirmesbaum aufstellen“ 12.06.2026
  https://feusdorf-vulkaneifel.de/veranstaltungen/kirmes-in-feusdorf-kirmesbaum-aufstellen/ ;
  „Kerwe Frankeneck“ 08.08.2026 https://frankeneck.de/veranstaltung/kerwe-frankeneck/ .

### G6. NOLIS (VG Birkenfeld)

* Muster wie [00-bundesweit.md](00-bundesweit.md) C2, in RP an einer VG-Startseite belegt
  (Vollerhebung RP: 12 Gemeinden eigene Integration, 15 über die VG). Kommune-ID 39840,
  iCal `https://www.vg-birkenfeld.de/veranstaltungen/veranstaltungen.ical?selected_kommune=39840&…`,
  Felder `X-KOMMUNE`, `X-ORT`, `X-ORT-ID`, `X-ORGANIZER`, `GEO` 0;0, Latin-1.
* **Dorffest-Test:** nicht bestanden, nur Martinsumzüge (Birkenfeld, Hattgenstein,
  Rinzenberg, Siesbach), z. B.
  https://www.vg-birkenfeld.de/regional/veranstaltungen/martinsumzug-und-martinsfeuer-in-birkenfeld-900001383-39840.html .

### G7. Kleinere Kalender-Plattformen

* **datefix.de** (VG Altenkirchen-Flammersfeld, Widget `<script id="dfx" data-kid="5212">`):
  HTML von `https://www.datefix.de/js/kalender/5212`, 23 Seiten zu 10 Terminen, Filter
  `form[ort]`, `form[suche]` u. a.; Ort im Format „Lokal | PLZ Ort , Straße“. robots.txt ohne
  Sperre, Betreiber und Bedingungen nicht geprüft. Dorffest-Test: nicht bestanden
  (`form[suche]=Kirmes` keine Treffer, `Weihnachtsmarkt` nur eine Busfahrt der Landfrauen
  nach Dortmund).
* **orts.app** (apicodo GmbH, Mainz, Betreiber nur über ein Suchergebnis belegt): Subdomain je
  Gemeinde, RSS `/Newsfeed` mit Veröffentlichungsdatum, Termin nur im Titel; robots.txt sperrt
  GPTBot, CCBot, Google-Extended. Merkmal auf 3 VG-Startseiten (Birkenfeld, Alzey-Land,
  Kirchheimbolanden; Kirchheimbolanden laut Amtsblatt 47/2025 für alle 16 Ortsgemeinden).
  Dorffest-Test: bestanden, „Fiesta Española, Kirmes Ober-/Niederraden 2026“
  https://oberraden.orts.app/04-07-september-fiesta-espanola-kirmes-ober-niederraden-2026_gdlI .
* **Advantic iKISS:** 7 Verwaltungen (Wissen, Ransbach-Baumbach, Wörrstadt, Wonnegau,
  Jockgrim, Landau, Neustadt an der Weinstraße), nicht in der Stichprobe; Zugriff wie
  [00-bundesweit.md](00-bundesweit.md) C3.
* **verwaltungsportal.de:** Morshausen (Kalender leer); Vollerhebung RP 73 Gemeinden.
* **dataCycle-Widget** `widgets.rlp-tourismus.de` (VG Monsheim, `<datacycle-widget widget-identifier="rpt/events">`):
  Listenroute nach 4 Anfragen nicht gefunden.
* **Nicht in der Stichprobe:** Heimat-Info, Cross7 (eine VG-Startseite: Altenahr), DorfPages,
  StadtLandNews (Vollerhebung ordnet Malberg `stadtlandnews` auf vggebhardshain.de zu, der Host
  antwortete mir mit TLS-Fehler, nicht geprüft).

### G8. rlpDirekt (Landesdienst)

* `https://open-rlp.egovernor.de/metaData/event/data`, dl-zero-de/2.0: 2.941 Datensätze,
  577 ab 28.10.2026 an 62 Regionalschlüsseln. Felder `name`, `description`, `location`
  (`addressLocality`, `postalCode`, `name`), `startDate`, `endDate` (mit Offset), `rgs`
  (12-stelliger ARS), `created`, `lastModified`.
* Stichprobe: 0 von 30 (auch keine Termine früherer Jahre). 153 der 577 kommen aus Pirmasens,
  58 aus der VG Römerberg-Dudenhofen. Dieselben Titel an denselben Tagen stehen im
  ionas-Feed derselben Verwaltung („Römerberger Weihnachtsmarkt“, „Weihnachtsmarkt
  Harthausen“ 28.11.2026; „Weihnachtsmarkt: 1. Advent“ Mutterstadt). Ob rlpDirekt aus ionas
  gespeist wird, ist nicht belegt.
* **Dorffest-Test:** „Weihnachtsmarkt Hanhofen“ 28.11.2026 (rgs 073385007010).
* **Nächster Schritt:** keiner; liefert in der Stichprobe nichts, was ionas nicht hat.

### G9. Dritte ohne Integration

Presse und Aggregatoren tragen in 4 Gemeinden den einzigen Beleg: wochenblatt-reporter.de
(Kerwe Herxheim am Berg, Bischheim, Gossersweiler-Stein), regioactive.de (Dorffest
Erdesbach), festivalsindeutschland.de (Salvator-Kirmes Prüm, Kerb Gimbsheim). Nur als
Lückenliste nutzbar ([00-bundesweit.md](00-bundesweit.md) F). Die VG Vordereifel
veröffentlicht einen Jahreskalender der Ortsgemeinden als PDF mit sehr vielen Dorffesten
(Monreal, Münk); beim Textauszug verrutschen die Spalten.

## 3. Dorffest-Test (Übersicht)

| Quelle | Ergebnis | Beleg |
|---|---|---|
| ionas TVM, eigene Termine | bestanden | „Kerwe Hoppstädten“ 30.10.2026, https://www.vg-lw.de/kalender/events.json?weekends=false&tagMode=ALL |
| ionas TVM, Deskline-Termine | bestanden | Kirmes Hümmerich, Feed Rengsdorf-Waldbreitbach (G3) |
| Deskline `mosel` | bestanden | „Kellerkirmes“ Mesenich 10.09.2027 |
| destination.one `open-data` | bestanden | „Gaggertkerwe“ Gossersweiler-Stein 06.08.2027 |
| The Events Calendar | bestanden | „Kerwe Frankeneck“ 08.08.2026 |
| orts.app | bestanden | Kirmes Ober-/Niederraden 04. bis 07.09.2026 |
| rlpDirekt | bestanden | „Weihnachtsmarkt Hanhofen“ 28.11.2026 |
| Ortsgemeinde-HTML ohne Plattform | bestanden | Boos: Dorffest 25./26.07.2026 https://www.boos-nahe.de/termine.html ; Dalsheimer Kerwe https://www.floersheim-dalsheim.de/og/highlights/dalsheimer-kerwe/ |
| VG-Jahreskalender PDF | bestanden | Kirmes Münk 01. bis 04.05.2026, PDF VG Vordereifel |
| WITTICH-Amtsblatt | bestanden (PDF) | Altenahr, [00-bundesweit.md](00-bundesweit.md) B1 |
| NOLIS | nicht bestanden | nur Martinsumzüge |
| datefix.de | nicht bestanden | Kirmes 0 Treffer |
| verwaltungsportal.de | nicht bestanden | Morshausen leer |

## 4. Abdeckung (nur als Stichprobenanteil)

n = 30 Gemeinden unter 10.000 Einwohnern, Anteil = Treffer / 30.

| Größe | Treffer | Anteil |
|---|---|---|
| typisches Fest in Gemeinde-, VG-, Vereins- oder Tourismusquelle belegt | 11 | 36,7 % |
| dasselbe einschließlich anderer Vereinsfeste | 15 | 50,0 % |
| davon über Feed oder API (Tribe 3, destination.one 3, ionas TVM 3) | 9 | 30,0 % |
| Fest nur bei Presse oder Aggregator | 4 | 13,3 % |
| kein Fest gefunden | 11 | 36,7 % |
| destination.one: mindestens ein Termin | 5 | 16,7 % |
| destination.one: typisches Fest | 3 | 10,0 % |
| rlpDirekt: mindestens ein Termin | 0 | 0 % |
| Verwaltung mit ionas (VG oder selbst) | 27 | 90,0 % |
| VG mit offenem TVM-Kalender | 8 | 26,7 % |
| WITTICH-Amtsblatt | 24 | 80,0 % |
| in der meinOrt-Ortsliste | 17 | 56,7 % |
| Vollerhebung: „erreicht“ (Stufe A bis M) | 28 | 93,3 % |
| Vollerhebung: Integration durch Handprüfung bestätigt | 15 | 50,0 % |

Landesweit gemessen statt geschätzt: ionas bei 1.857 von 2.300 Gemeinden (80,7 %), über
die Verwaltung gezählt; Anteil der eigenen Termine in den 39 TVM-Feeds 1.932 von 9.423
(20,5 %).

## 5. Priorisierte Integrationsliste Rheinland-Pfalz

| # | Integration | Gemeinden (Beleg) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | ionas TVM, eigene Termine | 1.857 über die Verwaltung (Website-Merkmal); TVM-Kalender in 6 von 23 ionas-VG der Stichprobe | Titel, Wandzeit, Adresse und Veranstalter im ICS; Ort im Amtskalender oft nur im Titel | keine robots-Sperre, keine Bedingungen belegt | Adapter `de-ionas` (fn-29.5) um zwei Punkte ergänzen: Deskline-Termine (UUID, Bild `images/RPT`) ausfiltern oder dem Deskline-Dedup überlassen; Kalenderquellen der übrigen 98 ionas-Seiten ohne Startseiten-Link einsammeln |
| 2 | WITTICH (meinOrt, Amtsblatt-Sync) | 24 von 30 Amtsblatt, 1.514 Namen in der Ortsliste | JSON mit Adresse laut B1 | nur mit Zustimmung (AGB IV.9) | laufende Anfrage um RP-Punkte ergänzen (G2) |
| 3 | Deskline RPT (Linkkeys, DW5-Codes) | `mosel` 109 Orte; DW5 an mindestens 4 VG | Koordinaten, Kategorien, Dorffeste wie Kellerkirmes | Lizenz nicht belegt | RPT nach Freigabe fragen (G3); bis dahin nur `mosel` als bekannter Linkkey |
| 4 | destination.one `open-data` | 5 von 30 | gut, CC0 | offen | schon geplant, kein RP-Zusatz |
| 5 | The Events Calendar | 3 von 30, Vollerhebung 134 | sehr gut | Gemeinde-Websites | Detektor der Vollerhebung, in RP hohe Festquote (3 von 3) |
| 6 | VG-Jahreskalender als PDF | Vordereifel belegt, Zahl nicht belegt | viele Dorffeste, Spalten verrutschen | Gemeinde-Veröffentlichung | erst prüfen, wie viele VG so einen Kalender führen |
| 7 | NOLIS, orts.app, datefix, iKISS, verwaltungsportal | je 1 VG in der Stichprobe bzw. 7 iKISS-Verwaltungen | wechselnd | wie Querschnitt | über die Vollerhebungs-Adapter mitnehmen |
| | Nicht weiter verfolgen | | | | rlpDirekt (0 von 30, gleiche Titel wie ionas), Presse und Aggregatoren nur als Lückenliste |

## 6. Abgleich mit der Vollerhebung

Die Zuordnung aus [data/vollerhebung-2026-10.csv](data/vollerhebung-2026-10.csv) gegen die
Handprüfung. „bestätigt“: Plattform und Kalenderseite stimmen; „formal“: Plattform stimmt,
der Kalender führt keine Termine des Orts; „abweichend“: Host, Seite oder Befund falsch.

| Gemeinde | Vollerhebung (Stufe, Integration, Host) | Urteil | Befund der Handprüfung |
|---|---|---|---|
| Alsdorf | B, contao_events, betzdorf.de | abweichend | Host ist die Nachbarstadt Betzdorf; Alsdorf hat keine Seite |
| Malberg | C, stadtlandnews, vggebhardshain.de | nicht prüfbar | Host antwortet mit TLS-Fehler |
| Pleckhausen | E, html_generic | bestätigt | |
| Boos | E, html_generic | bestätigt | |
| Birkenfeld | D, jsonld | bestätigt | JEM-Mikrodaten |
| Mesenich | V, leer, VG ionas | abweichend | mesenich.de führt Weinfest und Kellerkirmes; VG Cochem ohne Kalender |
| Monreal | E, js_oder_feed, monrealeifel.de | abweichend | Kalenderseite leitet auf `veranstaltungskalender-2024`; Feste nur im VG-PDF |
| Münk | M, VG-PDF als Kalender-URL | bestätigt | |
| Oberraden | M, orts.app | bestätigt | |
| Klosterkumbd | V, VG ionas sim-rhb.de | formal | VG-Kalender ist ein Deskline-Widget ohne Ortstermine |
| Morshausen | B, verwaltungsportal | bestätigt | Kalender leer |
| Hirschberg | A, ionas, vgdiez.de | abweichend | Kalender-URL ist die Seite der Gleichstellungsbeauftragten; VG Diez ohne Kalender |
| Winterwerb | V, VG ionas, Kalender-URL eine Steuertermin-Meldung | abweichend | richtiger Kalender wäre der TVM-Kalender der VG, dort 0 Termine des Orts |
| Dessighofen | E, html_generic | bestätigt | |
| Heuzert | A, ionas | bestätigt | |
| Winkelbach | A, ionas | formal | 0 Termine des Orts im VG-Feed |
| Herschbach | A, tribe | bestätigt | die Teilprüfung hatte die Seite übersehen, am 29.10. nachgeprüft |
| Gemünden | R, leer | abweichend | statische Terminliste mit Oktoberfest und St. Martin |
| Gilzem | M, Kalender-URL terminland.de | abweichend | terminland.de ist eine Terminbuchung der VG, kein Veranstaltungskalender |
| Prüm | A, ionas, Kalender-URL = Startseite | abweichend | kein TVM, iframe auf ferienregion-pruem.de (Deskline) |
| Feusdorf | A, tribe | bestätigt | |
| Morscheid | V, VG ionas ruwer.de | formal | VG-Kalender ist ein Deskline-Widget |
| Gimbsheim | A, ionas | bestätigt | |
| Flörsheim-Dalsheim | B, weblication | bestätigt | |
| Herxheim am Berg | A, jevents | bestätigt | RSS leer |
| Frankeneck | A, tribe | bestätigt | |
| Bischheim | B, geocms, Unterseite der VG | formal | nur Nachrichten, keine Termine |
| Erdesbach | E, js_oder_feed | formal | Seite „Termine“ ohne Einträge |
| Gossersweiler-Stein | E, js_oder_feed | abweichend | „Aktuell sind keine Veranstaltungen geplant“ (29.10.); Feste nur in der Tourismusdatenbank |
| Annweiler am Trifels | R, fehler | abweichend | annweiler.de ohne Kalender; Feste in der Tourismusdatenbank |

Bestätigt 15, formal 5, abweichend 9, nicht prüfbar 1. Für die DE-Registry heißt das:
Kalender-URLs aus der Vollerhebung brauchen in RP einen Inhaltstest (Termine des Orts
vorhanden?), bevor eine Gemeinde als erreicht gilt.

## 7. Lücken

* 9 von 30 Gemeinden veröffentlichen online nirgends Termine, 4 weitere nur über Presse
  oder Aggregatoren. Für sie bleiben Amtsblatt (WITTICH) und Vereine.
* Kerwe und Kirmes 2027 sind im Oktober 2026 oft noch nicht eingetragen; die Stichprobe
  belegt viele Feste nur für 2026. Ein Festkalender braucht eine Jahresfortschreibung oder
  eine Lückenliste.
* Pfalz und Rheinhessen: Amtsblätter nicht bei WITTICH (Fieguth, Wochenblatt) oder nicht
  belegt, meinOrt fehlt dort; Verlag und Zugang der Wochenblatt-Ausgaben nicht geprüft.
* TVM-Kalender auf 98 der 137 ionas-Startseiten nicht verlinkt; wie viele davon einen
  Kalender führen, ist nicht gemessen.
* Nicht geprüft: 6 Verwaltungs-Startseiten (Linz am Rhein, Loreley, Daun, Deidesheim,
  Göllheim, Nordpfälzer Land; Gründe im Anhang E), Wochenblatt-Verlag, Kreiskalender
  außer Kusel ([00-bundesweit.md](00-bundesweit.md) E), Feuerwehr-Verbandsseiten in RP.

## 8. Methode und Reproduktion

```python
# Ziehung der Stichprobe (Python 3.14, openpyxl 3.1.5)
import random, openpyxl
ws = openpyxl.load_workbook('AuszugGV3QAktuell.xlsx', read_only=True)['Onlineprodukt_Gemeinden30092026']
gem = []
for r in ws.iter_rows(values_only=True):
    if r[0] == '60' and r[2] == '07' and isinstance(r[9], int) and r[9] < 10000:
        gem.append(dict(ars=r[2]+r[3]+r[4]+r[5]+r[6], ags=r[2]+r[3]+r[4]+r[6], name=r[7], ew=r[9]))
gem.sort(key=lambda g: g['ars'])
pick = sorted(random.Random(20261027).sample(gem, 30), key=lambda g: g['ars'])
```

* **destination.one:** `https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=3&startdate=2026-10-28&enddate=2027-10-27&q=city:"<Name>"`,
  Name ohne Zusatz „, Stadt“; bei Treffern PLZ der Items geprüft.
* **Verwaltungsscan:** Website je ARS (9 Stellen + `000` für VG, Gemeinde-ARS für
  verbandsfreie) aus Wikidata P1388/P856; je Host robots.txt, dann Startseite; Merkmale per
  regulärem Ausdruck. TVM-Feeds: erste `…/kalender/…/events.json` der Startseite, ein Abruf.
  Eigene Termine = `id` beginnt nicht mit einer UUID.
* **meinOrt:** Ortsnamen aus den Links `/<id>-<Name>` der Ortsliste gegen die Destatis-Namen
  (ohne „, Stadt“).
* **Teilprüfungen:** Auftrag und Rohnotizen mit allen Anfragen im Anhang B bis D.
