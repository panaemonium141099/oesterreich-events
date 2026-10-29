# Hamburg: Anfragen zu 15-hamburg.md (Stand 2026-10-29)

Alle Abrufe für [15-hamburg.md](15-hamburg.md), nur GET, keine Konten, keine Formulare,
keine Mails. Teil 1 sind die Abrufe der Hauptsitzung, Teil 2 die der drei Bearbeiter
der Stichprobe (Stadtteile 1 bis 10, 11 bis 20, 21 bis 30), übernommen aus ihren
Arbeitsnotizen; dort stehen auch die Belege je Stadtteil.

## Teil 1: Hauptsitzung

### Abweichung von den Regeln

* `https://suche.transparenz.hamburg.de/api/3/action/package_search?q=Stadtteile&rows=10`
  wurde im selben Befehl wie robots.txt abgerufen, bevor die Sperre `Disallow: /api/`
  gelesen war (Antwort 200, `count` 26401). Danach nur noch erlaubte HTML-Seiten.

### Je Host

| Host | Abrufe | Pfade und Ergebnis |
|---|---|---|
| suche.transparenz.hamburg.de | 9 | robots.txt (`Disallow: /api/`, `Crawl-delay: 10`); API-Abruf oben; `/dataset/regionalstatistische-daten-der-stadtteile-hamburgs23`; `/dataset?q=` mit „Straßenfest“, „Stadtteilfest“, „Veranstaltungskalender“, „Veranstaltungsdatenbank“, `"Sondermitteln" Stadtteilfest`; `/dataset/bezirk-wandsbek-drucksache-22-3469` |
| geodienste.hamburg.de | 2 | robots.txt (nur `spatineo` gesperrt); `/download?url=https://geodienste.hamburg.de/wfs_regionalstatistische_daten_stadtteile&f=csv` (ZIP, 12,5 MB) |
| www.hamburg.de | 12 | robots.txt (2 ×); `/veranstaltungen/` (leitet auf `/kultur/veranstaltungen`, 2 ×); `/freizeit/strassenfeste`; `/kultur/veranstaltungen/veranstaltungen-eintragen-403732`; `/politik-und-verwaltung/bezirke/bergedorf`; `/leben-in-hamburg/bezirke-hamburg/stadtteile-bezirk-bergedorf`; `/politik-und-verwaltung/bezirke/bergedorf/themen/freizeit-kultur`; `/leben-in-hamburg/bezirke-hamburg/stadtteile-bezirk-bergedorf/kirchwerder-371572`; `/freizeit/jahreszeiten/herbst/laternenumzug-hamburg-22840` |
| www.hamburg-tourism.de | 7 | robots.txt; `/business-medien/hamburg-tourismus-gmbh/ueber-die-hamburg-tourismus-gmbh/marketing/marktmanagement/`; `/sehen-erleben/veranstaltungen/veranstaltungskalender/` (ohne und mit `filter[searchword]=Kirchwerder`); `…/offene-kirche-106/` (404); `…/flohmarkt-60/`; `…/erntedankfest-in-kirchenwerder/` (404) |
| hamburgwhl.infomaxnet.de | 4 | robots.txt (`Crawl-delay: 5`, `/data/` gesperrt); `/veranstaltungen/?widget`; `/standard_widget_de/?widgetToken=22vcqFKw4GE.&form=search&searchType=search&dateFrom=2026-10-29&dateTo=2027-10-28` (4.998) und dasselbe mit `query=Kirchwerder` (63) |
| www.mrh.events, www.hamburg.events | 11 | robots.txt (beide); `/`; `/veranstaltungsausgabe.html`; `/veranstaltungsausgabe/datenexport.html`; `/veranstaltungsausgabe/technische-informationen.html`; `/veranstaltungsausgabe/kalendermodul.html`; `/veranstaltungsausgabe/datenlieferanten.html`; `/datennutzer/kateg.html`; `/projekt/the-event-database.html` (Weiterleitung auf `/vadb.html`) |
| www.veranstaltungen.hamburg | 47 | robots.txt (`Crawl-delay: 5`); `/` (Weiterleitung auf die Liste mit `locationId=1`, 9.038 gefunden); Details `alster-kanalfahrt-dampfschiff-st-georg`, `laternenumzug-der-ff-niendorf`, `stadtfest-st-georg-2027`, `osterstrassenfest-in-hamburg-eimsbuettel-2027`; `list?search=Feuerwehr` ohne Ort (45); 40 Suchen mit Ort Hamburg (Tabellen unten), Abstand 6 s |
| meta.et4.de | 32 | `q=area:"Hamburg"` (5); `q=city:"Hamburg"` mit Fenster (4); 30 × `q=city:"<Stadtteil>"` mit Fenster 2026-10-29 bis 2027-10-28 (Tabelle unten) |
| www.feuerwehr-hamburg.de | 21 | robots.txt; `/`; `/veranstaltung/` (3 ×); `/veranstaltung/page/2/` bis `/page/5/`; `/wp-json/wp/v2/types`; `/veranstaltung/feed/`; `/veranstaltung/54-feuerwehrfest-in-suelldorf/`; `/veranstaltungskategorie/erntedank-fest-umzug/`, `/stadtteil-strassenfest/`, `/weihnachtsveranstaltung/`; `/sitemap_index.xml` (2 ×); `/veranstaltung-sitemap.xml`, `/veranstaltung-sitemap2.xml` (1.423 URLs) |
| www.stadtkultur-hamburg.de, www.stadtkultur-hh.de | 4 | robots.txt (Weiterleitung); robots.txt; `/`; `/sitemap.xml` |
| www.kirche-hamburg.de | 1 | robots.txt (`Disallow: /*?`) |
| Lokalmedien | 8 | www.hamburger-wochenblatt.de `/` (301 auf abendblatt.de/marktplatz/hamburgerwochenblatt) und robots.txt; www.elbe-wochenblatt.de (keine Verbindung, 2 ×); www.bergedorfer-zeitung.de `/` (301 auf abendblatt.de/bergedorf/) und robots.txt; www.abendblatt.de robots.txt (sperrt Claude-Bots für `/*/article*.html`); www.termine-regional.de `/` (307) |
| hh-hamm.de, bergstedt.hamburg, www.kulturkreis-finkenwerder.de | 3 | je `/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-10-29` zur Nachprüfung (13, 3, 10) |
| de.wikipedia.org | 1 | `/w/index.php?title=Hamburg-Billstedt&action=raw` (Öjendorf als Ortsteil) |

