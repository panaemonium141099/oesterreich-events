# Gemeindekalender Schleswig-Holstein (Stand 2026-10-27)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.4`. Frage: Über welche
gemeinsamen Plattformen, CMS-Hersteller, Ämter, Amtsblätter oder offenen
Schnittstellen kommen wir an die Feste kleiner Gemeinden in Schleswig-Holstein
(Laternelaufen, Feuerwehrfeste, Ringreiten, Vogelschießen, Gilde- und Erntefeste,
Weihnachtsmärkte)? Bundesweite Anbieter stehen in [00-bundesweit.md](00-bundesweit.md)
und werden hier nur aus Landessicht ergänzt. Alle Anfragen mit Zahl je Host:
[03-schleswig-holstein-anfragen.md](03-schleswig-holstein-anfragen.md).

Arbeitsweise: nur lesende GET-Anfragen, keine Konten, keine Formulare, keine Mails.
Jede Zahl stammt aus einer eigenen Antwort vom 27.10.2026 oder einer verlinkten
Seite. „Eigenangabe“ heißt Werbeaussage des Betreibers, „selbst gezählt“ heißt aus
einer abgerufenen Liste gezählt, „nicht belegt“ heißt nicht nachweisbar.

## Kurzfazit

1. **Die Ämter sind in SH meist keine Kalenderebene.** Von den 25 Ämtern der
   Stichprobe führen 4 einen Kalender mit Vereins- und Dorfterminen ihrer Gemeinden
   (Mitteldithmarschen, Boostedt-Rickling, Kropp-Stapelholm, Mittelholstein). Die
   übrigen haben keinen Kalender, nur Sitzungstermine oder einen leeren Kalender. Die
   Ausgangshypothese „Ämter als Kalenderebene“ trägt also nur für einen Teil.
2. **Der stärkste Einzelhebel ist termine-regional.de** der NetzWerkstatt GmbH & Co. KG
   aus Rendsburg. Der Ortsfilter führt 291 SH-Gemeinden mit amtlichem
   Gemeindeschlüssel (selbst gezählt), darunter 10 der 30 Stichprobengemeinden. Lensahn
   und der Kreis Dithmarschen binden diese Daten ein; die Detailseite trägt Ortsschlüssel
   (`kgs`) und Koordinaten. Export und API gibt es laut Anbieter nur gegen Entgelt.
3. **Die TA.SH stellt ihre Landesdatenbank offen bereit.** Auf dem Open-Data-Portal
   des Landes liegt täglich aktualisiert „Veranstaltungen der Touristischen
   Landesdatenbank“ (4.618 Datensätze, 4.350 mit Termin bis 27.10.2027, Lizenz je Eintrag
   CC0, CC BY oder CC BY-SA). Kleine Gemeinden deckt sie kaum ab: 4 von 30.
4. **Zwei SH-Hersteller tragen die Ämter-Websites:** Advantic iKISS (7 von 25 Ämtern,
   Kalender dort fast nur Sitzungen, Export per robots.txt gesperrt) und communice von
   inixmedia aus Schwentinental (6 von 25 Ämtern, offener Atom-Feed
   `/veranstaltungen/rss`). communice ist der beste technische Generic: Mitteldithmarschen
   liefert damit 210 Termine aus 12 Orten, darunter Laternenumzüge und Weihnachtsmärkte.
5. **destination.one deckt kleine SH-Gemeinden fast nicht ab:** 3 von 30 Gemeinden mit
   mindestens einem Termin; SH-typische Feste im Titel (Ringreiten, Vogelschießen,
   Schützenfest, Biikebrennen) 0.
6. **Ringreiten, Vogelschießen und Gildefeste stehen in keiner strukturierten Quelle.**
   Sie fanden sich nur auf Vereins- und Gemeindeseiten (Bohmstedt: Ringreiten und
   Amtsringreiten) oder bei festivalsindeutschland.de, dessen AGB die Nutzung verbieten.
7. **8 von 30 Gemeinden veröffentlichen nirgends auffindbar Termine.** In 16 von 30
   fand sich ein belegtes Fest oder Feuerwehr- bzw. Vereinsfest.

## Grundgesamtheit und Stichprobe

