# Thüringen: Gemeindekalender und Dorffeste (Stand 2026-10-27)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.8`. Frage: Wie kommen wir an die
Termine der kleinen Thüringer Gemeinden, also Kirmes, Feuerwehrfeste, Erntefeste,
Maibaumsetzen und Weihnachtsmärkte? Bundesweite Anbieter stehen in
[00-bundesweit.md](00-bundesweit.md) und werden hier nur aus Landessicht ergänzt.

Arbeitsweise: nur lesend, keine Konten, keine Formulare, keine Mails. Jede Zahl stammt
aus einer eigenen Antwort vom 27.10.2026 oder aus einer verlinkten Seite. Was sich nicht
belegen ließ, steht als „nicht belegt“ da. Abweichungen von den Regeln stehen offen im
Abschnitt „Anfragen“.

## Kurzfazit

1. **verwaltungsportal.de ist in Thüringen der Generic.** 18 der 30 Stichprobengemeinden
   (60 %) haben ihren Verwaltungsauftritt (eigene Seite, VG oder erfüllende Gemeinde) auf
   dieser Plattform, gefördert über das Landesprogramm „Thüringen vernetzt“ des
   Fördervereins für regionale Entwicklung e.V. (00-bundesweit C7). Alle Seiten haben
   dieselbe Struktur: Liste `/veranstaltungen/index.php`, Detailseite mit Datum im Pfad
   und JSON-LD `Event`. Ein Parser deckt alle ab. 13 der 15 geprüften Seiten führen
   Termine, darunter Kirmes, Maibaumsetzen und Feuerwehrjubiläen. Die Kalender sind aber
   oft dünn (0 bis 3 Termine bei 8 von 15 Seiten), weil Gemeinden und Vereine dort selbst
   melden müssen. Lizenz und Zahl der Thüringer Seiten: nicht belegt.
2. **ThüCAT ist offen lizenziert, aber kaum ein Dorffest-Kanal.** Die Landesdatenbank
   führt 4.514 Termine ab dem 27.10.2026, davon 4 Dorfkirmessen, 2 Feuerwehrjubiläen
   und 91 Treffer zu „Weihnachtsmarkt“; Dorffest, Maibaum, Erntefest, Schützenfest,
   Heimatfest und Osterfeuer: 0. Von 30 Stichprobengemeinden haben 3 einen Termin in
   ThüCAT (Walschleben, Ostramondra, Ponitz). Zugang per API-Key auf Anfrage, Daten
   „unter Creative-Commons-Lizenzen zur freien Nutzung“. Lohnt sich trotzdem, weil
   ThüCAT mehr als elfmal so viele Thüringer Termine hat wie destination.one `open-data` (4.514 gegen 386).
3. **destination.one deckt die kleinen Gemeinden nicht ab.** Für keine der 30
   Stichprobengemeinden gibt es einen Treffer (Kontrolle Jena: 178). Die 386 Thüringer
   Termine verteilen sich auf 32 Orte, 207 davon in Jena.
4. **Amtsblätter erscheinen fast nur als PDF.** LINUS WITTICH druckt für 4 der 30
   Gemeinden das Amtsblatt (Leinetalbote, Neue Werra-Zeitung, Veilsdorfer Anzeiger, VG
   Gera-Aue). Auf verwaltungsportal.de liegen die Amtsblätter hinter einem POST-Formular.
   Eigene Blätter wie „Hansteinkurier“ oder „Dorfkurier“ führen vollständige
   Terminlisten der Dörfer, nur als PDF. Weg über WITTICH bleibt das bundesweite Gespräch
   (00-bundesweit B1).
5. **Dorffest-Test:** Für 10 der 30 Gemeinden ließ sich ein Fest dieser Gemeinde online
   belegen. Die Belege stehen auf sieben verschiedenen Wegen (verwaltungsportal, eigenes
   TYPO3, GeoCMS, ionas-Tabelle, WordPress-Sammelbeitrag, Vereinsseite, PDF). Für 20
   Gemeinden stand nichts online, was eine Integration greifen könnte.

## 1. Stichprobe

**Ziehung (reproduzierbar).** Quelle: Destatis Gemeindeverzeichnis-Auszug, Stichtag
30.09.2026 (`AuszugGV3QAktuell.xlsx`, Blatt `Onlineprodukt_Gemeinden30092026`, abgerufen
27.10.2026, 200, 1.872.608 Byte). Regel: Land `16`, Satzart `60`, Textkennzeichen nicht
65/66, Bevölkerung unter 10.000, sortiert nach ARS; dann
`random.Random(280816).sample(liste, 30)`, Ausgabe nach ARS. Das ergibt 566 von 601
Gemeinden als Grundgesamtheit (899.161 von 2.078.946 Einwohnern). Skript:

```python
import random, openpyxl
ws = openpyxl.load_workbook(path, read_only=True)['Onlineprodukt_Gemeinden30092026']
gem = [r for r in ws.iter_rows(min_row=7, values_only=True)
       if r[2] == '16' and r[0] == '60' and r[1] not in ('65', '66') and r[9] < 10000]
gem.sort(key=lambda r: r[2]+r[3]+r[4]+r[5]+r[6])
sample = random.Random(280816).sample(gem, 30)
```

Gemeindeverbände im Land laut Datei: 110 verbandsfreie Gemeinden (Kennzeichen 50), 42
Verwaltungsgemeinschaften (54), 37 erfüllende Gemeinden (58).

