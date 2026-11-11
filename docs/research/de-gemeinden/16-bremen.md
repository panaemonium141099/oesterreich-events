# Bremen und Bremerhaven: Stadtteiltermine und Dorffeste (Stand 2026-10-29)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.17`. Methode und Format: Epic-Spec
`fn-28-de-gemeindekalender-dorffeste-in-jeder`. Bundesweite Anbieter stehen in
[00-bundesweit.md](00-bundesweit.md), Tourismus- und Ticketingquellen in
[../deutschland-event-quellen-2026-10.md](../deutschland-event-quellen-2026-10.md); beide
werden hier nur verlinkt und um die Bremer Sicht ergänzt. In der
[Vollerhebung](01-vollerhebung.md) stehen beide Städte in Stufe R (Startseite nicht
erreichbar bzw. robots); dieser Bericht ersetzt das für Bremen durch die Sicht auf
Stadtteilebene.

Arbeitsweise: nur lesend, keine Konten, keine Formulare, keine Mails. Abrufe per GET mit
wenigen Anfragen je Host; die Suche auf bremen.de lief über die Suchmaske der Seite im
Browser (Abschnitt G1). Jede Zahl stammt aus einer eigenen Antwort vom 29.10.2026 oder aus
einer verlinkten Seite. „Eigenangabe“ heißt Aussage des Betreibers, „selbst gezählt“ heißt
aus einer abgerufenen Antwort gezählt. Unbelegtes steht als „nicht belegt“ da. Alle
Anfragen: [16-bremen-anfragen.md](16-bremen-anfragen.md).

## Kurzfazit

1. **Der Hebel für die Stadt Bremen ist der Veranstaltungskalender von bremen.de**
   (Stadtportal der WFB Wirtschaftsförderung Bremen GmbH, Abteilung Bremen Online).
   Vereine, Geschäftsleute und Einrichtungen tragen dort selbst ein; der Kalender führt je
   Termin Koordinaten und ein Feld `custom_district` (Stadtteil). Selbst gezählt: mindestens
   928 Veranstaltungen mit Termin im Fenster 29.10.2026 bis 28.10.2027, verteilt auf 46 der
   88 Bremer Ortsteile. In der Stichprobe hatten 12 von 30 Ortsteilen dort mindestens einen
   Termin.
2. **Rechtlich ist bremen.de der aussichtsreichste Weg, technisch nur per Absprache.**
   § 6 der Nutzungsbedingungen des Kalenders erlaubt der WFB, die Einträge „automatisiert an
   Kooperationspartner*innen“ weiterzugeben. Ein offener Feed ist nicht verlinkt; Detailseiten
   und iCal liegen hinter einer Cloudflare-Prüfung (Serverabruf 403), iCal ist zusätzlich per
   robots.txt gesperrt. Nächster Schritt ist eine Kooperationsanfrage bei der WFB, die auch
   ihren zweiten Kalender der-bremer-norden.de abdeckt.
3. **Für Bremerhaven trägt destination.one.** Im Fenster 29.10.2026 bis 28.10.2027 liefert
   `open-data` 172 Events mit Ort Bremerhaven, sie liegen in 18 von 24 Bremerhavener
   Ortsteilen, darunter Stadtteilfeste und Vereinsfeste: „Maibaum aufstellen“ beim TSV
   Wulsdorf, „Tag der offenen Tür bei der Feuerwehr Bremerhaven“, „Stadtteil-Kutterpullen“.
   In der Stichprobe hatten 6 von 7 Bremerhavener Ortsteilen dort einen Termin. Für die
   Stadt Bremen liefert dieselbe Quelle nur 17 Großveranstaltungen (1 von 23
   Stichprobenortsteilen). bremerhaven.de sperrt nicht gelistete Crawler per robots.txt.
4. **Feuerwehr-, Schützen- und Erntefeste der Bremer Dörfer stehen in keiner offenen
   Sammelquelle.** In den 928 bremen.de-Terminen trägt kein Titel „Feuerwehr“, „Schützen“
   oder „Ernte“. Die Feste von Blockland, Borgfeld und Seehausen fanden sich nur auf
   Vereins- und Dorfseiten (blockland.de, borgfelder-forum.de) und in PDF-Rundbriefen der
   Ortsämter (Seehausen: Osterfeuer, Kinderfest, Oktoberfest, Weihnachtszauber).
5. **Ortsämter und Beiräte sind keine Terminquelle für Feste.** Alle 14 erreichten
   Ortsamt-Websites laufen auf demselben SixCMS unter `*.bremen.de`, stehen unter
   CC BY-NC-ND (kommerzielle Nutzung ausgeschlossen) und führen vor allem Sitzungstermine
   der Beiräte; Feste nur vereinzelt redaktionell oder als PDF-Newsletter.
6. **Open Data Bremen hat keinen Veranstaltungsdatensatz.** Eine GovData-Suche lieferte
   keinen Bremer Treffer. Offen und nützlich sind die amtlichen Ortsteilgrenzen (WFS
   `geodienste.bremen.de/wfs_verwaltungsgrenzen`, CC BY 4.0), mit denen sich Termine aus
   jeder Quelle einem Ortsteil zuordnen lassen.

