# Anhang zu 01-rheinland-pfalz.md: alle gestellten Anfragen (27. bis 29.10.2026)

Alle Anfragen lesend (GET), ohne Konto, Formular oder Mail. Statuscode nach Weiterleitungen.
Teil A sind die Anfragen der Hauptrecherche, B bis D die drei Teilprüfungen der Stichprobe
(je 10 Gemeinden), unverändert aus den Rohnotizen übernommen. Teil E ist der Merkmalsscan
der Verwaltungs-Startseiten; sein Ergebnis je Verwaltung steht in
[data/rp-verwaltungen-2026-10.csv](data/rp-verwaltungen-2026-10.csv).

## A. Hauptrecherche

| # | Anfrage | Status |
|---|---|---|
| 1 | https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/AuszugGV3QAktuell.xlsx?__blob=publicationFile | 200 |
| 2 | meta.et4.de `search/?experience=open-data&type=Event&template=ET2014A.json&limit=1&q=area:"Rheinland-Pfalz"` ohne Zeitfenster, mit `startdate=2026-10-28&enddate=2027-10-27` (zwei Datumsformate), mit `facets=true`; dazu dasselbe ohne Ortsfilter | 5 × 200 |
| 3 | meta.et4.de `q=city:"<Gemeinde>"`, Fenster 28.10.2026 bis 27.10.2027, für die 30 Stichprobengemeinden (4 s Abstand) | 30 × 200 |
| 4 | meta.et4.de `q=city:"<Gemeinde>"` mit `limit=100` zur PLZ-Prüfung: Malberg, Mesenich, Gemünden, Monreal, Gossersweiler-Stein, „Birkenfeld (Nahe)“, Herschbach | 7 × 200 |
| 5 | https://meta.et4.de/robots.txt | 404 |
| 6 | https://meinort.de/robots.txt | 200 |
| 7 | https://meinort.de/orte-list | 200 |
| 8 | https://open-rlp.egovernor.de/robots.txt | 404 |
| 9 | https://open-rlp.egovernor.de/metaData/event/data | 200 |
| 10 | https://webapi.deskline.net/mosel/de/events?fields=…&sortingFields=date&pageNo=N&pageSize=400 (Header `DW-Source: desklineweb`): erster Versuch ohne `curl -g`, die Klammern im Feldparameter wurden als Muster gelesen | 15 × 400 |
| 11 | dieselbe Anfrage mit `curl -g`, `pageNo` 0 bis 5 (0 und 1 liefern dieselbe Seite) | 6 × 200 |
| 12 | https://www.vgnastaetten.de/impressum/ (→ /infos/impressum/) | 200 |
| 13 | https://www.chamaeleon.de/robots.txt (liefert die Startseite), https://www.chamaeleon.de/ , https://www.chamaeleon.de/impressum/ ; danach keine weiteren Abrufe, weil die Seite `noai` und Sperren für KI-Agenten im Robots-Meta-Tag setzt | 3 × 200 |
| 14 | https://query.wikidata.org/sparql (5 Abfragen: Klasse Verbandsgemeinde, ARS der 171 Verwaltungen, verbandsfreie Gemeinden, eine fehlerhafte wegen Umlaut im Shell-Aufruf, eine Probe zu VG Nastätten) | 4 × 200, 1 ohne Abruf |
| 15 | https://www.datefix.de/js/kalender/5212?form[suche]=Weihnachtsmarkt und …=Kirmes | 2 × 200 |
| 16 | (29.10.) https://herschbach-oberwesterwald.de/robots.txt , /wp-json/tribe/events/v1/events?per_page=50 | 2 × 200 |
| 17 | (29.10.) https://monrealeifel.de/robots.txt , /veranstaltungskalender/ (→ /veranstaltungskalender-2024/) | 2 × 200 |
| 18 | (29.10.) https://gossersweiler-stein.de/robots.txt , /index.php/veranstaltungen/ | 2 × 200 |
| 19 | (29.10.) https://www.vggebhardshain.de/robots.txt und / | 2 × TLS-Fehler (000) |

Websuchen (keine Abrufe): ionas Hersteller (2), Chamaeleon ionas (1), Verzeichnis der
VG-Websites (1).

## E. Merkmalsscan der Verwaltungs-Startseiten (27.10.2026)

