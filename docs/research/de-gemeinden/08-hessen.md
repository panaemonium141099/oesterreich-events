# Hessen: Gemeindekalender und Dorffeste (Stand 2026-10-27)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.9`. Methode und Format: Epic-Spec
`fn-28-de-gemeindekalender-dorffeste-in-jeder`. Bundesweite Anbieter stehen in
[00-bundesweit.md](00-bundesweit.md) und werden hier nur verlinkt und mit der
Landessicht ergänzt.

Arbeitsweise: nur lesende GET-Anfragen und Websuche, keine Konten, keine Formulare,
keine Mails. Jede Zahl stammt aus einer eigenen Antwort vom 27.10.2026 oder aus einer
verlinkten Seite. „Eigenangabe“ heißt Werbeaussage des Betreibers, „selbst gezählt“
heißt aus einer abgerufenen Antwort gezählt. Unbelegtes steht als „nicht belegt“ da.

## Kurzfazit

1. **In Hessen tragen zwei Generics mehr als die Hälfte der Stichprobe.** Von 30
   zufällig gezogenen Gemeinden unter 10.000 Einwohnern laufen 9 auf dem CMS
   **ionas** (Chamaeleon AG) und 8 auf **verwaltungsportal.de** (Förderprogramm
   „Hessen vernetzt“), zusammen 17 von 30. Cross7, Heimat-Info, NOLIS und iKISS kamen
   in der Stichprobe nicht vor (je 0 von 30).
2. **ionas liefert einen offenen iCal-Export mit Vereinsterminen.** Jeder
   ionas-Kalender hat eine `events.json` und eine `event.ics`
   (`PRODID:-//IONAS//TVM//DE`) mit Adresse, PLZ, Ort, Veranstalter und Kategorie.
   7 der 9 ionas-Gemeinden hatten dort kommende Termine (9 bis 67 je Gemeinde ab
   28.10.2026). Dorffest-Test bestanden: „Pfirschbacher Kerb“ der Feuerwehr in Höchst
   i. Odw., „Kirmes Schletzenhausen“ in Hosenfeld, „Schlachtfest“ der Feuerwehr
   Annerod in Fernwald.
3. **ekom21 cms21 ist ionas.** ekom21.de selbst meldet `generator "CMS ionas4"`, die
   cms21-Mandanten (`cms-<mandant>.cms21.de`) tragen dieselben Merkmale und denselben
   iCal-Export (selbst geprüft: Hünfeld, Allendorf (Eder)). Ob die ionas-Gemeinden der
   Stichprobe über ekom21 oder direkt bei Chamaeleon laufen, ist nicht belegt. Für die
   Anbindung ist das gleich: ein Parser für alle.
4. **verwaltungsportal.de liefert JSON-LD je Termin**, ohne Feed, mit etwa einem Jahr
   Vorlauf (35 bis 53 Termin-IDs je Gemeinde), Ort teils mit Postadresse. Dorffest-Test
   bestanden: „Weihnachtsmarkt Laisa“ (Battenberg), „Grenzgang“ der Gemeinde Burgwald
   (auf rosenthaler.de).
5. **destination.one deckt kleine hessische Gemeinden nur teilweise ab.** 9 von 30
   Stichprobengemeinden haben dort mindestens einen Termin im Fenster 28.10.2026 bis
   27.10.2027. Hessenweit stehen dort im selben Fenster 1.455 Events, mit Titelwort
   „Kerb“ 0, „Kirmes“ 3, „Weihnachtsmarkt“ 43. Höchst i. Odw. und Hosenfeld haben dort
   keinen Termin, in ihren ionas-Kalendern 44 und 58 kommende. Die Lizenz der hessischen Datensätze war in den Proben CC-BY-SA, nicht CC0.
6. **WITTICH (meinOrt, Amtsblätter) ist in Hessen breit vertreten**, aber nur per
   Vereinbarung nutzbar ([00-bundesweit.md B1](00-bundesweit.md)): 92 Ortsnamen der
   meinOrt-Liste gibt es nur in Hessen, 7 der 30 Stichprobengemeinden haben dort einen
   eigenen Eintrag, 6 verlinken ein WITTICH-Mitteilungsblatt.

## Stichprobe

**Ziehung (reproduzierbar):** Gemeindeverzeichnis-Auszug Destatis, Stichtag 30.09.2026
(`AuszugGV3QAktuell.xlsx`, Blatt `Onlineprodukt_Gemeinden30092026`). Zeilen mit
Satzart `60`, Land `06`, ohne gemeindefreie Gebiete (Textkennzeichen `66`: Michelbuch,
Gutsbezirk Spessart, Gutsbezirk Reinhardswald, Gutsbezirk Kaufunger Wald). Das ergibt
421 Gemeinden (wie im Epic), davon 256 mit weniger als 10.000 Einwohnern (Spalte
„Bevölkerung insgesamt“, 31.12.2025). Diese 256 nach Regionalschlüssel sortiert, dann
`random.Random(28009).sample(liste, 30)` (Python 3.14). Seed 28009 = fn-28, Ticket 9.

**Spalten:** Fundort = Hauptfundort-Klasse. CMS/Plattform mit Erkennungsmerkmal.
d.one = Treffer bei destination.one `open-data`, `q=city:"<Name>"`, Fenster 28.10.2026
bis 27.10.2027 (Abschnitt „Abgleich destination.one“). Kommend = Termine ab 28.10.2026
in der genannten Quelle, sofern abgezählt.

