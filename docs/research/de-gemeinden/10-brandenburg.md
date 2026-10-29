# Brandenburg: Gemeindekalender und Dorffeste (Stand 2026-10-29)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.11`. Frage: Wie kommen wir an die
Termine der kleinen Brandenburger Gemeinden, also Dorffeste, Feuerwehrfeste, Erntefeste,
Hähnchen- und Heimatfeste, Zampern und Weihnachtsmärkte? Bundesweite Anbieter stehen in
[00-bundesweit.md](00-bundesweit.md), die Zuordnung jeder Gemeinde in
[01-vollerhebung.md](01-vollerhebung.md). Hier steht nur die Landessicht: Stichprobe gegen
die Vollerhebung geprüft, Dorffest-Test, Ämter, Landestourismus (TMB) und Lizenzlage.

Arbeitsweise: nur lesend, keine Konten, keine Formulare, keine Mails. Jede Zahl stammt aus
einer eigenen Antwort vom 29.10.2026 oder aus einer verlinkten Seite. Was sich nicht
belegen ließ, steht als „nicht belegt“ da. Alle Anfragen: Abschnitt 8.

## Kurzfazit

1. **verwaltungsportal.de ist in Brandenburg der Generic, und das Amt ist die
   Kalenderebene.** Laut Vollerhebung laufen 215 der 413 Gemeinden (52 %) über diese
   Plattform, verteilt auf 128 Websites; 152 davon sind amtsangehörig. In der Stichprobe
   sind es 17 von 30 (57 %). Der Betreiber, der Förderverein für regionale Entwicklung
   e.V., sitzt in Nuthetal (Brandenburg); mehrere Seiten verlinken „brandenburg-vernetzt.de“.
   Ein Parser für Liste plus JSON-LD deckt alle Seiten ab. 14 der 16 geprüften
   verwaltungsportal-Seiten führen Termine, 12 der 17 Gemeinden haben dort eigene Termine,
   9 davon ein Dorffest im Sinne des Tests. Lizenz: nicht belegt.
2. **Die TMB-Veranstaltungsdatenbank ist ausdrücklich auch für Gemeinden und Ämter
   gedacht, aber nur ein kleiner Teil ist offen.** Die TMB lässt seit Dezember 2021
   „nicht-touristische“ Termine zu und liefert sie per XML-Schnittstelle an lokale
   Websites von „Ämter, Städte und Gemeinden“. reiseland-brandenburg.de führt 5.590
   Veranstaltungsseiten in der Sitemap, destination.one `open-data` im Fenster
   30.10.2026 bis 29.10.2027 nur 494 Termine mit Quelle „Reiseland Brandenburg“. Die
   Schnittstelle gibt es nur auf Anfrage beim Team Digitales Management der TMB.
3. **TMB und destination.one decken kleine Gemeinden punktuell, aber merklich.** 7 von
   30 Stichprobengemeinden haben einen Treffer in destination.one `open-data`, 7 haben
   eine Veranstaltungsseite auf reiseland-brandenburg.de, zusammen 9. Für 3 Gemeinden
   (Biesenthal, Joachimsthal, Oberbarnim) belegt nur die TMB-Datenbank ein Fest.
4. **Dorffest-Test:** Für 16 der 30 Gemeinden steht ein Fest dieser Gemeinde online
   (Weihnachtsmarkt, Martinsfest, Kirmes, Feuerwehrjubiläum, Dorffest). 9 davon nur im
   verwaltungsportal-Kalender. Typisch Brandenburgisches wie Zampern, Erntefest und
   Hahnrupfen steht im Oktober kaum online; Zampern fand sich auf einer
   Gemeindeseite (Schwarzbach) und einmal bei der TMB. Hähnchenfest: in keiner Quelle.
5. **Amtsblätter helfen nicht weiter.** Die verwaltungsportal-Seiten führen das Amtsblatt
   im Modul `/amtsblatt/index.php` (Download per POST, wie in
   [07-thueringen.md](07-thueringen.md)); auf keiner der abgerufenen Seiten war ein
   WITTICH-Amtsblatt verlinkt. Smart Village App: weiter nur mit OAuth, siehe
   [00-bundesweit.md](00-bundesweit.md) A4.

## 1. Stichprobe

**Ziehung (reproduzierbar).** Quelle: Destatis Gemeindeverzeichnis-Auszug, Stichtag
30.09.2026 (`AuszugGV3QAktuell.xlsx`, Blatt `Onlineprodukt_Gemeinden30092026`, abgerufen
29.10.2026, 200, 1.872.608 Byte). Regel: Land `12`, Satzart `60`, Textkennzeichen nicht
65/66, Bevölkerung unter 10.000, sortiert nach ARS; dann
`random.Random(281112).sample(liste, 30)`, Ausgabe nach ARS. Grundgesamtheit 341 von 413
Gemeinden (812.671 von 2.551.889 Einwohnern). Skript wie in
[07-thueringen.md](07-thueringen.md) Abschnitt 1, nur `'12'` und Seed `281112` (Ticket 11,
Land 12).

Gemeindeverbände laut Datei: 141 amtsfreie Gemeinden (Kennzeichen 50), 50 Ämter (51), 1
Verbandsgemeinde (53), 1 mitverwaltende Gemeinde (58). 266 Gemeinden mit 345.587
Einwohnern sind amtsangehörig.

