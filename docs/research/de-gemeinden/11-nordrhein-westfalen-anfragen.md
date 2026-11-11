# Nordrhein-Westfalen: Liste aller Anfragen (29.10.2026)

Zu [11-nordrhein-westfalen.md](11-nordrhein-westfalen.md). Nur lesende GET-Anfragen (ein HEAD
bei Saerbeck), keine Konten, keine Formulare, keine Mails. Je Gemeindehost höchstens 8 Anfragen.
Die Abschnitte 2 bis 5 stammen aus den Teilrecherchen dieser Session (Gruppen a, b, c der
Stichprobe und Quellen oberhalb der Gemeinde) und sind unverändert übernommen.

## Regelabweichungen

Sechs Anfragen gingen an Pfade, die die robots.txt sperrt. In allen Fällen lief der Abruf im selben
Skript wie das Laden der robots.txt, bevor diese ausgewertet war. Danach ging an diese Hosts nichts
mehr, und kein Inhalt daraus ist in den Bericht eingegangen, außer den Konfigurationsnamen, die
ausdrücklich so gekennzeichnet sind:

| Host | Anfrage | Status | Gruppe |
|---|---|---|---|
| opendata.rhein-kreis-neuss.de | `/api/explore/v2.1/catalog/datasets?...search("Jüchen")` | 400 | c |
| opendata.rhein-kreis-neuss.de | `/api/explore/v2.1/catalog/datasets?...search("Veranstaltung")` | 400 | c |
| opendata.rhein-kreis-neuss.de | `/api/explore/v2.1/catalog/datasets?...search("kirmes") OR ...` | 400 | d |
| exchange.cmcitymedia.de | `/blankenheim/calendarV4_0/data/config.js` (nur Konfigurationsnamen im Bericht) | 200 | a |
| share-it.datenportal-muensterland.de | `/js/latest/4167.js` (Widget-Skript Hopsten; nur `type`, `contentUrl` im Bericht) | 200 | b |
| www.krz.de | Startseite, Inhalt nicht verwendet | 200 | d |

## 1. Haupt-Session

* `GET https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/AuszugGV3QAktuell.xlsx?__blob=publicationFile` 200 (1.872.608 Byte)
* destination.one, alle `https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&startdate=10/29/2026&enddate=10/28/2027&...`, je 200:
  * ohne Ortsfilter und `q=area:"Nordrhein-Westfalen"` (2)
  * `q=city:"<Name>"` je Stichprobengemeinde und Ergänzung, `limit=50` (40)
  * `q=area:"Nordrhein-Westfalen" AND title:<Wort>` für Schützenfest, Kirmes, Weihnachtsmarkt, Dorffest, Feuerwehrfest, Erntedank, Erntedankfest, Pfarrfest, Heimatfest, Stadtfest, Maifest, Martinsmarkt, Oktoberfest, Kirchweih, Schützenfeste, Sommerfest, Straßenfest, Volksfest (18)
  * erneut `q=city:"<Name>"` mit `limit=100` für die 25 Orte mit Treffer, um Lizenzattribut und Titel auszuwerten (25)
  * `q=area:"Nordrhein-Westfalen"`, `limit=100`, `offset=0..400` für die Lizenzverteilung (5)
  * `q=city:"Heek"` zur Feldprobe (2)
  * `q=area:"Nordrhein-Westfalen" AND title:<Wort>` für Martinszug, Martin, Sankt, Kirmes, Schützen, Sternmarsch, Adventsmarkt, Nikolausmarkt, Krammarkt, Pfarrfest, Patronatsfest, Karneval, Prinzenproklamation (13)

## 2. Gruppe a (Stichprobe Nr 1 bis 15)