## Stichprobe

**Grundgesamtheit (reproduzierbar):** Amtliche Ortsteile beider Städte aus dem WFS
„Verwaltungsgrenzen Land Bremen“ des Landesamts GeoInformation Bremen
(`https://geodienste.bremen.de/wfs_verwaltungsgrenzen`, Layer `app:Ortsteile_Bremen` und
`app:Ortsteile_Bremerhaven`, Lizenz laut GetCapabilities „Creative Commons Namensnennung 4.0
International, Quellenvermerk: Landesamt GeoInformation Bremen“). Ergebnis 112 Ortsteile
(Bremen 88, Bremerhaven 24) mit Schlüssel `sch_ot`. Die stadtteilfreien Gebiete Seehausen,
Strom, Blockland und Borgfeld sind dort je ein Ortsteil. Die 112 Schlüssel aufsteigend
sortiert, dann `random.Random(28017).sample(liste, 30)` (Python 3.14.2). Seed 28017 = fn-28,
Ticket 17. Blockland und Borgfeld wurden nicht gezogen; sie stehen als Zusatz unter der
Tabelle, weil der Auftrag sie ausdrücklich nennt.

**Spalten:** EW = Bevölkerung am 31.12.2015 aus den Ortsteiltabellen des Statistischen
Landesamts Bremen (`statistik-bremen.de/tabellen/kleinraum/stadt_ottab/ST<Stadtteil>.csv`;
neuere Ortsteilzahlen in maschinenlesbarer Form nicht gefunden); für Bremerhaven und die
Häfen nicht belegt. bremen.de = Termine des bremen.de-Kalenders, deren Koordinate im
Ortsteil liegt (Punkt-in-Fläche gegen den WFS, Fenster 29.10.2026 bis 28.10.2027,
Untergrenze, siehe G1). d.one = Events von destination.one `open-data` mit
`q=area:"Bremen"`, gleiches Fenster, Koordinate im Ortsteil. Fundort = Hauptfundort der
Ortsteiltermine.

