# Anhang zu 01-vollerhebung.md: Anfragen, Regelabweichungen, Rohbefunde (27. und 28.10.2026)

## A. Anfragen der Vollerhebung

Alle Anfragen lesend (GET), User-Agent `Mozilla/5.0 (compatible; lasstreffen-research/1.0; einmaliger Startseitenabruf)`, Zeitlimit 15 bis 20 s, keine Konten, Formulare oder Mails. robots.txt wurde vor jedem Seitenabruf gelesen und beachtet. Gespeichert wurden nur Merkmale, kein HTML.

| Schritt | Anfragen | Ergebnis |
|---|---|---|
| Destatis Gemeindeverzeichnis-Auszug (`AuszugGV3QAktuell.xlsx`) | 1 | 200 |
| Wikidata SPARQL (`P439`/`P1388` mit `P856`) | 1 | 200, 23.958 Zeilen |
| Heimat-Info `communes/search` | 1 | 200, 648 Einträge |
| Durchgang 1: je Host robots.txt + Startseite | 8.749 Hosts, je 2 | 8.167 × 200, 107 robots-gesperrt (Startseite nicht abgerufen), Rest Fehler oder 4xx/5xx |
| Durchgang 2: je Host robots.txt + eine Veranstaltungsseite | 8.167 Hosts, je bis 2 | 6.904 × 200, 1.160 ohne Kalenderlink (keine Anfrage), 13 robots-gesperrt |
| Durchgang 3: Restgruppen | 2.827 Hosts, je bis 5 | Leere Seiten erneut (1.483), Standardpfade (896), URL-Varianten (448) |
| Kontrollabrufe ionas (3 Startseiten erneut) | 3 | 200 |

Parallelität 40 Verbindungen über alle Hosts, je Host höchstens 5 Anfragen über alle Durchgänge, Crawl-delay einzelner Hosts wurde dabei nicht gesondert abgewartet (je Host nur 2 bis 5 Anfragen insgesamt).

## B. Regelabweichungen der Teilrecherchen

* Hersteller-Recherche: `config.js` auf exchange.cmcitymedia.de trotz `Disallow: /` einmal abgerufen; Crawl-delay 15 bei stadt-nebra.de, stadt-oebisfelde-weferlingen.de, brain-scc.de und huerth.de nicht eingehalten; digipublica.de antwortet mit Cloudflare-Abfrage, nicht umgangen.
* Recherche eingebettete Kalender: bei 6 Gemeindeseiten robots.txt erst nach dem Abruf gelesen; 5 Seiten im Browser geladen, um die Netzwerkaufrufe der Widgets zu sehen.

## C. Rohbefunde Hersteller (ionas, Hirsch & Wölfl, cEasy, Weblication, Open2C, GeoCMS, DigiPublica, contentXXL, Sitepark, cmcitymedia)

Stand: 27./28.10.2026. Nur lesende GET-Anfragen mit `curl -m 20 -A "Mozilla/5.0 (compatible; lasstreffen-research/1.0)"`, robots.txt je Host vorher, höchstens 8 Anfragen je Host (Maximum erreicht: 4). Kein Login, kein Formular, kein POST. Gemeindezahlen „gemessen in Vollerhebung“ stammen aus `fn28-census-vendor-examples.json`. Alle Feldnamen unten stammen aus selbst abgerufenen Antworten (Anfragenliste am Ende). „nicht belegt“ heißt: in dieser Runde nicht gefunden oder nicht geprüft.

Regelabweichungen, offen benannt:
* exchange.cmcitymedia.de: robots.txt (`User-agent: *` / `Disallow: /`) und config.js wurden im selben Befehl abgerufen, die config.js also trotz Sperre (1 Anfrage, 28.10. 17:32:14). Danach keine weitere Anfrage an exchange/publish1.
* Crawl-delay 15 nicht eingehalten bei: stadt-nebra.de (robots 17:24:16, Liste 17:24:19), stadt-oebisfelde-weferlingen.de (17:26:02 / 17:26:05), brain-scc.de (17:27:16 / 17:27:17), huerth.de (17:35:06 / 17:35:07 und 17:35:40 / 17:35:52). Alle übrigen Folgeanfragen an diese Hosts lagen über 15 s auseinander.
* chamaeleon.de: robots.txt antwortet 404 mit einer HTML-Seite, die `<meta name="robots" content="noai, noindex, nofollow, noarchive, …">` trägt (gilt der Fehlerseite, nicht als robots.txt-Regel). Dieselbe Meta-Zeile tragen die 404-Seiten aller ionas-Gemeinden; die echten Kalenderseiten (amt-sn.de, grosshansdorf.de) haben keine robots-Meta.

### Übersicht

| Hersteller | gemessen | Zugriffsweg (Pfadmuster) | Feed für die ganze Liste? | Ein Parser? |
|---|---|---|---|---|
| ionas (Chamaeleon) | 864 | TVM-Modul: `<data-source der tvm-Seite>/events.json?weekends=false&tagMode=ALL` und `…/event.ics?…` | ja (JSON + iCal), Pfad je Seite verschieden, aus `data-source` zu lesen | hoch für TVM-Seiten, Anteil TVM unbekannt |
| hwext (hwveranstaltung) | 421 | HTML-Liste `<Seite>/seite-N/suche-none`, Detail `<Seite>/<id>/<slug>[/termin-<tid>]`; iCal nur je Termin (Action `icalExport` mit cHash) | nein | hoch (HTML, einheitliche Klassen) |
| cEasy (hitcom) | 167 | HTML-Liste (Klassen `cVeka_*`), Paging `?item=eventDate&view=find&doPage=1&limit=15&offset=N`; iCal je Termin `/ceasy/ics/veka/eventDate/<id>.ics` | nein | hoch für echte cEasy-Seiten; Erhebung zählt auch Nicht-cEasy-Seiten |
| Weblication | 99 | HTML-Liste (`listEntry*`), Paging `?pageId<hash>=N`; iCal je Termin `/de-wGlobal/wGlobal/scripts/php/createICal.php?path=<Detailpfad>` | nein | mittel bis hoch |
| Open2C (Kinetiqa) | 57 | HTML-Liste `.o<id>.html?page=N`, Detail `&detailevent=<id>`; iCal `https://<VG-Host>/export/export_ical.php?idlist=<id>,<id>` | per ID-Liste ja, aber robots sperrt `/export` z. B. bei Pörnbach | mittel |
| GeoCMS (brain-SCC) | 63 | HTML-Liste `gcevent-*` (ältere Vorlage) oder `btp_event`-Karten (neuere), Detail `/de/veranstaltung-detail/event/<id>,<site>/<slug>.html` | nicht belegt | mittel (zwei Vorlagen) |
| DigiPublica (Neos) | 61 | Inline-JSON im Seitenquelltext (FullCalendar `events: […]`) bzw. POST `/dataobjects/search` | Inline-JSON ja (nur wo Kalendermodul), sonst nein | mittel; Gemeinden nutzen teils RCE-Iframe/PDF |
| contentXXL | 24 | kein CMS-eigener Kalender gefunden; Seiten betten imx-Whitelabel-Widget (`widget-id`) bzw. infomax-Widget der Metropolregion Hamburg ein | über Tourismusplattform, nicht über CMS | niedrig (CMS), Quelle ist imx/MRH |
| Sitepark (IES) | 29 | HTML-Liste (`SP-Teaser*`), Paging `sp:page[eventSearch-1.form][0]=N`; iCal je Termin `<Detail>?sp:out=iCal` | nein (`?sp:out=iCal` auf der Liste liefert leeren Kalender) | hoch |
| cmcitymedia ohne Cross7 | 38 | Klassik-Ansicht auf Gemeindehost `?publish[calendarViewType]=classic&publish[p]=<id>&publish[start]=N`; JSON/iCal nur auf exchange.cmcitymedia.de (robots: alles gesperrt) | technisch ja, per robots gesperrt | hoch für HTML-Klassikansicht |


### 1. ionas (Chamaeleon)