### Suche im Gesamtkalender, Ort Hamburg, je Stichprobenstadtteil

`https://www.veranstaltungen.hamburg/VADB_gesamtkalender/events/list?locationId=1&locationName=Hamburg&locationType=Location&search=<Name>`.
Zahl = „… Veranstaltungen gefunden“ (Volltext, enthält Fremdtreffer), danach die ersten
Slugs.

| Stadtteil | gefunden | erste Treffer (Slug) |
|---|---|---|
| Sülldorf | 6 | gottesdienst-1780-5-2, gottesdienst-am-2-advent-zusammensonntag, gottesdienst-am-3-advent-16-2, gottesdienst-am-volkstrauertag-mit-anschliessender-kranzniederle |
| Marmstorf | 2 | adventskonzert-17, funky-christmas-let-it-swing |
| Uhlenhorst | 82 | adventskonzert-des-seemanns-chors-hamburg-1, ai-vs-humans-eine-veranstaltung-von-kampf-der-kuenste, annette-dittert-dear-britain, bachkantaten-gottesdienst-1, b |
| Heimfeld | 67 | 1-weihnachtstag-15, 16-grosse-blues-boogie-night, advents-fruehstuecksgottesdienst-fuer-familien, alexander-stevens-jacqueline-belle-true-crime-187-live-toedlic |
| Marienthal | 13 | das-sams-eine-woche-voller-samstage-3, das-urmel-aus-dem-eis-1, der-kleine-drache-kokosnuss-13, der-kleine-koenig-feiert-weihnachten, der-kleine-koenig-feiert-w |
| Lurup | 14 | ballett-werkstatt-27, big-naimi-y-su-timbarap-live-concert, bundesjugendballett-4, ein-sommernachtstraum-2, flohdom-trabrennbahn, junge-choreografinnen-11, nati |
| Lemsahl-Mellingstedt | 4 | informationsabend-fuer-die-konfirmationen-2028, musical-dinner-das-original-mamma-mia-5, musical-dinner-das-original-santa-maria-29, norddeutsche-hifi-tage-2027 |
| Schnelsen | 21 | 8-to-the-bar, abendandacht-zum-buss-und-bettag, abi-wallenstein-guenther-brackmann-2, abi-zukunft-hamburg-2027, bitte-vormerken-abendmusik-in-der-adventskirche- |
| Kirchwerder | 23 | blutspenden-hilft-helfen-auch-sie-1, cruise-days-blue-port-mit-ital-buffet, cruise-days-mit-gala-buffetfeuerwerk, die-biene-maja-theater99-2, die-biene-maja-the |
| Eppendorf | 492 | 27-kunsthandwerkermarkt-niendorfer-buergerhaus, abendgottesdienst-mit-friedensgebet-65, abi-wallenstein-guenther-brackmann-2, achtsamkeit-und-breathwork-um-stre |
| Billstedt | 34 | 46-kunstkulturtage-muemmelmannsberg, a-secre-revealed-praise-the-plague, altona-93-vs-sc-vorwaertswacker-billstedt, billstedt-classics-8, billstedt-classics-win |
| Harvestehude | 121 | adventskonzert-4-1, aerztekanzel-2026-tusche-tanz-theater-die-kuenste-in-der-medizin-1, aerztekanzel-2026-tusche-tanz-theater-die-kuenste-in-der-medizin-2, ann- |
| Ochsenwerder | 12 | 2-sonntag-nach-dem-christfest-6, 4-advent-11, christfest-1-weihnachtstag-1, ewigkeitssonntag-letzter-sonntag-im-kirchenjahr-4, heiligabend-christvesper-18, heim |
| St. Georg | 584 | 30-minuten-orgelmusik-145, abendmahlfeier-4, adobe-lightroom-classic-partielle-bearbeitung-mit-masken-und-filtern-7, afrobeats-afrodance-20, akkordeon-orchester |
| Bergedorf | 289 | 13lohbruegger-suppenfest, 22-sonntag-nach-trinitatis-22-2, 30-jahre-emmi-willnowsky-2, 4-lola-herbstmarkt, 64-bergedorfer-schlosskonzert-mit-birgit-bahr-flute-a |
| Hohenfelde | 4 | female-dinner-storyteller-in-hamburg, praeventionskurs-pilates-29-211026, sacred-nights-einstimmung-auf-die-rauhnaechte-1, sammlung-des-museums-der-arbeit |
| Bergstedt | 0 | informationsabend-fuer-die-konfirmationen-2028 |
| Hoheluft-West | 287 | abendgottesdienst-225-2, abendmahlsgottesdienst-160, abendmahlsgottesdienst-fuer-kleine-und-grosse-am-2-advent-1, aerztekanzel-2026-tusche-tanz-theater-die-kuen |
| Horn | 80 | adventskonzert-im-kerzenschein-2, allueberall-advent, blockfloetenkonzert-mit-flauto-vivo, buchclub-horn-4, christmette-mit-harfenklaengen-4, danish-chamber-orc |
| Finkenwerder | 72 | f18-flugsimulator-kampfjet, finkwarder-speeldeel-4, hafenrundfahrt-um-2-elbinseln-buffet, hamburg-zeigt-kunst-das-kreative-festival-9, kulturflut-winterwelle-3, |
| Hamm | 99 | active-attractive-8, adventskonzert-im-kerzenschein-2, aelter-besser-kapelledrei-2, aktualisierungsschulung-fuer-betreuungskraefte-gemaess-43b-53b-sgb-xi-in-vol |
| Borgfelde | 46 | abendmahlfeier, abendmahlfeier-1, abendmahlfeier-2, abendmahlfeier-4, annabell-whitney-firework-1, aranan-adam, brush-crew-friedenskirche-eilbek-26, christmette |
| Eilbek | 45 | abendmahlsgottesdienst-161, adventsmarkt-38, breathwork-holotropes-atmen-14, brush-crew-friedenskirche-eilbek-26, bunkertour-im-zombeck-turm, christi-himmelfahr |
| Farmsen-Berne | 149 | 20-sonntag-nach-trinitatis-30, 4-lola-herbstmarkt, adventskonzert-16, adventsmarkt-im-bergedorfer-schloss, adventsmarkt-im-marktplatz-der-manufakturen-4, aktzei |
| Iserbrook | 14 | 1-advent-gottesdienst-mit-der-kita-iserbrook, adventsliedersingen-3, altjahrsabend-8-1, ewigkeitssonntag-mit-der-kantorei-3, gottesdienst-1780-5-2, gottesdienst |
| Neuallermöhe | 3 | frauenkleidertausch-1, kindertheater-die-prinzessin-auf-der-erbse-1, kindertheater-gute-nacht-kleine-raupe |
| Neugraben-Fischbek | 17 | community-wanderung-2, die-zimtschnecken-1, die-zimtschnecken-swingelingeling-1, etv-vs-allianz-mtv-stuttgart-5-heimspiel, etv-vs-binder-blaubaeren-flacht-7-hei |
| Wandsbek | 468 | 12-hamburg-blues-nights-einzelticket-freitag, 12-hamburg-blues-nights-einzelticket-samstag, 12-hamburg-blues-nights-kombi-ticket-beide-abende, 2-vorstellung-der |
| Neuengamme | 12 | couragiert-und-widerstaendig-zeugen-jehovas-im-kz-neuengamme, die-biene-maja-theater99-1, die-biene-maja-theater99-5, evangelische-messe-486, hommage-an-hendrik |
| Wilstorf | 33 | architekturfuehrung-durch-die-sammlung-falckenberg, art-x-humor-und-horror, culture-counterculture-werke-aus-der-sammlung-falckenberg, das-kriminal-dinner-das-t |