1. https://www.sonsbeck.de/robots.txt 404
2. https://www.gemeinde-schlangen.de/robots.txt 404
3. https://www.wachtendonk.de/robots.txt 404
4. https://www.langenberg.de/robots.txt 404
5. https://www.rheurdt.de/robots.txt 200
6. https://www.erndtebrueck.de/robots.txt 200
7. https://www.saerbeck.de/robots.txt 200
8. https://www.legden.de/robots.txt 200
9. https://www.altenbeken.de/robots.txt 200
10. https://www.heek.de/robots.txt 200
11. https://www.landgemeinde.de/robots.txt 200
12. https://www.vettweiss.de/robots.txt 200
13. https://www.horstmar.de/robots.txt 404
14. https://www.blankenheim.de/robots.txt 200
15. https://www.tecklenburg.de/robots.txt 404
16. https://www.sonsbeck.de/freizeit-tourismus/veranstaltungen 200
17. http://www.gemeinde-schlangen.de/gemeinde/aktuelles/veranstaltungen.php 200
18. bis 22. https://www.gemeinde-schlangen.de/gemeinde/aktuelles/veranstaltungen.php?pageIde816547c=2 … =6 je 200
23. https://www.gemeinde-schlangen.de/de-wGlobal/wGlobal/scripts/php/createICal.php?path=/gemeinde/aktuelles/veranstaltungen/termine/Schlaenger-Markt.php 404
24. https://www.wachtendonk.de/tourismus-freizeit/veranstaltungen/ 200
25. https://www.wachtendonk.de/tourismus-freizeit/veranstaltungen/veranstaltungskalender/ 200
26. https://www.wachtendonk.de/kalender/veranstaltungskalender-gesamt/events.json?weekends=false&tagMode=ALL 200
27. https://www.wachtendonk.de/kalender/veranstaltungskalender-gesamt/event.ics?weekends=false&tagMode=ALL 200
28. https://www.langenberg.de/ 200 (Ziel /startseite/)
29. https://www.langenberg.de/startseite/kalender/events.json?weekends=false&tagMode=ALL 200
30. https://www.langenberg.de/startseite/leben-in-langenberg/freizeit-sport-gastronomie-veranstaltungen/veranstaltungen/ 200
31. https://www.langenberg-app.de/robots.txt 200
32. https://www.langenberg-app.de/ 200
33. https://www.rheurdt.de/freizeit-kultur/veranstaltungen 200
34. https://api.cross-7.de/robots.txt 404
35. https://api.cross-7.de/public/calendar/534/events?pageNumber=1&pageSize=100&from=2026-10-29T00:00:00&sortType=time&sortDirection=ascending 422
36. dieselbe mit from=2026-10-29T00:00:00.000Z 200
37. https://www.erndtebrueck.de/ 200
38. https://www.erndtebrueck.de/wp-json/wp/v2/pages?search=veranstaltung&_fields=link,title&per_page=50 200
39. https://termine-wittgenstein.de/robots.txt 404
40. https://termine-wittgenstein.de/ 200
41. https://termine-wittgenstein.de/kalender/1/?form%5Bregion%5D=4 200
42. https://www.saerbeck.de/Seiten/Veranstaltungskalender-2.html 200 (0 Byte, 10:33)
43. https://www.legden.de/tourismus-freizeit/tourismus/veranstaltungskalender/ 200
44. https://www.legden.de/unsere-gemeinde/aktuelles/termine-und-veranstaltungen/aktuelle-veranstaltungen/ 200
45. https://www.legden.de/veranstaltungen/veranstaltungen.ical?zeitauswahl=1&auswahl_woche_tage=28&…&selected_kommune=24110&…&beginn=20261029000000&ende=20271231235959&kultur=0&intern=0 200
46. https://www.altenbeken.de/de/veranstaltungen/ 200
47. https://www.saerbeck.de/Seiten/Veranstaltungskalender-2.html? 200 (0 Byte, 10:41)
48. https://www.altenbeken.de (versehentlich leerer Pfad) 200
49. https://www.altenbeken.de/de/veranstaltungen/termine/ausbildungsmesse2026.php 200
50. https://www.altenbeken.de/de-wGlobal/wGlobal/scripts/php/createICal.php?path=/de/veranstaltungen/termine/ausbildungsmesse2026.php&from=2026-11-21%2009:00:00&to=2026-11-21%2013:00:00 200
51. https://www.heek.de/kultur-tourismus/veranstaltungen/ 200
52. https://www.heek.de/kultur-tourismus/veranstaltungen/veranstaltungskalender/ 200
53. HEAD https://www.saerbeck.de/Seiten/Veranstaltungskalender-2.html? 200 (10:49)
54. https://www.heek.de/veranstaltungen/veranstaltungen.ical?zeitauswahl=1&auswahl_woche_tage=28&…&selected_kommune=24120&…&beginn=20261029000000&ende=20261128235959&kultur=0&intern=0 200
55. https://heimatinfo-api-platform.azurewebsites.net/communes/9d8406e1-5bce-4898-b90e-d12721452b52/events 200
56. https://heimatinfo-api-platform.azurewebsites.net/communes/79ef49ec-d48d-4b47-ab8d-441fb8c46611/events 200
57. https://www.gemeinde-titz.de/robots.txt 200
58. https://heimatinfo-api-platform.azurewebsites.net/communes/9d8406e1-5bce-4898-b90e-d12721452b52 200
59. https://www.horstmar.de/ 200
60. https://horstmarerleben.de/robots.txt 200
61. https://horstmarerleben.de/neuigkeiten-event-kalender 200
62. https://horstmarerleben.de/events/feed/ 200
63. bis 65. https://horstmarerleben.de/events/feed/?paged=2, =3, =4 je 200 (gleicher Inhalt)
66. https://www.blankenheim.de/de/freizeit/events/veranstaltungskalender 200
67. https://exchange.cmcitymedia.de/robots.txt 200
68. https://exchange.cmcitymedia.de/blankenheim/calendarV4_0/data/config.js 200 (im selben Befehl vor dem Lesen der robots.txt; danach keine Anfragen mehr dort)
69. https://www.blankenheim.de/de/freizeit/events/gemeinde-blankenheim-im-advent 200
70. https://www.tecklenburg.de/de/veranstaltungen/ 200
71. https://www.tecklenburg.de/ 200

