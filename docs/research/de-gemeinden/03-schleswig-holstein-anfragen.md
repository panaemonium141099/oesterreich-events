# Anfragen zu 03-schleswig-holstein.md (27.10.2026)

Nur lesende GET-Anfragen (curl, WebFetch, `gh api`), keine Formulare, keine Konten,
keine Mails. Zahl = Abrufe je Host einschließlich robots.txt. Die Stichprobe lief in vier
Gruppen; ihre Rohnotizen mit Statuscodes je URL liegen in den Sitzungsnotizen
(fn28-4-sh-westkueste, -suedost, -mitte, -nord-segeberg).

## Hauptsitzung

| Host | Abrufe | Status | Zweck |
|---|---|---|---|
| www.destatis.de | 1 | 200 | GV-Auszug 30.09.2026 (xlsx) |
| meta.et4.de | 48 | robots 404, sonst 200 | 2 Landeszählungen, 30 Gemeinden `city:`, 14 Festarten `area AND title`, 1 Gegenprobe Neukirchen mit `limit=100` |
| www.sh-veranstaltungskalender.de / www.sh-tourismus.de | 3 | 404 (robots nach Weiterleitung), 200, robots 200 | Landeskalender, imx-Widget |
| tash.whitelabel.imxplatform.de | 3 | 200, 200, 404 | robots, `widget/widget.js`, `/de/veranstaltungen` |
| opendata.schleswig-holstein.de | 5 | 200 | robots; 3 × `/api/3/action/package_search` (gesperrter Pfad, siehe Regelabweichungen); 1 × Download `events.json.gz` |
| www.presseportal.de, cache.pressmailing.net | 3 | 200, 301, 200 | TA.SH-Pressemitteilungen 05.01.2023 und 05.09.2022 |
| www.advantic.de | 2 | 200 | robots, Referenzkarte |
| www.festivalsindeutschland.de | 3 | 200 | robots, `sitemap.xml`, `sitemaps/sitemap-default.xml` |
| schleswig-holstein.de | 1 | 200 | Seite „80 Jahre SH“ (WebFetch) |
| veranstaltungen.80-jahre-sh.de | 7 | 200, nodeinfo 403 | robots, Startseite, 2 JS-Bundles, nodeinfo, 2 × GraphQL per GET |
| der-smarte-gemeinschaftskalender.de | 1 | 200 | Projektseite (WebFetch) |
| tavias.de | 15 | 200, ein Bundle 404, nodeinfo 403 | robots, Startseite, 2 Bundles, nodeinfo, 10 × GraphQL per GET (davon 7 Seiten à 100 Termine) |
| mobilizon.tavias.de | 1 | 200 | robots |
| api.github.com (`gh api`) | 8 | 200 | Repo, README, publiccode.yml, Routen des Backends |
| www.termine-regional.de | 9 | 200, ein 404 | robots, Startseite, Impressum, Kunden, Veranstaltungsliste, GET mit Ortsparameter (404), sitemap.xml, eine Detailseite, ein iCal |
| www.communice.de | 2 | 301 | robots, Impressum (Weiterleitung auf inixmedia) |
| www.inixmedia.de | 4 | 200, Impressum-Pfad unter communice-web 404 | robots, communice-web, Impressum, Referenzen |
| Websuche | 8 | | TA.SH, Ringreiten (2), Amtsblätter, Kulturportal, communice, Landesdatenbank-Lizenz |

## Gruppe Westküste (Dithmarschen, Nordfriesland)

www.amt-eider.de 8, amt-eider.de 1, tellingstedt.de 5, www.tellingstedt.de 1,
www.stadt-meldorf.de 6, www.mitteldithmarschen.de 3, amt-mitteldithmarschen.de 2,
www.nordsee-mitteldithmarschen.de 1, www.amt-buesum-wesselburen.de 5,
amt-buesum-wesselburen.de 1, www.norddeich-sh.de 3, www.echt-dithmarschen.de 2,
regionalportal.dithmarschen.de 3, www.amt-vioel.de 4, www.amt-suedtondern.de 3,
www.rodenaes.de 3, bohmstedt.de 3, www.bohmstedt.de 1, www.amnf.de 4,
nordsee-nordfriesland.de 2, www.nordseetourismus.de 2, www.nordfrieslandkalender.de 3;
5 DNS-Fehlversuche; 9 Websuchen.

## Gruppe Südost (Herzogtum Lauenburg, Ostholstein, Stormarn)

amt-hohe-elbgeest.de 7, lensahn.de 6, gross-groenau.de 7, amt-oldenburg-land.de 4,
amt-schwarzenbek-land.de 4, bargteheide-land.de 4, bargfeld-stegen.de 4, datt-blatt.de 4,
ffn-ostsee.de 3, gemeinde-rethwisch.de 3, amt-bad-oldesloe-land.de 3,
amt-lauenburgische-seen.de 2, ics.datt-blatt.de 2, hamburg-tourism.de 2,
museumshof-lensahn.de 2; 7 robots-Vorabtests; 5 Fehlversuche ohne Antwort; rund 14
Websuchen.

## Gruppe Mitte (Pinneberg, Plön, Rendsburg-Eckernförde)

www.amt-mittelholstein.de 9, www.postfeld.de 6, www.bredenbek.de 5, www.boksee.de 5,
www.amt-pinnau.de 5, www.amtpreetzland.de 4, www.barmstedt-und-umland.de 4,
wirsindnoer.de 4, www.vg-barmstedt-hoernerkirchen.de 4, www.hohenwestedt.de 3,
www.amt-daenischenhagen.de 5 (robots für curl 403, nicht umgangen), kalender.digital 4,
gemeinde-kummerfeld.de 3, www.kummerfeld.de 2, www.gemeinde-noer.de 2,
www.amt-achterwehr.de 2, thaden.amt-mittelholstein.de 2, termine.kreis-ploen.de 2,
feuerwehr-bredenbek.de 2, www.amt-hoernerkirchen.de 1; rund 9 Websuchen.

## Gruppe Nord und Segeberg (Schleswig-Flensburg, Segeberg, Steinburg)

amt-suedangeln.de 7, kropp.de 8, amt-kropp-stapelholm.de 2, alt-bennebek.de 1,
auenland-suedholstein.de 4, lentfoehrden.de 4, schmalfeld.net 5 (dazu 2
Verbindungsfehler), struxdorf.de 6, rickling.de 3, amt-boostedt-rickling.de 6,
gemeinde-rickling.de 2, grosskummerfeld.de 2, amt-trave-land.de 8, traventhal.de 1,
amt-kellinghusen.de 4, rosdorf.de 3, hamburg-tourism.de 4, gruenes-binnenland.de 3,
tash.whitelabel.imxplatform.de 2, ostseefjordschlei.de 2, de.wikipedia.org 1,
en.wikipedia.org 1, total-lokal.de 1 (404). Ein PDF ausgewertet (Südangeln Rundschau
Nr. 5).

## Bewusst nicht abgerufen

`/output/`-Pfade der iKISS-Ämter (robots.txt), imx-GraphQL mit Widget-Token,
meinort.de, cmsweb.wittich.de, nussbaum.de, `lentfoehrden-cms2.de`, `redirect.phtml`
bei Amt Pinnau, JSON-Weg `?data-api=calendar` bei echt-dithmarschen.de und
ostseefjordschlei.de (robots.txt), POST-Suche auf termine-regional.de.