### Festarten im Gesamtkalender, Ort Hamburg

| Suchwort | gefunden | Treffer (Slug) |
|---|---|---|
| Stadtteilfest | 3 | osterstrassenfest-in-hamburg-eimsbuettel-2027, stadtfest-st-georg-2027, stadtfuehrung-hamburgs-insider-tour |
| Straßenfest | 3 | fruehlingserwachen-6, osterstrassenfest-in-hamburg-eimsbuettel-2027, stadtfest-st-georg-2027 |
| Erntefest | 0 | bauer-haders-neujahrsempfang-2 |
| Erntedank | 0 |  |
| Weihnachtsmarkt | 334 | 4-christgrindelmarkt, advendssonderfahrt-zum-weihnachtsmarkt-nach-hannover-und-hameln, adventsbasar-mit-weihnachtsgeschichten-von-camill-jammal-thalia-theater, adventskonzert-13, adventskonzert-4-1, a |
| Dorffest | 0 | faiz-mangat-live-leo |
| Feuerwehrfest | 0 |  |
| Sommerfest | 0 |  |

„0“ heißt: keine Trefferzahl auf der Seite; die dann angezeigten Slugs sind Vorschläge, keine Treffer.

### destination.one je Stichprobenstadtteil

`https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=50&q=city:"<Name>"&startdate=2026-10-29&enddate=2027-10-28`.

