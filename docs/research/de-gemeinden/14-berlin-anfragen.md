# Berlin: Liste aller Anfragen (fn-28.15, 28./29.10.2026)

Gehört zu [14-berlin.md](14-berlin.md). Nur lesende GET-Anfragen, keine Konten,
keine Formulare, keine Mails. User-Agent bei eigenen Abrufen:
`Mozilla/5.0 (compatible; lasstreffen-research/1.0; +https://lasstreffen.at)`
(berlin.de verlangt eine eindeutige Kennung, robots.txt dort Kopfkommentar).
Die Stichprobe haben drei Recherche-Durchgänge (A: Nr. 1 bis 10, B: 11 bis 20,
C: 21 bis 30) bearbeitet; ihre Abruflisten stehen unten unverändert.

## Regelabweichungen (offen gemeldet)

* **bucher-buergerverein.de** (A), **vav-lichtenberg.de `/wp-json/`** (C) und
  **fetedelamusique.de** (C): robots.txt sperrt Claude-Agenten bzw. den Pfad. Je eine
  Startseite bzw. zwei REST-Abrufe liefen im selben Befehl wie der robots-Abruf,
  bevor die Sperre ausgewertet war. Inhalte daraus sind im Bericht nicht als Beleg
  verwendet. Danach keine weiteren Abrufe dort.
* Mehr als etwa 5 GETs je Host: www.berlin.de (eigene Abrufe plus A und C je 7,
  verteilt auf Landeskalender, Senatslisten und Bezirksauftritte),
  buergerverein-franzoesisch-buchholz.de (9, Datum nur im Flyer-Bild), havelbogen.de,
  gwv-haselhorst.de, stadtteilzentrum-steglitz.de, diewestfaelische.berlin (B, meist
  REST-Proben), mueggelheimer-heimatverein.de (6).
* QM-Seiten in Gesundbrunnen antworteten auf REST, iCal und RSS mit 403
  (NinjaFirewall). Ein zweiter Abruf mit Browser-Kennung wurde nicht gemacht.

## Eigene Anfragen (stadtweite Quellen)

