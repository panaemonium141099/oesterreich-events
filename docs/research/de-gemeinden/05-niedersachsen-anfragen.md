# Anhang zu 05-niedersachsen.md: alle gestellten Anfragen

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.6`. Alle Anfragen lesend (GET), ohne
Konto, Formular, Cookie oder Mail; robots.txt je Host vor dem ersten Inhaltsabruf. User-Agent
`Mozilla/5.0 (Recherche lasstreffen)`. Status nach Weiterleitungen, 000 = keine Verbindung.
Die Gruppen A bis D sind die Rohlisten der vier Teilrecherchen vom 27.10.2026, unverändert
übernommen (Gedankenstriche ersetzt).

## Hauptsession

| Datum | URL | Status |
|---|---|---|
| 27.10.2026 | https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/AuszugGV3QAktuell.xlsx?__blob=publicationFile | 200 |
| 27.10.2026 | https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=1&q=area:%22Niedersachsen%22 | 200, `overallcount` 9348 |
| 27.10.2026 | dito mit `&startdate=10/28/2026&enddate=10/27/2027` | 200, 7940 |
| 27.10.2026 | https://arl-we.niedersachsen.de/download/215682/NdsHub_OpenData_C.Foltin_TMN.pdf.pdf | 200 |
| 27.10.2026 | https://www.landtag-niedersachsen.de/parlamentsdokumente/niederschriften_ausschuesse/19_wp/uatourismus/014_UATourismus_04.04.2024_Anlage_1.pdf | 200 |
| 27.10.2026 | https://www.reiseland-niedersachsen.de/robots.txt | 200 |
| 27.10.2026 | https://www.reiseland-niedersachsen.de/veranstaltungen | 200 |
| 29.10.2026 | https://parsau.de/robots.txt | 200 |
| 29.10.2026 | https://www.brome.de/robots.txt | 200 |
| 29.10.2026 | https://surwold.de/robots.txt | 200 |
| 29.10.2026 | https://www.luetetsburg.com/robots.txt | 200 |
| 29.10.2026 | https://www.parsau.de/veranstaltungen/ | 200 |
| 29.10.2026 | https://www.brome.de/ | 200 |
| 29.10.2026 | https://surwold.de/wp-json/tribe/events/v1/events?per_page=50 | 404 |
| 29.10.2026 | https://surwold.de/veranstaltungen/?ical=1 | 200 (HTML, kein iCal) |
| 29.10.2026 | https://www.luetetsburg.com/de/angebote/veranstaltungen/ | 200 |
| 29.10.2026 | https://www.sg-mittelweser.de/veranstaltungen/veranstaltungen.ical?zeitauswahl=1&auswahl_woche_tage=28&...&selected_kommune=21550&...&verband=0&ressort=0&portal_all=0&beginn=20261029000000&ende=20261127235959&kultur=0&intern=0 | 200, 106 VEVENT |
| 29.10.2026 | dito mit `selected_kommune=0` | 200, 473 VEVENT |

Dazu zwei Websuchen (TMN Niedersachsen Hub, NOLIS Samtgemeinde) und ein abgebrochener WebFetch der TMN-PDF (Größenlimit, danach per curl geladen).

### meta.et4.de, Zählung je Gemeinde und Festart (29.10.2026, 4 s Pause)

Basis `https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=10&startdate=10/28/2026&enddate=10/27/2027&q=<q>`, alle 42 mit Status 200 und `"status":"OK"`.

| q | overallcount |
|---|---|
| `city:"Brome"` | 2 |
| `city:"Parsau"` | 0 |
| `city:"Ebergötzen"` | 1 |
| `city:"Hassel (Weser)"` | 0 |
| `city:"Hoya"` | 2 |
| `city:"Apelern"` | 0 |
| `city:"Hülsede"` | 0 |
| `city:"Pohle"` | 0 |
| `city:"Belum"` | 0 |
| `city:"Otterndorf"` | 47 |
| `city:"Gusborn"` | 0 |
| `city:"Betzendorf"` | 0 |
| `city:"Bothel"` | 0 |
| `city:"Hepstedt"` | 2 |
| `city:"Oederquart"` | 1 |
| `city:"Engelschoff"` | 0 |
| `city:"Oetzen"` | 0 |
| `city:"Schwienau"` | 0 |
| `city:"Marienhafe"` | 0 |
| `city:"Lütetsburg"` | 1 |
| `city:"Niederlangen"` | 0 |
| `city:"Surwold"` | 0 |
| `city:"Getelo"` | 0 |
| `city:"Filsum"` | 0 |
| `city:"Nortmoor"` | 0 |
| `city:"Harpstedt"` | 0 |
| `city:"Molbergen"` | 0 |
| `city:"Glandorf"` | 8 |
| `city:"Bakum"` | 0 |
| `city:"Ovelgönne"` | 0 |
| `area:"Niedersachsen" AND title:Schützenfest` | 23 |
| `area:"Niedersachsen" AND title:Feuerwehrfest` | 0 |
| `area:"Niedersachsen" AND title:Erntefest` | 0 |
| `area:"Niedersachsen" AND title:Osterfeuer` | 6 |
| `area:"Niedersachsen" AND title:Dorffest` | 1 |
| `area:"Niedersachsen" AND title:Maifest` | 0 |
| `area:"Niedersachsen" AND title:Laternenumzug` | 26 |
| `area:"Niedersachsen" AND title:Weihnachtsmarkt` | 206 |
| `area:"Niedersachsen" AND title:Kirchweih` | 0 |
| `area:"Niedersachsen" AND title:Erntedankfest` | 1 |
| `area:"Niedersachsen" AND title:Kartoffelfest` | 0 |
| `area:"Niedersachsen" AND title:Martinsmarkt` | 3 |

## Gruppe A: SG Brome, Radolfshausen, Grafschaft Hoya, Rodenberg

### 1. Anfragen (41, alle GET)

| Zeit | URL | Status | Bytes |
|---|---|---|---|
| 19:12:45 | https://www.samtgemeinde-brome.de/robots.txt | 200 | 183 |
| 19:12:46 | https://www.radolfshausen.de/robots.txt | 200 | 284 |
| 19:12:46 | https://www.grafschaft-hoya.de/robots.txt | 200 | 284 |
| 19:12:47 | https://rodenberg.de/robots.txt (Weiterleitung auf www) | 200 | 284 |
| 19:12:56 | https://www.samtgemeinde-brome.de/ | 200 | 440679 |
| 19:12:57 | https://www.radolfshausen.de/ | 200 | 126856 |
| 19:12:58 | https://www.grafschaft-hoya.de/ | 200 | 139478 |
| 19:12:59 | https://www.rodenberg.de/ | 200 | 95753 |
| 19:13:32 | https://www.grafschaft-hoya.de/freizeit-tourismus/veranstaltungen/ | 200 | 295592 |
| 19:13:33 | https://www.radolfshausen.de/tourismus-freizeit/veranstaltungskalender/ | 200 | 126688 |
| 19:14:03 | https://www.radolfshausen.de/tourismus-freizeit/veranstaltungskalender/veranstaltungssuche/ | 200 | 138082 |
| 19:14:16 | https://www.radolfshausen.de/regional/veranstaltungen/suche.html?naviID=900000255&brotID=900000255&suche=1&termine=0&layout=2 | 200 | 138082 (nur Suchformular) |
| 19:14:36 | https://www.radolfshausen.de/regional/veranstaltungen/suche.html?naviID=900000255&brotID=900000255&suche=1&termine=1&layout=2 | 200 | 154606 (Trefferliste) |
| 19:14:48 | https://www.radolfshausen.de/veranstaltungen/veranstaltungen.ical?…selected_kommune=25570…verband=0…portal_all=0&beginn=20261027000000&ende=20261126235959&kultur=0&intern=0 | 200 | 9898 |
| 19:15:10 | https://www.grafschaft-hoya.de/veranstaltungen/veranstaltungen.ical?…selected_kommune=21520…verband=0…portal_all=0… (wie im HTML) | 200 | 53728 |
| 19:15:11 | dito mit `portal_all=1` | 200 | 53728 |
| 19:15:11 | dito mit `verband=1` | 200 | 0 (leerer Body) |
| 19:16:43 | https://www.rodenberg.de/unsere-samtgemeinde/mitgliedsgemeinden/apelern/ | 200 | 100451 |
| 19:17:33 | https://www.samtgemeinde-brome.de/freizeit-kultur/veranstaltungen/ | 200 | 400555 |
| 19:18:15 | https://www.samtgemeinde-brome.de/freizeit-kultur/veranstaltungen/?par=6-2026 | 200 | 402769 |
| 19:18:17 | https://www.samtgemeinde-brome.de/freizeit-kultur/veranstaltungen/?par=11-2026 | 200 | 401333 |
| 19:19:13 | https://ebergoetzen.de/robots.txt | 200 | 112 |
| 19:19:14 | https://ebergoetzen.de/ | 200 | 28916 |
| 19:20:02 | https://www.schaumburgerland-tourismus.de/robots.txt | 200 | 22029 |
| 19:20:04 | https://www.suedheide-gifhorn.de/robots.txt | 200 | 1875 |
| 19:20:05 | https://www.mittelweser-tourismus.de/robots.txt | 200 | 1879 |
| 19:20:18 | https://www.schaumburgerland-tourismus.de/de/ | 200 | 2981 (Anubis-Botschranke, nicht umgangen) |
| 19:20:19 | https://www.suedheide-gifhorn.de/ | 200 | 240360 |
| 19:20:20 | https://www.mittelweser-tourismus.de/ | 200 | 174492 |
| 19:21:06 | https://www.suedheide-gifhorn.de/veranstaltungen | 200 | 410864 |
| 19:21:10 | https://www.mittelweser-tourismus.de/erleben/veranstaltungen | 200 | 362274 |
| 19:23:48 | https://www.samtgemeinde-brome.de/buerger-info/mitteilungsblatt/ | 200 | 404369 |
| 19:24:27 | https://www.rodenberg.de/tourismus-freizeit/vereine/vereinsuebersicht/ | 200 | 164273 |
| 19:24:46 | https://www.feuerwehr-apelern.de/robots.txt | 404 | (Joomla-Fehlerseite) |
| 19:24:46 | http://www.freiwillige-feuerwehr-pohle.de/robots.txt | 200 | 2121 |
| 19:25:03 | https://www.feuerwehr-apelern.de/ | 200 | 67933 |
| 19:25:04 | http://www.freiwillige-feuerwehr-pohle.de/ | 200 | 67447 |
| 19:25:43 | https://ebergoetzen.de/ebergoetzen-2/vereine-ebergoetzen/ | 200 | 26992 |
| 19:25:58 | https://www.skam-ebergoetzen.de/robots.txt | 404 | 236 |
| 19:25:59 | https://www.skam-ebergoetzen.de/ | 200 | 36550 |
| 19:26:10 | https://www.skam-ebergoetzen.de/index.php/termine | 200 | 24191 |

Je Host: radolfshausen.de 7 (eine über dem Richtwert, für den iCal-Abruf), grafschaft-hoya.de 6,
samtgemeinde-brome.de 6, rodenberg.de 4, ebergoetzen.de 3, suedheide-gifhorn.de 3,
mittelweser-tourismus.de 3, skam-ebergoetzen.de 3, schaumburgerland-tourismus.de 2,
feuerwehr-apelern.de 2, freiwillige-feuerwehr-pohle.de 2.

## Gruppe B: SG Land Hadeln, Elbtalaue, Amelinghausen, Bothel, Tarmstedt, Nordkehdingen

### Anfragen (URL, Status, Ziel nach Weiterleitung)

```
GET https://www.samtgemeinde-land-hadeln.de/robots.txt -> 200
GET https://www.otterndorf.de/robots.txt -> 200
GET https://www.elbtalaue.de/robots.txt -> 200
GET https://www.amelinghausen.de/robots.txt -> 200
GET https://www.bothel.de/robots.txt -> 200
GET https://www.tarmstedt.de/robots.txt -> 200
GET https://nordkehdingen.de/robots.txt -> 200 (www.nordkehdingen.de)
GET https://www.oederquart.de/robots.txt -> 200 (Ziel https://www.pc23.de/robots.txt)
GET https://www.samtgemeinde-land-hadeln.de/ -> 200 (home.html)
GET https://www.otterndorf.de/ -> 500
GET https://www.elbtalaue.de/ -> 200
GET https://www.amelinghausen.de/ -> 200
GET https://www.bothel.de/ -> 200
GET https://www.tarmstedt.de/ -> 200
GET https://www.nordkehdingen.de/ -> 200
GET https://www.oederquart.de/ -> 200 (Ziel https://www.pc23.de/ "PC-Health", Joomla/Helix; fremde Website)
GET https://www.samtgemeinde-land-hadeln.de/freizeit-sport/veranstaltungen-land-hadeln.html -> 200
GET https://www.elbtalaue.de/freizeit-kultur/veranstaltungskalender/ -> 200
GET https://www.amelinghausen.de/infos-service/veranstaltungen -> 200
GET https://www.bothel.de/termine/veranstaltungen.html -> 200
GET https://www.tarmstedt.de/index.php/termine.html -> 200
GET https://www.samtgemeinde-land-hadeln.de/freizeit-sport/veranstaltungen-land-hadeln/veranstaltung.html?tx_syvin_eventdetail[...][eventId]=176431&cHash=... -> 200
GET https://www.samtgemeinde-land-hadeln.de/freizeit-sport/veranstaltungen-land-hadeln/seite/20.html -> 200 (leer)
GET https://www.samtgemeinde-land-hadeln.de/freizeit-sport/veranstaltungen-land-hadeln/seite/6.html -> 200
GET https://www.elbtalaue.de/leben-bei-uns/aktuelle-meldungen/veranstaltungskalender/ -> 200
GET https://www.elbtalaue.de/regional/veranstaltungen/sucheplus.html -> 200
GET https://hamburgwhl.infomaxnet.de/robots.txt -> 200
GET https://hamburgwhl.infomaxnet.de/action/widget?token=LRf3Jg4YmSs.&containerId= -> 200
GET https://hamburgwhl.infomaxnet.de/veranstaltungskalender_elbtalaue/?widgetToken=LRf3Jg4YmSs. -> 200
GET https://www.bothel.de/mitgliedsgemeinden/bothel/willkommen/aktuelles.html -> 200
GET https://www.tarmstedt.de/index.php/termine.html?month=202611 -> 200
GET https://www.tarmstedt.de/index.php/events-leser-samtgemeinde/laternelaufen-in-westertimke.html -> 200
GET https://www.hepstedt.de/robots.txt -> 000 (keine HTTPS-Verbindung)
GET https://www.hepstedt.de/ -> 000 (versehentlich vor gelesener robots.txt, keine Verbindung, nichts geladen)
GET http://www.hepstedt.de/robots.txt -> 404 (keine robots.txt, also keine Sperre)
GET http://www.hepstedt.de/ -> 200
GET http://www.hepstedt.de/termine.html -> 200
GET https://www.nordkehdingen.de/veranstaltungen/index.php -> 200
GET https://www.nordkehdingen.de/veranstaltungen/2987092/2026/11/06/pop-konzert-mit-valentin-behr.html -> 200
GET https://www.otterndorf.de/ -> 200 (zweiter Versuch)
GET https://www.samtgemeinde-amelinghausen.de/robots.txt -> 200
GET https://www.samtgemeinde-amelinghausen.de/ -> 200
GET https://www.otterndorf.de/dein-otterndorf/veranstaltungen -> 200
GET https://www.otterndorf.de/dein-otterndorf/veranstaltungen/veranstaltungskalender -> 200
GET https://www.otterndorf.de/dein-otterndorf/veranstaltungen/luettes-altstadtfest -> 200
GET https://www.elbtalaue.de/leben-bei-uns/portrait-mitgliedsgemeinden/gemeinde-gusborn/ -> 200
GET https://wendland-elbe.de/robots.txt -> 200
GET https://wendland-elbe.de/de/ -> 200
GET https://www.belum.de/robots.txt -> 200
GET https://www.betzendorf.de/robots.txt -> 000
GET https://www.gusborn.de/robots.txt -> 000
GET https://gemeinde-belum.de/robots.txt -> 000
GET http://www.betzendorf.de/robots.txt -> 404 (Ziel https://www.samtgemeinde-amelinghausen.de/wissenswertes/gemeinde-betzendorf/robots.txt)
GET http://www.gusborn.de/robots.txt -> 200 (Ziel https://www.vlh.de/bst/1508/, Lohnsteuerhilfeverein, fremd)
GET http://gemeinde-belum.de/robots.txt -> 404 (Ziel https://www.samtgemeinde-land-hadeln.de/verwaltung-rat/mitgliedsgemeinden/belum/robots.txt)
GET https://www.samtgemeinde-amelinghausen.de/wissenswertes/gemeinde-betzendorf/ -> 404 (Ziel .../politik-verwaltung/gut-zu-wissen/5-mitgliedsgemeinden/betzendorf)
GET https://www.belum.de/ -> 200 (Domain-Parking "Diese Domain kaufen", fremd)
GET https://www.samtgemeinde-amelinghausen.de/was-erledige-ich-wo/bildung-soziales/vereine/schuetzenvereine -> 200
GET https://schuetzenverein-betzendorf.de/robots.txt -> 200
GET https://schuetzenverein-betzendorf.de/ -> 200
GET https://www.tourismus-kehdingen.de/robots.txt -> 000
GET https://www.tourismus-kehdingen.de/ -> 000 (keine Verbindung)
GET https://www.nordkehdingen.de/veranstaltungen/2977695/2026/11/22/weihnachtsbasar-vom-sch%C3%BCtzenverein-eichel-wolfsbruch.html -> 200
GET https://www.rotenburger-rundschau.de/robots.txt -> 200
GET https://www.rotenburger-rundschau.de/rrarchiv/bothel/botheler-feiern-samstag-erntefest-mit-rundmarsch-und-ehrentaenzen-101459.html -> 404
GET https://www.nordwaerts.de/robots.txt -> 200
GET https://www.nordwaerts.de/kultur-veranstaltungen/veranstaltungskalender/ -> 200
```

## Gruppe C: SG Oldendorf-Himmelpforten, Rosche, Bevensen-Ebstorf, Brookmerland, Hage, Lathen, Nordhümmling

### Anfragen (URL, Status)

| Zeit | URL | Status |
|---|---|---|
| 19:12 | https://www.oldendorf-himmelpforten.de/robots.txt | 200 |
| 19:12 | https://www.samtgemeinde-rosche.de/robots.txt | 404 (keine robots, also frei) |
| 19:12 | https://www.bevensen-ebstorf.de/robots.txt | 200 |
| 19:13 | https://www.brookmerland.de/robots.txt | 000 (Timeout) |
| 19:13 | https://www.hage.de/robots.txt | 200 (falscher Host: HAGE Hessen, nicht SG Hage) |
| 19:13 | https://www.lathen.de/robots.txt | 200 |
| 19:13 | https://www.nordhuemmling.de/robots.txt | 000 |
| 19:13 | https://brookmerland.de/robots.txt | 000 |
| 19:13 | https://nordhuemmling.de/robots.txt | 000 |
| 19:13 | https://www.oldendorf-himmelpforten.de/ | 200 |
| 19:13 | https://www.samtgemeinde-rosche.de/ | 200 |
| 19:13 | https://www.bevensen-ebstorf.de/ | 200 (-> /home.aspx) |
| 19:13 | https://hage.de/ | 200 (falscher Host) |
| 19:13 | https://www.lathen.de/ | 200 |
| 19:14 | https://www.sg-hage.de/robots.txt | 404 (frei) |
| 19:14 | https://www.sg-nordhuemmling.de/robots.txt | 200 (-> sg-nordhuemmling.de, Yoast, alles frei) |
| 19:14 | http://www.brookmerland.de/robots.txt | 000 |
| 19:14 | https://www.samtgemeinde-brookmerland.de/robots.txt | 000 |
| 19:15 | https://www.brookmerland.de/ (curl -v) | TCP-Timeout auf 185.48.220.90:443 |
| 19:15 | https://www.sg-hage.de/ | 200 |
| 19:15 | https://sg-nordhuemmling.de/ | 200 |
| 19:16 | https://www.oldendorf-himmelpforten.de/die-samtgemeinde/aktuelles/veranstaltungskalender/ | 200 |
| 19:17 | https://www.oldendorf-himmelpforten.de/regional/veranstaltungen/suche.html?action=1&layout=2&naviID=0&titel=Veranstaltungssuche&kultur=0&destination=0&dest_id=0&buchbar=0&intern=0&zeitauswahl=1&schnellauswahl=3&auswahl_woche_tage=365&selected_kommune=20480&ort=0&rubrik=0&suchwort= | 200 „Keine Veranstaltungen gefunden“ |
| 19:18 | https://www.oldendorf-himmelpforten.de/portal/seiten/veranstaltungskalender-900000064-20480.html | 200 (nur Suchmaske) |
| 19:19 | https://www.oldendorf-himmelpforten.de/die-samtgemeinde/mitgliedsgemeinden/engelschoff/ | 200 |
| 19:19 | https://www.engelschoff.de/robots.txt | 200 |
| 19:19 | https://www.engelschoff.de/ | 200 |
| 19:19 | https://www.engelschoff.de/termine/ | 200 |
| 19:20 | https://allesamt-gemeinde.orts.app/robots.txt | 200 |
| 19:20 | https://allesamt-gemeinde.orts.app/app | 200 (-> /app?SSOC=1; robots sperrt `/app/`, Abruf von `/app` ohne Schrägstrich; nicht weiter abgerufen) |
| 19:21 | https://www.samtgemeinde-rosche.de/aktuelles/veranstaltungskalender.html | 200 |
| 19:21 | https://hht.whitelabel.imxplatform.de/robots.txt | 200 (Crawl-delay 5, `/_nuxt/` gesperrt) |
| 19:21 | https://hht.whitelabel.imxplatform.de/widget/widget.js | 200 |
| 19:22 | https://hht.whitelabel.imxplatform.de/135/events/list | 404 „Module disabled“ |
| 19:22 | https://www.samtgemeinde-rosche.de/ihre-samtgemeinde/mitgliedsgemeinden.html | 200 |
| 19:23 | https://www.bevensen-ebstorf.de/home/tourismus-freizeit-kultur/freizeit/veranstaltungskalender.aspx | 200 |
| 19:23 | https://hamburgwhl.infomaxnet.de/robots.txt | 200 (Crawl-delay 5) |
| 19:23 | https://hamburgwhl.infomaxnet.de/action/widget?token=nu4yK5T3vhk.&containerId= | 200 |
| 19:24 | https://hamburgwhl.infomaxnet.de/whl-kalender/?widgetToken=nu4yK5T3vhk. | 200 |
| 19:24 | https://www.bevensen-ebstorf.de/home/verwaltung-und-politik/politik/mitgliedsgemeinden.aspx | 200 |
| 19:24 | https://www.bevensen-ebstorf.de/home/verwaltung-und-politik/politik/mitgliedsgemeinden/schwienau.aspx | 200 |
| 19:25 | https://www.meinlathen.de/robots.txt | 200 |
| 19:25 | https://tourismus.sg-lathen.de/robots.txt | 200 |
| 19:26 | https://www.meinlathen.de/ | 200 |
| 19:26 | https://tourismus.sg-lathen.de/ | 500 |
| 19:26 | https://www.meinlathen.de/kalender/c/0 | 200 |
| 19:27 | https://www.niederlangen.de/robots.txt | 404 (-> sg-lathen.de/gemeinden/niederlangen/robots.txt) |
| 19:27 | https://sg-lathen.de/robots.txt | 200 |
| 19:27 | https://sg-lathen.de/gemeinden/niederlangen/ | 200 |
| 19:28 | https://sg-lathen.de/tourismus-und-freizeit/veranstaltungskalender/ | 200 |
| 19:28 | https://pages.et4.de/robots.txt | 200 (sperrt nur Motor-Presse-Mandanten) |
| 19:28 | https://pages.et4.de/de/sg-hage/default/search/Event/view:list/sort:chronological/mode:next_months,3/calView:agendaWeek | 200 |
| 19:28 | https://pages.et4.de/de/sg-nordhuemmling/streaming/search/Event/view:list/sort:chronological/mode:next_months,10/calView:agendaWeek/recur:-frequently_recurring | 200 (JS-Hülle) |
| 19:28 | https://pages.et4.de/de/sg-lathen/default/search/Event/view:list/sort:chronological/calView:agendaWeek | 200 (JS-Hülle) |
| 19:30 | https://www.sg-hage.de/leben-in-hage/freizeit-kultur/luetzboerger-bummert/ | 200 |
| 19:30 | https://surwold.de/robots.txt | 200 |
| 19:30 | https://surwold.de/ | 200 |
| 19:30 | https://surwold.de/veranstaltungen/ | 200 |
| 19:31 | https://pages.et4.de/de/sg-nordhuemmling/default/search/Event/view:list/sort:chronological/calView:agendaWeek?i_target=et4pages | 200 (JS-Hülle) |
| 19:31 | https://www.marienhafe.de/robots.txt | 200 (sperrt nur benannte Bots, Crawl-delay 10 eingehalten) |
| 19:32 | https://www.marienhafe.de/veranstaltungen/ | 200 |
| 19:33 | https://www.marienhafe.de/veranstaltungen/1686015/2026/11/02/skatabend-in-der-marktsch%C3%A4nke-happy-place.html | 200 |
| 19:33 | https://www.marienhafe.de/verzeichnis/visitenkarte.php?mandat=160955 | 200 |
| 19:33 | https://www.ig-marienhafe.de/robots.txt | 200 |
| 19:33 | https://www.ig-marienhafe.de/ | 200 |
| 19:34 | https://www.sg-hage.de/leben-in-hage/freiwillige-feuerwehr/ortsfeuerwehr-luetetsburg/ | 200 |
| 19:34 | https://www.sg-hage.de/rathaus-politik-buergerinfo/buergerinfo/dorffunk-und-landnews/ | 200 |
| 19:35 | https://www.niedersachsen.digitale-doerfer.de/robots.txt | 000 |
| 19:35 | https://niedersachsen.stadtlandnews.com/robots.txt | 200 |
| 19:35 | https://niedersachsen.stadtlandnews.com/wp-json/tribe/events/v1/events?search=Hage&per_page=50&start_date=2025-01-01 | 200 |
| 19:35 | https://niedersachsen.stadtlandnews.com/wp-json/tribe/events/v1/events?search=L%C3%BCtetsburg&per_page=50&start_date=2024-01-01 | 200 (`total 0`) |
| 19:35 | http://dorfgemeinschaft-stoecken.de/robots.txt | 200 |
| 19:36 | http://dorfgemeinschaft-stoecken.de/events/categories/freiwillige-feuerwehr-stoecken/ | 200 |
| 19:36 | http://dorfgemeinschaft-stoecken.de/events.ics | 200 |
| 19:36 | https://www.emsland.com/robots.txt | 200 |
| 19:36 | https://www.emsland.com/event/schuetzenfest-in-boergermoor | 200 |
| 19:37 | https://www.emsland.com/event/schuetzenfest-in-niederlangen | 404 |
| 19:37 | https://www.emsland.com/no/event/schuetzenfest-in-niederlangen | 404 |
| 19:37 | https://www.festivalsindeutschland.de/robots.txt | 200 |
| 19:38 | https://www.festivalsindeutschland.de/festival/schuetzenfest-melzingen | 200 |

Anfragen je Host: www.oldendorf-himmelpforten.de 6; www.sg-hage.de 5; www.bevensen-ebstorf.de 5;
pages.et4.de 5; www.samtgemeinde-rosche.de 4; www.marienhafe.de 4; www.emsland.com 4;
www.brookmerland.de 3 (alle Timeout); www.engelschoff.de 3; www.meinlathen.de 3; surwold.de 3;
sg-lathen.de 3; niedersachsen.stadtlandnews.com 3; hht.whitelabel.imxplatform.de 3;
hamburgwhl.infomaxnet.de 3; dorfgemeinschaft-stoecken.de 3; www.lathen.de 2; www.ig-marienhafe.de 2;
www.festivalsindeutschland.de 2; tourismus.sg-lathen.de 2; allesamt-gemeinde.orts.app 2;
(sg-nordhuemmling.de 2 über www-Weiterleitung); je 1: www.samtgemeinde-brookmerland.de,
nordhuemmling.de, www.nordhuemmling.de, brookmerland.de, www.niedersachsen.digitale-doerfer.de,
www.niederlangen.de, hage.de, www.hage.de. Summe 80 Abrufe.

## Gruppe D: SG Uelsen, Jümme, Harpstedt; Molbergen, Glandorf, Bakum, Ovelgönne

### Alle Anfragen (URL, Status)

#### www.uelsen.de (5)
- https://www.uelsen.de/robots.txt : 404 (HTML-Fehlerseite, also keine robots.txt)
- https://www.uelsen.de/ : 200
- https://www.uelsen.de/freizeit-tourismus/veranstaltungen/veranstaltungskalender/ : 200
- https://www.uelsen.de/rathaus/politik/die-samtgemeinde/die-mitgliedsgemeinden/ : 200
- https://www.uelsen.de/rathaus/politik/die-samtgemeinde/die-mitgliedsgemeinden/getelo/ : 200

#### pages.et4.de (2)
- https://pages.et4.de/robots.txt : 200 (User-Agent * sperrt nur fremde Magazin-Pfade wie /de/outdoor-magazin/, nichts zu /de/uelsen/)
- https://pages.et4.de/de/uelsen/default/search/Event : 200 (server-seitig gerendert)

#### www.juemme.de (5) + www.filsum.de (1)
- https://www.juemme.de/robots.txt : 200 (sperrt nur /typo3/, /typo3_src/)
- https://www.juemme.de/ : 200
- https://www.juemme.de/freizeit/veranstaltungen : 200
- https://www.juemme.de/freizeit/veranstaltungen?tx_calendarize_calendar%5Baction%5D=list&tx_calendarize_calendar%5Bcontroller%5D=Calendar&tx_calendarize_calendar%5Bformat%5D=ics&tx_calendarize_calendar%5Bhmac%5D=f434b174d2b2b62dd4c795280156cc7978e87e99&cHash=7390baf392899ff46b8011a4590ca6a7 : 200 text/calendar, 86 Byte, 0 VEVENT
- https://www.juemme.de/tourismus : 200
- https://www.filsum.de/robots.txt : Weiterleitung auf https://www.juemme.de/ (200, HTML). filsum.de ist also keine eigene Website.

#### nortmoor.orts.app (2)
- https://nortmoor.orts.app/robots.txt : 200 (sperrt /click/, /content/pdf/, /app/; KI-Crawler wie GPTBot, CCBot, Google-Extended komplett gesperrt; User-Agent * darf /events)
- https://nortmoor.orts.app/events : 200 (Weiterleitung auf /events?SSOC=1), AngularJS-SPA, keine Termindaten im HTML

#### www.harpstedt.de (3)
- https://www.harpstedt.de/robots.txt : 404
- https://www.harpstedt.de/ : 200
- https://www.harpstedt.de/index.php/freizeit-und-tourismus : 200

#### pages.destination.one (3)
- https://pages.destination.one/robots.txt : 200 (gleiche Regeln wie pages.et4.de, nichts zu /de/wildegeest/)
- https://pages.destination.one/de/wildegeest/portal/search/Event/mode:next_months,3/sort:chronological/view:gallery : 200, Daten werden clientseitig von `//meta.et4.de/` geladen (window.META_URL), keine Termine im HTML
- https://pages.destination.one/de/wildegeest/default/search/Event?s=Harpstedt : 200, ebenfalls clientseitig (Request-Objekt `q":"Harpstedt -systag:has_abnormal_interval"`, experience wildegeest). Nicht weiter verfolgt, weil meta.et4.de gesperrt ist.