| Stadtteil | overallcount | davon Hamburg |
|---|---|---|
| Sülldorf | 0 | 0 |
| Marmstorf | 0 | 0 |
| Uhlenhorst | 0 | 0 |
| Heimfeld | 0 | 0 |
| Marienthal | 0 | 0 |
| Lurup | 0 | 0 |
| Lemsahl-Mellingstedt | 0 | 0 |
| Schnelsen | 0 | 0 |
| Kirchwerder | 0 | 0 |
| Eppendorf | 0 | 0 |
| Billstedt | 0 | 0 |
| Harvestehude | 0 | 0 |
| Ochsenwerder | 0 | 0 |
| St. Georg | 0 | 0 |
| Bergedorf | 0 | 0 |
| Hohenfelde | 0 | 0 |
| Bergstedt | 0 | 0 |
| Hoheluft-West | 0 | 0 |
| Horn | 43 | 0 |
| Finkenwerder | 0 | 0 |
| Hamm | 7 | 0 |
| Borgfelde | 0 | 0 |
| Eilbek | 0 | 0 |
| Farmsen-Berne | 0 | 0 |
| Iserbrook | 0 | 0 |
| Neuallermöhe | 0 | 0 |
| Neugraben-Fischbek | 0 | 0 |
| Wandsbek | 0 | 0 |
| Neuengamme | 0 | 0 |
| Wilstorf | 0 | 0 |

## Teil 2: Bearbeiter der Stichprobe

### Stadtteile 1 bis 10