| URL | Status | Zweck |
|---|---|---|
| https://www.berlin.de/robots.txt | 200 | Regeln berlin.de |
| https://www.berlin.de/sen/web/service/maerkte-feste/strassen-volksfeste/index.php/index/all.json?q= | 200 | Senatsliste Straßen- und Volksfeste (77 Einträge) |
| https://www.berlin.de/sen/web/service/maerkte-feste/weihnachtsmaerkte/index.php/index/all.json?q= | 200 | Senatsliste Weihnachtsmärkte (48 Einträge, Stand 2025) |
| https://datenregister.berlin.de/api/3/action/package_search?q=volksfeste (und q=weihnachtsm%C3%A4rkte, veranstaltungen, kiez, kalender, termine, feste, kulturdaten, stra%C3%9Fenfeste, nachbarschaft, ortsteile, einwohner+ortsteilen) | 200 | Lizenzen im Datenregister |
| https://datenregister.berlin.de/api/3/action/package_show?id=planbare-ereignisse-im-offentlichen-strassenland-wfs-2c6359e2 | 200 | Beschreibung WFS Ereignisse |
| https://gdi.berlin.de/services/wfs/planb_ereignisse?request=GetCapabilities&service=WFS | 200 | WFS Ereignisse |
| https://gdi.berlin.de/services/wfs/planb_ereignisse?service=WFS&version=2.0.0&request=GetFeature&typeNames=planb_ereignisse:ereignisse&outputFormat=application/json | 200 | 8.541 Ereignisse, keine Titel |
| https://gdi.berlin.de/services/wfs/alkis_ortsteile?service=WFS&version=2.0.0&request=GetFeature&typeNames=alkis_ortsteile:ortsteile&outputFormat=application/json | 200 | 97 Ortsteile (Ziehungsgrundlage) |
| https://www.statistik-berlin-brandenburg.de/opendata/EWR_Ortsteile_2020-12-31.csv | 200 (HTML statt CSV) | Einwohner, toter Link |
| https://www.statistik-berlin-brandenburg.de/archiv/a-i-5-hj | 200 | Berichtsarchiv |
| https://download.statistik-berlin-brandenburg.de/7cb89e083c1ea02d/4e03c8e1693a/SB_A01-05-00_2026h01_BE.xlsx | 200 | Einwohner je Ortsteil 30.06.2026 (Tabelle T11) |
| https://api-v2.kulturdaten.berlin/robots.txt | 404 | keine robots.txt |
| https://api-v2.kulturdaten.berlin/api/events?page=1&pageSize=1&startDate=2026-10-29 | 200 | totalCount 12.414 |
| https://api-v2.kulturdaten.berlin/api/docs, /api/docs/, /api/openapi.yml, / | 301, 200, 404, 200 | API-Doku |
| https://api-v2.kulturdaten.berlin/api/docs/swagger-ui-init.js | 200 | OpenAPI-Pfade und Filter |
| https://api.github.com/repos/technologiestiftung/kulturdaten-api/contents/src und .../git/trees/main?recursive=1 | 200 | Repo-Struktur |
| https://api.github.com/search/code?q=bezirkskalender+repo:technologiestiftung/kulturdaten-api | 401 | Codesuche braucht Login, nicht weiter verfolgt |
| https://raw.githubusercontent.com/technologiestiftung/kulturdaten-api/main/{src/admin/client/HarvesterClient.ts, src/admin/districtData/model/Bezirksdaten.ts, src/admin/districtData/controllers/DistrictDataHarvestersController.ts, src/admin/districtData/services/DistrictDataService.ts, .env.example, src/config/Config.ts, src/admin/AdminRoutes.ts} | 200 | Herkunft der Daten: `DISTRICT_DATA_API_URL` |
| https://www.berlin.de/land/kalender/ | 302 | Weiterleitung auf index.php |
| https://www.berlin.de/land/kalender/index.php | 200 | Landeskalender, Formular und RSS-Link |
| https://www.berlin.de/land/kalender/json.php?c=22 | 200 | 1.749 Veranstaltungen, 11.432 kommende Termine |
| https://www.berlin.de/land/kalender/json.php?c=6 | 200 | Kalender Bezirk Mitte, 165 Veranstaltungen |
| https://www.berlin.de/land/kalender/json.php?c=13 | 200 | Kalender Treptow-Köpenick, 14 Veranstaltungen |
| https://www.berlin.de/ba-mitte/aktuelles/veranstaltungen/ | 404 | enthält Link `land/kalender/?c=6` |
| https://www.berlin.de/ba-treptow-koepenick/aktuelles/veranstaltungen/ | 200 | Link `kalender/?c=13`, RSS `index.php/rss` |
| https://www.berlin.de/rbmskzl/impressum/artikel.15254.php | 200 | Urheberrecht Senatskanzlei |
| https://www.berlin.de/wir-ueber-uns/impressum/ und /wir-ueber-uns/agb/ | 200 | Betreiber BerlinOnline, Urheberrecht |
| https://www.berlin.de/events/volksfeste/ | 200 | Redaktionsauswahl, keine JSON-LD-Liste |
| https://www.berlin.de/events/volksfeste/index.rss | 200 | 15 Items |
| https://www.berlin.de/events/4531106-2229501-schoeneberger-kuerbisfest.html | 200 | JSON-LD `Festival` mit startDate/endDate |
| https://www.berlin.de/weihnachtsmarkt/ | 200 | 76 Weihnachtsmarkt-Seiten 2026 |
| https://www.berlin.de/weihnachtsmarkt/5685464-3496862-altglienicker-adventsmarkt.html | 200 | Feldblock „Auf einen Blick“ |
| https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=20&startdate=10/29/2026&enddate=10/28/2027&q=area:"Berlin" | 200 | overallcount 1 |
| dieselbe Anfrage mit `q=city:"Berlin"` | 200 | 32, davon 1 in Berlin |
| dieselbe Anfrage mit `q=city:"<Ortsteil>"` für alle 30 Stichproben-Ortsteile | 200 | siehe Bericht, 0 Treffer in Berlin |
| https://www.berliner-woche.de/robots.txt | 301 | auf morgenpost.de/berliner-woche/ |
| https://www.morgenpost.de/robots.txt | 200 | Disallow / für anthropic-ai, ClaudeBot, Claude-Web |
| https://www.visitberlin.de/robots.txt | 200 | keine Sperre für Claude |
| https://www.visitberlin.de/de/veranstaltungen-berlin | 200 | nur WebPage-JSON-LD, Tipps |
| https://www.quartiersmanagement-berlin.de/robots.txt | 200 | keine Sperre |
| https://www.gratis-in-berlin.de/robots.txt | 200 | keine Sperre, nicht weiter abgerufen |
| https://www.berliner-feuerwehr.de/robots.txt | 200 | keine Sperre, keine Terminseite gefunden |