#### www.schiebenscheeten.de (4 Versuche)
- http://www.schiebenscheeten.de/robots.txt : 301 auf https
- http://www.schiebenscheeten.de/ : 301 auf https
- https://www.schiebenscheeten.de/robots.txt : 000 (keine Verbindung/TLS-Fehler)
- https://www.schiebenscheeten.de/ : 000

#### www.molbergen.de (6)
- https://www.molbergen.de/robots.txt : 200 (sperrt nur /portal/kontakt.html, /portal/suche*.html, /portal/weiterempfehlen.html, /barrierefreiheit/barriere_melden.html, /allris/___tmp/; WebCopier und HTTrack komplett)
- https://www.molbergen.de/ : 200
- https://www.molbergen.de/tourismus-freizeit/veranstaltungskalender/ : 200 (nur PDF „Veranstaltungskalender_2025“, 8 MB, nicht geladen)
- https://www.molbergen.de/regional/veranstaltungen/sucheplus2.html : 200 („18 Veranstaltungen gefunden“)
- https://www.molbergen.de/regional/veranstaltungen/29-weihnachtsmarkt-900000756-31160.html : 200
- https://www.molbergen.de/veranstaltungen/veranstaltung/29-weihnachtsmarkt-900000756-31160.ical : 200 text/calendar

