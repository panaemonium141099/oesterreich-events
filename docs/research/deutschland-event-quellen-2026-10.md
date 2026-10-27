# Event-Datenquellen Deutschland über APIs, Feeds und Open Data (Stand 2026-10-27)

Recherche für lasstreffen.de auf demselben Backend (Spalte `events.country`,
`src/lib/site-country.ts`). Ziel: möglichst wenige Scraper, höchste Datenqualität,
Quellen über Schlüssel, Feeds und offene Schnittstellen. Gesucht wurden besonders
Schnittstellen in der Art von Feratel Deskline für Österreich.

Arbeitsweise: nur lesend. Keine Konten, keine Formulare, keine Mails. Offene
Endpunkte wurden mit wenigen GET-Anfragen am 27.10.2026 abgerufen; jede Zahl unten
stammt aus einer solchen Antwort oder aus einer verlinkten Doku-Seite. Was sich nicht
belegen ließ, steht ausdrücklich als „nicht belegt“ da. Die ausführlichen Rohbefunde
(alle Anfrage-URLs, Feldlisten, Stichproben) liegen in den Session-Notizen; die für
Entscheidungen nötigen Teile sind hier übernommen.

## Kurzfazit

1. **Ein offener Zugang deckt den Großteil der Fläche ab:** destination.one mit der
   Experience `open-data` liefert ohne Key **34.984 Events im Fenster 27.10.2026 bis
   27.10.2027**, alle Datensätze in der Stichprobe CC0, Bilder einzeln lizenziert,
   Zeiten mit Offset und `tz: Europe/Berlin`, Koordinaten. Stark in Rheinland-Pfalz,
   NRW, Niedersachsen, Bayern, Hessen, Schleswig-Holstein, Sachsen. Damit ist das die
   erste Integration für lasstreffen.de.
2. **Der DZT Knowledge Graph ist die zweite Landesdaten-Integration:** alle 16
   Landestourismusorganisationen sind Partner, kostenlos, CC0/CC BY/CC BY-SA mit
   ausdrücklich erlaubter kommerzieller Nutzung. Er schließt voraussichtlich die
   Lücken von destination.one (Baden-Württemberg, Thüringen, Sachsen); wie viele
   Events dort liegen, ist ohne Key nicht belegt. Key beantragen.
3. **Großstädte kommen über Ticketing, nicht über die Städte:** Keine Metropole
   (Berlin, Hamburg, München, Frankfurt, Düsseldorf, Leipzig, Dresden, Hannover,
   Bremen) hat einen offenen städtischen Veranstaltungskalender mit Termindaten.
   Berlin, Hamburg und Mecklenburg-Vorpommern sind auch bei destination.one fast leer.
   Dort tragen Eventim, Eventfrog (in Arbeit), Ticketmaster und Reservix.
4. **Eventim ist im Haus, aber mit dem falschen Shop:** Der PFT-Feed liefert schon
   8.214 kommende DE-Events in unsere DB, ihre Ticketlinks zeigen aber alle auf
   oeticket.com. Für lasstreffen.de braucht es Links auf eventim.de mit eigener
   Provision.
5. **Die großen Zusatzvolumen hängen an Lizenzfragen:** Evangelische Termine (fünf
   Landeskirchen, ELKB allein 125.172 Einträge) und kulturdaten.berlin (12.594
   kommende Berliner Termine) sind offen abrufbar, aber ohne belegte Datenlizenz.

Empfohlene Reihenfolge der Integrationen: destination.one, DZT-Graph, Eventim auf
eventim.de umstellen, Eventfrog (läuft), Ticketmaster, Reservix. Danach nur noch
gezielt nach gemessener Lücke.

## Priorisierte Liste

Bewertet nach Datenqualität vor Menge, dann nach Fläche je Integration.