**1. Betreiber und Zahl**
* Chamaeleon Gesellschaft für innovative Netzlösungen mbH, Robert-Bosch-Straße 12, 56410 Montabaur, HRB 31432 AG Montabaur (https://www.chamaeleon.de/impressum/). Startseite: „Erstklassiges CMS ionas“ (Meta-Description https://www.chamaeleon.de/).
* Eigenangabe: „Weit über 500 kommunale Kunden nutzen unsere Lösungen zur Digitalisierung von Verwaltungsprozessen“ (https://www.chamaeleon.de/oeffentliche-verwaltung/). Bezieht sich auf Lösungen allgemein, nicht nur auf ionas-Websites.
* Gemessen in Vollerhebung: 864 Gemeinden (Erkennung `ionasInfo`).

**2. Zugriffsweg**
* Kalendermodul „TVM“ (`advanced-tvm`, Klassen `tvm-picker*`). Die Kalenderseite trägt im HTML `data-source="https://<host>/<kalenderpfad>/events.json?weekends=false&tagMode=ALL"` und den Link „Termine exportieren“ `https://<host>/<kalenderpfad>/event.ics?weekends=false&tagMode=ALL` (Klasse `tvm-picker__export-link`).
* Der Kalenderpfad ist NICHT gleich: amt-sn.de `/kalender/`, hachenburg-vg.de `/kalender/kombinierte-terminquelle/` (frühere Notiz fn28-2: vgnastaetten.de `/kalender/deskline-und-eigene/`, rengsdorf-waldbreitbach.de `/kalender/deskline-veranstaltungen/`). Ein Parser muss also die Veranstaltungsseite laden und `data-source` lesen; danach ist das Format identisch.
* Geprüft an zwei Gemeinden: amt-sn.de (245 Termine, 27.10.2025 bis 25.12.2026) und hachenburg-vg.de (177 Termine, 04.01.2026 bis 23.10.2027). Beide 200, `application/json` bzw. `text/calendar`.
* Nicht jede ionas-Gemeinde nutzt TVM: grosshansdorf.de `/aktuelles/veranstaltungen/veranstaltungskalender/` enthält nur einen leeren `component-sourceCode`-Block (kein data-source, keine Termine im HTML). lengerich-emsland.de bettet destination.one ein (`src="https://pages.destination.one/de/lengerich-emsland/default/search/Event?i_target=et4pages"`). Anteil TVM an den 864: nicht belegt.
* Der JSON-Abruf ohne Datumsparameter liefert auch rund 12 Monate Vergangenheit (amt-sn: ab 27.10.2025); Filter auf Zukunft im Parser nötig.

**3. Echte Feldnamen**
* events.json (amt-sn.de): `id` (z. B. `"169036:0"`, Suffix = Wiederholung; Hachenburg Deskline-Termine als UUID), `start`, `end` (lokal ohne Offset, `2025-10-27T19:30`), `allDay`, `title`, `website`, `imageSrc`, `category` {`id`,`name`}, `tags[]` {`id`,`name`}, `location` {`name`,`description`,`href` auf `…/places.json`}.
* event.ics: `PRODID:-//IONAS//TVM//DE`; je VEVENT `DTSTART;TZID=Europe/Berlin`, `DTEND`, `SUMMARY`, `DESCRIPTION`, `LOCATION`, `X-LOCATION-NAME`, `X-STREET-ADDRESS`, `X-POSTAL-CODE`, `X-LOCALITY`, `X-ROOM-NUMBER`, `X-IONAS-CATEGORY`, `CATEGORIES`, `ATTACH`, `URL`, `UID`, `CREATED`, `LAST-MODIFIED`, `X-ORGANIZER-NAME`, `X-ORGANIZER-EMAIL`, `X-ORGANIZER-TELEPHONE`, `RRULE`/`RDATE`. Zählung amt-sn: 245 SUMMARY, 236 X-LOCATION-NAME, 152 X-LOCALITY, 139 X-STREET-ADDRESS, 81 X-POSTAL-CODE. Die ICS ist reicher als das JSON (Adresse, Veranstalter).

**4. robots.txt**
* amt-sn.de, grosshansdorf.de, lengerich-emsland.de, hachenburg-vg.de: alle 404 (keine Regeln). Feed-Pfade damit nicht gesperrt.

**5. Beispiele**
* Amt Sandesneben-Nusse (für Lüchow, Steinhorst, Kühsen, Groß Boden u. a., SH): https://www.amt-sn.de/verwaltung/kalender/ (TVM, Feed belegt)
* Großhansdorf (SH): https://www.grosshansdorf.de/aktuelles/veranstaltungen/ (kein TVM)
* Lengerich (NI): https://www.lengerich-emsland.de/freizeit-sport-kultur/veranstaltungen/ (destination.one)
* Dorffest-Beleg: „Nostalgischer Weihnachtsmarkt in Hachenburg“, 10. bis 13.12.2026, im events.json von https://www.hachenburg-vg.de/kalender/kombinierte-terminquelle/events.json?weekends=false&tagMode=ALL (ID `e4b4aa00-1431-4bae-95bd-4c3aa490e408:0` bis `:3`). In amt-sn.de kein Dorffest unter den 245 Terminen (überwiegend Sitzungen).

**6. Bewertung: hoch** für alle Gemeinden mit TVM-Kalender: ein JSON/ICS-Parser, Einstieg über `data-source` der Veranstaltungsseite. Unbekannt ist, wie viele der 864 TVM nutzen (Großhansdorf und Lengerich nicht).
Nächster Schritt: In der Vollerhebung je ionas-Gemeinde die Veranstaltungsseite auf `tvm-picker` / `events.json` prüfen und Pfad speichern; Deskline-Termine (UUID) gegen bestehende Deskline-Quellen deduplizieren.

### 2. hwext (TYPO3-Extension `hwveranstaltung`, Hirsch & Wölfl)

**1. Betreiber und Zahl**
* Hirsch & Wölfl GmbH, Schloss Vellberg, Alte Kaserne, Im Städtle 29, 74541 Vellberg, HRB 742121 AG Stuttgart (https://www.hirsch-woelfl.de/service/impressum).
* Eigenangabe: „in mehr als 1.400 Digitalprojekten … für zahlreiche Gemeinden, Städte, Landkreise, kommunale Einrichtungen sowie Unternehmen“ (https://www.hirsch-woelfl.de/startseite). Zahl der Kommunen: nicht belegt. Menüpunkt „Nussbaum Medien Schnittstelle“ vorhanden (nicht geprüft).
* Gemessen in Vollerhebung: 421 Gemeinden (BW).

**2. Zugriffsweg**
* Kein Listen-Feed gefunden (kein RSS/iCal-Link für die Liste, kein JSON-LD Event; JSON-LD nur BreadcrumbList und GovernmentOrganization).
* HTML-Liste, serverseitig gerendert, 10 Termine je Seite. Aufruf der Veranstaltungsseite leitet auf `<Seite>/seite-1/suche-none` um; Folgeseiten `<Seite>/seite-N/suche-none` (Neckartenzlingen bis seite-8, Owen bis seite-3).
* Detail: `<Seite>/<veranstaltungs-id>/<slug>` (Neckartenzlingen) oder `<Seite>/<id>/<slug>/termin-<termin-id>` (Owen).
* iCal nur je Termin, und nur wo der Button aktiviert ist: Deckenpfronn „Termin übernehmen“ `…?tx_hwveranstaltung_list[action]=icalExport&tx_hwveranstaltung_list[controller]=VeranstaltungFrontend&tx_hwveranstaltung_list[id]=<id>&tx_hwveranstaltung_list[tid]=<tid>&cHash=…` (10 von 10 Einträgen); bei Neckartenzlingen und Owen 0 Vorkommen. Wegen cHash nicht frei konstruierbar.
* Geprüft an drei Gemeinden (Neckartenzlingen, Owen, Deckenpfronn): dieselben Klassen und dasselbe Pfadmuster.

**3. Echte Feldnamen (HTML-Klassen)**
* Liste: Container `hw_fe__record hwveranstaltung__record` mit `id="hwveranstaltung__record__<id>"`; `hw_record__title`, `hw_record__categories--<n>` (Text z. B. „Kultur“, „Markt“), `hw_record__date`, `hw_record__time`, `hw_record__organizer`, `hw_record__organizer_phone`, `hw_record__simpleLocation`, `hw_record__email` (verschlüsselt `data-mailto-token`), `hw_record__website`, `hw_record__map_link` (OpenStreetMap-Link mit `mlat`/`mlon`, Apple-Maps-Link mit Adresse), `hw_record__more__show` (Detaillink), `hw_record__image`. Wert jeweils in `hw_record__value__text`.
* Detail: `hwveranstaltung__show__<id>`, `hw_content__first_title`, `hw_show__categories--<n>`, `hw_show__details` (gleiche `hw_record__*`-Felder), Beschreibung unter `hw_content__second_title` „Beschreibung“.
* iCal (Deckenpfronn, id 873): `PRODID:Hirsch & Wölfl Veranstaltungskalender`, `DTSTART;TZID=Europe/Berlin`, `DTEND`, `LOCATION`, `ORGANIZER;CN=…`, `SUMMARY`, `DESCRIPTION`, `UID:1328@…`, `VALARM`.

**4. robots.txt**
* neckartenzlingen.de, owen.de, deckenpfronn.de identisch aufgebaut: `Disallow: /*?type=*`, `Disallow: /*&type=*`, `Disallow: /*?tx_solr`, `/typo3/`, `/fileadmin/…`, Bildendungen; owen.de zusätzlich `Disallow: /index.php*`. Listen- und Detailpfade (`/seite-N/suche-none`, `/<id>/<slug>`) sind erlaubt. Ein TYPO3-typeNum-Feed (`?type=`) wäre gesperrt.

**5. Beispiele**
* Neckartenzlingen: https://www.neckartenzlingen.de/freizeit-kultur/veranstaltungen
* Owen: https://www.owen.de/freizeit-kultur/veranstaltungen
* Deckenpfronn: https://www.deckenpfronn.de/freizeit-erlebnis/veranstaltungen/veranstaltungskalender (die Erhebungs-URL `/maerkte` ist eine Textseite ohne Modul)
* Dorffest-Beleg: „Martinsmarkt“, 05.11.2026, 08:00 Uhr, Marktplatz, Veranstalter Gemeinde, Kategorie „Markt“: https://www.deckenpfronn.de/freizeit-erlebnis/veranstaltungen/veranstaltungskalender/873/martinsmarkt . Zusätzlich nennt die Textseite https://www.deckenpfronn.de/freizeit-erlebnis/veranstaltungen/maerkte „Weihnachtsmarkt am Samstag vor dem 1. Advent“.

**6. Bewertung: hoch.** Ein HTML-Parser über `hw_record__*` und Paging `seite-N/suche-none` passt auf alle drei Proben unverändert; Adresse und Koordinaten (OSM-Link) sind in der Liste. Einschränkung: Pfad der Veranstaltungsseite ist je Gemeinde verschieden (Einstieg aus Vollerhebung), Detailtext nur auf der Detailseite.
Nächster Schritt: Listenpfade der 421 aus der Erhebung übernehmen, an 10 weiteren Gemeinden Klassen und Paging bestätigen.

### 3. cEasy (hitcom)

**1. Betreiber und Zahl**
* hitcom gmbh, Junghansstraße 1, 78655 Dunningen (Fußzeile https://www.hitcom.de/impressum; Registerangaben im abgerufenen HTML nicht gefunden).
* Eigenangabe: „Über 200 Kunden und mehr als 2,8 Millionen Menschen“ und Kennzahl „200 + Kommunale Kunden“ (https://www.hitcom.de/willkommen). Neues Produkt heißt dort „dis gov ery“.
* Gemessen in Vollerhebung: 167 Gemeinden. **Achtung:** Die Erkennung beruht offenbar auf `ccm.ceasy.de` (Consent-Skript `https://ccm.ceasy.de/public/app.js?apiKey=…`). Großheide lädt dieses Skript, hat aber keinen cEasy-Generator und andere Pfade (`/resources/…`, `image-thumb__…`); die Zahl 167 enthält also auch Nicht-cEasy-CMS. Echte cEasy-Seiten tragen `<meta name="generator" content="cEasy 5.3.5 (10135) by hitcom new media gmbh">` (Eislingen, Murrhardt).

**2. Zugriffsweg**
* Kein Listen-Feed belegt. RSS-Feeds existieren (`/ceasy/serve/usage/main.php?view=publish&item=rssFeed&id=<n>`), sind aber Nachrichten („Stadtnachrichten“, „Topthemen“, „Touristinfo“, „App-Push“), nicht Termine.
* HTML-Liste (Modul „cVeka“), serverseitig. Eislingen: 98 Termine auf einer Seite (28.10.26 bis 25.01.28). Murrhardt: 15 je Seite, Paging `?item=eventDate&view=find&doPage=1&limit=15&doShowSearch=1&doCropPreviewImages=1&offset=N` (bis offset=225); `limit=300` wird ignoriert (15 zurück).
* Detail: `…/Veranstaltung?view=publish&item=eventDate&id=<id>`.
* iCal je Termin, gleicher Pfad auf beiden Gemeinden: `/ceasy/ics/veka/eventDate/<id>.ics` (leitet um auf `/ceasy/serve/usage/main.php?view=iCalendar&item=eventDate&id=<id>`). Geprüft: Eislingen id 6738, Murrhardt id 16409, beide 200 `text/calendar`.

**3. Echte Feldnamen**
* Liste, zwei Vorlagen: Eislingen `cVeka_stripes_eventDateOdd/Even`, `cVeka_stripes_date`, `cVeka_stripes_title`, `cVeka_stripes_teaser`, `cVeka_box_location`, `cVeka_box_organizer`, `cVeka_stripes_previewImage`; Murrhardt `cVeka_box_eventDate`, `cVeka_box_date`, `cVeka_box_time`, `cVeka_box_title`, `cVeka_box_teaser`, `cVeka_box_location`, `cVeka_box_organizer`, `cVeka_box_previewImage`. Gemeinsam: `cVeka_box_location`, `cVeka_box_organizer`, Detaillink mit `item=eventDate&id=`.
* Detail: `id="cVeka_publish_eventDate"` mit `data-item-id`, `data-series-id`; Blöcke `block_freeText`, `block_location`, `block_eventOrganizer`, `block_iCalendar`.
* iCal: `PRODID:http://www.hitcom.de/ceasy/veka`, `URL`, `UID` (= id), `SUMMARY`, `DESCRIPTION`, `LOCATION`, `CLASS`, `DTSTART;VALUE=DATE` bzw. `DTSTART:…Z`, `DTEND`, `DTSTAMP`.

**4. robots.txt**
* eislingen.de: `Disallow: /_Trash/`, `/jugendforum.eislingen.de/`. murrhardt.de: `Disallow:` (leer), Sitemap `/ceasy/modules/cms/sitemap.php`. grossheide.de: nur einzelne Bots gesperrt (AhrefsBot, Bytespider, CCBot, …). Listen-, Detail- und ICS-Pfade nicht gesperrt.

**5. Beispiele**
* Eislingen/Fils: https://www.eislingen.de/veranstaltungen
* Murrhardt: https://www.murrhardt.de/veranstaltungen
* Waiblingen (laut Erhebung): https://www.waiblingen.de/de/Die-Stadt/Aktuelles/Veranstaltungskalender (nicht abgerufen)
* Dorffest-Beleg: „Weihnachtsmarkt“, 28.11.2026, auf dem Kronenplatz, Stadtverwaltung Eislingen: https://www.eislingen.de/de/Freizeit-Kultur/Veranstaltungen/Veranstaltungskalender/Veranstaltung?view=publish&item=eventDate&id=6738 (ICS bestätigt `DTSTART;VALUE=DATE:20261128`).

**6. Bewertung: hoch** für echte cEasy-Seiten (ein HTML-Parser mit zwei Listenvorlagen, ICS je Termin für exakte Zeiten). Vorher die 167 auf den cEasy-Generator filtern, da die Erkennung auch reine Consent-Kunden zählt.
Nächster Schritt: Vollerhebung um Generator-Prüfung `cEasy` ergänzen; Liste mit Paging lesen, je Termin ICS für Zeit/Ort.

### 4. Weblication (Scholl Communications)

**1. Betreiber und Zahl**
* Scholl Communications AG, Elsässer Straße 74 + 80, 77694 Kehl, HRB 371717 AG Freiburg (https://www.weblication.de/cms/impressum.php).
* Eigenangabe: „Über 10.000 Kunden und mehr als 1.000 Vertrags-Agenturen“ (https://www.weblication.de/), branchenübergreifend. Zahl der Kommunen: nicht belegt.
* Gemessen in Vollerhebung: 99 Gemeinden. Generator `Weblication® CMS` auf beiden Proben.

**2. Zugriffsweg**
* Kein Listen-Feed gefunden. HTML-Liste serverseitig (Marienheide 65 Einträge auf einer Seite; Lorsch 12 je Seite, Paging `?pageId<hash>=N#list_<hash>`, z. B. `?pageIdd69d4944=2`, bis 10).
* Detail: `/de/veranstaltungen/termine/<Name>.php?splitId=<n>&from=<YYYY-MM-DD HH:MM:SS>&to=…`.
* iCal je Veranstaltung (alle Termine der Serie), gleicher Pfad auf beiden Gemeinden: `/de-wGlobal/wGlobal/scripts/php/createICal.php?path=<Detailpfad>`; Antwort leitet auf `/weblication/grid5/tmpHTTP/ical/<Name>.ics`. Geprüft: Marienheide `We.php` (3 VEVENT), Lorsch `St-Martins-Umzug.php` (2 VEVENT, 2026 und 2027).
* JSON-LD nur BreadcrumbList.

**3. Echte Feldnamen**
* Liste: `li.listEntry listEntryObject-eventMulti` mit `data-categories="|…|"`, `listEntryInner` mit `data-url` (Detailpfad mit splitId/from/to), `listEntryDate` (`dayDate dayFrom` bzw. `daydate dayFrom`, `timeFrom`, `timeTo`), `listEntryTitle` (Marienheide div, Lorsch `h3` mit Link), `listEntryDescription`, Lorsch zusätzlich `listEntryCalendar` (`month`, `day`).
* Detail: `elementObjectEventMultiDescription`, `elementObjectEventMultiLocation`, `elementObjectEventMultiOrganizer`, `elementObjectEventMultiDates` (`dateEntry`), `elementObjectEventMultiIcal`.
* iCal: `PRODID:-//Weblication CMS`, `SUMMARY`, `DTSTART` (lokal ohne TZ), `DTEND`, `DESCRIPTION`, `LOCATION`, `UID`, `URL`.

**4. robots.txt**
* marienheide.de und lorsch.de: 404 (keine Regeln). Pfade frei.

**5. Beispiele**
* Marienheide: https://www.marienheide.de/de/veranstaltungen/
* Lorsch: https://lorsch.de/de/veranstaltungen/
* Bad Zwischenahn (laut Erhebung): https://www.bad-zwischenahn.de/de/veranstaltungen/?navid=653465653465 (nicht abgerufen)
* Dorffest-Beleg: „Weihnachtsmarkt am Heilteich“, 04. bis 06.12.2026, Heilteichgelände, HeiAktiv e.V.: https://www.marienheide.de/de/veranstaltungen/termine/We.php (ICS bestätigt). Außerdem „Adventskonzert Musikzug Freiw. Feuerwehr Marienheide“ in der Liste und „St. Martins-Umzug“ Lorsch 08.11.2026.

**6. Bewertung: mittel bis hoch.** Klassen `listEntry*` gleich, Vorlage variiert (Titel div vs. h3, Datumsformat „04.12.2026“ vs. „30. Oktober 2026“). ICS-Pfad ist herstellerweit gleich und liefert alle Termine einer Veranstaltung. Kein Listen-Feed.
Nächster Schritt: Parser Liste → Detailpfade → `createICal.php?path=` je Veranstaltung; an 5 weiteren Weblication-Gemeinden prüfen, ob Paging-Hash und Klassen halten.

### 5. Open2C (Kinetiqa)

**1. Betreiber und Zahl**
* Kinetiqa GmbH, Sitz Regensburg, HRB 8753 AG Regensburg, Geschäftsführer Christian Vogl (https://www.kinetiqa.de/impressum). Generator der Gemeinden nennt `Open2C`, `Kinetiqa GmbH` und `www.kinetiqa.de`.
* Zahl der Kommunen: nicht belegt (Startseite nennt „Kommunen“ nur als Zielgruppe, https://www.kinetiqa.de/).
* Gemessen in Vollerhebung: 57 Gemeinden (BY).

**2. Zugriffsweg**
* HTML-Liste serverseitig, Modul `eventcalendar`: `/<Name>.o<objektid>.html?page=N` (Höslwang `Veranstaltungen-in-der-Gemeinde-Hoeslwang.o5122.html`, Pörnbach `Veranstaltungen-in-Poernbach.o379.html`), 10 bzw. 20 Einträge je Seite, Monatsfilter `s_month=11-2026`, Datumsfilter `s_startdate`/`s_enddate`.
* Detail: `…o<objektid>.html?s_category=0&page=1&detailevent=<id>`.
* Export je Termin auf dem Host der Verwaltungsgemeinschaft: `https://www.vg-halfing.de/export/export_ical.php?idlist=<id>` und `…/export_events.php?idlist=<id>` (VCS). Der Parameter nimmt eine Liste: `idlist=15060,15061` lieferte 2 VEVENT (geprüft).
* Pörnbach: robots.txt `Disallow: /export` sperrt genau diesen Pfad auf dem eigenen Host. Dort also nur HTML.
* Nicht jede Open2C-Gemeinde nutzt das Modul: Hunderdorf `Veranstaltungen.n18.html` bettet `https://wintopevents.de/myindex.php?ci=hunderdorf` als iframe ein; Schonstett gehört wie Höslwang zur VG Halfing (gleiches System).

**3. Echte Feldnamen**
* Liste: `event_teaser_datebox` (`event_teaser_datebox--daymonth`, `--year`), `event_teaser_block`, `teaser_title` (Link mit `detailevent`), Tabelle „Beschreibung:“, „Termin:“ mit `<time class="dtstart" datetime="2026-11-02T00:00:00+01:00">` und `<time class="dtend">`, „Kategorie:“; Trenner `event_divider`; Paging `ul.pag` (`pag__item`, `pag__link`, `rel="next"`).
* Detail: `event_detail_block`, `table.vevent dt__event` (Mikroformat hCalendar), `dt__event__date`, `dt__event__category` mit `td.category`.
* iCal: `PRODID:< http://www.open2c.de/ >`, `X-PUBLISHED-TTL:PT12H`, `CREATED`, `LAST-MODIFIED`, `DTSTART`/`DTSTART;VALUE=DATE`, `DTEND`, `CATEGORIES`, `SUMMARY`, `DESCRIPTION`, `UID`.

**4. robots.txt**
* hoeslwang.de, schonstett.de, vg-halfing.de: gleiche Datei, nur facebookexternalhit, Amazonbot, AhrefsBot, serpstatbot, SemrushBot, DotBot gesperrt, `User-agent: *` `Disallow:` (leer).
* hunderdorf.de: `Allow: /`.
* poernbach.de: `Disallow: /backend`, `/formulare-…`, `/Formulare`, **`/export`**.

**5. Beispiele**
* Höslwang: https://www.hoeslwang.de/Veranstaltungen.n328.html
* Pörnbach: https://www.poernbach.de/veranstaltungen-poernbach
* Schonstett: https://www.schonstett.de/Veranstaltungen.n128.html
* Dorffest-Beleg (schwach): „Leonhardiritt in Guntersberg“, 07.11.2026, https://www.hoeslwang.de/Veranstaltungen-in-der-Gemeinde-Hoeslwang.o5122.html?s_category=0&page=1&detailevent=15061 ; auf derselben Seite verlinkt „130 Jahre Hubertusschützen“ (https://www.hoeslwang.de/15246-copy-of-christbaumversteigerung-sv-hoeslwang, nicht abgerufen). Pörnbach: „St. Martinsumzug“ 11.11.2026, mehrere Vereins-Weihnachtsfeiern. Ein Feuerwehrfest/Kirchweih o. ä. im Probezeitraum: nicht belegt.

**6. Bewertung: mittel.** HTML-Klassen und Pfadschema (`.o<id>.html`, `detailevent`) sind herstellerweit gleich, die Objekt-ID der Liste ist je Gemeinde verschieden; die Termin-Seiten tragen `datetime`-Attribute (gut parsebar). Der Sammel-Export `idlist=` ist bequem, aber je Gemeinde robots-abhängig (Pörnbach gesperrt) und liegt teils auf dem VG-Host.
Nächster Schritt: HTML-Parser über Liste+Paging; Export nur wo robots es erlaubt.

### 6. GeoCMS (brain-SCC)

**1. Betreiber und Zahl**
* brain-SCC GmbH, Fritz-Haber-Str. 9, 06217 Merseburg, HRB 213349 AG Stendal, Geschäftsführer Sirko Scheffler (https://www.brain-scc.de/de/impressum.html).
* Eigenangabe auf https://www.brain-scc.de/: „14 Bundesländer, 359 Portale“, bezogen auf „Anwendungen auf Basis der Vorgangsraumtechnologie“, nicht auf GeoCMS-Websites. Zahl der GeoCMS-Kommunen: nicht belegt.
* Gemessen in Vollerhebung: 63 Gemeinden. Generator `GeoCMS Version:5.52.00 brain-SCC GmbH (c) 2026`.

**2. Zugriffsweg**
* Kein Feed, kein iCal-Link, kein JSON-LD Event auf Liste und Detail (Nebra).
* Zwei Listen-Vorlagen derselben Version:
  * Nebra (Modul `gcevent`): `/de/veranstaltungen.html?gcevent[pager]=N` (Schritt 10, bis 50).
  * Oebisfelde-Weferlingen (Modul `btp_event`, Bootstrap-Karten): `/de/veranstaltungen.html?btp_event[p_1_29_1096]=N` (Schritt 10, bis 70). Der Parametername enthält eine seitenspezifische Modulkennung.
* Detail in beiden: `/de/veranstaltung-detail/event/<id>,<site-id>/<slug>-<TT-MM-JJJJ>.html` (site-id Nebra 1067, Oebisfelde 1096).
* Tooltips laden Termine/Orte per `data-conid="<id>,<site>"` nach (JS `res/js/json.js`); Endpunkt nicht ausgewertet.
* Raguhn-Jeßnitz: `/de/veranstaltungen.html` und `/de/veranstaltungsuebersicht.html` ohne Termin-Modul im HTML (Artikel + Karte).

**3. Echte Feldnamen**
* gcevent-Liste: `article.gcevent-list-row oddeven0/1`, `gcevent-list-categories`, `gcevent-list-title` (Link), `gcevent-list-datetime` („28.10.2026 ab 11:00 Uhr“, „von 10:00 Uhr bis 16:00 Uhr“), `gcevent-list-location` / `gcevent-list-location-span`, `gcevent-listview-image-left`, `gcevent_tooltip` mit `data-info="ticket|address"`.
* btp_event-Liste: `div.card` mit `id="content_<id>_<site>"`, `card-title` (Link), `card-text date`, `card-text location` mit `gcevent-list-location-span`, Icons `btp_event_tooltip`.
* Detail (Nebra): `gcevent-singleview`, `gcevent-singleview-title`, `gcevent-singleview-datetime-date`, `gcevent-singleview-datetime-time`, `gcevent-singleview-content`, `gcevent-singleview-address-list`/`-row`/`-rowtitle`/`-contact`.

**4. robots.txt**
* stadt-nebra.de, raguhn-jessnitz.de, stadt-oebisfelde-weferlingen.de, brain-scc.de: `User-agent: *`, `Crawl-delay: 15`, `Disallow: /admin`. Listen- und Detailpfade frei; Crawl-delay 15 s je Host beachten (Vollabruf einer Gemeinde mit 8 Listenseiten = 2 Minuten).

**5. Beispiele**
* Nebra (Unstrut): https://www.stadt-nebra.de/de/veranstaltungen.html
* Oebisfelde-Weferlingen: https://www.stadt-oebisfelde-weferlingen.de/de/veranstaltungen.html
* Raguhn-Jeßnitz: https://www.raguhn-jessnitz.de/de/veranstaltungen.html (ohne Termin-Modul)
* Dorffest-Beleg: nicht belegt. Geprüft wurden Nebra Seite 1 und Offset 50 sowie Oebisfelde Seite 1 und Offset 30 (Gottesdienste, Führungen, Seniorenkreis, „Kinderfasching des Nebraer Carnevalvereins“ 13.02.2027, „Weinreise durch die Saale-Unstrut Region“ 13.03.2027).

**6. Bewertung: mittel.** Ein Parser mit zwei Listenvorlagen (`gcevent-*` und `btp_event`-Karten); Detail-URL-Schema ist gleich und enthält ID und Datum. Pager-Parametername bei btp_event ist je Seite anders, muss aus dem Pager-Link gelesen werden. Crawl-delay 15 bremst.
Nächster Schritt: Je GeoCMS-Gemeinde Pager-Link aus Seite 1 übernehmen; Detailseiten nur für Beschreibung/Adresse.

### 7. DigiPublica (Neos)

**1. Betreiber und Zahl**
* Betreiber: nicht belegt. https://www.digipublica.de/robots.txt und https://www.digipublica.de/ antworten 403 mit Cloudflare-Abfrage („Just a moment...“); nicht umgangen. Erkennung über Neos-Pakete `DigiPublica.Platform` und `DigiPublica.Design` (`/_Resources/Static/Packages/DigiPublica.*`). Frühere Notiz fn28-1 nennt zusätzlich den Host `holzkirchenufr.digiportal.de`.
* Gemessen in Vollerhebung: 61 Gemeinden (BY).

**2. Zugriffsweg**
* Drei Varianten in vier Proben:
  * Poxdorf `/freizeit-kultur/veranstaltungskalender`: Kalendermodul mit **Inline-JSON** im HTML, `new FullCalendar.Calendar(…, { … events: [ {"title","start","end","url"} … ] })`, 11 Termine (01.11.2026 bis 20.09.2027), dazu HTML-Liste `gdc-*`.
  * Leutenbach `/startseite/veranstaltungen` (leitet auf `/freizeit-tourismus/veranstaltungen`): Liste wird im Browser per **POST** `https://<host>/dataobjects/search` bzw. `/dataobjects/load` mit `context=Event` nachgeladen (aus `digiPortal.js`); im Server-HTML nur Filter (Kategorien u. a. „Kirchweih“) und ein PDF „Veranstaltungskalender Lb 2026“. POST nicht ausgeführt (Regel: nur GET).
  * Pfaffenhofen a.d.Glonn: Neos-Seite bettet `//www.rce-event.de/output.php?id=1242&mode=L` als iframe ein (RCE-Event, anderer Hersteller).
  * Remlingen: nur PDF `VereinstermineAbSept.26.pdf`.
* Detail: `<Kalenderseite>/detail?<slug>-<id>&lang=de` (Poxdorf), kein iCal-Link, JSON-LD nur BreadcrumbList.
* Bilder der Poxdorf-Termine liegen auf `www.effeltrich.de/_Resources/Persistent/…` (gemeinsamer Datenbestand der VG Effeltrich).

**3. Echte Feldnamen**
* Inline-JSON: `title`, `start` (`2026-11-01T19:00:00`), `end` (teils `1970-01-01T` als Leerwert), `url`.
* HTML-Liste: `gdc-list`, `gdc-object`, `gdc-image`, `gdc-content`, `gdc-date` (`date-day`, `date-month`, `date-year`), `gdc-time`, `gdc-title`, `gdc-calendarSheet`.
* Detail: `do-detail`, `do-categories`, `h1`, `do-longdesc`, `do-datetime-table` (Spalten „Datum“, „Uhrzeit“, „Buchungs-Link“), `do-contact`, `gps-name`.
* POST-Parameter laut JS: `nextPage`, `context`, `categories`, `categoriesIntersection`, `freetext`, `startdate`, `enddate`, `uri`, `getsize`, `allEvents`, `dateFormat`, `teaserImage`.

**4. robots.txt**
* remlingen.de: `Disallow: /neos/`, `/_Resources/`, `/account/` (sperrt dort auch die JS-Dateien). poxdorf.de, pfaffenhofen-glonn.de, gemeinde-leutenbach.de: 404 (keine Regeln). Kalenderseiten frei.

**5. Beispiele**
* Poxdorf: https://www.poxdorf.de/freizeit-kultur/veranstaltungskalender
* Leutenbach: https://www.gemeinde-leutenbach.de/startseite/veranstaltungen
* Remlingen: https://www.remlingen.de/startseite/termine-und-veranstaltungen
* Dorffest-Beleg: nicht als Termin belegt. Leutenbach führt die Filterkategorie „Kirchweih“ (`category-33`), Termine dazu nur per POST abrufbar. Poxdorf-JSON enthält nur Sitzungen und Vereinsbesprechung.

**6. Bewertung: mittel.** Wo das Kalendermodul aktiv ist, liefert das Inline-JSON (`events: [...]`) eine saubere Liste mit einem Parser für alle; viele Gemeinden nutzen aber stattdessen PDF, RCE-iframe oder das POST-Nachladen. Ein GET-Feed ist nicht belegt.
Nächster Schritt: In der Erhebung je DigiPublica-Gemeinde auf `FullCalendar`/`events:` im HTML prüfen; Klärung mit DigiPublica, ob `/dataobjects/search` per GET oder ein Export existiert.

### 8. contentXXL

**1. Betreiber und Zahl**
* CURRY Innovations GmbH, Hofmannstraße 5, 81379 München, „manufacturer of the contentXXL CMS“ (https://www.contentxxl.com/Home.aspx). Zahl der Kommunen: nicht belegt.
* Gemessen in Vollerhebung: 24 Gemeinden. Generator z. B. `contentXXL Business Content Management System 5.95.6445…` (Samtgemeinde Aue) und `5.4.3807…` (Gellersen, Dahlenburg).

**2. Zugriffsweg**
* Kein CMS-eigenes Veranstaltungsmodul in den Proben. Die Kalenderseiten betten Tourismus-Widgets der Metropolregion Hamburg ein:
  * Samtgemeinde Aue: `<imxplatform-whitelabel-widget widget-id="125">` + `https://hht.whitelabel.imxplatform.de/widget/widget.js`; Hinweis auf der Seite: Vereine melden Termine bei `https://eingabe.mrh.events/`.
  * Gellersen: `<imxplatform-whitelabel-widget widget-id="149">`.
  * Dahlenburg: `<script src="https://hamburgwhl.infomaxnet.de/action/widget?token=8YOKOja6VQg.&containerId=">`.
* widget.js enthält Pfade `/events/list`, `/pois/list` u. a. und `https://content-delivery.imxplatform.de/hht/imxplatform`; nicht weiter abgefragt (Nutzungsbedingungen nicht belegt).
* Die Erhebungs-URLs Gellersen und Dahlenburg waren veraltet (404); funktionierende Pfade aus deren Navigation: `/home/ihre-samtgemeinde/aktuelles/veranstaltungskalender.aspx` bzw. `/home/ihre-samtgemeinde/aktuelles/veranstaltungen-events.aspx`.

**3. Echte Feldnamen**
* Nur Einbettungsattribute: `imxplatform-whitelabel-widget` `widget-id`, infomax `token`, `containerId`. Feldnamen der Termine: nicht belegt.

**4. robots.txt**
* samtgemeinde-aue.de: `Disallow: /textonly/`. gellersen.de, dahlenburg.de: MJ12bot gesperrt, sonst `Disallow: /textonly/`. hht.whitelabel.imxplatform.de: `Crawl-delay: 5`, `Disallow: /_nuxt/`, `/assets/`. contentxxl.com: `/sitemanager/`, Blog-Pfade.

**5. Beispiele**
* Samtgemeinde Aue (Bad Bodenteich, Wrestedt): https://www.samtgemeinde-aue.de/home/ihre-samtgemeinde/aktuelles/veranstaltungskalender.aspx
* Samtgemeinde Gellersen (Reppenstedt): https://www.gellersen.de/home/ihre-samtgemeinde/aktuelles/veranstaltungskalender.aspx
* Samtgemeinde Dahlenburg (Dahlem): https://www.dahlenburg.de/home/ihre-samtgemeinde/aktuelles/veranstaltungen-events.aspx
* Dorffest-Beleg (Seitenlink, kein Termin): Navigationseintrag „Martinimarkt“ https://www.dahlenburg.de/home/kultur-freizeit-tourismus/veranstaltungen/martinimarkt-2.aspx (nicht abgerufen).

**6. Bewertung: niedrig** für einen contentXXL-Parser (kein Modul belegt). Die Termine der Proben kommen aus der imx-Plattform der Metropolregion Hamburg (Heide/Lüneburg); das ist eine Tourismus-Quelle, die man einmal zentral statt je Gemeinde anbinden würde.
Nächster Schritt: imx/MRH als eigene Quelle prüfen (Lizenz, offizieller Zugang über mrh.events/infomax), contentXXL aus der Hersteller-Liste streichen.

### 9. Sitepark (Information Enterprise Server / InfoSite)

**1. Betreiber und Zahl**
* Sitepark GmbH, Neubrückenstr. 8-11, 48143 Münster, HRB 5017 AG Münster, Geschäftsführer Thorsten Liebold (Anbieterkennzeichnung auf https://www.sitepark.com/).
* Eigenangabe: „Kommunale Internet-Auftritte seit 1997“, „9 Mio. Einwohner werden von ihren Kommunen und Kreisen über Software von Sitepark informiert“ (https://www.sitepark.com/). Zahl der Kommunen: nicht belegt. Partner kdvz Rhein-Erft-Rur (Frechen) genannt.
* Gemessen in Vollerhebung: 29 Gemeinden (meist Städte). Generator `Information Enterprise Server` mit Zusatz `Sitepark GmbH`.

**2. Zugriffsweg**
* Kein Listen-Feed: `veranstaltungskalender.php?sp:out=iCal` auf der Liste (Zülpich) liefert 200 `text/calendar`, aber leeren VCALENDAR (0 VEVENT).
* HTML-Liste serverseitig (sitekit 3.41.1), Paging-Parameter aus `data-sp-pagination`: `pageParameterName":"sp:page[eventSearch-1.form][0]"`, Trefferzahl in `data-sp-search-result` (Hürth `resultCount` 145, 15 Seiten; Zülpich 18, 2 Seiten).
* Detail: `<pfad>/<Name>.php?sp:startDateKey=<YYYY-MM-DD>`; Metadaten als JSON in `<meta … data-content-type="json" data-content="{…}">` (u. a. `id`, `objecttype":"eventsCalendar-event"`, `date`, `category`).
* iCal je Termin, gleicher Mechanismus auf beiden Gemeinden: `<Detail>?sp:startDateKey=<datum>&sp:out=iCal` (Hürth id 57103, Zülpich id 21256 geprüft).

**3. Echte Feldnamen**
* Liste: `SP-TeaserList__item`, `SP-Teaser`, `SP-Teaser__inner` (Link, `rel="bookmark"`), `SP-Scheduling__begin`, `SP-Scheduling__date`, `SP-Scheduling__time`, `SP-Teaser__headline`, `SP-Teaser__abstract`, `SP-CardTeaser__image`.
* Detail-JSON (`data-content`): `id`, `name`, `changed`, `title`, `objecttype`, `contenttype[]`, `language`, `date`, `site`, `category`, `category_path`.
* iCal: `PRODID:-//sitepark/sitekit//3.0/EN`, `UID` (`<id>-<datum>`), `SUMMARY`, `DESCRIPTION`, `URL`, `DTSTART` (UTC `…Z` oder `VALUE=DATE`), `DTEND`, `LOCATION` (Zülpich „Markt 21, 53909 Zülpich“), `CATEGORIES`.

**4. robots.txt**
* huerth.de: lange Liste einzelner Bots mit `Disallow: /` (u. a. GPTBot, anthropic-ai, CCBot, AhrefsBot), danach `User-agent: *` `Crawl-Delay: 15`. zuelpich.de: dieselbe Bot-Liste mit `Disallow: /`, kein Abschnitt für `*`. Unser User-Agent ist nicht gelistet; Kalenderpfade frei, Crawl-delay 15 bei Hürth.

**5. Beispiele**
* Hürth: https://www.huerth.de/veranstaltungskalender.php
* Zülpich: https://www.zuelpich.de/kultur-sport/veranstaltungskalender.php
* Wesseling (laut Erhebung): https://www.wesseling.de/kultur-sport/veranstaltungskalender.php (nicht abgerufen)
* Dorffest-Beleg (Brauchtum): „Historischer Martinszug“, 04.11.2026, Markt 21, Zülpich: https://www.zuelpich.de/veranstaltungskalender/veranstaltungen/kulturkalender/Historischer-Martinszug26.php?sp%3AstartDateKey=2026-11-04 ; Hürth „St. Martinsumzüge“ (Kategorie „Tradition & Brauchtum“). Feuerwehrfest/Kirmes im Probezeitraum: nicht belegt.

**6. Bewertung: hoch.** sitekit-Klassen `SP-*`, Paging-Parameter und `sp:out=iCal` sind Teil des Produkts und auf beiden Proben gleich. Kleine Gruppe (29, überwiegend Städte); teils Bot-Listen und Crawl-delay.
Nächster Schritt: Parser Liste (`SP-Teaser`) → Detail `sp:out=iCal`; prüfen, ob Stuttgart/Offenbach (andere Pfade laut Erhebung) dieselbe sitekit-Version haben.

### 10. cmcitymedia ohne Cross7 (cm city media GmbH)

**1. Betreiber und Zahl**
* cm city media GmbH, Münchner Str. 15, 89073 Ulm (Fußzeile https://www.cmcitymedia.de/). Eigenangabe „Über 450 Kunden“, „Module, die bereits in hunderten Kommunen erfolgreich im Einsatz sind“ (https://www.cmcitymedia.de/). Frühere Notiz fn28-1: Übernahme durch die SV Gruppe (Schwäbischer Verlag).
* Gemessen in Vollerhebung: 38 Gemeinden (ohne Cross7-Komponenten).

**2. Zugriffsweg**
* TYPO3-Seiten der Gemeinde mit Kalender „calendarV4“ von cmcitymedia. Daten und Exporte liegen auf `exchange.cmcitymedia.de/<gemeinde>/` (aus `…/calendarV4_0/data/config.js`): `veranstaltungenData.php` (JSON-Quelle, `jsonReferer`), `veranstaltungenIcsExport.php?dayFrom=…&monthFrom=…&yearFrom=…&dayTo=…&categories=…`, `veranstaltungenIcal.php?id=<id>`, `veranstaltungenExport.php` (PDF). **exchange.cmcitymedia.de und publish1.cmcitymedia.de sperren per robots.txt alles** (`User-agent: *` `Disallow: /`). Daher nicht nutzbar ohne Erlaubnis.
* Erlaubter Weg auf dem Gemeindehost: Klassik-Ansicht, serverseitig gerendert: `<Kalenderseite>?publish[calendarViewType]=classic&publish[p]=<seiten-id>&publish[start]=<N>&cHash=…` bzw. `index.php?id=<seiten-id>&publish[calendarViewType]=classic&publish[start]=N`. Maselheim (Seite 322) 5 Einträge je Seite, Blankenheim (Seite 352) 21 je Seite. Geprüft an beiden.
* Die Ordnernamen sind gemeindespezifisch (`/maselheim/`, `/blankenheim/`); die auskommentierten Export-Links in der Vorlage zeigen noch `/buehlerzell2013/` (Vorlagenkopie).

**3. Echte Feldnamen**
* Klassik-Liste: `div.list` mit Anker `id="event<id>"`, `date` (`month`, `day`), `entry`, `headline`, `timeBlock` („26.11.2026 um 15:00 Uhr bis 17:00 Uhr“), `organizer` („Veranstalter:“), `location` („Ort:“), `outlook` (Link `veranstaltungenIcal.php?id=<id>` auf exchange), `descriptionBlockShow`.
* config.js (einmal abgerufen, s. Regelabweichung): `jsonReferer`, `exportPathPdf`, `exportPathIcs`, `exportPathIcal`, `mapHomepageId` (36900), `indexId` ("322"), `nummberOfLoadedMonthsInPast` (6).

**4. robots.txt**
* maselheim.de und blankenheim.de: nur SEO-Bots gesperrt (AhrefsBot, MJ12bot, DotBot, SEOkicks, SemrushBot, ZoominfoBot, MegaIndex …), kein `*`-Abschnitt. Kalenderseiten frei.
* exchange.cmcitymedia.de, publish1.cmcitymedia.de: `User-agent: *` `Disallow: /`.

**5. Beispiele**
* Maselheim (BW): https://www.maselheim.de/de/freizeit-kultur/veranstaltungskalender
* Blankenheim (NW): https://www.blankenheim.de/de/freizeit/events/veranstaltungskalender
* Neudenau (BW, laut Erhebung): https://www.neudenau.de/de/freizeit-kultur/veranstaltungskalender (nicht abgerufen)
* Dorffest-Beleg (schwach): Blankenheim „GlühweinSchleife“ 29.11.2026, „Adventsbasar“ 29.11.2026, „Barbarakonzert“ 28.11.2026 in https://www.blankenheim.de/de/freizeit/events/veranstaltungskalender?publish%5BcalendarViewType%5D=classic&publish%5Bp%5D=352&publish%5Bstart%5D=4&cHash=c5454564d7342b245f90eac89583bf3f . Maselheim Seite 1: Müllabfuhr, Tischtennis, Generalversammlung. Kirmes/Feuerwehrfest: nicht belegt.

**6. Bewertung: hoch** für einen HTML-Parser der Klassik-Ansicht (gleiche Klassen auf beiden Proben), **niedrig** für den eigentlichen JSON/iCal-Weg, solange robots.txt auf exchange alles sperrt. Müllabfuhrtermine müssen gefiltert werden.
Nächster Schritt: cm city media nach Freigabe für `exchange.cmcitymedia.de/<gemeinde>/veranstaltungenData.php` fragen (gleiche Firma wie Cross7, dort ist die API offen); bis dahin Klassik-Ansicht parsen.


### Anfragenliste

124 GET-Anfragen. Datum: Einträge ab 20:24 am 27.10.2026, Einträge ab 17:16 am 28.10.2026 (Uhrzeit der Shell). Status = HTTP-Code der letzten Antwort nach Weiterleitungen (curl -L).

| Zeit | URL | Status |
|---|---|---|
| 27.10. 20:24:42 | https://www.amt-sn.de/robots.txt | 404 |
| 27.10. 20:24:43 | https://www.grosshansdorf.de/robots.txt | 404 |
| 27.10. 20:24:46 | https://www.lengerich-emsland.de/robots.txt | 404 |
| 27.10. 20:25:06 | https://www.grosshansdorf.de/aktuelles/veranstaltungen/ | 200 |
| 27.10. 20:25:10 | https://www.amt-sn.de/verwaltung/kalender/ | 200 |
| 27.10. 20:25:50 | https://www.amt-sn.de/kalender/events.json?weekends=false&tagMode=ALL | 200 |
| 27.10. 20:26:00 | https://www.amt-sn.de/kalender/event.ics?weekends=false&tagMode=ALL | 200 |
| 27.10. 20:26:45 | https://www.grosshansdorf.de/aktuelles/veranstaltungen/veranstaltungskalender/ | 200 |
| 27.10. 20:26:47 | https://www.lengerich-emsland.de/freizeit-sport-kultur/veranstaltungen/ | 200 |
| 27.10. 20:27:32 | https://www.hachenburg-vg.de/robots.txt | 404 |
| 27.10. 20:27:34 | https://www.hachenburg-vg.de/kalender/kombinierte-terminquelle/events.json?weekends=false&tagMode=ALL | 200 |
| 27.10. 20:27:36 | https://www.chamaeleon.de/robots.txt | 404 |
| 27.10. 20:27:49 | https://www.chamaeleon.de/ | 200 |
| 27.10. 20:28:00 | https://www.chamaeleon.de/impressum/ | 200 |
| 27.10. 20:28:01 | https://www.chamaeleon.de/oeffentliche-verwaltung/Referenzen/ | 200 |
| 27.10. 20:28:14 | https://www.neckartenzlingen.de/robots.txt | 200 |
| 27.10. 20:28:14 | https://www.owen.de/robots.txt | 200 |
| 27.10. 20:28:21 | https://www.neckartenzlingen.de/freizeit-kultur/veranstaltungen | 200 |
| 27.10. 20:28:22 | https://www.owen.de/freizeit-kultur/veranstaltungen | 200 |
| 27.10. 20:28:58 | https://www.owen.de/freizeit-kultur/veranstaltungen/867/laternenlauf-fuer-kinder-auf-dem-sportgelaende-owen/termin-3745 | 200 |
| 27.10. 20:29:20 | https://www.deckenpfronn.de/robots.txt | 200 |
| 27.10. 20:29:21 | https://www.deckenpfronn.de/freizeit-erlebnis/veranstaltungen/maerkte | 200 |
| 27.10. 20:29:46 | https://www.deckenpfronn.de/freizeit-erlebnis/veranstaltungen/veranstaltungskalender | 200 |
| 27.10. 20:30:00 | https://www.hirsch-woelfl.de/robots.txt | 200 |
| 28.10. 17:16:25 | https://www.deckenpfronn.de/freizeit-erlebnis/veranstaltungen/veranstaltungskalender?tx_hwveranstaltung_list%5Baction%5D=icalExport&tx_hwveranstaltung_list%5Bcontroller%5D=VeranstaltungFrontend&tx_hwveranstaltung_list%5Bid%5D=873&tx_hwveranstaltung_list%5Btid%5D=1328&cHash=5d2be00bbf3f0be8c72fb43365055936 | 200 |
| 28.10. 17:16:26 | https://www.hirsch-woelfl.de/ | 200 |
| 28.10. 17:16:37 | https://www.hirsch-woelfl.de/service/impressum | 200 |
| 28.10. 17:17:07 | https://www.eislingen.de/robots.txt | 200 |
| 28.10. 17:17:08 | https://www.grossheide.de/robots.txt | 200 |
| 28.10. 17:17:10 | https://www.eislingen.de/veranstaltungen | 200 |
| 28.10. 17:17:11 | https://www.grossheide.de/Freizeit-Tourismus/Veranstaltungen | 200 |
| 28.10. 17:17:51 | https://www.eislingen.de/de/Freizeit-Kultur/Veranstaltungen/Veranstaltungskalender/Veranstaltung?view=publish&item=eventDate&id=6738 | 200 |
| 28.10. 17:18:05 | https://www.eislingen.de/ceasy/ics/veka/eventDate/6738.ics | 200 |
| 28.10. 17:18:17 | https://www.murrhardt.de/robots.txt | 200 |
| 28.10. 17:18:18 | https://www.murrhardt.de/veranstaltungen | 200 |
| 28.10. 17:18:41 | https://www.murrhardt.de/veranstaltungen?item=eventDate&view=find&doPage=1&limit=300&offset=0 | 200 |
| 28.10. 17:18:42 | https://www.murrhardt.de/ceasy/ics/veka/eventDate/16409.ics | 200 |
| 28.10. 17:18:53 | https://www.hitcom.de/robots.txt | 200 |
| 28.10. 17:18:54 | https://www.hitcom.de/ | 200 |
| 28.10. 17:19:02 | https://www.hitcom.de/impressum | 200 |
| 28.10. 17:19:26 | https://www.marienheide.de/robots.txt | 404 |
| 28.10. 17:19:27 | https://lorsch.de/robots.txt | 404 |
| 28.10. 17:19:28 | https://www.marienheide.de/de/veranstaltungen/ | 200 |
| 28.10. 17:19:29 | https://lorsch.de/de/veranstaltungen/ | 200 |
| 28.10. 17:19:50 | https://www.marienheide.de/de/veranstaltungen/termine/We.php?splitId=1&from=2026-12-04%2018:00:00&to=2026-12-04%2022:00:00 | 200 |
| 28.10. 17:20:00 | https://www.marienheide.de/de-wGlobal/wGlobal/scripts/php/createICal.php?path=/de/veranstaltungen/termine/We.php | 200 |
| 28.10. 17:20:28 | https://lorsch.de/de-wGlobal/wGlobal/scripts/php/createICal.php?path=/de/veranstaltungen/termine/St-Martins-Umzug.php | 200 |
| 28.10. 17:20:31 | https://www.weblication.de/robots.txt | 200 |
| 28.10. 17:20:38 | https://www.weblication.de/ | 200 |
| 28.10. 17:21:00 | https://www.weblication.de/cms/impressum.php | 200 |
| 28.10. 17:21:10 | https://www.hoeslwang.de/robots.txt | 200 |
| 28.10. 17:21:11 | https://www.hunderdorf.de/robots.txt | 200 |
| 28.10. 17:21:12 | https://www.hoeslwang.de/Veranstaltungen.n328.html | 200 |
| 28.10. 17:21:13 | https://www.hunderdorf.de/Veranstaltungen.n18.html | 200 |
| 28.10. 17:21:59 | https://www.hoeslwang.de/Veranstaltungen-in-der-Gemeinde-Hoeslwang.o5122.html?s_category=0&page=1&detailevent=15061 | 200 |
| 28.10. 17:22:09 | https://www.vg-halfing.de/robots.txt | 200 |
| 28.10. 17:22:10 | https://www.vg-halfing.de/export/export_ical.php?idlist=15060,15061 | 200 |
| 28.10. 17:22:27 | https://www.schonstett.de/robots.txt | 200 |
| 28.10. 17:22:28 | https://www.schonstett.de/Veranstaltungen.n128.html | 200 |
| 28.10. 17:23:09 | https://www.poernbach.de/robots.txt | 200 |
| 28.10. 17:23:11 | https://www.poernbach.de/veranstaltungen-poernbach | 200 |
| 28.10. 17:23:29 | https://www.kinetiqa.de/robots.txt | 200 |
| 28.10. 17:23:32 | https://www.kinetiqa.de/ | 200 |
| 28.10. 17:24:00 | https://www.kinetiqa.de/impressum | 200 |
| 28.10. 17:24:16 | https://www.stadt-nebra.de/robots.txt | 200 |
| 28.10. 17:24:17 | https://www.raguhn-jessnitz.de/robots.txt | 200 |
| 28.10. 17:24:19 | https://www.stadt-nebra.de/de/veranstaltungen.html | 200 |
| 28.10. 17:24:20 | https://www.raguhn-jessnitz.de/de/veranstaltungen.html | 200 |
| 28.10. 17:25:10 | https://www.stadt-nebra.de/de/veranstaltung-detail/event/21203,1067/gottesdienst-zum-reformationstag-mit-verabschiedung-von-pfarrer-r-m-lehmann-31-10-2026.html | 200 |
| 28.10. 17:25:32 | https://www.raguhn-jessnitz.de/de/veranstaltungsuebersicht.html | 200 |
| 28.10. 17:26:02 | https://www.stadt-oebisfelde-weferlingen.de/robots.txt | 200 |
| 28.10. 17:26:05 | https://www.stadt-oebisfelde-weferlingen.de/de/veranstaltungen.html | 200 |
| 28.10. 17:26:33 | https://www.stadt-nebra.de/de/veranstaltungen.html?gcevent%5Bpager%5D=50 | 200 |
| 28.10. 17:27:05 | https://www.stadt-oebisfelde-weferlingen.de/de/veranstaltungen.html?btp_event%5Bp_1_29_1096%5D=30 | 200 |
| 28.10. 17:27:16 | https://www.brain-scc.de/robots.txt | 200 |
| 28.10. 17:27:17 | https://www.brain-scc.de/ | 200 |
| 28.10. 17:27:33 | https://www.remlingen.de/robots.txt | 200 |
| 28.10. 17:27:34 | https://www.poxdorf.de/robots.txt | 404 |
| 28.10. 17:27:36 | https://www.remlingen.de/startseite/termine-und-veranstaltungen | 200 |
| 28.10. 17:27:39 | https://www.poxdorf.de/freizeit-kultur/veranstaltungskalender | 200 |
| 28.10. 17:28:35 | https://www.pfaffenhofen-glonn.de/robots.txt | 404 |
| 28.10. 17:28:38 | https://www.pfaffenhofen-glonn.de/aktuelles-termine/veranstaltungen | 200 |
| 28.10. 17:29:03 | https://www.pfaffenhofen-glonn.de/aktuelles-termine/veranstaltungen/veranstaltungskalender | 200 |
| 28.10. 17:29:39 | https://www.gemeinde-leutenbach.de/robots.txt | 404 |
| 28.10. 17:29:43 | https://www.gemeinde-leutenbach.de/startseite/veranstaltungen | 200 |
| 28.10. 17:30:21 | https://www.poxdorf.de/_Resources/Static/Packages/DigiPublica.Platform/Frontend/JavaScript/digiPortal.js?bust=400fc80c | 200 |
| 28.10. 17:30:52 | https://www.poxdorf.de/freizeit-kultur/veranstaltungskalender/detail?sitzung-mit-terminabsprache-der-poxdorfer-vereine-34134&lang=de | 200 |
| 28.10. 17:31:03 | https://www.digipublica.de/robots.txt | 403 |
| 28.10. 17:31:03 | https://www.digipublica.de/ | 403 |
| 28.10. 17:31:45 | https://www.maselheim.de/robots.txt | 200 |
| 28.10. 17:31:46 | https://www.blankenheim.de/robots.txt | 200 |
| 28.10. 17:31:47 | https://www.maselheim.de/de/freizeit-kultur/veranstaltungskalender | 200 |
| 28.10. 17:31:48 | https://www.blankenheim.de/de/freizeit/events/veranstaltungskalender | 200 |
| 28.10. 17:32:13 | https://exchange.cmcitymedia.de/robots.txt | 200 |
| 28.10. 17:32:13 | https://publish1.cmcitymedia.de/robots.txt | 200 |
| 28.10. 17:32:14 | https://exchange.cmcitymedia.de/maselheim/calendarV4_0/data/config.js | 200 |
| 28.10. 17:32:34 | https://www.maselheim.de/de/freizeit-kultur/veranstaltungskalender?publish%5BcalendarViewType%5D=classic&cHash=4592ab61aff4cc9868af141f97bc8eec | 200 |
| 28.10. 17:32:55 | https://www.blankenheim.de/de/freizeit/events/veranstaltungskalender?publish%5BcalendarViewType%5D=classic&publish%5Bp%5D=352&publish%5Bstart%5D=4&cHash=c5454564d7342b245f90eac89583bf3f | 200 |
| 28.10. 17:33:06 | https://www.brain-scc.de/de/impressum.html | 200 |
| 28.10. 17:33:07 | https://www.cmcitymedia.de/robots.txt | 404 |
| 28.10. 17:33:15 | https://www.cmcitymedia.de/ | 200 |
| 28.10. 17:33:28 | https://www.samtgemeinde-aue.de/robots.txt | 200 |
| 28.10. 17:33:28 | https://www.gellersen.de/robots.txt | 200 |
| 28.10. 17:33:30 | https://www.samtgemeinde-aue.de/home/ihre-samtgemeinde/aktuelles/veranstaltungskalender.aspx | 200 |
| 28.10. 17:33:30 | https://www.gellersen.de/home/themenseiten/home/themenseiten/reppenstedt/ihre-gemeinde/aktuelles-2/veranstaltungskalender-3.aspx | 404 |
| 28.10. 17:33:54 | https://www.dahlenburg.de/robots.txt | 200 |
| 28.10. 17:33:55 | https://www.dahlenburg.de/home/ihre-samtgemeinde/rathaus/mitgliedsgemeinden/home/ihre-samtgemeinde/aktuelles/veranstaltungen-events.aspx | 404 |
| 28.10. 17:34:12 | https://www.dahlenburg.de/home/ihre-samtgemeinde/aktuelles/veranstaltungen-events.aspx | 200 |
| 28.10. 17:34:13 | https://www.gellersen.de/home/ihre-samtgemeinde/aktuelles/veranstaltungskalender.aspx | 200 |
| 28.10. 17:34:34 | https://hht.whitelabel.imxplatform.de/robots.txt | 200 |
| 28.10. 17:34:43 | https://hht.whitelabel.imxplatform.de/widget/widget.js | 200 |
| 28.10. 17:34:52 | https://www.contentxxl.com/robots.txt | 200 |
| 28.10. 17:34:54 | https://www.contentxxl.com/ | 200 |
| 28.10. 17:35:06 | https://www.huerth.de/robots.txt | 200 |
| 28.10. 17:35:07 | https://www.zuelpich.de/robots.txt | 200 |
| 28.10. 17:35:07 | https://www.huerth.de/veranstaltungskalender.php | 200 |
| 28.10. 17:35:08 | https://www.zuelpich.de/kultur-sport/veranstaltungskalender.php | 200 |
| 28.10. 17:35:40 | https://www.huerth.de/events/st.martinsumzuege.php?sp%3AstartDateKey=2026-11-02 | 200 |
| 28.10. 17:35:52 | https://www.huerth.de/events/st.martinsumzuege.php?sp%3AstartDateKey=2026-11-02&sp%3Aout=iCal | 200 |
| 28.10. 17:35:52 | https://www.zuelpich.de/kultur-sport/veranstaltungskalender.php?sp%3Aout=iCal | 200 |
| 28.10. 17:36:02 | https://www.zuelpich.de/veranstaltungskalender/veranstaltungen/kulturkalender/Historischer-Martinszug26.php?sp%3AstartDateKey=2026-11-04&sp%3Aout=iCal | 200 |
| 28.10. 17:36:03 | https://www.sitepark.com/robots.txt | 200 |
| 28.10. 17:36:11 | https://www.sitepark.com/ | 200 |
| 28.10. 17:36:21 | https://www.sitepark.com | 200 |

## D. Rohbefunde eingebettete Kalender und verwaltungsportal.de

Stand 27./28.10.2026. Quelle der Gemeindezahlen: `fn28-census-vendor-examples.json`
(Vollerhebung 10.749 Gemeinde-Websites). Alle Anfragen mit
`curl -m 20 -A "Mozilla/5.0 (compatible; lasstreffen-research/1.0)"`, Liste am Ende.
Fünf Widget-Seiten wurden zusätzlich einmal im Browser-Pane geladen, um die
Netzwerk-Aufrufe der Widgets zu sehen (in der Liste als Seitenaufruf vermerkt).
Keine Konten, keine Formulare, keine POST-Anfragen von uns.

Bekannt und hier nur ergänzt: `docs/research/de-gemeinden/00-bundesweit.md` C6
(termine-regional.de), C7 (verwaltungsportal.de), G (destination.one) und
`docs/research/deutschland-event-quellen-2026-10.md` §1 (destination.one open-data),
§12 (Deskline deutsche Linkkeys).

### Übersicht

| Quelle | Gemeinden (Erhebung) | Zugriffsweg | Lizenz / AGB | Eine Integration für alle? |
|---|---|---|---|---|
| verwaltungsportal | 1.131 | HTML-Liste 12 Monate + AJAX-Fragment für Folgejahr, JSON-LD je Detail | nicht belegt | hoch |
| destination.one-Widget | 118 | meta.et4.de, Experience je Ort; open-data deckt nur einen Teil | open-data: Lizenz je Datensatz; Experiences: nicht belegt | mittel |
| Deskline (DW5) | 109 | webapi.deskline.net/<Linkkey>, Linkkey aus `tagcontext.js` | nicht belegt (Backend der Webclients) | mittel |
| termine-regional | 49 | TYPO3-Erweiterung `nws_regional_events`, HTML + iCal je Event; Schnittstelle nur per Vertrag | Vertrag: nur nicht kommerziell, kommerziell auf Anfrage | hoch, aber nur mit Vertrag |
| RCE-Event | 39 | iframe `rce-event.de/output.php`; JSON-Modus mit Auth-Code | robots.txt sperrt `/` komplett | niedrig ohne Vertrag |
| regiogate (RECON CMS) | 26 | serverseitiges HTML je Gemeinde, `?ev[id]=` | nicht belegt | mittel (ein Parser, kein zentraler Endpunkt) |
| toubiz | 34 | `mein.toubiz.de/api/v1/eventDates` mit Kunden-Token aus dem Widget | nicht belegt | mittel, nur mit eigenem Zugang |
| lkrg (SQR) | 17 | `aht1gh-api.sqronline.de/.../getevents?module_division_uuid=` JSON per GET | nicht belegt | hoch für den Kreis (17 Gemeinden) |
| embed_other | 41 | heterogen (siehe Abschnitt) | je Anbieter | niedrig bis mittel |

### 1. verwaltungsportal (1.131 Gemeinden)

**Betreiber:** siehe C7 (Förderverein für regionale Entwicklung e.V., Azubi-Projekte).

**Zugriffsweg (neu belegt):**
* Liste `/veranstaltungen/index.php` zeigt alle Termine der nächsten 12 Monate auf
  einer Seite, ohne Seitenzahlen. Rantzau: 30.10.2026 bis 24.09.2027, 82 Detail-Links;
  Seester 34; Lunden-Lehe-Krempel 105 (inklusive
  wöchentlicher Wiederholungen, jede Wiederholung eigene URL mit Datum).
* Weiterblättern läuft über ein AJAX-Fragment, Definition in
  `/js/min/portal.min.js` (Funktion `eventRequest`):
  `/event/event/ajaxlist/year/<JJJJ>/month/<MM>/day/<TT>/kategorie/0/region/0/ort/0/distanz/0/mandat/0/vorschau/0/mandatview/0/`
  liefert HTML für die nächsten 12 Monate ab dem Datum (Seite ruft es mit
  `year/2027/month/10/day/28` auf). Probe Seester: 200, 18.933 Byte, 7 Detail-Links
  bis 2028 (z. B. `/veranstaltungen/1560509/2028/05/01/saisoneröffnungsfest-der-fähre-kronsnest.html`).
  Archiv analog `/event/event/ajaxarchive/...` und `index.php?archiv=1`.
* Filterformular `GET /veranstaltungen/rubrik.php` mit `rubrik`, `ort`, `beginn`,
  `ende` (nur gelesen, nicht abgeschickt). `ort` sind Mandats-IDs (Rantzau: Gemeinde
  Bevern 9150, Ellerhoop 5272 …), d. h. ein Amt führt die Termine seiner Gemeinden.
* RSS, iCal, JSON-Export: nicht gefunden. Liste und Detail verweisen auf kein `.ics`;
  `ical.min.js` wird geladen, ein Download-Link ist in Liste und Detail nicht vorhanden.
  `index.php?modus=drucken` existiert (nicht abgerufen).

**Felder (Probe Seester, Feuerwehrball):** JSON-LD `Event` mit `name`,
`description`, `startDate` (`2027-02-27T20:00:00+0100`), `location.name`
(„Sporthalle Seester“), `location.address` (`streetAddress` „Dorfstraße 43“,
`postalCode` 25370, `addressLocality` Seester, `addressCountry` DE), `location.url`.
Kein `endDate`, keine Koordinaten. Damit ist die Adresse hier vollständiger als in der
Gedern-Probe (C7).

**robots.txt** (alle drei identisch): `Disallow: /` und `Crawl-delay: 10` nur für eine
Liste benannter Bots, keine Regel für `*`. AGB/Nutzungsbedingungen: nicht belegt.

**Beispiele:**
* Amt Rantzau (Groß Offenseth-Aspern u. a., SH) https://www.amt-rantzau.de/veranstaltungen/index.php
* Seester (SH) http://www.seester.de/veranstaltungen/index.php
* Lunden, Lehe, Krempel (SH) https://www.gemeinden-lunden-lehe-krempel.de/veranstaltungen/index.php

**Dorffest-Beleg:** Feuerwehrball der Feuerwehr Seester, 27.02.2027
http://www.seester.de/veranstaltungen/2963017/2027/02/27/feuerwehrball.html ; dazu
„Seester grillt, öffentliches Grillfest“ 20.08.2027 und Laternenumzug der FF Hemdingen
30.10.2026 (Rantzau, `/veranstaltungen/2871466/2026/10/30/laternenumzug-der-ff-hemdingen.html`).

**Bewertung:** hoch. Gleiche URL-Muster, gleiches JSON-LD, gleiches AJAX-Fragment auf
allen geprüften Seiten. Ein Parser: Liste (12 Monate) plus ein `ajaxlist`-Abruf für das
Folgejahr, dann Detailseiten mit JSON-LD. Achtung: Wiederholungen erzeugen viele
Detail-URLs (Lunden: DRK-Stuhlkreis wöchentlich).

**Nächster Schritt:** Prüfstand an 10 Gemeinden aus der Erhebung (Liste + JSON-LD);
Betreiber nach Erlaubnis und einem zentralen Export fragen (die Mandats-IDs deuten auf
eine gemeinsame Datenbank, ein zentraler Endpunkt ist nicht belegt).

### 2. destination.one-Widget (118 Gemeinden)

**Experiences in den Widgets (aus dem HTML):**

| Gemeinde (Erhebung) | Seite | Experience | Einbindung |
|---|---|---|---|
| Rhede (Ems), NI | https://rhede-ems.de/veranstaltungen/ | `rhede-ems` | iframe `pages.destination.one/de/rhede-ems/default/search/Event/...` |
| Geeste, NI | https://www.geeste.de/tourismus-freizeit-und-kultur/kulturelle-veranstaltungen | `geeste` (Liste), `emsland` (Eintragen-Link) | Script `pages.et4.de/de/geeste/streaming/search/Event/...` |
| Ostereistedt, NI (Seite Selsingen) | https://www.selsingen.de/rathaus/veranstaltungskalender | `nordwaerts-orte` | Script `pages.destination.one/de/nordwaerts-orte/default/search/Event` |
| Wilhelmshaven, NI | https://www.wilhelmshaven.de/Kultur/Veranstaltungen/ | `wilhelmshaven-touristik` (Eintragen-Link) | Liste serverseitig im CMS, Bilder von `dam.destination.one` |
| Betzendorf, NI (Seite Amelinghausen) | https://www.amelinghausen.de/infos-service/veranstaltungen | `samtgemeinde-amelinghausen` (Eintragen-Link) | Liste serverseitig, dazu `web5.deskline.net/dwutility.js` |
| Kronsgaard, SH (Seite Ostseefjord Schlei) | https://www.ostseefjordschlei.de/erlebniswelten/veranstaltungen | `ostseefjordschlei` (Eintragen-Link) | Liste serverseitig, Bilder über `img.destination.one` aus `calengo.de` |

**Test open-data**, `meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=1&q=city:"<Ort>"`, ohne Datumsfenster (enthält also auch vergangene, noch nicht entfernte Termine, z. B. Herbstmarkt Geeste 26.10.2025):

| q=city: | overallcount open-data | Gegenprobe eigene Experience (ohne q) |
|---|---|---|
| „Rhede“ | 113, aber Treffer ist **Rhede 46414 (NRW)**, nicht Rhede (Ems) | `rhede-ems`: 0 |
| „Rhede (Ems)“ | 0 | |
| „Geeste“ | 11 | `geeste`: 40 |
| „Wilhelmshaven“ | 45 | `wilhelmshaven-touristik`: 230 |
| „Selsingen“ | 8 | nicht abgefragt |
| „Amelinghausen“ | 3 | nicht abgefragt |

**Befund:** Die Termine dieser Gemeinden sind in open-data nur teilweise enthalten
(Geeste 11 von 40, Wilhelmshaven 45 von 230; die eigene Experience ist nicht auf den
Ort gefiltert, der Vergleich ist daher grob). In den Stichproben trugen die open-data-
Datensätze ein `license`-Attribut (PD, CC-BY-SA, CC0); in den Experience-Proben hatten
2 von 6 Datensätzen keins („Pfarrfest Christus König Dalum“, „Abdul Kader Chahin“).
Dass genau die unlizenzierten Datensätze in open-data fehlen, ist naheliegend, aber
**nicht belegt**. `experience=rhede-ems` liefert über meta.et4.de 0, obwohl das Widget
diese Experience nutzt: Experience-Name im Widget und Such-Experience sind nicht
zwingend gleich (nicht belegt). `city:` ist mehrdeutig (Rhede), für den Import also
PLZ oder Koordinaten nutzen.

**Felder (Probe):** `id`, `global_id`, `title`, `type`, `categories`, `texts`, `city`,
`zip`, `street`, `geo.main.latitude/longitude`, `timeIntervals` (start, end, tz,
weekdays), `web`, `email`, `media_objects`, `attributes` (license, licenseurl,
VO_Id …), `source`, `company`, `created`, `changed`.

**Dorffest-Beleg:** „22. Winterzauber Weihnachtsmarkt!“ (Gut Thansen, PLZ 21385,
12.12.2026, open-data `e_101233300`, Lizenz CC-BY-SA, Web http://www.gut-thansen.de/winterzauber);
„Pfarrfest Christus König Dalum“ Geeste 20.09.2026 nur in Experience `geeste`
(`e_101258751`, ohne Lizenz).

**Bewertung:** mittel. open-data ist schon geplant (Masterplan), deckt diese
Gemeinden aber nur teilweise. Voller Umfang nur über die jeweilige Experience, deren
Nutzung durch Dritte nicht belegt ist.

**Nächster Schritt:** In der Anfrage an destination.one (support@destination.one)
zusätzlich fragen, ob Datensätze ohne Lizenzangabe für Dritte freigegeben werden
können, bzw. Zugriff auf die Experiences der Widget-Gemeinden. meta.et4.de-Budget
dieser Session (10) ist verbraucht.

### 3. Deskline / feratel DW5 (109 Gemeinden)

**Zugriffsweg:** Gemeindeseiten laden `resc.deskline.net/DW5/start/<ORG>/<Tag-UUID>/index.js`.
Diese Datei nennt nur den `owner` (Organisationscode). Der WebAPI-Linkkey steht in
`resc.deskline.net/DW5/tags/<owner>/<Tag-UUID>/tagcontext.js` (`appContext.linkKey`).
Das Widget ruft dann `webapi.deskline.net/<linkKey>/de/events?...` mit Header
`DW-Source: desklineweb` (gleich wie `src/lib/scrapers/FeratelScraper.ts`). Der
`owner` ist nicht immer der Linkkey: `sobernheim` und `zell` liefern 400
„Linkkey … is not found“, `dillenburg` funktioniert.

| Gemeinde (Erhebung) | Seite | DW5-Org | Linkkey | Events (`totalRecordCount`) | Orte |
|---|---|---|---|---|---|
| Löllbach u. a. (VG Nahe-Glan, RP) | https://www.vg-nahe-glan.de/leben-freizeit/veranstaltungskalender/ (leitet auf ferienregion-nahe-glan.de) | SOBERNHEIM | `naheglan` (Netzwerk-Aufruf) | 38 | 8, u. a. Meisenheim 17, Bad Sobernheim 7 |
| Herborn, Dillenburg (HE) | https://www.herborn.de/leben/freizeit/veranstaltungsverzeichnis/ , https://www.dillenburg.de/veranstaltungen/ | DILLENBURG | `dillenburg` | 183 | 11, u. a. Herborn 65, Dillenburg 60, Haiger 21 |
| Haserich, Schauren (RP) | https://www.zellerland.de/wein-kulinarik/events/veranstaltungen | ZELL | `rptzell` (`tagcontext.js`) | 108 | 9, u. a. Zell 55, Zell-Kaimt 18, Pünderich 16 |

`dbCode` der Events bei naheglan und rptzell: `RPT` (Datenbank Rheinland-Pfalz
Tourismus); Bilder unter `resc.deskline.net/images/RPT/...`. Dillenburg: dbCode
nicht abgefragt. Bereits im Repo bekannt (Kommentar `FeratelScraper.ts`, entfernt
2026-09-18): eisenberg, fischen, frein, hochwald, kirchberg, kohlgrub, lahnstein, linz,
neustadt, oberbuch, rieden, waldburg; dazu `mosel` (1.929) laut Quellenbericht §12.

**Felder (Probe):** `id`, `name`, `dbCode`, `date`, `location{place,town,coordinate{lat,long}}`
(bei Nahe-Glan teils `coordinate: null`), weitere wie in `EVENT_FIELDS` des Scrapers.

**Lizenz:** nicht belegt (Backend-API der Webclients, siehe §12).

**Dorffest-Beleg:** „Weinfest der ‚Zeller Schwarzen Katz‘“ Zell, 25.06.2027
(rptzell `dedeabd3-83aa-475d-816a-7cb7dc24fe7b`); „‚Brandenburger‘ Straßenweinfest“
Zell 27.03.2027; „Glühweinfest in Roth“ Becherbach/Pfalz 08.11.2026 (naheglan);
„Nikolausmarkt Übernthal“ Siegbach 05.12.2026 (dillenburg). Öffentliche Ansicht:
https://www.zellerland.de/wein-kulinarik/events/veranstaltungen

**Bewertung:** mittel. Technisch ist es der vorhandene Feratel-Scraper (nur neue
Linkkeys), Linkkeys lassen sich je Gemeindeseite deterministisch über
`index.js` → `tagcontext.js` ermitteln. Rheinland-Pfalz liegt laut §12 schon
lizenziert bei destination.one (Dubletten wahrscheinlich); Hessen (Dillenburg)
ist ein eigener Mandant. Freigabe für Deutschland nicht belegt.

**Nächster Schritt:** Linkkeys aller 109 Erhebungsseiten per `tagcontext.js`
sammeln (2 GET je Seite), Ereignisse zählen und gegen destination.one dedupen; vor
Import Freigabe bei feratel bzw. RPT klären.

### 4. termine-regional (49 Gemeinden)

**Betreiber:** NetzWerkstatt GmbH & Co. KG (C6). In allen geprüften Gemeindeseiten
nicht iKISS, sondern die TYPO3-Erweiterung `nws_regional_events`
(Formularfelder `tx_nwsregionalevents_pi1[search|monthYear|place|category|province]`,
Logo „Diese Veranstaltungen werden von termine-regional.de bereitgestellt“). Die
Gemeindeseite holt die Daten serverseitig; ein öffentlicher JSON-Endpunkt ist nicht
sichtbar.

**Zugriffsweg:**
* Gemeindeseite: HTML-Liste, 15 Einträge je Seite, Pager `/liste/<n>` (Hüttener
  Berge bis Seite 5, Schlei-Ostsee 3, Lensahn 3; Folgeseiten reichen nur wenige Wochen,
  Hüttener Berge Seite 5 endet Ende November). Detail `/…/ansicht/<slug>-<ID>`, die ID
  ist die globale termine-regional-ID (gleiches Muster auf termine-regional.de).
* termine-regional.de: zentrale Liste `/veranstaltungen` mit Pager bis Seite 1.204
  (Seite 1: 15 Einträge), Detail `/veranstaltungen/details/ansicht/<slug>-<ID>`,
  **iCal je Event** `/veranstaltungen/details/ical/<slug>-<ID>/event.ics` (Link auf der
  Detailseite, nicht abgerufen). Suche nur per POST-Formular (nicht genutzt; GET mit
  den Feldern ergab 404).
* Schnittstelle (API/Datenexport) nur per Vertrag:
  https://www.termine-regional.de/kunden/nutzungsrechte .

**Felder (Probe Wochenmarkt Parchim):** Titel, Datum, Uhrzeit von/bis, Ort
(„Schuhmarkt, Parchim“), Kategorie („Feste & Märkte“), Freitext, Quelle/Veranstalter
mit Adresse (19370 Parchim), Web. Kein JSON-LD.

**Lizenz:** Vertrag §3: „nicht ausschließliche und nicht übertragbare Recht zur nicht
kommerziellen Nutzung“; Werbeeinnahmen ausdrücklich ausgeschlossen, kommerziell auf
Anfrage; Weitergabe an Dritte untersagt; Vergütung laut Preisliste (§4).
robots.txt termine-regional.de und Gemeindeseiten: nur `/typo3/` gesperrt.

**Beispiele:**
* Amt Schlei-Ostsee (Holzdorf, Altenhof, SH) https://www.amt-schlei-ostsee.de/service/terminkalender/
* Amt Lensahn (Kabelhorst, SH) https://www.lensahn.de/aktuelles/veranstaltungskalender
* Amt Hüttener Berge (Damendorf, SH) https://www.amt-huettener-berge.de/das-amt/termine
* Amt Breitenfelde (Talkau, Alt-Mölln): Seite zeigte im Oktoberfilter „Ort: Mölln,
  Gefundene Veranstaltungen: 0“ https://www.amt-breitenfelde.de/veranstaltungskalender

**Dorffest-Beleg:** in den Proben **nicht belegt** (gesehen: Sitzungen, Gottesdienste,
Adventsandachten, Volkstrauertag, Preisskat, Wochenmarkt). Die Kategorie „Feste &
Märkte“ existiert.

**Bewertung:** hoch technisch (eine Datenbank, globale IDs, iCal je Event), aber
kommerzielle Nutzung nur nach Vertrag. HTML-Abgriff würde den Vertrag umgehen.

**Nächster Schritt:** Angebot für kommerzielle Schnittstellennutzung anfragen
(Preisliste, Abdeckung nach Region). Ohne Vertrag nicht integrieren.

### 5. RCE-Event (39 Gemeinden)

**Betreiber:** RCE Medien GmbH & Co. KG / Ch. Reiter (Kopfzeile der robots.txt von
www.veranstaltungen-oberbayern.de).

**Zugriffsweg:** iframe `https://www.rce-event.de/output.php?id=<Template-ID>&mode=L&gk=<Gemeindekennziffer>`
(Pleiskirchen: `id=1192&gk=9171127`). Regionalportal veranstaltungen-oberbayern.de:
`output.php?id=458&mode=L` mit Parametern `volltext`, `lkr`, `gk`, `epool`, `kat`,
`datum` (aus dem Seiten-Script). Laut Code des WordPress-Plugins „RCE Event“
(https://plugins.svn.wordpress.org/rce-event/trunk/helper_functions/get_events_from_rce.php)
gibt es einen JSON-Modus:
`output.php?id=<Template-ID>&mode=xml&auth=<Auth-Code>&version=200&convertMode=json&zeilen=<n>`
sowie eine PLZ-Variante mit `plz=` (Auth-Code im Plugin hinterlegt, hier nicht genutzt
und nicht wiedergegeben). Antwortstruktur laut Plugin: `EVENTLIST.EVENT[]`,
`DATELIST.DATE.STARTDATE/STARTTIME`, Upload-/Bilddaten.
Das Plugin ist auf wordpress.org seit 03.12.2025 geschlossen („Guideline Violation“),
https://wordpress.org/plugins/rce-event/ .

**robots.txt www.rce-event.de:** `User-agent: *` `Disallow: /`. Deshalb **keine**
Abfrage von `output.php` (weder HTML noch JSON). Felder aus eigener Probe daher nicht
belegt; obige Felder nur aus dem Plugin-Code.

**Beispiele:**
* Pleiskirchen (BY) https://www.pleiskirchen.de/veranstaltungskalender/ (iframe id 1192)
* Edelsfeld (BY) https://www.edelsfeld.de/freizeit-tourismus-kultur/veranstaltungen/ (RCE hinter Zwei-Klick-Einwilligung)
* Eurasburg (BY) über http://www.veranstaltungen-oberbayern.de/ (iframe id 458)
* Markt Haag i.OB: RCE-Einbindung auf der Übersichtsseite nicht gefunden (nur eigene Seiten wie „Haager Christkindlmarkt“), Klassifizierung nicht bestätigt.

**Dorffest-Beleg:** nicht belegt (Datenquelle per robots.txt gesperrt).

**Bewertung:** niedrig ohne Vertrag; mit Vertrag hoch (Gemeindekennziffer als Filter).

**Nächster Schritt:** RCE Medien anschreiben (Kontakt laut robots.txt:
http://www.veranstaltungen-oberbayern.de/kontakt.php), Lizenz und Template-ID für
Bayern anfragen.

### 6. regiogate / RECON CMS (26 Gemeinden)

**Betreiber:** CMS „RECON“ (Übersetzungslinks zeigen auf `demo.recon-cms.de`, JS-Objekt
`recon.apiKeys`), Assets von `cdn.regiogate.net`. Laut https://www.wmtips.com/technologies/cms/recon/
sitzt RECON in Unterpleichfeld; regiogate GmbH laut
https://www.bayern-international.de/en/company-database/company-details/regiogate-gmbh-34512 .
Dass beide derselbe Anbieter sind: nicht belegt.

**Zugriffsweg:** serverseitiges HTML auf jeder Gemeinde-Domain, Liste
`…/veranstaltungen/index.html`, Pager `?page=<n>` (Sinntal bis 5), Detail
`?ev[id]=<lokale ID>` (IDs je Website: Chamerau 138 bis 183, Sinntal 10762 bis 11259).
Kein zentraler Endpunkt, kein RSS/iCal, JSON-LD nur `BreadcrumbList`.

**Felder (Probe Chamerau Detail ev 178):** Titel, Kategorie (dort „2027“), Wochentag
und Datum ohne Jahr in der Anzeige, optional Uhrzeit und Ort, Freitext. Jahr nur aus
Kategorie oder Listenkontext.

**robots.txt** (alle drei identisch): `Disallow: /*?fCMS`, `/*lostpassword`, `/*.txt$`,
`/*addpdfprinter`. `?ev[id]=` ist nicht gesperrt. AGB: nicht belegt.

**Beispiele:** Chamerau (BY) https://www.chamerau.de/aktuelles/veranstaltungen/index.html ;
Sinntal (HE) https://www.sinntal.de/freizeittourismus/veranstaltungen ;
Perasdorf (BY) https://www.perasdorf.de/freizeiterholung/veranstaltungen/index.html (zum Zeitpunkt ohne Termine).

**Dorffest-Beleg:** „Maifest der Eichenlaubschützen Staning“, 01.05.2027
https://www.chamerau.de/aktuelles/veranstaltungen/index.html?ev%5Bid%5D=178 ; dazu
„Dorfweihnacht der Eichenlaubschützen Staning“ 21.11.2026 und „75 jähriges
Gründungsfest der FF …“ 23.07.2027 (Chamerau).

**Bewertung:** mittel. Ein Parser für alle 26, aber 26 Abrufe, schwache Datumsangabe
(Jahr fehlt in der Anzeige), keine Adressen.

**Nächster Schritt:** Detailseiten von 3 weiteren Gemeinden auf Jahr/Ort prüfen;
RECON nach einem Export (die Module tragen IDs) fragen.

### 7. toubiz (34 Gemeinden)

**Betreiber:** land in sicht AG (Erhebungsbogen mit `mein.toubiz.de` und
helpdesk@land-in-sicht.de: https://www.Guetenbach.de/fileadmin/Dateien/Dateien/toubiz-Erhebungsbogen-Veranstaltungen.pdf ).

**Zugriffsweg:** Web-Component `<toubiz-widget route="/event" api-token="…" base-uri="https://mein.toubiz.de">`
aus `widget.toubiz.de/js/stable/widget.js`. Das Widget ruft (Netzwerk-Aufruf im
Browser) `https://mein.toubiz.de/api/v1/eventDates?…&unlicensed=1&filter[clientIncludingManaged]=current&filter[element]=events&filter[date][after]=today&filter[city][0]=<UUID>&pagination[pageSize]=12&pagination[page]=1&language=de`
und `api/v1/element/events?withFilterConfiguration=1`. Jede Gemeinde hat einen
eigenen Kunden-Token (`$2y$…`) und optional Orts-UUIDs (Neuenstein
`3b096ba3-…`, Fürstenstein `ce50a445-…`). Den Token haben wir nicht verwendet: er
gehört dem jeweiligen Kunden. Öffentliche API-Doku: nicht gefunden.
Auffällig: Konfiguration `unlicensed: true` bzw. Parameter `unlicensed=1`; dem Namen
nach schließt die Abfrage Daten ohne Lizenz ein, Bedeutung nicht belegt.

**Felder (gerendert, Fürstenstein):** Datum, Kategorie (z. B. „HOFFEST“,
„WEIHNACHTSMARKT“), Titel, Ort, Uhrzeit, Preis („Kostenfrei“), Wiederholung
(„+ weitere“, „Jeden Do“), Detail-Link `#/eventDate/<UUID>`.

**robots.txt:** `mein.toubiz.de`: nur `/storage/` gesperrt; widget.toubiz.de: 404.
Nutzungsbedingungen: nicht belegt.

**Beispiele:** Neuenstein (HE) https://www.neuenstein.net/veranstaltungen.html (9
Ergebnisse, Naturführungen); Fürstenstein (BY) https://fuerstenstein.de/veranstaltungen
(7 Ergebnisse, Passauer Land); Bad Birnbach/Bayerbach (BY) https://www.badbirnbach.de/media/events
(ohne Ortsfilter, `clientIncludingManaged: current`).

**Dorffest-Beleg:** „Oberpollinger Adventsmarkt“, Fürstenstein, Sa 21.11.2026
https://www.passauer-land.de/content#/eventDate/01a14358-0ffa-73e7-8a06-be37d6ff2fcd ;
dazu „Halloweenfeier“ (Kategorie Hoffest) 30.10.2026.

**Bewertung:** mittel. Eine API für alle toubiz-Kunden, aber nur mit eigenem Zugang;
fremde Widget-Tokens zu nutzen kommt nicht in Frage. Verteilung der toubiz-Kunden
nach Ländern: nicht belegt (Erhebung: BY, HE, SL unter den Beispielen).

**Nächster Schritt:** land in sicht nach einem Partner-/Syndikationszugang fragen
(Umfang „unlicensed“ vs. lizenziert, Kosten).

### 8. lkrg / SQR (Landkreis Rhön-Grabfeld, 17 Gemeinden)

**Betreiber:** Snippet unter `snippets.lkrg.net` (Landkreis Rhön-Grabfeld), Backend
`aht1gh-api.sqronline.de` (SQR). Firmenangaben zu SQR: nicht belegt.

**Zugriffsweg:** Gemeindeseite enthält
`<div id="event_cal_api" api_url="https://aht1gh-api.sqronline.de/api/modules/events/getevents-post" data-moddivuuids="<UUID>">`.
Das Snippet sendet POST mit `{module_division_uuids:[…]}`; laut App-Code
(`snippets.lkrg.net/…/js/app.dab64e19.js`) gibt es dieselbe Liste per **GET**:
`https://aht1gh-api.sqronline.de/api/modules/events/getevents?module_division_uuid=<UUID>`,
Detail `getevents?v=<event_id>`. Probe GET: 200 JSON-Array.

| Gemeinde | UUID | Events | customer_id / module_division_id | Zeitraum |
|---|---|---|---|---|
| Strahlungen | a7c17d68-d5c8-4110-aabe-d201b09d451e | 26 | 9/54 (24), 8/61 (1), 22/76 (1) | 02.11.2026 bis 13.03.2027 |
| Burglauer | 2a1d707f-0eb5-48e8-af42-b464aa53b2e7 | 30 | 8/61 (29), 22/76 (1) | 02.11.2026 bis 06.03.2027 |

Division 76 (customer 22) erscheint in beiden: vermutlich eine gemeinsame Ebene
(z. B. Allianz), nicht belegt.

**Felder (Probe):** `id`, `uuid`, `customer_id`, `module_division_id`, `event_titel`,
`event_untertitel`, `event_veranstalter`, `event_beschreibung`, `event_ort`,
`event_strasse`, `event_plzort`, `event_startdatum`, `event_enddatum`,
`event_startzeit`, `event_endzeit`, `event_category`, `gallery`, `image`,
`image_copyright`, `event_vorverkauf_link`, `is_event_tipp`, `freigegeben`,
`anmeldung_notwendig`, `created_at`, `updated_at`. Keine Koordinaten.

**robots.txt:** aht1gh-api.sqronline.de `Disallow:` (leer, alles erlaubt);
snippets.lkrg.net 404; strahlungen.de nur TYPO3-Pfade. AGB: nicht belegt.

**Beispiele:** Strahlungen https://www.strahlungen.de/veranstaltungen ; Burglauer
https://www.burglauer.de/veranstaltungen ; Rödelmaier https://www.roedelmaier.de/veranstaltungen
(gleiche Snippets laut Erhebung, nicht abgerufen).

**Dorffest-Beleg:** „Weihnachtsmarkt mit Christbaumverkauf“, Kirmesgesellschaft
Burglauer mit der Gemeinde, 12.12.2026 (id 19641); „Dorfadvent“ Burglauer 06.12.2026;
Adventsfenster der FF Strahlungen 27.11.2026 (id 19983).

**Bewertung:** hoch für diesen Kreis: ein JSON-Endpunkt, Gemeinde-UUID aus dem HTML,
saubere Felder mit Adresse. Reichweite nur 17 Gemeinden (Erhebung).

**Nächster Schritt:** UUIDs der 17 Seiten sammeln (1 GET je Seite), Landratsamt
Rhön-Grabfeld nach Erlaubnis fragen; prüfen, ob SQR weitere Landkreise bedient
(Erkennung `sqronline.de` in der Erhebung).

### 9. embed_other (41 Gemeinden, heterogen)

| Anbieter | Beispiel (Gemeinde, Link) | Zugriffsweg | Felder (Probe) | robots / Lizenz | Bewertung |
|---|---|---|---|---|---|
| kalender.digital (Online-Kalenderdienst, je Kunde ein Kalender) | Bobenheim am Berg (RP) http://www.bobenheim.de/content/termine.html ; Sydower Fließ (BB) https://www.sydower-fliess.de/veranstaltungen/ | `https://api.kalender.digital/event?timeZone=Europe/Berlin&startDate=<JJJJ-MM-TT 00:00:00>&endDate=…&capabilityId=<Kalender-ID aus iframe>` (GET, JSON) | `id`, `start_date`, `end_date`, `title`, `text`, `who`, `where`, `subCalendars`, `wholeDay`, `repeatSeriesId` | robots: nur `/create-demo*` und ein Kalender gesperrt; AGB nicht gelesen | niedrig (kein Netzwerk, je Gemeinde ein Kalender, wenig Felder) |
| freizeitkalender.eu (Landratsamt Vogtlandkreis, „Anbieter des Freizeitkalenders ist der Vogtlandkreis“) | Pausa-Mühltroff (SN) https://www.stadt-pausa-muehltroff.de/veranstaltungskalender/ | HTML `/out/list/filter/<Filter-ID>` (Pausa 46), Monatsseiten `/month/JJJJ-MM`, Detail `/out/show/filter/46/id/<ID>`; RSS `/out/feed` im `<link rel=alternate>`, antwortet aber 500 (auch `/out/feed/filter/46`) | Titel, Untertitel, Webseite, Kategorie, Beginn, Ort mit PLZ/Straße, Kontakt, Preis, Barrierefreiheit, Veranstalter; Startseite zeigt je Event eine Lizenz („CC BY-ND“ 6×, „CC BY“ 2×) | robots.txt: `Disallow: /` nur für eine Liste benannter Bots; Nutzungsbedingungen regeln nur Redaktionen | mittel (Kreisdatenbank, Lizenz je Event, CC BY-ND erlaubt keine Bearbeitung) |
| infomax TMV-Whitelabel (Tourismusverband MV) | Altefähr (MV) https://www.altefaehr.de/veranstaltungen | `tmvwhl.infomaxnet.de/<kunde>/?widgetToken=…`, Liste lädt per AJAX (`data-idents="eventdate_<ID>"`); siehe fn28-7-mv-b (GET-Suche `form=search`) | Tageszähler und eventdate-IDs; Titel erst per AJAX | Crawl-delay 5, `/data/` und `/ServiceInterface/` gesperrt; Lizenz nicht belegt | mittel (ein Landessystem MV, Zugang über TMV klären) |
| imxplatform Whitelabel (infomax) | Bad Bodenteich u. a. (NI, Erhebung unter contentxxl), bereits in fn28-6-ni-c und fn28-4-sh-nord-segeberg beschrieben | `content-delivery.imxplatform.de/<instanz>/imxplatform` mit Bearer-Token im Widget (nicht genutzt) | nicht neu geprüft | Crawl-delay 5 | mittel, nur über Betreiber |
| TIMM-Kalender VG Oettingen | Ehingen a.Ries (BY) https://www.vg-oettingen.de/wir-stellen-uns-vor/ueber-uns/veranstaltungskalender | iframe `kalender.verwaltungsgemeinschaft-oettingen.de`, Daten per GET `kalender.php?aktuelleevents=<Tage>&jahr=<JJJJ>`, `monatsliste=`, `quartal=`, `event&id=` (HTML-Fragment) | Datum, Kalenderwoche, Titel, Orts-ID (z. B. 33, 16); 54 Einträge in 100 Tagen | robots 404 | niedrig (eine VG mit 11 Orten) |
| Dahoam in Niederbayern | Eichendorf (BY) https://markt-eichendorf.de/index.php/vkalender | iframe `eichendorf.dahoam-in-niederbayern.de/code/iframe?gemkal=58` (TYPO3, Erweiterung `vereinsportal`), Detail `/veranstaltungen/<slug>-<ID>/`; Zeichenkette „ical“ im HTML, Link nicht belegt | Datum, Uhrzeit, Titel, Veranstalter, PLZ/Ort, Ort, Teaser, Kategorien (u. a. Volksfest, Weihnachtsmarkt) | robots: nur TYPO3-Pfade gesperrt; Betreiber nicht belegt | mittel (Regionsplattform, Subdomain je Gemeinde, gemkal-ID) |
| ILE Lech-Wertach (WordPress) | Igling u. a. 7 Gemeinden (BY) https://veranstaltungen-lech-wertach.de/ | WP-REST je Gemeinde als eigener Beitragstyp: `/wp-json/wp/v2/igling?per_page=100` (21 Events), ebenso `langerringen`, `hiltenfingen`, `hurlach`, `obermeitingen`, `amberg`, `lamerdingen` | `title`, `link`, `acf.event_startdate` (JJJJMMTT), `event_start_time`, `event_enddate`, `event_end_time`, `event_ort` (ID), `event_organizer` (ID), `veranstaltungskategorie` | robots: nur `/wp-admin/`; Lizenz nicht belegt | niedrig (7 Gemeinden), technisch sehr einfach |
| Veranstaltungen im Norden (OSMIUM Digital, Hamburg; öffentliche Ansicht der-norden.de) | Erhebungsgemeinden nicht in der JSON-Probe | Backend mit Gruppen-/Portal-Logins, öffentliche Liste `der-norden.de/alle-termine`, Detail `/veranstaltung/<slug>-<ID>-<n>` | Titel, Datum/Uhrzeit, Stadt, Ort | robots veranstaltungen-im-norden.de leer erlaubt; der-norden.de robots 404; Nutzungsbedingungen nicht gelesen | niedrig bis mittel (Bremerhaven/Cuxhaven-Raum, Verlagsumfeld) |
| wintopevents | kein Beispiel-Link in der JSON | nicht geprüft | | | nicht belegt |

**Dorffest-Belege:**
* kalender.digital: „Belzenickelmarkt“ Bobenheim am Berg, 28./29.11.2026 (id 2162423513), „Weihnachtsliederblasen am Dorfbrunnen“ 24.12.2026.
* freizeitkalender.eu: „Kirmestanz in Thierbach“, Festgelände Thierbach, 31.10.2026 https://www.freizeitkalender.eu/out/show/filter/46/id/3719558/
* TIMM Oettingen: „Kirchweih Bauwagen“ 20./21.11.2026, „Weihnachtsmarkt FFW“ 28.11. und 05.12.2026, „Weinfest Schnupferclub“ 14.11.2026.
* Dahoam in Niederbayern: „150 jähriges Gründungsfest der Freiwilligen Feuerwehr Exing“, Festplatz, 18. bis 20.06.2027 https://eichendorf.dahoam-in-niederbayern.de/veranstaltungen/150jaehriges-gruendungsfest-der-freiwilligen-feuer-195815/
* ILE Lech-Wertach: „Adventsmarkt“ Igling 27./28.11.2026 https://veranstaltungen-lech-wertach.de/igling/adventsmarkt/
* infomax Altefähr, Veranstaltungen im Norden: nicht belegt (Titel per AJAX bzw. nur Startseite gelesen).

**Bewertung gesamt:** niedrig bis mittel; keine dieser Quellen deckt mehr als einen
Kreis ab. Lohnend wären freizeitkalender.eu (ganzer Vogtlandkreis, Lizenz je Event)
und infomax/TMV (Land MV), beide über den Betreiber.

**Nächster Schritt:** freizeitkalender.eu: Landratsamt Vogtlandkreis nach dem
defekten RSS und nach Weiterverwendung (CC BY-ND) fragen; TMV/infomax gemeinsam mit
der MV-Frage aus fn28-7 klären; Rest nur, wenn die Zählung je Kreis eine Lücke zeigt.

### Abweichungen von den Regeln

* Die Gemeindeseiten bobenheim.de, sydower-fliess.de, stadt-pausa-muehltroff.de,
  altefaehr.de, vg-oettingen.de und markt-eichendorf.de wurden je einmal abgerufen,
  ohne vorher deren robots.txt zu lesen (die robots.txt der eingebetteten Anbieter
  wurde jeweils vorher gelesen).
* Browser-Seitenaufrufe (5) laden alle Ressourcen der Seite; sie sind je als ein
  Seitenaufruf vermerkt, nicht je Ressource.
* `www.rce-event.de` und `output.php` wurden wegen `Disallow: /` nicht abgefragt; nur
  robots.txt (1 Anfrage).

### Anfragenliste

Uhrzeit lokal (27./28.10.2026). Status ist HTTP-Code aus curl.

| Zeit | Host | Status | URL |
|---|---|---|---|
| 20:25:26 | www.amt-rantzau.de | 200 | https://www.amt-rantzau.de/robots.txt |
| 20:25:27 | www.seester.de | 200 | http://www.seester.de/robots.txt |
| 20:25:27 | www.gemeinden-lunden-lehe-krempel.de | 200 | https://www.gemeinden-lunden-lehe-krempel.de/robots.txt |
| 20:25:37 | www.amt-rantzau.de | 200 | https://www.amt-rantzau.de/veranstaltungen/index.php |
| 20:25:37 | www.seester.de | 200 | http://www.seester.de/veranstaltungen/index.php |
| 20:26:23 | www.seester.de | 200 | http://www.seester.de/js/min/portal.min.js?v=1791272365&c=veranstaltungen&lang=de_ |
| 20:26:34 | www.seester.de | 200 | http://www.seester.de/event/event/ajaxlist/year/2027/month/10/day/28/kategorie/0/region/0/ort/0/distanz/0/mandat/0/vorschau/0/mandatview/0/ |
| 20:26:48 | www.gemeinden-lunden-lehe-krempel.de | 200 | https://www.gemeinden-lunden-lehe-krempel.de/veranstaltungen/index.php |
| 20:27:11 | www.seester.de | 200 | http://www.seester.de/veranstaltungen/2963017/2027/02/27/feuerwehrball.html |
| 20:27:23 | rhede-ems.de | 200 | https://rhede-ems.de/robots.txt |
| 20:27:24 | www.geeste.de | 200 | https://www.geeste.de/robots.txt |
| 20:27:25 | www.selsingen.de | 200 | https://www.selsingen.de/robots.txt |
| 20:27:26 | www.wilhelmshaven.de | 200 | https://www.wilhelmshaven.de/robots.txt |
| 20:27:35 | rhede-ems.de | 200 | https://rhede-ems.de/veranstaltungen/ |
| 20:27:36 | www.geeste.de | 200 | https://www.geeste.de/tourismus-freizeit-und-kultur/kulturelle-veranstaltungen |
| 20:27:38 | www.selsingen.de | 200 | https://www.selsingen.de/rathaus/veranstaltungskalender |
| 20:27:38 | www.wilhelmshaven.de | 200 | https://www.wilhelmshaven.de/Kultur/Veranstaltungen/ |
| 20:27:52 | www.amelinghausen.de | 200 | https://www.amelinghausen.de/robots.txt |
| 20:27:54 | www.ostseefjordschlei.de | 200 | https://www.ostseefjordschlei.de/robots.txt |
| 20:27:55 | www.amelinghausen.de | 200 | https://www.amelinghausen.de/infos-service/veranstaltungen |
| 20:27:57 | www.ostseefjordschlei.de | 200 | https://www.ostseefjordschlei.de/erlebniswelten/veranstaltungen |
| 20:29:09 | meta.et4.de | 404 | https://meta.et4.de/robots.txt |
| 20:29:20 | meta.et4.de | 200 | https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=1&q=city%3A%22Rhede%22 |
| 20:29:24 | meta.et4.de | 200 | https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=1&q=city%3A%22Geeste%22 |
| 20:29:28 | meta.et4.de | 200 | https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=1&q=city%3A%22Wilhelmshaven%22 |
| 20:29:32 | meta.et4.de | 200 | https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=1&q=city%3A%22Selsingen%22 |
| 20:29:35 | meta.et4.de | 200 | https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=1&q=city%3A%22Amelinghausen%22 |
| 20:30:06 | meta.et4.de | 200 | https://meta.et4.de/rest.ashx/search/?experience=rhede-ems&type=Event&template=ET2014A.json&limit=3 |
| 20:30:09 | meta.et4.de | 200 | https://meta.et4.de/rest.ashx/search/?experience=geeste&type=Event&template=ET2014A.json&limit=3 |
| 20:30:13 | meta.et4.de | 200 | https://meta.et4.de/rest.ashx/search/?experience=wilhelmshaven-touristik&type=Event&template=ET2014A.json&limit=3 |
| 17:16:23 | meta.et4.de | 200 | https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=1&q=city%3A%22Rhede%20%28Ems%29%22 |
| 17:17:39 | www.vg-nahe-glan.de | 404 | https://www.vg-nahe-glan.de/robots.txt |
| 17:17:40 | www.herborn.de | 404 | https://www.herborn.de/robots.txt |
| 17:17:43 | www.dillenburg.de | 200 | https://www.dillenburg.de/robots.txt |
| 17:17:44 | www.zellerland.de | 200 | https://www.zellerland.de/robots.txt |
| 17:17:53 | www.vg-nahe-glan.de | 200 | https://www.vg-nahe-glan.de/leben-freizeit/veranstaltungskalender/ |
| 17:17:54 | www.herborn.de | 200 | https://www.herborn.de/leben/freizeit/veranstaltungsverzeichnis/ |
| 17:17:56 | www.dillenburg.de | 200 | https://www.dillenburg.de/veranstaltungen/ |
| 17:17:57 | www.zellerland.de | 200 | https://www.zellerland.de/wein-kulinarik/events/veranstaltungen |
| 17:18:28 | resc.deskline.net | 404 | https://resc.deskline.net/robots.txt |
| 17:18:29 | webapi.deskline.net | 400 | https://webapi.deskline.net/robots.txt |
| 17:18:29 | resc.deskline.net | 200 | https://resc.deskline.net/DW5/start/SOBERNHEIM/e288e5bb-4d15-45aa-b13f-b33ffd3240fa/index.js |
| 17:18:38 | resc.deskline.net | 200 | https://resc.deskline.net/DW5/start/DILLENBURG/79af6373-c19f-415c-b761-315d1e79e5e0/index.js |
| 17:18:39 | resc.deskline.net | 200 | https://resc.deskline.net/DW5/start/ZELL/f9f5f635-0c82-4d43-a1c0-d7afbb196cf9/index.js |
| 17:18:53 | webapi.deskline.net | 400 | https://webapi.deskline.net/sobernheim/de/events?fields=id,name,date,location%7Bplace,town%7D&sortingFields=date&pageNo=0&pageSize=400 |
| 17:18:56 | webapi.deskline.net | 200 | https://webapi.deskline.net/dillenburg/de/events?fields=id,name,date,location%7Bplace,town%7D&sortingFields=date&pageNo=0&pageSize=400 |
| 17:18:59 | webapi.deskline.net | 400 | https://webapi.deskline.net/zell/de/events?fields=id,name,date,location%7Bplace,town%7D&sortingFields=date&pageNo=0&pageSize=400 |
| 17:19:23 | www.ferienregion-nahe-glan.de | 404 | https://www.ferienregion-nahe-glan.de/robots.txt |
| 17:19:24 | www.ferienregion-nahe-glan.de | 200 | https://www.ferienregion-nahe-glan.de/cms/cache/sub_deskline.js |
| 17:20:03 | resc.deskline.net | 200 | https://resc.deskline.net/DW5/tags/zell/f9f5f635-0c82-4d43-a1c0-d7afbb196cf9/tagcontext.js |
| 17:20:16 | webapi.deskline.net | 200 | https://webapi.deskline.net/naheglan/de/events?fields=id,name,dbCode,date,location%7Bplace,town,coordinate%7Blat,long%7D%7D&sortingFields=date&pageNo=0&pageSize=400 |
| 17:20:18 | webapi.deskline.net | 200 | https://webapi.deskline.net/rptzell/de/events?fields=id,name,dbCode,date,location%7Bplace,town,coordinate%7Blat,long%7D%7D&sortingFields=date&pageNo=0&pageSize=400 |
| 17:20:43 | Browser-Pane | Seitenaufruf | Page load https://www.vg-nahe-glan.de/leben-freizeit/veranstaltungskalender/ (Weiterleitung auf ferienregion-nahe-glan.de/de/events/, Widget lädt webapi.deskline.net/naheglan/... selbst) |
| 17:20:44 | www.amt-breitenfelde.de | 200 | https://www.amt-breitenfelde.de/robots.txt |
| 17:20:44 | www.lensahn.de | 200 | https://www.lensahn.de/robots.txt |
| 17:20:45 | www.amt-schlei-ostsee.de | 200 | https://www.amt-schlei-ostsee.de/robots.txt |
| 17:20:46 | www.amt-breitenfelde.de | 200 | https://www.amt-breitenfelde.de/veranstaltungskalender |
| 17:20:47 | www.lensahn.de | 200 | https://www.lensahn.de/aktuelles/veranstaltungskalender |
| 17:20:48 | www.amt-schlei-ostsee.de | 200 | https://www.amt-schlei-ostsee.de/service/terminkalender/ |
| 17:21:25 | www.termine-regional.de | 200 | https://www.termine-regional.de/robots.txt |
| 17:21:43 | www.termine-regional.de | 200 | https://www.termine-regional.de/startseite |
| 17:21:54 | www.termine-regional.de | 200 | https://www.termine-regional.de/kunden/nutzungsrechte |
| 17:21:55 | www.termine-regional.de | 200 | https://www.termine-regional.de/veranstaltungen |
| 17:22:22 | www.termine-regional.de | 200 | https://www.termine-regional.de/veranstaltungen/details/ansicht/wochenmarkt-parchim-7539847 |
| 17:22:23 | www.amt-schlei-ostsee.de | 200 | https://www.amt-schlei-ostsee.de/service/terminkalender/liste/site/2/ |
| 17:22:24 | www.amt-schlei-ostsee.de | 200 | https://www.amt-schlei-ostsee.de/service/terminkalender/liste/site/3/ |
| 17:22:43 | www.amt-huettener-berge.de | 200 | https://www.amt-huettener-berge.de/robots.txt |
| 17:22:45 | www.amt-huettener-berge.de | 200 | https://www.amt-huettener-berge.de/das-amt/termine |
| 17:23:09 | www.amt-huettener-berge.de | 200 | https://www.amt-huettener-berge.de/das-amt/termine/liste/5?cHash=59fc1bee47ccb6046ab79997f2899e69 |
| 17:23:30 | www.lensahn.de | 200 | https://www.lensahn.de/aktuelles/veranstaltungskalender/liste/3?cHash=aa53d8183acec800e73517b5108614d4 |
| 17:24:01 | www.termine-regional.de | 404 | https://www.termine-regional.de/veranstaltungen?tx_nwsregionalevents_pi1%5Bsearch%5D=Weihnachtsmarkt&tx_nwsregionalevents_pi1%5BmonthYear%5D=12_2026 |
| 17:24:20 | www.pleiskirchen.de | 200 | https://www.pleiskirchen.de/robots.txt |
| 17:24:20 | www.edelsfeld.de | 404 | https://www.edelsfeld.de/robots.txt |
| 17:24:22 | www.markt-haag.de | 404 | https://www.markt-haag.de/robots.txt |
| 17:24:24 | www.rce-event.de | 200 | https://www.rce-event.de/robots.txt |
| 17:24:25 | www.pleiskirchen.de | 200 | https://www.pleiskirchen.de/veranstaltungskalender/ |
| 17:24:27 | www.edelsfeld.de | 200 | https://www.edelsfeld.de/freizeit-tourismus-kultur/veranstaltungen/ |
| 17:24:28 | www.markt-haag.de | 200 | https://www.markt-haag.de/leben-wohnen/veranstaltungen/ |
| 17:25:22 | www.veranstaltungen-oberbayern.de | 200 | http://www.veranstaltungen-oberbayern.de/robots.txt |
| 17:25:22 | www.veranstaltungen-oberbayern.de | 200 | http://www.veranstaltungen-oberbayern.de/ |
| 17:26:06 | plugins.svn.wordpress.org | 200 | https://plugins.svn.wordpress.org/rce-event/trunk/ |
| 17:26:18 | plugins.svn.wordpress.org | 200 | https://plugins.svn.wordpress.org/rce-event/trunk/shortcode.php |
| 17:26:19 | plugins.svn.wordpress.org | 200 | https://plugins.svn.wordpress.org/rce-event/trunk/readme.txt |
| 17:26:33 | plugins.svn.wordpress.org | 200 | https://plugins.svn.wordpress.org/rce-event/trunk/helper_functions/ |
| 17:26:46 | plugins.svn.wordpress.org | 200 | https://plugins.svn.wordpress.org/rce-event/trunk/helper_functions/get_events_from_rce.php |
| 17:26:47 | plugins.svn.wordpress.org | 200 | https://plugins.svn.wordpress.org/rce-event/trunk/helper_functions/get_events_by_zip_from_rce.php |
| 17:27:03 | www.perasdorf.de | 200 | https://www.perasdorf.de/robots.txt |
| 17:27:04 | www.sinntal.de | 200 | https://www.sinntal.de/robots.txt |
| 17:27:05 | www.chamerau.de | 200 | https://www.chamerau.de/robots.txt |
| 17:27:06 | www.perasdorf.de | 200 | https://www.perasdorf.de/freizeiterholung/veranstaltungen/index.html |
| 17:27:07 | www.sinntal.de | 200 | https://www.sinntal.de/freizeittourismus/veranstaltungen |
| 17:27:08 | www.chamerau.de | 200 | https://www.chamerau.de/aktuelles/veranstaltungen/index.html |
| 17:28:18 | www.chamerau.de | 200 | https://www.chamerau.de/aktuelles/veranstaltungen/index.html?ev%5Bid%5D=178 |
| 17:28:31 | www.badbirnbach.de | 200 | https://www.badbirnbach.de/robots.txt |
| 17:28:32 | www.neuenstein.net | 404 | https://www.neuenstein.net/robots.txt |
| 17:28:34 | fuerstenstein.de | 200 | https://fuerstenstein.de/robots.txt |
| 17:28:35 | widget.toubiz.de | 404 | https://widget.toubiz.de/robots.txt |
| 17:28:36 | www.badbirnbach.de | 200 | https://www.badbirnbach.de/media/events |
| 17:28:37 | www.neuenstein.net | 200 | https://www.neuenstein.net/veranstaltungen.html |
| 17:28:38 | fuerstenstein.de | 200 | https://fuerstenstein.de/veranstaltungen |
| 17:29:00 | mein.toubiz.de | 200 | https://mein.toubiz.de/robots.txt |
| 17:30:36 | Browser-Pane | Seitenaufruf | Page load https://www.neuenstein.net/veranstaltungen.html (toubiz-Widget ruft mein.toubiz.de/api/v1/eventDates selbst) |
| 17:30:37 | Browser-Pane | Seitenaufruf | Page load https://fuerstenstein.de/veranstaltungen (toubiz-Widget, mein.toubiz.de/api/v1/element/events + eventDates) |
| 17:30:37 | www.strahlungen.de | 200 | https://www.strahlungen.de/robots.txt |
| 17:30:39 | www.burglauer.de | 404 | https://www.burglauer.de/robots.txt |
| 17:30:40 | snippets.lkrg.net | 404 | https://snippets.lkrg.net/robots.txt |
| 17:30:41 | www.strahlungen.de | 200 | https://www.strahlungen.de/veranstaltungen |
| 17:30:43 | www.burglauer.de | 200 | https://www.burglauer.de/veranstaltungen |
| 17:31:06 | snippets.lkrg.net | 200 | https://snippets.lkrg.net/tgecsfoh08apr22/general_event_calendar_sqr/snippet.js |
| 17:32:15 | Browser-Pane | Seitenaufruf | Page load https://www.strahlungen.de/veranstaltungen (Snippet POST an aht1gh-api.sqronline.de/api/modules/events/getevents-post) |
| 17:32:16 | snippets.lkrg.net | 200 | https://snippets.lkrg.net/tgecsfoh08apr22/general_event_calendar_sqr/js/app.dab64e19.js |
| 17:32:35 | aht1gh-api.sqronline.de | 200 | https://aht1gh-api.sqronline.de/robots.txt |
| 17:32:35 | aht1gh-api.sqronline.de | 200 | https://aht1gh-api.sqronline.de/api/modules/events/getevents?module_division_uuid=a7c17d68-d5c8-4110-aabe-d201b09d451e |
| 17:32:53 | aht1gh-api.sqronline.de | 200 | https://aht1gh-api.sqronline.de/api/modules/events/getevents?module_division_uuid=2a1d707f-0eb5-48e8-af42-b464aa53b2e7 |
| 17:33:21 | www.bobenheim.de | 200 | http://www.bobenheim.de/content/termine.html |
| 17:33:22 | www.sydower-fliess.de | 200 | https://www.sydower-fliess.de/veranstaltungen/ |
| 17:33:23 | www.stadt-pausa-muehltroff.de | 200 | https://www.stadt-pausa-muehltroff.de/veranstaltungskalender/ |
| 17:33:24 | www.altefaehr.de | 200 | https://www.altefaehr.de/veranstaltungen |
| 17:33:24 | www.vg-oettingen.de | 200 | https://www.vg-oettingen.de/wir-stellen-uns-vor/ueber-uns/veranstaltungskalender |
| 17:33:25 | markt-eichendorf.de | 200 | https://markt-eichendorf.de/index.php/vkalender |
| 17:33:37 | kalender.digital | 200 | https://kalender.digital/robots.txt |
| 17:33:37 | www.freizeitkalender.eu | 200 | https://www.freizeitkalender.eu/robots.txt |
| 17:33:38 | tmvwhl.infomaxnet.de | 200 | https://tmvwhl.infomaxnet.de/robots.txt |
| 17:33:38 | kalender.verwaltungsgemeinschaft-oettingen.de | 404 | https://kalender.verwaltungsgemeinschaft-oettingen.de/robots.txt |
| 17:33:39 | eichendorf.dahoam-in-niederbayern.de | 200 | https://eichendorf.dahoam-in-niederbayern.de/robots.txt |
| 17:33:49 | kalender.digital | 200 | https://kalender.digital/789e56ae861e12df5988?iframe=true |
| 17:34:19 | Browser-Pane | Seitenaufruf | Page load https://kalender.digital/789e56ae861e12df5988?iframe=true (ruft api.kalender.digital/calendar und /event) |
| 17:34:20 | api.kalender.digital | 200 | https://api.kalender.digital/robots.txt |
| 17:34:20 | api.kalender.digital | 200 | https://api.kalender.digital/event?timeZone=Europe/Berlin&startDate=2026-10-28%2000%3A00%3A00&endDate=2027-10-28%2000%3A00%3A00&capabilityId=789e56ae861e12df5988 |
| 17:34:45 | www.freizeitkalender.eu | 200 | https://www.freizeitkalender.eu/out/list/filter/46 |
| 17:35:03 | www.freizeitkalender.eu | 500 | https://www.freizeitkalender.eu/out/feed |
| 17:35:12 | www.freizeitkalender.eu | 500 | https://www.freizeitkalender.eu/out/feed/filter/46 |
| 17:35:23 | www.freizeitkalender.eu | 200 | https://www.freizeitkalender.eu/out/show/filter/46/id/3672196/ |
| 17:35:34 | www.freizeitkalender.eu | 200 | https://www.freizeitkalender.eu/ |
| 17:35:45 | www.freizeitkalender.eu | 200 | https://www.freizeitkalender.eu/nutzungsbedingungen |
| 17:36:02 | tmvwhl.infomaxnet.de | 200 | https://tmvwhl.infomaxnet.de/seebad-altefaehr-de/?widgetToken=QZlGDzoJ5QM. |
| 17:36:28 | kalender.verwaltungsgemeinschaft-oettingen.de | 200 | https://kalender.verwaltungsgemeinschaft-oettingen.de/ |
| 17:36:37 | kalender.verwaltungsgemeinschaft-oettingen.de | 200 | https://kalender.verwaltungsgemeinschaft-oettingen.de/kalenderscript.js |
| 17:36:46 | kalender.verwaltungsgemeinschaft-oettingen.de | 200 | https://kalender.verwaltungsgemeinschaft-oettingen.de/kalender.php?aktuelleevents=100&jahr=2026 |
| 17:37:08 | eichendorf.dahoam-in-niederbayern.de | 200 | https://eichendorf.dahoam-in-niederbayern.de/code/iframe?gemkal=58 |
| 17:37:40 | www.veranstaltungen-lech-wertach.de | 200 | https://www.veranstaltungen-lech-wertach.de/robots.txt |
| 17:37:42 | www.veranstaltungen-lech-wertach.de | 200 | https://www.veranstaltungen-lech-wertach.de/ |
| 17:37:43 | www.veranstaltungen-im-norden.de | 200 | https://www.veranstaltungen-im-norden.de/robots.txt |
| 17:37:44 | www.veranstaltungen-im-norden.de | 200 | https://www.veranstaltungen-im-norden.de/ |
| 17:38:03 | veranstaltungen-lech-wertach.de | 200 | https://veranstaltungen-lech-wertach.de/wp-json/ |
| 17:38:15 | veranstaltungen-lech-wertach.de | 200 | https://veranstaltungen-lech-wertach.de/wp-json/wp/v2/igling?per_page=100 |
| 17:38:27 | www.veranstaltungen-im-norden.de | 200 | https://www.veranstaltungen-im-norden.de/impress |
| 17:38:28 | www.der-norden.de | 404 | https://www.der-norden.de/robots.txt |
| 17:38:28 | www.der-norden.de | 200 | https://www.der-norden.de/ |