Websuchen (5): Titz Heimat-Info; Vettweiß Heimat-Info; „Heimat-Info" Kreis Düren; Saerbeck Weihnachtsmarkt 2026; Tecklenburg Weihnachtsmarkt 2026. Höchstens 8 Anfragen je Host eingehalten (Maximum: gemeinde-schlangen.de 8).

## 3. Gruppe b (Stichprobe Nr 16 bis 30)

robots.txt: barntrup 200, hopsten 404, heimbach-eifel 200, schieder-schwalenberg 200, gemeinde-inden 200,
breckerfeld 404, schoeppingen 200, dahlem 200, everswinkel 200, marienmuenster 200, nettersheim 200,
beelen 200, medebach 200, wettringen 404, metelen 200, share-it.datenportal-muensterland 200,
metelen-app 200, wettringen-tourismus 200, heimat-info 200, tourismus.schieder-schwalenberg 200,
muensterland.com 404, teutoburgerwald 200, ckan.open.nrw 200.

Seiten und Daten:
* 200 https://www.metelen.de/rathaus-politik/serviceportal/vereine-veranstaltungen/
* 200 https://www.everswinkel.de/de/veranstaltungen/
* 200 https://www.hopsten.de/gemeindeleben/veranstaltungen/
* 200 https://www.schoeppingen.de/regional/veranstaltungen/sucheplus.html
* 200 https://www.breckerfeld.de/touismus-kultur/veranstaltungen.html
* 200 https://www.barntrup.de/Tourismus-Kultur-Freizeit/Veranstaltungskalender.htm
* 200 https://www.wettringen.de/wohnen-leben/veranstaltungen/
* 404 https://www.nettersheim.de/home/home/veranstaltungen/
* 200 https://www.marienmuenster.de/de/freizeit-gaeste/touristinformation/veranstaltungen (→ /seite-1/suche-none)
* 200 https://www.medebach.de/leben-in-medebach/veranstaltungen
* 200 https://www.barntrup.de/Tourismus-Kultur-Freizeit/Veranstaltungskalender.htm/Veranstaltungen?az=all&page=4
* 200 https://share-it.datenportal-muensterland.de/js/latest/4167.js (siehe Hinweis bei Hopsten)
* 200 https://www.schoeppingen.de/veranstaltungen/veranstaltungen.ical?zeitauswahl=1&...&selected_kommune=28230&...&beginn=20261029000000&ende=20271029235959&...
* 200 (0 Byte) https://www.schoeppingen.de/veranstaltungen/veranstaltungen.ical?zeitauswahl=0&...
* 200 https://www.nettersheim.de/ (→ /home/)
* 200 https://www.everswinkel.de/de/veranstaltungen/termine/import/event_43026.php
* 200 https://www.marienmuenster.de/de/freizeit-gaeste/touristinformation/veranstaltungen/seite-4/suche-none
* 200 https://www.breckerfeld.de/touismus-kultur/test.html
* 200 https://www.wettringen-tourismus.de/
* ERR (SSL, requests) und 200 (curl-Wiederholung) https://www.metelen-app.de/veranstaltungskalender/c/0
* 200 https://www.metelen.de/regional/veranstaltungen/sucheplus.html
* 200 https://www.metelen-app.de/veranstaltungskalender/c/1
* 200 https://www.metelen.de/veranstaltungen/veranstaltungen.ical?zeitauswahl=1&...&selected_kommune=30460&...&beginn=20261029000000&ende=20261128235959&...
* 200 https://www.wettringen-tourismus.de/veranstaltungen/
* 200 https://www.nettersheim.de/home/veranstaltungen/
* 200 https://www.nettersheim.de/home/veranstaltungen/?tx_ilveranstaltungen_pi1%5Bpointer%5D=1&cHash=14a32b4f1e1a4d3444e07bd8b28a2bd2
* 200 Heimat-Info API `communes/<id>/events` für Inden, Heimbach, Dahlem, Nettersheim (4×), `communes/<Inden-id>` (1×)
* 200 https://www.heimat-info.de/embeddings/events/v1/?c=<id> für Heimbach, Nettersheim, Dahlem, Inden (4×)
* 200 https://www.muensterland.com/tourismus/service/veranstaltungen-im-muensterland/
* 200 https://ckan.open.nrw/dataset/veranstaltungs-datenbank-und-touristisch-interessante-standorte-im-munsterland-ms (nach 11 s, Crawl-Delay 10)
* 200 https://www.hopsten.de/buerger/hopsten-app/
* 404 https://www.everswinkel.de/de-wGlobal/wGlobal/scripts/php/createICal.php?path=/de/veranstaltungen/termine/import/event_43026.php