| # | Ortsteil (Stadtteil) | Schlüssel | EW | Fundort | Plattform/CMS | Link | bremen.de | d.one |
|---|---|---|---|---|---|---|---|---|
| 1 | Neustädter Hafen (Häfen) | 04011124 | nicht belegt | keiner gefunden | | | 0 | 0 |
| 2 | Alte Neustadt (Neustadt) | 04011211 | 6.682 | bremen.de | WFB-Stadtportal | https://www.bremen.de/kultur/veranstaltungen | 63 | 0 |
| 3 | Gartenstadt Süd (Neustadt) | 04011215 | 5.109 | keiner gefunden | Ortsamt Neustadt/Woltmershausen, SixCMS, ohne Terminseite | https://www.ortsamt-woltmershausen.bremen.de/ | 0 | 0 |
| 4 | Arsten (Obervieland) | 04011232 | 9.494 | keiner gefunden | Ortsamt-Website nicht gefunden | https://www.service.bremen.de/visitenkarte/ortsamt-obervieland-10124 | 0 | 0 |
| 5 | Sodenmatt (Huchting) | 04011242 | 7.064 | keiner gefunden | Ortsamt Huchting, SixCMS, ohne Terminseite | https://www.ortsamt-huchting.bremen.de/ | 0 | 0 |
| 6 | Kirchhuchting (Huchting) | 04011243 | 8.219 | bremen.de | WFB-Stadtportal (Stadtbibliothek Huchting) | https://www.bremen.de/veranstaltung/blutenzauber-wenn-farben-bluhen | 1 | 0 |
| 7 | Woltmershausen (Woltmershausen) | 04011251 | 11.215 | bremen.de | WFB-Stadtportal (Kulturhaus Pusdorf, Boulevardtheater) | https://www.bremen.de/veranstaltung/misery | 32 | 1 |
| 8 | Strom (stadtteilfrei) | 04011271 | 436 | Ortsamt-Newsletter (PDF) | Ortsamt Seehausen, SixCMS | https://www.ortsamt-seehausen.bremen.de/sixcms/media.php/13/160326_Newsletter%2B03-26_OA%2BSeehausen.pdf | 0 | 0 |
| 9 | Riensberg (Schwachhausen) | 04011324 | 6.107 | bremen.de | WFB-Stadtportal (Focke-Museum) | https://www.bremen.de/veranstaltung/ein-spaziergang-uber-den-riensberger-friedhof | 3 | 0 |
| 10 | Horn (Horn-Lehe) | 04011341 | 4.924 | bremen.de | WFB-Stadtportal (botanika); Ortsamt-Seite redaktionell | https://www.ortsamt-horn-lehe.bremen.de/aktuelles/veranstaltungen-im-stadtteil-10109 | 12 | 0 |
| 11 | Lehesterdeich (Horn-Lehe) | 04011343 | 12.059 | bremen.de | WFB-Stadtportal (Theater am Deich) | https://www.bremen.de/veranstaltung/theater-am-deich-die-maus-die-brullte | 1 | 0 |
| 12 | Ellener Feld (Osterholz) | 04011371 | 3.117 | Ortsamt-Newsletter (PDF) | Ortsamt Osterholz, SixCMS | https://www.ortsamt-osterholz.bremen.de/ortsamt-osterholz/newsletter-23632 | 0 | 0 |
| 13 | Osterholz (Osterholz) | 04011374 | 5.380 | bremen.de | WFB-Stadtportal (CineStar Weserpark) | https://www.bremen.de/kultur/veranstaltungen | 16 | 0 |
| 14 | Arbergen (Hemelingen) | 04011384 | 5.950 | keiner gefunden | Ortsamt Hemelingen, SixCMS, ohne Terminseite | https://www.ortsamt-hemelingen.bremen.de/ | 0 | 0 |
| 15 | Weidedamm (Findorff) | 04011423 | 12.115 | bremen.de | WFB-Stadtportal, Einträge der Findorffer Geschäftsleute | https://www.bremen.de/veranstaltung/laternenlauf-in-findorff-2026 | 6 | 0 |
| 16 | In den Hufen (Findorff) | 04011424 | 216 | bremen.de | WFB-Stadtportal (Tierheim, Altes Pumpwerk) | https://www.bremen.de/veranstaltung/offener-museumsnachmittag-im-alten-pumpwerk | 5 | 0 |
| 17 | Utbremen (Walle) | 04011431 | 3.255 | Stadtteilportal | walle-aktuell.de, TYPO3 (Blaukontor) | https://www.walle-aktuell.de/veranstaltungen | 0 | 0 |
| 18 | Steffensweg (Walle) | 04011432 | 4.360 | bremen.de und Stadtteilportal | WFB-Stadtportal; walle-aktuell.de | https://www.walle-aktuell.de/veranstaltungen | 1 | 0 |
| 19 | Westend (Walle) | 04011433 | 6.454 | Stadtteilportal | walle-aktuell.de, TYPO3 | https://www.walle-aktuell.de/veranstaltungen | 0 | 0 |
| 20 | Ohlenhof (Gröpelingen) | 04011443 | 9.918 | bremen.de und Stadtteilportal | WFB-Stadtportal (Nachbarschaftshaus Helene Kaisen); walle-aktuell.de mit Terminen von Kultur Vor Ort | https://www.bremen.de/veranstaltung/indoor-flohmarkt | 4 | 0 |
| 21 | Fähr-Lobbendorf (Vegesack) | 04011525 | 8.065 | Stadtteilportal | bremen-nord.de (EventON), der-bremer-norden.de (Events Manager) | https://bremen-nord.de/ | 0 | 0 |
| 22 | Rönnebeck (Blumenthal) | 04011532 | 4.731 | Stadtteilportal | bremen-nord.de, vom Ortsamt Blumenthal verlinkt | https://bremen-nord.de/veranstaltungen-in-blumenthal/ | 0 | 0 |
| 23 | Rekum (Blumenthal) | 04011535 | 2.288 | Stadtteilportal | bremen-nord.de | https://bremen-nord.de/veranstaltungen-in-blumenthal/ | 0 | 0 |
| 24 | Weddewarden (Weddewarden) | 04012111 | nicht belegt | destination.one | Datensätze `source` destination.one | Familienfest „150 Jahre Zionkirche“, d.one-ID 101383419 | 0 | 3 |
| 25 | Königsheide (Leherheide) | 04012121 | nicht belegt | destination.one | dazu leherheide.de, TYPO3, nur Nachrichten | https://leherheide.de/de/aktuelles | 0 | 3 |
| 26 | Twischkamp (Lehe) | 04012133 | nicht belegt | keiner gefunden (bremerhaven.de per robots gesperrt) | | | 0 | 0 |
| 27 | Goethestraße (Lehe) | 04012134 | nicht belegt | destination.one | | „KuBa Familienfest“, d.one-ID 101375870 | 0 | 3 |
| 28 | Klushof (Lehe) | 04012135 | nicht belegt | destination.one | dazu bremen.de (Stadthalle Bremerhaven) | | 9 | 19 |
| 29 | Schiffdorferdamm (Schiffdorferdamm) | 04012221 | nicht belegt | destination.one | | „Faschingsfest“, d.one-ID 101368360 | 0 | 2 |
| 30 | Surheide (Surheide) | 04012231 | nicht belegt | destination.one | | „Surheide blüht auf“ | 0 | 1 |

**Zusatz, nicht gezogen:**

| Ortsteil | Schlüssel | EW | Fundort | Plattform/CMS | Link | bremen.de | d.one |
|---|---|---|---|---|---|---|---|
| Blockland | 04011411 | 413 | Dorfseite | blockland.de, statisches PHP; Ortsamt-Website `ortsamt-blockland.bremen.de` ohne Antwort | https://www.blockland.de/aktuelles/index-termine.php | 1 | 0 |
| Borgfeld | 04011351 | 9.218 | Bürgerforum | borgfelder-forum.de „Borgfeld lädt ein“, Jimdo, dazu PDF-Liste; vom Ortsamt Borgfeld verlinkt | https://www.borgfelder-forum.de/borgfeld-laedt-ein/ | 0 | 0 |