Für jede der 170 Verwaltungen (129 Verbandsgemeinden, 41 verbandsfreie Gemeinden und
kreisfreie Städte) mit Website laut Wikidata (P856) je eine Anfrage auf `/robots.txt` und,
wenn erlaubt, eine auf die Startseite (8 parallel, Zeitlimit 25 s). Ergebnis: 164 × 200,
1 × 403 (vg-deidesheim.rlp.de), 1 × 400 (nordpfälzerland.de, Umlautdomain), 4 ohne
Verbindung (linz-vg.de Zertifikat, loreley.info DNS, daun.de abgelehnt, goellheim.de
Zeitüberschreitung). Keine robots.txt verbot die Startseite.

Danach für die 39 Startseiten mit einem ionas-Kalenderpfad je eine Anfrage auf
`/robots.txt` und eine auf die verlinkte `events.json`: 39 × 200. URLs in der CSV,
Spalte `tvm_json`.


## B. Teilprüfung Gruppe A (Alsdorf bis Klosterkumbd)


robots.txt
- https://www.malberg.org/robots.txt -> 000 (DNS: NXDOMAIN, nslookup)
- http://malberg.org/robots.txt -> 000 (NXDOMAIN)
- https://www.boos-nahe.de/robots.txt -> 404 (Mittwald-Fehlerseite)
- https://mesenich.de/robots.txt -> 200 (Joomla-Standard, sperrt nur Systemordner)
- https://www.monreal-eifel.de/robots.txt -> 000
- http://monreal-eifel.de/robots.txt -> 200, Inhalt ist Apache "It works!"
- https://www.muenk-eifel.de/robots.txt -> 200 ("User-agent: *" ohne Regel)
- https://www.oberraden.de/robots.txt -> 404
- https://www.klosterkumbd.de/robots.txt -> 000; http://klosterkumbd.de/robots.txt -> 200 nach Weiterleitung auf www.klosterkumbd.com
- https://www.klosterkumbd.com/robots.txt -> 200 (cm4all; fuer `*`: Crawl-delay 10, Disallow /.cm4all/ ausser mediadb/sysdb/uproc). Hinweis: robots.txt wurde zweimal in derselben Sekunde geholt (vor Kenntnis des Crawl-delay), danach Abstaende >= 10 s eingehalten.
- https://www.vg-altenkirchen-flammersfeld.de/robots.txt -> 404 (TYPO3-Seite)
- https://www.vg-ruedesheim.de/robots.txt -> 200 nach Weiterleitung auf die Startseite (keine robots.txt)
- https://www.vg-birkenfeld.de/robots.txt -> 200 (Disallow nur Kontakt/Suche/allris-tmp; WebCopier, HTTrack ganz gesperrt)
- https://www.vgcochem.de/robots.txt -> 404 (Weiterleitung auf /vg_cochem/Quicklinks/robots.txt)
- https://www.vordereifel.de/robots.txt -> 404
- https://www.rengsdorf-waldbreitbach.de/robots.txt -> 404
- https://www.sim-rhb.de/robots.txt -> 404
- https://www.vg-betzdorf-gebhardshain.de/robots.txt -> 000 (Domain falsch geraten)
- https://www.vg-bg.de/robots.txt -> 404
- https://www.alsdorf-sieg.de/robots.txt -> 200 (WordPress-Standard)
- https://www.pleckhausen.de/robots.txt -> 404
- https://www.stadt-birkenfeld.de/robots.txt -> 404 (Joomla-Fehlerseite)
- https://oberraden.orts.app/robots.txt -> 200 (`*`: Disallow /click/, /content/pdf/, /app/; GPTBot, CCBot, ChatGPT-User, Google-Extended: Disallow /)
- https://www.datefix.de/robots.txt -> 200 ("User-agent: *" ohne Regel)
- https://www.bg-aktuell.de/robots.txt -> 200 (bg-aktuell.de, WordPress-Standard)
- https://www.naturerlebnis-vordereifel.de/robots.txt -> 200 (TYPO3, sperrt `?id=`, `L=0`, Private/Configuration)