Websuchen (11): Inden-, Heimbach-, Dahlem-, Schieder-Schwalenberg-, Beelen-Kalender; Schieder-Schwalenberg
Feste; tourismus.schieder-schwalenberg.de; Beelen Weihnachtsmarkt; Datenportal Münsterland API;
Heimat-Info Inden/Heimbach/Dahlem/Nettersheim; Kirmes Hergarten.

## 4. Gruppe c (Ergänzung E1 bis E10)

| Status | URL |
|---|---|
| 200 | https://www.stadt-willich.de/robots.txt |
| 404 | https://www.juechen.de/robots.txt |
| 200 | https://www.holzwickede.de/robots.txt |
| 200 | https://www.bedburg-hau.de/robots.txt |
| 200 | https://www.niederkruechten.de/robots.txt |
| 200 | https://www.meschede.de/robots.txt |
| 404 | https://www.emsdetten.de/robots.txt |
| 404 | https://www.havixbeck.de/robots.txt |
| 200 | https://www.hueckelhoven.de/robots.txt |
| 404 | https://www.wegberg.de/robots.txt |
| 200 | https://www.stadt-willich.de/veranstaltungen (→ /kultur-freizeit/veranstaltungen) |
| 200 | https://www.juechen.de/aktuelles/veranstaltungen |
| 404 | https://www.holzwickede.de/veranstaltungen/index.php |
| 200 | https://www.bedburg-hau.de/buerger-rathaus/aktuelles/veranstaltungen (→ /gemeinde-rathaus/aktuelles-aus-dem-rathaus/veranstaltungen) |
| 200 | https://www.niederkruechten.de/tourismus-freizeit/veranstaltungen |
| 200 | https://www.meschede.de/veranstaltungsorte |
| 200 | https://www.emsdetten.de/tourismus-kultur-veranstaltungen/ |
| 200 | https://www.havixbeck.de/de/tourismus/kultur/veranstaltungskalender.php |
| 200 | https://www.hueckelhoven.de/aktuelles/veranstaltungen/ (→ /stadtleben/events/veranstaltungen/) |
| 200 | https://www.wegberg.de/tourismus-kultur/veranstaltungen/ |
| 200 | https://www.stadt-willich.de/kultur-freizeit/veranstaltungen?page=4 |
| 200 | https://www.stadt-willich.de/kultur-freizeit/veranstaltungen?type=2417 |
| 200 | https://www.stadt-willich.de/kultur-freizeit/veranstaltungen?type=2416 |
| 200 | https://www.stadt-willich.de/kultur-freizeit/veranstaltungen?page=1 |
| 200 | https://www.stadt-willich.de/kultur-freizeit/veranstaltungen?page=2 |
| 200 | https://www.stadt-willich.de/kultur-freizeit/veranstaltungen?page=3 |
| 200 | https://opendata.rhein-kreis-neuss.de/robots.txt |
| 400 | https://opendata.rhein-kreis-neuss.de/api/explore/v2.1/catalog/datasets?where=search("Jüchen")&limit=100&select=dataset_id,metas.default.title (vor dem Lesen der robots.txt abgesetzt; `/api/` ist gesperrt) |
| 400 | https://opendata.rhein-kreis-neuss.de/api/explore/v2.1/catalog/datasets?where=search("Veranstaltung")&limit=100&select=dataset_id,metas.default.title (dito) |
| 200 | https://opendata.rhein-kreis-neuss.de/sitemap.xml |
| 200 | https://www.holzwickede.de/ |
| 200 | https://www.holzwickede.de/sitemap.xml |
| 200 | https://www.holzwickede.de/news/1 |
| 200 | https://www.holzwickede.de/amtsblatt/index.php |
| 200 | https://www.bedburg-hau.de/gemeinde-rathaus/aktuelles-aus-dem-rathaus/veranstaltungen?page=14 |
| 200 | …/veranstaltungen?field_evt_type_ref_target_id=199 (Bedburg-Hau) |
| 200 | …/veranstaltungen?field_evt_type_ref_target_id=197 (Bedburg-Hau) |
| 200 | …/veranstaltungen?field_evt_type_ref_target_id=191 (Bedburg-Hau) |
| 200 | …/veranstaltungen?field_evt_type_ref_target_id=194 (Bedburg-Hau) |
| 200 | https://www.bedburg-hau.de/tourismus-freizeit/veranstaltungen/st-martinszug-hau |
| 200 | https://www.niederkruechten.de/tourismus-freizeit/veranstaltungen?page=1 |
| 200 | https://www.niederkruechten.de/tourismus-freizeit/veranstaltungen?page=2 |
| 200 | https://www.niederkruechten.de/tourismus-freizeit/veranstaltungen?page=3 |
| 200 | https://www.niederkruechten.de/tourismus-freizeit/veranstaltungen?page=4 |
| 200 | https://www.niederkruechten.de/tourismus-freizeit/veranstaltungen?page=5 |
| 200 | https://www.niederkruechten.de/tourismus-freizeit/veranstaltungen/schuetzenfest-der-st-agatha-schuetzenbruderschaft-1608-ev |
| 200 | https://www.meschede.de/freizeit-kultur |
| 200 | https://www.meschede.de/wirtschaft-karriere-bildung/stadtmarketing-meschede/aktionen-veranstaltungen |
| 200 | https://www.hennesee-sauerland.de/robots.txt |
| 200 | https://www.meschede.de/veranstaltungskalender |
| 200 | https://www.meschede.de/event/martinsmarkt |
| 200 | https://www.emsdetten.de/tourismus-kultur-veranstaltungen/veranstaltungen/ |
| 200 | https://www.emsdetten.de/tourismus-kultur-veranstaltungen/veranstaltungen/veranstaltungskalender/ |
| 200 | https://www.emsdetten.de/kalender/termine/veranstaltungen-in-emsdetten/events.json?weekends=false&tagMode=ALL |
| 200 | https://www.vvemsdetten.de/robots.txt (→ emsdettenleben.de, nur Sitemap-Zeile) |
| 404 | https://www.vvemsdetten.de/events/kalender (→ emsdettenleben.de) |
| 200 | https://www.emsdettenleben.de/ |
| 200 | https://www.emsdettenleben.de/veranstaltungen/veranstaltungskalender/ |
| 200 | https://crossiety.app/robots.txt (nur `/admin` gesperrt) |
| 200 | https://crossiety.app/event_cards/1847629 |
| 200 | https://www.hueckelhoven.de/wp-json/wp/v2/termin?per_page=100 |
| 200 | https://www.hueckelhoven.de/stadtleben/events/kirmes/ |
| 200 | https://www.wegberg.de/tourismus-kultur/veranstaltungskalender/ |
| 200 | https://www.wegberg.de/kalender/events.json?weekends=false&tagMode=ALL |