| Nr | Gemeinde | AGS | EW | Fundort | CMS/Plattform | Kalender | Feed/Struktur (kommend) | d.one |
|---|---|---|---|---|---|---|---|---|
| 1 | Weißenborn | 06636015 | 943 | Gemeinde-Website | verwaltungsportal.de (Layout 10873) | https://www.gemeinde-weissenborn.de/veranstaltungen/index.php | JSON-LD je Termin | 0 |
| 2 | Jesberg | 06634010 | 2.105 | Tourismusdatenbank (destination.one) | ProcessWire, kein Kalender | keiner auf jesberg; Termine nur bei destination.one | destination.one (10) | 10 |
| 3 | Rasdorf | 06631022 | 1.549 | Gemeinde-Website | WordPress, The Events Calendar | https://www.rasdorf.de/veranstaltungen/ | Tribe-REST, iCal (11) | 1 |
| 4 | Bad Karlshafen | 06633002 | 3.328 | Tourismusdatenbank (toubiz) | Stadt Joomla; Tourismus GrimmHeimat-Portal mit toubiz | https://www.bad-karlshafen-tourismus.de/veranstaltungen | toubiz-Widget, nicht abgerufen | 13 |
| 5 | Wohratal | 06534022 | 2.119 | Gemeinde-Website | Joomla, DPCalendar | https://www.wohratal.de/leben-freizeit/veranstaltungen.html | Microdata Event (23); iCal nur Sitzungskalender | 0 |
| 6 | Wöllstadt | 06440025 | 6.590 | Gemeinde-Website (nur Websuche) | nicht belegt; robots.txt sperrt Claude-Bots | https://www.woellstadt.de/index.html?modules=events | nicht geprüft | 0 |
| 7 | Philippsthal (Werra) | 06632016 | 3.914 | Gemeinde-Website | statisches HTML (mirumedia) | https://www.philippsthal.de/lebenswert-liebenswert/veranstaltungskalender.html | keiner (1) | 7 |
| 8 | Fernwald | 06531004 | 7.160 | Gemeinde-Website | ionas | https://www.fernwald.de/leben-freizeit/vereine-und-organisationen/was-ist-los-in-fernwald/ | ionas `event.ics`/`events.json` (67) | 0 |
| 9 | Zierenberg | 06633029 | 6.155 | Gemeinde-Website | ionas | https://www.stadt-zierenberg.de/leben-kultur/veranstaltungskalender/ | ionas `event.ics` (9) | 7 |
| 10 | Münzenberg | 06440015 | 5.662 | Gemeinde-Website | Contao (GAL Digital GmbH) | https://www.muenzenberg.de/event-liste.html | Microdata Event | 0 |
| 11 | Cornberg | 06632005 | 1.282 | Tourismusdatenbank (toubiz) | Agentur dd-media | https://www.cornberg.de/extern/veranstaltungskalender.php | toubiz-Widget, nicht abgerufen | 0 |
| 12 | Birstein | 06435004 | 6.115 | Amtsblatt | nicht belegt (Cloudflare 403, robots.txt sperrt Claude-Bots) | keiner geprüft | Zeitung für Birstein und Brachttal, PDF | 0 |
| 13 | Reichelsheim (Wetterau) | 06440021 | 6.913 | Gemeinde-Website | ionas | https://www.stadt-reichelsheim.de/freizeit-tourismus/veranstaltungskalender/ | ionas `events.json` (39) | 0 |
| 14 | Rosenthal | 06635017 | 2.017 | Gemeinde-Website | verwaltungsportal.de (Layout 7219) | https://www.rosenthaler.de/veranstaltungen/index.php | JSON-LD je Termin (16) | 0 |
| 15 | Elbtal | 06533005 | 2.377 | Gemeinde-Website (Fließtext) | TYPO3 (webfacemedia GmbH) | Monatsmeldung „Termine im Oktober“ | keiner | 0 |
| 16 | Oberaula | 06634019 | 3.235 | Tourismusdatenbank (toubiz) | ionas, Kalender ohne Termine | Verweis auf https://www.rotkaeppchenland.de/veranstaltungen | ionas `events.json` nur Hinweise; toubiz | 4 |
| 17 | Eschenburg | 06532009 | 9.709 | Gemeinde-Website | WordPress, The Events Calendar | https://www.gemeinde-eschenburg.de/veranstaltungen | Tribe-REST, iCal (58) | 0 |
| 18 | Hauneck | 06632007 | 3.049 | Gemeinde-Website | verwaltungsportal.de (Layout 9423) | https://www.hauneck.de/veranstaltungen/index.php | JSON-LD je Termin (4) | 0 |
| 19 | Hirzenhain | 06440011 | 2.741 | Gemeinde-Website (fast leer) | verwaltungsportal.de (Layout 5799) | https://www.hirzenhain.de/veranstaltungen/index.php | JSON-LD je Termin (1) | 0 |
| 20 | Gedern | 06440009 | 6.657 | Gemeinde-Website | verwaltungsportal.de (Layout 2963) | https://www.gedern.de/veranstaltungen/index.php | JSON-LD je Termin (29 Links) | 0 |
| 21 | Großalmerode | 06636004 | 6.049 | Gemeinde-Website | ionas | https://www.grossalmerode.de/freizeit-tourismus/freizeit/veranstaltungskalender/ | ionas `event.ics` (34) | 1 |
| 22 | Battenberg (Eder) | 06635004 | 5.463 | Gemeinde-Website | verwaltungsportal.de (Layout 336) | https://www.battenberg-eder.de/veranstaltungen/index.php | JSON-LD je Termin (53 IDs) | 6 |
| 23 | Höchst i. Odw. | 06437009 | 9.751 | Gemeinde-Website | ionas | https://www.hoechst-i-odw.de/tourismus/veranstaltungen/veranstaltungskalender/ | ionas `event.ics` (44) | 0 |
| 24 | Malsfeld | 06634013 | 3.705 | Gemeinde-Website | IONOS MyWebsite | https://www.malsfeld.net/bürgerservice/veranstaltungskalender/ | JSON im HTML (15) | 0 |
| 25 | Siegbach | 06532019 | 2.496 | Gemeinde-Website (leer) | ionas | https://www.siegbach.de/freizeit/veranstaltungen/ | ionas `event.ics` (0) | 0 |
| 26 | Glauburg | 06440010 | 2.989 | Gemeinde-Website | verwaltungsportal.de (Layout 2024) | https://www.glauburg.de/veranstaltungen/index.php | JSON-LD je Termin (49 IDs) | 0 |
| 27 | Birkenau | 06431004 | 9.562 | Gemeinde-Website | TYPO3 `tx_communicecalendar` (inixmedia GmbH) | https://www.birkenau.de/veranstaltungen | Atom `/veranstaltungen/rss` (66) | 0 |
| 28 | Hünfelden | 06533008 | 9.744 | Gemeinde-Website | ionas | https://www.huenfelden.de/freizeit-tourismus/veranstaltungen/ | ionas `event.ics` (40) | 0 |
| 29 | Hosenfeld | 06631014 | 4.554 | Gemeinde-Website | ionas | https://www.gemeinde-hosenfeld.de/freizeit-tourismus/veranstaltungen/ | ionas `event.ics` (58) | 0 |
| 30 | Gemünden (Wohra) | 06635012 | 3.543 | Gemeinde-Website | verwaltungsportal.de (Layout 10703) | https://www.gemuenden-wohra.de/veranstaltungen/index.php | JSON-LD je Termin (35 IDs) | 1 |

