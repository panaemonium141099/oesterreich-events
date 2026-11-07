# Rest-Adapter fn-29: die 549 Gemeinden ohne Adapter (Stand 2026-11-07)

Abnahme fn-29 ([abnahme-fn29.md](abnahme-fn29.md)) nannte 549 Gemeinden ohne Adapter
und ohne Lizenzhürde. Je Plattform wurde an zwei bis drei Kalendern belegt, wie die
Termine ausgeliefert werden (nur lesende Abrufe, robots.txt beachtet, keine
Lizenzschlüssel fremder Seiten). Zahlen der Gemeinden aus
`data/de-gemeinde-registry.json` (eigene Seite plus Ausweichweg über Amt/VG).

| Plattform | Gemeinden | Auslieferung | Adapter | Prüfstand |
|---|---:|---|---|---|
| Deskline | 115 + 23 | DW5-Widget, Linkkey aus `tagcontext.js`, WebAPI-JSON | `de-deskline` | bestanden, [adapter-deskline.md](adapter-deskline.md) |
| destination.one | 119 + 14 | Experience der Seite, `meta.et4.de` JSON | `de-destinationone` | bestanden, [adapter-destinationone.md](adapter-destinationone.md) |
| GeoCMS | 63 + 3 | HTML-Liste (20 je Seite, `gcevent[pager]`), Detailseite | `de-geocms` | siehe [adapter-geocms.md](adapter-geocms.md) |
| regiogate (recon CMS) | 38 | HTML-Karten `card--event`, Detailseite | `de-regiogate` | bestanden, [adapter-regiogate.md](adapter-regiogate.md) |
| ILE/lkrg | 17 | sqronline-JSON je Modul-UUID | `de-lkrg` | bestanden, [adapter-lkrg.md](adapter-lkrg.md) |
| contentXXL | 24 + 9 | kein eigener Kalender: infomax-Widget (`hamburgwhl.infomaxnet.de/action/widget`, 11 Gemeinden), et4-Experience (`erlebnis-elbe`, `niedersachsen-contenthub`, 4), Detailansicht ohne Termine (Soltau, Bevensen-Ebstorf: 0 Datumsangaben im HTML) | keiner | |
| Sitepark | 29 | je Website anders: Brühl `SP-TeaserList` mit `SP-Scheduling` und Pagination, Braunschweig verlinkt auf `braunschweig.die-region.de`, andere Startseiten ohne Kalender | keiner | |
| StadtLandNews | 23 + 7 | 10 Gemeinden hinter `vggebhardshain.de` (von hier nicht erreichbar, HTTP 000); übrige sind WordPress `lsvr-events` (Mertesdorf, Maring-Noviand), Joomla `nobosscalendar` (Weisenheim), Google-Kalender (Wittenborn) | keiner | |
| EventON | 13 + 1 | WordPress-Plugin, Liste per `wp-json/eventon/v1/data?evo-ajax=…` nachgeladen, Listenseite ohne Termine im HTML (Ürzig) | keiner | |
| Crossiety | 7 | `crossiety.app/dorfplatz/<Ort>/agenda`: Karten `xs-card-v2` mit `startDate`/`endDate`, meist Beiträge („Rot Kreuz Lädele erweitert seine Öffnungszeiten"), kein Ort | keiner | |
| sonstige eingebettete | 41 + 3 | iframes verschiedener Dienste: kalender.digital 8, freizeitkalender.eu 6, veranstaltungen-lech-wertach.de 5, kalender.verwaltungsgemeinschaft-oettingen.de 5, infomaxnet 4, wintopevents 3, styledcalendar 2, dahoam-in-niederbayern 2 | keiner | |

Belege: Scan aller Registry-Seiten dieser Plattformen am 07.11.2026 (Status, iframes,
externe Scripts, Generator, JSON-LD, iCal-Links), Einzelabrufe der genannten Seiten.

## Nicht gebaut, Grund

* **contentXXL** ist nur das CMS; die Termine kommen aus Widgets anderer Anbieter
  (infomax für die Lüneburger Heide, et4). infomax (`imxplatform`) liefert die Termine
  per JavaScript, ohne belegten Endpunkt; et4-Seiten darunter liest `de-destinationone`
  nur, wenn die Gemeinde als `destinationone` in der Registry steht.
* **Sitepark** hat keine gemeinsame Vorlage; Brühl (`SP-TeaserList`) wäre ein eigener
  Parser für eine Gemeinde.
* **StadtLandNews**: der Server `vggebhardshain.de` (10 Gemeinden) antwortet von dieser
  Maschine nicht; die übrigen 13 Seiten sind drei verschiedene Plugins.
* **EventON** lädt die Termine per Ajax nach; der Endpunkt braucht die Parameter des
  Shortcodes.
* **Crossiety** ist ein Dorfplatz-Netzwerk: Karten sind Beiträge mit Zeitraum, ohne Ort.
* **Sonstige eingebettete**: je Dienst ein eigener Adapter für zwei bis acht Gemeinden.

## GeoCMS und Sitepark von dieser Maschine

Die Seiten antworteten am 07.11.2026 von hier (Köthen 200 in 1,6 s, Brühl 200,
Braunschweig 200; Kirchheimbolanden 302 auf die Startseite). Der Workflow „Registry DE
Feeds bestätigen" (Lauf 42401356254, `--only geocms,sitepark`) lief grün, nennt aber
keine Erreichbarkeit je Seite (der Feed-Lauf kennt für diese Plattformen keine Feeds).