#### www.glandorf.de (5)
- https://www.glandorf.de/robots.txt : 200 (Joomla-Standard plus `Disallow: /*cat*/`, `/*item*/`, `/*content*/`, `/*component*/`, `/*.feed`, `*?start$`). Folge: die Listen-URL `/glandorf-bewegt/veranstaltungskalender/cat.listevents/...` ist gesperrt und wurde NICHT abgerufen.
- https://www.glandorf.de/ : 200
- https://www.glandorf.de/glandorf-bewegt/veranstaltungskalender : 200
- https://www.glandorf.de/index.php?option=com_jevents&task=modlatest.rss&format=feed&type=rss&Itemid=232&modid=0 : 200 application/rss+xml (Link stand so im HTML; kein robots-Muster trifft)
- https://www.glandorf.de/glandorf-bewegt/glandorfer-mitteilungen : 200

#### www.bakum.de (4)
- https://www.bakum.de/robots.txt : 200 (nur `Disallow: /media/`, Sitemap /sitemap.xml)
- https://www.bakum.de/ : 200
- https://www.bakum.de/leben-in-bakum/aktuelles-termine/ : 200
- https://www.bakum.de/leben-in-bakum/aktuelles-termine/veranstaltungskalender/ : 200, 0 Byte (steht im HTML als `data-link`, wird per JS nachgeladen; direkt leer)