**Spalten:** Verwaltung = Amt oder amtsfrei; Fundort = wo Termine dieser Gemeinde stehen
(oder ihres Amts, wenn die Gemeinde keine eigenen hat); VP = verwaltungsportal.de mit
Layout-Nummer; d.one = Treffer `q=city:"<Name>"` in destination.one `open-data`, Fenster
30.10.2026 bis 29.10.2027, nur Brandenburger PLZ gezählt; TMB = Veranstaltungsseiten auf
reiseland-brandenburg.de, deren Pfad den Gemeinde- oder Ortsteilnamen trägt (Sitemap
vom 29.10.2026, also Untergrenze); Fest = Dorffest-Test für diese Gemeinde bestanden
(Abschnitt 3).

| # | Gemeinde | AGS | EW | Verwaltung | Fundort | CMS/Plattform | Link | d.one | TMB | Fest |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Biesenthal, Stadt | 12060024 | 6.370 | Amt Biesenthal-Barnim | Nachrichtenseite ohne Kalender; Amt-Website antwortete 500; TMB | unbekannt | https://www.stadt-biesenthal.de/ | 1 | 4 | ja (TMB) |
| 2 | Joachimsthal, Stadt | 12060100 | 3.303 | Amt Joachimsthal (Schorfheide) | Amt-Kalender fehlt (404), Verweis auf schorfheide.de; TMB | VP 1764 | https://www.amt-joachimsthal.de/veranstaltungen/index.php | 0 | 1 | ja (TMB) |
| 3 | Märkische Heide | 12061329 | 3.736 | amtsfrei | Veranstaltungsseite ohne Termine | Jegasoft Media | https://www.maerkische-heide.de/Tourismus/Veranstaltungen-Maerkische-Heide | 0 | 0 | nein |
| 4 | Alt Zauche-Wußwerk | 12061005 | 483 | Amt Lieberose/Oberspreewald | Amt-Website ohne Kalender | Jegasoft Media | https://www.lieberose-oberspreewald.de/ | 0 | 0 | nein |
| 5 | Lieberose, Stadt | 12061308 | 1.301 | Amt Lieberose/Oberspreewald | Förderverein-Website, Termine je zwei Monate als Bild; TMB | WordPress 6.9.11 | http://www.lieberose-niederlausitz.de/juli-august-2026/ | 2 | 4 | ja |
| 6 | Neu Zauche | 12061352 | 1.037 | Amt Lieberose/Oberspreewald | wie 4 | Jegasoft Media | wie 4 | 0 | 0 | nein |
| 7 | Straupitz (Spreewald) | 12061476 | 906 | Amt Lieberose/Oberspreewald | Tourismusverein (Gottesdienste); TMB (Gastronomie) | Website-Baukasten (website-editor.net) | https://www.straupitz-im-spreewald.de/veranstaltungen | 7 | 14 | nein |
| 8 | Herzberg (Elster), Stadt | 12062224 | 8.753 | amtsfrei | eigene Seite (15 Termine) | VP 7953 | https://www.herzberg-elster.de/veranstaltungen/index.php | 0 | 0 | nein |
| 9 | Massen-Niederlausitz | 12062333 | 1.883 | Amt Kleine Elster | Amt-Kalender | eigenes CMS, nicht erkannt | https://www.amt-kleine-elster.de/leben/veranstaltungen | 0 | 0 | ja |
| 10 | Pessin | 12063240 | 594 | Amt Friesack | Amt-Kalender (13 Termine, keiner hier) | VP 5041 | https://www.amt-friesack.de/veranstaltungen/index.php | 0 | 0 | nein |
| 11 | Havelaue | 12063134 | 880 | Amt Rhinow | Amt-Kalender (21 Termine, 4 hier) | VP 371 | https://www.rhinow.de/veranstaltungen/index.php | 0 | 0 | ja |
| 12 | Altlandsberg, Stadt | 12064029 | 9.680 | amtsfrei | eigener Kalender per AJAX (beim Abruf leer); destination.one | TYPO3, Erweiterung „altlandsberg-events“ (iconate) | https://www.altlandsberg.de/leben-wohnen/kultur-freizeit/veranstaltungen/ | 20 | 1 | nein |
| 13 | Falkenberg | 12064125 | 2.191 | Amt Falkenberg-Höhe | Amt-Kalender (5 Termine, keiner sicher hier) | VP 9610 | https://www.amt-fahoe.de/veranstaltungen/index.php | 1 | 0 | nein |
| 14 | Oberbarnim | 12064370 | 2.081 | Amt Märkische Schweiz | Amt-Kalender (NOLIS, 21 Termine mit `X-ORT:Oberbarnim` in 4 Wochen); TMB | NOLIS | https://www.amt-maerkische-schweiz.de/tourismus/veranstaltungen/ | 5 | 1 | ja (TMB) |
| 15 | Falkenhagen (Mark) | 12064128 | 669 | Amt Seelow-Land | eigene Seite (2 Termine) | VP 7079 | https://www.falkenhagen-mark.de/veranstaltungen/index.php | 0 | 0 | nein |
| 16 | Liebenwalde, Stadt | 12065193 | 4.419 | amtsfrei | eigene Seite (7 Termine) | VP 5586 | https://www.liebenwalde.de/veranstaltungen/index.php | 0 | 0 | ja |
| 17 | Stechlin | 12065310 | 1.094 | Amt Gransee und Gemeinden | eigene Seite leer; Amt-Kalender (Tribe, 58 Termine) | TYPO3 (REGiO-Nord); Amt WordPress + The Events Calendar | https://www.gransee.de/veranstaltungskalender/ | 0 | 0 | ja |
| 18 | Schipkau | 12066285 | 6.704 | amtsfrei | eigene Seite (36 Termine) | VP 131 | https://www.gemeinde-schipkau.de/veranstaltungen/index.php | 0 | 0 | ja |
| 19 | Kroppen | 12066168 | 699 | Amt Ortrand | Domain leitet auf Amt Ortrand; dort Startseite mit Terminen, keiner hier außer einem Verkaufsstand | WordPress 7.1.4 | http://amt-ortrand.de | 0 | 0 | nein |
| 20 | Schwarzbach | 12066292 | 654 | Amt Ruhland | eigene Seite (Jahresliste, Archiv ab 2005) | statisches HTML | http://www.schwarzbach-biehlen.de/veranstaltungen/veranstaltungen.html | 0 | 0 | ja |
| 21 | Wiesenau | 12067528 | 1.204 | Amt Brieskow-Finkenheerd | eigene Seite (6 Termine) | VP 10930 | https://www.gemeinde-wiesenau.de/veranstaltungen/index.php | 0 | 0 | ja |
| 22 | Steinhöfel | 12067473 | 4.365 | Amt Odervorland | eigene Seite (10 Termine) | VP 31 | https://www.gemeinde-steinhoefel.de/veranstaltungen/index.php | 0 | 0 | ja |
| 23 | Wendisch Rietz | 12067520 | 1.658 | Amt Scharmützelsee | Amt-Kalender (48 Termine, 3 hier); TMB | VP 7778 | https://www.amt-scharmuetzelsee.de/veranstaltungen/index.php | 0 | 12 | nein |
| 24 | Schlaubetal | 12067438 | 1.765 | Amt Schlaubetal | Amt-Kalender (2 Naturpark-Termine) | VP 4167 | https://www.amt-schlaubetal.de/veranstaltungen/index.php | 0 | 0 | nein |
| 25 | Berge | 12070028 | 707 | Amt Putlitz-Berge | Amt-Kalender (39 Termine, 14 hier) | VP 610 | https://www.amtputlitz-berge.de/veranstaltungen/index.php | 0 | 0 | ja |
| 26 | Neiße-Malxetal | 12071294 | 1.497 | Amt Döbern-Land | Amt-Kalender (15 Termine, 3 hier) | VP 7231 | https://www.amt-doebern-land.de/veranstaltungen/index.php | 0 | 0 | ja |
| 27 | Tschernitz | 12071392 | 1.129 | Amt Döbern-Land | wie 26 (3 hier) | VP 7231 | wie 26 | 0 | 0 | ja |
| 28 | Uckerland | 12073579 | 2.360 | amtsfrei | eigener Regionalkalender, überwiegend Nachbarorte in MV (Strasburg, Friedland, Brohm) | eigenes CMS, nicht erkannt | https://www.uckerland.de/veranstaltungen | 1 | 0 | nein |
| 29 | Hohenselchow-Groß Pinnow | 12073309 | 696 | Amt Gartz (Oder) | Amt-Kalender „Keine Veranstaltungen gefunden“ | VP 12 | https://www.gartz.de/veranstaltungen/index.php | 0 | 0 | nein |
| 30 | Milmersdorf | 12073396 | 1.373 | Amt Gerswalde | Amt-Kalender (9 Termine, 4 hier) | VP 16 | https://www.amt-gerswalde.de/veranstaltungen/index.php | 0 | 0 | ja |