Seiten
- https://alsdorf-sieg.de/ -> 200; https://alsdorf-sieg.de/kontakt-und-impressum/ -> 200
- https://www.pleckhausen.de/ -> 200; /veranstaltungen.html -> 200; /Aktuelles.html -> 200
- https://www.stadt-birkenfeld.de/ -> 200; /tourismus/kultur/veranstaltungen.html -> 200; /tourismus/kultur/veranstaltungen/eventslist.feed?type=rss -> 200; /tourismus/kultur/veranstaltungen/event/448-martinsumzug-und-martinsfeuer-in-birkenfeld-freitag-13-november-2026-ab-18-00-uhr.html -> 200
- http://monreal-eifel.de/ -> 200 (Apache-Standardseite, keine Gemeindeseite)
- https://www.klosterkumbd.com/ -> 200; /Aktuelles/index.php/ -> 200
- https://www.boos-nahe.de/ -> 200; /termine.html -> 200
- https://mesenich.de/ -> 200; /freizeit/veranstaltungen -> 200; /images/pdf/Weinfest26_E.pdf -> 200
- https://www.muenk-eifel.de/ -> 404
- https://www.oberraden.de/ -> 200 nach Weiterleitung auf https://oberraden.orts.app/?SSOC=1
- https://oberraden.orts.app/events -> 200 (SPA, gleiche Huelle wie Startseite); https://oberraden.orts.app/Newsfeed -> 200 (RSS)
- https://www.vg-altenkirchen-flammersfeld.de/veranstaltungskalender -> 200; /aktuell/mitteilungsblatt -> 200
- https://www.datefix.de/js/dfx_ajax.js -> 200; /js/dfx_functions.js -> 200; /js/kalender/widget/5212 -> 200; /js/kalender/5212?form[ort]=Pleckhausen -> 200; /js/kalender/5212 -> 200
- https://www.vg-ruedesheim.de/tourismus-freizeit/events-feste-veranstaltungen/ -> 200; /ihre-verbandsgemeinde/online-dienste/mitteilungsblatt-mein-ort-app/ -> 200 nach Weiterleitung auf https://www.wittich.de/produkte/zeitungen/468-mitteilungsblatt-verbandsgemeinde-ruedesheim-und-zugehoerige-ortsgemeinden
- https://www.rengsdorf-waldbreitbach.de/touristik-freizeit/touristik/veranstaltungen/ -> 200; /kalender/deskline-veranstaltungen/events.json?weekends=false&tagMode=ALL -> 200; /aktuelles-mitteilungen/presse-amtsblatt/ -> 200
- https://www.sim-rhb.de/tourismus-kultur/ -> 200; /rathaus/verwaltung/mitteilungsblatt/ -> 200; /tourismus-kultur/erleben/ -> 200; /tourismus-kultur/erleben/veranstaltungen/ -> 200
- https://www.vgcochem.de/ -> 200 (/vg_cochem/); /vg_cochem/Wirtschaft/Infos & Events der Region/Veranstaltungen/ -> 200
- https://www.vg-birkenfeld.de/ -> 200; /regional/veranstaltungen/sucheplus2.html -> 200; /veranstaltungen/veranstaltungen.ical?selected_kommune=39840&beginn=20261027000000&ende=20261231235959 -> 200; /gemeinden-rathaus/veroeffentlichungen/birkenfelder-anzeiger/ -> 200
- https://www.vordereifel.de/ -> 200; /aktuelles/ab-mai-vg-veranstaltungskalender2026.pdf?cid=4rd -> 200 (8 Seiten); /aktuelles/heimat-und-buergerzeitung/ -> 200
- https://www.vg-bg.de/ -> 200; /sehenswert/feste-veranstaltungen/ -> 200; /buergernah/gemeinden/ortsgemeinde-alsdorf/ -> 200; /buergernah/gemeinden/ortsgemeinde-malberg/ -> 200
- https://www.bg-aktuell.de/ -> 200 (bg-aktuell.de); /wp-json/tribe/events/v1/events?search=Alsdorf&per_page=50&start_date=2026-01-01 -> 200 (total 0); ...search=Malberg... -> 200 (total 0); ...?per_page=50&start_date=2025-06-01&end_date=2027-12-31 -> 200 (total 9); /aktuelle-meldung/ueberblick-der-st-martinszuege-in-der-verbandsgemeinde/ -> 200
- https://www.naturerlebnis-vordereifel.de/veranstaltungen -> 200

