# Baden-Württemberg: Gemeindekalender und Dorffeste (Stand 2026-10-27)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.5`. Bundesweite Anbieter stehen in
[00-bundesweit.md](00-bundesweit.md), die Zuordnung aller Gemeinden in
[01-vollerhebung.md](01-vollerhebung.md) mit
[data/vollerhebung-2026-10.csv](data/vollerhebung-2026-10.csv). Diese Datei ergänzt die
Landessicht: eine Zufallsstichprobe von 40 Gemeinden unter 10.000 Einwohnern, jede von Hand
geprüft (Kalender, Hersteller, Feed, Amtsblatt, Tourismus, Dorffest), dazu der Abgleich mit
destination.one und die Landesdatenbank toubiz.

Arbeitsweise: nur lesende GET-Anfragen, keine Konten, Formulare, Mails oder
Cookie-Zustimmungen; robots.txt je Host vor dem ersten Abruf gelesen. Nicht abgerufen:
nussbaum.de (robots.txt sperrt ClaudeBot), meinort.de, cmsweb.wittich.de, die toubiz-API.
Alle Anfragen mit Statuscode und ein Verstoß gegen eine robots.txt, offen benannt:
[04-baden-wuerttemberg-anfragen.md](04-baden-wuerttemberg-anfragen.md). „Eigenangabe“
heißt Werbeaussage des Betreibers, „Vollerhebung“ heißt gezählt aus der CSV von
[01-vollerhebung.md](01-vollerhebung.md), „Suchtreffer“ heißt nur in einer Websuche
gesehen und nicht auf der Quelle selbst bestätigt.

## Kurzfazit

1. **In BW veröffentlicht fast jede kleine Gemeinde ihre Termine selbst, mit
   Vereinsterminen.** 34 von 40 Stichprobengemeinden haben einen Kalender auf der eigenen
   Website, 5 führen ihre Termine über ein Tourismusportal mit toubiz, eine über ein
   Ortsportal des Jugendhauses. Keine einzige war „nirgends“. Verbände (GVV, VVG) spielen
   anders als in RP keine Rolle.
2. **Der größte BW-Hebel ist ein Hersteller, den der Querschnitt noch nicht kannte:
   Hirsch & Wölfl GmbH, Vellberg** (TYPO3-Extension `hwveranstaltung`). 15 von 40
   Stichprobengemeinden laufen darauf, in der Vollerhebung 345 von 1.101 BW-Gemeinden.
   Einheitliches HTML, kein Feed, robots.txt lässt die Kalender frei. Ein Parser deckt
   alle Kunden ab.
3. **Offene Feeds gibt es bei Cross7 (JSON-API, 120 BW-Gemeinden) und Komm.ONE (RSS mit
   hCalendar, 137).** Zusammen 7 von 40 in der Stichprobe. cEasy von hitcom (92) hat
   JSON-LD und iCal je Termin, aber keinen Listen-Feed.
4. **destination.one deckt kleine BW-Gemeinden nicht ab: 0 von 40.** Im Fenster
   28.10.2026 bis 27.10.2027 hat destination.one 400 BW-Events, davon 18 Weihnachtsmärkte,
   1 Weinfest, kein Feuerwehrfest, keine Hocketse, kein Dorffest, keine Kirbe.
5. **toubiz (Landesdatenbank der TMBW) trägt die Schwarzwald-Gemeinden ohne eigenen
   Kalender**, aber nur mit Kunden-Token; ein offener, schlüsselfreier Zugang ist nicht
   belegt. Lizenz steht je Datensatz (`license`, z. B. `cc-by-sa`). Weg: eigener
   Lese-Token bei TMBW oder Land in Sicht, oder der DZT Knowledge Graph für die
   CC-Einträge.
6. **Amtsblätter sind zersplittert und PDF.** NUSSBAUM druckt das Blatt von 10 der 40
   Gemeinden (belegt auf der Gemeindeseite), mit Suchtreffern 14; daneben 13 weitere
   Verlage. Für die Termine braucht es die Amtsblätter in BW nicht, weil die
   Gemeindekalender dieselben Vereinstermine führen.

## 1. Stichprobe

**Ziehung:** Destatis Gemeindeverzeichnis-Auszug, Stichtag 30.09.2026
(`AuszugGV3QAktuell.xlsx`, Blatt `Onlineprodukt_Gemeinden30092026`). Grundmenge: Satzart
60, Land 08, Textkennzeichen nicht 66 (gemeindefreie Gebiete Rheinau und Gutsbezirk
Münsingen ausgeschlossen) = 1.101 Gemeinden; davon mit Bevölkerung (31.12.2025) unter
10.000: **839**. Nach Gemeindeschlüssel sortiert, dann
`random.Random(20261027).sample(liste, 40)` (Python 3.14.2). Gezogen wurden 40 statt der
geforderten 30, damit die Anteile weniger streuen.

**Spalten:** Fundort = Hauptfundort der Termine. Plattform = Hersteller des Kalenders,
erkannt an Generator, Klassen, Pfaden oder Impressum (Merkmale in Abschnitt 2).
Vollerhebung = Zuordnung in der CSV. d.one = Treffer in destination.one `open-data` mit
`q=city:"<Gemeinde>"`, Fenster 28.10.2026 bis 27.10.2027.