**Spalten:** Fundort = wo Termine dieser Gemeinde stehen (oder ihrer Verwaltung, wenn
die Gemeinde selbst keine hat); VP = verwaltungsportal.de; d.one = Treffer
`q=city:"<Name>"` bei destination.one `open-data`, Fenster 28.10.2026 bis 27.10.2027;
ThüCAT = Treffer mit der PLZ der Gemeinde in der Suche der ThüCAT-Webkomponente
(Abschnitt 2.2), ab 27.10.2026; Fest = Dorffest-Test für diese Gemeinde bestanden.

| # | Gemeinde | AGS | EW | Verwaltung | Fundort | CMS/Plattform | Link | d.one | ThüCAT | Fest |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Am Ohmberg | 16061116 | 3.513 | verbandsfrei | nur Amtsblatt „Ohmbergbote“ (PDF) | Joomla (Einzelperson) | https://www.am-ohmberg.de/ | 0 | 0 | nein |
| 2 | Marth | 16061069 | 306 | VG Hanstein-Rusteberg | nur Amtsblatt „Hansteinkurier“ (PDF, Eigenverlag) | TYPO3, kein Kalender | https://www.vg-hanstein-rusteberg.de/mitgliedsgemeinden/marth | 0 | 0 | nein |
| 3 | Wingerode | 16061107 | 1.080 | VG Leinetal | VG-Kalender leer; Amtsblatt WITTICH | WordPress + The Events Calendar (total 0) | https://vg-leinetal.de/ | 0 | 0 | nein |
| 4 | Sollstedt | 16062049 | 2.776 | verbandsfrei | eigene Seite | VP 11279 | https://www.sollstedt.de/veranstaltungen/index.php | 0 | 0 | ja |
| 5 | Gerstungen | 16063097 | 8.767 | verbandsfrei | eigene Seite; Amtsblatt WITTICH | GeoCMS 5.52.00 (brain-SCC), iCal je Termin | https://www.gerstungen.de/de/veranstaltungen.html | 0 | 0 | ja |
| 6 | Blankenburg | 16064007 | 156 | VG Bad Tennstedt | VG-Kalender (65 Termine, keiner hier) | VP 99 | https://www.badtennstedt.de/veranstaltungen/index.php | 0 | 0 | nein |
| 7 | Haussömmern | 16064021 | 199 | VG Bad Tennstedt | wie 6 | VP 99 | wie 6 | 0 | 0 | nein |
| 8 | Wasserthaleben | 16065077 | 354 | VG Greußen | VG-Kalender (3 Termine, keiner hier) | VP 3212 | https://www.vgem-greussen.de/veranstaltungen/index.php | 0 | 0 | nein |
| 9 | Rockstedt | 16065058 | 197 | erf. Gem. Ebeleben | Kalender Ebeleben (3 Termine, keiner hier) | VP 10366 | https://www.ebeleben.de/ | 0 | 0 | nein |
| 10 | Rosa | 16066059 | 665 | erf. Gem. Breitungen/Werra | Kalender Breitungen (über 60 Termine, keiner hier) | VP 9980 | https://www.breitungen.de/veranstaltungen/index.php | 0 | 0 | nein |
| 11 | Bad Tabarz | 16067064 | 3.866 | verbandsfrei | eigene Seite | TYPO3 tx_news (Agentur ideenwert) | https://www.bad-tabarz.de/veranstaltungen | 0 | 0 | ja |
| 12 | Walschleben | 16068057 | 1.770 | VG Gera-Aue | ThüCAT (3 Vorträge); eigene Seite per robots.txt gesperrt; VG-Kalender leer; Amtsblatt WITTICH | VP 8143 (VG) | https://www.vg-gera-aue.de/veranstaltungen/index.php | 0 | 3 | nein |
| 13 | Ostramondra | 16068041 | 442 | VG Kölleda | VG-Sammelbeitrag mit Jahresplan als Bild; ThüCAT | WordPress (GeneratePress), RSS | https://vgem-koelleda.de/veranstaltungskalender-ostramondra-2025 | 0 | 1 | ja |
| 14 | Veilsdorf | 16069053 | 2.610 | verbandsfrei | eigene Seite (Jahresplan als Fließtext); Amtsblatt WITTICH | TYPO3 (mekai) | https://veilsdorf.de/kalender | 0 | 0 | ja |
| 15 | Grimmelshausen | 16069016 | 161 | VG Feldstein | VG-Kalender (15 Termine, keiner hier) | VP 3728 | https://www.verwaltungsgemeinschaft-feldstein.de/veranstaltungen/index.php | 0 | 0 | nein |
| 16 | Brünn/Thür. | 16069006 | 391 | erf. Gem. Auengrund | Kalender Auengrund (15 Termine, Archiv 155, keiner hier) | VP 6933 | https://www.auengrund.de/veranstaltungen/index.php | 0 | 0 | nein |
| 17 | Oettern | 16071071 | 117 | VG Mellingen | VG-Kalender (1 Termin, nicht hier) | VP 20532 | https://www.vgem-mellingen.de/veranstaltungen/index.php | 0 | 0 | nein |
| 18 | Wiegendorf | 16071095 | 315 | VG Mellingen | wie 17 | VP 20532 | wie 17 | 0 | 0 | nein |
| 19 | Königsee, Stadt | 16073112 | 6.863 | erf. Gem. (selbst) | eigene Seite (HTML-Tabelle mit Ortsteilen) | ionas | https://www.koenigsee.de/aktuelles/veranstaltungen/ | 0 | 0 | ja |
| 20 | Kleinebersdorf | 16074047 | 170 | VG Hügelland/Täler | nur „Dorfkurier“ (PDF, Druckerei Richter Stadtroda) | WordPress, kein Kalender | https://hp.huegelland-taeler.de/dorfkurier/ | 0 | 0 | ja (nur PDF) |
| 21 | Schleifreisen | 16074084 | 421 | VG Hermsdorf | VG-Kalender (nur Hermsdorf) | Contao `mod_eventlist` | https://www.vg-hermsdorf.de/veranstaltungskalender.html | 0 | 0 | nein |
| 22 | Weißenborn | 16074109 | 1.110 | erf. Gem. Bad Klosterlausnitz | Seite des Bürgerhauses | Hugo 0.168.0 | https://www.buergerhaus-weissenborn.de/ | 0 | 0 | ja |
| 23 | Remptendorf | 16075134 | 3.052 | verbandsfrei | eigene Seite (22 Termine) | VP 1230 | https://www.remptendorf.de/veranstaltungen/index.php | 0 | 0 | ja |
| 24 | Kirschkau | 16075048 | 185 | VG Seenplatte | VG-Kalender (2 Termine, keiner hier) | VP 15585 | https://www.vg-seenplatte.de/veranstaltungen/index.php | 0 | 0 | nein |
| 25 | Pörmitz | 16075084 | 143 | VG Seenplatte | wie 24 | VP 15585 | wie 24 | 0 | 0 | nein |
| 26 | Weira | 16075121 | 374 | VG Oppurg | VG-Kalender (2 Termine, Nimritz) | VP 15389 | https://www.vg-oppurg.de/veranstaltungen/index.php | 0 | 0 | nein |
| 27 | Peuschen | 16075081 | 417 | VG Ranis-Ziegenrück | VG-Kalender (11 Termine, keiner hier) | VP 6830 | https://www.vg-ranis-ziegenrueck.de/veranstaltungen/index.php | 0 | 0 | nein |
| 28 | Seelingstädt | 16076069 | 1.125 | VG Ländereck | VG-Kalender (2 Termine, keiner hier) | VP 16986 | https://www.vg-laendereck.de/veranstaltungen/index.php | 0 | 0 | nein |
| 29 | Heukewalde | 16077016 | 189 | VG Oberes Sprottental | VG-Kalender leer | VP 3233 | https://www.vg-sprottental.de/veranstaltungen/index.php | 0 | 0 | nein |
| 30 | Ponitz | 16077039 | 1.391 | erf. Gem. Gößnitz | eigene Seite; ThüCAT | TYPO3 tx_news (JUSTORANGE Jena) | https://www.gemeinde-ponitz.de/veranstaltungen/ | 0 | 8 | ja |