#### www.ovelgoenne.de (4)
- https://www.ovelgoenne.de/robots.txt : 200 (gleiches NOLIS-Muster wie Molbergen)
- https://www.ovelgoenne.de/ : 200
- https://www.ovelgoenne.de/kultur-freizeit/veranstaltungskalender/ : 200 („9 Veranstaltungen gefunden“)
- https://www.ovelgoenne.de/veranstaltungen/veranstaltungen.ical?zeitauswahl=1&auswahl_woche_tage=730&onlyMonat_select=0&beginn_datum=&beginn_tag=&beginn_monat=&beginn_jahr=&ende_datum=&ende_tag=&ende_monat=&ende_jahr=&suchwort=&rubrik=0&selected_kommune=39720&ort=0&destination=0&dest_id=0&selected_destination=0&select_ort=0&highlights=0&serie=0&verband=0&ressort=0&von=&bis= : 200 text/calendar, 16.368 Byte, 9 VEVENT

### WebSearch-Anfragen (Auswahl)
„Samtgemeinde Uelsen Veranstaltungen Getelo“, „Samtgemeinde Jümme Veranstaltungskalender Filsum Nortmoor“, „Samtgemeinde Harpstedt Veranstaltungen Kalender“, „Gemeinde Molbergen Veranstaltungskalender“, „Gemeinde Glandorf Veranstaltungen Termine“, „Gemeinde Bakum Veranstaltungskalender“, „Gemeinde Ovelgönne Wesermarsch Veranstaltungen“, Getelo-Festsuchen (3), „"orts.app" Gemeinde App Anbieter Veranstaltungen“, Filsum/Nortmoor-Festsuchen (4), „Harpstedt Schiebenscheeten 2026 Termin“, „Harpstedt Weihnachtsmarkt OR Osterfeuer OR Erntefest 2026 Termin“, „Schiebenscheeten Harpstedt 2026 Schützenkönig kreiszeitung“, „Filsum Veranstaltung Ostfriesland Termine Jümme“.