Websuche (WebSearch): Ortsgemeinde-Websites und VG-Domains je Gemeinde, „orts.app Betreiber“, Dorffest-Suchen fuer Klosterkumbd, Pleckhausen, Malberg, Alsdorf; Amtsblatt VG Birkenfeld.


## C. Teilprüfung Gruppe B (Morshausen bis Prüm)


```
GET https://www.hunsrueck-mittelrhein.de/robots.txt -> 200
GET https://www.vgdiez.de/robots.txt -> 404 (Weiterleitung auf /vg_diez/Weiterleitungen/robots.txt)
GET https://www.vgnastaetten.de/robots.txt -> 404
GET https://www.vgben.de/robots.txt -> 404
GET https://www.hachenburg-vg.de/robots.txt -> 404
GET https://www.wallmerod.de/robots.txt -> 404
GET https://www.westerburg-vg.de/robots.txt -> 000 (Domain existiert nicht)
GET https://www.vg-suedeifel.de/robots.txt -> 404
GET https://www.pruem.de/robots.txt -> 404
GET https://www.hunsrueck-mittelrhein.de/ -> 200
GET https://www.vgdiez.de/ -> 200 (/vg_diez/)
GET https://www.hunsrueckmittelrhein.de/robots.txt -> 404
GET https://www.vg-westerburg.de/robots.txt -> 200, aber Weiterleitung auf Startseite (keine robots.txt)
GET https://www.ionas.de/robots.txt -> 000 (DNS)
GET https://www.ionas.de/ -> 000 (DNS)
GET https://www.vgnastaetten.de/tourismus-freizeit/veranstaltungen/veranstaltungskalender/ -> 200
GET https://www.hachenburg-vg.de/aktuelles/veranstaltungskalender/ -> 200
GET https://www.pruem.de/tourismus-freizeit/veranstaltungen/ -> 200
GET https://www.vgnastaetten.de/kalender/deskline-und-eigene/events.json?weekends=false&tagMode=ALL -> 200
GET https://www.hachenburg-vg.de/kalender/kombinierte-terminquelle/events.json?weekends=false&tagMode=ALL -> 200
GET https://www.hachenburg-vg.de/kalender/kombinierte-terminquelle/event.ics?weekends=false&tagMode=ALL -> 200
GET https://www.hachenburg-vg.de/unsere-gemeinden/winkelbach/ -> 200
GET https://www.gemeinde-morshausen.de/robots.txt -> 200
GET https://www.gemeinde-morshausen.de/ -> 200
GET https://www.winterwerb-rlp.de/robots.txt -> 200 (Weiterleitung nicsell.com, Domain zu verkaufen)
GET https://www.winterwerb-rlp.de/ -> 200 (dito)
GET https://www.gemeinde-morshausen.de/veranstaltungen/index.php -> 200
GET https://www.hunsrueck-mittelrhein.de/service/veranstaltungen -> 200
GET https://www.hunsrueckmittelrhein.de/rathaus/mitteilungsblatt/ -> 200
GET https://www.vgdiez.de/vg_diez/Gemeinden/ -> 200
GET https://www.vgdiez.de/vg_diez/Gemeinden/Hirschberg/ -> 200
GET http://www.hirschberg-rhein-lahn.de/robots.txt -> 200
GET http://www.hirschberg-rhein-lahn.de/ -> 503 ("This site is down for maintenance")
GET https://www.vgben.de/ -> 200
GET https://www.vgben.de/gemeinden/ -> 200
GET https://www.vgben.de/gemeinden/dessighofen/ -> 200
GET https://www.dessighofen.de/robots.txt -> 200
GET https://www.dessighofen.de/ -> 200
GET https://www.dessighofen.de/aktuelles/terminubersicht/ -> 200
GET https://www.wallmerod.de/ -> 200
GET https://www.wallmerod.de/gemeinden/ -> 200
GET https://www.wallmerod.de/gemeinden/herschbach-oww/ -> 200
GET https://www.pruem.de/aktuelles/pruemer-rundschau/ -> 200
GET https://www.ferienregion-pruem.de/robots.txt -> 200
GET https://www.ferienregion-pruem.de/veranstaltungen -> 200
GET https://www.ferienregion-pruem.de/events/pruemer-salvator-kirmes-1 -> 404
GET https://www.eifel.info/robots.txt -> 200
GET https://www.eifel.info/events/pruemer-salvator-kirmes-1 -> 404
GET https://www.vg-suedeifel.de/gemeinden/unsere-gemeinden/ortsgemeinden/ -> 200
GET https://www.felsenland-suedeifel.de/robots.txt -> 200
GET https://www.felsenland-suedeifel.de/veranstaltungen -> 200 (/felsenland-erleben/veranstaltungen)
GET https://www.vg-suedeifel.de/buergerservice/bekanntmachungen/mitteilungsblatt/ -> 200
GET https://www.vgnastaetten.de/verwaltung/mitteilungsblatt/ -> 200
GET https://www.vgdiez.de/vg_diez/Gemeinden/Hirschberg/Hirschberg%20im%20Amtsblatt/ -> 200
GET https://www.vg-westerburg.de/unsere-gemeinden/ -> 200
GET https://www.vg-westerburg.de/unsere-gemeinden/gemuenden/ -> 200
GET http://www.gemuenden-ww.de/robots.txt -> 404
GET http://www.gemuenden-ww.de/ -> 200
GET http://www.gemuenden-ww.de/veranstaltungen---termine/index.html -> 200
GET https://waellerland.com/robots.txt -> 200
GET https://waellerland.com/veranstaltungen/ -> 200
GET https://www.badems-nassau.info/robots.txt -> 200
GET https://www.badems-nassau.info/ -> 200
WebFetch https://eifel.info/en/service-informations/events/calendar-of-events/e-pruemer-salvator-kirmes-1 -> 404
WebFetch https://www.festivalsindeutschland.de/festival/pruemer-salvator-kirmes -> 200
```