| # | Quelle | Zugang | Lizenz | Abdeckung (belegt) | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | destination.one `open-data` | offen, ohne Key | Datensatz CC0 (Stichprobe), Bilder CC0/CC BY/CC BY-SA | 34.984 Events in 12 Monaten, 13 Länder nennenswert | Nutzungsbedingungen klären, Dry-Run-Import |
| 2 | DZT Open Data Knowledge Graph | Key kostenlos, auf Antrag | CC0, CC BY, CC BY-SA, kommerziell erlaubt | alle 16 Länder als Partner, Event-Zahl nicht belegt | Key beantragen, SPARQL-COUNT je Land |
| 3 | Eventim PFT-Feed (im Haus) | Partnervertrag besteht | Vertrag | 8.214 kommende DE-Events in unserer DB | eventim.de-Deeplinks mit Provision klären |
| 4 | Eventfrog Public API | Bearer-Token | nicht hier geprüft | Filter `country=DE` | wird in anderer Session gebaut |
| 5 | Ticketmaster Discovery API | Key per Selbstregistrierung, kostenlos | Terms mit Erlös-Klausel | DE unterstützt, Zahl nicht belegt | Key holen, DE zählen, Erlös-Klausel klären |
| 6 | Reservix / ADticket | Partnervertrag | nicht belegt | Eigenangabe über 90.000 Veranstaltungen | API-Zugang bei affiliate@reservix.de anfragen |
| 7 | BayernCloud Tourismus | Selbstregistrierung, Freischaltung nach Ermessen | CC0, CC BY, CC BY-SA, DL-DE | Bayern, Zahl nicht belegt | nur wenn Bayern über 1/2 dünn bleibt |
| 8 | Evangelische Termine (5 Landeskirchen) | offen, ohne Key | nicht belegt | ELKB 125.172 Einträge, davon wenige publikumsrelevant | Nutzungserlaubnis anfragen |
| 9 | kulturdaten.berlin API v2 | offen, ohne Key | Daten nicht belegt | 12.594 kommende Berliner Bezirkstermine | Lizenz und Weiterbetrieb anfragen |
| 10 | Veranstaltungskalender Nürnberg (VK) | Open-Data-Teil offen, Rest Partnerzugang | nicht belegt | 3.942 Termine ab heute | Partnerzugang und Lizenz anfragen |
| 11 | rlpDirekt, Neuss, Köln | offen | dl-zero-de/2.0, CC BY 4.0, dl-zero-de/2.0 | 577 / 2.161 / 46 kommende | nur falls nach 1 und 2 eine Lücke bleibt |
| 12 | Feratel Deskline, deutsche Linkkeys | wie Österreich | nicht belegt | Mosel 1.929 Events | nur Ergänzung Rheinland-Pfalz |

## 1. destination.one, Experience `open-data`

