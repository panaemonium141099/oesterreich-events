# Anhang zu 04-baden-wuerttemberg.md: alle gestellten Anfragen (27.10.2026)

Rohlisten der fünf Teilrecherchen zu `fn-28-de-gemeindekalender-dorffeste-in-jeder.5`,
inhaltlich unverändert übernommen (nur Überschriften eingerückt). Alle Anfragen lesend
(GET), ohne Konto, Formular, Mail oder Cookie-Zustimmung. Statuscode nach Weiterleitungen,
000 = keine Verbindung. Dazu kommen Websuchen (nur Trefferlisten gelesen).

**Verstoß, offen benannt:** Gruppe B hat `https://exchange.cmcitymedia.de/benningen/calendarV4_0/data/config.js`
im selben Befehl wie die robots.txt dieses Hosts abgerufen; die robots.txt sagt
`User-agent: * Disallow: /`. Danach ging keine Anfrage mehr an diesen Host, Daten- und
Exportpfade wurden nicht abgerufen, der Inhalt von config.js ist in den Bericht nicht
eingeflossen.

**Nicht abgerufen:** nussbaum.de und services.www.nussbaum.de (robots.txt sperrt ClaudeBot),
meinort.de, cmsweb.wittich.de; die toubiz-API (`mein.toubiz.de/api/…`) mit fremden Tokens.

## 1. Hauptsession

| # | URL | Status |
|---|-----|--------|
| 1 | https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/AuszugGV3QAktuell.xlsx?__blob=publicationFile | 200 (1.872.608 Byte) |
| 2 bis 4 | meta.et4.de `search/?experience=open-data&type=Event&template=ET2014A.json&limit=1&q=area:"Baden-Württemberg"` ohne und mit Datumsfenster (Umlaut in der Shell falsch kodiert, Antwort 0) | 200 |
| 5 | dieselbe Abfrage korrekt kodiert, ohne Fenster | 200 (`overallcount` 539) |
| 6, 7 | dieselbe mit `startdate`/`enddate` 28.10.2026 bis 27.10.2027 (Formate `TT.MM.JJJJ` und `JJJJ-MM-TT`) | 200 (je 400) |
| 8 bis 47 | meta.et4.de `q=city:"<Gemeinde>"`, Fenster 28.10.2026 bis 27.10.2027, `limit=20`, für alle 40 Stichprobengemeinden, je 4 s Abstand | 200 |
| 48 bis 50 | Kontrollen `city:"Weil der Stadt"` mit und ohne Fenster, `city:"Pfatter"` mit Fenster | 200 (2, 3, 52) |
| 51 bis 58 | `area:"Baden-Württemberg"` im Fenster, allein und `AND title:<Wort>` für Weihnachtsmarkt, Weinfest, Hocketse, Feuerwehrfest, Dorffest, Kirbe, Narrensprung | 200 |
| 59, 60 | https://www.frickenhausen.de/freizeit-gaeste/veranstaltungskalender (ohne und mit Weiterleitung, Nachprüfung) | 303, 200 |
| 61 | https://api.cross-7.de/public/calendar/3755/events?pageNumber=1&pageSize=5&from=2026-10-28T00:00:00Z&sortType=time&sortDirection=ascending | 200 (`totalCount` 138) |
| 62 | https://www.wiesenbach-online.de/veranstaltungen/2847238/2026/12/05/weihnachtsmarkt.html | 200 |
| 63 | https://www.eschbronn.de/de/Aktuelles/Veranstaltungskalender/Veranstaltung?view=publish&item=eventDate&id=2318 | 200 |

An meta.et4.de gingen damit 57 Anfragen, mehr als die übliche Handvoll je Host, weil je
Stichprobengemeinde gezählt wird; alle mit 4 s Abstand, keine Fehlerantwort. Die
robots.txt der Hosts 59 bis 63 hatten die Teilrecherchen am selben Tag gelesen (Abschnitte 2 bis 5).

## 2. Gruppe A (Gemeinden 1 bis 10)