Ortsteile für „hier“ kamen aus Wikidata (`P131` je Gemeinde, eine SPARQL-Anfrage) und
`data/plz-de.json` (`orteGemeinde`). TMB-Zelle Herzberg: ein Pfad nennt den „Bläserkreis
Herzberg“, der Ort der Veranstaltung ist nicht geprüft, deshalb 0. Pessin: der Pfad
„dorfflohmarkt-pessin“ steht in der Sitemap, die Seite antwortete 404, deshalb 0.

**Abgleich mit der Vollerhebung.** 26 der 30 Zuordnungen bestätigt. Abweichungen:
Kroppen ist dort `verwaltungsportal`, die Domain leitet aber auf die WordPress-Seite des
Amts Ortrand; Joachimsthal ist `verwaltungsportal`, der Kalender des Amts antwortet aber
404; Märkische Heide ist `html_generic`, die Seite enthält aber keine Termine; Biesenthal
ist `js_oder_feed` mit einem Termin von bahnhof-biesenthal.de, die gelistete Website ist
eine Nachrichtenseite ohne Kalender (wer sie betreibt, ist nicht geprüft).

## 2. Generics

### 2.1 verwaltungsportal.de („Brandenburg vernetzt“)

* **Betreiber:** Förderverein für regionale Entwicklung e.V., Nuthetal
  ([00-bundesweit.md](00-bundesweit.md) C7). Brandenburg ist das Sitzland. 5 der 16
  abgerufenen Seiten verlinken `www.brandenburg-vernetzt.de` (Gartz, Falkenhagen, Döbern-Land,
  Joachimsthal, Rhinow), 5 `azubi-projekte.de` (Friesack, Falkenhagen, Herzberg, Amt
  Falkenberg-Höhe, Scharmützelsee). `www.brandenburg-vernetzt.de` selbst verweigerte die
  Verbindung (https) bzw. antwortete 301 (http); eine Teilnehmerliste ist nicht belegt.
