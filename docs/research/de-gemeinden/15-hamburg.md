# Hamburg: Stadtteiltermine und Stadtteilfeste (Stand 2026-10-29)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.16`. Methode und Format: Epic-Spec
`fn-28-de-gemeindekalender-dorffeste-in-jeder`. Bundesweite Anbieter stehen in
[00-bundesweit.md](00-bundesweit.md), die Ausgangslage in
[../deutschland-event-quellen-2026-10.md](../deutschland-event-quellen-2026-10.md);
beide werden hier nur verlinkt und um die Hamburger Sicht ergänzt.

Arbeitsweise: nur lesende GET-Anfragen und Websuche, keine Konten, keine Formulare,
keine Mails. Jede Zahl stammt aus einer eigenen Antwort vom 29.10.2026 oder aus einer
verlinkten Seite. „Eigenangabe“ heißt Aussage des Betreibers, „selbst gezählt“ heißt
aus einer abgerufenen Antwort gezählt. Unbelegtes steht als „nicht belegt“ da.

Hamburg ist eine einzige Gemeinde (AGS 02000000) mit 7 Bezirken. Die Stichprobe zieht
deshalb Stadtteile statt Gemeinden.

## Kurzfazit

1. **Es gibt einen zentralen Datenweg, und er ist offen für Partner:** Die
   Veranstaltungsdatenbank Hamburg & Metropolregion der Hamburg Tourismus (imx) speist
   hamburg.de, hamburg-tourism.de und veranstaltungen.hamburg. Laut Betreiber ist der
   tägliche XML-Feed kostenfrei, mit Nutzungsvereinbarung, Filtern nach Wunsch und
   hinterlegter Eventim-Affiliate-ID. Mit Ort Hamburg meldet der Gesamtkalender 9.038
   Veranstaltungen. Stadtteilkultur, Nordkirche, Bücherhallen und VHS liefern schon ein.
   Das ist für Hamburg die erste Integration (G1).
2. **Lokale Feste fehlen dort weitgehend.** Suche Ort Hamburg ab 29.10.2026:
   „Laternenumzug“ 2, „Feuerwehr“ 4 (davon ein Feuerwehrtermin), „Stadtteilfest“ 3,
   „Erntefest“, „Dorffest“, „Feuerwehrfest“ je 0. Belegt sind dort Großfeste wie das
   Stadtfest St. Georg und das Osterstraßenfest; das Erntedankfest Kirchwerder stand
   als Seite bei hamburg-tourism.de (nach dem Termin 404).
3. **Die Stadtteilfeste stehen verstreut bei Vereinen, ohne gemeinsames System.** In
   der Stichprobe von 30 Stadtteilen ist der Hauptfundort je 5 Mal die Freiwillige
   Feuerwehr und ein Stadtteilkultur- oder Kulturverein, 6 Mal ein Bürger- oder
   Heimatverein, 3 Mal ein Stadtteilportal, 3 Mal eine Kirchengemeinde, 2 Mal ein
   Stadtteilmarketing, einmal ein Schützenverein; 5 Stadtteile haben keinen
   öffentlichen Fundort (Uhlenhorst, Marienthal, Hohenfelde, Hoheluft-West, Wilstorf).
   Nur 4 von 30 haben einen Terminfeed mit kommenden Terminen (3 × WordPress The Events
   Calendar, 1 × Modern Events Calendar).
4. **Die Freiwilligen Feuerwehren haben eine gemeinsame Website mit Terminrubrik**
   (feuerwehr-hamburg.de, alle 86 Wehren, G2), aber gepflegt wird sie lückenhaft: am
   29.10.2026 5 kommende Termine, während die Redaktionsliste von hamburg.de 13
   Laternenumzüge 2026 nennt und die Seiten der FF Schnelsen und Lemsahl-Mellingstedt
   eigene Laternenumzüge ankündigen, die zentral fehlen.
5. **destination.one deckt Hamburg nicht ab:** 0 von 30 Stadtteilen, Hamburg gesamt 5
   Events. Das Transparenzportal hat keine Termindaten, nur Sondermittel-Beschlüsse der
   Bezirke (welche Feste gefördert werden). Bezirksämter haben keine Kalender.
   Lokalzeitungen (Abendblatt mit Wochenblatt und Bergedorfer Zeitung) sperren
   Claude-Bots per robots.txt.

Empfehlung: zuerst G1 per Nutzungsvereinbarung, dazu als Ergänzung G2 (ein Parser für
86 Wehren) und die vier Vereinsfeeds; die Lücke bei Stadtteilfesten lässt sich am
besten schließen, indem Vereine ihre Feste in G1 eintragen, nicht durch Dutzende
Einzelscraper.

## Stichprobe

**Ziehung (reproduzierbar):** Datensatz „Regionalstatistische Daten der Stadtteile
Hamburgs“ (Statistikamt Nord über das Transparenzportal,
https://suche.transparenz.hamburg.de/dataset/regionalstatistische-daten-der-stadtteile-hamburgs23,
Lizenz dl-de/by-2-0), CSV aus dem WFS-Download
`https://geodienste.hamburg.de/download?url=https://geodienste.hamburg.de/wfs_regionalstatistische_daten_stadtteile&f=csv`,
Datei `de_hh_up_regionalstatistische_daten_stadtteile_EPSG_4326.csv`. Zeilen mit
`jahr` = 2025 (`jahr_date` 2025-12-31): 99 Einheiten. Hamburg hat mehr Stadtteile;
der Datensatz fasst vier Paare zusammen (Steinwerder/Kl. Grasbrook,
Waltershof/Finkenwerder, Neuland/Gut Moor, Moorburg/Altenwerder), Neuwerk fehlt. Die 99
nach `stadtteil_nr` sortiert, dann `random.Random(28016).sample(liste, 30)` (Python
3.14.2). Seed 28016 = fn-28, Ticket 16. Keine Einwohnergrenze, weil es in Hamburg
keine kleinen Gemeinden gibt; die ländlichen Stadtteile der Vier- und Marschlande und
Harburgs sind trotzdem vertreten (Kirchwerder, Ochsenwerder, Neuengamme, Marmstorf,
Neugraben-Fischbek, Finkenwerder).

**Spalten:** Nr. = Statistik-Nummer des Stadtteils (statt AGS, Hamburg hat nur AGS
02000000). EW = `bev_insgesamt` dieses Datensatzjahrs. Fundort = Hauptfundort-Klasse
für lokale Termine. FF zentral = Stadtteiltermin 2026 auf feuerwehr-hamburg.de (G2).
d.one = Hamburger Treffer bei destination.one, Fenster 29.10.2026 bis 28.10.2027.
Kommend = Termine ab 29.10.2026 in der genannten Quelle, sofern abgezählt. Belege je
Zeile stehen in [15-hamburg-anfragen.md](15-hamburg-anfragen.md).