Auffällig: Je kleiner die Gemeinde, desto seltener ein eigener Termin. Die 18 Gemeinden
unter 1.000 Einwohnern haben einen bestandenen Test (Ostramondra) plus einen nur im PDF
(Kleinebersdorf). Die Termine der Dörfer stehen vor allem im Amtsblatt und auf
Aushängen; Ostramondra verweist ausdrücklich auf „örtliche Aushänge und unsere
digitale Schautafel“.

## 2. Generics

### 2.1 verwaltungsportal.de mit „Thüringen vernetzt“

* **Betreiber:** Förderverein für regionale Entwicklung e.V., Nuthetal (00-bundesweit C7).
  In Thüringen läuft das Programm unter „Thüringen vernetzt“: http://thueringen-vernetzt.de/
  leitet auf https://www.azubi-projekte.de/ um (eigener Abruf, 200). Fünf Seiten der
  Gruppe C tragen den Link `thueringen-vernetzt.de` im Fuß, VG Oppurg schreibt „gefördert
  durch die Initiative ‚Thüringen vernetzt‘“, Sollstedt und Breitungen zeigen eigene
  Programmlogos („Sollstedt vernetzt“, „Breitungen Werra vernetzt“).
* **Gemeinden:** Zahl der Thüringer Seiten nicht belegt (keine Teilnehmerliste gefunden).
  Stichprobe: 15 Websites für 18 von 30 Gemeinden.
* **Zugriffsweg:** einheitliches HTML. Liste `/veranstaltungen/index.php` (Archiv
  `?archiv=1`, bei Mellingen 404), Detail `/veranstaltungen/<id>/<JJJJ>/<MM>/<TT>/<slug>.html`
  mit JSON-LD. Kein iCal, kein RSS. Amtsblätter im Modul `/amtsblatt/index.php`, Download
  nur per POST-Formular (`<form action="/amtsblatt/index.php#gazette_…" method="post">`).
  Öffentliches Formular „Veranstaltung kostenlos melden“ (Sollstedt, VG Feldstein).
* **Felder (Proben Remptendorf, VG Oppurg, VG Ländereck, VG Feldstein, Sollstedt):**
  JSON-LD `@type: Event`, `name`, `description`, `startDate` (mal nur Datum `2026-10-29`,
  mal mit Offset `2027-04-30T16:00:00+0200`), `endDate`, `image[]`
  (fotos.verwaltungsportal.de), `location` (`@type: Place`, `name`, teils
  `address{streetAddress, postalCode, addressLocality, addressCountry}`, `url`),
  `organizer` (`@type: Organization`, `name`, `address`, `url`). Keine Koordinaten. Ob
  `location.address` gefüllt ist, hängt von der Seite ab (Remptendorf ja, Oppurg und
  Ländereck nur Name). Ort und Veranstalter müssen deshalb über den Resolver laufen.