Dazu Websuchen (ohne Abruf der Treffer): berlin.de Straßenfeste 2026, Berliner Woche
Veranstaltungen, Freiwillige Feuerwehr Berlin Tag der offenen Tür 2026 (zweimal),
Einwohner Ortsteile 2025/2026.

## Durchgang A (Ortsteile 1 bis 10)


robots.txt-Abrufe (alle 200, keine Sperre für Claude, wenn nicht anders vermerkt): dorfanger-blankenburg.de, stadtgut-blankenfelde.de, buergerverein-franzoesisch-buchholz.de, gruen-berlin.de (nur Kommentare, keine Regeln), berlin-buch.com (404), bucher-bote.de, aufbuchen.de, www.stz-pankow.de, stadtgut-buch.de, bucher-buergerverein.de (Disallow / für ClaudeBot, anthropic-ai, GPTBot, CCBot u. a.), www.berliner-woche.de (Umleitung auf https://www.morgenpost.de/berliner-woche/, 200, HTML statt robots), www.morgenpost.de (Disallow / für anthropic-ai, ClaudeBot, Claude-Web), www.klausenerplatz.de, www.quartiersmanagement-berlin.de, www.badstrasse-quartier.de, www.brunnenviertel-brunnenstrasse.de, www.soldiner-quartier.de, www.pankstrasse-quartier.de, weddingweiser.de, hansaviertel.berlin, kiez-zentrum-villa-luetzow.de, www.berlin.de, www.visitberlin.de, interkulturanstalten.de (über ulme35.de), www.family-and-friends-ev.de, berlinecho.de, www.kulturvolk.de, albatros.social. xn--brgerverein-franzoesisch-buchholz-87c.de: keine Verbindung (000).

Erreichbarkeitsprüfungen (GET Startseite, Inhalt verworfen): bucher-bote.de 200, www.bucher-bote.de 200, buchonline.de 200 (nach /de), aufbuchen.de 200, www.aufbuchen.de 200, stz-pankow.de 200 (nach www), stadtgut-buch.de 200, www.stadtgut-buch.de 200, stadtgut-berlin-buch.de 200 (Umleitung auf Domainhandel nicsell.com), albatrosggmbh.de 200 (nach albatros.social), www.albatrosggmbh.de 200; ohne Verbindung (000): buergerverein-buch.de, stadtteilzentrum-buch.de, stadtteilzentrum-pankow.de, kultur-quartier.berlin, feste-scheune.de, www.feste-scheune.de, buergerhaus-buch.de, bucher-buergerhaus.de, ev-kirche-buch.de, www.kirche-buch.de, www.kirchengemeinde-buch.de.

Inhaltsabrufe:

| URL | Status |
|---|---|
| https://dorfanger-blankenburg.de/ (nach /cms/) | 200 |
| https://dorfanger-blankenburg.de/cms/ | 200 |
| https://dorfanger-blankenburg.de/cms/veranstaltungskalender | 200 |
| https://calendar.google.com/calendar/ical/kalender%40dorfanger-blankenburg.de/public/basic.ics | 200 |
| https://stadtgut-blankenfelde.de/ (zweimal) | 200 |
| https://stadtgut-blankenfelde.de/verein/feste/ | 200 |
| https://stadtgut-blankenfelde.de/wp-json/wp/v2/posts?per_page=20 | 200 |
| https://buergerverein-franzoesisch-buchholz.de/ | 200 |
| https://buergerverein-franzoesisch-buchholz.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-10-29 | 200 (0 Termine) |
| https://buergerverein-franzoesisch-buchholz.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-01-01&end_date=2026-10-28 | 200 (0 Termine) |
| https://buergerverein-franzoesisch-buchholz.de/buchholzer-festtage-2/buchholzer-festtage-2026/ | 200 |
| https://buergerverein-franzoesisch-buchholz.de/feed/ | 200 |
| https://buergerverein-franzoesisch-buchholz.de/2026/05/12/buchholzer-festtage-2026/ | 200 |
| https://buergerverein-franzoesisch-buchholz.de/wp-content/uploads/2026/05/Flyer-Buchholzer-Festtage.pdf | 200 (Bild-PDF) |
| https://buergerverein-franzoesisch-buchholz.de/wp-content/uploads/2026/05/FesttageFlyer2026-1024x552.jpg | 200 |
| https://gruen-berlin.de/projekte/parks/botanischer-volkspark-blankenfelde-pankow/veranstaltungen | 404 |
| https://gruen-berlin.de/projekte/parks/botanischer-volkspark-blankenfelde-pankow | 404 |
| https://berlin-buch.com/ (zweimal) | 200 |
| https://berlin-buch.com/de/kultur | 200 |
| https://bucher-bote.de/ (zweimal) | 200 |
| https://bucher-bote.de/index.php/kulturkalender/range.listevents/- | 200 |
| https://bucher-bote.de/index.php?option=com_jevents&task=modlatest.rss&format=feed&type=rss&Itemid=104&modid=0 | 200 (leer) |
| https://bucher-bote.de/index.php/kulturkalender/year.listevents/2026/10/29/- | 200 (leer) |
| https://aufbuchen.de/ | 200 |
| https://www.stz-pankow.de/ | 200 |
| https://www.stz-pankow.de/angebote/lebendiger-adventskalender-im-neumannkiez/ | 200 |
| https://www.stz-pankow.de/wp-json/wp/v2/types | 200 |
| https://www.stz-pankow.de/wp-json/wp/v2/appointment?per_page=100&orderby=date&order=desc | 200 (0) |
| https://stadtgut-buch.de/ | 200 |
| https://stadtgut-buch.de/aktuelles-veranstaltungen/ | 200 |
| https://bucher-buergerverein.de/ (versehentlich im selben Befehl wie robots.txt) | 200 |
| https://www.klausenerplatz.de/ (nach klausenerplatz.de) | 200 |
| https://klausenerplatz.de/wp-json/wp/v2/posts?search=Weihnachtsmarkt&per_page=8 | 200 |
| https://klausenerplatz.de/wp-json/wp/v2/posts?search=Kiezfest&per_page=8 | 200 |
| https://klausenerplatz.de/wp-json/wp/v2/posts?per_page=30 | 200 |
| https://www.quartiersmanagement-berlin.de/quartiere.html | 200 |
| https://www.quartiersmanagement-berlin.de/quartiere/badstrasse.html | 200 |
| https://www.badstrasse-quartier.de/ | 200 |
| https://www.badstrasse-quartier.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-10-29 | 403 |
| https://www.badstrasse-quartier.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-01-01&end_date=2026-10-28&search=fest | 403 |
| https://www.badstrasse-quartier.de/?post_type=tribe_events&ical=1&eventDisplay=list | 403 (NinjaFirewall) |
| https://www.badstrasse-quartier.de/feed/ | 403 |
| https://www.brunnenviertel-brunnenstrasse.de/ | 200 |
| https://www.brunnenviertel-brunnenstrasse.de/wp-json/tribe/events/v1/events?…search=fest | 403 |
| https://www.brunnenviertel-brunnenstrasse.de/wp-json/tribe/events/v1/events?…start_date=2026-10-29 | 403 |
| https://www.brunnenviertel-brunnenstrasse.de/feed/ | 403 |
| https://www.soldiner-quartier.de/ | 200 |
| https://www.soldiner-quartier.de/wp-json/tribe/events/v1/events?…search=fest | 403 |
| https://www.soldiner-quartier.de/wp-json/tribe/events/v1/events?…start_date=2026-10-29 | 403 |
| https://www.soldiner-quartier.de/feed/ | 403 |
| https://weddingweiser.de/ | 200 |
| https://weddingweiser.de/kalender (nach /kalender/) | 200 |
| https://weddingweiser.de/events.ics | 200 |
| https://weddingweiser.de/wp-json/wp/v2/posts?search=Gesundbrunnen%20Fest&per_page=20&after=2026-01-01T00:00:00 | 200 |
| https://weddingweiser.de/das-sind-die-highlights-beim-stadt-land-panke-festival/ | 200 |
| https://hansaviertel.berlin/aktuelles/ | 200 |
| https://hansaviertel.berlin/wp-json/wp/v2/posts?search=fest&per_page=15 | 200 |
| https://kiez-zentrum-villa-luetzow.de/aktuelles/ (nach www.) | 200 |
| https://www.kiez-zentrum-villa-luetzow.de/aktuelles?storage=2848&type=1573738558&cHash=74e35b08f232fa152203d993ef67475f&start=2026-01-01&end=2027-01-31 (GET) | 200 (JSON, Parameter ignoriert) |
| https://www.berlin.de/stk-mitte/unsere-stadtteilkoordinationen/ | 200 |
| https://www.berlin.de/stk-mitte/unsere-stadtteilkoordinationen/stk-tiergarten-sued/aktuelles/artikel.569480.php | 200 |
| https://www.berlin.de/ba-charlottenburg-wilmersdorf/aktuelles/pressemitteilungen/2026/ | 200 |
| https://www.berlin.de/en/events/7533717-7519779-kulturvolk-summer-festival.en.html (Umleitung in /folk-festivals-fairs/) | 200 |
| https://www.berlin.de/ba-pankow/aktuelles/pressemitteilungen/2026/ | 200 |
| https://www.berlin.de/ba-pankow/aktuelles/pressemitteilungen/2026/pressemitteilung.1708720.php | 200 (Kulturinsel, Prenzlauer Berg, nicht Stichprobe) |
| https://www.berlin.de/en/events/easter/easter-fires/9594418-9559423-osterfeuer-in-buch.en.html (Umleitung auf …easter-bonfire-in-buch.en.html) | 200 |
| https://www.visitberlin.de/de/node/2290464 (Umleitung auf Kalender, event_expired=1) | 200 |
| https://interkulturanstalten.de/ | 200 |
| https://interkulturanstalten.de/events.ics | 200 |
| https://www.family-and-friends-ev.de/ | 200 |
| https://www.family-and-friends-ev.de/weinachten-am-ludwig-beck-platz-und-weihnachten-in-westend | 200 |
| https://www.family-and-friends-ev.de/feed/rss2 | 200 |
| https://berlinecho.de/weinbrunnen-ruedesheim-saisonstart-2026/ | 200 |
| https://www.kulturvolk.de/ | 200 |
| https://www.kulturvolk.de/kulturvolk-sommerfest | 200 |
| https://albatros.social/ | 200 |
| https://albatros.social/angebote/standorte/pankow/ | 200 |
| https://albatros.social/angebote/standorte/stadtteilzentrum-buch/ | 200 |
| https://albatros.social/fileadmin/Redaktion/Standorte/Stadtteilzentrum_Buch/10_Okt_2026.pdf | 200 |

Abweichungen von der Abrufregel: buergerverein-franzoesisch-buchholz.de bekam 9 Inhaltsabrufe (Datum der Festtage stand nur im Flyer-Bild), www.berlin.de 7 (Portal vieler Bezirksämter). bucher-buergerverein.de wurde einmal abgerufen, obwohl robots.txt Claude sperrt (siehe Anmerkung 6).

## Durchgang B (Ortsteile 11 bis 20)


robots.txt:
- https://havelbogen.de/robots.txt 200 (auch www, Weiterleitung) erlaubt alles
- https://gwv-heerstrasse.de/robots.txt 200
- https://gwv-haselhorst.de/robots.txt 200
- https://www.stadtteilzentrum-steglitz.de/robots.txt 200 (sperrt ai1ec-Export und action~-Ansichten für alle)
- https://www.nbhs.de/robots.txt 200 (anthropic-ai nur Bilder/_processed_ gesperrt)
- https://offensiv91.de/robots.txt 200
- https://www.kiezklub-allende-ev.de/robots.txt 200
- https://www.berliner-woche.de/robots.txt 301 auf https://www.morgenpost.de/berliner-woche/ 200
- https://www.morgenpost.de/robots.txt 200 (ClaudeBot, anthropic-ai, Claude-Web: Disallow /)
- https://www.festivalsindeutschland.de/robots.txt 200 (Claude nicht gesperrt)
- https://berlinecho.de/robots.txt 200
- https://www.qm-heerstr-nord.de/robots.txt 301, https://qm-heerstr-nord.de/robots.txt 200
- https://www.berlin.de/robots.txt 200 (Claude nicht gesperrt)
- https://www.ms-event-agentur.com/robots.txt 404
- https://www.diewestfaelische.berlin/robots.txt 200 (über diewestfaelische.berlin)
- https://www.kiezbund.de/robots.txt 200 (über kiezbund.de)
- https://www.benn-altglienicke.de/robots.txt 200, liefert aber HTML „Page Not Found“ (kein robots.txt)

Seiten und Endpunkte:
- https://www.berliner-woche.de/ (HEAD) 301
- https://havelbogen.de/ 200
- https://havelbogen.de/wp-json/tribe/events/v1/events?start_date=2026-01-01&per_page=50 404 (rest_no_route)
- https://havelbogen.de/category/termine/ 200
- https://havelbogen.de/category/termine/feed/ 200 (0 Items)
- https://havelbogen.de/kladower-maifest/ 200
- https://www.festivalsindeutschland.de/festival/kladower-maifest-berlin 200
- https://kladower-christkindlmarkt.de/ keine Verbindung (curl 000); http://kladower-christkindlmarkt.de/ 200 (Alfahosting-Platzhalter); https://www.kladower-christkindlmarkt.de/ keine Verbindung
- https://gwv-heerstrasse.de/ 200
- https://gwv-heerstrasse.de/wp-json/ 200
- https://qm-heerstr-nord.de/ 200
- https://qm-heerstr-nord.de/feed/ 200
- https://qm-heerstr-nord.de/2026/10/09/herbstfest-in-der-gruenen-blase-sonne-spiel-und-pizza/ 200
- https://berlinecho.de/spandau-stadtteilfeste-2026/ 410
- https://www.festivalsindeutschland.de/festival/staakener-kinder-volksfest-berlin 200
- https://gwv-haselhorst.de/ 200
- https://gwv-haselhorst.de/wp-json/ 200
- https://gwv-haselhorst.de/wp-json/wp/v2/search?search=fest&per_page=30 200
- https://gwv-haselhorst.de/angebote/das-fest-der-nachbarn-am-28-05/ 200
- https://gwv-haselhorst.de/wp-json/wp/v2/search?search=sommerfest&per_page=30 200 (leer)
- https://gwv-haselhorst.de/wp-json/wp/v2/types 200
- https://www.festivalsindeutschland.de/festival/spandauer-sommer-berlin 200
- https://www.stadtteilzentrum-steglitz.de/kalender/ 404
- https://www.stadtteilzentrum-steglitz.de/wp-json/tribe/events/v1/events?start_date=2026-10-29&per_page=50 200 (0)
- https://www.stadtteilzentrum-steglitz.de/wp-json/tribe/events/v1/events?start_date=2025-01-01&end_date=2026-12-31&per_page=50 200 (2)
- https://www.stadtteilzentrum-steglitz.de/wp-json/wp/v2/search?search=Gemeindepark / Kunstmarkt / Weihnacht / Laterne je 200
- https://www.stadtteilzentrum-steglitz.de/2026/06/kunstmarkt-im-schlosspark-ein-fest-fuer-gross-und-klein/ 200
- https://www.festivalsindeutschland.de/festival/nachbarschaftsfest-gemeindepark-lankwitz-berlin 200
- https://www.nbhs.de/ 200
- https://www.nbhs.de/aktuelles/kalender 200
- https://www.berlin.de/en/events/4531106-2842498-schoeneberger-kuerbisfest.en.html 200
- https://www.ms-event-agentur.com/ 200
- https://www.ms-event-agentur.com/termine.html 200
- https://www.berlin.de/ba-tempelhof-schoeneberg/aktuelles/veranstaltungen/ 200
- https://www.berlin.de/ba-tempelhof-schoeneberg/aktuelles/veranstaltungen/lichtenrader-lichtermarkt/ 200
- https://www.berlin.de/ba-tempelhof-schoeneberg/aktuelles/veranstaltungen/nachbarschaftsfest/ 200
- https://www.berlin.de/ba-tempelhof-schoeneberg/aktuelles/newsletter/newsletter-fuer-ihre-nachbarschaft/ 200
- https://www.berlin.de/ba-tempelhof-schoeneberg/aktuelles/newsletter/newsletter-fuer-ihre-nachbarschaft/newsletter-lichtenrade/newsletter.1676479.php 200
- https://www.berlin.de/ba-charlottenburg-wilmersdorf/verwaltung/service-und-organisationseinheiten/wirtschaftsfoerderung/projekte/artikel.1609205.php 200
- https://rausgegangen.de/en/organizations/verein-westfalische-strae-ev/ 403
- https://diewestfaelische.berlin/ 200
- https://diewestfaelische.berlin/veranstaltungen/ 200
- https://diewestfaelische.berlin/wp-json/ 200
- https://diewestfaelische.berlin/wp-json/wp/v2/search?search=Wiesn&per_page=10 200
- https://diewestfaelische.berlin/wp-json/wp/v2/events?per_page=50 200 (6 Einträge)
- https://diewestfaelische.berlin/wp-json/wp/v2/events?slug=westfaelische-wiesn&_fields=content Status nicht protokolliert, keine verwertbare Ausgabe
- https://diewestfaelische.berlin/jubilaeum_luxima-2/ 200
- https://www.berlin.de/ba-treptow-koepenick/politik-und-verwaltung/aemter/amt-fuer-soziales/kiezklubs/kiezklub-rathaus-johannisthal/artikel.759849.php 200
- https://www.berlin.de/ba-treptow-koepenick/aktuelles/pressemitteilungen/2026/pressemitteilung.1662264.php 200
- https://www.kiezklub-allende-ev.de/ 200
- https://offensiv91.de/themen/stadtteilarbeit/kiezbund/ 200
- https://kiezbund.de/ 200
- https://kiezbund.de/wp-json/tribe/events/v1/events?start_date=2026-10-29&per_page=50 JSON geliefert (0)
- https://kiezbund.de/wp-json/tribe/events/v1/events?start_date=2026-01-01&end_date=2026-10-28&search=fest JSON geliefert (0)
- https://kiezbund.de/wp-json/tribe/events/v1/events?start_date=2020-01-01&end_date=2027-12-31&per_page=50 JSON geliefert (43)
- https://www.berlin.de/ba-treptow-koepenick/aktuelles/pressemitteilungen/2026/pressemitteilung.1687518.php 200
- https://www.benn-altglienicke.de/ 200

## Durchgang C (Ortsteile 21 bis 30)


| URL | Status |
|---|---|
| https://www.mueggelheimer-heimatverein.de/robots.txt | 200 |
| https://mueggelheimer-heimatverein.de/robots.txt | 200 |
| https://www.mueggelheimer-heimatverein.de/ | 200 |
| https://www.mueggelheimer-heimatverein.de/term_googlecal.shtml | 200 |
| https://www.mueggelheimer-heimatverein.de/ver_angerfest_2026.shtml | 200 |
| https://www.mueggelheimer-heimatverein.de/ver_weihnacht_2026.shtml | 200 |
| https://calendar.google.com/calendar/ical/48pqa3h2n0pfhglahub9j75aas%40group.calendar.google.com/public/basic.ics | 200 |
| https://www.mueggelheimer-bote.de/robots.txt | 404 |
| https://www.mueggelheimer-bote.de/ | 200 |
| https://www.berlin.de/robots.txt | 200 |
| https://www.festivalsindeutschland.de/robots.txt | 200 |
| https://schoenevibes.de/robots.txt | 200 |
| https://schoenevibes.de/ | 200 |
| https://schoenevibes.de/termine/ | 200 |
| https://schoenevibes.de/wp-json/wp/v2/types | 200 |
| https://schoenevibes.de/schoeneweider-brueckenfest/ | 200 |
| https://marzahner-promenade.berlin/robots.txt | 200 |
| https://marzahner-promenade.berlin/ | 200 |
| https://marzahner-promenade.berlin/index.php/impressum.html | 200 |
| https://www.ball-ev-berlin.de/robots.txt | 404 |
| https://ball-ev-berlin.de/robots.txt | 404 |
| https://www.ball-ev-berlin.de/ (→ https://ball-ev-berlin.de/) | 200 |
| https://ball-ev-berlin.de/index.php?rest_route=/tribe/events/v1/events&per_page=50&start_date=2026-10-29 | 200 |
| https://ball-ev-berlin.de/index.php?rest_route=/tribe/events/v1/events&per_page=50&start_date=2026-01-01&end_date=2026-12-31&search=fest | 200 |
| https://xn--biesdorfer-bltenfest-n6b.de/robots.txt | keine Verbindung (000) |
| https://xn--biesdorfer-bltenfest-n6b.de/ | keine Verbindung (000) |
| https://www.berlin.de/ba-marzahn-hellersdorf/aktuelles/pressemitteilungen/2025/pressemitteilung.1553983.php | 200 |
| https://www.berlin.de/en/events/9537154-2842498-biesdorfer-bluetenfest.en.html (→ …biesdorf-blossom-festival.en.html) | 200 |
| https://berlinecho.de/robots.txt | 200 |
| https://berlinecho.de/biesdorfer-bluetenfest-2026-programm-termine/ | 200 |
| https://stadtteilzentrum-friedrichsfelde.de/robots.txt | 200 (zweimal) |
| https://stadtteilzentrum-friedrichsfelde.de/ | 200 |
| https://stadtteilzentrum-friedrichsfelde.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-01-01 | 200 |
| https://stadtteilzentrum-friedrichsfelde.de/traeger-und-foerderung/ | 200 |
| https://www.berlin.de/ba-lichtenberg/aktuelles/artikel.1673225.php | 200 |
| https://www.vav-lichtenberg.de/robots.txt (→ https://vav-lichtenberg.de/robots.txt) | 301 → 200 (zweimal) |
| https://www.vav-lichtenberg.de/ (→ https://vav-lichtenberg.de/) | 200 |
| https://vav-lichtenberg.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-10-29 | 200 (robots-gesperrt, siehe oben) |
| https://vav-lichtenberg.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-01-01&end_date=2026-12-31&search=fest | 200 (robots-gesperrt, siehe oben) |
| https://vav-lichtenberg.de/aktuelles/bunte-platte/ | 200 |
| https://www.naturschutz-malchow.de/robots.txt | 200 |
| https://www.naturschutz-malchow.de/ | 200 |
| https://www.naturschutz-malchow.de/index.php/info-box/termine | 200 |
| https://www.umweltkalender-berlin.de/robots.txt | 200 |
| https://www.umweltkalender-berlin.de/partner1242/1242,1243/ | 200 |
| https://www.berlin.de/ba-reinickendorf/politik-und-verwaltung/beauftragte/einsamkeit/artikel.1609159.php | 200 |
| https://www.berlin.de/ba-reinickendorf/aktuelles/pressemitteilungen/2026/pressemitteilung.1659812.php | 200 |
| https://www.berlin.de/en/events/4443742-2842498-fete-de-la-musique-highlights.en.html | 200 (Borsigwalde nicht enthalten) |
| https://www.stadtteilzentrum-haus-am-see.de/robots.txt | 200 |
| https://www.stadtteilzentrum-haus-am-see.de/ | 200 |
| https://www.wittenau-sued.de/robots.txt | 404 (zweimal) |
| https://www.wittenau-sued.de/ | 200 |
| https://www.wittenau-sued.de/mitmachen/kalender | 200 |
| https://www.qm-letteplatz.de/robots.txt | 200 |
| https://www.qm-letteplatz.de/ | 200 |
| https://www.qm-letteplatz.de/aktuelles/neues-aus-dem-kiez/bunt-lebendig-und-froehlich-das-lettefest-2026 | 200 |
| https://www.qm-letteplatz.de/aktuelles/veranstaltungen | 200 |
| https://www.qm-letteplatz.de/index.php?option=com_dpcalendar&task=ical.download&id=43 | 500 |
| https://www.qm-auguste-viktoria-allee.de/robots.txt | 200 |
| https://www.qm-auguste-viktoria-allee.de/ | 200 |
| https://www.beratung.immanuel.de/robots.txt (→ https://beratung.immanuel.de/robots.txt) | 301 → 200 (zweimal) |
| https://www.beratung.immanuel.de/unsere-standorte/berlin/borsigwalde (→ https://beratung.immanuel.de/…) | 200 |
| https://immanuelalbertinen.de/robots.txt | 200 |
| https://www.fetedelamusique.de/robots.txt | 200 |
| https://www.fetedelamusique.de/en/partner-district/ | 200 (robots sperrt anthropic-ai, siehe oben) |
| https://www.berliner-zeitung.de/robots.txt | 200 |
| https://www.berliner-woche.de/robots.txt (→ https://www.morgenpost.de/berliner-woche/) | 301 → 200 |
| https://www.morgenpost.de/robots.txt | 200 |
| https://www.berliner-woche.de/muggelheim | 301 (→ morgenpost.de/berliner-woche/, nicht gefolgt) |
| https://hauptstadtkultur.berlin/robots.txt (→ https://www.hauptstadtkultur.berlin/robots.txt) | 200 (dreimal) |
| https://www.hauptstadtkultur.de/robots.txt | keine Verbindung (000) |
| https://www.hauptstadtkultur.berlin/ | 200 |