Anmerkungen:
* Jesberg: Die Website hat keinen Kalender; bei destination.one stehen 10 Jesberger
  Termine, darunter „Vereinsweihnachtsfeier der Feuerwehr Jesberg“ (05.12.2026, ID
  100433624). Deshalb Fundort Tourismusdatenbank.
* Rosenthal: Die 6 Treffer von `city:"Rosenthal"` liegen in Rosenthal-Bielatal (PLZ
  01824, Sachsen) und zählen nicht.
* Gemünden (Wohra): Der eine Treffer ist ein Wochenmarkt mit Wiederholungsregel ab
  2025; er zählt nach der Regel der Spec als Treffer.
* Wöllstadt (`Disallow: /` für Claude-Code, ClaudeBot, anthropic-ai) und Birstein
  (robots.txt sperrt ClaudeBot, Claude-Web, anthropic-ai; Cloudflare 403) wurden nicht
  weiter abgerufen. Für Wöllstadt belegen nur Suchtreffer einen Kalender
  („Gruseliges Kürbisfest“ 24.10.2026, „Dorfflohmarkt“ 14.06.2026, nicht selbst geprüft).
* Zwei naheliegende Domains gehören nicht den Gemeinden: weissenborn.de
  (Elektrofachhandel), zierenberg.de (leitet auf apartments-b2b.com).

**Weitere Merkmale der Stichprobe:**
* Amtsblatt/Mitteilungsblatt von LINUS WITTICH verlinkt: Rasdorf (E-Paper 1151),
  Zierenberg („Warmetal aktuell“), Eschenburg („Wochenzeitung online“), Hauneck,
  Hünfelden (Katalog 470), Hosenfeld (Katalog 1080, Herbstein): 6 von 30. Eigene PDFs
  ohne belegten Verlag: Weißenborn („Brücke zum Nachbarn“), Hirzenhain, Siegbach
  („WiMS“), Glauburg („Blitzlicht“, „Bürgerblatt“), Gemünden („Gemündener
  Nachrichten“), Birstein/Brachttal.