#### www.krautheim.de (5)
- /robots.txt 200 (Disallow nur Bilder, PDFs, /fileadmin/*, /typo3/, ?type=, tx_solr; keine Crawl-delay)
- / -> /startseite 200
- /freizeit-erlebnis/veranstaltungen/veranstaltungskalender 200 (-> .../seite-1/suche-none)
- /freizeit-erlebnis/veranstaltungen/veranstaltungskalender/294/stadtweihnacht 200
- /rathaus-service/aktuelles/amtsblatt 200

#### www.bad-ditzenbach.de / www.badditzenbach.de (5)
- bad-ditzenbach.de/robots.txt 200 (nur SEO-Bots gesperrt)
- bad-ditzenbach.de/ -> https://www.badditzenbach.de/de/startseite 200
- badditzenbach.de/robots.txt 200 (gleich)
- badditzenbach.de/de/mitteilungsblatt 404 (geratener Pfad)
- badditzenbach.de/de/rathaus/buergerservice/mitteilungsblatt 200

#### www.leibertingen.de (4)
- /robots.txt 200 (Yoast, Disallow leer; WooCommerce-Pfade)
- / 200
- /events-in-leibertingen/ 200
- /amtsblatt/ 200

#### www.kirchardt.de (6)
- /robots.txt 200 (identisch Hirsch&Woelfl-Muster; Zeile "Sitemap: http://www.domain.de/index.php?id=87" = Platzhalter)
- / -> /startseite 200
- /leben-freizeit/veranstaltungskalender 200
- /leben-freizeit/veranstaltungskalender/918/berwanger-advent 200
- /rathaus-service/mitteilungsblatt 200
- /app/google 307 (nur Header gelesen, Location play.google.com/store/apps/details?id=de.hirschwoelfl.kirchardt, nicht gefolgt)

#### www.creglingen.de (3)
- /robots.txt 200 (nur SEO-Bots gesperrt)
- / -> /de/startseite 200
- /de/rathaus-service/aktuelles/mitteilungsblatt 200

#### api.cross-7.de (6)
- /robots.txt 404
- /public/calendar/1860/events?...from=2026-10-27T00:00:00 422 (from braucht Zeitzone: "The value ... is not valid")
- /public/calendar/3755/events?...from=2026-10-27T00:00:00 422
- /public/calendar/1860/events?pageNumber=1&pageSize=20&from=2026-10-27T00:00:00Z&sortType=time&sortDirection=ascending 200 (totalCount 39, totalPages 2)
- /public/calendar/3755/events?... gleiche Parameter 200 (totalCount 138, totalPages 7)
- /public/calendar/3755/events?pageNumber=2&pageSize=60&from=2026-11-05T00:00:00Z... 200 (totalCount 116 ab 05.11.)

#### www.stimpfach.de (4)
- /robots.txt 200 (Hirsch&Woelfl-Muster)
- / -> /startseite 200
- /freizeit-sehenswertes/veranstaltungskalender 200
- /freizeit-sehenswertes/veranstaltungskalender/295/herbstfest 200

#### www.auenwald.de (5)
- /robots.txt 200 (Hirsch&Woelfl-Muster + Disallow /index.php*)
- / -> /startseite 200
- /kultur-freizeit/veranstaltungen/kalender 200
- /kultur-freizeit/veranstaltungen/kalender/55/weihnachtsmarkt/termin-117 200
- /rathaus-service/neuigkeiten/mitteilungsblatt 200

#### www.mutlangen.de (7; Crawl-delay 30 eingehalten, je 31 s Pause; eine Anfrage ueber 6)
- /robots.txt 200 (User-agent *: Disallow /common/, /master/, /zm/, /pirobase, /webadmin; Crawl-delay 30; heritrix Crawl-delay 2)
- / -> /,Lde/1452185.html 200
- /Home/freizeit+_+kultur/termine+_+veranstaltungen.html 200 (enthaelt <link rel=alternate application/rss+xml title='Veranstaltungskalender als RSS' href='/site/Mutlangen-2017/zmrss/14333884/rss.xml'>)
- /site/Mutlangen-2017/zmrss/14333884/rss.xml 200 application/rss+xml (65 KB, 50 Items; /zm/ ist nicht gesperrt, /site/ auch nicht)
- /Home/service+fuer+buerger/amtsblatt.html 200
- /Home/freizeit+_+kultur/dorffest.html 200
- /Home/service+fuer+buerger/mutlangen+app.html 200

#### www.hohentengen.de (6)
- /robots.txt 200 (Contao: /check/, /contao/, /system/, /templates/, /vendor/ ... gesperrt; "gonzo*" nur Impressum)
- /de/ 200
- /de/veranstaltung.html 200 (mod_eventlist, "Aktuell sind keine Termine vorhanden")
- /de/freizeit-und-tourismus/veranstaltungskalender.html 404 (geraten)
- /de/freizeit-und-tourismus/freizeit.html 200 (Menuepunkt "Veranstaltungskalender": statischer Jahreskalender im Akkordeon)
- /de/buergerinfo/rathaus/mitteilungsblatt.html 200

#### St. Peter (Schwarzwald)
Irrtum bei der Domain: www.st-peter.de/robots.txt 200, aber / leitete auf sedo.com (Parkdomain, 1 Anfrage an sedo.com/search/details, nicht ausgewertet). www.sankt-peter.de/robots.txt 200 (Disallow /, fremde Seite, nicht weiter). www.hohentengen-hochrhein.de und www.st-peter-schwarzwald.de (https) nicht erreichbar (Status 000).
Richtige Seite per Websuche: http://www.st-peter-schwarzwald.de (nur http)
- www.st-peter-schwarzwald.de/robots.txt 404; st-peter-schwarzwald.de/robots.txt 404 (keine robots.txt)
- / -> /home.html 200
- /unser-dorf/veranstaltungen.html 200

#### www.hochschwarzwald.de (2)
- /robots.txt 200 (Disallow /neos/, clipboard, cart, config, shoppingcart)
- /veranstaltungen-hochschwarzwald/veranstaltungen-orte/veranstaltungen-in-st-peter 200 (141 KB)

#### www.hirsch-woelfl.de (4)
- /robots.txt 200, / -> /startseite 200, /unsere-werke/referenzen 200, /unsere-werke/nussbaum-medien-schnittstelle 200

#### www.krieger-verlag.de (2)
- /robots.txt 200 (offen), /anzeigen-ort/stimpfach/ 200

Websuchen (nur Trefferlisten): St. Peter Veranstaltungskalender; St. Peter Weihnachtsmarkt; Stimpfach Amtsblatt; Hohentengen Mitteilungsblatt; St. Peter Mitteilungsblatt; St. Peter Patrozinium.

## 3. Gruppe B (Gemeinden 11 bis 20)

* Anfragen www.frickenhausen.de (7): /robots.txt 200; / -> /startseite 200; /gemeinde-wirtschaft/service-impressum/impressum 200;
  /freizeit-gaeste/veranstaltungskalender 200; /freizeit-gaeste/veranstaltungskalender/715/kirbe-tv-tischardt 200;
  /rathaus-service/amtsblatt 200; /freizeit-gaeste/veranstaltungen-neuffener-tal 200.
* Anfragen www.hochdorf.de (4): /robots.txt 200; / -> /startseite 200; /freizeit-angebote/veranstaltungskalender 200;
  /rathaus-service/gemeindeanzeiger/mitteilungsblatt 200. www.hochdorf-fils.de/robots.txt: 000 (Host existiert nicht, geraten, nur 1 Versuch).
  www.aktiv-in.de (5): /robots.txt 200; /veranstaltungskalender 200; /veranstaltungskalender/202611 200; /veranstaltungskalender/202612 200; /impressum 200.
* Anfragen www.eschbronn.de (6): /robots.txt 200 (`User-agent: *` `Disallow:` leer); / -> /willkommen 200;
  /de/Aktuelles/Veranstaltungskalender 200; /de/Aktuelles/Amtsblatt 200;
  /de/Aktuelles/Veranstaltungskalender/Veranstaltung?view=publish&item=eventDate&id=2318 200; /ceasy/ics/veka/eventDate/2318.ics 200 (text/calendar).
* Anfragen www.bahlingen.de (6): /robots.txt 200; / -> /startseite 200; /unsere-gemeinde/impressum-service/impressum 200;
  /freizeit-erlebnis/veranstaltungen 200; /rathaus-service/aktuelles/nachrichtenblatt-sblaettli 200;
  /freizeit-erlebnis/veranstaltungen/386/kleiner-adventsmarkt-des-foerderverein-der-silberbergschule-ev 200.
* Anfragen www.vogtsburg.de (4): /robots.txt 200 (`Allow: /`); / 200; /impressum.html 200; /de-de/freizeit-veranstaltungen/veranstaltungskalender 200 (liefert dieselbe Notbetrieb-Startseite).
  stadt.vogtsburg.de (2): /robots.txt 404; /nb 200 (Weiterleitung auf /nb/nachrichtenblatt.pdf, nicht geladen).
* Anfragen www.volkertshausen.de (4): /robots.txt 404; / -> /startseite 200; /gemeinde-volkertshausen/amtsblatt 200; /freizeit-tourismus/veranstaltungen 200.
* Anfragen www.reichenbach-fils.de (6): /robots.txt 200; / -> /startseite 200; /freizeit-kultur/veranstaltungskalender/in-der-uebersicht 200; .../seite-2/suche-none 200; .../seite-4/suche-none 200;
  .../in-der-uebersicht/709/martinsritt 200.
* Anfragen www.benningen.de (7): /robots.txt 200; / -> /de/startseite 200; /de/leben/sehenswertes/veranstaltungskalender 200; /de/gemeinde/entdecken/kalender 200;
  /de/rathaus/rathaus/mitteilungsblatt 200; /de/leben/sehenswertes/veranstaltungen/weihnachtsmarkt 200; Druckversion /de/gemeinde/entdecken/kalender?publish[calendarViewType]=classic&publish[p]=303&publish[start]=2&type=98&cHash=... 200.
* Anfragen www.ingoldingen.de (5): /robots.txt 200; / -> /startseite 200; /rathaus-service/mitteilungsblatt 200; /freizeit-kultur/veranstaltungen 200; /freizeit-kultur/veranstaltungen/seite-2/suche-none 200.
* Anfragen www.weisweil.de (6): /robots.txt 200; / 200; /veranstaltungskalender2024/ 200; /amtsblatt/ 200; /impressum/ 200; /wp-content/uploads/2026/01/Fertiger-Kalender.pdf 200 (196 KB).
  archiv.weisweil.de (2): /robots.txt 200; / 200.

www.frickenhausen.de 7; www.eschbronn.de 6; www.bahlingen.de 6; www.reichenbach-fils.de 6; www.benningen.de 7; www.weisweil.de 6; www.ingoldingen.de 5;
www.volkertshausen.de 4; www.vogtsburg.de 4; www.hochdorf.de 4 (+1 fehlgeschlagen www.hochdorf-fils.de); www.aktiv-in.de 5; www.naturgarten-kaiserstuhl.de 4;
www.hirsch-woelfl.de 4; stadt.vogtsburg.de 2; archiv.weisweil.de 2; www.burkheim-touristik.de 2; widget.toubiz.de 1; mein.toubiz.de 1; exchange.cmcitymedia.de 2 (robots + config.js, siehe Verstoß).
Websuche: 7 Suchen (Hochdorf, Benningen, Vogtsburg, myeblaettle, Volkertshausen, Bahlingen, Weisweil).
Überschreitung "etwa 6 je Host": Frickenhausen 7, Benningen 7.

## 4. Gruppe C (Gemeinden 21 bis 30)

### Domain-Fehlgriffe (erste Rate, dann per Suche korrigiert)
- blumberg.de (200, Firma "Systempapiere & Etiketten", nicht die Stadt) -> richtig stadt-blumberg.de
- tannheim.de (200, Nachsorgeklinik Tannheim, Villingen-Schwenningen) -> richtig gemeinde-tannheim.de
- au-am-rhein.de, schwenningen-sig.de: DNS/Verbindung fehlgeschlagen (000) -> richtig auamrhein.de, schwenningen.de

### Anfragen je Host (Statuscodes)
#### www.ruppertshofen.de (5)
robots.txt 200 (zweimal; nur Sperre fuer AhrefsBot, MJ12bot, DotBot, SEOkicks, Semrush u.a.; nichts fuer *), / 200 (TYPO3, `data-c7-page="68"`), /tourismus-freizeit/veranstaltungskalender 200, /verwaltung-politik/gemeindeverwaltung/mitteilungsblatt 200
#### api.cross-7.de (6)
/robots.txt 404; /public/calendar/68/events?...&from=2026-10-27T00:00:00 422 ("The value ... is not valid", Zeitzone fehlt); gleiches fuer 1786 422; dann `from=2026-10-27T00:00:00Z`: 68 -> 200 (6.210 Byte), 1786 -> 200 (16.643 Byte); 1786 pageSize=60 -> 200 (46.556 Byte)
#### www.michelfeld.de (4)
robots.txt 200 (zweimal; wie Ruppertshofen nur SEO-Bots), / 200 (`data-c7-page="1786"`, Cross7), /rathaus-service/aktuelles/presse-medien 200
#### www.bergatreute.de (6)
robots.txt 200 (zweimal; Disallow Bilder/PDF/fileadmin/typo3/tx_solr), / 200 -> /de/startseite, /de/rathaus-service/mitteilungsblatt/service 200, /de/freizeit-gestalten/veranstaltungskalender 200 (-> .../seite-1/suche-none), /de/gemeinde-bergatreute/impressum-service/impressum 200
#### www.westerheim.de (8)
robots.txt 200 (zweimal, identisch zu Bergatreute), / 200, Impressum 200, /freizeit-tourismus/veranstaltungen/veranstaltungskalender 200, Detail /805/1111-fasnetseroeffnung 200, /westerheimer-weihnachtsmarkt 200, /rathaus-service/aktuelles/mitteilungsblatt 200
#### www.stadt-blumberg.de (4)
robots.txt 200 (identisch Bergatreute), / 200 -> /startseite, /freizeit-tourismus/veranstaltungen 200, /rathaus-service/amtsblatt/2026 200
#### www.wutachschlucht.de (2)
robots.txt 200 (`Disallow: /neos/`), /veranstaltung/weihnachtsmarkt-blumberg-a1edb76ab2 200
#### www.schwenningen.de (4)
robots.txt 200 (identisch Bergatreute), / 200 -> /startseite, /freizeit/veranstaltungskalender 200, /gemeinde/amtsblatt 200
#### www.gemeinde-tannheim.de (5, Crawl-delay 30 s eingehalten: 31 s Pause vor Folgeabrufen)
robots.txt 200 (`Disallow: /common/ /master/ /zm/ /pirobase /webadmin`, `Crawl-delay: 30`), / 200 (`dvv-Mastertemplates 24.2.5-RELEASE`), /Startseite/leben+_+wohnen/termine+_+veranstaltungen.html 200, /site/Tannheim/zmrss/12967382/rss.xml 200, /Startseite/rathaus+_+verwaltung/mitteilungsblatt.html 200
#### www.sontheim-brenz.de (8)
robots.txt 200 (zweimal, `Disallow:` leer, Sitemap /ceasy/modules/cms/sitemap.php), / 200 (cEasy 5.3.5 by hitcom), /de/Aktuelles/Veranstaltungen 200, Detail ...Veranstaltung?view=publish&item=eventDate&id=1292 200, /ceasy/ics/veka/eventDate/1292.ics 307 (zweimal), Ziel /ceasy/serve/usage/main.php?view=iCalendar&item=eventDate&id=1292 200 text/calendar
#### www.auamrhein.de (6)
robots.txt 200 (nur wp-admin, gravityexport gesperrt), / 200, /freizeit-kultur/veranstaltungen/ 200, /blog/category/events/feste-konzerte/ 200, /wp-json/wp/v2/event?per_page=2 404 (rest_no_route), /blog/event/fasenachtseroeffnung-tv/ 200
#### www.bollschweil.de (7)
robots.txt 404 (zweimal geprueft; cEasy-404-Seite), / 200 -> /willkommen, /mitteilungsblatt 200, /veranstaltungen 200, ...?limit=80&offset=0 200 (limit wird ignoriert, 5 Eintraege), Filterversuch mit falschem Parameternamen 200 (ohne Wirkung)
#### Fehlgriffe: blumberg.de (3 Abrufe), tannheim.de (3), au-am-rhein.de (1), schwenningen-sig.de (1)

Hinweis: Westerheim 8, Sontheim 8, Bollschweil 7 liegen ueber der Richtgroesse 6 (je Abruf Statuscheck + Inhalt von robots.txt, Redirect-Folgen bei ICS).

## 5. Gruppe D (Gemeinden 31 bis 40)

### robots.txt-Befunde
* wittighausen.de und wiesenbach-online.de: identische Liste (verwaltungsportal.de-Standard). Gruppe mit GPTBot, Bytespider, meta-externalagent u. a.: Disallow /. Gruppe "Baiduspider, Yandex, Slurp, Bingbot, ClaudeBot": nur Crawl-delay 10 (eingehalten, sleep 10 zwischen Abrufen). Keine Regel fuer *.
* waldenbuch.de: * Disallow /common/, /master/, /zm/, /webadmin, /pirobase, Crawl-delay 30 (eingehalten, sleep 30). /site/.../zmrss/ nicht gesperrt.
* ebenweiler.de: * sperrt /calendar/action~*, /veranstaltungen/action~*, ai1ec_exporter_controller (Reste von All-in-One-Event-Calendar). /veranstaltungen/ selbst und /wp-json frei.
* empfingen.de: * sperrt Bilder/PDF-Endungen, /fileadmin/Dateien/, /typo3/, ?tx_solr usw. Listen und Detailseiten frei.
* lauterbach-schwarzwald.de, hessigheim.de: * Disallow leer (alles frei).
* elchesheim-illingen.de: nur benannte Bots gesperrt (Ahrefs, Bytespider, CCBot, Diffbot, Semrush u. a.), * frei.
* st-maergen.de: * Disallow /data/, /private/.
* hochschwarzwald.de und schwarzwald-tourismus.info: * Disallow /neos/, clipboard, cart, config, shoppingcart; Ahrefs gesperrt. (Neos CMS)
* stadt.bad-liebenzell.de: Disallow /wp-admin/. tourismus-bad-liebenzell.de: Disallow /wp-admin/ (admin-ajax erlaubt). www.bad-liebenzell.de: robots 404.
* gvv-altshausen.de: Disallow /cloud, /*searchTerm=. webcontact.de: alles frei. wittighausen.app: Disallow /passwort-vergessen.

### Anfragen (URL, Status)
#### wittighausen.de (5)
* /robots.txt 200; / 200; /veranstaltungen/index.php 200 (89 kB); /veranstaltungen/2945881/2026/11/08/kerwe-mit-hammeltanz-in-vilchband.html 200; /amtsblatt/index.php 200
#### wittighausen.app (2): /robots.txt 200; / 200 (React-SPA "Wittighausen App", Beschreibung "Eine App zur Kommunikation fuer alle Bewohner in Wittighausen", Login)
#### lauterbach-schwarzwald.de (6, +1 Weiterleitung)
* /robots.txt 200; / 200 (-> /willkommen); /veranstaltungen 200; Detail ...Veranstaltung?view=publish&item=eventDate&id=3187 200; /ceasy/ics/veka/eventDate/3187.ics 200; /aktuelles 200
#### ebenweiler.de (6)
* /robots.txt 200; / 200; /veranstaltungen/ 200; /veranstaltungen/feed/ 200 (nur Kommentar-Feed, leer, lastBuildDate 2018); /wp-json/wp/v2/ajde_events?per_page=5 200; /events/zweitakttreffen/ 200
#### gvv-altshausen.de (2): /robots.txt 200; /de/bekanntmachungen/ 200 (Weblication CMS; Verlag dort nicht genannt)
#### bad-liebenzell.de (2): /robots.txt 404; / 200 (Weiche mit zwei Buttons: Tourismus -> tourismus-bad-liebenzell.de, Stadtverwaltung -> stadt.bad-liebenzell.de)
#### stadt.bad-liebenzell.de (4): /robots.txt 200; / 200; /wp-json/tribe/events/v1/events?per_page=50 200 (total 1: "Nachtbaustelle: Sanierungsarbeiten am Bahnuebergang", kein Kalender); /stadtbote/ 200
#### www.tourismus-bad-liebenzell.de (3): /robots.txt 200; / 200; /events/ 200
#### www.schwarzwald-tourismus.info (2): /robots.txt 200; /veranstaltungen/weihnachtsmarkt-bad-liebenzell-77097d7956 200
#### st-maergen.de (5): /robots.txt 200; / 200 (Weiche); /index.php 200; /de/amtsblatt/ 200; /de/impressum/ 200
#### hochschwarzwald.de (2): /robots.txt 200; /veranstaltungen-hochschwarzwald/veranstaltungen-orte/veranstaltungen-in-st-maergen 200
#### elchesheim-illingen.de (7, ueber Richtwert 6): /robots.txt 200; / 200; /termin 200; /termin/Gemeinderatssitzung-event-appointment3481 200; /events/export/ical/3481 200; /satzung/Redaktionsstatut-...-statute1660 200 (Text ohne "Duerrschnabel" im HTML); /termin/Dorffest-event-appointment3966 200
#### empfingen.de (6): /robots.txt 200; / 200 (-> /startseite); /freizeit-kultur/veranstaltungen 200; /rathaus-service/aktuelles/mitteilungsblatt 200; /freizeit-kultur/veranstaltungen/2410/halloween-party 200; /freizeit-kultur/veranstaltungen/seite-3/suche-none 200
#### hessigheim.de (4): /robots.txt 200; / 200; /veranstaltungen/ 200; /impressum/ 200
#### waldenbuch.de (6, Crawl-delay 30): /robots.txt 200; / 200 (-> /start); /start/waldenbuch+entdecken/veranstaltungskalender.html 200 (ohne Termine); /start/waldenbuch+entdecken/veranstaltungen.html 200 (20 vevent); /site/Waldenbuch-Internet/zmrss/13702713/rss.xml 200; /site/Waldenbuch-Internet/node/13702713/zmkat_Feste/index.html 200
#### wiesenbach-online.de (5, Crawl-delay 10): /robots.txt 200; / 200; /veranstaltungen/ 200; /veranstaltungen/2847238/2026/12/05/weihnachtsmarkt.html 200; /amtsblatt/index.php 200
#### webcontact.de (3): /robots.txt 200; /cms-fuer-kommunen/ 200; /referenzen/ 200
#### Fehlversuche (kein Host erreichbar, DNS/Verbindung 000): www.wiesenbach.de, www.wiesenbach-neckar.de, www.gemeinde-wiesenbach.de (je 1 robots-Versuch). Gemeinde Wiesenbach ist wiesenbach-online.de (Suchtreffer, danach bestaetigt).

Websuchen: 10 (Wiesenbach Domain, Elchesheim Gemeindeanzeiger, Elchesheim Feste, Ebenweiler Verbandsanzeiger, Ebenweiler Feste, Verbandsanzeiger Restle, Bad Liebenzell Stadtbote, Bad Liebenzell Weihnachtsmarkt, St. Maergen Feste x2, Waldenbuch Amtsblatt, Waldenbuch Feste, Lauterbach Blaettle, Empfingen Feste, Vibus, webcontact).

## 6. toubiz/TMBW und Komm.ONE

| Zeit | URL | Status |
|---|---|---|
| 19:14 | https://www.schwarzwald-tourismus.info/robots.txt | 200 (Disallow nur /neos/, clipboard, cart, config) |
| 19:14 | https://www.tourismus-bw.de/robots.txt | 307 → https://www.visit-bw.com/de |
| 19:14 | https://www.tourismus-bw.de/robots.txt (-L, landet auf visit-bw.com/de) | 200 (Startseite) |
| 19:14 | https://www.schwaebischealb.de/robots.txt | 200 |
| 19:14 | https://www.visit-bw.com/robots.txt | 200 (Allow: /) |
| 19:14 | https://www.schwarzwald-tourismus.info/partnernet/digitalisierung/mein-toubiz-datenbank-1/open-data | 200 |
| 19:14 | https://www.schwarzwald-tourismus.info/_Resources/Persistent/ceb1b5ec381d562a8f5139d836844e163e5ecfd7/mein.toubiz%20Lizenzen.pdf | 200 (1,3 MB) |
| 19:14 | https://www.schwarzwald-tourismus.info/_Resources/Persistent/e032f96ed0bc397a4548afa9d1ba2e1246aa581d/STG%20mein.toubiz%20Forum_Mai%202025.pdf | 200 (2,9 MB) |
| 19:15 | https://www.toubiz.de/robots.txt | 000 (keine Verbindung) |
| 19:15 | https://api.toubiz.de/robots.txt | 404 (Host existiert) |
| 19:18 | https://mein.toubiz.de/robots.txt | 200 (`Disallow: /storage/`) |
| 19:18 | https://toubiz.de/robots.txt | 000 |
| 19:18 | https://www.guetenbach.de/robots.txt | 200 (nur SEO-Bots gesperrt) |
| 19:18 | https://www.guetenbach.de/ (→ /de/startseite) | 200 |
| 19:19 | https://widget.toubiz.de/robots.txt | 404 |
| 19:19 | https://widget.toubiz.de/js/stable/widget.js | 200 (118 B Lader) |
| 19:19 | https://widget.toubiz.de/js/stable/widget.module.js | 200 (619 KB) |
| 19:20 | https://www.visit-bw.com/de/veranstaltungen | 200 |
| 19:21 | https://www.schwarzwald-tourismus.info/_Resources/Persistent/b4a6ec7d3c23026a5317dfe2c9b9f88ca7ad8c39/27Sep24%20I%20Forum%20mein.toubiz.schwarzwald%20%28002%29.pdf | 200 |
| 19:21 | https://www.schwarzwald-tourismus.info/partnernet/digitalisierung/mein-toubiz-datenbank-1/datendrehscheibe/daten-drehscheibe | 200 |
| 19:21 | https://www.schwaebischealb.de/content/download/38317/518899/version/1/file/Protokoll+mein.toubiz-Sprechstunde_21.04.2023.pdf | 404 |
| 19:22 | https://www.guetenbach.de/de/rathaus-service/veranstaltungen/veranstaltungskalender | 200 |
| 19:22 | https://www.guetenbach.de/fileadmin/Dateien/Dateien/toubiz-Erhebungsbogen-Veranstaltungen.pdf | 200 |
| 19:23 | https://www.visit-bw.com/sitemap.xml | 200 (1.569 URLs, keine Event-Detailseiten) |
| 19:23 | https://www.guetenbach.de/de/rathaus-service/veranstaltungen/veranstaltung-veroeffentlichen | 200 |
| 19:24 | https://www.komm.one/robots.txt | 200 (`Crawl-delay: 30`, Disallow /zm/ u. a.) |
| 19:24 | https://www.online-suite.de/robots.txt | 200 (`Crawl-delay: 30`) |
| 19:24:52 | https://www.online-suite.de/cms | 200 |
| 19:25:52 | https://www.online-suite.de/leistungen/apps | 200 |
| 19:26:06 | https://www.schwarzwald-tourismus.info/_Resources/Persistent/2fe7c7be563a6d79742567f5f0128687344cff0a/TMBW_mein.toubiz%20Forum%20Mai%202026.pdf | 200 (7. Abruf auf dem Host, eine Anfrage über dem Richtwert) |
| 19:26:28 | https://www.online-suite.de/referenzen/referenzen-nach-kundensegmenten | 000 (Abbruch) |
| 19:27:25 | https://www.online-suite.de/referenzen/referenzen-nach-kundensegmenten | 200 |
| 19:27:29 | https://www.komm.one/site/Biederbach/zmrss/825233/rss.xml | 404 (pirobase-Fehlerseite) |
| 19:28 | https://www.zweitaelerland.de/robots.txt | 200 (WordPress, Yoast) |
| 19:28 | https://www.zweitaelerland.de/zweitaelerland/event/search?reset=1 | 200 |
| 19:29 | https://www.zweitaelerland.de/zweitaelerland/event/search?doSearch=1&searchtext_event=Weihnachtsmarkt&event_date_from=27.10.2026&event_date_to=31.12.2026 | 200 (keine Treffer im HTML) |
| 19:30 | https://www.zweitaelerland.de/default/ng/js/tp-taurus.min.js | 200 |

GitHub (über `gh`, nur lesen): `gh search code "api.toubiz.de"` (0 Treffer), `gh search code toubiz`,
`gh search repos toubiz`; Inhalte: TimUx/OpenEventHub `plugins/toubiz/index.js`,
`plugins/utils/toubiz.js`, `architecture/reviews/v0.18.0-html-toubiz-ems.md`;
bobbynus/tut.dus `tools/events/toubiz.py`; WPS/radvis `ToubizRepositoryImpl.java`,
`ToubizConfigurationProperties.java`; WPS/radvis-manual `docs/datenschnittstellen.md`.

WebSearch: toubiz API/Open Data, TMBW Lizenz/Knowledge Graph, api.toubiz.de, toubiz-widget,
Open Data Pool BW, daten.bw Tourismus, Komm.ONE Online-Suite/Veranstaltungskalender/Bürger-App/
Kundenzahl/Geschäftsbericht, dvv-Zusatzmodule/zmrss, Dorffest auf Tourismusseiten.

Anfragen je Host: schwarzwald-tourismus.info 7, guetenbach.de 5, online-suite.de 5,
zweitaelerland.de 4, visit-bw.com 4 (inkl. Weiterleitung), widget.toubiz.de 3,
tourismus-bw.de 2, schwaebischealb.de 2, komm.one 2, mein.toubiz.de 1, api.toubiz.de 1,
www.toubiz.de 1, toubiz.de 1. Nicht abgerufen: nussbaum.de, meinort.de, cmsweb.wittich.de, meta.et4.de.