* **Gemeinden:** Vollerhebung 215 Gemeinden auf 128 Websites (eigene Auswertung der CSV);
  26 dieser Websites sind Amtsauftritte (`amt` im Hostnamen) mit 97 Gemeinden dahinter, 30
  Websites tragen mehr als eine Gemeinde. Von den 50 Ämtern haben 37 mindestens eine
  Gemeinde auf verwaltungsportal. Unter den 341 Gemeinden unter 10.000 Einwohnern sind es
  197 (58 %). Stichprobe: 17 von 30.
* **Zugriffsweg:** einheitliches HTML wie in Thüringen. Liste `/veranstaltungen/index.php`,
  Detail `/veranstaltungen/<id>/<JJJJ>/<MM>/<TT>/<slug>` (in Brandenburg ohne `.html`,
  Datum im Pfad), weitere Monate über das AJAX-Fragment aus
  [01-vollerhebung.md](01-vollerhebung.md) Abschnitt 3. Liste mit
  `event-entry-new-1-time` (`<time datetime="2026-11-08">`), `-daytime`, `-headline`,
  `-location`. Kein RSS, kein iCal. 14 der 16 Seiten bieten „Veranstaltung kostenlos
  melden“ an: Vereine können selbst eintragen.
* **Felder (Proben Putlitz-Berge, Rhinow):** JSON-LD `@type: Event`, `name`,
  `description`, `startDate` (nur Datum `2027-07-03` oder mit Offset
  `2026-11-14T17:30:00+0100`), `location` (`@type: Place`, `name`, teils
  `address{postalCode, addressLocality, addressCountry}`, `url`), `organizer`
  (`@type: Organization`, `name`, `address{streetAddress, postalCode, addressLocality}`,
  `url`). `addressLocality` nennt den Ortsteil, z. B. „Berge GT Neuhausen“, „Havelaue OT
  Wolsier“. Keine Koordinaten. Zeichensatz der Rhinower Seite ISO-8859-1.
* **Erkennung:** `layout.verwaltungsportal.de/<Nummer>/`, `fotos.verwaltungsportal.de`,
  Fußlink `brandenburg-vernetzt.de` oder `azubi-projekte.de`.
* **Lizenz/robots:** robots.txt der geprüften Seiten ließ Liste und Detail für `*` frei
  (eigene Prüfung je Host vor dem Abruf). Nutzungsbedingungen nicht belegt.
* **Füllstand (Termine in der Liste):** Scharmützelsee 48, Putlitz-Berge 39, Schipkau 36,
  Rhinow 21, Herzberg 15, Döbern-Land 15, Friesack 13, Steinhöfel 10, Gerswalde 9,
  Liebenwalde 7, Wiesenau 6, Falkenberg-Höhe 5, Falkenhagen 2, Schlaubetal 2, Gartz 0,
  Joachimsthal Kalender 404.
* **Beispiele:** Putlitz-Berge, Rhinow, Döbern-Land (Links in der Tabelle).
* **Nächster Schritt:** wie in Thüringen: Liste aller Gemeinde- und Amtswebsites aus der
  CSV (`event_url`), ein Parser für Liste plus JSON-LD. Beim Förderverein nach
  Teilnehmerliste und einem Feed über alle Seiten fragen (Kontakt laut
  [07-thueringen.md](07-thueringen.md) 2.1); Brandenburg mit der größten Dichte
  mitverhandeln.

### 2.2 TMB-Veranstaltungsdatenbank Brandenburg (reiseland-brandenburg.de)

* **Betreiber:** TMB Tourismus-Marketing Brandenburg GmbH, Team Digitales Management,
  contentnetzwerk@reiseland-brandenburg.de.