| Nr | Gemeinde | AGS | EW | Fundort | Plattform | Kalender | Vollerhebung | d.one |
|---|---|---|---|---|---|---|---|---|
| 1 | Krautheim, Stadt | 08126045 | 4.502 | Gemeinde-Website | Hirsch & Wölfl | https://www.krautheim.de/freizeit-erlebnis/veranstaltungen/veranstaltungskalender | hwext | 0 |
| 2 | Bad Ditzenbach | 08117006 | 3.822 | Gemeinde-Website | Cross7 (ID 3755) | https://www.badditzenbach.de/veranstaltungen/veranstaltungskalender | cross7 | 0 |
| 3 | Leibertingen | 08437072 | 2.260 | Gemeinde-Website | WordPress, Elementor-Tabellen | https://www.leibertingen.de/events-in-leibertingen/ | E | 0 |
| 4 | Kirchardt | 08125049 | 5.944 | Gemeinde-Website | Hirsch & Wölfl | https://www.kirchardt.de/leben-freizeit/veranstaltungskalender | hwext | 0 |
| 5 | Creglingen, Stadt | 08128020 | 4.417 | Gemeinde-Website | Cross7 (ID 1860) | https://www.creglingen.de/de/tourismus-freizeit/veranstaltungen-vereine/veranstaltungskalender | cross7 | 0 |
| 6 | Hohentengen am Hochrhein | 08337053 | 3.652 | Gemeinde-Website (von Hand gepflegte Seite) | Contao, Kalendermodul leer | https://www.hohentengen.de/de/freizeit-und-tourismus/freizeit.html | R | 0 |
| 7 | Stimpfach | 08127104 | 2.956 | Gemeinde-Website | Hirsch & Wölfl | https://www.stimpfach.de/freizeit-sehenswertes/veranstaltungskalender | hwext | 0 |
| 8 | St. Peter | 08315095 | 2.718 | Tourismusdatenbank | toubiz (Hochschwarzwald Tourismus) | https://www.hochschwarzwald.de/veranstaltungen-hochschwarzwald/veranstaltungen-orte/veranstaltungen-in-st-peter | R | 0 |
| 9 | Auenwald | 08119006 | 6.806 | Gemeinde-Website | Hirsch & Wölfl (neue Modulversion, JSON-LD) | https://www.auenwald.de/kultur-freizeit/veranstaltungen/kalender | hwext | 0 |
| 10 | Mutlangen | 08136044 | 6.724 | Gemeinde-Website | Komm.ONE (RSS) | https://www.mutlangen.de/Home/freizeit+_+kultur/termine+_+veranstaltungen.html | komm1 | 0 |
| 11 | Frickenhausen | 08116020 | 9.202 | Gemeinde-Website | Hirsch & Wölfl | https://www.frickenhausen.de/freizeit-gaeste/veranstaltungskalender | hwext | 0 |
| 12 | Hochdorf | 08116027 | 4.699 | Ortsportal „Aktiv in Hochdorf“ (Jugendhaus SKUNK, Kreisjugendring Esslingen) | Drupal 10; Gemeindeseite Hirsch & Wölfl ohne eigenen Kalender | https://www.aktiv-in.de/veranstaltungskalender | hwext | 0 |
| 13 | Eschbronn | 08325071 | 2.059 | Gemeinde-Website | cEasy (hitcom) | https://www.eschbronn.de/de/Aktuelles/Veranstaltungskalender | ceasy | 0 |
| 14 | Bahlingen am Kaiserstuhl | 08316002 | 4.556 | Gemeinde-Website | Hirsch & Wölfl | https://www.bahlingen.de/freizeit-erlebnis/veranstaltungen | hwext | 0 |
| 15 | Vogtsburg im Kaiserstuhl, Stadt | 08315133 | 6.328 | Tourismusdatenbank | toubiz (Naturgarten Kaiserstuhl); Stadtseite im Notbetrieb | https://www.naturgarten-kaiserstuhl.de/de/kaiserlich-erleben/veranstaltungen | R | 0 |
| 16 | Volkertshausen | 08335081 | 3.332 | Gemeinde-Website | Hirsch & Wölfl (alte Modulversion) | https://www.volkertshausen.de/freizeit-tourismus/veranstaltungen | hwext | 0 |
| 17 | Reichenbach an der Fils | 08116058 | 8.390 | Gemeinde-Website | Hirsch & Wölfl | https://www.reichenbach-fils.de/freizeit-kultur/veranstaltungskalender/in-der-uebersicht | hwext | 0 |
| 18 | Benningen am Neckar | 08118006 | 6.260 | Gemeinde-Website | cm city media Kalender V4 (ohne Cross7) | https://www.benningen.de/de/gemeinde/entdecken/kalender | cmcitymedia | 0 |
| 19 | Ingoldingen | 08426062 | 3.199 | Gemeinde-Website | Hirsch & Wölfl | https://www.ingoldingen.de/freizeit-kultur/veranstaltungen | hwext | 0 |
| 20 | Weisweil | 08316049 | 2.217 | Gemeinde-Website (nur PDF-Jahreskalender) | WordPress mit Divi | https://www.weisweil.de/veranstaltungskalender2024/ | E | 0 |
| 21 | Ruppertshofen | 08136061 | 1.944 | Gemeinde-Website | Cross7 (ID 68) | https://www.ruppertshofen.de/tourismus-freizeit/veranstaltungskalender | cross7 | 0 |
| 22 | Bergatreute | 08436014 | 3.176 | Gemeinde-Website | Hirsch & Wölfl | https://www.bergatreute.de/de/freizeit-gestalten/veranstaltungskalender | hwext | 0 |
| 23 | Blumberg, Stadt | 08326005 | 9.847 | Tourismusdatenbank (auf der Stadtseite eingebettet) | toubiz-iframe auf Hirsch-&-Wölfl-Seite | https://www.stadt-blumberg.de/freizeit-tourismus/veranstaltungen | hwext | 0 |
| 24 | Tannheim | 08426117 | 2.505 | Gemeinde-Website | Komm.ONE (RSS) | https://www.gemeinde-tannheim.de/Startseite/leben+_+wohnen/termine+_+veranstaltungen.html | komm1 | 0 |
| 25 | Westerheim | 08425134 | 3.103 | Gemeinde-Website | Hirsch & Wölfl | https://www.westerheim.de/freizeit-tourismus/veranstaltungen/veranstaltungskalender | hwext | 0 |
| 26 | Sontheim an der Brenz | 08135031 | 5.846 | Gemeinde-Website | cEasy (hitcom) | https://www.sontheim-brenz.de/de/Aktuelles/Veranstaltungen | ceasy | 0 |
| 27 | Au am Rhein | 08216002 | 3.389 | Gemeinde-Website | WordPress (Enfold, Beitragstyp `event`) | https://www.auamrhein.de/freizeit-kultur/veranstaltungen/ | E | 0 |
| 28 | Bollschweil | 08315014 | 2.351 | Gemeinde-Website | cEasy (hitcom) | https://www.bollschweil.de/veranstaltungen | ceasy | 0 |
| 29 | Schwenningen | 08437102 | 1.668 | Gemeinde-Website | Hirsch & Wölfl | https://www.schwenningen.de/freizeit/veranstaltungskalender | hwext | 0 (2 Treffer gehören zu Schwenningen 89443, Bayern) |
| 30 | Michelfeld | 08127059 | 3.683 | Gemeinde-Website | Cross7 (ID 1786) | https://www.michelfeld.de/leben-wohnen/veranstaltungskalender | cross7 | 0 |
| 31 | Wittighausen | 08128137 | 1.756 | Gemeinde-Website | verwaltungsportal.de | https://www.wittighausen.de/veranstaltungen/index.php | verwaltungsportal | 0 |
| 32 | Lauterbach | 08325036 | 2.650 | Gemeinde-Website | cEasy (hitcom) | https://www.lauterbach-schwarzwald.de/veranstaltungen | ceasy | 0 |
| 33 | Ebenweiler | 08436024 | 1.387 | Gemeinde-Website | WordPress + EventON | https://www.ebenweiler.de/veranstaltungen/ | eventon | 0 |
| 34 | Bad Liebenzell, Stadt | 08235008 | 9.215 | Tourismusdatenbank | toubiz (Schwarzwald Tourismus) | https://www.tourismus-bad-liebenzell.de/events/ | R | 0 |
| 35 | St. Märgen | 08315094 | 1.958 | Tourismusdatenbank | toubiz (Hochschwarzwald Tourismus) | https://www.hochschwarzwald.de/veranstaltungen-hochschwarzwald/veranstaltungen-orte/veranstaltungen-in-st-maergen | R | 0 |
| 36 | Elchesheim-Illingen | 08216012 | 3.252 | Gemeinde-Website | hitcom Eventkalender (`hitcomevent`, nicht cEasy) | https://www.elchesheim-illingen.de/termin | E | 0 |
| 37 | Empfingen | 08237024 | 4.293 | Gemeinde-Website | Hirsch & Wölfl | https://www.empfingen.de/freizeit-kultur/veranstaltungen | hwext | 0 |
| 38 | Wiesenbach | 08226097 | 3.201 | Gemeinde-Website | verwaltungsportal.de | https://www.wiesenbach-online.de/veranstaltungen/ | verwaltungsportal | 0 |
| 39 | Hessigheim | 08118028 | 2.514 | Gemeinde-Website | Nuxt, Termine im `window.__NUXT__`; Hersteller nicht belegt | https://www.hessigheim.de/veranstaltungen/ | E | 0 |
| 40 | Waldenbuch, Stadt | 08115048 | 8.740 | Gemeinde-Website | Komm.ONE (RSS) | https://www.waldenbuch.de/start/waldenbuch+entdecken/veranstaltungen.html | komm1 | 0 |

**Amtsblatt, Tourismus, Apps je Gemeinde** (Verlag nur, wenn auf der Gemeindeseite
genannt; sonst gekennzeichnet):