| # | Stadtteil (Nr.) | Bezirk | EW | Fundort | CMS/Plattform | Kalender | Feed/Struktur (kommend) | FF zentral | d.one |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Sülldorf (213) | Altona | 9.259 | Freiwillige Feuerwehr | WordPress (FF Sülldorf-Iserbrook, Förderverein); Bürgerverein Jimdo; suelldorf.de Joomla | https://www.ff-suelldorf-iserbrook.de/termine | HTML-Tabelle, Termine nur mit Monat (3) | ja | 0 |
| 2 | Marmstorf (708) | Harburg | 9.519 | Schützenverein | WordPress | https://www.der-marmstorfer-schuetzenverein.de/alle-termine-im-ueberblick/ | HTML-Liste (8); iCal-Datei nur Stand 2025 | nein | 0 |
| 3 | Uhlenhorst (406) | Hamburg-Nord | 19.271 | nirgends öffentlich (Bürgerverein nur mit Login) | Contao (HUBV) | https://www.hubv.de/ | keiner (0) | nein | 0 |
| 4 | Heimfeld (710) | Harburg | 23.219 | Stadtteilverein (Blog) | WordPress | https://heimfeld.de/ | RSS nur Beiträge (0) | nein | 0 |
| 5 | Marienthal (503) | Wandsbek | 13.846 | nirgends gefunden | FF Wandsbek-Marienthal WordPress, nur Berichte | keiner | keiner (0) | nein | 0 |
| 6 | Lurup (208) | Altona | 38.237 | Stadtteilkultur (Stadtteil-Kultur-Büro, unser-lurup.de) | WordPress (Divi) | https://unser-lurup.de/ | Fließtext; RSS leer (3) | nein | 0 |
| 7 | Lemsahl-Mellingstedt (513) | Wandsbek | 7.043 | Heimatverein (Heimatbund) | WordPress; FF IONOS MyWebsite Now | https://heimatbund-lm.de/aktuelles/ | Fließtext (3), FF-Seite (1) | nein | 0 |
| 8 | Schnelsen (307) | Eimsbüttel | 31.670 | Stadtteilportal (Quartier Schnelsen-Süd) | WordPress Modern Events Calendar; IG Herz von Schnelsen WordPress; FF Wix | https://schnelsen-sued.de/veranstaltungen/ | MEC-RSS `/events/feed/` und JSON-LD (10, fast nur Kurse) | nein | 0 |
| 9 | Kirchwerder (606) | Bergedorf | 10.458 | Lokalportal Vier- und Marschlande (vierlanden.de) | Eigen-CMS (`/pages/<id>-…`); Erntedankfest-Verein WordPress | https://vierlanden.de/pages/3-veranstaltungen | keiner (1) | ja | 0 |
| 10 | Eppendorf (402) | Hamburg-Nord | 25.067 | Bürgerverein (Berichte) | CM4all | https://der-eppendorfer.de/ | keiner (nicht zählbar) | nein | 0 |
| 11 | Billstedt (112) | Hamburg-Mitte | 73.206 | Bürgerverein | HomepageFIX; BilleVue TYPO3 | https://www.buergerverein-billstedt.de/veranstaltungen.html | Seite ohne Text (nicht zählbar) | ja (Öjendorf) | 0 |
| 12 | Harvestehude (303) | Eimsbüttel | 17.652 | Kirchengemeinde | WordPress (St. Johannis) | https://stjohannis.hamburg/termine/ | RSS nur Beiträge (etwa 25 Zeilen) | nein | 0 |
| 13 | Ochsenwerder (607) | Bergedorf | 3.053 | Stadtteilportal (ochsenwerder.de) | statisches HTML (Dreamweaver Spry) | https://ochsenwerder.de/terminkal.html | keiner (3) | nein | 0 |
| 14 | St. Georg (105) | Hamburg-Mitte | 12.557 | Bürgerverein mit Stadtfest-Website | WordPress (Bürgerverein), Wix (Stadtfest); Stadtfest auch in G1 | https://stadtfest-stgeorg.de/ | keiner (0); G1 JSON-LD für Stadtfest 2027 | nein | 0 |
| 15 | Bergedorf (602) | Bergedorf | 37.392 | Stadtteilmarketing (WSB) und Portal mein-bergedorf.de | TYPO3 (WSB); WordPress mit Widget `hht.whitelabel.imxplatform.de` (= G1) | https://mein-bergedorf.de/veranstaltungen/ | G1-Widget, clientseitig (nicht zählbar) | nein | 0 |
| 16 | Hohenfelde (407) | Hamburg-Nord | 10.135 | nirgends öffentlich | Contao (HUBV) | keiner | keiner (0) | nein | 0 |
| 17 | Bergstedt (516) | Wandsbek | 10.798 | Heimatverein (Heimatring Bergstedt) | WordPress The Events Calendar | https://bergstedt.hamburg/veranstaltungen/ | Tribe-REST (3), iCal leer | nein | 0 |
| 18 | Hoheluft-West (304) | Eimsbüttel | 13.753 | nirgends gefunden | keiner | keiner | keiner (0) | nein | 0 |
| 19 | Horn (111) | Hamburg-Mitte | 39.393 | Stadtteilkultur (Horner Freiheit) | TYPO3 | https://www.hornerfreiheit.de/veranstaltungen | HTML-Liste mit Kategorien (etwa 196, meist Kurse) | nein | 0 |
| 20 | Finkenwerder (119/120) | Hamburg-Mitte | 11.441 | Kulturverein (Kulturkreis Finkenwerder) | WordPress The Events Calendar | https://www.kulturkreis-finkenwerder.de/events/ | Tribe-REST (10) | nein | 0 |
| 21 | Hamm (108) | Hamburg-Mitte | 39.210 | Stadtteilkultur (Kulturladen, hh-hamm.de) | WordPress The Events Calendar | https://hh-hamm.de/events/kategorie/veranstaltungen/ | Tribe-REST und iCal (13) | nein | 0 |
| 22 | Borgfelde (107) | Hamburg-Mitte | 8.901 | Kirchengemeinde | TYPO3 (Serviceportal kirche-hamburg.de) | https://serviceportal.kirche-hamburg.de/gemeinden/ev-luth-kirchengemeinde-st-georg-borgfelde/veranstaltungen.html | keiner (nicht gezählt, Gottesdienste) | nein | 0 |
| 23 | Eilbek (501) | Wandsbek | 22.849 | Kirchengemeinde | TYPO3 (Serviceportal); Bürgerverein statisch | https://serviceportal.kirche-hamburg.de/gemeinden/ev-luth-kirchengemeinde-eilbek-friedenskirche-osterkirche/veranstaltungen.html | keiner (Bürgerverein 2) | nein | 0 |
| 24 | Farmsen-Berne (506) | Wandsbek | 38.651 | Freiwillige Feuerwehr (FF Farmsen, FF Berne) | WordPress | https://ff-farmsen.de/ | RSS nur Beiträge (0) | ja | 0 |
| 25 | Iserbrook (212) | Altona | 11.480 | Freiwillige Feuerwehr (Sülldorf-Iserbrook) | WordPress | https://www.ff-suelldorf-iserbrook.de/termine | wie Nr. 1, Festplatz in Sülldorf | nein | 0 |
| 26 | Neuallermöhe (614) | Bergedorf | 23.169 | Stadtteilkultur (Bürgerhaus Allermöhe) | WordPress | https://www.buergerhaus-allermoehe.de/veranstaltungen/ | Fließtext (2) | nein | 0 |
| 27 | Neugraben-Fischbek (714) | Harburg | 35.512 | Freiwillige Feuerwehr (Neugraben, Fischbek) | WordPress; FF Fischbek statisch mit `/termine.json` | https://ff-neugraben.de/ | WP-REST nur Beiträge; `termine.json` (`date`, `title`, `subTitle`, 0 Feste) | nein | 0 |
| 28 | Wandsbek (502) | Wandsbek | 38.706 | Stadtteilmarketing (City Wandsbek e.V.) | WordPress (WPBakery) | https://wandsbek.de/aktuelles/wandsbeker-winterzauber-2026/ | Beiträge (1) | nein | 0 |
| 29 | Neuengamme (605) | Bergedorf | 3.734 | Freiwillige Feuerwehr | Joomla | https://ff-neuengamme.de/ | RSS mit Festbeitrag (1) | nein | 0 |
| 30 | Wilstorf (704) | Harburg | 18.168 | nirgends gefunden (nur Kirche, Lokalnachrichten) | harburg-aktuell.de WordPress | keiner | keiner (0) | nein | 0 |