Websuchen: rund 25 (VG-Seiten, Ortsgemeinde-Websites, Festtermine, IONAS-Hersteller). Nicht abgerufen: meinort.de, meta.et4.de, open-rlp.egovernor.de, cmsweb.wittich.de, nussbaum.de, epaper.wittich.de.

## robots.txt-Befunde

* hunsrueck-mittelrhein.de (Tourismus): `User-agent: *` sperrt /admin/, /cmscore/, /data/, /datamodules/, /extern/, /integration/, /tron/.
* IONAS-VG-Seiten (vgnastaetten, vgben, hachenburg-vg, wallmerod, vg-suedeifel, pruem, hunsrueckmittelrhein): keine robots.txt (404). vg-westerburg.de leitet /robots.txt auf die Startseite.
* gemeinde-morshausen.de (verwaltungsportal): `Disallow: /` und `Crawl-delay: 10` nur für eine Liste benannter Bots (dotbot, Nutch, AhrefsBot u. a.), keine Regel für `*` (geprüft: kein `User-agent: *`).
* hirschberg-rhein-lahn.de: Joomla-Standard (`*` sperrt /administrator/, /api/, /components/ usw.).
* dessighofen.de, waellerland.com: WordPress-Standard (/wp-admin/).
* ferienregion-pruem.de, eifel.info, felsenland-suedeifel.de: identische TYPO3-Regeln (`*` sperrt `?id=`, `?L=0`, `?query=`, /typo3/).
* badems-nassau.info: `*` sperrt /fileadmin, /uploads.


## D. Teilprüfung Gruppe C (Feusdorf bis Annweiler)