| Nr | Amtsblatt | Verlag | Tourismus-Widget | Gemeinde-App |
|---|---|---|---|---|
| 1 | Amtsblatt | NUSSBAUM | keins | |
| 2 | „Blättle“ | NUSSBAUM | keins | |
| 3 | „s' Blättle“ | nicht belegt | keins | |
| 4 | Mitteilungsblatt | Druckservice Leyrer, Ittlingen | keins | Kirchardt App (Hirsch & Wölfl) |
| 5 | Mitteilungsblatt | Krieger-Verlag, Blaufelden | keins | |
| 6 | Mitteilungsblatt | Feser-Druck (Suchtreffer) | Link ferienwelt-suedschwarzwald.de | |
| 7 | „Stimpfacher Mitteilungen“ | nicht belegt | keins | |
| 8 | Amtliches Mitteilungsblatt | Primo-Verlag (Suchtreffer) | toubiz | |
| 9 | Mitteilungsblatt | NUSSBAUM | keins | |
| 10 | Amtsblatt | Einhorn-Verlag+Druck, Schwäbisch Gmünd | keins | Mutlangen App (Hersteller nicht belegt) |
| 11 | Amtsblatt | NAK Neue Anzeigen- und Kommunalblatt, Ulm | keins | Frickenhausen-App (Hirsch & Wölfl) |
| 12 | Gemeindeanzeiger | NUSSBAUM | keins | |
| 13 | „Eschbronner Amtsblatt“ | NUSSBAUM | keins | |
| 14 | „s´Blättli“ | Primo-Verlag (Suchtreffer 2022) | Link naturgarten-kaiserstuhl.de | App (Hirsch & Wölfl) |
| 15 | Nachrichtenblatt | Primo-Verlag | toubiz | |
| 16 | wöchentliche PDFs | nicht belegt | keins | App (Hirsch & Wölfl) |
| 17 | Gemeindeanzeiger | NUSSBAUM (laut Hochdorfer Seite) | keins | |
| 18 | Mitteilungsblatt | NUSSBAUM | keins | |
| 19 | Mitteilungsblatt über myeblaettle.de | nicht belegt | keins | |
| 20 | Amtsblatt | Primo-Verlag (Suchtreffer 2021) | keins | |
| 21 | Mitteilungsblatt | Medien-Centrum Ellwangen | keins | |
| 22 | „Bürger und Gemeinde“ | Druck + Verlag Wagner, Kornwestheim (Suchtreffer) | keins | |
| 23 | Amtsblatt | NUSSBAUM (Suchtreffer) | toubiz | |
| 24 | „Tannheimer Mitteilungen“ | Druck & Verlag Wagner (Redaktionssystem Cross 7) | keins | |
| 25 | „Westerheimer Mitteilungen“ | Druck und Verlag Fink, Pfullingen | keins | |
| 26 | „Nachrichtenblatt“ | nicht belegt | keins | |
| 27 | „Gemeindeanzeiger“ | Dürrschnabel Druck & Medien (Suchtreffer) | keins | |
| 28 | „Amtliches Mitteilungsblatt“ | Anzeigen über Primo-Verlag | keins | BürgerApp (Hersteller nicht geprüft) |
| 29 | „Amtsblatt der Gemeinde Schwenningen“ | NUSSBAUM | keins | |
| 30 | „Bibersbote“ | nicht belegt | keins | |
| 31 | „Amtliches Mitteilungsblatt“ | KWG Druck & Medien | keins | wittighausen.app (Login) |
| 32 | „Bürger & Gemeinde“ | NUSSBAUM (Suchtreffer) | keins | |
| 33 | „Altshauser Verbandsanzeiger“ (GVV) | Restle (Suchtreffer) | keins | |
| 34 | „Bad Liebenzeller Stadtbote“ | NUSSBAUM (Suchtreffer) | toubiz | |
| 35 | Amtsblatt (PDF) | nicht belegt | toubiz | |
| 36 | „Gemeindeanzeiger“ | Dürrschnabel (Suchtreffer) | keins | |
| 37 | Mitteilungsblatt | NUSSBAUM | keins (Kreiskalender veranstaltungen-fds.de verlinkt) | Empfi-App (Hirsch & Wölfl) |
| 38 | Amtsblatt Bammental/Gaiberg/Wiesenbach | metropolmedia Häß; Anzeigen und Abo NUSSBAUM | keins | |
| 39 | Mitteilungsblatt | NUSSBAUM (E-Paper unter lokalmatador.de) | keins | |
| 40 | „Stadt Nachrichten“ | NUSSBAUM (Suchtreffer) | keins | |

**Abgleich mit der Vollerhebung.** Bei 28 von 40 stimmt die Integration der CSV mit dem
Handbefund überein, bei 5 weiteren (Stufe E) stimmt, dass ein Kalender da ist. Abweichend
sind 7: Hochdorf und Blumberg stehen als `hwext`, führen aber keinen eigenen
Hersteller-Kalender (Ortsportal bzw. toubiz-iframe). Fünf Gemeinden der Stufe R haben doch
Termine: Hohentengen (von Hand gepflegte Seite) und vier Schwarzwald-Gemeinden über
toubiz-Portale (St. Peter, Vogtsburg, Bad Liebenzell, St. Märgen). Außerdem zeigt
`event_url` bei Bad Ditzenbach (`/veranstaltungsraeume`), Westerheim (`/kraemermarkt`),
Benningen und Waldenbuch auf eine Nebenseite, bei Lauterbach ist es leer; die richtigen
Kalender-URLs stehen in der Tabelle oben.

## 2. Generics

Gemeindezahlen aus der Vollerhebung (BW gesamt, in Klammern unter 10.000 Einwohnern),
Stichprobenanteil von 40.

| Plattform | Betreiber | BW-Gemeinden (Vollerhebung) | Stichprobe | Zugriff | Lizenz/robots | Bewertung |
|---|---|---|---|---|---|---|
| Hirsch & Wölfl `hwveranstaltung` | Hirsch & Wölfl GmbH, Vellberg | 345 (297) | 15 | einheitliches HTML, JSON-LD nur in neuer Modulversion | Kalender frei, Nutzungsbedingungen nicht belegt | hoch (Menge), HTML |
| Komm.ONE Online-Suite | Komm.ONE, Stuttgart | 137 (78) | 3 | RSS 2.0 mit hCalendar je Gemeinde | Crawl-delay 30, `/site/` frei | mittel bis hoch |
| Cross7 | cm city media GmbH, Ulm | 120 (103) | 4 | offene JSON-API | API ohne robots.txt, Bedingungen nicht belegt | hoch |
| cEasy | hitcom new media GmbH | 92 (50) | 4 | HTML-Liste, JSON-LD und iCal je Termin | frei | mittel bis hoch |
| verwaltungsportal.de | Förderverein für regionale Entwicklung e.V. | 34 (34) | 2 | HTML, AJAX-Monatsfragment, JSON-LD je Termin | ClaudeBot mit Crawl-delay 10 | mittel |
| cmcitymedia ohne Cross7 | cm city media GmbH | 27 (24) | 1 | Druckansicht der Liste; Exchange-Host gesperrt | `exchange.cmcitymedia.de` Disallow / | niedrig bis mittel |
| toubiz | Land in Sicht AG für TMBW und Regionen | 14 erkannt, dazu Portale für R-Gemeinden | 5 | API nur mit Kunden-Token | Lizenz je Datensatz | hoch nach Zugang |
| hitcom Eventkalender | hitcom | nicht gezählt (in E) | 1 | iCal je Termin `/events/export/ical/<id>` | frei | niedrig (eine Gemeinde) |
| NUSSBAUM | NUSSBAUM Medien St. Leon-Rot | „>380“ (Eigenangabe) | 10 belegt, 14 mit Suchtreffern | Event-Seiten, nicht abgerufen | KI-Crawler gesperrt, keine Lizenz | nur mit Lizenz |