robots.txt zuerst jeweils für: bv-suelldorf-iserbrook.de, hubv.de, heimfeld.de, ff-suelldorf-iserbrook.de, unser-lurup.de, ff-lurup.de, heimatbund-lm.de, herzvonschnelsen.de, schnelsen-sued.de, www.ff-schnelsen.de, fflemsahl-mellingstedt.de, www.erntedankfest-kirchwerder.de, www.vierlande.de, vierlanden.de, www.feuerwehr.hamburg, www.feuerwehr-hamburg.de, ff-wdbma.de, ff-eppendorf.de, eppendorfer-landstrasse.de, uhlenhorst.de, der-eppendorfer.de, ebv1875.de, www.bergmanngruppe.de, www.hamburg.de, www.der-marmstorfer-schuetzenverein.de, lurup.info, suelldorf.de, schnelsen.de, www.festivalsindeutschland.de (keine Sperre für allgemeine User-Agents gefunden; Sonderfall ff-marmstorf.de: robots.txt lieferte 503, siehe Marmstorf).

Sülldorf
- https://www.bv-suelldorf-iserbrook.de/
- https://www.bv-suelldorf-iserbrook.de/veranstaltungen/
- https://www.bv-suelldorf-iserbrook.de/veranstaltungen/aktuelle-veranstaltung/
- https://www.bv-suelldorf-iserbrook.de/veranstaltungen/regelmäßige-veranstaltungen/ (404)
- https://www.ff-suelldorf-iserbrook.de/
- https://www.ff-suelldorf-iserbrook.de/termine
- https://www.ff-suelldorf-iserbrook.de/wp-json/wp/v2/posts?per_page=2&_fields=id,date,slug,title,link
- https://suelldorf.de/
- https://iserbrook.de/ (nur Titel/Generator gelesen)

Marmstorf
- https://www.der-marmstorfer-schuetzenverein.de/alle-termine-im-ueberblick/
- https://www.der-marmstorfer-schuetzenverein.de/laternenumzug/
- https://www.der-marmstorfer-schuetzenverein.de/wp-content/uploads/2025/01/SVM-Termine-2025@group.calendar.google.com_.ics
- https://ff-marmstorf.de/ und https://www.ff-marmstorf.de/ (503, robots 503)

Uhlenhorst
- https://www.hubv.de/
- https://www.hubv.de/Mitgliederbereich
- https://uhlenhorst.de/ (steht zum Verkauf)
- https://bergmanngruppe.de/ und https://bergmanngruppe.de/events/uhlenfest/ (die geratenen Pfade /events/eppendorfer-landstrassenfest/ und /events/eppendorfer-landstrassenfest-2/ lieferten 404)
- https://www.hamburg.de/freizeit/strassenfeste/uhlenhorster-stadtteilfest-336002 (Datum nicht auswertbar)

Heimfeld
- https://heimfeld.de/
- https://heimfeld.de/2026/kletterturm-beim-stadtteilfest/
- https://heimfeld.de/feed/
- https://www.festivalsindeutschland.de/festival/stadtteilfest-heimfeld-hamburg (Aggregator)

Marienthal
- https://ff-wdbma.de/
- https://ff-wdbma.de/feed/

Lurup
- https://unser-lurup.de/
- https://unser-lurup.de/feed/
- https://ff-lurup.de/
- https://ff-lurup.de/foerderverein/
- https://ff-lurup.de/neuigkeiten/
- https://lurup.info/ (Titel/Generator)
- https://lichtwark-forum.de/ (Weiterleitung auf unser-lurup.de)

Lemsahl-Mellingstedt
- https://heimatbund-lm.de/
- https://heimatbund-lm.de/aktuelles/
- https://heimatbund-lm.de/feed/
- https://ff-lemsahl-mellingstedt.de/ (meta refresh)
- https://www.fflemsahl-mellingstedt.de/
- https://www.fflemsahl-mellingstedt.de/aktuelles-und-termine/
- https://www.fflemsahl-mellingstedt.de/feed/ (HTML, kein RSS)

Schnelsen
- https://herzvonschnelsen.de/
- https://herzvonschnelsen.de/termine/
- https://schnelsen-sued.de/
- https://schnelsen-sued.de/veranstaltungen/
- https://schnelsen-sued.de/events/feed/
- https://schnelsen-sued.de/aktuelles/
- https://www.ff-schnelsen.de/
- https://www.ff-schnelsen.de/blog-feed.xml
- https://www.ff-schnelsen.de/post/laternenumzug-2026
- https://schnelsen.de/ (steht zum Verkauf)

Kirchwerder
- https://www.erntedankfest-kirchwerder.de/
- https://www.vierlande.de/ (Firma, nicht einschlägig)
- https://vierlanden.de/
- https://vierlanden.de/pages/3-veranstaltungen
- https://vierlanden.de/pages/17-vor-ort