Anmerkungen:
* Feuerwehrzuordnung: Eine Wehr mit dem Stadtteilnamen steht in der Dienststellenliste
  von feuerwehr-hamburg.de bei 18 der 30 Stadtteile (Sülldorf und Iserbrook über
  Sülldorf-Iserbrook, Marienthal und Wandsbek über Wandsbek-Marienthal, Billstedt und
  Horn über Billstedt-Horn). Keine eigene Wehr: Uhlenhorst, Heimfeld, Harvestehude
  (Gebiet der FF Pöseldorf), St. Georg, Hohenfelde, Hoheluft-West, Hamm, Borgfelde,
  Eilbek, Wilstorf, Neuallermöhe; Ochsenwerder wird von der FF Hohendeich versorgt
  (Ochsenwerder Elbdeich 325, Website antwortet mit HTTP 401).
* Öjendorf gehört zum Stadtteil Billstedt (Wikipedia „Hamburg-Billstedt“), daher zählt
  der „24. Öjendorfer Laternenumzug“ (13.11.2026) für Billstedt.
* Sülldorf und Iserbrook teilen Wehr, Bürgerverein und Termine; Festplatz und
  Feuerwache liegen in Sülldorf, deshalb FF zentral bei Iserbrook „nein“.
* Domains mit Stadtteilnamen sind oft keine Quellen: hoheluft-west.de und
  neugraben-fischbek.de geparkt, harvestehude.de, uhlenhorst.de, schnelsen.de und
  wilstorf.de zum Verkauf, borgfelde.de Hausverwaltung.