* Crossiety verlinkt: Battenberg, Gemünden (Wohra), Hosenfeld (3 von 30).
* Orts.App (apicodo GmbH, Mainz, Marke Merkurist): Weißenborn
  (https://weissenborn.orts.app/), Termine nur in der JS-App.
* ekom21 erscheint auf mehreren Seiten nur als Dienstleister für Fachverfahren
  (`portal-civ.ekom21.de`, `rim.ekom21.de`, `votemanager-gi.ekom21cdn.de`,
  `wahlschein.ekom21.de`), nicht als Website-Betreiber.

## Generics

### G1. ionas (Chamaeleon AG), in Hessen auch als ekom21 cms21

* **Betreiber:** Chamaeleon AG (https://www.chamaeleon.de/). Eigenangabe in der
  Broschüre „Wir sind Chamaeleon“: „über 2.500 erfolgreich durchgeführte Projekte bei
  über 600 kommunalen Kunden“, CMS ionas4 mit Schnittstellen u. a. „iCAL“ und
  „Tourismusportale“
  (https://images.nuernbergmesse.de/files/abfdfc9d-a76d-f598-a4f2-a2d09af021bd.pdf ,
  undatiert). Die 600 Kunden gelten für alle Produkte und alle Länder.
* **Verhältnis zu ekom21:** ekom21 (KGRZ Hessen) bietet „cms21“ als
  Content-Management-Suite für Kommunen an (https://www.ekom21.de/loesungen/cms21/ ,
  Gesamtbroschüre 2024). Die Produktseite nennt ionas nicht, ekom21.de selbst trägt
  aber `<meta name="generator" content="CMS ionas4">` (Gruppe b). Die Seite des
  Landkreises Waldeck-Frankenberg (laut ekom21-Presse 2021 cms21) hat das Backend
  `https://cms-kv-waldeck-frankenberg.cms21.de/:system`. Zertifikatslogs nennen 19
  benannte Mandanten unter `cms21.de` (selbst gezählt, https://crt.sh/?q=%25.cms21.de ,
  daneben ein Wildcard-Zertifikat, also Untergrenze): Gemeinden Allendorf (Eder) und
  Bromskirchen (ein Mandant), Büttelborn, Lohfelden; Städte Bad Camberg, Borken,
  Fritzlar, Geisenheim, Gudensberg, Hessisch Lichtenau, Hünfeld, Nidderau, Oberursel,
  Schlitz; Kreise Vogelsbergkreis, Waldeck-Frankenberg; dazu Demo-, Schulungs- und
  Feuerwehr-Mandanten. Die 9 ionas-Gemeinden der Stichprobe führen das Backend unter
  ihrer eigenen Domain (`https://www.<gemeinde>.de/:system`); ob sie cms21-Kunden sind,
  ist nicht belegt. Eine ekom21-Präsentation mit „über 100 Kommunen“ war nur als
  Suchtreffer sichtbar, der Link antwortete 404: nicht belegt.
* **Gemeinden in Hessen:** 9 von 30 der Stichprobe (Fernwald, Zierenberg, Reichelsheim
  (Wetterau), Oberaula, Großalmerode, Höchst i. Odw., Siegbach, Hünfelden, Hosenfeld),
  davon 7 mit kommenden Terminen. Außerhalb der Stichprobe geprüft: Hünfeld, Allendorf
  (Eder), Schlitz (cms21; Kalender wird laut Seite umgebaut, Termine vorübergehend als
  Fließtext), Kreis Bergstraße.
* **Erkennung:** `id="ionasInfo"` mit `"backend":"…/:system"`, Attribute
  `data-ionas4-*`, Ressourcen unter `/:res/modules/`, Links mit `?cid=`, Kalender-
  Komponenten `tvm-picker`, `tvm-calendar`, `<media-eventslider-slider source="…/events.json">`.
  robots.txt fehlt (404 oder Startseite). Einzelne Mandanten liefern ohne
  `Accept: text/html` einen leeren Body (Allendorf (Eder), Lohfelden selbst geprüft).
* **Zugriff:** Im Quelltext der Kalenderseite steht der Pfad der `events.json`; mit
  `event.ics` statt `events.json` kommt der iCal-Export. Beide mit
  `?weekends=false&tagMode=ALL`. Gesehene Pfade: `/kalender/event.ics`,
  `/kalender/veranstaltungen/event.ics`, `/kalender/veranstaltungskalender/event.ics`,
  `/de/kalender/huenfeld-veranstaltungen/event.ics`. Zeitfenster etwa ein Jahr zurück
  bis ein Jahr voraus (Hünfeld 31.10.2025 bis 22.10.2027). In Reichelsheim antwortete
  die vermutete `event.ics` mit 404, die `events.json` mit Terminen.
* **Felder iCal (Probe Hünfeld, 988 VEVENT, selbst gezählt):** `SUMMARY`,
  `DESCRIPTION`, `DTSTART;TZID=Europe/Berlin`, `DTEND`, `UID`, `CREATED`,
  `LAST-MODIFIED`, `LOCATION`, `X-LOCATION-NAME`, `X-STREET-ADDRESS`, `X-POSTAL-CODE`,
  `X-LOCALITY`, `X-ORGANIZER-NAME`, `X-ORGANIZER-EMAIL`, `X-ORGANIZER-WEBSITE`,
  `X-IONAS-CATEGORY`, `CATEGORIES`, `ATTACH` (Bild), selten `GEO`, `X-PRICE`, `URL`.
  Häufigkeit in Hünfeld: `X-LOCALITY` 774, `X-POSTAL-CODE` 745, `X-ORGANIZER-NAME`
  943 von 988. `CONTACT` und `X-CONTACT-*` enthalten Namen, private Mailadressen und
  Telefonnummern: beim Import verwerfen.
* **Felder JSON:** `id` („22134:0“), `start`, `end` (Ortszeit ohne Offset), `allDay`,
  `title`, `website`, `imageSrc`, `category{id,name}`, `tags[]`, `location{name,
  description, href}`. Keine Adresse, keine Detail-URL: iCal ist der bessere Weg.
* **Lizenz/robots:** keine Nutzungsbedingungen für die Exporte gefunden. Die
  Startseite des Landkreises Waldeck-Frankenberg trägt
  `<meta name="robots" content="noai, noindex, …, Anthropic-AI: noindex, Claude-Web: noindex …">`;
  bei den Stichprobengemeinden stand `noai` nur auf der 404-Seite (Gruppe a). Das
  Meta muss je Mandant geprüft werden.
* **Gemeinde-Beispiele:** Höchst i. Odw.
  https://www.hoechst-i-odw.de/kalender/event.ics?weekends=false&tagMode=ALL (187
  VEVENT, 44 ab 28.10.2026, selbst nachgeprüft); Hosenfeld
  https://www.gemeinde-hosenfeld.de/freizeit-tourismus/veranstaltungen/ (178, 58
  kommend); Allendorf (Eder)
  https://www.allendorf-eder.de/kalender/event.ics?weekends=false&tagMode=ALL (61, 11
  kommend, selbst geprüft).
* **Dorffest-Test:** bestanden. „Pfirschbacher Kerb“ 15. bis 17.08.2026, Veranstalter
  „Pfirschbacher Feuerwehr“, und „Sachsenhäuser Kerb der Feuerwehr Höchst“ 26.09.2026
  (Höchst, iCal); „Kirmes Schletzenhausen“ 12.09.2026 und „Backhausfest Poppenrod“
  23.05.2026 der FF Poppenrod (Hosenfeld); „Schippelfest in Uengsterode“ 29.08.2026 der
  FFW Uengsterode (Großalmerode); „Burgfest“ 11.07.2026 der FF Kirberg (Hünfelden);
  „Schlachtfest“ 07.11.2026 der Feuerwehr Annerod (Fernwald); außerhalb der Stichprobe
  „Heimat- und Bezirksschützenfest in Rennertehausen“ 03.07.2026 (Allendorf (Eder)) und
  „Kirmes Mackenzell“ 05.11.2026 (Hünfeld).
* **Nächster Schritt:** Detektor über die Startseiten aller 421 hessischen Gemeinden
  (ein GET je Seite, Merkmal `ionasInfo`), dann je Treffer einmal die Kalenderseite
  für den `events.json`-Pfad. Bei ekom21 und Chamaeleon nachfragen, ob die
  iCal-Exporte für ein Portal genutzt werden dürfen und ob es eine Mandantenliste gibt.

### G2. verwaltungsportal.de („Hessen vernetzt“)

Plattform und Technik: [00-bundesweit.md C7](00-bundesweit.md). Landessicht:

* **Gemeinden in Hessen:** 8 von 30 der Stichprobe (Weißenborn, Rosenthal, Hauneck,
  Hirzenhain, Gedern, Battenberg (Eder), Glauburg, Gemünden (Wohra)). Die
  Programmseite https://www.azubi-projekte.de/hessen nennt 8 Kommunen als Auswahl
  (Neu-Eichenberg, Maintal, Espenau, Ulrichstein, Ortenberg, Schenklengsfeld,
  Grebenstein, Rüdesheim am Rhein); das Programmblatt in Trebur nennt zusätzlich
  Kefenrod (https://trebur.de/fileadmin/media/nachrichten/2024/Foerderprogramm_Hessen_vernetzt.pdf).
  Eine Gesamtzahl gibt es nicht. Erkennbar auch am Footer „Hessen vernetzt“ oder
  „<Ort> vernetzt“.
* **Zugriff:** `/veranstaltungen/index.php` listet alle Termine etwa ein Jahr voraus
  ohne Paginierung (Battenberg 53, Glauburg 49, Gemünden 35 Termin-IDs), Detailseiten
  `/veranstaltungen/<id>/<JJJJ>/<MM>/<TT>/<slug>.html` mit JSON-LD `Event`.
* **Felder (neu gegenüber C7):** `location` ist teils `Place` mit `PostalAddress`
  (`streetAddress`, `postalCode`, `addressLocality`, `url` auf die
  Verzeichnis-Visitenkarte; Hirzenhain, Battenberg, Glauburg, Gemünden), teils nur
  `name` (Weißenborn, Gedern). `startDate` mal als Datum, mal mit Offset
  (`2026-11-13T19:00:00+0100`). Keine Koordinaten, kein Feed.
* **robots.txt:** auf allen 8 Seiten gleich, Regeln nur für benannte SEO-Bots.
* **Dorffest-Test:** bestanden. „Weihnachtsmarkt Laisa“ 28.11.2026
  https://www.battenberg-eder.de/veranstaltungen/2833752/2026/11/28/weihnachtsmarkt-laisa.html ;
  „Grenzgang: 30 Jahre Partnerschaft Perbal Burgwald“, 8. Grenzgang der Gemeinde
  Burgwald, 27. bis 29.08.2027
  https://www.rosenthaler.de/veranstaltungen/2938951/2027/08/27/grenzgang-30-jahre-partnerschaft-perbal-burgwald.html ;
  „Haxenessen FFW Oberhaun“ 13.11.2026 (Hauneck); „Adventsglühen der Jugendfeuerwehr“
  27.11.2026 (Gemünden); „Adventsmarkt Rambach“ 28.11.2026 (Weißenborn).
* **Nächster Schritt:** Merkmal `layout.verwaltungsportal.de` in denselben Detektor;
  ein Parser Liste plus JSON-LD. Nutzungsbedingungen beim Förderverein für regionale
  Entwicklung e.V. erfragen (nicht belegt).

### G3. WordPress The Events Calendar und weitere Plugins

Technik: [00-bundesweit.md D1/D4](00-bundesweit.md). In der Stichprobe 2 von 30 mit
Tribe-REST: Rasdorf (`total` 18, 11 kommend, `venue.zip`/`city`) und Eschenburg
(`total` 58 ab 28.10.; bei Vereinsterminen ist `venue` meist leer, Verein und Ort
stehen in `description`). Dazu Joomla DPCalendar in Wohratal: iCal je Kalender
`index.php?option=com_dpcalendar&task=ical.download&id=<ID>` (PRODID DPCALENDAR); der
geprüfte Kalender 129 enthält nur Sitzungen, die Veranstaltungen stehen als Microdata
`Event` im HTML. DPCalendar fehlt bisher in den Erkennungsregeln D5.
Dorffest-Test: „Kirmes in Rasdorf“ 23. bis 26.10.2026, Kirmesgesellschaft
https://www.rasdorf.de/event/kirmes-in-rasdorf/ ; „Weihnachtsmarkt“ aller Vereine
28.11.2026 (Eschenburg); „Weihnachtlicher Dorfmarkt in Wohra“ 28.11.2026
https://www.wohratal.de/leben-freizeit/veranstaltungen/weihnachtlicher-dorfmarkt-in-wohra.html .

### G4. toubiz in Nordhessen (GrimmHeimat NordHessen)

* **Befund:** Bad Karlshafen (Tourismusseite) und das Portal rotkaeppchenland.de (auf
  das Oberaula verweist) teilen das Portal-Gerüst `/extension/portal-ngh/` mit
  `tportal`-Klassen; Cornberg bindet `<toubiz-widget base-uri="https://mein.toubiz.de">`
  mit eigener Orts-UUID ein. 3 von 30 Gemeinden der Stichprobe verweisen für Termine
  auf toubiz.
* **Zugriff:** Das Widget ruft `https://mein.toubiz.de/api/v1/event` (auch
  `eventDates`, `eventDate/{id}`) mit Header `X-Api-Token` auf; das Token steht im
  Seitenquelltext. Es wurde bewusst nicht benutzt, weil es einem Dritten gehört.
  robots.txt: mein.toubiz.de sperrt nur `/storage/`, rotkaeppchenland.de u. a. `/*ics/`.
* **Felder, Lizenz, Gemeindezahl:** nicht belegt.
* **Dorffest-Test:** nicht möglich (Inhalte nur über die API).
* **Nächster Schritt:** Bei der GrimmHeimat NordHessen bzw. toubiz einen eigenen
  Zugang und die Lizenz anfragen; vorher prüfen, ob dieselben Daten schon über
  destination.one kommen (Bad Karlshafen hat dort 13 Termine).

### G5. WITTICH: meinOrt, Mitteilungsblätter, Heimat-Info

Anbieter, AGB und Datenweg: [00-bundesweit.md A1/B1](00-bundesweit.md). Landessicht:

* **meinOrt:** Die Ortsliste https://meinort.de/orte-list (2.197 Links, ein Abruf)
  enthält 100 Namen hessischer Gemeinden; 92 davon gibt es als Gemeindenamen nur in
  Hessen, 75 dieser 92 haben weniger als 10.000 Einwohner (selbst abgeglichen gegen das
  Gemeindeverzeichnis). Ortsteile ohne eigenen Gemeindenamen sind darin nicht gezählt.
  In der Stichprobe haben 7 von 30 einen Eintrag: Jesberg, Philippsthal (Werra),
  Fernwald, Zierenberg, Hauneck, Hirzenhain, Gedern. Hauneck verlinkt
  `meinort.app/3311-Hauneck` selbst.
* **Mitteilungsblätter:** 6 von 30 verlinken ein WITTICH-Blatt (siehe Stichprobe).
* **Heimat-Info:** Von 648 Kommunen der API (ein Abruf `communes/search`) liegen 6 in
  Hessen (Abgleich über Koordinaten und Namen): Oberursel (Taunus), Flörsbachtal,
  Gründau, Dietzhölztal, Wolfhagen, Witzenhausen; davon 2 unter 10.000 Einwohnern
  (Flörsbachtal, Dietzhölztal). In der Stichprobe 0 von 30.
* **Dorffest-Test:** für Hessen aus dem Vorbericht (Herbstein: „Dämmerschoppen des MGV
  Eintracht 1888 Engelrod“, „Salzekuchenessen in Dirlammen“); hier keine weiteren
  Abrufe, weil meinOrt Abrufe ohne Zustimmung ausschließt.
* **Nächster Schritt:** Teil des einen WITTICH-Gesprächs aus dem Vorbericht.

### G6. Einzelhersteller ohne Generic-Wirkung

Je einmal in der Stichprobe, jeweils mit maschinenlesbarem Zugang, aber ohne Hinweis
auf viele hessische Kunden:

| Hersteller | Gemeinde | Zugang, Felder | Dorffest-Beleg |
|---|---|---|---|
| inixmedia GmbH (Bamberg), TYPO3 `tx_communicecalendar` | Birkenau | Atom `/veranstaltungen/rss` (66 kommend): `title`, `link`, `published` (Start), `summary` mit „Start: … Ende: …“, `category`; kein Ortsfeld | „Birkenauer Weihnachtsmarkt“ 12./13.12.2026 https://www.birkenau.de/veranstaltungen/veranstaltung/birkenauer-weihnachtsmarkt |
| IONOS MyWebsite (Jimdo-Baukasten) | Malsfeld | JSON im HTML (`title`, `desc`, `fromDate`, `fromTime`, `toDate`, `toTime`, `repetition`), kein Ort | „Weihnachtsmarkt in Beiseförth“ 05./06.12.2026 |
| GAL Digital GmbH, Contao | Münzenberg | Microdata Event, Pager `page_e183` | „Martinimarkt in Münzenberg“ 12.11.2026 https://www.muenzenberg.de/event-liste/martinimarkt-in-muenzenberg.html |
| mirumedia (Ludwigsau), statisches HTML | Philippsthal | kein Feed | „Kürbisfest“ 31.10.2026, HVV Heimboldshausen |

### G7. Kreis- und Regionalkalender, Kirche

* **Kreis Bergstraße:** Der Veranstaltungsfinder läuft heute auf ionas (iCal mit 27
  Terminen, für Birkenau nur ein Solarstammtisch, Gruppe c); das im Vorbericht E
  genannte RCE-Event war nicht mehr zu finden. Als Sammelquelle ungeeignet.
* **Vogelsberg Touristik:** https://www.vogelsberg-touristik.de/veranstaltungen ,
  TYPO3 mit `we2p`-Webmodulen, Ortsfilter mit 175 Werten (u. a. Birstein, Gedern,
  Freiensteinau, Herbstein). Herkunft der Daten und Export nicht belegt. Die Stadt
  Schlitz verweist ihre Termine dorthin.
* **termine.ekhn.de** (Veranstaltungsdatenbank der Evangelischen Kirche in Hessen und
  Nassau): Symfony-Anwendung (`/bundles/vket/`), Export auf der Startseite nicht
  gefunden, robots.txt antwortet 404. Kirchliche Termine, für Dorffeste Nebenquelle;
  nicht weiter geprüft.

## Dorffest-Test (Übersicht)

| Quelle | Bestanden | Beleg |
|---|---|---|
| ionas iCal | ja | „Pfirschbacher Kerb“ 15. bis 17.08.2026, Pfirschbacher Feuerwehr, https://www.hoechst-i-odw.de/kalender/event.ics?weekends=false&tagMode=ALL |
| verwaltungsportal.de | ja | „Weihnachtsmarkt Laisa“ 28.11.2026; „Grenzgang“ Burgwald 27.08.2027 (Links in G2) |
| The Events Calendar | ja | „Kirmes in Rasdorf“ 23. bis 26.10.2026, https://www.rasdorf.de/event/kirmes-in-rasdorf/ |
| inixmedia communice | ja | „Birkenauer Weihnachtsmarkt“ 12./13.12.2026 |
| destination.one | ja | „Battenberger Heimatfest“ ab 04.06.2027 (ID 101364692), „Weihnachtsmarkt in Laisa“ 28.11.2026 (ID 101346280), „Kirmes in Lüdersdorf (Bebra)“ |
| toubiz | nicht prüfbar | API nur mit fremdem Token |
| meinOrt | ja (Vorbericht) | Vereinstermine Herbstein, [00-bundesweit.md B1](00-bundesweit.md) |

Festarten: Kerb, Kirmes, Grenzgang, Backhausfest, Schlachtfest, Schützenfest,
Feuerwehrfeste und Weihnachtsmärkte sind belegt. Weinfeste kamen in der Stichprobe
nicht vor (die Weinorte im Rheingau und an der Bergstraße wurden nicht gezogen).

## Abgleich destination.one

Abfrage: `https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=50&q=city:"<Name>"&startdate=10/28/2026&enddate=10/27/2027`
(Name ohne Zusätze wie „, Stadt“). Das Datumsformat `MM/TT/JJJJ` liefert ohne Ortsfilter
34.725 Events, dieselbe Zahl wie im Vorbericht G.

* **Stichprobe:** 9 von 30 Gemeinden mit mindestens einem Treffer (Jesberg 10, Rasdorf
  1, Bad Karlshafen 13, Philippsthal 7, Zierenberg 7, Oberaula 4, Großalmerode 1,
  Battenberg 6, Gemünden 1); Rosenthal nicht gezählt (Treffer in Sachsen). Höchst
  i. Odw. zusätzlich mit `city:"Höchst im Odenwald"` geprüft: 0. Ein Ortsfilter auf den
  Gemeindenamen findet Termine nicht, die unter einem Ortsteilnamen geführt werden;
  der Wert ist eine Untergrenze.
* **Hessen gesamt im Fenster:** `q=area:"Hessen"` 1.455 Events (alle Termine ohne
  Fenster laut Ausgangsbericht 5.249).
* **Festarten im Titel**, `q=area:"Hessen" AND title:<Wort>`, gleiches Fenster:

| Titelwort | Events | Titelwort | Events |
|---|---|---|---|
| Weihnachtsmarkt | 43 | Weinfest | 1 (Enser Weinfest, Korbach) |
| Kirmes | 3 (Lüdersdorf, Solz, Meineringhausen) | Kerb | 0 |
| Schützenfest | 3 (alle Willingen (Upland)) | Kerwe | 0 |
| Kirchweih | 0 | Grenzgang | 0 |
| Feuerwehrfest | 0 | Dorffest | 0 |
| Backhausfest | 0 | | |

* **Herkunft und Lizenz:** Die Treffer in Jesberg und Battenberg tragen
  `source.value: destination.one` und `license: CC-BY-SA` (Jesberg 10 von 10,
  Battenberg 6 von 6). Der Ausgangsbericht fand in seiner bundesweiten Probe nur CC0;
  für Hessen gilt das nicht pauschal, die Lizenz muss je Datensatz gelesen werden.
* **Überschneidung:** „Weihnachtsmarkt Laisa“ steht in destination.one und auf der
  Battenberger verwaltungsportal-Seite (gleiches Datum), das fängt der bestehende
  Dedup. Für Höchst i. Odw. (44 kommende Termine im ionas-Kalender) und Hosenfeld (58)
  liefert destination.one im Fenster keinen Termin.

## Abdeckung (nur Stichprobenanteil)

Formel: Anteil = k / 30; Hochrechnung auf die 256 Gemeinden unter 10.000 Einwohnern
= 256 × k / 30. Das ist eine Schätzung aus 30 Ziehungen, keine Zählung; in Klammern
das 95-%-Wilson-Intervall des Anteils.

| Merkmal | k | Anteil | 256 × k / 30 |
|---|---|---|---|
| ionas (Merkmal vorhanden) | 9 | 30,0 % (17 bis 48 %) | 77 |
| ionas mit kommenden Terminen im iCal/JSON | 7 | 23,3 % (12 bis 41 %) | 60 |
| verwaltungsportal.de | 8 | 26,7 % (14 bis 44 %) | 68 |
| ionas oder verwaltungsportal.de | 17 | 56,7 % (39 bis 73 %) | 145 |
| Gemeindekalender mit kommenden Terminen in maschinenlesbarer Form (Feed, JSON, JSON-LD, Microdata) | 21 | 70,0 % (52 bis 83 %) | 179 |
| destination.one mit mindestens einem Treffer | 9 | 30,0 % (17 bis 48 %) | 77 |
| eigener meinOrt-Eintrag | 7 | 23,3 % (12 bis 41 %) | 60 |
| WITTICH-Mitteilungsblatt verlinkt | 6 | 20,0 % (10 bis 37 %) | 51 |
| toubiz als Fundort | 3 | 10,0 % (3 bis 26 %) | 26 |
| Cross7, Heimat-Info, NOLIS, iKISS | 0 | 0 % (0 bis 11 %) | 0 |

Die 21 setzen sich zusammen aus 7 ionas, 8 verwaltungsportal.de, 2 Tribe, je 1
inixmedia, IONOS, Contao (Microdata) und Joomla (Microdata). Ohne strukturierten
Gemeindekalender bleiben 9: Jesberg, Bad Karlshafen, Wöllstadt, Philippsthal, Cornberg,
Birstein, Elbtal, Oberaula, Siegbach.

## Priorisierte Integrationsliste Hessen

Bewertet nach Datenqualität vor Menge, dann Gemeinden je Integration, dann Rechtslage.

| # | Integration | Gemeinden (Beleg) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | ionas iCal (inkl. ekom21 cms21) | 9 von 30 Stichprobe; 19 cms21-Mandanten in Zertifikatslogs; Chamaeleon „über 600 kommunale Kunden“ (Eigenangabe, bundesweit) | sehr gut: Adresse, PLZ, Ort, Veranstalter, Kategorie, Bild; Kontaktdaten verwerfen | keine Bedingungen gefunden; `noai`-Meta je Mandant prüfen | Detektor über 421 Startseiten; Anfrage ekom21 und Chamaeleon (Nutzung, Mandantenliste) |
| 2 | verwaltungsportal.de | 8 von 30 Stichprobe | gut: Titel, Datum, Beschreibung, Ort teils mit Adresse; keine Koordinaten | nicht belegt | gleicher Detektor; Parser Liste plus JSON-LD; Förderverein nach Nutzungsbedingungen fragen |
| 3 | destination.one `open-data` | 9 von 30 mit Treffern; 1.455 Events Hessen im 12-Monats-Fenster | gut, mit Koordinaten; Lizenz je Datensatz (CC-BY-SA gesehen) | offen, Klärung laut Ausgangsbericht | ohnehin geplanter Import; Lizenzfilter muss CC-BY-SA mit Namensnennung können |
| 4 | Plugin-Detektor (Tribe, DPCalendar, communice-Atom) | 3 bis 4 von 30 | Tribe gut, Atom ohne Ort | Gemeinde-Websites | Regeln aus 00-bundesweit D5 plus DPCalendar und `tx_communicecalendar` |
| 5 | WITTICH meinOrt | 7 von 30 mit eigenem Eintrag, 92 nur hessische Ortsnamen | gut (JSON mit Adresse) | nur mit Zustimmung | im WITTICH-Gespräch Hessen ausdrücklich nennen |
| 6 | toubiz (GrimmHeimat NordHessen) | 3 von 30 als Fundort | nicht belegt | Token Dritter, Lizenz nicht belegt | Zugang anfragen; vorher Überschneidung mit destination.one messen |
| | Nicht weiter verfolgen | | | | Cross7, Heimat-Info, NOLIS, iKISS (je 0 von 30); Einzelhersteller ohne Feed; Kreis Bergstraße; Orts.App (nur JS) |

**Lücken:**
* 9 von 30 Gemeinden haben keinen strukturierten Gemeindekalender. Zwei davon
  (Wöllstadt, Birstein) sperren Claude-Bots per robots.txt; ihre Termine bleiben ohne
  Zustimmung offen.
* Amtsblätter ohne WITTICH (Weißenborn, Hirzenhain, Siegbach, Glauburg, Gemünden,
  Birstein) sind nur PDF. epflicht-hessen.hebis.de archiviert manche davon
  (Birstein/Brachttal), ausgewertet wurde nichts.
* Weinfeste (Rheingau, Bergstraße) und Grenzgänge großer Orte (Biedenkopf) fallen in
  Gemeinden über 10.000 Einwohnern oder wurden nicht gezogen; sie brauchen eine eigene
  Prüfung, nicht diese Stichprobe.
* Gesamtzahl der ionas- und verwaltungsportal-Gemeinden in Hessen ist nur geschätzt,
  bis der Detektor gelaufen ist.

## Erkennungsregeln, Ergänzung zu 00-bundesweit D5

* `id="ionasInfo"`, `data-ionas4-`, `/:res/modules/` → ionas: `events.json`-Pfad aus
  der Kalenderseite, `event.ics` daneben (Header `Accept: text/html` mitsenden).
* `cms-<mandant>.cms21.de/:system` → ionas (ekom21 cms21), wie oben.
* `com_dpcalendar` → iCal `task=ical.download&format=raw&id=<ID>` je Kalender.
* `tx_communicecalendar` → Atom `/veranstaltungen/rss`.
* `toubiz-widget`, `mein.toubiz.de` → toubiz, nur mit eigenem Zugang.
* `weissenborn.orts.app`, `miniScope.networkSlug` → Orts.App (apicodo), nur JS.

## Anfragen

Alle Anfragen am 27.10.2026, nur GET. Rohprotokolle der drei Stichproben-Gruppen mit
URL und Statuscode liegen in den Sitzungsnotizen (`fn28-9-he-a.md`,
`fn28-9-he-a-requestlog.txt`, `fn28-9-he-b.md`, `fn28-9-he-c.md`); hier die Zahl je Host.

| Host | Anfragen | Zweck |
|---|---|---|
| www.destatis.de | 1 | Gemeindeverzeichnis-Auszug |
| meta.et4.de | 46 | 2 Proben, 30 Stichprobe, 3 Detail/Nachprüfung, 11 Festarten; je 5 bis 6 s Abstand, alle mit `status: OK` |
| heimatinfo-api-platform.azurewebsites.net | 1 | `communes/search` |
| meinort.de | 2 | robots.txt, `/orte-list` |
| crt.sh | 1 | Zertifikate `%.cms21.de` |
| www.ekom21.de | 5 | robots.txt, cms21-Seite, Geschäftsbericht 2024, Geschäftsbericht 2018 (301), Gesamtbroschüre 2024; Gruppen b und c 5 weitere |
| beratungszentrum.hessen.de | 1 | ekom21-Präsentation (404) |
| www.landkreis-waldeck-frankenberg.de | 5 | robots.txt, Startseite (2), Gruppe c 2 |
| www.huenfeld.de | 4 | robots.txt, Startseite, Kalender, `event.ics` |
| www.schlitz.de | 3 | robots.txt, Startseite, Kalender |
| www.vogelsbergkreis.de | 2 | robots.txt, Startseite |
| www.allendorf-eder.de | 4 | Startseite (ohne und mit Accept), Kalender, `event.ics` |
| bromskirchen.de | 1 | keine Verbindung |
| www.lohfelden.de | 2 | Startseite (ohne und mit Accept) |
| www.hoechst-i-odw.de | 1 | Nachprüfung `event.ics` (plus Gruppe c 4) |
| www.battenberg-eder.de, www.rasdorf.de, www.rosenthaler.de | je 1 bis 2 | Nachprüfung der Belege (plus Gruppen) |
| www.vogelsberg-touristik.de | 2 | robots.txt, Veranstaltungen |
| termine.ekhn.de | 2 | robots.txt (404), Startseite |
| trebur.de | 1 | Programmblatt „Hessen vernetzt“ |
| www.azubi-projekte.de | 2 | robots.txt, `/hessen` |
| images.nuernbergmesse.de | 1 | Chamaeleon-Broschüre |
| www.chamaeleon.de | 1 | robots.txt (Startseite) |
| Gemeinde-Websites der Stichprobe | je höchstens 6 | Gruppen a, b, c (Protokolle) |
| widget.toubiz.de, mein.toubiz.de, www.rotkaeppchenland.de, www.bad-karlshafen-tourismus.de | 4, 1, 5, 2 | Widget-Code, robots.txt; API nicht abgerufen |
| weissenborn.orts.app, epaper.wittich.de, de.wikipedia.org | 3, 2, 6 | Gruppen a und c |
| Websuche | etwa 55 | alle Gruppen und Hauptsitzung |

Nicht abgerufen: Cross7-API, Heimat-Info-Events, toubiz-API, meinOrt-Termine,
cmsweb.wittich.de, nussbaum.de, WITTICH-PDFs, woellstadt.de und birstein.de über die
robots.txt hinaus.