Eppendorf
- https://der-eppendorfer.de/
- https://der-eppendorfer.de/Veranstaltungen/ (404)
- https://der-eppendorfer.de/NEU-Veranstaltungen/Feiern/Eppendorfer-Landstrassenfest-2026/
- https://der-eppendorfer.de/NEU-Veranstaltungen/Feiern/Nikolausgluehen-25/
- https://ff-eppendorf.de/
- https://eppendorfer-landstrasse.de/

Zentrale Feuerwehr-Hamburg
- https://www.feuerwehr.hamburg/service-sitemap-feuerwehr-sitemap_index.xml und sitemap1.xml.gz
- https://www.feuerwehr.hamburg/freiwillige-feuerwehr-hamburg-877466
- https://www.feuerwehr-hamburg.de/
- https://www.feuerwehr-hamburg.de/veranstaltung/
- https://www.feuerwehr-hamburg.de/veranstaltung/feed/
- https://www.feuerwehr-hamburg.de/veranstaltung/laternenumzug-der-ff-kirchwerder-nord/

Nur per Websuche gesehen (nicht selbst abgerufen): festivalsindeutschland.de (Lurup feiert, Landstraßenfest, Vogelschießen, Straßenparty Schnelsen), hamburg-travel.com/hamburg-tourism.de (Lurup feiert 2026, Eppendorfer Landstraßenfest und Achtel), hamburg.de Laternenumzug-Liste, harburg-aktuell.de, epub.sub.uni-hamburg.de (Vereinszeitungen).

### Stadtteile 11 bis 20

robots.txt (je 1 GET): bergstedt.hamburg, www.buergerverein-billstedt.de (404), www.bergedorf.de (404, nicht weiter genutzt), www.kulturkreis-finkenwerder.de, www.finkenwerder.de (kein Ergebnis), www.hamburg.de, www.feuerwehr.hamburg, www.feuerwehr-hamburg.de, www.ff-bergstedt.de, www.ff-finkenwerder.de, www.feuerwehr-billstedt-horn.de, www.ff-bergedorf.de, www.ff-hohendeich.de (HTTP 401), www.feuerwehr-poeseldorf.de, www.hubv.de, buergerverein-stgeorg.de, stadtfest-stgeorg.de, www.hoheluft-west.de, hohenfelde.de, www.stgeorg.de, www.festivalsindeutschland.de, www.hornerfreiheit.de, www.billevue.de (TYPO3-404-Seite), billstedt-horn.hamburg.de, billstedt-horn.de, www.wsb-bergedorf.de, www.mein-bergedorf.de, www.hamburg-tourism.de, stjohannis.hamburg, der-eppendorfer.de, ebv1875.de, www.kirche-marschlande.de, harvestehude.de (Verkaufsseite), ochsenwerder.de (404).