* **Erkennung:** `layout.verwaltungsportal.de/<Nummer>/`, `fotos.verwaltungsportal.de`,
  Fußlink `thueringen-vernetzt.de` oder `azubi-projekte.de`.
* **Lizenz/robots:** robots.txt überall gleich: `Disallow: /` und `Crawl-delay: 10` nur
  für eine Liste benannter Bots (u. a. AhrefsBot, SemrushBot), ClaudeBot mit
  Crawl-delay 10, keine Regel für `*`. Nutzungsbedingungen nicht belegt. Rechte an den
  Terminen liegen bei Gemeinde und Meldenden.
* **Beispiele:** Remptendorf https://www.remptendorf.de/veranstaltungen/index.php ;
  VG Feldstein https://www.verwaltungsgemeinschaft-feldstein.de/veranstaltungen/index.php ;
  Breitungen https://www.breitungen.de/veranstaltungen/index.php .
* **Füllstand (Termin-Links in der Liste):** Breitungen über 60, Bad Tennstedt 65,
  Remptendorf 22, Feldstein 15, Auengrund 15, Ranis-Ziegenrück 11, Greußen 3, Ebeleben 3,
  Seenplatte 2, Oppurg 2, Ländereck 2, Mellingen 1, Gera-Aue 0, Sprottental 0, Sollstedt
  nicht gezählt (mehrere Termine belegt).
* **Dorffest-Test:** „Kirmes Ruppersdorf 2026“, 29.10. bis 01.11.2026, Veranstalter
  Feuerwehrverein Ruppersdorfer e.V.
  https://www.remptendorf.de/veranstaltungen/2981205/2026/10/29/kirmes-ruppersdorf-2026.html ;
  „Kirmes in Niederbösa“ 30.10. bis 01.11.2026
  https://www.vgem-greussen.de/veranstaltungen/2989476/2026/10/30/kirmes-in-niederb%C3%B6sa.html ;
  „14 - 15 Kirmes Marisfeld“
  https://www.verwaltungsgemeinschaft-feldstein.de/veranstaltungen/2975029/2026/10/29/14-15-kirmes-marisfeld.html ;
  „Maibaum stellen“ in Linda, 30.04.2027, Feuerwehr- und Dorfverein Linda e.V.
  https://www.vg-laendereck.de/veranstaltungen/2880801/2027/04/30/maibaum-stellen.html ;
  „150 Jahre Feuerwehr Wülfingerode“, 03.06.2027
  https://www.sollstedt.de/veranstaltungen/2827207/2027/06/03/150-jahre-feuerwehr-w%C3%BClfingerode.html ;
  „Kirmes in Nimritz“ https://www.vg-oppurg.de/veranstaltungen/2983907/2026/11/01/kirmes-in-nimritz.html ;
  Weihnachtsmarkt Crock https://www.auengrund.de/veranstaltungen/2853108/2026/12/05/weihnachtsmarkt.html .
* **Nächster Schritt:** Liste der Thüringer Gemeinde- und VG-Websites bauen und das
  Merkmal `layout.verwaltungsportal.de` je Startseite prüfen (eine Anfrage je Host), dann
  ein Parser für Liste plus JSON-LD. Gleichzeitig beim Förderverein nach einer
  Teilnehmerliste und einer Datenschnittstelle fragen (Kontakt laut Programmflyern
  info@azubi-projekte.de, 0331 55047470). Ein Feed über alle Seiten würde die
  Anfragelast pro Gemeinde erübrigen.

### 2.2 ThüCAT (Thüringer Content Architektur Tourismus)