### 2.1 Hirsch & Wölfl GmbH (neu, BW-eigen)

* **Betreiber:** Hirsch & Wölfl GmbH, Medienwerk Vellberg, Im Städtle 29, 74541 Vellberg
  (Impressum der Kundenseiten, z. B. Bergatreute, Westerheim). Eigenangabe auf
  https://www.hirsch-woelfl.de/startseite: „über 1.400 Digitalprojekte“; die Kommunenzahl
  nennt der Hersteller nicht. Die Referenzseite https://www.hirsch-woelfl.de/unsere-werke/referenzen
  ist eine Auswahl mit 99 Einträgen (selbst gezählt), davon 13 unter „Gemeinden“ (10 BW,
  3 Bayern) und 10 unter „Städte“, überwiegend BW, dazu Bayern und Hessen.
* **Gemeinden:** Vollerhebung 345 BW-Gemeinden mit Merkmal `hwext` (bundesweit 430, siehe
  [01-vollerhebung.md](01-vollerhebung.md)). Stichprobe 15 von 40 mit Merkmal, davon 13 mit
  eigenem gefülltem Kalender (Hochdorf verweist auf ein Ortsportal, Blumberg bettet toubiz ein).
* **Zugriff:** nur HTML, serverseitig. Liste 10 Termine je Seite, Pager
  `<Kalenderpfad>/seite-N/suche-none`; Detail `<Kalenderpfad>/<id>/<slug>`, teils
  `…/termin-<n>` je Termin. Kein RSS, kein iCal-Listenexport, kein JSON-LD in der älteren
  Modulversion (Bahlingen, Frickenhausen, Krautheim geprüft).
* **Felder (Liste, Klassen):** `div.hw_fe__record.hwveranstaltung__record#hwveranstaltung__record__<id>`,
  `h3.hw_record__title`, `span.hw_tag` bzw. `hw_record__categories` (Kategorie),
  `hw_record__date` („07.11.2026 bis 08.11.2026“), `hw_record__time`,
  `hw_record__organizer`, `hw_record__simpleLocation`, `hw_record__map` mit
  OpenStreetMap-Link `mlat`/`mlon` (Krautheim 49.3874012/9.6360549; in Bahlingen und
  Reichenbach ohne). Selbst nachgeprüft in Frickenhausen: 10 Datensätze je Seite, Klassen
  `hw_record__title`, `__categories`, `__details`, `__value`, `__map`, `__email`,
  `__website`, Pager bis `seite-5` sichtbar.
* **Felder (Detail, HTML-Beschriftungen):** Titel, Kategorie, Datum, Uhrzeit, Veranstalter,
  Telefonnummer, Veranstaltungsort, E-Mail, Beschreibung, Dateien.
* **JSON-LD (nur Auenwald, `hw-modules-events-001.css`):** `name`, `startDate`
  (`2026-12-05T00:00:00+01:00`, Mitternacht bei Ganztag), `endDate`, `eventStatus`,
  `location` (`Place` mit `address` und `geo`), `organizer` (`Organization` mit `telephone`).
* **Alte Modulversion (Volkertshausen):** Parameter `tx_hwveranstaltung_hwveranstalt[…]`,
  Klassen `record record_list kalenderKatIdN`. Ein Adapter braucht beide Varianten.
* **Erkennung:** HTML-Kommentar am Seitenanfang „Hirsch & Wölfl GmbH, Medienwerk Vellberg“,
  Footer „made by Hirsch & Wölfl GmbH“, Generator TYPO3, Klassen `hw_*`, `hwveranstaltung`,
  `tx_hwnews`, Pfad `/fileadmin/templates/`, Navigation „Leichte Sprache, Gebärdensprache,
  Barriere melden“. Gemeinde-Apps mit Bundle `de.hirschwoelfl.<gemeinde>` (Kirchardt,
  Frickenhausen, Bahlingen, Volkertshausen, Empfingen); sie lesen laut Hersteller aus
  demselben CMS.
* **robots.txt (alle geprüften Kunden gleich):** `User-agent: *` sperrt Bilder,
  `/fileadmin/Dateien/` bzw. `/fileadmin/*`, `/typo3*`, `/*?type=*`, `/*.pdf$`,
  `/*?tx_solr`; kein Crawl-delay. `seite-N/suche-none` und Detailseiten sind frei.
  Nutzungsbedingungen: nicht belegt.
* **NUSSBAUM-Schnittstelle:** https://www.hirsch-woelfl.de/unsere-werke/nussbaum-medien-schnittstelle
  verbindet NUSSBAUMs Redaktionssystem „artikelstar“ mit Website, App und Amtsblatt; dort ist
  von Artikeln die Rede, von Terminen nicht.