**Gemeinden in SH** (Destatis GV-Auszug, Stichtag 30.09.2026,
https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/AuszugGV3QAktuell.xlsx?__blob=publicationFile ,
selbst gezählt): 1.104 Gemeinden, davon 1.048 unter 10.000 Einwohnern. Nach
Gemeindeverband: 974 Gemeinden in 81 Ämtern (Textkennzeichen 51), 45 Gemeinden in den
beiden Verbänden mit Kennzeichen 55 (Eider, Heider Umland), 85 amtsfreie Gemeinden
(Kennzeichen 50). Ein Amt hat im Median 11 Gemeinden, höchstens 34 (Amt Eider; die
Website nennt es „Amt Kirchspielslandgemeinden Eider“, https://www.amt-eider.de/startseite).

**Ziehung:** alle Zeilen mit Satzart 60 und Land 01, Einwohner (31.12.2025) unter
10.000, sortiert nach Regionalschlüssel; daraus `random.Random(20261027).sample(liste, 30)`
in Python 3.14, Ausgabe nach Schlüssel sortiert. Alle 30 Gemeinden sind amtsangehörig;
sie verteilen sich auf 25 Ämter in 11 Kreisen. Das Amt Hörnerkirchen ist inzwischen
Teil der Verwaltungsgemeinschaft Barmstedt-Hörnerkirchen
(https://www.vg-barmstedt-hoernerkirchen.de, amt-hoernerkirchen.de leitet um).

**Spalten:** Fundort = Hauptfundort der Veranstaltungen. d.one = Treffer in
destination.one `experience=open-data`, `q=city:"<Gemeinde>"`, Fenster 28.10.2026 bis
27.10.2027, gegen PLZ geprüft. TA.SH = Treffer im offenen Landesdatensatz (Ortsname und
PLZ, gleiches Fenster). t-r = Gemeinde steht per Gemeindeschlüssel im Ortsfilter von
termine-regional.de.

| # | Gemeinde | AGS | EW | Fundort | Plattform Gemeinde / Amt | Link Fundort | d.one | TA.SH | t-r |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Tellingstedt | 01051114 | 2.792 | Gemeinde-Website | Eigenbau-PHP / TYPO3 NetzWerkstatt (Amt Eider) | https://tellingstedt.de/termine/ | 1 | 1 | nein |
| 2 | Westerborstel | 01051131 | 105 | nirgends | Amts-Unterseite / TYPO3 NetzWerkstatt | https://www.amt-eider.de/gemeinden/westerborstel | 0 | 0 | nein |
| 3 | Meldorf, Stadt | 01051074 | 7.158 | Amts-Kalender (zugleich Stadtseite) | communice / communice (Mitteldithmarschen) | https://www.stadt-meldorf.de/tourismus-kultur/veranstaltungen/veranstaltungskalender | 3 | 5 | ja |
| 4 | Norddeich | 01051079 | 419 | Gemeinde-Website | Zeta Producer 16.2 / NOLIS (Büsum-Wesselburen) | http://www.norddeich-sh.de/veranstaltungskalender.html | 0 | 0 | ja |
| 5 | Worth | 01053135 | 172 | nirgends | Amts-Unterseite / iKISS (Hohe Elbgeest) | https://www.amt-hohe-elbgeest.de/Gemeinden/Worth/Aktuelles/Veranstaltungen/ (leer) | 0 | 0 | nein |
| 6 | Groß Grönau | 01053041 | 3.761 | Gemeinde-Website (nur Sitzung) | WordPress My Calendar / Contao (Lauenburgische Seen) | https://gross-groenau.de/ | 0 | 0 | nein |
| 7 | Kankelau | 01053059 | 212 | nirgends (einziger Suchtreffer bei hamburg-tourism.de jetzt 404) | keine Website / iKISS (Schwarzenbek-Land) | https://www.amt-schwarzenbek-land.de/Aktuell/Veranstaltungen/ | 0 | 0 | nein |
| 8 | Behrendorf | 01054011 | 577 | nirgends | Amts-Unterseite / iKISS (Viöl) | https://www.amt-vioel.de/Amt-Gemeinden-Verb%C3%A4nde/Gemeinden/Behrendorf/ | 0 | 0 | nein |
| 9 | Rodenäs | 01054110 | 397 | Gemeinde-Website | IONOS MyWebsite / iKISS (Südtondern) | https://www.rodenaes.de/veranstaltungskalender-2026/ | 0 | 0 | nein |
| 10 | Bohmstedt | 01054012 | 819 | Gemeinde-Website | WordPress (Beiträge, RSS) / TYPO3 NetzWerkstatt (Mittleres Nordfriesland) | https://bohmstedt.de/category/ankuendigung-termine/ | 0 | 0 | nein |
| 11 | Neukirchen | 01055031 | 1.153 | Verein (Feuerwehr) | keine Website / communice (Oldenburg-Land, Kalender leer) | https://ffn-ostsee.de/termine/ | 0 | 0 | nein |
| 12 | Lensahn | 01055027 | 4.979 | Amts-Kalender | TYPO3 NetzWerkstatt mit termine-regional.de (Amt = Gemeindeseite) | https://www.lensahn.de/aktuelles/veranstaltungskalender | 1 | 5 | ja |
| 13 | Osterhorn | 01056038 | 405 | nirgends | keine Website / TYPO3 (VG Barmstedt-Hörnerkirchen) | https://www.vg-barmstedt-hoernerkirchen.de/amt-hoernerkirchen/gemeinde-osterhorn | 0 | 0 | nein |
| 14 | Kummerfeld | 01056032 | 2.467 | Gemeinde-Website (Fließtext) | WordPress + Elementor / iKISS (Pinnau) | https://gemeinde-kummerfeld.de/ | 0 | 0 | nein |
| 15 | Boksee | 01057010 | 460 | Gemeinde-Website | Jimdo / TYPO3 (Preetz-Land) | https://boksee.jimdoweb.com/boksee/termine/ | 0 | 0 | nein |
| 16 | Postfeld | 01057059 | 423 | Gemeinde-Website | verwaltungsportal.de / TYPO3 (Preetz-Land) | http://www.postfeld.de/veranstaltungen/index.php | 0 | 0 | nein |
| 17 | Bredenbek | 01058028 | 1.540 | Gemeinde-Website (Meldungen) | TYPO3 tx_news / TYPO3 + Kalender.digital (Achterwehr) | https://www.bredenbek.de/aktuelles | 0 | 0 | nein |
| 18 | Noer | 01058116 | 834 | Verein | WordPress (Verein NLSV) / ionas3 (Dänischenhagen) | https://wirsindnoer.de/aktuelles | 0 | 0 | nein |
| 19 | Hohenwestedt | 01058077 | 5.397 | Gemeinde-Website (PDF) | TYPO3 / communice (Mittelholstein) | https://www.hohenwestedt.de/medien/dokumente/Kalender.pdf | 0 | 0 | ja |
| 20 | Thaden | 01058161 | 237 | nirgends | Amts-Unterseite / communice (Mittelholstein) | https://www.amt-mittelholstein.de/unser-amt/herzlich-willkommen/unsere-gemeinden/thaden | 0 | 0 | nein |
| 21 | Struxdorf | 01059082 | 663 | Amtsblatt (PDF) | keine Website gefunden / iKISS (Südangeln) | https://www.amt-suedangeln.de/media/custom/1659_3929_1.PDF | 0 | 0 | ja |
| 22 | Alt Bennebek | 01059001 | 347 | Amts-Kalender | keine Website / WordPress The Events Calendar (Kropp-Stapelholm) | https://kropp.de/veranstaltungen/ | 0 | 0 | nein |
| 23 | Lentföhrden | 01060054 | 2.550 | Gemeinde-Website | WordPress + Elementor / verwaltungsportal.de (Auenland Südholstein, leer) | https://www.lentfoehrden.de/ | 0 | 0 | ja |
| 24 | Schmalfeld | 01060073 | 1.969 | nirgends (Website HTTP 500) | Joomla / verwaltungsportal.de | http://schmalfeld.net | 0 | 0 | nein |
| 25 | Groß Kummerfeld | 01060028 | 1.920 | Amts-Kalender | communice / communice (Boostedt-Rickling) | https://www.grosskummerfeld.de/veranstaltungen | 0 | 0 | ja |
| 26 | Rickling | 01060068 | 3.078 | Amts-Kalender | communice / communice (Boostedt-Rickling) | https://www.gemeinde-rickling.de/leben-erleben/angebote-fuer-alle-generationen/veranstaltungskalender | 0 | 0 | ja |
| 27 | Traventhal | 01060091 | 515 | Tourismusdatenbank | Amts-Unterseite / Hersteller nicht belegt (Trave-Land) | https://www.hamburg-tourism.de/sehen-erleben/veranstaltungen/veranstaltungskalender/gestuets-weihnacht-1/ | 0 | 1 | nein |
| 28 | Rosdorf | 01061093 | 354 | nirgends | Amts-Unterseite / communice (Kellinghusen) | https://www.amt-kellinghusen.de/unser-amt-kennenlernen/herzlich-willkommen/unsere-gemeinden | 0 | 0 | nein |
| 29 | Rethwisch | 01062062 | 1.165 | Gemeinde-Website (ICS der Dorfzeitung) | communice / communice (Bad Oldesloe-Land) | https://datt-blatt.de/veranstaltungskalender/ | 0 | 0 | ja |
| 30 | Bargfeld-Stegen | 01062005 | 2.954 | Gemeinde-Website | TYPO3 `tx_calendar_pi1` / iKISS (Bargteheide-Land) | https://www.bargfeld-stegen.de/gemeinde-info/termine/ | 0 | 0 | ja |

Hinweise: Bei Neukirchen liefert `city:"Neukirchen"` 59 Treffer aus anderen Orten
gleichen Namens, keiner mit PLZ 23779. Die Startseite von datt-blatt.de enthielt am
27.10.2026 eingeschleusten fremden Text mit Glücksspiel-Link; die Seite wirkt
kompromittiert, der ICS-Dienst liegt auf eigenem Host (https://ics.datt-blatt.de/).
Auf struxdorf.de läuft eine „Dorf-App“ (React, eigenes Backend), Betreiber und
Termininhalt nicht geprüft.

**Fundorte gezählt:** Gemeinde-Website 13, Amts-Kalender 5, Verein 2, Amtsblatt 1,
Tourismusdatenbank 1, nirgends 8.

### Die 25 Ämter

| Amt | Hersteller (Merkmal) | Kalender mit Dorfterminen | Feed |
|---|---|---|---|
| Eider | TYPO3 NetzWerkstatt (`nwsscaffolding_*`) | nein, nur Sitzungen (RIS) | nein |
| Mitteldithmarschen | communice (`tx_communicecalendar_*`) | ja, 210 Termine aus 12 Orten | Atom, iCal |
| Büsum-Wesselburen | NOLIS (`fonts.nol-is.de`) | nein, 14 von 14 Terminen Sitzungen | iCal, RSS |
| Viöl | Advantic iKISS | nein, nur Sitzungstermine | nein |
| Südtondern | Advantic iKISS | nein | nein |
| Mittleres Nordfriesland | TYPO3 NetzWerkstatt | nein, PDF-Jahresübersicht | nein |
| Hohe Elbgeest | Advantic iKISS | teilweise, 43 Termine, Proben Sprechstunden und Seniorennachmittag | iCal je Termin unter `/output/`, per robots.txt gesperrt |
| Lauenburgische Seen | Contao | nein, nur Sitzungen | nicht belegt |
| Schwarzenbek-Land | Advantic iKISS | nein, 2 Termine | `/output/` gesperrt |
| Oldenburg-Land | communice | nein, Kalender leer | nein |
| Lensahn | TYPO3 NetzWerkstatt `tx_nwsregionalevents_pi1` | teilweise, 31 Termine, fast nur Lensahn | iCal je Termin |
| Bad Oldesloe-Land | communice | nein, kein Kalender gefunden | nein |
| Bargteheide-Land | Advantic iKISS | nein, nur Links auf Gemeindeseiten | `/output/` gesperrt |
| VG Barmstedt-Hörnerkirchen | TYPO3 | nein | nein |
| Pinnau | Advantic iKISS | nein, kein Kalender | nein |
| Preetz-Land | TYPO3 | nein, kein Kalender | nein |
| Achterwehr | TYPO3, Kalender.digital (Angular) | nein, Gemeindekalender Achterwehr | nicht belegt |
| Dänischenhagen | `CMS ionas3` | nein, kein Kalender | nein |
| Mittelholstein | communice | ja, amtsweit (Aukrug, Hanerau-Hademarschen, Todenbüttel, Hohenwestedt) | Atom |
| Südangeln | Advantic iKISS (`iKISS Version 4.0`) | nein, Termine nur in der „Südangeln Rundschau“ (PDF) | RSS nur Bekanntmachungen |
| Kropp-Stapelholm | WordPress The Events Calendar | ja, 15 Gemeinden, 2.679 Termine | Tribe-REST, iCal |
| Auenland Südholstein | verwaltungsportal.de | nein, Kalender leer | nein |
| Boostedt-Rickling | communice | ja, 6 Gemeinden, 185 Termine | Atom, iCal je Termin |
| Trave-Land | nicht belegt (`/:res/modules/`) | nein, statische Termine | nein |
| Kellinghusen | communice | teilweise, 34 Termine, fast nur Stadt Kellinghusen | Atom |

Ämter mit Dorfterminen ihrer Gemeinden: 4 von 25 (Mitteldithmarschen, Mittelholstein,
Kropp-Stapelholm, Boostedt-Rickling); 3 weitere teilweise (Hohe Elbgeest, Lensahn,
Kellinghusen). Kreiskalender: nur Dithmarschen (Regionalportal, Daten von
termine-regional.de) war eingebunden; für Herzogtum Lauenburg, Ostholstein, Stormarn,
Pinneberg, Plön, Rendsburg-Eckernförde, Schleswig-Flensburg, Segeberg, Steinburg und
Nordfriesland fand sich auf den geprüften Seiten keiner.

## Generics

### G1. termine-regional.de (NetzWerkstatt, Rendsburg)

* **Betreiber:** die NetzWerkstatt GmbH & Co. KG, An der Schiffbrücke 2, 24768 Rendsburg
  (https://www.termine-regional.de/impressum). Dieselbe Firma baut die TYPO3-Seiten der
  Ämter Eider und Mittleres Nordfriesland und des Regionalportals Dithmarschen
  (robots-Kommentar „Old NWS“, Präfix `nws`). Bundesweite Einordnung: 00-bundesweit C6.
* **Gemeinden:** Die Listenseite https://www.termine-regional.de/veranstaltungen nennt
  „17859 Veranstaltungen“. Ihr Ortsfilter `tx_nwsregionalevents_pi1[place]` hat 565
  Orte mit Gemeindeschlüssel als Wert (z. B. `01051074` Meldorf), davon 291 gültige
  SH-Gemeinden, 237 davon unter 10.000 Einwohnern (selbst gezählt gegen Destatis).
  Je Kreis: Schleswig-Flensburg 67, Rendsburg-Eckernförde 34, Segeberg 33,
  Ostholstein 28, Steinburg 26, Stormarn 25, Plön 20, Dithmarschen 17, Herzogtum
  Lauenburg 14, Pinneberg 14, Nordfriesland 9. Ob jeder gelistete Ort aktuell Termine
  hat, ist nicht belegt. Stichprobe: 10 von 30.
* **Einbindung belegt:** Lensahn („Diese Veranstaltungen werden von termine-regional.de
  bereitgestellt“, https://www.lensahn.de/aktuelles/veranstaltungskalender) und Kreis
  Dithmarschen („Die Termine stammen von der Plattform ‚Termine regional‘“,
  https://regionalportal.dithmarschen.de/aktuelles/terminkalender). Grünes Binnenland
  verlinkt die Plattform. Advantic nennt eine bidirektionale Schnittstelle (00-bundesweit C3).
* **Zugriff:** Liste und Filter nur per POST-Formular (Extbase, `cHash`); ein GET mit
  Ortsparameter antwortete 404. Detailseiten sind offen und tragen ein eingebettetes
  JSON-Objekt; je Termin ein iCal unter
  `/veranstaltungen/details/ical/<slug>-<id>/event.ics`. Laut Anbieter „Datenexport“ und
  „Bidirektionaler Datenaustausch per API“, Preise auf Anfrage
  (https://www.termine-regional.de/kunden/homepage-integration).
* **Felder (Probe Herbst-Jahrmarkt Heide, ID 9489500):** `id`, `clientId`, `organizer`
  (`id`, `title`, `street`, `zip`, `city`), `categories[]`, `kgs` (1051044 = Heide),
  `locationName`, `locationAddress`, `locationPlace`, `beginTimestamp`, `beginTime`,
  `endTime`, `title`, `descriptionLong`, `eventType`, `venueId`, `geoLat`, `geoLng`.
  iCal: `SUMMARY`, `DTSTART;TZID=Europe/Berlin`, `DTEND`, `ORGANIZER;CN=`, `LOCATION`,
  `GEO`, `DESCRIPTION`; die `UID` ist je Abruf neu (Sabre VObject), Schlüssel ist die ID.
* **Lizenz/robots:** robots.txt sperrt nur `/typo3/`. Nutzungsbedingungen für Dritte
  nicht gefunden; „Die Verantwortung für die sachliche Richtigkeit der Angaben liegt bei
  den Veranstaltern.“
* **Beispiele:** Meldorf (`01051074`), Lensahn (`01055027`), Rethwisch (`01062062`) im
  Ortsfilter; Detail
  https://www.termine-regional.de/veranstaltungen/details/ansicht/herbst-jahrmarkt-9489500 .
* **Dorffest-Test:** teilweise. Belegt ist ein Volksfest („Das Volksfest mit zahlreichen
  Fahrgeschäften“, Herbst-Jahrmarkt Heide, 27.10.2026, Link oben). Ein Dorffest war auf
  den ohne Formular sichtbaren Seiten nicht dabei; gezielt suchen lässt sich nur per POST.

### G2. Touristische Landesdatenbank (TA.SH), Open-Data-Datensatz

* **Betreiber:** Tourismus-Agentur Schleswig-Holstein GmbH im Auftrag des
  Wirtschaftsministeriums. Pressemitteilung 05.09.2022: „60.000 Veranstaltungen uvm.“
  und „wir stellen nur Datenbestände ein, die … ohne Einschränkung zur Weiterverbreitung
  und zur Weiterverwendung zugänglich … sind“
  (https://www.presseportal.de/download/document/6315acef270000fd2c6a6502-pi-sh-opendata-touri-ellenfinder-fin.pdf).
  Plattform: imx.Platform von infomax; der Landeskalender
  https://www.sh-veranstaltungskalender.de (Weiterleitung auf sh-tourismus.de) bindet
  `tash.whitelabel.imxplatform.de/widget/widget.js` ein, Widget-ID 8.
* **Offener Weg:** Datensatz
  https://opendata.schleswig-holstein.de/dataset/veranstaltungen-der-touristischen-landesdatenbank
  („Andere offene Lizenz“, Ressource `events.json.gz`, 7.078.336 Byte, Stand
  27.10.2026 05:47). Beschreibung: Lizenz „jeweils … an den einzelnen Einträgen“ in
  `mediaLicense`.
* **Inhalt (selbst gezählt):** 4.618 Datensätze, 4.350 mit Termin 28.10.2026 bis
  27.10.2027. Lizenzen davon: CC-BY 2.413, CC0 999, CC-BY-SA 938. Relevanz: regional
  2.818, local 1.332, superregional 200. 263 Orte; Spitze Lübeck 1.300, Wyk 204,
  Ahrensburg 170. Herkunft (`importRun.importSource`): `miadi_event` 1.389, ohne 1.159,
  `secra_event` 362, `etcAmrum` 323, `etc` 304, `et4EventImportSource` 298 (also
  destination.one), `deskline3` 267, `muk_luebeck_events` 133, `tomasSwm` 105,
  `hht_eventmanager` 10. 149 Ortsnamen entsprechen SH-Gemeinden unter 10.000 Einwohnern.
* **Felder:** `id`, `title.de`, `shortDescription.de`, `longDescription.de`,
  `eventDates[]` (`date`, `startTime`, `duration`, `soldout`), `cancelled`,
  `location.title`, `location.geoInfo` (`street`, `streetNo`, `zipcode`, `city`,
  `coordinates.latitude/longitude`), `client.name`, `author`, `categories[].i18nName.de`,
  `mediaLicense.i18nName.de`, `media[]` (mit `pooledMedium.copyright`, Lizenz je Bild),
  `link.de`, `permaLink.de`, `pricing.freeOfCharge`, `relevance.name`, `importRun`.
* **Geschlossener Weg:** Das Widget fragt GraphQL
  `https://content-delivery.imxplatform.de/tash/imxplatform` mit einem im Skript
  eingebetteten Bearer-Token ab. Nicht genutzt; ohne Vereinbarung kein Zugang für uns.
  robots.txt des Widget-Hosts: `Crawl-delay: 5`.
* **Dorffest-Test:** bestanden. „Sommerfest der Freiwilligen Feuerwehr Nebel“ 03.07.2027
  (ID 215310), „Dorffest in Nebel“ 07.08.2027 (ID 210768), „Scharbeutzer Schützenfest“
  16.07.2027 (ID 217767), „Halloween-Laternenumzug der Jugendfeuerwehr Burg“ 31.10.2026
  (Fehmarn). Treffer im Titel (Fenster): Weihnachtsmarkt 69, Laterne 17, Feuerwehr 8,
  Biike 5, Schützen 3, Dorffest 2, Ringreit 0, Vogelschie 0, Gilde 0.
* **Beispiele Stichprobe:** Meldorf „Weihnachtsmarkt der Kunsthandwerker“ 12.12.2026
  (ID 191001), Traventhal „Gestüts-Weihnacht“ (ID 196738), Lensahn 5 Termine.
* **Lizenzfolge:** CC BY verlangt Namensnennung je Eintrag (`author`, Bild-`copyright`);
  CC BY-SA zusätzlich Weitergabe unter gleicher Lizenz. Für CC-BY-SA-Texte gilt dieselbe
  Vorsicht wie bei ODbL-Daten in lasstreffen.at (getrennt halten oder nur Fakten nutzen).

### G3. communice (inixmedia GmbH, Schwentinental)

* **Betreiber:** inixmedia GmbH, Liesenhörnweg 13, 24222 Schwentinental, HRB 5629 Kiel
  (https://www.inixmedia.de/impressum/); communice.de leitet auf
  https://www.inixmedia.de/communice-web/ . Eigenangabe zum Modul: Kalender-Export
  „als ICS-Datei“, „Ausgabe als RSS-Feed“, Eintrag durch externe Veranstalter mit
  Freischaltung im Rathaus, „Für Ämter und Verwaltungsgemeinschaften wird zusätzlich ein
  Ortsfilter bereitgestellt“. Kundenzahl nicht belegt; Referenzseite nennt u. a. Bad
  Segeberg, Eckernförde, Reinbek, Henstedt-Ulzburg.
* **Gemeinden:** 6 von 25 Ämtern der Stichprobe (Mitteldithmarschen, Mittelholstein,
  Oldenburg-Land, Bad Oldesloe-Land, Boostedt-Rickling, Kellinghusen), dazu die
  Gemeindeseiten Meldorf, Rethwisch, Groß Kummerfeld, Rickling. 8 von 30
  Stichprobengemeinden liegen in einem communice-Amt.
* **Zugriff:** Atom-Feed `<Kalenderseite>/rss`, z. B.
  https://www.mitteldithmarschen.de/tourismus-naherholung/touristinformation/veranstaltungskalender/rss
  (210 Einträge), https://www.amt-boostedt-rickling.de/veranstaltungen/rss (185),
  https://www.amt-mittelholstein.de/veranstaltungen/rss (14),
  https://www.stadt-meldorf.de/tourismus-kultur/veranstaltungen/veranstaltungskalender/rss (102).
  iCal je Termin über `tx_communicecalendar_calendarshow[action]=ical`.
* **Felder (Atom):** `title` (bei Ämtern „Ort: Titel“), `id` (Detail-URL), `link
  rel=alternate`, `summary` („Start: Di, 27 Okt 2026 17:00:00, Ende: … | Text“),
  `published` und `updated` (beide gleich Start, ISO mit Offset), `category term` (Ort
  und Kategorie, nicht überall), `content` (HTML). Kein Ort als Feld, keine
  Koordinaten, Detailseite ohne JSON-LD.
* **Erkennung:** `tx_communicecalendar_*`, `communice.js`, `communice-iconfont.css`,
  Cookie `communice_consent_*`, Footer-Link communice.de.
* **robots:** auf allen geprüften communice-Hosts 404, also keine Sperre.
  Nutzungsbedingungen nicht belegt.
* **Dorffest-Test:** bestanden. „Weihnachtsmarkt der Gemeinde Busenwurth“ 29.11.2026,
  „Laternenumzug“ Nindorf 06.11.2026, „Weihnachtsbasar Schützengilde“ Epenwöhrden
  08.11.2026 (Feed Mitteldithmarschen); „Groß Kummerfeld: 27. Weihnachts-Hobbymarkt“
  21.11.2026
  https://www.amt-boostedt-rickling.de/veranstaltungen/veranstaltung/gross-kummerfeld-27-weihnachts-hobbymarkt ;
  „Rickling: Adventsmarkt“ 21.11.2026
  https://www.amt-boostedt-rickling.de/veranstaltungen/veranstaltung/rickling-adventsmarkt .
* **Grenze:** Der Feed ist nur so gut wie die Pflege im Amt; Oldenburg-Land ist leer,
  Kellinghusen fast nur Stadttermine.

### G4. Advantic iKISS (Lübeck und Fürth)

* Bundesweit in 00-bundesweit C3. **SH-Sicht:** Die Referenzkarte
  https://www.advantic.de/Referenzen/Alle-Kundenwebsites/ hat 139 Einträge im Rechteck
  Schleswig-Holstein, darunter 13 SH-Ämter (Pinnau, Lütjenburg, Schrevenborn,
  Nordsee-Treene, Schwarzenbek-Land, Viöl, Bargteheide-Land, Hohe Elbgeest,
  Nordstormarn, Burg-St. Michaelisdonn, Südtondern, Eiderstedt, Südangeln) mit zusammen
  187 Gemeinden laut Destatis, dazu Gemeinden wie Ratekau, Giekau, Harrislee,
  Uelvesbüll, Kasseburg (selbst gezählt).
* **Stichprobe:** 7 von 25 Ämtern. In keinem enthielt das Veranstaltungsmodul
  Dorftermine; genutzt wird es für Sitzungen, Sprechstunden oder gar nicht.
* **Zugriff:** HTML-Liste erlaubt; iCal unter `/output/` per robots.txt gesperrt (nicht
  abgerufen). **Dorffest-Test:** nicht bestanden.

### G5. Der Smarte Gemeinschaftskalender (Mobilizon, Landesprogramm)

* **Betreiber:** 54 Grad Software GmbH mit Smart City Amt Süderbrarup und Amt
  Süderbrarup, finanziert über das Landesprogramm Offene Innovation der Staatskanzlei
  (https://der-smarte-gemeinschaftskalender.de/). Code AGPL-3.0, basiert auf Mobilizon
  (https://github.com/Der-Smarte-Gemeinschaftskalender/der-smarte-gemeinschaftskalender).
  Instanzen laut Seite „exemplarisch“: TAViAS (Amt Süderbrarup, 13 Gemeinden),
  termine.di.day, „80 Jahre Schleswig-Holstein“.
* **Zugriff:** öffentliche Mobilizon-GraphQL `https://<Instanz>/api`, auch per GET
  lesbar. Felder: `title`, `beginsOn`, `url`, `physicalAddress` (`locality`,
  `postalCode`), `attributedTo.name`, `tags`. robots.txt von mobilizon.tavias.de:
  `Disallow:` (leer). Nodeinfo per nginx gesperrt (403).
* **Inhalt:** TAViAS 685 Termine von 19 Veranstaltern im Fenster, Orte Süderbrarup 449,
  Norderbrarup 74, ohne Ort 149; 40 Gruppen. Landeskalender
  https://veranstaltungen.80-jahre-sh.de 13 kommende Termine, 77 Gruppen.
* **Dorffest-Test:** nicht bestanden. Bei TAViAS nur Vereinsfeiern („Weihnachtsfeier
  des Männerchores Süderbrarup im Bürgerhaus“ 16.12.2026,
  https://mobilizon.tavias.de/events/58f6e26a-8240-48e7-a2ca-6902609b6b04 ) und
  Übungsabende.
* **Bewertung:** technisch offen, inhaltlich heute ein Amt. Beobachten, weil das Land
  die Software fördert und Instanzen sich vernetzen lassen.

### G6. Weitere, je einmal in der Stichprobe

* **The Events Calendar (WordPress), Amt Kropp-Stapelholm:** REST
  https://kropp.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-10-27 ,
  2.679 Termine aus 15 Gemeinden; Felder wie 00-bundesweit D1. Der Plugin-Detektor nimmt
  das automatisch mit. Dorffest-Test in Alt Bennebek nicht bestanden (Kindertreff).
* **NOLIS, Amt Büsum-Wesselburen:** iCal vorhanden, im Fenster nur Sitzungen.
* **verwaltungsportal.de:** Postfeld mit JSON-LD `Event` und 345 Terminen 10/2026 bis
  10/2027; Dorffest-Test bestanden: „Laternelaufen Postfeld“ 20.11.2026
  http://www.postfeld.de/veranstaltungen/2888509/2026/11/20/laternelaufen-postfeld.html .
  Amt Auenland Südholstein auf derselben Plattform, Kalender leer.
* **WordPress My Calendar (Groß Grönau):** offene REST `/wp-json/my-calendar/v1/events`
  mit Koordinaten, aber nur eine Sitzung. Für den Plugin-Detektor nachtragen.
* **Rethwisch ICS:** https://ics.datt-blatt.de/ , 247 VEVENT 2024 bis 2027 mit stabiler
  `UID`, `LOCATION` mit PLZ, Veranstalter in `DESCRIPTION`. Dorffest-Test bestanden:
  „Laternen- und Fackelumzug“ der FF Rethwischdorf 30.10.2026; außerdem Gemeindefest
  13.06.2026, Feuerfest 29.08.2026. Einzelquelle, nicht skalierbar.
* **Hamburg Tourismus (hamburg-tourism.de):** führt SH-Umland (Traventhal, Rethwisch,
  Lentföhrden). Dass dahinter der imx-Mandant `hht` steht, ist nur aus der
  Widget-Konfiguration geschlossen. Zuständig wäre das Hamburg-Ticket.
* **Zeta Producer, IONOS, Jimdo, Eigenbau:** je eine Gemeinde, kein Feed; nur HTML.

### G7. Amtsblätter und Dorfzeitungen

In SH verlegen die Ämter ihre Blätter überwiegend selbst als PDF: Amtsblatt des Amtes
Mittelholstein, Bekanntmachungsblatt Schlei-Ostsee, Mitteilungsblatt Schafflund (Suche
27.10.2026), „Südangeln Rundschau“ (zweimonatlich, PDF 11,8 MB, Anzeigen über eine
Mediengestaltung in Sörup). LINUS WITTICH erscheint zweimal: „Informationsblatt Amt
Eider“ (Impressum Ausgabe 21/2026) und „Uns Dörper“ des Amtes Trave-Land (laut
Quellhinweis mit der Amtsseite synchronisiert). Dorfzeitungen: „Datt Blatt“
(Rethwisch), „Bokseer Bote“, „Bredenbek aktuell“, „Dit un Dat“ (Mittleres
Nordfriesland). Dorffest-Test: „Weihnachtsmarkt Struxdorf“ 29.11.2026 in der Südangeln
Rundschau Nr. 5, PDF-Seite 28 (https://www.amt-suedangeln.de/media/custom/1659_3929_1.PDF).
Maschinell nur über PDF-Text; die WITTICH-Blätter nur über die Vereinbarung aus
00-bundesweit B1.

### G8. Festverzeichnisse für SH-Feste

Eine Landesübersicht für Ringreiten oder Vogelschießen fand sich nicht (Websuche
27.10.2026). festivalsindeutschland.de hat in der Sitemap 18.523 Festseiten, davon im
Slug 20 Ringreiten, 26 Vogelschießen, 31 Gilde, 19 Biike, 41 Erntefest (bundesweit,
selbst gezählt), z. B. „ringreiten-ladelund“, „vioeler-ringreiten“, „gildefest-erfde“.
AGB untersagen die Nutzung der Datenbank (00-bundesweit F); nur als Lückenliste.

## Abgleich destination.one

`experience=open-data`, Fenster 28.10.2026 bis 27.10.2027: `area:"Schleswig-Holstein"`
2.660 Events (ohne Fenster 2.982). Stichprobe: 3 von 30 Gemeinden mit mindestens einem
Treffer (Tellingstedt 1, Meldorf 3, Lensahn 1).

Festarten im Titel, `q=area:"Schleswig-Holstein" AND title:<Wort>`: Weihnachtsmarkt 46,
Laternenumzug 3, Laternelaufen 3, Dorffest 2, Gildefest 1, Osterfeuer 1, Maifeuer 1;
Ringreiten, Vogelschießen, Erntefest, Erntedankfest, Feuerwehrfest, Schützenfest,
Biikebrennen je 0. Einige Treffer tragen ein Startdatum vor dem Fenster (Serien), die
Zahlen sind Rohwerte. Die TA.SH-Daten (G2) sind für SH die größere offene Quelle und
enthalten destination.one-Importe (`et4EventImportSource` 298).

## Dorffest-Test (Übersicht)

| Quelle | Ergebnis | Beleg |
|---|---|---|
| termine-regional.de | teilweise (Volksfest) | Herbst-Jahrmarkt Heide 27.10.2026, ID 9489500 |
| TA.SH Open Data | bestanden | Sommerfest der FF Nebel 03.07.2027, ID 215310 |
| communice-Feeds | bestanden | Weihnachtsmarkt Busenwurth 29.11.2026; Rickling Adventsmarkt 21.11.2026 |
| Advantic iKISS | nicht bestanden | nur Sitzungen und Sprechstunden |
| Smarter Gemeinschaftskalender | nicht bestanden | nur Vereinsfeiern |
| Tribe (Kropp-Stapelholm) | nicht bestanden für Alt Bennebek | Kindertreff 28.10.2026 |
| verwaltungsportal.de | bestanden | Laternelaufen Postfeld 20.11.2026 |
| Amtsblatt PDF | bestanden | Weihnachtsmarkt Struxdorf 29.11.2026 |
| Gemeinde-Websites | bestanden | Ringreiten Bohmstedt 04.07.2026 https://bohmstedt.de/category/ankuendigung-termine/ ; Adventsmarkt Tellingstedt 13.12.2026 https://tellingstedt.de/termine/index.php?gewaehltermonat=12 ; Grünkohlessen der Vogelgilde Norddeich 06.11.2026 ; Weihnachtsmarkt Bargfeld-Stegen 28.11.2026 ; Laternelaufen Rodenäs 30.10.2026 |
| Vereinsseiten | bestanden | „Laterne laufen in Neukirchen“ 13.11.2026 https://ffn-ostsee.de/termine/ |
| destination.one | 3 von 30 Gemeinden, keine Dorffeste der Stichprobe | |

## Abdeckung (nur Stichprobenanteile, n = 30)

* Gemeinde mit mindestens einem belegten Fest oder Feuerwehr/Vereinsfest in irgendeiner
  Quelle: 16 / 30 = 53 %.
* Gemeinde ohne auffindbare Termine: 8 / 30 = 27 %.
* Gemeinde im Ortsfilter von termine-regional.de: 10 / 30 = 33 %.
* Gemeinde mit Terminen in einem offenen Feed (communice-Atom, Tribe, JSON-LD, ICS):
  Meldorf, Groß Kummerfeld, Rickling, Hohenwestedt (nur Wochenmarkt), Alt Bennebek,
  Postfeld, Rethwisch = 7 / 30 = 23 %.
* Gemeinde in einem communice-Amt: 8 / 30 = 27 %; in einem iKISS-Amt: 7 / 30 = 23 %.
* Gemeinde mit Treffer in der TA.SH-Datei: 4 / 30 = 13 %; in destination.one: 3 / 30 = 10 %.

Formel jeweils Treffer / 30. Bei n = 30 ist jeder Wert grob; eine Hochrechnung auf 1.104
Gemeinden ist damit nicht belegt.

## Priorisierte Integrationsliste Schleswig-Holstein

| # | Integration | Gemeinden (Beleg) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | TA.SH Open-Data-Datei | 263 Orte, 4 / 30 Stichprobe | sehr gut: Adresse, Koordinaten, Kategorien, Lizenz je Eintrag | offen (CC0, CC BY, CC BY-SA je Eintrag) | Import als eigener Job (eine Datei am Tag), Namensnennung umsetzen, CC-BY-SA getrennt behandeln, Dedup gegen destination.one |
| 2 | termine-regional.de | 291 SH-Gemeinden im Ortsfilter, 10 / 30 | gut: Gemeindeschlüssel, Koordinaten, Veranstalter | Export und API entgeltlich, Nutzungsrechte nicht belegt | Angebot und Nutzungsrechte bei der NetzWerkstatt anfragen (Region SH, Export) |
| 3 | communice-Atom (Detektor) | 6 / 25 Ämter, 8 / 30 Gemeinden | mittel: Titel, Start/Ende im Text, Ort nur im Titel oder Detail | nicht belegt, robots frei | Detektor `tx_communicecalendar` in die Plugin-Erkennung; Kundenliste bei inixmedia erfragen |
| 4 | Plugin-Detektor (Tribe, My Calendar, MEC) | Kropp-Stapelholm 15 Gemeinden, Groß Grönau | sehr gut (Tribe) | Gemeinde-Websites | Regeln aus 00-bundesweit D5 plus My Calendar; Amt Kropp-Stapelholm als ersten SH-Fall |
| 5 | verwaltungsportal.de | Postfeld, Amt Auenland Südholstein | gut (JSON-LD) | nicht belegt | mit dem bundesweiten Parser (00-bundesweit C7) mitnehmen |
| 6 | Advantic iKISS | 13 SH-Ämter mit 187 Gemeinden, 7 / 25 | in SH kaum Dorftermine | iCal per robots gesperrt | keiner eigens für SH; Advantic-Anfrage aus 00-bundesweit genügt |
| 7 | Smarter Gemeinschaftskalender | Amt Süderbrarup, 13 Gemeinden | gut, aber kaum Feste | Code AGPL, Inhalte nicht geregelt | beobachten; bei neuen Instanzen per GraphQL mitnehmen |
| 8 | Amtsblätter (PDF) | einzelne Ämter | schlecht, nur PDF-Text | Selbstverlag; WITTICH nur per Vereinbarung | nur über die WITTICH-Anfrage (00-bundesweit B1) |
| | Nicht verfolgen | | | | imx-GraphQL mit Widget-Token, festivalsindeutschland (nur Lückenliste), Einzel-ICS wie Rethwisch, destination.one als SH-Quelle neben TA.SH |

## Lücken und offene Punkte

* 8 von 30 Gemeinden haben keine auffindbaren Termine, 14 von 30 kein belegtes Fest.
  Ringreiten, Vogelschießen und Gildefeste stehen in keiner strukturierten Quelle; sie
  leben auf Vereinsseiten, in Amtsblatt-PDFs und bei Facebook.
* Ob alle 291 SH-Orte von termine-regional.de aktuell Termine haben und wie viele davon
  Dorffeste sind, ist ohne POST-Suche oder Export nicht belegt.
* Kundenzahl von communice nicht belegt; Nutzungsbedingungen von communice-Feeds,
  termine-regional.de und Kalender.digital nicht gelesen.
* Die Kreiskalender außer Dithmarschen fanden sich nicht; Nordfrieslandkalender
  (https://www.nordfrieslandkalender.de/) lieferte einen leeren Body und ist offen.
* Nicht geprüft: Gemeinde-Apps (StadtLand.Funk wird von Bredenbek eingebunden und vom
  Amt Bad Oldesloe-Land beworben), die Dorf-App auf struxdorf.de, Facebook-Seiten.

## Was der User selbst tun muss

1. NetzWerkstatt (termine-regional.de, Rendsburg): Angebot für Export oder API der
   Region Schleswig-Holstein und Nutzungsrechte für eine öffentliche Website.
2. Optional inixmedia (communice): Liste der Kunden mit Veranstaltungskalender und
   Freigabe der Atom-Feeds.

## Regelabweichungen

* opendata.schleswig-holstein.de: drei Abfragen auf `/api/3/action/package_search`,
  obwohl die robots.txt `/api/` sperrt; erst danach bemerkt. Der Datensatz wurde
  anschließend über die erlaubte Download-URL geholt.
* Mehr als etwa sechs Anfragen je Host bei meta.et4.de (48, Zählung je Gemeinde und
  Festart), tavias.de (15, vollständige Zählung über sieben Seiten), termine-regional.de
  (9), amt-mittelholstein.de (9), amt-eider.de (8), kropp.de (8), amt-trave-land.de (8),
  amt-hohe-elbgeest.de (7), amt-suedangeln.de (7). Einzelheiten in der Anfragenliste.
* Bei einigen geratenen Gemeinde-Hosts wurde die Startseite vor der robots.txt
  abgerufen; keiner davon sperrte die abgerufenen Pfade.