* **Betreiber:** Thüringer Tourismus GmbH, Datenbank „finanziert und erstellt“ vom
  Freistaat (https://open-data-germany.org/en/thuecat-the-concept-of-digital-tourism/).
  Eingepflegt von einem „Redaktionsnetzwerk aus touristischen Managementorganisationen,
  Kultur- und Freizeiteinrichtungen“ (https://cms.thuecat.org/en/datenquelle-thuecat).
  Veranstaltungen werden zusätzlich aus destination.one importiert (Beitrag
  „Erreichte Meilensteine im ThüCAT-Projekt 2024“, 08.01.2025,
  https://thueringen.tourismusnetzwerk.info/2025/01/08/erreichte-meilensteine-im-thuecat-projekt-2024/).
  Dass Gemeinden oder Vereine selbst Termine eintragen, ist nicht belegt; der
  Roadshow-Beitrag vom 24.02.2025 spricht nur von der „aktiven Einbindung von
  kommunalen Partnern“.
* **Menge:** Liste „alle Events“ https://cms.thuecat.org/events-redaktion zeigte 4.575
  Einträge; die Suche der Webkomponente (`widgets.thuecat.org/api/scenario/`, Filter
  `startDate` ab 27.10.2026) meldete `total: 4514`. Der Beitrag von 2025 nannte
  „durchschnittlich etwa 2.000 aktuelle Veranstaltungen“. Die Ortsfacette enthält auch
  hessische und bayerische Orte (Eschwege 102, Korbach 42, Bad Kissingen 58).
  Kategorien laut Facette u. a. `thuecat:CultureEvent` 1.688, `schema:TheaterEvent` 688,
  `schema:EducationEvent` 535, `thuecat:GuidedTourEvent` 503, `schema:SaleEvent` 303,
  `thuecat:Christmas` 207.
* **Zugriffsweg:** API mit Key. Wörtlich auf https://cms.thuecat.org/developer : „Zur
  Nutzung der Daten benötigen Sie einen API-Key, den Sie direkt von uns erhalten. Bitte
  teilen Sie uns mit, in welchem Projekt die Daten verwendet werden sollen und welche
  Daten Sie konkret benötigen.“ Dazu ein oder mehrere „Synchronisationsbereiche“.
  Formate html, json, xml, jsonld, jsonld-google; Vokabular schema.org plus `thuecat`
  (https://semantify.it/voc/bwHbicdQI), Domainspezifikation `ttgds:Event`. Einzelne
  Ressourcen unter `https://thuecat.org/resources/` brauchen keinen Key, Event-Listen
  laufen über die Sync-API `widgets.thuecat.org` mit Key und Kanal-ID
  (https://docs.typo3.org/p/werkraummedia/thuecat/main/en-us/Integration/SyncChannel.html).
  Die Webkomponenten fragen `widgets.thuecat.org/api/scenario/` per POST mit
  Konfigurations-ID ab; das ist der Zugang der eingebetteten Widgets, kein Zugang für
  Dritte.
* **Felder (Antwort der Webkomponente, Probe „Kirmes Essleben“):** `_id`
  (`e_<uuid>-tdm`), `_modifiedAt`, `minimal.title.de/en`, `minimal.description.de/en`,
  `minimal.photo` (`url`, `author`, `license`, z. B.
  `http://creativecommons.org/publicdomain/zero/1.0/`), `minimal.location`
  (`streetAddress`, `postalCode`, `addressLocality`), `geodata.location` (`lat`, `lon`),
  `eventdata.dates[]` (`startDate`, `endDate`, `startTime`), `eventdata.valid`.
  Koordinaten vorhanden, Titel zweisprachig.
* **Herkunftskennungen im `_id`:** `-hubev` (Nummern im Schema von destination.one, z. B.
  `e_101207920-hubev`, aber auch kurze wie `e_26962-hubev`), `-tdm`, `-kcev` und
  rein numerische IDs mit Kürzel (`-gmmp`, `-pmym`, `-wccw`, `-wjwq`). Was hinter den
  Kürzeln steht, ist nicht belegt. Alle vier echten Dorfkirmessen tragen `-tdm` und
  liegen im Landkreis Sömmerda.
* **Lizenz:** „Die Daten stehen unter Creative-Commons-Lizenzen zur freien Nutzung zur
  Verfügung“ (developer-Seite). Bildlizenz je Bild im Feld `license`; in den Proben
  CC0 und CC BY-SA 4.0. Bei CC BY und CC BY-SA ist der Urheber zu nennen
  (https://thueringen.tourismusnetzwerk.info/digitalisierung-tourismus/content-strategie-content-guide/open-data/).
  Damit ist ThüCAT die einzige Quelle in diesem Bericht mit offener Lizenz.
* **robots:** thuecat.org, widgets.thuecat.org, cdb.thuecat.org ohne robots.txt (404);
  cms.thuecat.org sperrt `Disallow: /*?` für alle.
* **Dorffest-Test (Suche der Webkomponente, unscharf, ab 27.10.2026):**

  | Suchwort | Treffer | davon echte Feste dieser Art |
  |---|---|---|
  | Kirmes | 13 | 5: Kirmes Essleben (Eßleben-Teutleben, 30.10.2026), Kirmes in Battgendorf (Kölleda, 07.11.2026), 33. Festzeltkirmes Riethnordhausen (29.10.2026), Kuhstallkirmes in Alperstedt (05.11.2026), 150. Mühlhäuser Stadtkirmes (27.08.2027) |
  | Feuerwehr | 12 | 2: 150 Jahre FF Ostheim und FF Oberwaldbehrungen (beide Bayern) |
  | Weihnachtsmarkt | 91 | nicht einzeln geprüft, u. a. „Weihnachtsmarkt am und im Schloss Ponitz 2026“ |
  | Dorffest | 1 | 0 |
  | Maibaum, Erntefest, Schützenfest, Heimatfest, Osterfeuer | 0 | 0 |

  Frühjahrs- und Sommerfeste 2027 sind im Oktober 2026 meist noch nicht erfasst; die
  Nullen bei Maibaum und Osterfeuer sind deshalb eine Untergrenze. Beispiel-ID:
  `e_c832cc94-2998-41fa-8393-1048578a034b-tdm` (Kirmes Essleben).
* **Stichprobe:** 3 von 30 Gemeinden mit mindestens einem Termin (Walschleben 3 Vorträge,
  Ostramondra „Volkstümlicher Nachmittag mit Regina Ross“, Ponitz 8 Termine samt
  Weihnachtsmarkt am Schloss). Der Unstrut-Hainich-Kreis bindet das ThüCAT-Widget in
  seinen Kreiskalender ein (https://www.unstrut-hainich-kreis.de/entdecken/veranstaltungen-1/).
* **Nächster Schritt:** API-Key bei der Thüringer Tourismus GmbH beantragen, Kontakt laut
  Open-Data-Seite Kathrin Meier, k.meier@thueringen-entdecken.de, 0361 3742209.
  Projektbeschreibung: Import aller Veranstaltungen Thüringens für lasstreffen.de, mit
  Bildnachweis. Danach Überschneidung mit destination.one über die `-hubev`-IDs messen.

### 2.3 LINUS WITTICH (Amtsblätter, meinOrt)

* **Landessicht zu 00-bundesweit B1:** 4 der 30 Gemeinden haben ein WITTICH-Amtsblatt:
  „Der Leinetalbote“ (VG Leinetal, Impressum „Verlag & Druck Linus Wittich GmbH“,
  https://vg-leinetal.de/amtsblatt/), „Neue Werra-Zeitung“ (Gerstungen, E-Paper
  `epaper.wittich.de/1662`), „Veilsdorfer Anzeiger“
  (https://www.wittich.de/produkte/zeitungen/1801-veilsdorfer-anzeiger), Amtsblatt der VG
  Gera-Aue (`secure.wittich.de/…heftnr=1659`). Anteil 4/30 = 13 %.
* Am Ohmberg und Ebeleben werben für eine „Mein Ort“-App (Ebeleben-News 28.04.2026). Die
  App von Am Ohmberg hat die Kennung `com.voidmod.meinort`; ob das WITTICH meinOrt ist,
  ist nicht belegt.
* **Zugriff:** PDF/E-Paper, kein Feed. **Nächster Schritt:** keiner eigener; Thüringen
  in das bundesweite WITTICH-Gespräch aufnehmen.

### 2.4 Weitere Funde (je ein- bis zweimal)

| Fund | Wo | Zugriff | Bewertung |
|---|---|---|---|
| GeoCMS von brain-SCC GmbH | Gerstungen; Kreisseiten Saale-Orla und Saale-Holzland | iCal je Termin (`?ical=1`, PRODID iCalWriter 0.8.1, Felder `DTSTART;VALUE=DATE`, `DTEND`, `SUMMARY`, `DESCRIPTION`, `LOCATION`, `CATEGORIES` „Musik,Volksfeste“, `URL`, `ATTACH`); robots Crawl-delay 15 | mittel, Zahl der Gemeinden nicht belegt |
| TYPO3 tx_news | Bad Tabarz (ideenwert), Ponitz (JUSTORANGE) | nur HTML, verschiedene Agenturen | kein Generic |
| WordPress ohne Kalender-Plugin | VG Kölleda, VG Hügelland/Täler | RSS der Beiträge, Termindatum nur im Text | kein Generic |
| The Events Calendar | VG Leinetal | REST vorhanden, `total: 0` | über Plugin-Detektor (00-bundesweit D1) |
| Contao `mod_eventlist` | VG Hermsdorf, Kreise Eichsfeld (leer) und Nordhausen | HTML mit Microdata | kein Generic |
| ionas | Königsee | HTML-Tabelle | kein Generic |
| KIV Thüringen | Amtsblätter Sollstedt, VG Mellingen (`portal.kiv-thueringen.de/KGatewayWebPortal/Publication/…`) | Bekanntmachungsportal des kommunalen IT-Dienstleisters (Gotha), keine Termine | nur Amtsblatt |
| freizeitkalender.eu | Kreiskalender Greiz (`/out/list/filter/359`) | robots sperrt u. a. `curl/` | prüfen, Betreiber und Lizenz nicht belegt |
| Kreiskalender Altenburger Land | https://www.altenburgerland.de/de/freizeit-tourismus/veranstaltungen | eigener Kalender mit Ortsfilter, kein Feed | niedrig |
| Eigenverlag-Amtsblätter | Hansteinkurier (VG Hanstein-Rusteberg, Anzeigen Diana Kohrs Mediendesign), Dorfkurier (Druckerei Richter Stadtroda), Ohmbergbote, Cölledaer Anzeiger | PDF per GET | vollständigste Dorftermine, aber PDF |

Nicht vorgekommen in 30 Gemeinden: Cross7, Heimat-Info/Cosmema, Advantic iKISS, NOLIS,
Modern Events Calendar, feratel, Outdooractive, DorfFunk/StadtLand.Funk, NUSSBAUM,
Riedel-Verlag. Riedel führt laut 00-bundesweit Thüringer Titel, in der Stichprobe
kein Treffer.

## 3. Dorffest-Test je Quelle

| Quelle | Beispiel | Datum | Link |
|---|---|---|---|
| verwaltungsportal.de | Kirmes Ruppersdorf 2026 (Remptendorf), Feuerwehrverein | 29.10. bis 01.11.2026 | https://www.remptendorf.de/veranstaltungen/2981205/2026/10/29/kirmes-ruppersdorf-2026.html |
| verwaltungsportal.de | Maibaum stellen, Linda (VG Ländereck) | 30.04.2027 | https://www.vg-laendereck.de/veranstaltungen/2880801/2027/04/30/maibaum-stellen.html |
| ThüCAT | Kirmes Essleben | 30.10. bis 01.11.2026 | ID `e_c832cc94-2998-41fa-8393-1048578a034b-tdm` |
| destination.one | Maibaumsetzen in Maua (Jena), Feuerwehrverein Maua | 01.05.2024 (vergangen) | ID `e_100834412`, Lizenz CC BY-SA |
| GeoCMS Gerstungen | Kirmes in Oberellen | 30.10. bis 01.11.2026 | https://www.gerstungen.de/de/veranstaltungen/event/52100,1085/kirmes-in-oberellen-30-10-2026.html |
| TYPO3 Bad Tabarz | Weihnachtsmarkt im TABBS | 28.11.2026 | https://www.bad-tabarz.de/veranstaltungen/detail/weihnachtsmarkt-im-tabbs |
| TYPO3 Ponitz | Ponitzer Weihnachtsmarkt am Renaissanceschloss | 05./06.12.2026 | https://www.gemeinde-ponitz.de/tourismus-freizeit/ponitzer-weihnachtsmarkt/ |
| TYPO3 Veilsdorf (Text) | Kirmes Veilsdorf, Nachkirmes, Weihnachtsmarkt Schackendorf | 23. bis 26.10., 21.11., 28./29.11.2026 | https://veilsdorf.de/kalender |
| ionas Königsee | Weihnachtsmarkt in Königsee | 27. bis 29.11.2026 | https://www.koenigsee.de/aktuelles/veranstaltungen/ |
| WordPress VG Kölleda | Kirmes Ostramondra, Erntedankfest, Weihnachtsmarkt (Jahresplan als Bild) | 07./08.11., 04.10., 27.11.2026 | https://vgem-koelleda.de/veranstaltungskalender-ostramondra-2025 |
| Vereins-/Bürgerhausseite | Kirmes-Frühschoppen, Bürgerhaus Weißenborn | 01.11.2026 | https://www.buergerhaus-weissenborn.de/ |
| Amtsblatt PDF (Eigenverlag) | Herbstkirmes in Rustenfelde (Burschenverein) | 23. bis 26.10.2026 | https://www.vg-hanstein-rusteberg.de/fileadmin/Dateiablage/PDF/Hansteinkurier/Kurier_10_2026_web.pdf |
| Dorfkurier PDF | Flitzlichtertreffen, Dorfverein Kleinebersdorf; Adventsglühen am Feuerwehrhaus Rattelsdorf | 07.11., 28.11.2026 | https://hp.huegelland-taeler.de/wp-content/uploads/2026/10/Dorfkurier4_226_klein.pdf |

## 4. Abgleich destination.one

`experience=open-data`, `q=area:"Thüringen"`: 386 Termine gesamt, 337 im Fenster
28.10.2026 bis 27.10.2027. Die 386 verteilen sich auf 32 Orte: Jena 207, Apolda 50,
Ilmenau 27, Eisenberg 13, Seitenroda 12, Erfurt 11, Rest einstellig. Datensatzlizenz
CC0 155, CC BY-SA 131, CC BY 66, PD 34. Festarten im Titel: kein „Kirmes“, kein
„Feuerwehrfest“; einziger Dorfbrauch „Maibaumsetzen in Maua“ (2024, vergangen), dazu
Weihnachtsmärkte in Jena, Eisenberg, Seitenroda.

Stichprobe mit `q=city:"<Name>"` im selben Fenster: **0 von 30** mit einem Thüringer
Treffer. „Blankenburg“ lieferte 20 Termine in 38889 (Blankenburg im Harz), nicht die
Thüringer Gemeinde. Kontrolle `city:"Jena"`: 178. Einschränkung: Orte mit Ortsteilen
(Am Ohmberg, Gerstungen) wurden nur mit dem Gemeindenamen abgefragt.

## 5. Abdeckung (nur Stichprobenanteil)

| Kennzahl | Formel | Wert | 95 %-Intervall (Wilson) |
|---|---|---|---|
| Verwaltungsauftritt auf verwaltungsportal.de | 18 / 30 | 60 % | 42 % bis 75 % |
| verwaltungsportal-Seite führt mindestens einen Termin | 13 / 15 Seiten | 87 % | |
| Termin genau dieser Gemeinde im verwaltungsportal-Kalender | 2 / 18 (Sollstedt, Remptendorf) | 11 % | |
| Dorffest-Beleg online für diese Gemeinde (alle Quellen) | 10 / 30 | 33 % | |
| Termin in ThüCAT | 3 / 30 | 10 % | |
| Termin in destination.one | 0 / 30 | 0 % | |
| WITTICH-Amtsblatt | 4 / 30 | 13 % | |

Wilson-Intervall für 18/30: z = 1,96, Mitte (0,6 + z²/60) / (1 + z²/30) = 0,589,
Halbbreite 1,96 · √(0,6·0,4/30 + z²/3600) / (1 + z²/30) = 0,165. Eine Hochrechnung
auf die 566 Gemeinden ist damit nur als Spanne zulässig und nicht belegt.

## 6. Priorisierte Liste für Thüringen

| # | Integration | Gemeinden (Beleg) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | verwaltungsportal.de (Parser Liste + JSON-LD) | 18/30 der Stichprobe; Gesamtzahl nicht belegt | Datum, Ort als Name (teils Adresse), Veranstalter, Bild; keine Koordinaten; Kalender oft dünn | Nutzungsbedingungen nicht belegt; robots erlaubt `*` | Website-Liste aller TH-Gemeinden und VGs aufbauen, Merkmal prüfen; Förderverein nach Teilnehmerliste und Feed fragen |
| 2 | ThüCAT Sync-API | 3/30 der Stichprobe; 4.514 Termine landesweit | sehr gut: Koordinaten, Zeiten, zweisprachig, Bildlizenz je Bild | CC-Lizenzen laut Betreiber, Key auf Anfrage | API-Key bei der TTG beantragen (Kontakt in 2.2) |
| 3 | WITTICH (Amtsblatt, meinOrt) | 4/30 | nur PDF, sonst nicht belegt | AGB verbieten Abzug ohne Zustimmung (00-bundesweit B1) | im bundesweiten WITTICH-Gespräch mitverhandeln |
| 4 | GeoCMS brain-SCC iCal | 1/30 Gemeinde, 2 Kreise | iCal je Termin mit Kategorie „Volksfeste“ | nicht belegt; Kreisseiten per robots gesperrt | Kundenliste brain-SCC prüfen, Listen-Feed suchen |
| 5 | Plugin-Detektor (00-bundesweit D1) | 1/30 (Tribe, leer) | gut, wenn gefüllt | Gemeinde-Websites | mitlaufen lassen, kein eigener Aufwand |
| 6 | Kreiskalender (Greiz/freizeitkalender.eu, Altenburger Land, UH-Kreis termine.uh-kreis.de) | je ein Kreis | unterschiedlich | nicht belegt | je Kreis Software und Lizenz prüfen, nachrangig |
| | Nicht weiter verfolgen | | | | Eigenverlag-PDFs (nur mit PDF-Parser, eigenes Projekt), KIV-Bekanntmachungsportal (keine Termine), Einzel-CMS ohne Feed |

**Lücken:** Dörfer unter 1.000 Einwohnern veröffentlichen ihre Feste fast nur im
Amtsblatt (PDF), auf Aushängen oder bei Facebook. Weder verwaltungsportal noch ThüCAT
noch destination.one führen sie verlässlich. Diese Lücke schließt nur ein PDF-Weg
(Amtsblatt-Terminlisten) oder ein Kanal, über den Vereine selbst melden; beides ist
eigenes Projekt. Auch nicht belegt: Zahl der Thüringer verwaltungsportal-Seiten,
Bedeutung der ThüCAT-Kürzel, Verlage der meisten VG-Amtsblätter (POST-Download).

## 7. Anfragen

Alle Anfragen am 27.10.2026, lesend. Gemeinde- und VG-Hosts: höchstens 7 je Host
(vg-hanstein-rusteberg.de und vg-leinetal.de je 7, knapp über der Vorgabe von etwa 6),
sonst höchstens 6.

| Host | Anfragen | Status |
|---|---|---|
| www.destatis.de | Gemeindeverzeichnis-Auszug | 200 |
| meta.et4.de | 2 Tests (Kodierung), 2 Datumsformate, 1 × `area:"Thüringen"` `limit=500`, 30 × `city:"<Gemeinde>"`, 1 × Kontrolle Jena | 36 × 200 |
| docs.typo3.org | 7 Seiten der Extension thuecat | 4 × 200, 3 × 404 |
| thuecat.org, widgets.thuecat.org, cdb.thuecat.org | je `/robots.txt`, dazu `thuecat.org/` | 404, 404, 404, 200 |
| cms.thuecat.org | `/robots.txt`, `/developer`, `/en/events-redaktion`, `/en/datenquelle-thuecat` (WebFetch), im Browser `/events-redaktion` und `/interaktiver-kalender` | 200 |
| widgets.thuecat.org `/api/scenario/` | rund 70 POST-Anfragen, ausgelöst durch die Webkomponente auf `/interaktiver-kalender` bei 11 Festart- und 30 Gemeindesuchen im Browser (davon 10 versehentliche Wiederholungen der Suche „Kirmes“) | 200 |
| thueringen.tourismusnetzwerk.info | 4 Beiträge (WebFetch) | 200 |
| thueringen-vernetzt.de | `/` (Umleitung auf azubi-projekte.de), www-Variante ohne Verbindung | 200 / 000 |
| portal.kiv-thueringen.de | `/robots.txt`, `/` | 200 |
| www.wittich.de | `/robots.txt`, `/produkte/zeitungen` | 200 |
| Gemeinde-, VG- und Kreisseiten | Gruppe A 69, Gruppe B 46, Gruppe C 65 Anfragen; Einzelliste in den Arbeitsprotokollen, Hosts und Pfade in den Tabellen oben | 200, einzelne 301/302/303/404/000 |

**Abweichungen von den Regeln, offen benannt:**

* Die Suchen in der ThüCAT-Webkomponente sind POST-Anfragen, die die eingebettete
  Komponente selbst stellt; sie lesen nur. Die Liste `cms.thuecat.org/events-redaktion`
  leitet beim Laden selbst auf `?q=` um, ein Pfad, den die robots.txt (`Disallow: /*?`)
  sperrt. Beide Seiten wurden einmal wie von einem Besucher im Browser geöffnet; weitere
  Abrufe gesperrter Pfade gab es nicht. Für einen Import zählt nur der API-Key-Weg.
* Gruppe C hat die Startseiten von saale-orla-kreis.de und saaleholzlandkreis.de je
  einmal abgerufen, obwohl deren robots.txt `User-agent: *` / `Disallow: /` sagt (beide
  Dateien liefen im selben Befehl). Die einzige daraus übernommene Angabe ist der
  Generator „GeoCMS 5.51.02 brain-SCC“; weitere Abrufe gab es nicht.
* Ausgewertete PDFs: Hansteinkurier 10/2026 und Dorfkurier 4/2026 (je eines). Keine
  POST-Formulare der Amtsblatt-Module abgeschickt, keine Cookies gesetzt.