* **Regionalkalender:** Frickenhausen führt mit demselben Modul den „Täleskalender
  Neuffener Tal“ mit Terminen aus Neuffen, Beuren und Kohlberg
  (https://www.frickenhausen.de/freizeit-gaeste/veranstaltungen-neuffener-tal).
* **Gemeinde-Beispiele:** Frickenhausen (siehe Tabelle, bis 14 Seiten), Westerheim
  https://www.westerheim.de/freizeit-tourismus/veranstaltungen/veranstaltungskalender ,
  Krautheim https://www.krautheim.de/freizeit-erlebnis/veranstaltungen/veranstaltungskalender .
* **Nächster Schritt:** Adapter für beide Modulversionen (Liste plus Detail, OSM-Koordinate
  wenn vorhanden, sonst Resolver). Parallel Hirsch & Wölfl nach einem Export oder Feed und
  nach der Kundenliste fragen.

### 2.2 Cross7 (cm city media)

Beschreibung in [00-bundesweit.md](00-bundesweit.md) C1. BW-Ergänzungen aus der Stichprobe:

* **Gemeinden:** Vollerhebung 120 BW-Gemeinden; neue IDs Bad Ditzenbach 3755 (selbst
  nachgeprüft: `totalCount` 138 ab 28.10.2026), Creglingen 1860 (39 Termine),
  Ruppertshofen 68 (9), Michelfeld 1786 (56).
* **Zugriff:** `from` braucht eine Zeitzone: `2026-10-27T00:00:00` gibt 422,
  `2026-10-27T00:00:00Z` geht.
* **Felder (Probe Bad Ditzenbach, selbst nachgeprüft):** `additionalFields`, `addresses`,
  `categoryColor`, `categoryNames`, `created`, `discriminator`
  (`CalendarEventTeaserDto`), `fromDate`, `fromTime`, `hasContent`, `link`, `name`,
  `teaserPictureUrl`, `teaserText`, `untilDate`, `untilTime`. `categoryNames[]` sind
  Objekte (`id`, `name`, `color`, `discriminator`), nicht Zeichenketten wie im Querschnitt
  beschrieben. `addresses[]` mit `type` („Veranstalter“, „Veranstaltungsort“) und
  `private`; Straße und PLZ oft leer (Ruppertshofen gar nicht, Bad Ditzenbach nur `name`).
* **Gemeinde-Dienste:** Michelfeld liefert 11 von 56 Terminen als Abfuhrtermine mit eigener
  Kategorie; Kategoriefilter oder `isMunicipalService` nötig.
* **Verlag:** Druck + Verlag Wagner (Kornwestheim) nutzt Cross 7 als Redaktionssystem für
  Mitteilungsblätter (Tannheimer Seite, Tannheim selbst läuft auf Komm.ONE).
* **robots/Lizenz:** `api.cross-7.de/robots.txt` 404; Nutzungsbedingungen nicht belegt.
* **Nächster Schritt:** wie im Querschnitt, Anfrage bei cm city media; BW-Kunden über
  `data-c7-page` aus der Vollerhebung.

### 2.3 Komm.ONE Online-Suite

Beschreibung in [00-bundesweit.md](00-bundesweit.md) C4. BW-Ergänzungen:

* **Gemeinden:** Vollerhebung 137 BW-Gemeinden. Referenzseite
  https://www.online-suite.de/referenzen/referenzen-nach-kundensegmenten nennt sich „Auszug“:
  60 Einträge, davon 12 „Kommunen bis 10.000 EW“, 13 bis 40.000, 11 darüber, 7 Landkreise,
  10 Tourismus/Kultur, 7 Sonstige. Kundenzahl insgesamt nicht belegt.
* **Kein zentraler Dienst:** `www.komm.one/site/Biederbach/zmrss/825233/rss.xml` antwortet
  404; jeder Mandant liefert nur sein eigenes RSS. Die Bürger-App bekommt ihre Daten laut
  https://www.online-suite.de/leistungen/apps „automatisch aus dem CMS der Online-Suite“.
* **RSS-Pfad:** steht als `<link rel="alternate" type="application/rss+xml"
  title="Veranstaltungskalender als RSS">` auf der Terminseite, nicht auf der Startseite.
  Belege: Mutlangen `/site/Mutlangen-2017/zmrss/14333884/rss.xml` (50 Items),
  Tannheim `/site/Tannheim/zmrss/12967382/rss.xml` (35 Items bis 18.05.2027), Waldenbuch
  `/site/Waldenbuch-Internet/zmrss/13702713/rss.xml` (15 Items, HTML-Liste 20). Das
  Item-Limit ist je Mandant verschieden; ob es einstellbar ist, ist nicht belegt.
* **Felder (Probe Waldenbuch):** `title` („TT.MM.JJJJ-TT.MM.JJJJ  Titel“), `link`
  (`zmdetail_<id>/index.html?nodeID=`), `content:encoded` mit `article.zmItem.vevent`,
  `span.dtstart title="JJJJ-MM-TT"`, `span.dtend`, `section.zmOrt` mit `div.vCard`
  (`organization`, `street-address`, `postal-code`, `locality`), `enclosure`, `guid`,
  `pubDate`; `<generator>dvv-Zusatzmodule - 10.14.6</generator>`. Datenfehler in der Probe:
  `postal-code` „7111“ statt 71111.
* **Kategorieseiten:** `/site/<Mandant>/node/<nodeID>/zmkat_<Kategorie>/index.html`
  (Waldenbuch: Ausstellung, Kino, Kirche, Konzert, Sonstiges, Theater, Tourismus, Vortrag,
  Feste); `zmkat_Feste` enthält den Weihnachtsmarkt.
* **Inhalt:** Mutlangen führt im RSS vor allem Müllabfuhr, Wochenmarkt und Gemeinderat,
  keine Vereinsfeste; Tannheim dagegen Narrenzunft, Feuerwehr, Musikverein.
* **robots.txt:** `Crawl-delay: 30`, gesperrt `/common/`, `/master/`, `/zm/`, `/pirobase`,
  `/webadmin`; `/site/` frei.
* **Nächster Schritt:** Adapter RSS plus Detailseite, Crawl-delay 30 (ein Feed je Nacht und
  Gemeinde). Bei cms@komm.one Kundenliste und Item-Limit erfragen.

### 2.4 cEasy und hitcom-Eventkalender (hitcom new media)

* **Betreiber:** hitcom new media GmbH (Generator
  `cEasy 5.3.5 (10135) by hitcom new media gmbh [www.hitcom.de]`, selbst nachgeprüft in
  Eschbronn). Vollerhebung 92 BW-Gemeinden mit cEasy; Kundenzahl laut Hersteller nicht belegt.
* **cEasy-Zugriff:** HTML-Liste serverseitig (Klassen `cVeka_box_*`), Detail
  `…/Veranstaltung?view=publish&item=eventDate&id=<n>` mit JSON-LD, iCal je Termin
  `/ceasy/ics/veka/eventDate/<id>.ics` (307 auf
  `/ceasy/serve/usage/main.php?view=iCalendar&item=eventDate&id=<id>`). Ein Listen-iCal
  ist nicht belegt.
* **JSON-LD (Eschbronn, selbst nachgeprüft):** `name`, `startDate` (`2026-11-08`),
  `endDate`, `location` (`Place`, `name`, `address` mit `streetAddress`,
  `addressLocality`, `postalCode`), `eventStatus`. Sontheim mit Uhrzeit
  (`2026-11-17T19:00`, ohne Offset).
* **ICS:** PRODID `http://www.hitcom.de/ceasy/veka`, `URL`, `UID`, `SUMMARY`,
  `DESCRIPTION`, `LOCATION`, `DTSTART` (Sontheim in UTC mit Z, Eschbronn und Lauterbach
  `VALUE=DATE`), `DTEND` (Sontheim: Start plus 1 Sekunde).
* **Filter:** Bollschweil `filters[eventCategoryIds]`, `filters[districtIds]`,
  `filters[keyword]` (nicht getestet); Lauterbach mit rund 200 Veranstaltungsarten.
* **hitcom Eventkalender (Elchesheim-Illingen, andere Produktlinie):** Klassen
  `hitcomevent`, `hitcomfrontend`; Liste per JavaScript, im HTML leer; iCal je Termin
  `/events/export/ical/<id>`, PRODID `-//Hitcom//NONSGML Event Calendar//DE`, Felder
  `DTSTART` (lokal), `DTEND`, `SUMMARY`, `DESCRIPTION`, `LOCATION` mit Adresse, `GEO`,
  `STATUS`, `TIMEZONE-ID`. Detail `/termin/<Slug>-event-appointment<id>`.
* **robots.txt:** Sontheim erlaubt alles, Eschbronn `Disallow:` leer, Bollschweil 404,
  Elchesheim sperrt nur benannte SEO-Bots.
* **Gemeinde-Beispiele:** Eschbronn, Sontheim an der Brenz, Lauterbach (Tabelle).
* **Nächster Schritt:** Adapter Liste (Paging `offset=N`) plus JSON-LD der Detailseite.

### 2.5 verwaltungsportal.de

Beschreibung in [00-bundesweit.md](00-bundesweit.md) C7 und
[01-vollerhebung.md](01-vollerhebung.md) Abschnitt 3. BW-Ergänzungen:

* **Gemeinden:** Vollerhebung 34 BW-Gemeinden, alle unter 10.000 EW; im Fuß „Baden-Württemberg
  vernetzt“ (Wittighausen, Wiesenbach).
* **JSON-LD (Wiesenbach, selbst nachgeprüft):** `name`, `description` (leer),
  `startDate` (`2026-12-05`, nur Datum), `location` (`Place`, `name`, `address` mit
  `postalCode`, `addressLocality`, `addressCountry`), `organizer` (`Organization` mit
  Adresse). Wittighausen ohne Adresse. Mehrtägige Termine stehen als je ein Eintrag je Tag
  mit gleicher ID.
* **robots.txt (beide gleich):** GPTBot, Bytespider u. a. `Disallow: /`; eine Gruppe mit
  Baiduspider, Yandex, Slurp und ClaudeBot hat nur `Crawl-delay: 10`; keine Regel für `*`.

### 2.6 toubiz und die TMBW-Landesdatenbank

* **Betreiber:** toubiz by Land in Sicht (Kontakt laut Erhebungsbogen
  https://www.guetenbach.de/fileadmin/Dateien/Dateien/toubiz-Erhebungsbogen-Veranstaltungen.pdf
  helpdesk@land-in-sicht.de). Kommunen, Tourist-Infos und Leistungsträger tragen direkt
  ein; nach einem „Open Data Check“ gehen die Daten über Standardschnittstellen an TMBW,
  ADAC und weitere
  (https://www.schwarzwald-tourismus.info/partnernet/digitalisierung/mein-toubiz-datenbank-1/datendrehscheibe/daten-drehscheibe).
  Gütenbach trägt Vereinsveranstaltungen „im Veranstaltungskalender der Gemeinde sowie im
  Zwei-Täler-Land und TOUBIZ“ ein
  (https://www.guetenbach.de/de/rathaus-service/veranstaltungen/veranstaltung-veroeffentlichen).
* **Zugriff:** Widget `<toubiz-widget route="/event" base-uri="https://mein.toubiz.de"
  api-token="…" serialized-configuration="{…filter:{element:'events', cities:[UUID]}…}">`
  mit `https://widget.toubiz.de/js/stable/widget.js`; Termine nur im Browser, nicht im
  HTML. Die Standardabfrage setzt `unlicensed:true`. Das Token ist je Kunde und steht im
  HTML; es wurde nicht benutzt. Offene Doku, Open-Data-Export der TMBW oder ein
  Tourismus-Event-Datensatz auf daten.bw: nicht gefunden. `api.toubiz.de` antwortet 404.
* **Endpunkte und Felder (nur aus fremdem Open-Source-Code, nicht selbst abgerufen):**
  `mein.toubiz.de/api/v1/events`, `/eventDates`, `/event/<id>` mit `api_token`;
  Antwort `payload[]`, `_attributes.pagination.lastPage`; Felder `name`, `intro`,
  `description`, `category.name`, `dateIntervals[]` (`date`, `end`, `startAt`, `endAt`,
  `canceled`), `nextDate`, `eventLocationAddress`, `location.name`, `geocoordinates`,
  `client.name`, `license`. Quellen: github.com/TimUx/OpenEventHub
  (`plugins/utils/toubiz.js`), github.com/WPS/radvis (`ToubizRepositoryImpl.java`).
* **Serverseitig gerenderte Portale:** wutachschlucht.de (Blumberg) und die Neos-Portale
  schwarzwald-tourismus.info und hochschwarzwald.de tragen je Event-Seite den Datensatz im
  HTML: `dates[]` (`date`, `startAt`, `endAt`, `freeEntry`), `itemType: "event"`,
  `license: "cc-by-sa"`, `externalIds`, `city`, `zip`, `latitude`, `client.id`. Die
  Event-ID `9e198c8e-4e33-4fc7-ad73-181a6c77b4fe` steht bei Bad Liebenzell und bei
  Schwarzwald Tourismus, also dieselbe Datenbank.
* **Lizenz:** je Datensatz und je Bild
  (https://www.schwarzwald-tourismus.info/partnernet/digitalisierung/mein-toubiz-datenbank-1/open-data).
  TMBW-Forum Mai 2026: Einträge mit CC0, CC BY oder CC BY-SA „landen automatisch im
  Knowledge Graph“ (Folie im Abschnitt MICE; für Events allgemein nicht ausdrücklich),
  https://www.schwarzwald-tourismus.info/_Resources/Persistent/2fe7c7be563a6d79742567f5f0128687344cff0a/TMBW_mein.toubiz%20Forum%20Mai%202026.pdf .
  Forum Mai 2025: TMBW empfiehlt CC BY oder CC BY-SA, Bilder gehen nicht an den Graph.
  Nutzungsbedingungen für Dritte am Token: nicht belegt. robots.txt `mein.toubiz.de` sperrt
  nur `/storage/`.
* **Zahlen:** TMBW-Mandant 05.05.2026: 204.008 veröffentlichte Einträge, Events stellen
  laut Folie den größten Teil, eine Event-Zahl fehlt. Forum Sept. 2024: 220 BW-Weihnachtsmärkte
  im Knowledge Graph. Vollerhebung: 14 BW-Gemeinden mit erkanntem toubiz-Widget auf der
  eigenen Seite. In der Stichprobe 5 von 40 mit toubiz als Hauptfundort, davon 4 aus Stufe R.
* **Nächster Schritt:** Bei TMBW oder Land in Sicht einen eigenen Lese-Token mit
  Lizenzfilter (nur CC0, CC BY, CC BY-SA) anfragen; parallel im DZT Knowledge Graph messen,
  wie viele BW-Events dort ankommen. Fremde Tokens nicht benutzen.

### 2.7 NUSSBAUM und die übrigen Amtsblatt-Verlage

* **NUSSBAUM:** Beschreibung in [00-bundesweit.md](00-bundesweit.md) B2. Stichprobe: auf der
  Gemeindeseite belegt bei 10 von 40 (Nr. 1, 2, 9, 12, 13, 17, 18, 29, 37, 39), mit
  Suchtreffern 14 (zusätzlich 23, 32, 34, 40); Wiesenbach nur Anzeigen und Abo. Erkannt an
  „Nussbaum Medien“, `abo.nussbaum.de`, `nussbaum-lesen.de`, `lokalmatador.de/epaper`.
  nussbaum.de selbst nicht abgerufen.
* **Übrige Verlage in der Stichprobe:** Primo-Verlag Stockach (1 belegt, 4 Suchtreffer oder
  nur Anzeigen), Druck + Verlag Wagner (2, eine davon Suchtreffer), Dürrschnabel (2,
  Suchtreffer; Eigenangabe „29 Amtsblätter“), je einmal Krieger-Verlag, Druckservice Leyrer,
  Einhorn-Verlag, Feser-Druck (Suchtreffer), Medien-Centrum Ellwangen, Fink, NAK Ulm, KWG
  Druck & Medien, Restle (Suchtreffer), metropolmedia Häß; nicht belegt bei 7. Online gibt es
  diese Blätter als PDF oder E-Paper (`nak-epaper.de/?group=<n>`, `myeblaettle.de`).
* **Bewertung:** Für Termine nicht nötig. In jeder Gemeinde der Stichprobe mit eigenem
  Kalender stehen die Vereinsfeste schon dort; NUSSBAUM bleibt eine Lizenzfrage für die
  Gemeinden, deren Kalender leer ist (Vollerhebung R, BW 110).

### 2.8 Einzelfälle ohne Generic

* **Ortsportal „Aktiv in Hochdorf“** (https://www.aktiv-in.de/veranstaltungskalender,
  Drupal 10, Monatslisten `/JJJJMM`, November 2026 24 Termine, kein Feed): Dienst des
  Jugendhauses SKUNK (Kreisjugendring Esslingen e.V.) für die Gemeinde.
* **Hessigheim:** Nuxt-Seite, alle Termine im `window.__NUXT__` mit `datum_von`,
  `datum_bis` (UTC, Ganztag als 23:00Z des Vortags), `titel`, `veranstalter`,
  `veranstaltungsort`, `adresse.geokoordinaten`, `rubrik` („Feste & Märkte“),
  `reservix_id`, `vibus_*`. Die Seite lädt `analytics.webcontact.de`; webcontact GmbH
  bewirbt „Kommuneo“ als BW-Kommunal-CMS mit Veranstaltungsverwaltung für „über 40 Städte
  und Gemeinden“ (https://www.webcontact.de/cms-fuer-kommunen/), nennt Hessigheim aber nicht.
  Zuordnung nicht belegt.
* **Von Hand gepflegt:** Hohentengen (Akkordeon, rund 90 Termine im Jahr, das
  Contao-Modul `/de/veranstaltung.html` ist leer), Leibertingen (Elementor-Tabellen je
  Monat, Vereine tragen per Login ein), Weisweil (PDF-Jahreskalender, Beilage des
  Mitteilungsblatts; `pdftotext -raw` ordnet die Spalten richtig).
* **WordPress:** Au am Rhein (Beitragstyp `event`, REST-Route 404), Ebenweiler (EventON;
  REST ohne Termine, JSON-LD mit unsauberem `startDate` `2026-8-14T10:40+1:00`), Bad
  Liebenzell (Stadtseite mit The Events Calendar, `total: 1`, nur Baustelle).
* **Kreiskalender:** nur Landkreis Freudenstadt https://www.veranstaltungen-fds.de/ (von
  Empfingen verlinkt, nicht abgerufen). Weitere BW-Kreiskalender nicht gefunden.

## 3. Dorffest-Test

Je Quelle ein belegtes Beispiel; „nachgeprüft“ heißt von der Hauptsession selbst abgerufen.

| Quelle | Beispiel | Datum | Link |
|---|---|---|---|
| Hirsch & Wölfl | „Kirbe TV Tischardt“, Turnverein Tischardt, Frickenhausen (nachgeprüft) | 08.11.2026 | https://www.frickenhausen.de/freizeit-gaeste/veranstaltungskalender/715/kirbe-tv-tischardt |
| Hirsch & Wölfl | „Weihnachtsmarkt“ und „Kirchweihfest“, Auenwald | 05./06.12.2026 | https://www.auenwald.de/kultur-freizeit/veranstaltungen/kalender/55/weihnachtsmarkt/termin-117 |
| Cross7 | „Kärwe in Craintal und Reinsbronn“, Creglingen (API-ID 1860, `c7-item` 44699350) | 30.10. bis 02.11.2026 | https://www.creglingen.de/de/tourismus-freizeit/veranstaltungen-vereine/veranstaltungskalender |
| Cross7 | „55. Traditioneller Fasnetssonntagsumzug“, Bad Ditzenbach (`c7-item` 47666940) | 07.02.2027 | https://www.badditzenbach.de/veranstaltungen/veranstaltungskalender |
| Komm.ONE | „Waldenbucher Weihnachtsmarkt“ (51.), Kategorie Feste | 12.12.2026 | https://www.waldenbuch.de/site/Waldenbuch-Internet/node/13702713/zmdetail_523253003553/WaldenbucherWeihnachtsmarkt.html?nodeID=523253003553 |
| cEasy | „Herbst- und Schlachtfest“, Musikverein Mariazell, Eschbronn (nachgeprüft) | 08.11.2026 | https://www.eschbronn.de/de/Aktuelles/Veranstaltungskalender/Veranstaltung?view=publish&item=eventDate&id=2318 |
| cEasy | „Sontheimer Dorffest“, örtliche Vereine mit der Gemeinde | 17./18.07.2027 | https://www.sontheim-brenz.de/de/Aktuelles/Veranstaltungen |
| hitcom Eventkalender | „Dorffest“, Elchesheim-Illingen | 04./05.07.2026 | https://www.elchesheim-illingen.de/termin/Dorffest-event-appointment3966 |
| verwaltungsportal.de | „Kerwe mit Hammeltanz in Vilchband“, Wittighausen | 08.11.2026 | https://www.wittighausen.de/veranstaltungen/2945881/2026/11/08/kerwe-mit-hammeltanz-in-vilchband.html |
| verwaltungsportal.de | „Weihnachtsmarkt“ Rathausplatz, Wiesenbach (nachgeprüft) | 05.12.2026 | https://www.wiesenbach-online.de/veranstaltungen/2847238/2026/12/05/weihnachtsmarkt.html |
| cm city media V4 | „Winzerfest“, Benningen | 28.11.2026 | https://www.benningen.de/de/gemeinde/entdecken/kalender |
| toubiz | „Weihnachtsmarkt Blumberg“ | 05.12.2026 | https://www.wutachschlucht.de/veranstaltung/weihnachtsmarkt-blumberg-a1edb76ab2 |
| toubiz | „Weihnachtsmarkt Bad Liebenzell“ | 12.12.2026 | https://www.schwarzwald-tourismus.info/veranstaltungen/weihnachtsmarkt-bad-liebenzell-77097d7956 |
| Ortsportal aktiv-in.de | „Hochdorfer Martinimarkt“, AG Hochdorfer Vereine | 07./08.11.2026 | https://www.aktiv-in.de/node/1069 |
| WordPress (Au am Rhein) | „Fasenachtseröffnung TV“ | 07.11.2026 | https://www.auamrhein.de/blog/event/fasenachtseroeffnung-tv/ |
| Nuxt (Hessigheim) | „Weihnachtsmarkt“ vor der Alten Kelter | 05./06.12.2026 | https://www.hessigheim.de/veranstaltungen/ |
| PDF (Weisweil) | „Kilwi“, Musikverein | 24./25.10.2026 | https://www.weisweil.de/wp-content/uploads/2026/01/Fertiger-Kalender.pdf |
| destination.one | BW im Fenster: 18 × „Weihnachtsmarkt“ im Titel (z. B. „Besigheimer Weihnachtsmarkt“), 1 × „Weinfest“ („Weinfest Schöpple“, Wertheim); 0 × Hocketse, Feuerwehrfest, Dorffest, Kirbe, Narrensprung | 28.10.2026 bis 27.10.2027 | Abfrage in Abschnitt 4 |

Nicht bestanden: EventON Ebenweiler (nur „Zweitakttreffen“), Komm.ONE Mutlangen (im Feed
kein Fest, nur Rückblick „Mutlanger Dorffest 2026“), Bollschweil (5 von rund 70 Terminen
gelesen). Ein Feuerwehrfest oder eine Hocketse stand in keiner Quelle im Prüfzeitraum
Ende Oktober; beide Festarten liegen im Sommer und sind in den Kalendern 2027 noch nicht
eingetragen. Feuerwehrtermine selbst sind belegt (Tannheim Jahreshauptprobe,
Schwenningen Kameradschaftsabend).

## 4. Abgleich destination.one

`https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json`
mit `q=city:"<Gemeinde>"` (ohne „, Stadt“), `startdate=28.10.2026`, `enddate=27.10.2027`,
40 Abfragen am 27.10.2026. Kontrollen: `city:"Weil der Stadt"` 2 Treffer, `city:"Pfatter"`
52 (wie im Querschnitt).

* **Ergebnis: 0 von 40 Stichprobengemeinden mit Treffer.** Die zwei Treffer für
  „Schwenningen“ („Weihnachtsmarkt Schwenningen“, PLZ 89443) gehören zu Schwenningen in
  Bayern, nicht zu Schwenningen 72477.
* **BW gesamt:** `area:"Baden-Württemberg"` 539 Events ohne Fenster, 400 im Fenster.
* **Festarten im Titel** (`area:"Baden-Württemberg" AND title:<Wort>`, Fenster):
  Weihnachtsmarkt 18, Weinfest 1, Hocketse 0, Feuerwehrfest 0, Dorffest 0, Kirbe 0,
  Narrensprung 0.

destination.one taugt in BW also nicht für Gemeindefeste; die BW-Tourismusdaten liegen in
toubiz, nicht in destination.one.

## 5. Abdeckung (Stichprobenanteile)

Anteil p = k / 40, 95-%-Intervall nach Wilson
(p + z²/2n ± z·√(p(1−p)/n + z²/4n²)) / (1 + z²/n), z = 1,96. Zum
Vergleich der Anteil in der Vollerhebung unter den 839 BW-Gemeinden unter 10.000 EW.

| Merkmal | Stichprobe | 95 % | Vollerhebung (< 10.000 EW) |
|---|---|---|---|
| Kalender auf der eigenen Website | 34/40 = 85,0 % | 70,9 bis 92,9 % | Stufen A bis E: 754/839 = 89,9 % |
| Hirsch & Wölfl (Merkmal) | 15/40 = 37,5 % | 24,2 bis 53,0 % | 297/839 = 35,4 % |
| Hirsch & Wölfl mit eigenem Kalenderinhalt | 13/40 = 32,5 % | 20,1 bis 48,0 % | nicht gemessen |
| Cross7 | 4/40 = 10,0 % | 4,0 bis 23,1 % | 103/839 = 12,3 % |
| Komm.ONE | 3/40 = 7,5 % | 2,6 bis 19,9 % | 78/839 = 9,3 % |
| hitcom (cEasy und Eventkalender) | 5/40 = 12,5 % | 5,5 bis 26,1 % | cEasy 50/839 = 6,0 % |
| verwaltungsportal.de | 2/40 = 5,0 % | 1,4 bis 16,5 % | 34/839 = 4,1 % |
| Listen-Feed ohne Parser je Gemeinde (Cross7, Komm.ONE) | 7/40 = 17,5 % | 8,7 bis 32,0 % | 181/839 = 21,6 % |
| toubiz als Hauptfundort | 5/40 = 12,5 % | 5,5 bis 26,1 % | toubiz erkannt 9/839 = 1,1 % |
| Amtsblatt bei NUSSBAUM (belegt / mit Suchtreffern) | 10/40 = 25,0 % / 14/40 = 35,0 % | 14,2 bis 40,2 % / 22,1 bis 50,5 % | nicht erhoben |
| destination.one mit mindestens einem Termin | 0/40 = 0 % | 0 bis 8,8 % | nicht erhoben |

Die Anteile der Vollerhebung liegen bei allen Herstellern außer toubiz im Intervall der
Stichprobe. Zu toubiz: Die Vollerhebung erkennt toubiz nur, wenn das Widget auf der
Gemeindeseite sitzt; vier der fünf toubiz-Gemeinden der Stichprobe stehen dort in Stufe R.
Die R-Gemeinden in BW (110) häufen sich in Breisgau-Hochschwarzwald (16), Alb-Donau-Kreis
(11), Waldshut (7) und Rottweil (6); ob dort jeweils toubiz-Portale tragen, ist nur für die
vier Stichprobengemeinden belegt.

## 6. Priorisierte Integrationsliste Baden-Württemberg

Reihenfolge wie im Querschnitt: Datenqualität vor Menge, dann Gemeinden je Integration,
dann Rechtslage. Gemeindezahlen aus der Vollerhebung (BW gesamt).

| # | Integration | BW-Gemeinden | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | Cross7 JSON-API | 120 | Datum, Uhrzeit, Kategorie; Adresse lückenhaft, keine Koordinaten; Abfuhrtermine mischen sich ein | Bedingungen nicht belegt, API schlüsselfrei | Anfrage cm city media (wie Querschnitt), Adapter mit Kategoriefilter |
| 2 | Hirsch & Wölfl `hwveranstaltung` | 345 | Titel, Datum, Uhrzeit, Veranstalter, Ort, Kategorie, teils OSM-Koordinaten; viele Vereinsfeste | robots.txt lässt Kalender frei, Bedingungen nicht belegt | Adapter für beide Modulversionen; Hersteller nach Feed und Kundenliste fragen |
| 3 | Komm.ONE RSS | 137 | hCalendar mit Ort und Veranstalter; Item-Limit 15 bis 50 je Mandant; teils nur Gemeinde-Dienste | Crawl-delay 30 | Adapter RSS plus `zmkat_`-Seiten; Item-Limit bei Komm.ONE erfragen |
| 4 | cEasy (hitcom) | 92 | JSON-LD mit Adresse, iCal je Termin | robots.txt frei | Adapter Liste plus JSON-LD |
| 5 | verwaltungsportal.de | 34 | JSON-LD, nur Datum, teils Adresse | ClaudeBot Crawl-delay 10 | bundesweiter Adapter ([01](01-vollerhebung.md) Nr. 13) |
| 6 | cmcitymedia ohne Cross7 | 27 | Druckansicht mit Datum, Uhrzeit, Ort | Exchange-Host per robots.txt gesperrt | nur Druckansicht auf der Gemeindeseite, sonst Anfrage cm city media |
| 7 | Allgemeiner Parser (Stufen D und E) | 133 | je Seite verschieden | je Seite | Registry mit Kalender-URL; Korrekturen aus Abschnitt 1 übernehmen |
| 8 | toubiz (TMBW, Regionen) | 14 erkannt, dazu Schwarzwald-Gemeinden aus R | Termine mit Koordinaten, Lizenz je Datensatz | Token je Kunde, Bedingungen nicht belegt | Lese-Token mit Lizenzfilter bei TMBW anfragen; DZT-Graph messen |
| 9 | NUSSBAUM | „>380“ (Eigenangabe) | Event-Seiten mit Koordinaten (Querschnitt B2) | KI-Crawler gesperrt, keine Lizenz | Lizenzanfrage (Querschnitt), nur für Gemeinden ohne Kalender wichtig |
| | Nicht weiter verfolgen | | | | destination.one für Gemeindefeste (0 von 40), übrige Amtsblatt-Verlage (PDF), Gemeinde-Apps (lesen aus demselben CMS) |

Mit 1 bis 6 sind in BW 755 Gemeinden über bekannte Hersteller erreichbar (Vollerhebung,
Summe der Zeilen), mit dem allgemeinen Parser 888 von 1.101.

## 7. Lücken

* Kundenzahl und Nutzungsbedingungen von Hirsch & Wölfl, cEasy, Cross7 und Komm.ONE nicht
  belegt; Zahlen nur aus der Vollerhebung (Merkmal auf der Website).
* toubiz: kein selbst abgerufener Datensatz über die API, Event-Zahl je Gemeinde nicht
  belegt, Nutzungsbedingungen für Dritte nicht belegt.
* NUSSBAUM-Anteil nur über Gemeindeseiten und Suchtreffer; ob NUSSBAUM für diese Gemeinden
  Termine online führt, nicht geprüft (robots.txt).
* Feuerwehrfest und Hocketse ohne Beleg im Prüfzeitraum (Saison).
* Verlag des Amtsblatts bei 7 Gemeinden nicht belegt.
* Kreiskalender außer Freudenstadt nicht recherchiert; Landesfeuerwehrverband BW und
  Narrenverbände (Fasnet-Termine) nicht recherchiert.
* Hersteller von Hessigheim (webcontact Kommuneo?) nicht bestätigt.

## 8. Was der User selbst tun muss

1. Hirsch & Wölfl: Feed oder Export für `hwveranstaltung`, Kundenliste, Nutzung.
2. TMBW bzw. Land in Sicht: eigener Lese-Token für toubiz-Events mit Lizenzfilter.
3. Komm.ONE (cms@komm.one): Kundenliste, RSS-Item-Limit.
4. Wie im Querschnitt: cm city media (Cross7), NUSSBAUM (Lizenz).

## 9. Anfragen

Alle Anfragen mit URL und Statuscode:
[04-baden-wuerttemberg-anfragen.md](04-baden-wuerttemberg-anfragen.md). Ein Verstoß ist
dort benannt: ein Abruf von `exchange.cmcitymedia.de/benningen/calendarV4_0/data/config.js`
trotz `Disallow: /` (im selben Befehl wie die robots.txt, danach keine Anfrage mehr an den
Host, Inhalt nicht verwendet). An meta.et4.de gingen 57 Anfragen (Zählung je Gemeinde), an
alle anderen Hosts höchstens 8.