Je Host höchstens 8 (stadt-willich.de 8, bedburg-hau.de 8, niederkruechten.de 8, meschede.de 6, holzwickede.de 6, emsdetten.de 5, emsdettenleben.de 4 über die Umleitung, hueckelhoven.de 4, wegberg.de 4, opendata.rhein-kreis-neuss.de 4, übrige ≤ 2). Dazu vier Websuchen (Holzwickede zweimal, Willich, Meschede mit Domainfilter).

## 5. Quellen oberhalb der Gemeinde

Websuchen (WebSearch, keine Host-Anfragen): Grevenbroich Heimatfeste; Sauerländer Schützenbund
2027; BHDS Termine (2×); Schützenfeste Soest/Olpe/Arnsberg; Schaustellerverband Kirmes NRW (2×);
fotho Kirmeskalender; Tourismus NRW Data Hub; IT-Dienstleister CMS (regio iT, Südwestfalen-IT, KDN,
krz, Civitec, citeq, GKD Paderborn, Weblication/Scholl); termine.ekir.de; veranstaltungen-ekvw.de;
katholische Bistümer.
WebFetch: deutscherpresseindex.de/?p=24599 (Wartungsseite); luenen.de Data-Hub-PDF (200, gelesen).

Host-Anfragen (python requests, Browser-UA), Reihenfolge wie gesendet:

| Status | URL |
|---|---|
| 200 | https://opendata.rhein-kreis-neuss.de/robots.txt |
| 400 | https://opendata.rhein-kreis-neuss.de/api/explore/v2.1/catalog/datasets?limit=100&select=dataset_id,metas&where=search("kirmes") OR … (vor Auswertung der robots.txt, s. Abschnitt 1) |
| 200 | https://opendata.rhein-kreis-neuss.de/sitemap.xml |
| 200 | https://opendata.rhein-kreis-neuss.de/explore/assets/grevenbroich-volks-und-heimatfeste-2027/ |
| 200 | https://ckan.open.nrw/robots.txt |
| 200 | https://www.govdata.de/robots.txt |
| 200 | https://ckan.open.nrw/dataset/?q=kirmes OR schützenfest OR … "sankt martin" … (0 Treffer) |
| 200 | https://ckan.open.nrw/dataset/?q=kirmes OR heimatfeste OR … (0 Treffer) |
| 200 | https://ckan.open.nrw/dataset/?q=kirmes |
| 200 | https://open.nrw/robots.txt |
| 200 | https://ckan.open.nrw/dataset/?q=veranstaltungen&_organization_limit=0&_license_id_limit=0&_res_format_limit=0 |
| 200 | https://ckan.open.nrw/dataset/?q=veranstaltungskalender&… |
| 200 | https://ckan.open.nrw/dataset/?q=weihnachtsmarkt&… |
| 200 | https://ckan.open.nrw/dataset/?q=schützenfest&… |
| 200 | https://ckan.open.nrw/dataset/?q=veranstaltungen&page=2 |
| 200 | https://opendata.rhein-kreis-neuss.de/explore/assets/grevenbroich-volks-und-heimatfeste-2026/ |
| 200 | https://opendata.rhein-kreis-neuss.de/explore/assets/stadt-neuss-kirmes-schuetzenfest-poi/ |
| 200 | https://opendata.rhein-kreis-neuss.de/explore/assets/stadt-neuss-veranstaltungskalender/ |
| 200 | https://opendata.rhein-kreis-neuss.de/explore/assets/grevenbroich-sankt-martinsumzuege-2026/ |
| 404 | https://www.bhds.de/robots.txt |
| 200 | https://www.bhds.de/ (2×) |
| 200 | https://www.sauerlaender-schuetzenbund.de/robots.txt |
| 200 | https://www.sauerlaender-schuetzenbund.de/ |
| 200 | https://www.wsb1861.de/robots.txt |
| 200 | https://www.wsb1861.de/ |
| 404 | https://www.rsb-ev.de/robots.txt |
| 200 | https://www.rsb-ev.de/ |
| 200 | https://www.rsb1872.de/robots.txt |
| 200 | https://www.rsb1872.de/ (2×) |
| 200 | https://www.xn--sauerlnder-schtzenbund-54b89c.de/schuetzenfeste-im-sauerlaender-schuetzenbund/ |
| 200 | https://www.kreisschuetzenbund-meschede.de/robots.txt |
| 200 | https://www.kreisschuetzenbund-meschede.de/termine/ |
| 200 | https://www.wsb1861.de/index.php/tradition/schuetzenfeste-2025 (2×) |
| 200 | https://www.wsb1861.de/index.php/termine (2×) |
| 200 | https://www.rsb-ev.de/Veranstaltungen-1-21.htm |
| 200 | https://www.wsb1861.de/index.php/tradition/schuetzenfeste-2025/wir-feiern-schuetzenfest |
| 200 | https://v2.ckalender.de/robots.txt |
| 200 | https://v2.ckalender.de/module.eventlist.php?org_id=8234&… (WSB-iFrame) |
| 200 | https://www.bund-bruderschaften.de/ |
| ERR (Timeout) | https://www.bhds.org/ |
| 200 | https://schuetzen.erzbistum-koeln.de/ (Weiterleitung auf bund-bruderschaften.de) |
| 200 | https://www.bund-bruderschaften.de/robots.txt |
| 200 | https://www.bund-bruderschaften.de/fuer-schuetzen/veranstaltungen/ (2×) |
| 200 | https://www.bund-bruderschaften.de/service/zahlen-fakten/ (2×) |
| 200 | https://fotho.de/robots.txt |
| 200 | https://fotho.de/kirmeskalender-nrw/ |
| 200 | https://www.fotho.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-10-29 |
| 200 | https://www.stadt-koeln.de/robots.txt |
| 200 | https://www.stadt-koeln.de/externe-dienste/open-data/events-od.php |
| 200 | https://www.offenedaten-koeln.de/robots.txt |
| 200 | https://www.offenedaten-koeln.de/ |
| 200 | https://www.offenedaten-koeln.de/datasets?k=Brauchtum |
| 200 | https://www.offenedaten-koeln.de/datasets?k=Kirmes |
| 200 | https://www.offenedaten-koeln.de/datasets?k=Schützen |
| 200 | https://www.offenedaten-koeln.de/datasets?k=Veranstaltung |
| 200 | https://www.offenedaten-koeln.de/dataset/veranstaltungen-der-stadt-koeln |
| 200 | https://www.stadt-koeln.de/externe-dienste/open-data/events-od.php?ndays=365 |
| 200 | https://www.regioit.de/robots.txt |
| 200 | https://www.regioit.de/ |
| 200 | https://www.krz.de/robots.txt (`Disallow: /`) |
| 200 | https://www.krz.de/ (vor Auswertung der robots.txt im selben Lauf, Inhalt nicht verwendet) |
| 200 | https://www.citeq.de/robots.txt |
| 200 | https://www.citeq.de/ |
| 200 | https://www.sit.nrw/robots.txt |
| 200 | https://www.sit.nrw/ |
| 404 | https://www.itk-rheinland.de/robots.txt |
| 200 | https://www.itk-rheinland.de/ |
| 200 | https://www.kdn.de/robots.txt |
| 200 | https://www.kdn.de/ |
| 403 | https://www.civitec.de/robots.txt |
| 403 | https://www.civitec.de/ |
| ERR (Verbindung) | https://www.gkd-paderborn.de/robots.txt |
| ERR (Verbindung) | https://www.gkd-paderborn.de/ |
| 200 | https://www.krzn.de/robots.txt |
| 200 | https://www.krzn.de/ |
| 200 | https://www.deutscherpresseindex.de/robots.txt (Wartungsseite) |
| 200 | https://www.deutscherpresseindex.de/?p=24599 (Wartungsseite) |
| 200 | https://www.petershagen.de/robots.txt |
| 200 | https://www.petershagen.de/ |
| 200 | https://www.petershagen.de/Kurzmen%C3%BC/Impressum/ |
| 200 | https://termine.ekir.de/robots.txt |
| 200 | https://termine.ekir.de/xml?eventtype=7&itemsPerPage=1&highlight=all |
| 200 | https://termine.ekir.de/xml?eventtype=7&itemsPerPage=200&highlight=all |
| 200 | https://termine.ekir.de/json?eventtype=7&itemsPerPage=3&highlight=all&q=Martinsmarkt |
| 200 | https://termine.ekir.de/ |
| 404 | https://www.veranstaltungen-ekvw.de/robots.txt |
| 200 | https://www.veranstaltungen-ekvw.de/xml?highlight=all&itemsPerPage=1 |
| 200 | https://www.veranstaltungen-ekvw.de/xml?eventtype=7&itemsPerPage=300&highlight=all |
| 200 | https://www.veranstaltungen-ekvw.de/ |
| 200 | https://www.veranstaltungen-ekvw.de/kalender?q=Weihnachtsmarkt+Hennen |
| 200 | https://termine.ekir.de/veranstaltung_im_detail1043624.html |
| 200 | https://www.veranstaltungen-ekvw.de/veranstaltung_im_detail1345182.html |
| 200 | https://heimatinfo-api-platform.azurewebsites.net/communes/search |
| 200 | https://heimatinfo-api-platform.azurewebsites.net/communes/dd919319-4edf-4f0f-96c0-73743013d97d/events (Korschenbroich) |
| 200 | https://heimatinfo-api-platform.azurewebsites.net/communes/1b0e625f-3c82-4697-a344-7f28a8dab49d/events (Kürten) |
| 200 | https://heimatinfo-api-platform.azurewebsites.net/communes/8aa5380a-2b07-421b-9433-bb987af96ab8/events (Stolberg) |
| 404 | https://www.muensterland.com/robots.txt |
| 404 | https://www.muensterland.com/tourismus/service/veranstaltungen/ |
| 200 | https://www.eifel.info/robots.txt |
| 404 | https://www.eifel.info/veranstaltungen |
| 200 | https://www.sauerland.com/robots.txt |
| 200 | https://www.sauerland.com/veranstaltungen |
| 200 | https://www.teutoburgerwald.de/robots.txt |
| 404 | https://www.teutoburgerwald.de/veranstaltungen |
| 404 | https://termine-wittgenstein.de/robots.txt |
| 200 | https://termine-wittgenstein.de/ (3×) |
| 200 | https://www.kreis-hoexter.de/robots.txt |
| 200 | https://www.kreis-hoexter.de/aktuelles/veranstaltungen (2×) |
| 404 | https://www.kreis-lippe.de/robots.txt |
| 200 | https://www.kreis-lippe.de/ |
| 200 | https://www.sauerland.com/de/veranstaltungen |
| 200 | https://termine-wittgenstein.de/kalender/1/?form%5Brubrik%5D=Fest (2×) |
| 500 | https://termine-wittgenstein.de/impressum |
| 200 | https://www.datenportal-muensterland.de/robots.txt |
| 200 | https://www.datenportal-muensterland.de/ |
| 200 | https://www.muensterland.com/ |
| 200 | https://www.datenportal-muensterland.de/documentation/api (2×) |
| 401 | https://www.datenportal-muensterland.de/api/v1/events?page[size]=1 |
| 200 | https://www.muensterland.com/tourismus/service/veranstaltungen-im-muensterland/ |
| 200 | https://www.eifel.info/ |
| 200 | https://www.teutoburgerwald.de/ |
| 200 | https://www.kreis-lippe.de/kreis-lippe/index.php |
| 200 | https://www.eifel.info/eifel-erleben/veranstaltungen |
| 200 | https://www.teutoburgerwald.de/region/gastro-event/veranstaltungskalender |
| 200 | https://www.kreis-lippe.de/kreis-lippe/termine-veranstaltungen.php |
| 200 | https://www.sauerland.com/de/veranstaltungen/veranstaltungskalender |
| 200 | https://www.xn--sauerlnder-schtzenbund-54b89c.de/ |
| 200 | https://www.fotho.de/impressum/ |
| 200 | https://www.offenesdatenportal.de/robots.txt |
| 502 | https://www.opendata.ruhr/robots.txt |
| 200 | https://www.offenesdatenportal.de/dataset/veranstaltungen-in-geldern |
| 200 | https://www.offenesdatenportal.de/dataset/veranstaltungen-wachtendonk |
| 200 | https://www.offenesdatenportal.de/dataset/veranstaltungskalender-der-stadt-kleve |
| 200 | https://www.offenesdatenportal.de/dataset/veranstaltungskalender-der-stadt-krefeld |

Anfragen je Host (gesamt 145): ckan.open.nrw 9, opendata.rhein-kreis-neuss.de 8, wsb1861.de 7,
offenedaten-koeln.de 7, termine-wittgenstein.de 7, veranstaltungen-ekvw.de 6,
bund-bruderschaften.de 6, termine.ekir.de 6, offenesdatenportal.de 5, datenportal-muensterland.de 5,
alle übrigen 4 oder weniger. Abweichungen von den Regeln: je eine Anfrage an einen per robots.txt
gesperrten Pfad (Rhein-Kreis-Neuss-API, krz.de-Startseite), jeweils im selben Skriptlauf direkt
nach dem robots-Abruf und vor dessen Auswertung; Inhalte daraus nicht verwendet.