* https://www.feusdorf.de/robots.txt -> 200 https://feusdorf-vulkaneifel.de/robots.txt 124
* https://www.gerolstein.de/robots.txt -> 404 https://www.gerolstein.de/robots.txt 160174
* https://www.morscheid.de/robots.txt -> 404 https://www.morscheid.de/robots.txt 236
* https://www.ruwer.de/robots.txt -> 404 https://www.ruwer.de/robots.txt 132857
* https://www.gimbsheim.de/robots.txt -> 000 https://www.gimbsheim.de/robots.txt 0
* https://www.vg-eich.de/robots.txt -> 404 https://www.vg-eich.de/robots.txt 303897
* https://www.floersheim-dalsheim.de/robots.txt -> 404 https://www.floersheim-dalsheim.de/robots.txt 141817
* https://www.vg-monsheim.de/robots.txt -> 404 https://www.vg-monsheim.de/robots.txt 201134
* https://www.herxheim-am-berg.de/robots.txt -> 000 https://www.herxheim-am-berg.de/robots.txt 0
* https://www.vg-freinsheim.de/robots.txt -> 404 https://www.vg-freinsheim.de/robots.txt 328727
* https://www.frankeneck.de/robots.txt -> 200 https://frankeneck.de/robots.txt 146
* https://www.vg-lambrecht.de/robots.txt -> 403 https://www.vg-lambrecht.de/robots.txt 309
* https://www.kirchheimbolanden.de/robots.txt -> 200 https://www.kirchheimbolanden.de/robots.txt 47
* https://www.erdesbach.de/robots.txt -> 200 https://www.erdesbach.de/robots.txt 101
* https://www.vg-kusel-altenglan.de/robots.txt -> 000 https://www.vg-kusel-altenglan.de/robots.txt 0
* https://www.gossersweiler-stein.de/robots.txt -> 404 https://www.gossersweiler-stein.de/robots.txt 236
* https://www.annweiler.de/robots.txt -> 200 https://www.annweiler.de/robots.txt 117
* https://www.trifelsland.de/robots.txt -> 404 https://www.suedlicheweinstrasse.de/trifelslandrobots.txt 136385
* https://feusdorf-vulkaneifel.de/ -> 200 https://feusdorf-vulkaneifel.de/ 91591
* https://www.gerolstein.de/ -> 200 https://www.gerolstein.de/ 217552
* https://www.morscheid.de/ -> 200 https://www.morscheid.de/ 1423
* https://www.ruwer.de/ -> 200 https://www.ruwer.de/ 163616
* https://www.vg-eich.de/ -> 200 https://www.vg-eich.de/ 354918
* https://www.floersheim-dalsheim.de/ -> 200 https://www.floersheim-dalsheim.de/ 261390
* https://www.vg-monsheim.de/ -> 200 https://www.vg-monsheim.de/ 242683
* https://www.vg-freinsheim.de/ -> 200 https://www.vg-freinsheim.de/ 373527
* https://frankeneck.de/ -> 200 https://frankeneck.de/ 95608
* https://www.kirchheimbolanden.de/ -> 200 https://www.kirchheimbolanden.de/ 91845
* https://www.erdesbach.de/ -> 200 https://www.erdesbach.de/ 34134
* https://www.gossersweiler-stein.de/ -> 200 https://gossersweiler-stein.de/ 47852
* https://www.annweiler.de/ -> 404 https://www.annweiler.de/?avia_forced_reroute=1 121105
* https://feusdorf-vulkaneifel.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-01-01 -> 200 https://feusdorf-vulkaneifel.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-01-01 117033
* https://frankeneck.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-01-01 -> 200 https://frankeneck.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-01-01 95720
* https://www.ruwer.de/kultur-freizeit/veranstaltungen/ -> 200 https://www.ruwer.de/kultur-freizeit/veranstaltungen/ 136629
* https://www.vg-eich.de/aktuelles/veranstaltungen/veranstaltungskalender/ -> 200 https://www.vg-eich.de/aktuelles/veranstaltungen/veranstaltungskalender/ 209939
* https://www.vg-monsheim.de/tourismus-kultur/veranstaltungskalender/ -> 200 https://www.vg-monsheim.de/tourismus-kultur/veranstaltungskalender/ 204205
* https://www.floersheim-dalsheim.de/og/veranstaltungen/ -> 200 https://www.floersheim-dalsheim.de/og/veranstaltungen/ 235015
* https://www.erdesbach.de/termine -> 200 https://www.erdesbach.de/termine 32791
* https://gossersweiler-stein.de/index.php/veranstaltungen/ -> 200 https://gossersweiler-stein.de/index.php/veranstaltungen/ 29123
* https://www.vg-eich.de/kalender/events.json?weekends=false&tagMode=ALL -> 200 https://www.vg-eich.de/kalender/events.json?weekends=false&tagMode=ALL 20424
* https://gimbsheim.de/robots.txt -> 000 https://gimbsheim.de/robots.txt 0
* https://herxheim-am-berg.de/robots.txt -> 200 https://herxheim-am-berg.de/robots.txt 26
* https://www.bischheim.de/robots.txt -> 000 https://www.bischheim.de/robots.txt 0
* https://www.vgka.de/robots.txt -> 404 https://www.vgka.de/robots.txt 58168
* https://www.vg-annweiler.de/robots.txt -> 404 https://www.vg-annweiler.de/robots.txt 317451
* https://www.gerolsteiner-land.de/robots.txt -> 200 https://www.gerolsteiner-land.de/robots.txt 797
* https://www.ruwer-hochwald.de/robots.txt -> 404 https://www.ruwer-hochwald.de/robots.txt 95909
* http://www.gimbsheim.de/robots.txt -> 404 https://www.vg-eich.de/ortsgemeinden/gimbsheim//robots.txt 303897
* http://www.bischheim.de/robots.txt -> 200 https://www.kirchheimbolanden.de/de/bischheim-hauptnavigation.html 63369
* https://www.vg-eich.de/ortsgemeinden/gimbsheim/ -> 200 https://www.vg-eich.de/ortsgemeinden/gimbsheim/ 212274
* https://www.gerolsteiner-land.de/en/service-information/event-calendar/e-theaterauffuehrungen-feusdorf -> 500 https://www.gerolsteiner-land.de/en/service-information/event-calendar/e-theaterauffuehrungen-feusdorf 4538
* https://www.floersheim-dalsheim.de/og/highlights/dalsheimer-kerwe/ -> 200 https://www.floersheim-dalsheim.de/og/highlights/dalsheimer-kerwe/ 268565
* https://www.floersheim-dalsheim.de/og/veranstaltungen/termine/Termine-Ortsgemeinde-Politik/Kita/Laternenumzug-Kitas.php?splitId=15&from=2026-11-11%2017:00:00&to=2026-11-11%2017:00:00 -> 200 https://www.floersheim-dalsheim.de/og/veranstaltungen/termine/Termine-Ortsgemeinde-Politik/Kita/Laternenumzug-Kitas.php?splitId=15&from=2026-11-11%2017:00:00&to=2026-11-11%2017:00:00 151067
* https://widgets.rlp-tourismus.de/robots.txt -> 404 https://widgets.rlp-tourismus.de/robots.txt 19
* https://widgets.rlp-tourismus.de/events/assets/widget.js -> 200 https://widgets.rlp-tourismus.de/events/assets/widget.js 824553
* https://widgets.rlp-tourismus.de/events/api/endpoints/0c6a5ada-6c85-4d41-ae03-e3bf52fb38ba?page%5Bsize%5D=50&section%5B%40context%5D=0 -> 404 https://widgets.rlp-tourismus.de/events/api/endpoints/0c6a5ada-6c85-4d41-ae03-e3bf52fb38ba?page%5Bsize%5D=50&section%5B%40context%5D=0 34
* https://widgets.rlp-tourismus.de/events/assets/core-l6-B_fvj.js -> 200 https://widgets.rlp-tourismus.de/events/assets/core-l6-B_fvj.js 17680
* https://www.ruwer-hochwald.de/veranstaltungen/ -> 200 https://www.ruwer-hochwald.de/veranstaltungen/ 92079
* https://www.vgka.de/ -> 200 https://www.vgka.de/de/ 2703450
* https://www.vg-annweiler.de/ -> 200 https://www.vg-annweiler.de/ 385964
* https://www.gerolsteiner-land.de/ -> 200 https://www.gerolsteiner-land.de/ 91577
* https://www.vg-freinsheim.de/tourismus/ -> 200 https://www.vg-freinsheim.de/tourismus/ 333161
* https://www.vg-lambrecht.de/ -> 200 https://www.vg-lambrecht.de/vg_lambrecht/ 59353
* https://www.vgka.de/de/kalender/events.json?weekends=false&tagMode=ALL -> 200 https://www.vgka.de/de/kalender/events.json?weekends=false&tagMode=ALL 7428
* https://www.vg-freinsheim.de/gemeinden/herxheim-am-berg/ -> 200 https://www.vg-freinsheim.de/gemeinden/herxheim-am-berg/ 264264
* https://www.gerolsteiner-land.de/veranstaltungen -> 200 https://www.gerolsteiner-land.de/veranstaltungen 101500
* https://www.urlaubsregion-freinsheim.de/robots.txt -> 200 https://www.urlaubsregion-freinsheim.de/robots.txt 2141
* https://www.zentrum-pfaelzerwald.de/robots.txt -> 200 https://www.zentrum-pfaelzerwald.de/robots.txt 106
* https://www.suedlicheweinstrasse.de/robots.txt -> 200 https://www.suedlicheweinstrasse.de/robots.txt 165
* https://www.herxheimamberg.de/robots.txt -> 200 https://www.herxheimamberg.de/robots.txt 764
* https://www.urlaubsregion-freinsheim.de/ -> 200 https://www.urlaubsregion-freinsheim.de/de 196313
* https://www.herxheimamberg.de/ -> 200 https://www.herxheimamberg.de/ 32581
* https://www.urlaubsregion-freinsheim.de/de/erleben-sie-die-urlaubsregion-freinsheim/veranstaltungen -> 200 https://www.urlaubsregion-freinsheim.de/de/erleben-sie-die-urlaubsregion-freinsheim/veranstaltungen 87395
* https://www.herxheimamberg.de/index.php/termine -> 200 https://www.herxheimamberg.de/index.php/termine 35559
* https://www.herxheimamberg.de/index.php?option=com_jevents&task=modlatest.rss&format=feed&type=rss&Itemid=149&modid=0 -> 200 https://www.herxheimamberg.de/index.php?option=com_jevents&task=modlatest.rss&format=feed&type=rss&Itemid=149&modid=0 944
* https://www.urlaubsregion-freinsheim.de/de/veranstaltung/neuer-wein-und-herbstausschank -> 200 https://www.urlaubsregion-freinsheim.de/de/veranstaltung/neuer-wein-und-herbstausschank 88446
* https://www.kirchheimbolanden.de/de/bischheim-rathaus-aktuelles-und-veranstaltungen.html -> 200 https://www.kirchheimbolanden.de/de/bischheim-rathaus-aktuelles-und-veranstaltungen.html 69366
* https://www.zentrum-pfaelzerwald.de/events.html -> 200 https://www.zentrum-pfaelzerwald.de/events.html 10933
* https://www.suedlicheweinstrasse.de/trifelsland-veranstaltungen -> 200 https://www.suedlicheweinstrasse.de/trifelsland-veranstaltungen 192485
* https://www.suedlicheweinstrasse.de/trifelsland-veranstaltungen?tx_sfdeskline_event%5Bfilter_city%5D%5B%5D=3f780478-6f95-499f-a7d1-22a9f3d58777 -> 200 https://www.suedlicheweinstrasse.de/trifelsland-veranstaltungen?tx_sfdeskline_event%5Bfilter_city%5D%5B%5D=3f780478-6f95-499f-a7d1-22a9f3d58777 155973
* https://www.suedlicheweinstrasse.de/veranstaltungen/weinfeste -> 200 https://www.suedlicheweinstrasse.de/veranstaltungen/weinfeste 245951
* https://www.vg-annweiler.de/aktuelles/amtsblatt-trifels-kurier/ -> 200 https://www.vg-annweiler.de/aktuelles/amtsblatt-trifels-kurier/ 386836
* https://www.vg-monsheim.de/aktuelles/amtsblatt/ -> 200 https://www.vg-monsheim.de/aktuelles/amtsblatt/ 221838
* https://www.vg-freinsheim.de/wohnen-leben/amtsblatt/ -> 200 https://www.vg-freinsheim.de/wohnen-leben/amtsblatt/ 294975
* https://www.ruwer.de/aktuelles/amtsblatt/ -> 200 https://www.ruwer.de/aktuelles/amtsblatt/ 135687
* https://www.gerolstein.de/aktuelles/mitteilungsblatt/ -> 200 https://www.gerolstein.de/aktuelles/mitteilungsblatt/ 134899

## Websuchen (WebSearch, keine Abrufe)
Feusdorf Veranstaltungen; Morscheid Homepage; Gimbsheim Kalender; Flörsheim-Dalsheim Kerb; Herxheim am Berg Weinfest; Gimbsheim Website; Herxheim Website; Bischheim Homepage; VG Kusel-Altenglan Kalender; VG Annweiler Kalender; gerolsteiner-land Kalender; ruwer-hochwald Morscheid; Gossersweiler-Stein Kerwe 2026; Erdesbach Kerwe 2026; Bischheim Kerwe 2026; Kirchheimbolanden Kalender; Morscheid Kirmes 2026 (2x); Gimbsheim Kerb 2026; Kirchheimbolanden OrtsApp; Kusel-Altenglan Amtsblatt Verlag; Erdesbach Dorffest; Bischheim OrtsApp.