* Der Aggregator festivalsindeutschland.de ([00-bundesweit.md F](00-bundesweit.md),
  AGB verbieten Nutzung der Datenbank) ist auch als Lückenliste unzuverlässig: Er nennt
  das Heimfelder Stadtteilfest für den 03.09.2026, der Verein berichtete schon am
  07.07.2026 vom Fest (https://heimfeld.de/2026/kletterturm-beim-stadtteilfest/).

## Generics

### G1. Veranstaltungsdatenbank Hamburg & Metropolregion (Hamburg Tourismus, imx)

* **Betreiber:** Hamburg Tourismus GmbH (HHT). Die Datenbank entstand 2013 „auf
  Initiative der Freien und Hansestadt Hamburg“, ist seit 1. Juli 2014 online und wird
  von einer eigenen HHT-Redaktion betreut (https://www.hamburg.events/). Technik: imx
  Platform, Mandant `hht` (Bilder unter
  `imxplatform-cust-hht.fsn1.your-objectstorage.com`, Widget
  `hamburgwhl.infomaxnet.de`, Navigationspunkt „imx.EventManager“ auf hamburg.events).
* **Wer liefert ein:** Veranstalter über das Online-Formular `eingabe.mrh.events` oder
  per Schnittstelle. Belegte Schnittstellenpartner für Hamburg: Bücherhallen, Clubs,
  Hafen Hamburg Marketing, Hamburger Volkshochschule, Museen, Nacht der Kirchen,
  Hamburger Theater e.V., Hochschule für Musik und Theater, **Stadtkultur Hamburg e.V.
  („Termine der Hamburger Stadtteilkultur“)**; überregional ADFC, Reservix, CTS
  Eventim, Ticketmaster, Tix4Gigs, **Nordkirche** und **Termine Regional**
  (https://www.hamburg.events/veranstaltungsausgabe/datenlieferanten.html). In Q1 2026
  wurden die Quellen der Nachbarländer auf je eine Landesschnittstelle reduziert
  (gleiche Seite).
* **Menge:** Eigenangabe „über 20.000 Spielstätten“ und „mehr als 40.000 Termine pro
  Monat“ (https://www.hamburg.events/veranstaltungsausgabe.html), „über 450.000 Termine
  an rund 23.000 Veranstaltungsorten“ im Jahr und „mehr als 300 Kalender“
  (https://www.hamburg-tourism.de/business-medien/hamburg-tourismus-gmbh/ueber-die-hamburg-tourismus-gmbh/marketing/marktmanagement/).
  Selbst gezählt: Der Gesamtkalender mit Ort Hamburg meldet „9038 Veranstaltungen
  gefunden“
  (https://www.veranstaltungen.hamburg/VADB_gesamtkalender/events/list?locationId=1&locationName=Hamburg&locationType=Location);
  das hamburg.de-Widget meldet 4.998 Veranstaltungen vom 29.10.2026 bis 28.10.2027 und
  551 allein am 29.10.2026.
* **Ausspielung in Hamburg:** hamburg.de (Seite „Veranstaltung eintragen“: wer in den
  Kalender von hamburg.de will, trägt in die Datenbank der Hamburg Tourismus ein,
  https://www.hamburg.de/kultur/veranstaltungen/veranstaltungen-eintragen-403732),
  hamburg-tourism.de (Detailseiten mit dem Satz „Dies ist ein Eintrag aus der
  Veranstaltungsdatenbank für die Metropolregion Hamburg“) und der neue Gesamtkalender
  www.veranstaltungen.hamburg. Die Bezirksämter haben keinen eigenen Kalender
  (Bezirksamt Bergedorf, Seite „Freizeit und Kultur“ ohne Terminliste,
  https://www.hamburg.de/politik-und-verwaltung/bezirke/bergedorf/themen/freizeit-kultur).
* **Zugriffsweg:** drei Wege laut Betreiber
  (https://www.hamburg.events/veranstaltungsausgabe.html): Kalendermodul (Script oder
  eigenständige Seite, kostenfrei), **Datenexport als XML-Feed** („vorkonfigurierter
  Feed“, Abruf „einmal täglich über einen definierten Endpunkt“, nach Vollimport nur
  neue und geänderte Datensätze, kundenspezifische Filter, „bereits um Dublikate und
  unerwünschte Inhalte bereinigt“), in Ausnahmefällen API
  (https://www.hamburg.events/veranstaltungsausgabe/datenexport.html). „Die Nutzung der
  Daten-Services der Veranstaltungsdatenbank ist kostenfrei“, Ausnahme Kinodaten von
  Tel-A-Vision. Affiliate-IDs für CTS Eventim, Reservix und Ticketmaster hinterlegt die
  HHT im System
  (https://www.hamburg.events/veranstaltungsausgabe/technische-informationen.html).
  Ohne Vereinbarung lesbar ist nur das HTML der Ausgabeseiten.
* **Echte Felder (Probe):** Detailseiten von veranstaltungen.hamburg tragen JSON-LD
  `@type: Event` mit `identifier`, `name`, `description`, `eventStatus`,
  `eventAttendanceMode`, `startDate` mit Offset (`2027-05-22T12:00+02:00`), `endDate`,
  `image[]` (`url`, `width`, `height`, `name`), `location` (`name`, `identifier`,
  `address` mit `streetAddress`, `postalCode`, `addressLocality`, `addressCountry`,
  `geo.latitude/longitude`), `organizer`, `contributor`, `isAccessibleForFree`,
  `offers` (`price`, `priceCurrency`). Ein Termin je JSON-LD-Objekt. Beispiel
  „Stadtfest St. Georg“, `identifier` 1378119, Lange Reihe 20099, 22.05.2027 12:00
  (https://www.veranstaltungen.hamburg/VADB_gesamtkalender/events/detail/stadtfest-st-georg-2027).
  Schwächen in der Probe: Veranstalter oft „Angaben nicht vorhanden“ mit Platzhalter-PLZ
  `00000`; Bilder aus Eventim-Daten nur 222 × 222. Laut Betreiber gibt es Kategorien
  (u. a. `14` Straßenfeste, `107` Feste, `15` Jahrmärkte, `58` Weihnachtsmärkte,
  https://www.hamburg.events/datennutzer/kateg.html), Merkmale, Termin-Meta-Tags
  (abgesagt, verschoben, ausgebucht), eine automatische Qualitätsbewertung und eine
  Ortsentität je Spielstätte über die PLZ
  (https://www.hamburg.events/veranstaltungsausgabe/technische-informationen.html). Die
  Feldnamen des XML-Feeds selbst sind nicht belegt.
* **Lizenz, AGB, robots:** Für den Feed „schließen wir eine entsprechende
  Nutzungsvereinbarung ab“ (Datenexport-Seite); deren Inhalt ist nicht belegt.
  Maschinelle Übersetzungen müssen als solche gekennzeichnet werden (technische
  Informationen). Bildlizenzen stehen je Bild in der Liste (gesehen: „CC0“, „CC-BY-SA“
  mit Urheber). robots.txt: hamburg.events sperrt nur `/contao/`; veranstaltungen.hamburg
  `Crawl-delay: 5`, sperrt `/_nuxt/` und `/assets/`; hamburgwhl.infomaxnet.de
  `Crawl-delay: 5`, sperrt u. a. `/data/` und `/ServiceInterface/`. Die Datenquellen
  enthalten Ticketmaster; Ticketmaster ist für uns gestrichen, also im Feed-Filter
  ausschließen.
* **Abdeckung lokaler Feste:** schwach. Suche im Gesamtkalender, Ort Hamburg, ab
  29.10.2026 (Abfragen in [15-hamburg-anfragen.md](15-hamburg-anfragen.md)): „Feuerwehr“ 4 Treffer, davon ein
  Feuerwehrtermin; „Laternenumzug“ 2; „Stadtteilfest“ 3 und „Straßenfest“ 3 (Osterstraßenfest
  Eimsbüttel 2027, Stadtfest St. Georg 2027, eine Stadtführung bzw. „Frühlingserwachen“);
  „Erntefest“, „Erntedank“, „Dorffest“, „Feuerwehrfest“, „Sommerfest“ je 0. Zum
  Vergleich nennt die gemeinsame Seite der Freiwilligen Feuerwehren für dieselbe Zeit 5
  kommende Laternenumzüge (G2). Stark ist die Datenbank bei Kirche (Nordkirche-Schnittstelle:
  viele Treffer der Stadtteilsuche sind Gottesdienste), Stadtteilkultur, Museen,
  Theater und Ticketing.
* **Beispiele für drei Stadtteile:** St. Georg (Stadtfest, Link oben), Eimsbüttel
  (https://www.veranstaltungen.hamburg/VADB_gesamtkalender/events/detail/osterstrassenfest-in-hamburg-eimsbuettel-2027,
  `identifier` 1466730, Osterstraße 20259, 01.05.2027), Niendorf
  (https://www.veranstaltungen.hamburg/VADB_gesamtkalender/events/detail/laternenumzug-der-ff-niendorf,
  31.10.2026 16:00, Fuhlsbütteler Weg 5, 22453 Hamburg).
* **Bewertung:** hoch. Eine Vereinbarung deckt ganz Hamburg und die Metropolregion,
  mit Adresse, Koordinaten, Kategorien, Absage-Status und Eventim-Affiliate. Für
  Stadtteilfeste reicht sie allein nicht.

### G2. Gemeinsame Website der Freiwilligen Feuerwehren (feuerwehr-hamburg.de)

* **Betreiber:** „© FF Hamburg“, Westphalensweg 1, 20099 Hamburg (Fußzeile
  https://www.feuerwehr-hamburg.de/). Die Seite führt alle Wehren unter „Dienststellen“:
  86 Namen, selbst gezählt, passend zu den 86 Wehren im Jahresbericht 2024 der
  Feuerwehr Hamburg
  (https://www.hamburg.de/politik-und-verwaltung/behoerden/behoerde-fuer-inneres-und-sport/presseservice/pressemeldungen/jahresbericht-2024-der-feuerwehr-hamburg-1069006).
* **Zugriffsweg:** WordPress mit eigenem Beitragstyp `veranstaltung`
  (https://www.feuerwehr-hamburg.de/veranstaltung/), Kategorien unter
  `/veranstaltungskategorie/<slug>/` (u. a. `laternenumzug`, `stadtteil-strassenfest`,
  `sommerfest`, `erntedank-fest-umzug`, `osterfeuer`, `weihnachtsveranstaltung`,
  `tag-der-offenen-tuer`), RSS `https://www.feuerwehr-hamburg.de/veranstaltung/feed/`
  (10 Einträge, `pubDate` ist das Veröffentlichungsdatum, nicht der Termin) und
  Sitemaps `veranstaltung-sitemap.xml`, `veranstaltung-sitemap2.xml`. Der Beitragstyp
  ist in der REST-API nicht freigegeben (`/wp-json/wp/v2/types` listet ihn nicht).
* **Echte Felder (Probe):** Die Detailseite trägt Datum und Kategorie im Kopf, dann
  Freitext mit „Am <Datum> um <Uhrzeit> Uhr.“, „Ort:“ und „Veranstalter:“. Beispiel
  „54. Feuerwehrfest in Sülldorf“: 11.09.2026, Kategorie „Sommerfest“, „Ort: Festwiese
  am S-Bhf. Sülldorf“, „Veranstalter: FF Sülldorf-Iserbrook“
  (https://www.feuerwehr-hamburg.de/veranstaltung/54-feuerwehrfest-in-suelldorf/).
  Keine Koordinaten, keine PLZ als Feld; im Freitext teils Adresse („Maienweg 119,
  22297 Hamburg“, FF Alsterdorf).
* **Menge:** 1.423 Terminbeiträge in den Sitemaps (selbst gezählt), mit Änderungsjahr
  2026: 26, 2025: 42, 2024: 37; die meisten stammen aus 2003 bis 2018. Kommend ab
  29.10.2026 auf der Übersicht: 5 (Laternenumzüge der FF Kirchwerder Nord 30.10., FF
  Osdorf 07.11., FF Rissen 07.11., Öjendorf 13.11., FF Alsterdorf 29.11.2026). Im Slug
  der Sitemaps: 344 × „latern“, 196 × „oster“, 190 × „fest“, 56 × „weihnacht“.
* **Lizenz, AGB, robots:** robots.txt sperrt nur `/wp-admin/`. Fußzeile „Alle Rechte
  vorbehalten“; eine Datennutzungsregel für Dritte ist nicht belegt.
* **Beispiele für drei Stadtteile:** Kirchwerder
  (https://www.feuerwehr-hamburg.de/veranstaltung/laternenumzug-der-ff-kirchwerder-nord/),
  Rissen (https://www.feuerwehr-hamburg.de/veranstaltung/laternenumzug-der-ff-rissen-4/),
  Sülldorf (Link oben).
* **Bewertung:** mittel. Ein Parser, eine Website, alle 86 Wehren; die Wehren tragen
  aber nur einen Teil ihrer Feste ein (Stichprobe unten), und Ort und Zeit stecken im
  Freitext.

### G3. Stadtteilkultur, Kirche, Termine Regional: über G1 statt einzeln

* **Stadtkultur Hamburg e.V.** (Dachverband der Stadtteilkulturzentren): WordPress
  (`generator` „WordPress 7.1.4“, https://www.stadtkultur-hh.de/), in den Sitemaps nur
  Beiträge und Seiten, kein eigener Terminkalender gefunden. Die Termine der
  Stadtteilkultur gehen per Schnittstelle in G1 (Datenlieferanten-Seite).
* **Nordkirche:** zentrale Kirchendatenbank nur mit Zugangsdaten
  ([../deutschland-event-quellen-2026-10.md](../deutschland-event-quellen-2026-10.md),
  Abschnitt „Auf Anfrage, ohne belegten offenen Zugang“), liefert aber in G1 ein. kirche-hamburg.de: robots.txt
  sperrt URLs mit Parametern (`Disallow: /*?`), nicht weiter abgerufen.
* **Termine Regional:** liefert in G1 ein; Anbieter und Kosten in
  [00-bundesweit.md C6](00-bundesweit.md).
* **Bewertung:** kein eigener Generic, sondern Gründe, G1 zu nehmen.

### G4. Transparenzportal und Urban Data Platform

* **Transparenzportal:** Kein Datensatz mit Veranstaltungsterminen gefunden (Suchen
  „Straßenfest“, „Stadtteilfest“, „Veranstaltungskalender“, „Veranstaltungsdatenbank“
  über https://suche.transparenz.hamburg.de/dataset?q=…). Nutzbar ist es als
  **Lückenliste**: Die Bezirksversammlungen veröffentlichen dort ihre Beschlüsse über
  Sondermittel, z. B. „Vergabe von Sondermitteln“ an den Volksdorfer Stadtteilfest
  e.V. (Drucksache 22-3469, Wandsbek, 22.04.2026, Lizenz „Datenlizenz Deutschland
  Namensnennung 2.0“,
  https://suche.transparenz.hamburg.de/dataset/bezirk-wandsbek-drucksache-22-3469). So
  lässt sich feststellen, welche Feste und Vereine es gibt, Termine stehen dort nicht.
  robots.txt sperrt `/api/` und verlangt `Crawl-delay: 10`.
* **Urban Data Platform / Geoportal:** Die Stadtteilliste für die Stichprobe kam von
  dort (WFS-Download, siehe Stichprobe). Ein Veranstaltungslayer ist nicht belegt; der
  Datensatz „Eventlotse Hamburg“ beschreibt laut Suchtreffer im GDI-DE-Katalog Flächen
  für Veranstaltungen, keine Termine (nicht selbst abgerufen). geodienste.hamburg.de sperrt per robots.txt nur den
  Bot „spatineo“.
* **Bewertung:** niedrig für Termine; Sondermittel-Beschlüsse als Lückenliste.

### G5. Lokalzeitungen

* **Hamburger Wochenblatt** (hamburger-wochenblatt.de leitet auf
  https://www.abendblatt.de/marktplatz/hamburgerwochenblatt) und **Bergedorfer
  Zeitung** (bergedorfer-zeitung.de leitet auf https://www.abendblatt.de/bergedorf/)
  gehören zum Abendblatt-Auftritt. Dessen robots.txt sperrt für ClaudeBot,
  Claude-Web, anthropic-ai, Claude-SearchBot u. a. `/*/article*.html`; nicht weiter
  abgerufen. elbe-wochenblatt.de: keine Verbindung.
* **Bewertung:** nicht nutzbar ohne Vereinbarung.

### G6. Stadtteilportale und Vereinsseiten

Kein Hersteller und kein Verband bedient mehrere Stadtteile; die Vereine bauen ihre
Seiten selbst. In der Stichprobe (Tabelle oben) wiederholen sich nur Plugins:

* **WordPress The Events Calendar (Tribe):** 3 von 30 (Hamm, Bergstedt, Finkenwerder).
  Offene REST `/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-10-29`,
  selbst nachgeprüft: `total` 13 (hh-hamm.de), 3 (bergstedt.hamburg), 10
  (kulturkreis-finkenwerder.de). Felder: `id`, `global_id`, `title`, `url`,
  `description`, `start_date`, `end_date`, `utc_start_date`, `timezone`, `all_day`,
  `cost`, `categories`, `tags`, `venue` (mit `zip`, z. B. 22395 Bergstedt, 21129
  Finkenwerder), `organizer`, `image`, `status`. iCal `?ical=1` bei Hamm vorhanden, bei
  Bergstedt 200 mit 0 Byte. Lizenz: Vereinsseiten ohne Datennutzungsregel, robots.txt
  ohne Sperre. Dorffest-Test: „Laternenumzug mit Feuerwerk“ Finkenwerder 09.10.2026
  (https://www.kulturkreis-finkenwerder.de/event/laternenumzug-mit-feuerwerk-tus-ab-sts-norderschulweg/),
  „Deichpartie 2026“ 29.08.2026; Bergstedt „Bunte Meile Bergstedt“ 03.05.2026
  (https://bergstedt.hamburg/bunte-meile-bergstedt-2026/). Das Hammer Sommerfestival
  (20. bis 30.08.2026, https://hh-hamm.de/sommerfestival/) steht als Seite, nicht im Feed.
* **WordPress Modern Events Calendar:** 1 von 30 (Schnelsen-Süd), RSS
  `https://schnelsen-sued.de/events/feed/` mit `mec:startDate`, `mec:endDate`,
  `mec:startHour`, `mec:location`, `mec:cost`, dazu JSON-LD `Event`; Inhalt fast nur
  Kurse und Beratung.
* **Serviceportal kirche-hamburg.de (TYPO3):** einheitliche Veranstaltungsseite je
  Gemeinde (Borgfelde, Eilbek, mitgelistet Hamm), kein Feed gefunden; die Nordkirche
  liefert ohnehin in G1.
* **Sonst je einmal:** Joomla mit RSS (FF Neuengamme, Festbeitrag „Tannenbaumfest
  12. Dezember 2026“, https://ff-neuengamme.de/index.php?view=article&id=225:tannenbaumfest-12-dezember-26&catid=2),
  Wix (FF Schnelsen, Stadtfest St. Georg), Jimdo, Contao, CM4all, IONOS, Hugo,
  HomepageFIX, statisches HTML, eine JSON-Datei (FF Fischbek).
* **Bewertung:** Ein Tribe-Detektor (Regeln aus [00-bundesweit.md D5](00-bundesweit.md))
  bringt in Hamburg wenig: 3 Vereine mit zusammen 26 kommenden Terminen. Nur als
  Beifang, nicht als eigenes Projekt.

### G7. Redaktionslisten von hamburg.de

* hamburg.de führt saisonale Übersichten, die Termine aus den Stadtteilen sammeln:
  „Laternenumzüge in Hamburg“ mit 13 Umzügen 2026 (Kirchwerder-Nord 30.10., Niendorf
  31.10., Wandsbek Gartenstadt 03.11., Berne, Lokstedt, Osdorf, Rissen 07.11., Harburg
  08.11., Öjendorf 13.11., Volksdorf 14.11., Groß Flottbek und Schnelsen 21.11.,
  Alsterdorf 29.11.; selbst gezählt,
  https://www.hamburg.de/freizeit/jahreszeiten/herbst/laternenumzug-hamburg-22840) und
  „Straßen- und Stadtteilfeste 2026“ (https://www.hamburg.de/freizeit/strassenfeste,
  am 29.10.2026 noch mit Erntedankfest Kirchwerder 3./4.10. und Winterdom).
* Felder: Ort, „Termin:“, „Treffpunkt:“ mit Adresse, Freitext. Meldung per Mail an
  presseinfo@hamburg.de, kein Feed. Nutzungsbedingungen von hamburg.de für Dritte nicht
  geprüft; robots.txt sperrt diese Pfade nicht.
* **Bewertung:** niedrig als Datenquelle (redaktionell, HTML, Rechte bei hamburg.de),
  aber der beste belegte Vollständigkeitsmaßstab für Laternenumzüge: 13 gegen 5 auf
  feuerwehr-hamburg.de und 2 in G1.

## Dorffest-Test (Übersicht)

| Quelle | Bestanden | Beleg |
|---|---|---|
| G1 Veranstaltungsdatenbank | ja, aber nur große Feste | „Stadtfest St. Georg“ 22.05.2027 (JSON-LD, Lange Reihe 20099); „Osterstraßenfest in Hamburg Eimsbüttel 2027“ 01.05.2027; „Laternenumzug der FF Niendorf“ 31.10.2026 (Links in G1). Erntefest, Dorffest, Feuerwehrfest: 0 |
| G2 feuerwehr-hamburg.de | ja | „54. Feuerwehrfest in Sülldorf“ 11.09.2026; „Laternenumzug der FF Kirchwerder Nord“ 30.10.2026; „24. Öjendorfer Laternenumzug“ 13.11.2026 |
| G6 Tribe-Vereinskalender | ja | Finkenwerder „Laternenumzug mit Feuerwerk“ 09.10.2026; Bergstedt „Bunte Meile“ 03.05.2026 |
| G7 hamburg.de-Listen | ja | 13 Laternenumzüge 2026; Erntedankfest Kirchwerder 3./4.10.2026 |
| Vereinsseiten ohne Feed | ja | Dorffest Lemsahl-Mellingstedt 22.08.2026 (https://heimatbund-lm.de/aktuelles/); Erntedankfest Kirchwerder 3./4.10.2026 (https://www.erntedankfest-kirchwerder.de/); Schnelsen-Fest 27.09.2026 (https://herzvonschnelsen.de/termine/); Laternenumzug FF Schnelsen 21.11.2026 (https://www.ff-schnelsen.de/post/laternenumzug-2026); Laternenumzug Schützenverein Marmstorf 24.10.2026 (https://www.der-marmstorfer-schuetzenverein.de/laternenumzug/); Tannenbaumfest FF Neuengamme 12.12.2026; Stadtfest St. Georg 23./24.05.2026 (https://stadtfest-stgeorg.de/); Fleetplatzfest Neuallermöhe (https://neuallermoehe.de/2026/06/18/fleetplatzfest-2026/) |
| destination.one | nein | kein Hamburger Fest im Fenster |
| Transparenzportal | nein (keine Termine) | nur Sondermittel-Beschlüsse, z. B. für den Volksdorfer Stadtteilfest e.V. |

Festarten in Hamburg: Laternenumzüge (fast immer mit oder bei der Freiwilligen
Feuerwehr), Feuerwehrfeste, Osterfeuer, Erntedankumzüge (Kirchwerder, Sülldorf),
Dorffeste (Lemsahl-Mellingstedt), Stadtteil- und Straßenfeste, Schützenfeste mit
Vogelschießen (Marmstorf, Ochsenwerder), Tannenbaumfeste und Advents- bzw.
Weihnachtsmärkte. Kirchweih, Kerwe oder Kirmes kamen in der Stichprobe nicht vor;
belegt ist eine „Karkmess“ (Finkenwerder, 04.06.2026, Kulturkreis-Feed). Weinfeste nur
als Vereinsfest („Weinfest der Lions“ Finkenwerder, 11.09.2026, Kulturkreis-Feed).

## Abgleich destination.one

Abfrage: `https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=50&q=city:"<Stadtteil>"&startdate=2026-10-29&enddate=2027-10-28`.

* **Stichprobe:** 0 von 30 Stadtteilen mit einem Hamburger Treffer. Zwei Namen
  liefern Treffer außerhalb Hamburgs (Horn 43, Hamm 7, keiner mit Area oder Ort
  Hamburg); sie zählen nicht.
* **Hamburg gesamt:** `q=area:"Hamburg"` ohne Fenster liefert 5 Events (wie im
  Ausgangsbericht): zwei Handpan-Workshops, ein Konzert „grandisinvolto gaudete!“
  (Hamburg Rahlstedt 22149, 28.11.2026), „World Of Bricks“ (Hamburg Altona-Altstadt
  22769, bis 01.11.2026) und „Elbe brennt“ (PLZ 21037, Intervall August 2024).
  `q=city:"Hamburg"` im 12-Monats-Fenster: 4, davon eines in Wentorf bei Hamburg
  (Schleswig-Holstein). Kein Stichprobenstadtteil ist darunter; 21037 deckt laut
  `data/plz-de.json` Allermöhe, Curslack, Kirchwerder, Neuengamme, Ochsenwerder,
  Reitbrook, Spadenland und Tatenberg; „Elbe brennt“ wird im Fenster mitgeliefert,
  obwohl sein einziges Intervall im August 2024 liegt, und hat keinen Stadtteilnamen
  im Ort.
* **Folgerung:** destination.one spielt für Hamburg keine Rolle. Die Hamburg
  Tourismus pflegt ihre Daten in der eigenen imx-Datenbank (G1), nicht bei
  destination.one.

## Abdeckung (nur Stichprobenanteil)

Formel: Anteil = k / 30; Hochrechnung auf die 99 Stadtteileinheiten = 99 × k / 30. Das
ist eine Schätzung aus 30 Ziehungen, keine Zählung; in Klammern das
95-%-Wilson-Intervall des Anteils.

| Merkmal | k | Anteil | 99 × k / 30 |
|---|---|---|---|
| Hauptfundort Freiwillige Feuerwehr | 5 | 16,7 % (7 bis 34 %) | 17 |
| Hauptfundort Bürger-, Heimat- oder Stadtteilverein | 6 | 20,0 % (10 bis 37 %) | 20 |
| Hauptfundort Stadtteilkultur oder Kulturverein | 5 | 16,7 % (7 bis 34 %) | 17 |
| Hauptfundort Stadtteil- oder Lokalportal | 3 | 10,0 % (3 bis 26 %) | 10 |
| Hauptfundort Kirchengemeinde | 3 | 10,0 % (3 bis 26 %) | 10 |
| Hauptfundort Stadtteilmarketing | 2 | 6,7 % (2 bis 21 %) | 7 |
| kein öffentlicher Fundort | 5 | 16,7 % (7 bis 34 %) | 17 |
| Terminfeed mit kommenden Terminen (Tribe, MEC) | 4 | 13,3 % (5 bis 30 %) | 13 |
| Wehr mit Stadtteilnamen in der Dienststellenliste | 18 | 60,0 % (42 bis 75 %) | 59 |
| Stadtteiltermin 2026 auf feuerwehr-hamburg.de (G2) | 4 | 13,3 % (5 bis 30 %) | 13 |
| Laternenumzug 2026 in der hamburg.de-Liste (G7) | 4 | 13,3 % (5 bis 30 %) | 13 |
| Fest 2026 mit selbst abgerufenem Beleg (irgendeine Quelle) | 18 | 60,0 % (42 bis 75 %) | 59 |
| destination.one mit Treffer | 0 | 0 % (0 bis 11 %) | 0 |

Zuordnung: G2 = Sülldorf, Kirchwerder, Billstedt (Öjendorf), Farmsen-Berne
(„Großer Laternenumzug der FF Farmsen“ im Feed); G7 = Kirchwerder, Farmsen-Berne
(Berne), Billstedt (Öjendorf), Schnelsen; die „Wandsbek Gartenstadt“ der Liste ist
keinem Stadtteil sicher zugeordnet und nicht gezählt. Fest 2026 belegt: Sülldorf,
Marmstorf, Heimfeld, Lemsahl-Mellingstedt, Schnelsen, Kirchwerder, Eppendorf
(Landstraßenfest 2026, Bericht des Bürgervereins), Billstedt, St. Georg, Bergstedt,
Finkenwerder, Hamm, Farmsen-Berne, Iserbrook, Neuallermöhe, Neugraben-Fischbek
(Laternenumzug FF Neugraben 14.10.2026), Wandsbek (Winterzauber), Neuengamme.

G1 lässt sich je Stadtteil nicht sauber zählen: Die öffentliche Suche hat keinen
Stadtteilfilter, und die Volltextsuche nach dem Stadtteilnamen findet auch Treffer aus
anderen Orten (Eppendorf 492, darunter der Kunsthandwerkermarkt im Niendorfer
Bürgerhaus). Die Rohzahlen der 30 Abfragen stehen in
[15-hamburg-anfragen.md](15-hamburg-anfragen.md). Eine genaue Zählung je Stadtteil
geht erst mit dem Feed (Ortsentität je Spielstätte über die PLZ).

## Priorisierte Integrationsliste Hamburg

Bewertet nach Datenqualität vor Menge, dann Stadtteile je Integration, dann Rechtslage.

| # | Integration | Stadtteile (Beleg) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | G1 Veranstaltungsdatenbank Hamburg & Metropolregion, XML-Feed | ganz Hamburg und Metropolregion; 9.038 Veranstaltungen mit Ort Hamburg; Stadtteilfeste nur vereinzelt | gut: Adresse, PLZ, Koordinaten, Kategorien (Straßenfeste, Feste, Weihnachtsmärkte), Absage-Status, Preis; Veranstalter oft leer | Nutzungsvereinbarung nötig, kostenfrei (Eigenangabe); Inhalt der Vereinbarung nicht belegt | Anfrage an HHT (Projektleitung Veranstaltungsdatenbank, Kontakt auf der Marktmanagement-Seite): Feed Hamburg plus Metropolregion, Ticketmaster ausschließen, Eventim J70 hinterlegen, Bildlizenzen im Feed; danach Dry-Run gegen Dedup mit unserem Eventim-Bestand |
| 2 | G2 feuerwehr-hamburg.de | alle 86 Wehren; Termin 2026 bei 4 von 30 | mittel: Titel, Datum und Kategorie strukturiert, Ort und Uhrzeit im Freitext, keine Koordinaten | „Alle Rechte vorbehalten“, keine Regel für Dritte | Landesbereich der FF anfragen (Nutzung, Hinweis an die Wehren, Termine auch in G1 einzutragen); technisch ein HTML-Parser über `/veranstaltung/` plus Sitemap |
| 3 | G6 Tribe- und MEC-Vereinskalender | 4 von 30 (Hamm, Bergstedt, Finkenwerder, Schnelsen-Süd) | gut (Tribe mit `venue.zip`, Zeitzone), Inhalte teils Kurse | Vereinsseiten ohne Regel | nur über den bundesweiten Plugin-Detektor mitnehmen; vorher fragen, ob die Vereine schon in G1 liefern |
| 4 | G7 hamburg.de-Saisonlisten | Laternenumzüge 4 von 30, Straßenfeste | mittel, Freitext | Rechte bei hamburg.de, nicht geprüft | nicht importieren; als Prüfliste, ob G1 und G2 die Laternenumzüge haben |
| 5 | G4 Transparenzportal, Sondermittel-Beschlüsse | alle Bezirke | keine Termine, nur Träger und Fest | dl-de/by-2-0 | als Lückenliste: welche Feste es gibt und wer sie trägt; Ansprechpartner für Schritt 1 |
| | Nicht weiter verfolgen | | | | destination.one (0 von 30), Lokalzeitungen (robots sperrt), Bezirksämter (keine Kalender), Einzelseiten ohne Feed, festivalsindeutschland.de |

**Lücken:**
* Für 5 von 30 Stadtteilen gibt es keinen öffentlichen Fundort; dort laufen lokale
  Termine, wenn überhaupt, über Mitgliederbereiche, Social Media oder Aushänge (nicht
  belegt).
* Die meisten Stadtteilfeste der Stichprobe (Schnelsen-Fest, Dorffest Lemsahl,
  Feuerwehrfest Sülldorf, Heimfelder Stadtteilfest, Fleetplatzfest) stehen nur auf
  Vereinsseiten ohne Feed; ob sie zusätzlich in G1 stehen, ließ sich nach dem Termin
  nicht mehr prüfen, weil vergangene Einträge dort 404 liefern.
* Viele Termine haben auf den Vereinsseiten nur einen Monat („Laternenumzüge November
  2026“, FF Sülldorf-Iserbrook) und taugen so nicht für einen Import.
* Die Felder des G1-XML-Feeds und die Bedingungen der Nutzungsvereinbarung sind erst
  nach Kontakt belegbar.
* Nicht recherchiert: Schützenverbände, Sportvereine, nebenan.de und Social Media
  (keine offenen Schnittstellen bekannt, Konten wären nötig).

## Was der User selbst tun muss

1. Hamburg Tourismus (Veranstaltungsdatenbank, Kontakt auf
   https://www.hamburg-tourism.de/business-medien/hamburg-tourismus-gmbh/ueber-die-hamburg-tourismus-gmbh/marketing/marktmanagement/):
   XML-Feed und Nutzungsvereinbarung anfragen, mit den Punkten aus Liste #1.
2. Freiwillige Feuerwehr Hamburg, Landesbereich (Impressum feuerwehr-hamburg.de):
   Nutzung der Terminrubrik klären.
3. Optional: Kulturladen Hamm, Heimatring Bergstedt, Kulturkreis Finkenwerder fragen,
   ob ihre Termine schon in die Hamburger Datenbank gehen.

## Anfragen

Alle Anfragen mit Host, Pfad und Ergebnis stehen in
[15-hamburg-anfragen.md](15-hamburg-anfragen.md). Zusammenfassung: nur GET, robots.txt
vor jedem Host gelesen, mit drei Ausnahmen, die dort einzeln stehen (ein Abruf der
gesperrten CKAN-API des Transparenzportals im selben Befehl wie robots.txt, bevor die
Sperre gelesen war; einzelne Startseiten erratener Vereinsdomains vor robots.txt; eine
Wartungsseite ohne robots.txt). Mehr als 5 Abrufe je Host bei
veranstaltungen.hamburg (47, Abstand 6 s bei `Crawl-delay: 5`), meta.et4.de (32),
feuerwehr-hamburg.de (etwa 30 über alle Bearbeiter), hamburg.de (etwa 20),
hamburg.events (10), suche.transparenz.hamburg.de (9; `Crawl-delay: 10`, die ersten
Abrufe lagen kürzer auseinander, danach mindestens 10 s) und bei drei Vereinsseiten
(6 bis 7).