Seiten:
- https://bergstedt.hamburg/ ; https://bergstedt.hamburg/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-10-29 ; https://bergstedt.hamburg/veranstaltungen/?ical=1 ; https://bergstedt.hamburg/vereine-institutionen/ ; https://bergstedt.hamburg/bunte-meile-bergstedt-2026/
- https://www.ff-bergstedt.de/ ; https://www.ff-bergstedt.de/aktuelles-berichte/laternenumzug-2025/ ; https://www.ff-bergstedt.de/feed/
- https://www.kulturkreis-finkenwerder.de/ ; .../wp-json/tribe/events/v1/events (3 Abrufe mit verschiedenen Datumsfiltern)
- https://www.ff-finkenwerder.de/ ; https://www.ff-finkenwerder.de/menschen/eine-insel-zwei-feuerwehren/
- https://ochsenwerder.de/ ; /terminkal.html ; /veranstaltungen-ow.html ; /vereine.html
- https://www.kirche-marschlande.de/unsere-kirchen/kirche-ochsenwerder
- https://www.feuerwehr.hamburg/ ; https://www.feuerwehr.hamburg/freiwillige-feuerwehr-hamburg-877466
- https://www.feuerwehr-hamburg.de/media_category/veranstaltungen/ ; /dienststellen/hohendeich/ ; /dienststellen/billstedt-horn/ ; /dienststellen/bergedorf/ ; /dienststellen/poeseldorf/ ; /dienststellen/berliner-tor/
- https://www.feuerwehr-billstedt-horn.de/ ; https://ff-bergedorf.de/ ; https://www.feuerwehr-poeseldorf.de/
- https://www.hubv.de/ ; https://www.hubv.de/Hohenfelde-Uhlenhorst
- https://buergerverein-stgeorg.de/ ; https://buergerverein-stgeorg.de/laternenumzug/ ; https://stadtfest-stgeorg.de/
- https://www.hoheluft-west.de/ ; https://www.hamburg.de/leben-in-hamburg/bezirke-hamburg/stadtteile-bezirk-eimsbuettel/hoheluft-west-372408 ; https://www.hamburg.de/freizeit/jahreszeiten/herbst/laternenumzug-hamburg-22840
- https://billstedt-horn.de/ ; https://billstedt-horn.hamburg.de/ ; https://billstedt-horn.hamburg.de/termine ; https://www.billevue.de/ ; https://www.buergerverein-billstedt.de/ ; https://www.buergerverein-billstedt.de/veranstaltungen.html
- https://www.hornerfreiheit.de/ ; /veranstaltungen ; /default-title/horner-stadtteilfest
- https://www.wsb-bergedorf.de/ ; https://www.wsb-bergedorf.de/aktuelles/wsb-veranstaltungen ; https://mein-bergedorf.de/ ; https://mein-bergedorf.de/veranstaltungen/ ; https://mein-bergedorf.de/wp-json/wp/v2/types
- https://stjohannis.hamburg/ ; https://stjohannis.hamburg/termine/
- https://www.festivalsindeutschland.de/festival/stadtteilfest-horn-hamburg ; .../billevue-stadtteilfestival-hamburg ; .../bunte-meile-bergstedt-hamburg ; .../bergedorfer-weihnachtsmarkt-hamburg
- https://www.hamburg-tourism.de/sehen-erleben/veranstaltungen/veranstaltungskalender/bergedorfer-weihnachtsmarkt-2/ (HTTP 404)

#### Abweichungen von den Regeln (ehrlich)

- Mehr als etwa 5 GETs je Host bei www.feuerwehr-hamburg.de (6 Seiten plus robots) und kulturkreis-finkenwerder.de (Startseite plus 3 REST-Abrufe plus robots), bei bergstedt.hamburg (6 plus robots). Alle ohne Fehler.
- Bei einigen Hosts (hornerfreiheit.de, billevue.de, billstedt-horn.hamburg.de, billstedt-horn.de, buergerverein-billstedt.de, stadtteilverein-horn.de, kulturpalast-hamburg.de, www.stgeorg.de, www.hohenfelde.de u. a.) kam beim Erraten der Domain zuerst ein einzelner GET auf die Startseite bzw. robots.txt, bevor ich robots.txt gelesen hatte. Danach wurde robots.txt geprüft und beachtet; keine dieser Seiten sperrt. stadtteilverein-horn.de leitete dabei auf elbe-hh.de um (ein Abruf dort, Inhalt nicht genutzt).
- www.ff-hohendeich.de ist mit HTTP 401 geschützt und wurde nicht weiter abgerufen. hoheluft-west.de und harvestehude.de sind keine Quellen (geparkt bzw. Verkaufsseite).
- WebSearch-Ergebnisse (Zusammenfassungen) sind als "Suchtreffer" markiert, wo ich sie nicht selbst per GET bestätigt habe.

### Stadtteile 21 bis 30

robots.txt: hh-hamm.de, www.buergerhaus-allermoehe.de, bv-suelldorf-iserbrook.de, www.bv-suelldorf-iserbrook.de, buergerverein-wandsbek.de (404), ff-neuengamme.de, ff-farmsen.de, ff-neugraben.de, neuallermoehe.de, ff-fischbek.de (404), www.ff-berne.de (404), www.ff-suelldorf-iserbrook.de, ff-wdbma.de, wandsbek.de, www.hamburg.de, feuerwehr.hamburg.de (301), www.feuerwehr.hamburg, serviceportal.kirche-hamburg.de, www.hamburg-tourism.de, www.neuerruf.de (HTML statt Regeln), harburg-aktuell.de, harburg-marketing.de.