* **Für Gemeinden gedacht:** Laut TMB-Präsentation „Nicht-touristische Veranstaltungen in
  der TMB-Veranstaltungsdatenbank“ (PDF vom 07.12.2021, Neufassung 16.08.2023,
  https://tourismusnetzwerk-brandenburg.de/sites/default/files/medien/dokumente/nicht-touristische_veranstaltungen_tmb-veranstaltungsdatenbank.pdf)
  soll die Datenbank „zentrales Eingabemedium für touristische wie auch
  nicht-touristische“ Termine sein, mit „Ausspielung auf der eigenen Webseite für z.B.
  Ämter, Städte und Gemeinden“. Nicht-touristische Termine gehen „nicht in die zentralen
  touristische Vermarktung“, sondern nur an lokale Websites nach Einrichtung der
  Schnittstelle.
* **Zugriffsweg:** „XML-Schnittstelle für die Einbindung auf lokalen / regionalen
  Websites“, wählbar nur touristisch, nur nicht-touristisch oder beides; Standard „nur
  touristisch“. Bekanntes Feld: `E_NONTOURISTIC` (1 = nicht-touristisch); im Beispiel
  zusätzlich `E_ISVIRTUELL`. Freischaltung nur über die TMB. Der Bildserver
  `api.tmb.pixelpoint.biz` erlaubt in robots.txt `/api/` und `/media/`, die Wurzel antwortet
  401: kein offener Zugang. Eine öffentliche Doku der Schnittstelle ist nicht belegt.
* **Menge:** `sitemap-dl.xml.gz` von reiseland-brandenburg.de (29.10.2026) enthält 19.991
  URLs, davon 5.590 unter `/veranstaltung/` (lastmod fast alle Oktober 2026). Zum
  Vergleich destination.one `open-data` (Abschnitt 4): 494 Termine mit
  `source.value: "Reiseland Brandenburg"` im 12-Monats-Fenster. Die Sitemap zählt Seiten,
  nicht Termine im Fenster; das Verhältnis ist deshalb nur ein Hinweis.
* **Felder (Detailseiten, Microdata):** `itemtype="http://schema.org/Event"` mit `name`,
  `startDate`, `endDate`, `location` (`Place`, `name`), `address` (`PostalAddress`,
  `streetAddress`, `postalCode`, `addressLocality`), `image`, `telephone`, `email`;
  `data-event-list` als JSON mit `from_date`, `from_time`, `to_date`, `to_time`,
  `SpansMultipleDays`; `data-id` (Termin-ID); Kategorie im Text („Fest / Brauchtum“);
  Bildnachweis „Foto: …, Lizenz: …“. Kein JSON-LD.
* **Lizenz/robots:** robots.txt sperrt `/suche/`, `/en/`, Buchungsstrecken, nicht
  `/veranstaltung/`. Für die Daten keine Lizenz auf der Website gefunden. Die Bildlizenz
  steht je Bild und ist in den Proben keine offene Lizenz („Lizenz: Ortsbeirat
  Bruchhagen“, „Lizenz: Heimatverein Joachimsthal e.V.“). In destination.one trägt der
  TMB-Datensatz „Weihnachtsmarkt in Lieberose“ `license: CC-BY` mit Verweis auf CC BY 4.0.
  Die TMB-Präsentation von 2022 für Potsdam erwähnt laut Suchtreffer, dass im System
  Creative-Commons-Lizenzen gepflegt werden können; das PDF (über 10 MB) wurde nicht
  selbst gelesen, die Aussage ist deshalb nicht belegt.
* **Stichprobe:** 7 von 30 Gemeinden mit Veranstaltungsseite (Pfad), Spalte TMB.
* **Dorffest-Test:** „Dorffest in Bruchhagen“ (Angermünde, 03./04.07.2027, Ortsbeirat)
  https://www.reiseland-brandenburg.de/veranstaltung/uckermark/dorffest-in-bruchhagen/ ;
  „Joachimsthaler Weihnachtsmarkt“ 06.12.2026, Heimatverein
  https://www.reiseland-brandenburg.de/veranstaltung/barnimer-land/joachimsthaler-weihnachtsmarkt/ ;
  „Bollersdorfer Weihnachtsfest“ 28.11.2026 (Oberbarnim)
  https://www.reiseland-brandenburg.de/veranstaltung/seenland-oder-spree/bollersdorfer-weihnachtsfest/ ;
  „Zampern mit Rubisko“ 20.02.2027
  https://www.reiseland-brandenburg.de/veranstaltung/spreewald/zampern-mit-rubisko/ .
  Pfade nach Festart (Untergrenze, Region Lausitzer Seenland reicht nach Sachsen):
  weihnachtsmarkt 89, adventsmarkt 23, ernte 19 (davon erntefest 3), feuerwehr 8,
  sommerfest 3, dorffest 2, zamper 1, kirmes 1, heimatfest 1 (Klitten, Sachsen),
  osterfeuer 1, maibaum 1, schuetzenfest 0, haehnchen 0, hahnrupf 0.
* **Nächster Schritt:** Bei contentnetzwerk@reiseland-brandenburg.de eine XML-Schnittstelle
  „touristisch UND nicht-touristisch“ für lasstreffen.de anfragen, mit Frage nach
  Datenlizenz und Nutzung für ein kommerzielles Portal. Bis dahin destination.one
  `open-data` als Teilmenge (CC-BY je Datensatz prüfen).

### 2.3 Weitere Hersteller in der Stichprobe

| Fund | Wo | Zugriff | Bewertung |
|---|---|---|---|
| The Events Calendar | Amt Gransee und Gemeinden (für Stechlin) | WP-REST `/wp-json/tribe/events/v1/events`, `total: 58`; Felder wie [00-bundesweit.md](00-bundesweit.md) D1, `venue.venue` nennt den Ortsteil („Dollgow“, „16775 Stechlin OT Neuglobsow“) | gut; Vollerhebung 18 Gemeinden in BB |
| NOLIS | Amt Märkische Schweiz (für Oberbarnim) | iCal mit `X-KOMMUNE`, `X-ORT`, `X-ORGANIZER`; mit Fenster bis 28.10.2027 angefragt, geliefert 399 Termine nur bis 26.11.2026 (Parameter `zeitauswahl=1&auswahl_woche_tage=28` setzt sich durch). Enthält auch Nachbarorte außerhalb des Amts (Prädikow, Prötzel) | gut, Fenster einzeln testen; Vollerhebung 7 in BB |
| Jegasoft Media e.K. | Märkische Heide, Amt Lieberose/Oberspreewald | kein Kalender bzw. leere Seite | kein Generic |
| TYPO3 REGiO-Nord | Stechlin | Seite ohne Termine | kein Generic |
| TYPO3 iconate „altlandsberg-events“ | Altlandsberg | AJAX über TYPO3-`AjaxRequest`, beim Abruf leer | Einzelfall |
| Website-Baukasten (website-editor.net) | Straupitz (Tourismusverein) | Monatsansicht per JavaScript | kein Generic |
| statisches HTML | Schwarzbach, Uckerland, Amt Kleine Elster | Liste mit Datum | allgemeiner Parser (Stufe E) |

Nicht vorgekommen: Cross7, Heimat-Info, iKISS, communice, Komm.ONE, meinOrt-Links,
Smart-Village-Webansichten, Crossiety, NUSSBAUM. ionas (12), active-City (9) und txnews (13)
stehen in der Vollerhebung, aber nicht in der Stichprobe.

### 2.4 Ämter

Die Ämter sind in Brandenburg die Kalenderebene der kleinen Gemeinden: 24 der 30
Stichprobengemeinden sind amtsangehörig, 17 davon haben keinen eigenen Kalender und
stehen (wenn überhaupt) im Amtskalender. 9 dieser 17 Amtskalender führen Termine der
Stichprobengemeinde, 7 ein Fest von ihr. 11 der 17 Amtskalender laufen auf
verwaltungsportal, je einer auf NOLIS, The Events Calendar, WordPress ohne
Kalender-Plugin (Ortrand), eigenem CMS (Kleine Elster) und Jegasoft ohne Kalender
(Lieberose/Oberspreewald). Eine Amts-Integration liest also alle Gemeinden des Amts,
der Ort muss aus `location`/`organizer` (verwaltungsportal), `venue` (Tribe) oder `X-ORT`
(NOLIS) kommen.

Beispiel für die Ortsangabe im Amtskalender: „120 Jahre Freiwillige Feuerwehr Neuhausen“
mit `addressLocality: "Berge GT Neuhausen"` im Kalender des Amts Putlitz-Berge (Abschnitt 3).

## 3. Dorffest-Test je Quelle

Gezählt als Fest: Dorffest, Feuerwehrfest oder -jubiläum, Kirmes, Erntefest, Zampern,
Maibaum, Osterfeuer, Martinsfest oder -umzug, Herbstfeuer, Weihnachts- oder Adventsmarkt,
Lichterfest eines Ortes, Schützenfest. Nicht gezählt: Konzerte, Gottesdienste, Lesungen,
Halloween-Partys, Karnevalssitzungen, gastronomische Angebote.

| Quelle | Beispiel | Datum | Link |
|---|---|---|---|
| verwaltungsportal.de (Amt Putlitz-Berge) | 120 Jahre Freiwillige Feuerwehr Neuhausen (Berge) | 03.07.2027 | https://www.amtputlitz-berge.de/veranstaltungen/2972815/2027/07/03/120-jahre-freiwillige-feuerwehr-neuhausen |
| verwaltungsportal.de (Amt Putlitz-Berge) | Herbstfeuer Berge mit Laternenumzug | 07.11.2026 | https://www.amtputlitz-berge.de/veranstaltungen/2968619/2026/11/07/herbstfeuer-berge-mit-laternenumzug |
| verwaltungsportal.de (Amt Rhinow) | Martinsumzug und -fest in Wolsier (Havelaue), Förderverein der FF Wolsier | 14.11.2026 | https://www.rhinow.de/veranstaltungen/2991401/2026/11/14/martinsumzug-und-fest-in-wolsier |
| verwaltungsportal.de (Schipkau) | Traditionelles Gänsebratenessen (Kirmes) | 15.11.2026 | https://www.gemeinde-schipkau.de/veranstaltungen/2959376/2026/11/15/traditionelles-gaensebratenessen-kirmes |
| verwaltungsportal.de (Amt Döbern-Land) | Tschernitzer Weihnachtsmarkt; 18. Weihnachtsmarkt Klein Kölzig (Neiße-Malxetal) | 28.11. / 12.12.2026 | https://www.amt-doebern-land.de/veranstaltungen/2858903/2026/11/28/tschernitzer-weihnachtsmarkt |
| verwaltungsportal.de (Steinhöfel) | Weihnachtsmarkt in Beerfelde | 05.12.2026 | https://www.gemeinde-steinhoefel.de/veranstaltungen/2764998/2026/12/05/weihnachtsmarkt-in-beerfelde |
| verwaltungsportal.de (Liebenwalde) | Lichterfest in Freienhagen | 28.11.2026 | https://www.liebenwalde.de/veranstaltungen/2874452/2026/11/28/lichterfest-in-freienhagen |
| The Events Calendar (Amt Gransee) | Weihnachtsmarkt Dollgow (Stechlin) | 28.11.2026 | https://www.gransee.de/event/weihnachtsmarkt-19/ |
| NOLIS (Amt Märkische Schweiz) | 1. Rehfelder Weihnachtsmarkt; Martinsfest in Waldsieversdorf (beide nicht Stichprobe) | 20.11. / 11.11.2026 | iCal `selected_kommune=34490` |
| eigenes CMS (Amt Kleine Elster) | Martinsumzug in Massen | 11.11.2026 | https://www.amt-kleine-elster.de/leben/veranstaltungen/martinsumzug-in-massen |
| statisches HTML (Schwarzbach) | Dorffest Schwarzbach 06./07.09.2026; Weihnachtsmarkt der Vereine 05.12.2026; im Archiv Zampern, Kirmestanz, Amtsfeuerwehrtag | 2026 | http://www.schwarzbach-biehlen.de/veranstaltungen/veranstaltungen.html |
| Förderverein Lieberose (Bild) | 26. Lieberoser Schwarzpulvertage (Schützenverein), Sommerfest der Lieberoser Heide | 09. bis 16.08. / 09.08.2026 | http://www.lieberose-niederlausitz.de/wp-content/uploads/2026/10/Veranstaltungen-August-2026.png |
| TMB / reiseland-brandenburg.de | Dorffest in Bruchhagen; Zampern mit Rubisko | 03.07.2027 / 20.02.2027 | Abschnitt 2.2 |
| destination.one `open-data` | Weihnachtsmarkt in Lieberose (TMB-Datensatz, CC-BY) | 05.12.2026 | ID `Event1136898_Termin230064` |

## 4. Abgleich destination.one

`experience=open-data`, Fenster `startdate=10/30/2026`, `enddate=10/29/2027`:

* `q=area:"Brandenburg"`: 840 Termine (Ticket nannte 1.031 über alle Termine am 27.10.).
  In den ersten 500: 54 Orte, Potsdam 162, Frankfurt (Oder) 118, Neuenhagen 24,
  Zehdenick 24, Finsterwalde 24. `q=source:"Reiseland Brandenburg"`: 494.
* Herkunft: die Brandenburger Datensätze tragen `source.value: "Reiseland Brandenburg"`,
  `global_id` im Muster `DAMASEvent_Event<id>_Termin<id>`; Lizenz in `attributes`
  (`license: CC-BY`, `licenseurl` CC BY 4.0) in der Probe.
* Festarten im Titel (`area:"Brandenburg" AND title:<Wort>`): Weihnachtsmarkt 4
  (Bernau, Lieberose), Adventsmarkt 2 (Potsdam); Dorffest, Erntefest, Erntedankfest,
  Feuerwehrfest, Feuerwehr, Zampern, Kirmes, Hähnchenfest, Heimatfest, Osterfeuer, Maibaum,
  Schützenfest, Sommerfest, Martinsfest, Hahnrupfen: je 0.
* Stichprobe `q=city:"<Name>"`: **7 von 30** mit mindestens einem Brandenburger Treffer
  (Biesenthal 1, Lieberose 2, Straupitz 7, Altlandsberg 20, Falkenberg 1, Oberbarnim 5,
  Uckerland 1). „Berge“ lieferte 25 Treffer, keiner mit Brandenburger PLZ; „Falkenberg“ 9,
  davon 1 in Falkenberg/Mark. Ein Fest dieser Gemeinden steht dort nur bei Lieberose.

## 5. Abdeckung (nur Stichprobenanteil)

| Kennzahl | Formel | Wert | 95 %-Intervall (Wilson) |
|---|---|---|---|
| Verwaltungsauftritt auf verwaltungsportal.de | 17 / 30 | 57 % | 39 % bis 73 % |
| verwaltungsportal-Seite führt mindestens einen Termin | 14 / 16 Seiten | 88 % | |
| Termin genau dieser Gemeinde im verwaltungsportal-Kalender | 12 / 17 | 71 % | |
| Amtsangehörig, Termine nur über den Amtskalender | 17 / 24 | 71 % | |
| Dorffest-Beleg online für diese Gemeinde (alle Quellen) | 16 / 30 | 53 % | 36 % bis 70 % |
| davon nur über verwaltungsportal | 9 / 30 | 30 % | |
| davon nur über TMB | 3 / 30 | 10 % | |
| Termin in destination.one `open-data` | 7 / 30 | 23 % | |
| Veranstaltungsseite auf reiseland-brandenburg.de | 7 / 30 | 23 % | |
| destination.one oder TMB | 9 / 30 | 30 % | |
| Kein Termin dieser Gemeinde in irgendeiner geprüften Quelle | 6 / 30 (7 mit Schlaubetal) | 20 % | |

Wilson für 17/30: Mitte (0,567 + 1,96²/60) / (1 + 1,96²/30) = 0,559, Halbbreite
1,96 · √(0,567·0,433/30 + 1,96²/3600) / (1 + 1,96²/30) = 0,167. Für 16/30: Mitte 0,530,
Halbbreite 0,168.

Ohne jeden Termin der Gemeinde in den geprüften Quellen: Märkische Heide, Alt
Zauche-Wußwerk, Neu Zauche, Pessin, Kroppen, Hohenselchow-Groß Pinnow (6 / 30); dazu
Schlaubetal, dessen zwei Termine dem Naturpark gelten und keinem Ort zugeordnet sind.

Herbst-Stichtag: Sommerfeste 2027 (Dorffest, Erntefest, Feuerwehrfest) sind am 29.10.2026
meist noch nicht eingetragen. Die Fest-Quote ist deshalb eine Untergrenze für ein Jahr.

## 6. Priorisierte Liste für Brandenburg

| # | Integration | Gemeinden (Beleg) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | verwaltungsportal.de (Parser Liste + JSON-LD) | 215 laut Vollerhebung (128 Websites, 37 von 50 Ämtern); Stichprobe 17/30 | Datum, Ort mit Ortsteil, Veranstalter mit Adresse; keine Koordinaten; Füllstand 0 bis 48 | robots erlaubt; Nutzungsbedingungen nicht belegt | Website-Liste aus der CSV, Parser wie Thüringen; Förderverein nach Teilnehmerliste und Feed fragen |
| 2 | TMB-Veranstaltungsdatenbank (XML-Schnittstelle) | landesweit; Stichprobe 7/30, 3 Feste nur hier | strukturiert: Zeiten, Adresse, PLZ, Kategorie „Fest / Brauchtum“, Bilder | Lizenz offen; Bildrechte je Bild, nicht offen in den Proben | Schnittstelle „touristisch und nicht-touristisch“ und Lizenz bei der TMB anfragen |
| 3 | destination.one `open-data` (TMB-Teilmenge) | 494 Termine im Fenster; Stichprobe 7/30 | gut, Koordinaten | CC-BY je Datensatz (Probe) | ohnehin im bundesweiten Import; Lizenz je Datensatz übernehmen |
| 4 | The Events Calendar, NOLIS, ionas, iCagenda (bundesweite Adapter) | Vollerhebung BB: Tribe 18, ionas 12, NOLIS 7, iCagenda 6 | sehr gut bis gut | Gemeinde- bzw. Amtswebsites | mit den bundesweiten Adaptern mitnehmen; NOLIS-Fenster testen |
| 5 | Allgemeiner Parser (Stufe E) | Vollerhebung BB: 66 | je Seite verschieden | Gemeinde-Websites | Registry mit `event_url`, Stichprobe zeigt Schwarzbach, Kleine Elster, Uckerland als Kandidaten |
| | Nicht weiter verfolgen | | | | Smart Village App (OAuth), Amtsblätter auf verwaltungsportal (POST/PDF), Bild-Terminlisten (Lieberose), Vereins-Baukästen |

**Lücken:** Ämter ohne gepflegten Kalender (Joachimsthal 404, Gartz leer, Lieberose/
Oberspreewald ohne Kalender, Ortrand nur Startseite) lassen ihre Dörfer ohne Online-Termine;
dort hilft nur die TMB-Datenbank oder der Hinweis an das Amt, die kostenlose
Meldefunktion von verwaltungsportal zu nutzen. Nicht belegt: Zahl der Websites im Programm
„Brandenburg vernetzt“, Lizenz von verwaltungsportal und TMB-Daten, Inhalt der
TMB-XML-Schnittstelle, Gesamtzahl der nicht-touristischen Termine in der TMB-Datenbank.
Hähnchenfest und Hahnrupfen fanden sich in keiner Quelle; ob es sie online gibt, ist offen.

## 7. Was der User selbst tun muss

1. TMB (contentnetzwerk@reiseland-brandenburg.de): XML-Schnittstelle mit nicht-touristischen
   Terminen und Datenlizenz für lasstreffen.de.
2. Förderverein für regionale Entwicklung e.V.: Teilnehmerliste und Feed für
   verwaltungsportal.de, zusammen mit der Thüringer Anfrage.

## 8. Anfragen

Alle am 29.10.2026, lesend, mit robots.txt-Prüfung je Host vor dem ersten Abruf
(Skript `fetch.py`, User-Agent `lasstreffen-research/1.0`). Zahlen je Host inklusive
robots.txt.

| Host | Anfragen | Status |
|---|---|---|
| www.destatis.de | Gemeindeverzeichnis-Auszug | 200 |
| query.wikidata.org | 1 SPARQL (Ortsteile der 30 Gemeinden) | 200 |
| meta.et4.de | 30 × `city:`, 2 × Detailprobe, 1 × `area:"Brandenburg"` `limit=500`, 17 × Festart im Titel, 2 × `source:`/`zip:`, 2 × Titelliste | 54 × 200 |
| www.reiseland-brandenburg.de | robots.txt, `sitemap.xml`, `sitemap-dl.xml.gz`, Veranstaltungsliste, 6 Detailseiten | 200, einmal 404 (dorfflohmarkt-pessin) |
| api.tmb.pixelpoint.biz | `/robots.txt`, `/`, `/api/` | 200, 401, 404 |
| tourismusnetzwerk-brandenburg.de | 2 PDF (WebFetch) | 200 |
| potsdam.de | 1 PDF (WebFetch, über 10 MB, abgebrochen) | nicht gelesen |
| smart-village.app | Startseite (WebFetch) | 200 |
| www.brandenburg-vernetzt.de | https Startseite, http Startseite | Verbindung verweigert, 301 |
| Gemeinde- und Amtswebsites | je robots.txt plus 1 bis 5 Seiten: amt-maerkische-schweiz.de 4 (davon 1 iCal), amtputlitz-berge.de 4, rhinow.de 4, gransee.de 4 (davon 1 WP-REST), amt-kleine-elster.de 4, altlandsberg.de 4 (davon 1 JS), maerkische-heide.de 5, lieberose-niederlausitz.de 6 (davon 1 Bild), alle übrigen 2 | 200; amt-biesenthal-barnim.de 500, amt-joachimsthal.de Kalender 404 |

Keine Formulare abgeschickt, keine Cookies gesetzt, keine API mit Zugangsdaten genutzt.