Zum Bremen-Nord-Portal: Die Termine von der-bremer-norden.de tragen nur teilweise eine
Koordinate (18 von 38 mit `GEO`, alle in den Ortsteilen Vegesack und Blumenthal); bremen-nord.de
liefert über WP-REST weder Datum noch Koordinate. Treffer je Ortsteil sind dort deshalb nicht
gezählt, nur die Stadtteilkategorie (bremen-nord.de: „Vegesack“ 292, „Blumenthal“ 83 Einträge
inklusive vergangener, selbst gezählt aus `/wp-json/wp/v2/event_type`).

## Generics

Bremen hat kein Kommunal-CMS mit Kalendermodul wie in den Flächenländern. Die Kandidaten
sind Stadtportale, Stadtteilportale und die Ortsämter.

### G1. bremen.de Veranstaltungskalender (WFB, Bremen Online)

* **Betreiber:** WFB Wirtschaftsförderung Bremen GmbH, Abteilung Bremen Online,
  Ansgaritorstraße 11, 28195 Bremen (§ 1 Abs. 3 der Kalender-Nutzungsbedingungen,
  https://www.bremen.de/nutzungsbedingungen-und-agb/nutzungsbedingungen-veranstaltungskalender).
  Eintragen kann jede Person mit Konto auf login.bremen.de, kostenlos (§ 2 Abs. 2); die WFB
  prüft Einträge (§ 4 Abs. 5).
* **Abdeckung:** beide Städte. Selbst gezählt 928 verschiedene Veranstaltungen mit Termin im
  Fenster 29.10.2026 bis 28.10.2027, alle mit Koordinate; davon in 46 von 88 Bremer Ortsteilen
  und 14 in Bremerhaven (Punkt-in-Fläche). Die Zahl ist eine Untergrenze: jede Suche liefert
  höchstens 501 Treffer (Gesamtsuche, Monatssuchen und die Stadtteilsuchen Mitte und
  Neustadt kamen genau auf 501), gezählt wurde die Vereinigung aller Gesamt-, Monats- und
  Stadtteilsuchen (Liste in der Anfragendatei). Die Sitemap
  `https://www.bremen.de/sitemap-events.xml` führt 1.309 Veranstaltungsseiten (selbst
  gezählt); wie viele davon einen Termin im Fenster haben, ist nicht gezählt.
* **Zugriffswege:**
  1. Sitemap `sitemap-events.xml`: per GET ohne Prüfung abrufbar (200), `loc` und `lastmod`
     je Veranstaltung.
  2. Detailseite `https://www.bremen.de/veranstaltung/<slug>` mit JSON-LD `Event`. Per curl
     403 („Just a moment...“, Cloudflare-Challenge), im Browser 200.
  3. iCal je Termin `https://login.bremen.de/ical/event/<slug>/<id>`: robots.txt von
     login.bremen.de sperrt `/ical/*`; nicht verwendet.
  4. Suche der Kalenderseite: `POST https://login.bremen.de/api/event-search/search` mit
     JSON-Body (`dates`, `tags` = Kategorie-IDs, `restrict_by_district`, `navigator_id: 63`).
     Beobachtet über die Suchmaske von https://www.bremen.de/kultur/veranstaltungen. Ein
     RSS-Feed, wie ihn § 6 Abs. 1 als Möglichkeit nennt, ist auf der Kalenderseite nicht
     verlinkt.
* **Felder (echte Antwort der Suche):** `id`, `title`, `slug`, `description` (HTML), `point`,
  `latitude`, `longitude`, `address.venue.address` (Straße, PLZ, Ort), `address_name`,
  `categories[]` (`id`, `title`), `images[]` (`copyright`, `file_name`), `online`,
  `nextDate` (ms), `nextDateAllDay`, `end`, `dates_count`, `free_of_charge`,
  `custom_district`, `redirectUrl`. JSON-LD der Detailseite: `name`, `startDate`/`endDate`
  in UTC (`2026-11-15T16:00:00.000000Z` für 17 Uhr), `location.address` mit `postalCode`,
  `organizer`, `image`, `offers`, `eventStatus`.
* **Stadtteilfilter:** Die Suchmaske bietet 23 Stadtteile. Mit Fenster 29.10.2026 bis
  28.10.2027 lieferten 12 davon Treffer (Mitte 501, Neustadt 501, Schwachhausen 463, Walle
  307, Findorff 279, Woltmershausen 230, Vegesack 122, Huchting 51, Osterholz 31,
  Hemelingen 23, Burglesum 14, Blumenthal 1) und 11 keine (Blockland, Borgfeld, Gröpelingen,
  Häfen, Horn-Lehe, Oberneuland, Obervieland, Östliche Vorstadt, Seehausen, Strom, Vahr).
  Der Filter passt nicht zum Datenfeld: In den 928 Veranstaltungen tragen 31
  `custom_district` „Östliche Vorstadt“, 28 „Horn-Lehe“, 42 „Häfen“ und 3 „Gröpelingen“, die
  Filtersuche fand für alle vier 0. 140 Veranstaltungen haben kein `custom_district` (leer 91,
  `null` 49). Für eine Zuordnung taugen die Koordinaten, nicht der Filter.
* **Lizenz/AGB/robots:** § 6 Abs. 2: „Darüber hinaus gestatten die Nutzer*innen mit dem
  Veröffentlichen von Veranstaltungskalender-Einträgen, dass die WFB die Inhalte teilweise
  oder vollumfänglich automatisiert an Kooperationspartner*innen weitergibt“. Eine offene
  Lizenz für Dritte gibt es nicht. robots.txt von www.bremen.de sperrt `/more-events`, nicht
  `/veranstaltung/`; login.bremen.de sperrt `/ical/*`. Die Allgemeinen Nutzungsbedingungen
  von bremen.de sind nicht gelesen.
* **Beispiele (drei Stadtteile):** Findorff „Laternenlauf in Findorff 2026“, 15.11.2026,
  Findorffer Geschäftsleute e.V.
  https://www.bremen.de/veranstaltung/laternenlauf-in-findorff-2026 ; Burglesum „Großer
  Familienflohmarkt in Bremen-Lesum“, 08.11.2026
  https://www.bremen.de/veranstaltung/grosser-familienflohmarkt-in-bremen-lesum ; Vegesack
  „Vegesacker Winterdorf“ https://www.bremen.de/veranstaltung/vegesacker-winterdorf .
* **Nächster Schritt:** Kooperationsanfrage an die WFB (Bremen Online): Feed oder Zugang zur
  Such-API für lasstreffen.de als Kooperationspartner nach § 6 Abs. 2, Umfang (ganzer
  Kalender inklusive Bremerhaven), Bildrechte (`images[].copyright`), Quellenhinweis.

### G2. destination.one `open-data` (Bremerhaven)

Bundesweit beschrieben in
[../deutschland-event-quellen-2026-10.md](../deutschland-event-quellen-2026-10.md), Abschnitt 1.
Landessicht:

* **Abdeckung:** `q=area:"Bremen"`, Fenster 29.10.2026 bis 28.10.2027: 189 Events, davon
  `city` Bremerhaven 172, Bremen 17 (eigene Anfrage). Die 17 Bremer sind Großveranstaltungen
  (Freimarkt, Osterwiese, Weihnachtsmarkt Bremen, Musikfest, jazzahead!, swb-Marathon).
  Punkt-in-Fläche: Events in 18 von 24 Bremerhavener Ortsteilen, in 7 von 88 Bremer
  Ortsteilen.
* **Lizenz (189 Datensätze):** `CC0` 107, `CC-BY` 75, `CC-BY-SA` 7 (Attribut `license`,
  selbst gezählt). Anders als in der bundesweiten Stichprobe (500 × CC0) ist hier über ein
  Drittel CC BY; der Importer muss die Lizenz je Datensatz beachten.
* **Felder:** wie im Quellenbericht; zusätzlich `attributes` `VA_Id`, `VO_Id`,
  `VO_CategoryName`. `district` ist bei 165 von 189 leer.
* **Herkunft:** Alle 189 tragen `source` „destination.one“. Wer die Bremerhavener Termine
  einpflegt (Stadt, Erlebnis Bremerhaven, Veranstalter), ist nicht belegt; bremerhaven.de
  ließ sich wegen robots.txt nicht prüfen.
* **Nächster Schritt:** keiner eigener; kommt mit dem bundesweiten destination.one-Import.

### G3. Bremen-Nord: der-bremer-norden.de und bremen-nord.de

* **der-bremer-norden.de:** Betreiber laut Impressum WFB Wirtschaftsförderung Bremen GmbH
  („bremen.online“), also derselbe wie G1. WordPress mit Events Manager; offener iCal
  `https://www.der-bremer-norden.de/events.ics` (200, `PRODID:-//wp-events-plugin.com//7.4.11//EN`),
  38 Termine, Felder `UID`, `DTSTART;TZID=Europe/Berlin`, `DTEND`, `URL`, `SUMMARY`,
  `DESCRIPTION`, `ATTACH`, `CATEGORIES`, `LOCATION`, `GEO` (18 von 38). robots.txt sperrt nur
  `/wp-admin/`. Keine Lizenzaussage. Vom Ortsamt Blumenthal verlinkt.
* **bremen-nord.de** („Veranstaltungen in Bremen Nord“): Betreiber laut Impressum vege.net
  GmbH, Bremen. WordPress mit EventON; `GET /wp-json/wp/v2/ajde_events` liefert
  `X-WP-Total: 392`, aber ohne Datum und Ort; Datum und Adresse stehen im JSON-LD `Event` je
  Detailseite (`startDate` nur Tag, z. B. `2026-12-5`). Kategorien Vegesack 292,
  Blumenthal 83, Burg Lesum 10. robots.txt sperrt den alten iCal-Export
  (`controller=ai1ec_exporter_controller`). Impressum: „Downloads und Kopien dieser Seite
  sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.“
* **Zahl der Stadtteile:** drei (Vegesack, Blumenthal, Burglesum), Stichprobenanteil 3 von 30.
* **Nächster Schritt:** der-bremer-norden.de in die WFB-Anfrage aus G1 aufnehmen; bei
  vege.net nur anfragen, wenn nach G1 eine Lücke im Bremer Norden bleibt.

### G4. walle-aktuell.de (Walle, Gröpelingen)

* **Betreiber:** laut Fußzeile ein Projekt der Blaukontor für Gestaltung GmbH; das Ortsamt
  West nennt sie „die vom Beirat finanzierte Internet-Plattform Walle-Aktuell“
  (https://www.ortsamtwest.bremen.de/walle/termine-2731).
* **Zugriff:** TYPO3, Monatslisten als HTML (`/veranstaltungen/monat/<Jahr>/<Monat>`), kein
  JSON-LD, kein Feed. Termine mit Tag ohne Jahr, Uhrzeit, Veranstalter, Ort; Termine von
  Kultur Vor Ort (Gröpelingen) verlinken auf kultur-vor-ort.com (keine Verbindung beim Abruf).
  robots.txt sperrt nur TYPO3-Pfade. Lizenz nicht belegt.
* **Zahl der Stadtteile:** Walle und Teile Gröpelingens; Stichprobenanteil 4 von 30
  (Utbremen, Steffensweg, Westend, Ohlenhof).
* **Nächster Schritt:** nur bei Lücke nach G1; dann Betreiber nach Export fragen.

### G5. Ortsämter und Beiräte (SixCMS unter `*.bremen.de`)

* **Websites:** 15 von 19 versuchten Hostnamen antworteten (14 verschiedene Websites,
  `ortsamt-neustadt` leitet auf `ortsamt-woltmershausen` um), alle mit SixCMS-Pfaden
  (`/sixcms/media.php/...`) und Fußzeile „Sofern nicht anders angegeben, stehen die Inhalte
  dieser Seite unter der Lizenz“ mit Bild „Creative Commons Nicht-Kommerziell Keine
  Bearbeitung“. Schwachhausen/Vahr liegt unter `ortsamtschwachhausenvahr.bremen.de`
  (Websuche, nicht abgerufen); für Obervieland und Blockland nicht gefunden. Bremerhaven hat
  keine Ortsämter in dieser Liste.
* **Inhalt:** Sitzungstermine der Beiräte und Fachausschüsse (Ortsamt West je Stadtteil),
  Nachrichten-RSS (z. B. `https://www.ortsamt-burglesum.bremen.de/rss-feed/test-rss-1811`,
  zwei Einträge: Schließtag und Jugendforum), PDF-Newsletter. Feste stehen nur in
  einzelnen Newslettern: Seehausen listet die Dorftermine des Jahres, Osterholz „Tipps und
  Termine für den Stadtteil“. Die Seite „Veranstaltungen“ des Ortsamts Burglesum war leer.
* **Lizenz:** CC BY-NC-ND schließt eine Nutzung auf einem werbefinanzierten Portal aus.
* **Nächster Schritt:** keine Integration. Die Newsletter taugen als Lückenliste: welches
  Dorf welches Fest hat, dann die Veranstalterquelle suchen oder bei bremen.de eintragen
  lassen.

### G6. Kleine Einzelquellen

| Quelle | Gebiet | Technik | Termine (selbst gezählt) | Lizenz/robots |
|---|---|---|---|---|
| blockland.de (Heimatverein/Dorfgemeinschaft) | Blockland | statisches PHP | 2 kommende | robots.txt 404, Lizenz nicht belegt |
| borgfelder-forum.de „Borgfeld lädt ein“ | Borgfeld | Jimdo, Freitext, PDF bis 31.12.2026 | 13 Termine 26.10.2026 bis 11.03.2027 auf der Seite | robots erlaubt `/`, Lizenz nicht belegt |
| geestemuende.de | Geestemünde (BHV) | TYPO3, Liste ohne Feed | 4 Einträge, Datumsangaben 2024 bis 2026 | Lizenz nicht belegt |
| mbq-bremerhaven.de (Marketinginitiative Bremerhavener Quartiere) | Bremerhavener Quartiere | Contao-Kalender, JSON-LD nur Seite/Bilder | 10 Detailseiten verlinkt | robots sperrt nur `/contao/` |
| kirche-bremen.de (Bremische Evangelische Kirche) | Stadt Bremen | TYPO3, JSON-LD `Event` und iCal je Termin | nicht gezählt | robots sperrt nur TYPO3-Pfade, Lizenz nicht belegt |

### Nicht nutzbar

* **bremerhaven.de:** robots.txt `User-agent: * Disallow: /` mit Ausnahmen nur für gelistete
  Bots; nicht abgerufen.
* **weser-kurier.de:** robots.txt sperrt ClaudeBot, anthropic-ai, GPTBot und weitere
  KI-Crawler; ein Kalender unter `/veranstaltungen` gibt 404. Nicht weiter untersucht.
* **festivalsindeutschland.de:** führt Borgfelder Weinfest und Schützenfest sowie
  Blockland-Termine; AGB untersagen die Nutzung der Datenbank
  ([00-bundesweit.md](00-bundesweit.md), Abschnitt F). Nur als Lückenliste.
* **Open Data:** GovData `package_search` mit „veranstaltungen bremen“, „bremen
  veranstaltungskalender“, „bremerhaven veranstaltungen“: kein Bremer Datensatz.

## Dorffest-Test

| Quelle | Belegtes Beispiel | Festart |
|---|---|---|
| bremen.de (G1) | „Laternenlauf in Findorff 2026“, 15.11.2026 https://www.bremen.de/veranstaltung/laternenlauf-in-findorff-2026 ; „Der Nikolaus kommt ins Dorff“, 06.12.2026; „Vegesacker Winterdorf“ | Laternenumzug, Weihnachtsmarkt |
| destination.one (G2) | „Maibaum aufstellen“, TSV Wulsdorf, 30.04.2027 (ID 101374773); „Tag der offenen Tür bei der Feuerwehr Bremerhaven“, 22.05.2027 (ID 101365363); „Stadtteil-Kutterpullen ums blaue Band der Geeste“, 28.08.2027, Kategorie „Stadtteilfest“ (ID 101366331) | Maifest, Feuerwehrfest, Stadtteilfest |
| der-bremer-norden.de (G3) | „Weihnachtsmarkt Lesum“, 05.12.2026 https://www.der-bremer-norden.de/events/weihnachtsmarkt-lesum/ | Weihnachtsmarkt |
| bremen-nord.de (G3) | „Adventszauber auf Burg Blomendal“ https://bremen-nord.de/events/adventszauber-auf-burg-blomendal/ | Weihnachtsmarkt |
| walle-aktuell.de (G4) | „Halloweenfest im Walle-Center“, 29.10.2026 https://www.walle-aktuell.de/veranstaltungen | Stadtteilfest (Einkaufszentrum) |
| Ortsamt Seehausen, Newsletter 03/2026 (G5) | „Osterfeuer auf den Groden“ 04.04.2026, „Kinderfest und Platzeröffnung“ 22.08.2026, „Oktoberfest und Frühshoppen“ 09./10.10.2026, „Weihnachtszauber auf dem Kirchenparkplatz“ 29.11.2026 | Dorffeste |
| Ortsamt Osterholz, Newsletter 08/2026 (G5) | „Hoffest im Stadtleben Ellener Hof“ 26.08.2026, „Familienfest Aktiv für Osterholz“ 19.08.2026 | Stadtteilfest |
| blockland.de (G6) | „Blocklander Hobby Kunst Markt“ 22.11.2026; „Block Land Partie 2027“ 12.09.2027, Heimatverein Blockland, Landpartie mit Oldtimertreffen | Dorffest |
| borgfelder-forum.de (G6) | „Blaue Stunde im Ratsspiekerpark“, Kulturforum Borgfeld, 14.11.2026, mit Glühwein und Punsch | Dorffest (Advent) |
| kirche-bremen.de (G6) | kein Beispiel gefunden: 9 Termine auf der Startseite ohne Fest, Sitemap (514 URLs) ohne Veranstaltungsseiten, Websuche ohne Treffer; die Kalendersuche der Seite nicht genutzt | nicht bestanden, Quelle nicht priorisiert |

**Gegenprobe bremen.de:** In den 928 Veranstaltungen tragen 0 Titel „Feuerwehr“, 0
„Schützen“, 0 „Ernte“, 0 „Straßenfest“, 0 „Stadtteilfest“; 1 „Laterne“, 5 Weihnachtsmarkt
oder Winterdorf, 6 Flohmarkt. Momentaufnahme vom 29.10.2026; ob Sommerfeste 2027 später
nachgetragen werden, ist nicht belegt.

**Blockland und Borgfeld:** Ein Erntefest im Blockland fand sich in keiner Quelle. Die
Freiwillige Feuerwehr Blockland hat eine Unterseite auf blockland.de, Termine standen dort
nicht in der Terminliste. Borgfelder Weinfest (Mai) und Schützenfest (August) sind nur bei
festivalsindeutschland.de belegt, in den geprüften offenen Quellen nicht.

## Abdeckung (nur Stichprobenanteil)

Formel: Anteil = Ortsteile der Stichprobe mit mindestens einem Fund / 30. Jeder Ortsteil
zählt in der ersten passenden Zeile.

| Weg | Ortsteile | kumuliert | Anteil kumuliert |
|---|---|---|---|
| bremen.de mit Termin im Ortsteil | 12 | 12 | 40 % |
| zusätzlich destination.one | 5 | 17 | 57 % |
| zusätzlich Stadtteilportal mit Kalender (G3, G4), nicht je Ortsteil gezählt | 5 | 22 | 73 % |
| zusätzlich Ortsamt-Newsletter (PDF, CC BY-NC-ND) | 2 | 24 | 80 % |
| nichts gefunden | 6 | 30 | |

Getrennt nach Stadt: Bremen 11 von 23 über bremen.de, 1 von 23 über destination.one;
Bremerhaven 6 von 7 über destination.one, 1 von 7 über bremen.de. Grundgesamtheit statt
Stichprobe: bremen.de in 46 von 88 Bremer Ortsteilen, destination.one in 18 von 24
Bremerhavener Ortsteilen.

## Priorisierte Integrationsliste Bremen

| # | Integration | Gebiet (Beleg) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | bremen.de Veranstaltungskalender | beide Städte, ≥ 928 Veranstaltungen, 46 von 88 Bremer Ortsteilen | Koordinaten, Adresse, Kategorie, Stadtteilfeld, Bilder mit Urheber; Vereins- und Geschäftsleute-Einträge | § 6 Abs. 2 erlaubt Weitergabe an Kooperationspartner; Cloudflare und robots verhindern freien Abruf | Kooperationsanfrage WFB Bremen Online (mit 3) |
| 2 | destination.one `open-data` | Bremerhaven 172 Events, 18 von 24 Ortsteilen | Koordinaten, Zeiten mit Offset, Vereinsfeste | Lizenz je Datensatz (CC0, CC BY, CC BY-SA) | kommt mit dem bundesweiten Import; Lizenzfilter |
| 3 | der-bremer-norden.de iCal | Vegesack, Blumenthal, Burglesum; 38 Termine | Zeitzone, Ort, teils GEO, Kategorie | WFB wie 1, keine Lizenzaussage | in Anfrage 1 aufnehmen |
| 4 | bremen-nord.de (EventON) | Bremen-Nord, 392 Einträge gesamt | JSON-LD nur Datum ohne Uhrzeit | Impressum: Kopien nur privat | nur bei Lücke nach 1 und 3, Anfrage vege.net |
| 5 | walle-aktuell.de | Walle, Gröpelingen | HTML ohne Jahr | nicht belegt | nur bei Lücke, Betreiber fragen |
| 6 | Dorfquellen blockland.de, borgfelder-forum.de | Blockland, Borgfeld | Freitext, wenige Termine | nicht belegt | nicht automatisieren; Vereine auf Eintrag bei bremen.de hinweisen oder kuratierte Liste prüfen |
| | Nicht verfolgen | | | | Ortsämter (CC BY-NC-ND), bremerhaven.de (robots), weser-kurier.de (robots), festivalsindeutschland.de (AGB) |

Für die Zuordnung zum Ortsteil in allen Quellen: WFS-Ortsteilgrenzen (CC BY 4.0) einmal
laden und Punkt-in-Fläche rechnen, wie hier geschehen. Die Spalten `bundesland` und
`district` führen für DE nur leere Werte (CLAUDE.md, fn-29.2), der Ortsteil müsste in
`location_resolution` oder einem eigenen Feld stehen; das entscheidet die Umsetzung.

## Lücken

* Feuerwehr-, Schützen- und Erntefeste der Bremer Dörfer (Blockland, Borgfeld, Seehausen,
  Strom, Oberneuland) stehen in keiner offenen Sammelquelle.
* 6 von 30 Stichprobenortsteilen ohne jeden Fund (Neustädter Hafen, Gartenstadt Süd,
  Arsten, Sodenmatt, Arbergen, Twischkamp).
* Vollständige Zahl der bremen.de-Termine nicht belegt (Suche kappt bei 501).
* Herkunft der Bremerhavener destination.one-Daten und Inhalt von bremerhaven.de nicht
  belegt (robots).
* Einwohner der Bremerhavener Ortsteile und aktuelle Bremer Ortsteilzahlen nach 2015 nicht
  maschinenlesbar gefunden.
* Weser-Kurier (Stadtteil-Kurier), Kultur Vor Ort, Bürgerhäuser einzeln und kirche-bremen.de
  nicht ausgewertet.

## Was der User selbst tun muss

1. WFB Wirtschaftsförderung Bremen GmbH, Abteilung Bremen Online: Kooperation nach § 6
   Abs. 2 der Kalender-Nutzungsbedingungen, Feed oder API für bremen.de und
   der-bremer-norden.de, Bildrechte, Quellenhinweis.
2. destination.one: läuft über die bundesweite Anfrage
   ([../deutschland-event-quellen-2026-10.md](../deutschland-event-quellen-2026-10.md)).
3. Optional nach gemessener Lücke: vege.net GmbH (bremen-nord.de), Blaukontor
   (walle-aktuell.de).

## Anfragen und Regeltreue

Alle Anfragen mit Statuscode: [16-bremen-anfragen.md](16-bremen-anfragen.md). Keine Konten,
keine Formulare abgeschickt, keine Mails. robots.txt vor dem ersten Abruf je Host gelesen;
bremerhaven.de, login.bremen.de `/ical/*` und weser-kurier.de wurden deshalb nicht
abgerufen bzw. nicht weiter untersucht.