Seiten:
- https://hh-hamm.de/
- https://hh-hamm.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-10-29
- https://hh-hamm.de/sommerfestival/
- https://hh-hamm.de/sommerfestival2025/
- https://www.buergerhaus-allermoehe.de/
- https://www.buergerhaus-allermoehe.de/veranstaltungen/
- https://neuallermoehe.de/
- https://neuallermoehe.de/2026/06/18/fleetplatzfest-2026/
- https://neuallermoehe.de/2025/02/12/nachbarschaftsfest/
- https://ff-farmsen.de/
- https://ff-farmsen.de/farmsen-erstrahlt-im-lichterglanz-ueber-2-500-besucher-beim-laternenumzug/
- https://ff-farmsen.de/wp-json/tribe/events/v1/events (404)
- https://www.ff-berne.de/
- https://www.ff-berne.de/category/neuigkeiten/veranstaltung/
- https://feuerwehr-berne.de/ (anderer Ort, ng-app FeuerwehrBerne, nicht Hamburg-relevant)
- https://www.ff-suelldorf-iserbrook.de/
- https://www.ff-suelldorf-iserbrook.de/service/termine-termine-3
- https://www.ff-suelldorf-iserbrook.de/feuerwehrfest-2025
- https://www.bv-suelldorf-iserbrook.de/
- https://www.bv-suelldorf-iserbrook.de/veranstaltungen/aktuelle-veranstaltung/
- https://ff-neugraben.de/
- https://ff-neugraben.de/2026/10/13/130409/
- https://ff-neugraben.de/wp-json/wp/v2/posts?per_page=3&_fields=date,link,title
- https://ff-fischbek.de/
- https://ff-fischbek.de/scripts/app.js
- https://ff-fischbek.de/termine.json
- https://neugraben-fischbek.de/ (Parkdomain)
- https://www.neuerruf.de/
- https://ff-neuengamme.de/
- https://ff-neuengamme.de/index.php?format=feed&type=rss
- https://buergerverein-wandsbek.de/
- https://buergerverein-wandsbek.de/aktuelles.htm
- https://buergerverein-wandsbek.de/vereinsaktivitaeten.htm
- https://buergerverein-wandsbek.de/wi/wia.shtml
- https://wandsbek.de/
- https://wandsbek.de/aktuelles/wandsbeker-winterzauber-2026/
- https://wandsbek.de/aktuelles/wandsbeker-oktoberfest/
- https://wandsbek.de/aktuelles/like-ice-and-sunshine/
- https://wandsbek.de/aktuelles/ (301)
- https://ff-wdbma.de/
- https://www.hamburg.de/freizeit/jahreszeiten/herbst/laternenumzug-hamburg-22840
- https://www.hamburg.de/freizeit/strassenfeste
- https://www.hamburg.de/branchenbuch/hamburg/firmen/a-z/f/3/
- https://www.feuerwehr.hamburg/ und https://www.feuerwehr.hamburg/freiwillige-feuerwehr-hamburg-877466 und https://www.feuerwehr.hamburg/unsere-dienstgebaeude (nur Berufsfeuerwehr-Wachen, keine FF-Liste)
- https://serviceportal.kirche-hamburg.de/gemeinden/ev-luth-kirchengemeinde-st-georg-borgfelde/veranstaltungen.html
- https://serviceportal.kirche-hamburg.de/gemeinden/ev-luth-kirchengemeinde-eilbek-friedenskirche-osterkirche/veranstaltungen.html
- https://www.kirche-hamburg.de/gemeinden/ansicht/3780-paul-gerhardt-kirche-wilstorf
- https://www.hamburg-tourism.de/sehen-erleben/veranstaltungen/veranstaltungskalender/wandsbeker-stadtteilfest/ (404)
- https://www.hamburg-tourism.de/.../wandsbeker-stadtteilfest-1/ (404)
- https://www.hamburg-tourism.de/.../hammer-sommerfestival/ (404)
- https://www.hamburg-tourism.de/.../neugraben-erleben/ (404)
- https://harburg-aktuell.de/ und https://harburg-aktuell.de/?s=Wilstorf&feed=rss2
- https://harburg-marketing.de/
- https://borgfelde.de/ (Hausverwaltung), https://wilstorf.de/ (Parkdomain)

Nur Startseiten-Probes ohne Treffer (Verbindung fehlgeschlagen, je 1 GET): eilbeker-buergerverein.de, ebv-hamburg.de, buergerverein-eilbek.de, buergerverein-borgfelde.de, buergerverein-wilstorf.de, buergerverein-farmsen-berne.de, farmsen-berne.de, neuengamme.de, buergerverein-neuengamme.de, ff-allermoehe.de, ff-wilstorf.de, ff-wandsbek.de, ff-neuallermoehe.de und weitere Namensraten. ff-billwerder.de leitet auf eine Poker-Seite (Fremddomain, ignoriert).