**Zugang, Kosten.** Ohne Key lesbar. Anfrage:
`https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=1`
liefert `"status":"OK"`, `"overallcount":55629` (eigene Anfrage, 27.10.2026). Die
Experience steckt im öffentlichen Widget des Open Data Finders
(https://open.destination.one/open-data-finder/, dort: „Die Nutzung ist gratis“).
Laut Doku ist ein `licensekey` nur „für nicht öffentliche Projekte“ nötig
(https://help.destination.one/portal/de/kb/articles/meta-service-search). Der Finder
verlangt vor dem Abruf Kontaktdaten und erzeugt dann einen Zugang; ob ein
kommerzieller Abnehmer diesen Weg gehen muss, ist nicht belegt. Leipzig verweist für
dieselben Daten auf open.destination.one mit Pflichthinweis „powered by
open.destination.one“ (Open-Data-Portal Leipzig, „Travel-API Leipzig“).

**Lizenz, Pflichten.** Lizenz pro Datensatz in `attributes` (`license`,
`licenseurl`) und pro Bild in `media_objects[].license` mit `author` und `source`.
Eigene Stichprobe: 500 Events (Fenster 12 Monate, `offset=5000`): Datensatz-Lizenz
500 × `CC0`; Bilder 661 × `CC-BY`, 98 × `CC0`, 1 × `CC-BY-SA`. Bei CC BY und CC BY-SA
muss der Urheber am Bild stehen, CC BY-SA zusätzlich unter gleicher Lizenz. Die AGB
des Betreibers (https://www.hubermedia.de/agb/) sind noch nicht gelesen.

**Abdeckung.** Zählung je Land über `q=area:"<Land>"`, alle Termine, 27.10.2026:

| Land | Events | Land | Events |
|---|---|---|---|
| Rheinland-Pfalz | 14.275 | Brandenburg | 1.031 |
| Nordrhein-Westfalen | 9.426 | Sachsen-Anhalt | 725 |
| Niedersachsen | 9.332 | Baden-Württemberg | 539 |
| Bayern | 9.128 | Saarland | 452 |
| Hessen | 5.249 | Thüringen | 386 |
| Schleswig-Holstein | 2.982 | Bremen | 199 |
| Sachsen | 2.189 | Mecklenburg-Vorpommern | 8 |
| | | Hamburg | 5 |
| | | Berlin | 1 |

Die Länderwerte überlappen leicht (Summe 55.927 gegen 55.629 gesamt). Im Fenster
27.10.2026 bis 27.10.2027 sind es 34.984, bis 27.10.2028 sind es 35.379.

**Felder (echte Antwort).** `id`, `global_id`, `title`, `texts[]` (`rel` `details`,
`teaser`, `PRICE_INFO`, je HTML und Text), `timeIntervals[]` (`start`, `end` mit
Offset, `tz: Europe/Berlin`, `weekdays`), `occurrences`, `geo.main.latitude/longitude`,
`street`, `zip`, `city`, `areas`, `categories`, `keywords`, `media_objects[]` (Bilder
mit `url`, `license`, `author`; Links mit `rel` `canonical`, `venuewebsite`,
`booking`), `attributes[]`, `source`, `created`, `changed`. Beispiel: „HAMMENACHT
2027“, Worpswede 27726, Start `2027-08-21T17:00:00+02:00`.

Zu beachten beim Import:
* Preis gibt es nur als Freitext `PRICE_INFO`, in der 500er-Stichprobe bei 2 Events;
  einen Ticketlink (`rel: booking`) hatte dort keines.
* Termine stehen oft als Wiederholungsregel: in der Stichprobe begannen
  `timeIntervals` teils 2024 oder 2025 und gelten bis ins Fenster. Die konkreten
  Termine müssen aus Regel und `weekdays` (oder `occurrences`) entfaltet werden.
* Jedes Event der Stichprobe hatte ein Bild.

**Aktualisierung.** Filter `startdate`/`enddate`, `limit`/`offset`, Umkreis und
Bounding Box (Doku oben). `changed` steht im Datensatz, ein Filter „geändert seit“ ist
nicht belegt, Rate-Limits nicht belegt. `limit=0` liefert einen Serverfehler.

**Nächster Schritt.** Bei destination.one (support@destination.one) schriftlich
klären, ob ein kommerzielles Portal die Experience `open-data` ohne eigenen
Lizenzschlüssel nutzen darf, ob „powered by open.destination.one“ Pflicht ist, und
die hubermedia-AGB lesen. Parallel ein Dry-Run-Importer: Datumsfenster, Lizenzfilter
(nur CC0, CC BY, CC BY-SA, PD), Bilder einzeln nach `license`, Wiederholungen
entfalten, Ort über den bestehenden Resolver.

## 2. DZT Open Data Knowledge Graph (open-data-germany.org)

**Zugang, Kosten.** API-Key nötig; ohne Key antwortet
`https://proxy.opendatagermany.io/api/ts/v2/kg/things?kw=Weihnachtsmarkt` mit 401.
Antrag über https://open-data-germany.org/zugang-anfordern/ (Organisationstyp u. a.
„Unternehmen und Tech-Dienstleister“) oder open-data@germany.travel
(https://changelog-dzt-kg.readme.io/docs/authentication). AGB § 1 Nr. 2: „Die Nutzung
des DZT Knowledge Graph ist kostenfrei.“; die DZT kann Registrierungen ablehnen
(https://open-data-germany.org/wp-content/uploads/2026/03/2026-03-AGB-Datennutzer-Knowledge-Graph_DZT.pdf).

**Lizenz, Pflichten.** AGB § 3: CC BY-SA, CC BY oder CC0, kommerzielle Nutzung
erlaubt, `copyrightNotice` ist unbedingt zu beachten. Lizenz pro Objekt und Bild,
Bilder ohne Lizenz sind `unknown`
(https://changelog-dzt-kg.readme.io/docs/211-licensing). Eine Indexierungssperre steht
nicht in den AGB.

**Abdeckung.** Partner sind die 16 Landestourismusorganisationen
(https://open-data-germany.org/). Event-Zahl und welche Länder Events tatsächlich
einspielen: nicht belegt. Hinweise: Baden-Württemberg (mein.toubiz) gibt
CC-Einträge automatisch in den Graph (TMBW-Forum Mai 2026), Sachsen liefert seit Start
(TMGS-Pressemitteilung 28.06.2023).

**Felder.** schema.org JSON-LD, Event-Domain-Specification
https://semantify.it/ds/mhpmBCJJt mit Offers; Einzel-Event, `EventSeries` und
`eventSchedule`. Die Doku-Beispiele haben `startDate` ohne Offset, die Zeitzone ist
also je Lieferant zu prüfen
(https://changelog-dzt-kg.readme.io/docs/27-schemaevent-and-schemaschedule).

**Aktualisierung.** 10/s, 100/min, 1.000/h, 10.000/Tag je Key
(https://changelog-dzt-kg.readme.io/docs/rate-limits). Vollabzug daher über
SPARQL CONSTRUCT oder Data Packages (ZIP mit JSON-LD), nicht über Einzelabrufe.
Delta-Endpunkt nicht dokumentiert.

**Nächster Schritt.** Key beantragen (durch den User). Danach als Erstes SPARQL-COUNT
auf `schema:Event` je Bundesland und künftigem Startdatum, und den Data-Package-Katalog
nach Event-Paketen durchsuchen. Dubletten mit destination.one sind zu erwarten (gleiche
Lieferanten), das deckt der quellenunabhängige Dedup ab.

## 3. Eventim (PFT-Feed, bereits im Haus)

**Befund aus unserer DB (27.10.2026).** Kommende Events mit `source_name = Eventim`:
AT 15.580, DE 8.214, CH 388. Stichprobe der DE-Ticketlinks: alle auf
`https://www.oeticket.com/noapp/event/...?affiliate=J70`, z. B. Liederhalle
Beethovensaal (Stuttgart), Täubchenthal (Leipzig). Der Feed
(`https://pft.eventim.com/serve/214-hemfto`, `src/lib/eventim/feed-client.ts`) ist
also der oeticket-Feed; er enthält DE-Events, die oeticket mitverkauft, nicht
zwingend das ganze eventim.de-Angebot.

**Monetarisierung DE.** Ob J70 Käufe auf eventim.de vergütet: nicht belegt. Belegt
ist das Awin-Programm „eventim DE“ (11388): 20 % der Netto-Vorverkaufsgebühr,
Attributionszeitraum 1 Tag (https://ui.awin.com/merchant-profile/11388).

**Nächster Schritt.** Beim Eventim-Ansprechpartner schriftlich fragen, ob es einen
PFT-Feed für eventim.de gibt (Shop-Domain und Abdeckung) und ob J70-Links auf
eventim.de provisioniert werden; sonst Awin 11388 beantragen. Bis dahin für
lasstreffen.de keine oeticket-Links ausspielen.

## 4. Eventfrog Public API

In Arbeit in einer anderen Session (`api.eventfrog.net/public/v1`, Filter
`country=DE`). Ohne Token antwortet `GET .../events?country=DE&perPage=1` mit 401
„Please provide a bearer token“ (`serviceVersion 1.21.1`). Hier nicht weiter geprüft.

## 5. Ticketmaster Discovery API

**Zugang, Kosten.** Key per Selbstregistrierung, Discovery-API sofort, keine Preise
genannt (https://developer.ticketmaster.com/products-and-docs/apis/getting-started/).
Ohne Key: 401. Die alte International Discovery API nimmt keine neuen Keys mehr an.

**Bedingungen** (https://developer.ticketmaster.com/support/terms-of-use/):
* Event-Inhalte nur „for reasonable periods“ cachen, keine feste Frist.
* Inhalte auf Wunsch des Eigentümers binnen 24 h entfernen; kein Bild-Hosting.
* **Risiko:** Verbot, „derive revenues from the use or provision of the Ticketmaster
  API ... except as set forth below“; eine Ausnahme folgt im Text nicht. Für eine
  Seite mit AdSense und Affiliate vorab schriftlich klären.
* Zur Indexierung sagen die Terms nichts.

**Abdeckung.** `countryCode=DE` steht in der Liste unterstützter Länder (Market 210).
Anzahl DE-Events: nicht belegt (braucht Key).

**Felder.** `name`, `dates.start.localDate`, `dates.start.dateTime` (UTC),
`dates.timezone`, Venue mit `location.latitude/longitude`,
`priceRanges[].min/max/currency`, `url`, `images[]` (mit Maßen),
`classifications[]` (Segment, Genre, Subgenre)
(https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/).

**Aktualisierung.** 5.000 Calls/Tag, 5/s; Paging nur bis Element 1.000, also nach
Datum oder Region aufteilen. Delta-Filter nicht belegt.

**Monetarisierung.** Global Affiliate Program über Impact, Germany gelistet,
Provision nicht öffentlich
(https://developer.ticketmaster.com/partners/distribution-partners/affiliate-sign-up).

**Nächster Schritt.** Key registrieren (durch den User), `countryCode=DE` zählen
(`page.totalElements`), Überschneidung mit Eventim messen; Impact-Bewerbung und
Erlös-Klausel schriftlich klären.

## 6. Reservix / ADticket

**Zugang.** Partnervertrag. Reservix nennt REST, Webhooks, GraphQL und ein Modul
„Sale“ für Event-Daten, Doku nur auf Anfrage
(https://www.reservix.net/ticketing-apis-und-schnittstellen-mit-reichweite/); für
Affiliates ausdrücklich „Integration der Events via API-Schnittstelle“, Kontakt
affiliate@reservix.de (https://www.reservix.net/affiliate-partnerschaft/). Der
Endpunkt `https://api.reservix.de/1/sale/event` existiert (403 „Access denied“).

**Lizenz, Felder, Delta.** Nicht belegt.

**Abdeckung.** Eigenangabe im Awin-Profil: über 90.000 Veranstaltungen.

**Monetarisierung (Awin).** Reservix (31293): 25 % der 10-%-Vorverkaufsgebühr plus
2,5 % vom Warenkorb, Cookie 30 Tage (https://ui.awin.com/merchant-profile/31293).
ADticket (18490): 2,5 % vom Warenkorb, Cookie 30 Tage
(https://ui.awin.com/merchant-profile/18490).

**Nächster Schritt.** Anfrage an affiliate@reservix.de (Felder, Lizenz, Bildrechte,
Delta) und Awin-Bewerbung, beides durch den User. Reservix ist für Kleinkunst und
regionale Veranstalter interessant, die Eventim nicht führt.

## 7. BayernCloud Tourismus (dataCycle)

**Zugang.** Selbstregistrierung unter https://data.bayerncloud.digital/users/sign_up,
auch als „kommerzielles Unternehmen“; AGB: kostenlos (§ 3), Freischaltung im freien
Ermessen der BayTM (§ 17), API jederzeit änderbar (§ 16)
(https://data.bayerncloud.digital/static/terms_and_conditions).

**Lizenz.** Open Content nur unter der Lizenz am Datensatz; zulässig CC0, CC BY,
CC BY-SA, DL-DE/Zero, DL-DE/BY (AGB § 1, § 5).

**Felder, Delta.** dataCycle API v4, JSON-LD, `eventSchedule`; Delta über
`filter[attribute][dc:touched]` und Löschungen über `/api/v4/things/deleted`
(https://data.bayerncloud.digital/docs/api/contents). Das ist die sauberste
Delta-Schnittstelle der Recherche.

**Abdeckung.** Event-Zahl nicht belegt; destination.one hat 9.128 Bayern-Events.

**Nächster Schritt.** Erst nach dem DZT-Key prüfen, ob Bayern dort und bei
destination.one reicht; sonst Registrierung durch den User.

## 8. Evangelische Termine (ELKB, EKiR, EVLKS, EKHN, Oldenburg)

**Zugang.** Eine Kalendersoftware unter mehreren Landeskirchen-Hosts, offener JSON-
und XML-Export ohne Key: `https://<host>/json?...`, `https://<host>/xml?...`
(Parameter: https://handbuch.evangelische-termine.de/anzeige-im-internet/ausgabe-parameter).

**Abdeckung** (`xml?highlight=all&itemsPerPage=1`, `totalItems`): ELKB
(www.evangelische-termine.de) 125.172 (eigene Anfrage), EKiR 35.871, EVLKS 18.213,
EKHN 9.099, Oldenburg 4.180. Der Inhalt ist überwiegend Gottesdienst und
Gemeindeleben; für ein Publikumsportal nur `eventtype` 4 (Konzerte, Theater, Musik,
ELKB 6.419 Treffer), 6 (Ausstellungen) und 7 (Feste).

**Felder.** `START_RFC`/`END_RFC` mit Offset, `_event_TITLE`,
`_event_SHORT_DESCRIPTION`, `_event_LONG_DESCRIPTION`, `_event_EVENTTYPE`,
`_event_LINK`, `_event_IMAGE`, `_event_IMAGE_LICENSE`, `_event_IMAGE_COPYRIGHTS`,
`_event_MODIFIED`, `_place_NAME`, `_place_STREET_NR`, `_place_ZIP`, `_place_CITY`,
`_place_GLAT`, `_place_GLONG`. Koordinaten in Stichproben bei 55 % (EKiR) bis 84 %
(ELKB). Kein Preisfeld. Bildlizenz in 300 Konzerten: 191 leer, 98 „Alle Rechte
vorbehalten“, 9 CC BY.

**Lizenz.** Nicht belegt: https://www.evangelische-termine.de/nutzungsbedingungen
zeigte am 27.10.2026 nur „In Kürze verfügbar“. Bilder ohne offene Lizenz nicht
übernehmen.

**Nächster Schritt.** Schriftliche Nutzungserlaubnis bei Vernetzte Kirche / ELKB
(Impressum) für alle Instanzen anfragen. Erst danach einen Parser.

## 9. kulturdaten.berlin (API v2)

Offen: `https://api-v2.kulturdaten.berlin/api/events?page=1&pageSize=1&startDate=2026-10-28`
liefert `totalCount: 12594` (eigene Anfrage). Inhalt laut Stichprobe von 800 Events
nur Bezirksamtskalender (Bibliotheken, Stadtteilzentren), keine großen Bühnen;
727 von 800 kostenlos. Zeiten als Wandzeit ohne Zone, Koordinaten im Schema
vorhanden, in der Stichprobe fehlend. Code MIT-lizenziert
(https://github.com/technologiestiftung/kulturdaten-api), Datenlizenz nicht belegt;
das Projekt gilt laut https://www.kulturdaten.berlin als abgeschlossen, importiert
aber noch täglich. Nächster Schritt: Lizenz und Weiterbetrieb bei
kontakt@kulturdaten.berlin anfragen (durch den User). Schließt die Berlin-Lücke nur
für Stadtteilangebote.

## 10. Veranstaltungskalender Nürnberg, Fürth, Erlangen, Schwabach

Open-Data-Teil ohne Anmeldung: `https://vk.nuernberg.de/export.php`
(https://meine-veranstaltungen.net/dokus/Exportschnittstelle/voraussetzungen.html),
3.942 Termine ab heute. Ohne Login: Titel, Untertitel, Reihe, Ort, Ticketlink
(`VVKLINK`), Bild mit Copyright, Termine als lokale Zeit ohne Offset. Beschreibung,
Preis, Kategorie und Koordinaten nur mit Partnerzugang über das KunstKulturQuartier.
Lizenz nicht belegt. Nächster Schritt: Partnerzugang und Lizenz anfragen, falls
destination.one und DZT Mittelfranken dünn abdecken.

## 11. Kleine offene Kalender mit klarer Lizenz

| Quelle | Endpunkt | Lizenz | Kommend | Stärken, Lücken |
|---|---|---|---|---|
| rlpDirekt (RLP) | `https://open-rlp.egovernor.de/metaData/event/data` | dl-zero-de/2.0 | 577 von 2.941 | Offset-Zeiten, Regionalschlüssel; ohne Koordinaten, Bild, Kategorie |
| Stadt Neuss | Opendatasoft `stadt-neuss-veranstaltungskalender` | CC BY 4.0 | 2.161 von 7.007 | Kategorie, echtes UTC; Ort nur Freitext, kein Bild |
| Stadt Köln | `https://www.stadt-koeln.de/externe-dienste/open-data/events-od.php` | dl-zero-de/2.0 | 46 (7-Tage-Fenster) | Koordinaten, Preis als Text; nur städtische Termine |
| VHS Bonn | `.../VhsConnect/courseExport/type/xml/f/courses.xml` | CC0 | 452 | meist Kurse, Pfad kein VHS-Standard |
| Karlsruhe | `https://kalender.karlsruhe.de/db/termine/rss` | CC0 | 310 | Offset `+0018` in allen Einträgen kaputt |

Belege und Feldlisten: GovData-Einträge (z. B.
https://www.govdata.de/ckan/api/3/action/package_show?id=liste-der-uber-rlpdirekt-erfassten-veranstaltungen).
Nächster Schritt: keiner vor Schritt 1 und 2. Erst eine gemessene Lücke rechtfertigt
je einen Mini-Importer.

## 12. Feratel Deskline, deutsche Linkkeys

Dieselbe WebAPI wie in Österreich liefert deutsche Linkkeys: `mosel`
(`paging.totalRecordCount: 1929`, Regionen „Mosel“, „Rheinland-Pfalz“) und `neustadt`
(Neustadt an der Weinstraße). `pfalz`, `rlp`, `allgaeu`, `bodensee` gibt es nicht.
Es ist die Backend-Schnittstelle der Deskline-Webclients, keine Open-Data-API; eine
Lizenz für Dritte ist nicht belegt. Rheinland-Pfalz liegt mit 14.275 Events schon
lizenziert bei destination.one. Nächster Schritt: keiner, außer RPT bestätigt einen
landesweiten Linkkey samt Freigabe.

## Auf Anfrage, ohne belegten offenen Zugang

* **ThüCAT (Thüringen):** Einzelressourcen offen als JSON-LD, Bildlizenz z. B.
  CC BY-SA 4.0; Event-Listen nur über einen Sync-Kanal mit Key
  (https://docs.typo3.org/p/werkraummedia/thuecat/main/en-us/Integration/SyncChannel.html).
  Antragsweg nicht belegt. Erst prüfen, ob Thüringen über den DZT-Graph kommt.
* **Brandenburg (TMB):** XML-Schnittstelle der Veranstaltungsdatenbank, Freischaltung
  über contentnetzwerk@reiseland-brandenburg.de; Lizenz nicht belegt.
* **NRW Data Hub, Münsterland e.V.:** Registrierung per Formular, CC0/CC BY/CC BY-SA;
  NRW ist bei destination.one mit 9.426 Events schon vertreten.
* **Nordkirche:** zentrale Kirchendatenbank, Zugriff nur mit Zugangsdaten vom AfÖ.
* **JamBase, PredictHQ:** kommerzielle Datenkäufe. JamBase verlangt „Powered by
  JamBase“ mit nofollow-Link und gibt keine Bildrechte (https://data.jambase.com/agents.md);
  bei PredictHQ ist die Anzeige-Lizenz nicht belegt. Nur bei gemessener Musik-Lücke.

## Geprüft und nicht geeignet

* **Outdooractive:** kostenpflichtige API-Lizenz, Inhalte anderer Quellen dürfen
  nicht von Suchmaschinen indexiert werden
  (https://developers.outdooractive.com/Overview/Guidelines.html).
* **Eventbrite:** Suche seit 12.12.2019 abgeschaltet
  (https://www.eventbrite.com/platform/api), nur Abrufe je Organisation oder Venue.
* **Songkick:** nur kommerzielle Partnerschaft (https://www.songkick.com/developer).
* **Bandsintown:** nur für Künstler und deren Vertreter.
* **Meetup:** GraphQL nur mit Meetup Pro.
* **pretix:** keine globale Event-Liste, Token je Veranstalter.
* **Resident Advisor, DICE, TicketSwap, Ticket i/O, Etix, München Ticket,
  Rausgegangen:** kein offizielles öffentliches API belegt.
* **AUMA-Messedatenbank:** Nutzungsbedingungen verbieten die Verwendung für
  Verzeichnisse (https://www.auma.de/nutzungsbedingungen/).
* **Wikidata:** 1.436 Festivals in Deutschland (CC0), aber 0 künftige Ausgaben mit
  Startdatum; höchstens Stammdaten für eine kuratierte Festivaldatei wie in AT.
* **Städte ohne offenen Kalender:** Hamburg, München, Frankfurt, Düsseldorf, Leipzig,
  Dresden, Hannover, Bremen; Berlin nur über kulturdaten.berlin und saisonale
  Volksfestlisten.
* **Hochschul-Feeds:** kaum Termindaten (LMU, Uni Hamburg, Uni Bonn), Uni Köln
  defekt; Uni Freiburg strukturiert, aber Fachkolloquien.
* **GovData-Kommunaldatensätze:** Krefeld, Geldern, Wesel 404, Deggendorf 500, Kleve
  veraltet, Moers nicht offen lizenziert.

## Abdeckungslücken nach Schritt 1 bis 6

* **Berlin, Hamburg, Mecklenburg-Vorpommern:** bei destination.one praktisch leer.
  Für die Stadtstaaten tragen Ticketing-Quellen; für MV ist offen, ob der DZT-Graph
  Events liefert.
* **Baden-Württemberg, Thüringen:** bei destination.one dünn (539 und 386). Weg über
  den DZT-Graph; Lizenzmix in BW laut TMBW-Präsentation nur teilweise offen.
* **Preise und Ticketlinks bei Tourismusdaten:** kaum vorhanden. Ticketlinks kommen
  aus Eventim, Eventfrog, Ticketmaster, Reservix; die Zusammenführung erledigt der
  bestehende Dedup.

## Was der User selbst tun muss

1. DZT-Key beantragen: https://open-data-germany.org/zugang-anfordern/
2. destination.one anschreiben (support@destination.one): kommerzielle Nutzung der
   Experience `open-data`, Pflichthinweis.
3. Eventim: eventim.de-Feed und Provision für J70 klären, sonst Awin 11388.
4. Ticketmaster-Key auf developer.ticketmaster.com registrieren; Erlös-Klausel klären.
5. Reservix: affiliate@reservix.de, dazu Awin 31293 / 18490.
6. Optional: Nutzungserlaubnis Evangelische Termine, kulturdaten.berlin.
