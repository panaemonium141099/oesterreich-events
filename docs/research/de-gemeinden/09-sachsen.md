# Sachsen: Gemeindekalender und Dorffeste (Stand 2026-10-29)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.10`. Frage: Wie kommen wir an die
Termine der kleinen sächsischen Gemeinden, also Kirmes, Feuerwehrfeste, Dorf- und
Heimatfeste, Erntefeste, Maibaumsetzen, Weihnachtsmärkte und die erzgebirgischen
Bräuche (Pyramidenanschieben, Bergparade, Mettenschicht)? Bundesweite Anbieter stehen in
[00-bundesweit.md](00-bundesweit.md), die Zuordnung aller Gemeinden in
[01-vollerhebung.md](01-vollerhebung.md) und
[data/vollerhebung-2026-10.csv](data/vollerhebung-2026-10.csv); hier nur die
Landessicht und die Nachprüfung.

Arbeitsweise: nur lesend, keine Konten, keine Formulare, keine Mails. Jede Zahl stammt
aus einer eigenen Antwort vom 29.10.2026 oder aus einer verlinkten Seite. Was sich nicht
belegen ließ, steht als „nicht belegt“ da. Abweichungen von den Regeln stehen offen in
Abschnitt 8.

## Kurzfazit

1. **verwaltungsportal.de mit „Sachsen vernetzt“ ist der Generic des Landes.** 11 der
   30 Stichprobengemeinden (37 %) haben ihren Auftritt dort, die Vollerhebung zählt 84
   der 418 sächsischen Gemeinden. Fußtext wörtlich: „Diese Webseite wird gefördert durch
   die Initiative „Sachsen vernetzt““ (Förderverein für regionale Entwicklung e.V., wie
   „Thüringen vernetzt“ in [07-thueringen.md](07-thueringen.md)). Ein Parser für Liste
   plus JSON-LD deckt alle ab; 10 der 11 Kalender führen Termine dieser Gemeinde, 7 davon
   ein Fest (Weihnachtsmärkte der Ortsteile, Feuerwehrfeste, Stadtfest mit Schützenfest).
2. **Die Kalender kleiner sächsischer Gemeinden sind gut gefüllt.** 24 der 30 Gemeinden
   führen online kommende Termine, 21 haben ein Fest in einer Quelle, die eine
   Integration greifen kann (Thüringen: 10 von 30, PDF eingerechnet). Die Feste stehen aber auf vielen
   verschiedenen Wegen: 12 der 30 nur als HTML ohne Hersteller (Eigenbau, Fließtext,
   Tabellen, Contao, TYPO3 ohne Kalendermodul).
3. **NOLIS ist in Sachsen ein Regionalhersteller mit offenem iCal.** Die Vollerhebung
   führt 20 sächsische NOLIS-Gemeinden, alle in den Landkreisen Leipzig, Nordsachsen und
   Mittelsachsen. Lunzenau (40 Termine) und Machern (42) liefern den iCal-Export ohne
   Schlüssel, mit Weihnachtsmärkten und Feuerwehrjubiläum. Ein kreisweiter Abruf ist
   nicht belegt.
4. **SaTourN ist destination.one, und `open-data` ist nur der offen lizenzierte Teil.**
   Die Landesdatenbank der TMGS läuft auf destination.one; nur Datensätze mit CC0, CC BY
   oder CC BY-SA gehen in Open Data. Im Fenster 29.10.2026 bis 28.10.2027 sind das 1.089
   Termine in 181 Orten. 7 der 30 Stichprobengemeinden haben dort Termine, Dorffeste
   kaum (3 Kirmessen landesweit, 0 Feuerwehrfeste), dafür Weihnachtsmärkte (112),
   Bergparaden (15) und Pyramidenfeste (14). Redakteure legt SaTourN nur für
   Tourismusorganisationen an, Gemeinden und Vereine melden nicht selbst.
5. **Amtsblätter: Riedel statt WITTICH.** Der Riedel-Verlag führt 117 Titel mit
   sächsischem Ort, 6 der 30 Stichprobengemeinden haben ein Riedel-Blatt; die Ausgaben
   gibt es nur per Mail-Anforderung. Ein WITTICH-Blatt fand sich in der Stichprobe nicht
   (nicht bei jeder Gemeinde gezielt geprüft). Weitere
   Blätter im Eigenverlag oder bei Lokaldruckereien, alle als PDF.
6. **29 sächsische Gemeindeseiten liegen im Landesnetz und sperren alle Crawler.** Sie
   antworten aus dem Netz V4SN (Admin: Staatsbetrieb Sächsische Informatik Dienste) mit
   derselben robots.txt (`User-agent: *` / `Disallow: /`, Ausnahmen nur für Suchmaschinen).
   Das sind 27 der 28 per robots.txt gesperrten sächsischen Gemeinden der Vollerhebung,
   19 davon unter 10.000 Einwohnern. Wer die Websites betreibt, ist nicht belegt.
7. **Munipolis taucht dreimal auf und ist nicht nutzbar.** Jöhstadt, Bad Muskau und
   Wiedemar nutzen die Bürger-App; Termine lädt nur Jöhstadt dort, und zwar per POST von
   `api.munipolis.com`, dessen robots.txt `Disallow: /` sagt.

## 1. Stichprobe

**Ziehung (reproduzierbar).** Quelle: Destatis Gemeindeverzeichnis-Auszug, Stichtag
30.09.2026 (`AuszugGV3QAktuell.xlsx`, Blatt `Onlineprodukt_Gemeinden30092026`, abgerufen
29.10.2026, 200, 1.872.608 Byte). Regel: Land `14`, Satzart `60`, Textkennzeichen nicht
65/66, Bevölkerung (31.12.2025) unter 10.000, sortiert nach ARS; dann
`random.Random(281014).sample(liste, 30)`, Ausgabe nach ARS. Grundgesamtheit: 352 von 418
Gemeinden (1.282.568 von 4.026.599 Einwohnern). Skript:

```python
import random, openpyxl
ws = openpyxl.load_workbook(path, read_only=True)['Onlineprodukt_Gemeinden30092026']
gem = [r for r in ws.iter_rows(min_row=7, values_only=True)
       if r[2] == '14' and r[0] == '60' and r[1] not in ('65', '66') and r[9] < 10000]
gem.sort(key=lambda r: r[2]+r[3]+r[4]+r[5]+r[6])
sample = random.Random(281014).sample(gem, 30)
```

Gemeindeverbände laut Datei (Satzart 50): 239 verbandsfreie Gemeinden (Kennzeichen 50),
64 Verwaltungsgemeinschaften (54), 6 Verwaltungsverbände (56). Die Stichprobe trifft 9
von 10 Landkreisen; Sächsische Schweiz-Osterzgebirge und die kreisfreien Städte fehlen.

**Spalten:** Fundort = wo Termine dieser Gemeinde stehen; VP = verwaltungsportal.de;
VE = Zuordnung der Vollerhebung (Stufe/Integration); d.one = Zahl der verschiedenen
Termine bei destination.one `open-data` mit `city` gleich Gemeindename, Fenster
29.10.2026 bis 28.10.2027 (Abschnitt 4); Fest = Dorffest-Test für diese Gemeinde
(ja = in einer Quelle, die eine Integration greifen kann).

| # | Gemeinde | AGS | EW | Verwaltung | Fundort | CMS/Plattform | Link | VE | d.one | Fest |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Amtsberg | 14521010 | 3.573 | verbandsfrei | eigene Seite „Jahresveranstaltungsplan“ (14 kommend) | Eigenbau-CMS, HTML-Liste | https://amtsberg.eu/?content=105&pkat=11&rid=11 | R/kein_link | 0 | ja |
| 2 | Eibenstock, Stadt | 14521170 | 6.701 | verbandsfrei | eigene Seite (Nov. 25 Einträge); destination.one | TYPO3 + Erweiterung `kjo_wbs_veranstaltungen` (Kabeljournal) | https://www.eibenstock.de/veranstaltungen/11 | B/txnews | 8 | ja (d.one) |
| 3 | Jöhstadt, Stadt | 14521330 | 2.376 | verbandsfrei | Munipolis (API gesperrt); Plakatbilder | SIQUANDO + MUNIPOLIS | https://joehstadt.munipolis.de/veranstaltungskalender | E/js_oder_feed | 0 | nur Bild |
| 4 | Thermalbad Wiesenbad | 14521630 | 3.056 | verbandsfrei | Outdooractive-Widget (nur im Browser) | WordPress + Outdooractive FlexView | https://wiesenbad.de/gaesteinformation/veranstaltungen/ | C/outdooractive | 0 | nein |
| 5 | Niederdorf | 14521420 | 1.254 | VG Stollberg/Niederdorf | eigene Seite (3 kommend) | WordPress + Elementor, kein Plugin | https://www.niederdorf-erzgebirge.de/buergerservice/veranstaltungen/ | E/html_generic | 0 | ja |
| 6 | Geringswalde, Stadt | 14522190 | 3.994 | verbandsfrei | eigene Seite (9) | VP 14656, „Geringswalde vernetzt“ | https://www.geringswalde.de/veranstaltungen | B/verwaltungsportal | 0 | ja |
| 7 | Lunzenau, Stadt | 14522350 | 3.851 | verbandsfrei | eigene Seite, iCal (40) | NOLIS | https://www.lunzenau.de/kultur-tourismus/veranstaltungen/alle-veranstaltungen/ | A/nolis | 21 | ja |
| 8 | Falkenstein/Vogtl., Stadt | 14523120 | 7.321 | VG Falkenstein | eigene Seite aus Freizeitkalender Vogtlandkreis (20) | TYPO3 + `pixelbrand_freizeitkalender` | https://stadt-falkenstein.de/freizeit-tourismus/veranstaltungen | E/js_oder_feed | 0 | ja |
| 9 | Kirchberg, Stadt | 14524130 | 7.621 | VG Kirchberg | eigene Seite, Jahreskalender als Fließtext (mind. 30) | WordPress, `lsvr-events` | https://www.kirchberg.de/tourismus-wirtschaft/das-ist-los/veranstaltungskalender/ | C/outdooractive | 0 | ja |
| 10 | Doberschau-Gaußig / Dobruša-Huska | 14625110 | 4.164 | verbandsfrei | Kalender ohne kommende Termine; Gemeindenachrichten (PDF, Eigenverlag) | Contao `mod_eventlist` | https://www.doberschau-gaussig.de/gemeindenachrichten.html | B/contao_events | 0 | nur PDF |
| 11 | Ottendorf-Okrilla | 14625430 | 9.880 | verbandsfrei | eigene Seite (11) | VP 13392, „sachsen vernetzt“ | https://www.ottendorf-okrilla.de/veranstaltungen/index.php | B/verwaltungsportal | 0 | ja |
| 12 | Spreetal / Sprjewiny Doł | 14625570 | 1.674 | verbandsfrei | Kalender leer; Amtsblatt „Spreetaler INFO“ nur per POST | VP 1748, „Spreetal vernetzt“ | http://www.spreetal.de/veranstaltungen/index.php | B/verwaltungsportal | 0 | nein |
| 13 | Rammenau | 14625510 | 1.306 | VG Bischofswerda | eigene Seite (4) | VP 9361, „Sachsen vernetzt“ | https://www.rammenau.de/veranstaltungen/index.php | B/verwaltungsportal | 1 | ja |
| 14 | Großharthau | 14625170 | 2.945 | VV Großharthau | eigene Seite (9 kommend, REST) | WordPress + The Events Calendar | https://grossharthau.de/events/ | R/kein_link | 0 | ja (vergangen) |
| 15 | Lichtenberg | 14625320 | 1.590 | VG Pulsnitz | eigene Seite (8) | Contao `mod_eventlist` | https://www.gemeinde-lichtenberg.de/veranstaltungen.html | B/contao_events | 0 | ja |
| 16 | Oderwitz | 14626390 | 4.540 | verbandsfrei | Textkasten Startseite (13) + Jahres-PDF | TYPO3 ohne Kalendermodul | https://www.oderwitz.de/home/ | E/js_oder_feed | 0 | ja |
| 17 | Bad Muskau / Mužakow, Stadt | 14626010 | 3.508 | VV Bad Muskau | eigene Seite (42) | VP 10236, „vernetzt“; Munipolis-App | https://www.badmuskau.de/veranstaltungen/index.php | B/verwaltungsportal | 0 | ja |
| 18 | Lawalde | 14626270 | 1.732 | VG Löbau | handgepflegte Tabelle (6 kommend), VP-Modul 1 | VP 10626, „Lawalde vernetzt“ | http://www.lawalde.de/seite/416242/veranstaltung-und-feste.html | B/verwaltungsportal | 0 | ja |
| 19 | Kreba-Neudorf / Chrjebja-Nowa Wjes | 14626260 | 809 | VG Rietschen | eigene Seite (6) | VP 4513, „Kreba-Neudorf vernetzt“ | https://www.gemeinde-kreba-neudorf.de/veranstaltungen/index.php | B/verwaltungsportal | 0 | ja |
| 20 | Diera-Zehren | 14627020 | 3.174 | verbandsfrei | statische Monatsliste (22 Zeilen); LEADER-Kalender Lommatzscher Pflege | TYPO3 statisch; Region Contao mit JSON-LD | https://www.diera-zehren.de/naherholung/freizeit-kultur/veranstaltungskalender | E/html_generic | 0 | ja |
| 21 | Radeburg, Stadt | 14627220 | 7.578 | verbandsfrei | eigene Seite (3, nur Museum) | VP 21073, „Sachsen vernetzt“ | https://www.radeburg.de/veranstaltungen/index.php | B/verwaltungsportal | 0 | nein |
| 22 | Brandis, Stadt | 14729070 | 9.634 | verbandsfrei | eigene Seite (6, Kulturreihe) | WordPress + The Events Calendar | https://stadt-brandis.de/veranstaltungen/ | A/tribe | 1 | nein |
| 23 | Großpösna | 14729190 | 5.716 | verbandsfrei | eigene Seite (23) | VP 19856, „Sachsen vernetzt“ | https://www.grosspoesna.de/veranstaltungen/index.php | B/verwaltungsportal | 2 | nein |
| 24 | Neukieritzsch | 14729320 | 7.119 | verbandsfrei | eigene Seite (32) | Eigenbau | https://www.neukieritzsch.de/kalender | E/html_generic | 0 | ja |
| 25 | Bad Düben, Stadt | 14730020 | 7.717 | verbandsfrei | eigene Seite (Monatsseiten, Nov. 22); destination.one | TYPO3, `/termin/<slug>/` | https://www.bad-dueben.de/tourismus-freizeit/veranstaltungen/ | E/html_generic | 3 | ja |
| 26 | Laußig | 14730160 | 3.521 | verbandsfrei | kein Kalender; Amtsblatt (PDF, Heide-Druck) ohne Feste | Joomla | https://laussig.com/index.php/amtblatt | R/kein_link | 0 | nein |
| 27 | Wiedemar | 14730340 | 5.569 | verbandsfrei | eigene Seite (21, davon 11 Ratssitzungen) | VP 11704, „Sachsen vernetzt“; Munipolis-App | https://www.wiedemar.de/veranstaltungen/index.php | B/verwaltungsportal | 0 | ja |
| 28 | Dommitzsch, Stadt | 14730090 | 2.206 | VV Dommitzsch | eigene Seite (7); destination.one | TYPO3 | https://dommitzsch.de/stadt-und-ortsrecht/termine | E/html_generic | 1 | ja |
| 29 | Schönwölkau | 14730280 | 2.614 | VG Krostitz-Schönwölkau | eigene Seite 403; VG-Kalender Krostitz ohne Schönwölkau-Termin | Joomla; VG WordPress + Modern Events Calendar | https://krostitz.de/leben-soziales/veranstaltungen/ | V/fehler | 0 | nein |
| 30 | Dreiheide | 14730100 | 2.039 | VG Torgau/Dreiheide | eigene Seite (71, viele Serien) | VP 21280, „Sachsen vernetzt“ | https://www.dreiheide.de/veranstaltungen/index.php | B/verwaltungsportal | 0 | ja |

**Nachprüfung der Vollerhebung.** Plattform oder Technik weichen bei 6 von 30 ab, die
Stufe bei 4: Amtsberg (R zu E, gepflegte Liste unter „Jahresveranstaltungsplan“),
Großharthau (R zu A, The Events Calendar mit REST), Kirchberg (C zu E, Outdooractive nur
für Touren, Termine als Fließtext), Doberschau-Gaußig (B, aber 0 kommende Termine). Die
Technik ist ungenau bei Eibenstock (nicht tx_news, sondern Kabeljournal-Modul),
Falkenstein (kein JavaScript, serverseitiges HTML aus dem Kreiskalender), Oderwitz (kein
Feed, Textkasten und PDF) und Lawalde (Tabelle statt Kalendermodul). Schönwölkau
(`schönwölkau.de`, Punycode `xn--schnwlkau-27ac.de`) antwortet auf den Recherche-UA mit
403; „fehler“ ist damit erklärt, die Ursache nicht. Hauptmuster: Die Vollerhebung erkennt
in Sachsen Hersteller richtig, unterschätzt aber Seiten ohne Kalendermodul.

## 2. Generics

### 2.1 verwaltungsportal.de mit „Sachsen vernetzt“

* **Betreiber:** Förderverein für regionale Entwicklung e.V. (00-bundesweit C7). In
  Sachsen steht im Fuß „Diese Webseite wird gefördert durch die Initiative „Sachsen
  vernetzt““ mit Link `http://www.azubi-projekte.de/sachsen` (Radeburg, Großpösna,
  Dreiheide) oder `http://www.sachsen-vernetzt.de` (Wiedemar, Ottendorf-Okrilla,
  Rammenau). Andere zeigen nur ein Ortslogo („Spreetal vernetzt“, „Kreba-Neudorf
  vernetzt“, „Geringswalde vernetzt“). Lawalde meldet am 08.06.2020 „Kostenfreie
  Webseitenerstellung für Einrichtungen in Lawalde“ mit dem Förderverein.
* **Gemeinden:** Vollerhebung 84 von 418 sächsischen Gemeinden (82 eigene Seite, 2 über
  den Verband); Stichprobe 11 von 30. Eine Teilnehmerliste des Programms: nicht belegt.
* **Zugriffsweg:** einheitliches HTML. Liste `/veranstaltungen/index.php` ohne Pager (bis
  12 Monate voraus, jeder Termin-Link doppelt im HTML), Detail
  `/veranstaltungen/<id>/<JJJJ>/<MM>/<TT>/<slug>`, in Sachsen meist ohne `.html`
  (Geringswalde mit). JSON-LD `Event` nur auf der Detailseite. Kein RSS, kein iCal.
  Amtsblatt-Modul `/amtsblatt/index.php` mit POST-Download (Spreetal).
* **Felder (Proben Ottendorf-Okrilla, Rammenau, Bad Muskau, Kreba-Neudorf, Dreiheide,
  Geringswalde):** `@type: Event`, `name`, `description` (oft leer), `startDate` (mal
  `2027-06-16T14:00:00+0200`, mal nur `2026-11-28`), `endDate`, `image[]`
  (fotos.verwaltungsportal.de), `location{@type: Place, name, address{streetAddress,
  postalCode, addressLocality, addressCountry}, url}`, `organizer{@type: Organization,
  name, address, url}`. Adresse und Veranstalter nur teilweise: vollständig nur
  Ottendorf-Okrilla, Kreba-Neudorf mit Adresse ohne Veranstalter, Rammenau und Dreiheide
  nur `location.name`. Keine Koordinaten. Ortsteile stehen in `addressLocality` („Ottendorf-Okrilla
  OT Grünberg“) oder im Ortsfilter („Dreiheide OT Süptitz“).
* **Füllstand (Termin-Links):** Dreiheide 71 (52 davon Bibliotheksserie), Bad Muskau 42,
  Großpösna 23, Wiedemar 21 (11 Ratssitzungen), Ottendorf-Okrilla 11, Geringswalde 9,
  Kreba-Neudorf 6, Rammenau 4, Radeburg 3, Lawalde 1 (plus Tabelle), Spreetal 0.
* **robots.txt:** überall dieselbe Datei wie in Thüringen: `Disallow: /` für benannte
  Bots (AhrefsBot, SemrushBot, GPTBot, Bytespider u. a.), ClaudeBot nur `Crawl-delay: 10`,
  keine Regel für `*`. Nutzungsbedingungen: nicht belegt. Spreetal und Lawalde nur per
  HTTP erreichbar (Port 443 verweigert).
* **Dorffest-Test:** „Weihnachtsmarkt Großwig“ 28.11.2026
  https://www.dreiheide.de/veranstaltungen/2841776/2026/11/28/weihnachtsmarkt-grosswig ;
  „Halloweenfest“ der Feuerwehr Wiedemar 31.10.2026
  https://www.wiedemar.de/veranstaltungen/2987376/2026/10/31/halloweenfest ;
  „Pohritzscher Blütenfest“ 05./06.06.2027
  https://www.wiedemar.de/veranstaltungen/2921627/2027/06/05/pohritzscher-bluetenfest ;
  „Tag der offenen Tür Ortsfeuerwehr Grünberg“ 16.06.2027
  https://www.ottendorf-okrilla.de/veranstaltungen/2968942/2027/06/16/tag-der-offenen-tuer-ortsfeuerwehr-gruenberg ;
  „Großes Stadtfest 575 Jahre Stadtrecht“ mit Schützenfest, 18. bis 20.06.2027
  https://www.badmuskau.de/veranstaltungen/2972506/2027/06/18/grosses-stadtfest-575-jahre-stadtrecht ;
  „Weihnachtsmarkt“ Schlosspark Kreba-Neudorf 28.11.2026
  https://www.gemeinde-kreba-neudorf.de/veranstaltungen/2842234/2026/11/28/weihnachtsmarkt ;
  „Weihnachtsmarkt“ Geringswalde 28./29.11.2026
  https://www.geringswalde.de/veranstaltungen/2903804/2026/11/28/weihnachtsmarkt.html .
* **Nächster Schritt:** derselbe Parser wie für Thüringen (Liste ohne Pager, Detail mit
  JSON-LD, Pfad mit und ohne `.html`), Ortsteil aus `addressLocality` bzw. Titel über den
  Resolver. Beim Förderverein die sächsische Teilnehmerliste und eine Schnittstelle
  erfragen (gleiche Anfrage wie Thüringen, 07-thueringen 2.1).

### 2.2 NOLIS (Regionalhersteller Leipziger Land, Nordsachsen, Mittelsachsen)

* **Betreiber:** NOLIS GmbH (00-bundesweit C2).
* **Gemeinden:** Vollerhebung 20 sächsische Gemeinden, alle in drei Landkreisen:
  Mittelsachsen (Hartha, Lunzenau, Waldheim, Burgstädt), Leipzig (Bennewitz, Colditz,
  Frohburg, Geithain, Grimma, Lossatal, Machern, Wurzen, Zwenkau, Bad Lausick), Nordsachsen
  (Dahlen, Delitzsch, Eilenburg, Mockrehna, Rackwitz, Schkeuditz). Stichprobe 1 von 30.
* **Zugriffsweg:** iCal mit vollem Parametersatz
  `/veranstaltungen/veranstaltungen.ical?zeitauswahl=1&auswahl_woche_tage=365&…&selected_kommune=<ID>&…&verband=0&ressort=0&von=&bis=`.
  Lunzenau (`selected_kommune=26250`) 40 VEVENT, Machern (`selected_kommune=0`) 42 VEVENT,
  alle mit `X-KOMMUNE` der eigenen Gemeinde. Der Versuch `verband=1&portal_all=1` lieferte
  eine leere Antwort (200, 0 Byte); ein Feed über mehrere Gemeinden ist damit nicht belegt.
* **Felder (zusätzlich zu 00-bundesweit C2):** `CONTACT`, `X-LOCATION-ID`,
  `X-LOCATION-OWNER`, `X-ORGANIZER-ID`, `X-ORGANIZER-OWNER`, `X-CATEGORIES` (numerisch,
  z. B. 886 „Brauchtumsveranstaltungen“), `X-GEO-PROJECTION:EPSG:4326`, `X-NOLISEXPORT:1`,
  `X-KURZ-DETAIL`; `X-ID` als `26250_900000398`. `GEO` in Lunzenau bei allen 40
  `0.000000000;0.000000000`, `X-ORT` nur bei 16 von 40.
* **Erkennung:** In Lunzenau ist `<meta name="author">` „Stadtverwaltung Lunzenau“, nicht
  „NOLIS GmbH“. Erkennung über `fonts.nol-is.de` und die PRODID.
* **robots.txt:** Lunzenau und Machern sperren nur Such-, Kontakt- und Meldeseiten.
* **Dorffest-Test:** „Traditioneller Lunzenauer Weihnachtsmarkt“ 12./13.12.2026
  https://www.lunzenau.de/veranstaltungen/veranstaltung/traditioneller-lunzenauer-weihnachtsmarkt-900000398-26250.ical ;
  „150 Jahre Feuerwehr Elsdorf“ 05.06.2027 und „5 Göritzhainer Vereinsweihnacht“
  28.11.2026 (SV Rotation Göritzhain) im Lunzenauer iCal; „Weihnachtsmarkt Machern
  3. Adventswochenende, vom 11. bis 13. Dezember 2026“ im iCal Machern.
* **Nächster Schritt:** der bundesweite NOLIS-Adapter (01-vollerhebung Rang 3) trägt
  Sachsen mit; Ort nur über `X-ORT`/`LOCATION` und Resolver, nie über `GEO`.

### 2.3 SaTourN (TMGS) über destination.one

* **Betreiber und Technik:** „Die zentrale, landesweite Content-Datenbank SaTourN“ der
  Tourismus Marketing Gesellschaft Sachsen; laut
  https://sachsen.tourismusnetzwerk.info/digitales/digitalarchitektur/satourn/ von der
  TMGS auf Basis von destination.one (neusta destination.one GmbH) eingerichtet, mit
  Anbindung der Primärsysteme Outdooractive, Feratel und DAMAS.
* **Wer pflegt:** „Derzeit können wir in SaTourN nur Redakteure für Mitarbeiter von DMO
  anlegen“ (FAQ, https://sachsen.tourismusnetzwerk.info/digitales/digitalarchitektur/faqs/).
  Gemeinden und Vereine melden über ihre Tourismusorganisation.
* **Lizenz:** Laut FAQ ist nicht alles offen; offen nutzbar sind nur Datensätze mit CC0,
  CC BY oder CC BY-SA, nur diese gehen in den Knowledge Graph und den Open-Data-Finder.
  In unserem Abruf: 762 CC BY-SA, 187 CC BY, 137 CC0, 3 PD (Attribut `license`).
* **Zugriffsweg:** `meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&q=area:"Sachsen"&startdate=10/29/2026&enddate=10/28/2027`,
  ohne Schlüssel; 2.059 Treffer (ein Treffer je Termin), 1.089 verschiedene IDs in 181
  Orten. Quelle bei 1.088 `destination.one`, einmal „Reiseland Brandenburg“. Häufigste
  Orte: Zwickau 150, Bad Gottleuba-Berggießhübel 80, Leipzig 56, Pirna 33, Bad Schandau
  31, Werdau 30.
* **Felder:** wie im Quellenbericht (`id`, `title`, `city`, `zip`, `street`, `geo`,
  `timeIntervals`, `texts`, `attributes` mit `license`, `areas`, `source`).
* **Dorffest-Test (Titel, unscharf, 1.089 Termine):** Weihnachtsmarkt 112, Adventsmarkt 16,
  Bergparade 15, Pyramide 14, Mettenschicht 13, Kirmes 3, Stadtfest 3, Parkfest 2,
  Lichtelfest 2, Hexenfeuer 1, Osterfeuer 1, Vereinsfest 1, Feuerwehr 1 (Ausstellung
  „100 Jahre Feuerwehr“); Kirchweih, Dorffest, Heimatfest, Erntefest, Maibaum,
  Schützenfest, Sommerfest, Weinfest 0. Belege: „Kirmes in Carlsfeld“ (Eibenstock),
  03. bis 05.09.2027, ID 100680493, CC BY-SA; „Kirmes Reinhardtsdorf“ 17. bis 19.09.2027,
  ID 100780811. Frühjahrs- und Sommerfeste 2027 sind im Oktober 2026 meist noch nicht
  erfasst; die Nullen sind eine Untergrenze.
* **Nächster Schritt:** Der Import `area:"Sachsen"` gehört zum destination.one-Import des
  Quellenberichts, kein eigener Adapter. Bei der TMGS fragen, ob Gemeinden einen
  Meldeweg bekommen können und wie viel nicht offen lizenziert ist (Kontakt laut
  Pressematerial nebelung.tmgs@sachsen-tour.de).

### 2.4 Riedel-Verlag (Amtsblätter)

* **Betreiber:** RIEDEL GmbH & Co. KG, Hotline 037208 876 200 (00-bundesweit B3).
* **Titel:** https://www.riedel-verlag.de/de/aktuelle-ausgaben listet 127 Titel; 117 davon
  mit sächsischem Ort (Namensabgleich mit dem Gemeindeverzeichnis, selbst gezählt), darunter
  Stadtteilblätter in Chemnitz, Dresden und Leipzig; 10 in Thüringen, Brandenburg und
  Sachsen-Anhalt. Je Titel nur „Aktuelle Ausgabe“ und „Nächste Ausgabe“ mit Datum, der
  Link „Mehr“ ist ein JavaScript-Dialog (Anforderung per Mail).
* **Stichprobe:** 6 von 30 mit Riedel-Blatt: Amtsberger Anzeiger, Auersberg Bote
  (Eibenstock), Geringswalder Wochenblatt, Lunzenauer Nachrichten, Amtsblatt
  Ottendorf-Okrilla, Gemeindebote Wiedemar. „Burgbergkurier-Lichtenberg“ lässt sich nicht
  sicher Lichtenberg (Landkreis Bautzen) zuordnen, es gibt auch Lichtenberg/Erzgeb.
* **robots.txt:** sperrt nur `/CMS/`, `/ext_html/`, `/lib/`, `/module/`.
* **Dorffest-Test:** nicht möglich (keine Ausgabe ohne Mail-Anforderung).
* **Nächster Schritt:** keiner technisch. Riedel ist der sächsische Ansprechpartner, falls
  ein Amtsblatt-Weg (Terminrubrik als Datei) eigenes Projekt wird.

### 2.5 Weitere Funde

| Fund | Wo | Zugriff | Felder/Befund | Bewertung |
|---|---|---|---|---|
| The Events Calendar | Brandis (6), Großharthau (9 kommend, 26 im Jahr 2026) | REST `/wp-json/tribe/events/v1/events` ohne Auth, iCal `?ical=1` | wie 00-bundesweit D1, `geo_lat`/`geo_lng` leer | Plugin-Detektor; Großharthau fehlte in der Vollerhebung |
| Modern Events Calendar | VG Krostitz (für Schönwölkau) | `/events/feed/` 404, Feed unter `/feed/?post_type=mec-events` (10 Einträge) | `mec:startDate`, `mec:startHour`, `mec:endDate`, `mec:endHour`, `mec:location` (leer) | Detektor um den zweiten Feedpfad ergänzen |
| Freizeitkalender Vogtlandkreis (`freizeitkalender.eu`) | Falkenstein (serverseitig eingebunden); Vollerhebung Pöhl, Neukirch, Steina; Kreis Greiz in Thüringen | HTML `/out/list/page/<n>`, Detail `/out/show/id/<ID>`, kein Feed | Datum, Beginn, Ort, Anschrift, Veranstalter; Bildlizenz je Eintrag | Nutzungsbedingungen: Abruf und Vervielfältigung nur nach „Anmeldung und Zulassung“ (https://www.freizeitkalender.eu/nutzungsbedingungen): Vertrag mit dem Landratsamt |
| Kabeljournal `kjo_wbs_veranstaltungen` | Eibenstock, Ansichten „Erzgebirgskreis“ und „Region Westerzgebirge“ | HTML Monatsansicht, keine Detail-URLs, kein Feed | Kategorie, Datum, Ort, Veranstalter, „erfasst am … von“ | Zahl der Gemeinden nicht belegt; Partner im Fuß (Johanngeorgenstadt, Stützengrün, Bockau, Zschorlau, Breitenbrunn) nicht geprüft |
| MUNIPOLIS | Jöhstadt (Kalender), Bad Muskau, Wiedemar (App), Niederdorf (Registrierungslink) | Vue-Komponente, `POST https://api.munipolis.com/api/timeline` (aus dem Frontend gelesen, nicht aufgerufen); `api.munipolis.com/robots.txt` `Disallow: /` | laut Code `title`, `eventValidFrom`, `eventValidTo`, `eventPlace`, `description`, `url`, `location` | Eigenangabe „mehr als 5.000 Gemeinden, Unternehmen und Vereine in 5 Ländern“ (https://info.munipolis.de/); ohne Absprache kein zulässiger Zugriff |
| LEADER Lommatzscher Pflege | Diera-Zehren (und Lommatzsch laut Vollerhebung) | Contao `mod_eventlist`, JSON-LD `Event` | Adresse nur als Freitext in `address.description` | Regionalkalender, ein Parser über JSON-LD (Stufe D) |
| kalender.evlks.de (Ev.-Luth. Landeskirche, Software evangelische-termine.de) | landesweit, Kirchgemeinden | offenes XML/JSON: `https://kalender.evlks.de/xml?…` bzw. `/json?…`, Parameter laut http://handbuch.evangelische-termine.de/anzeige-im-internet/ausgabe-parameter (`eventtype`, `zip`, `start`, `end`, `highlight`, `itemsPerPage`); robots.txt 404 | `_event_TITLE`, `START`, `END`, `_event_EVENTTYPE`, `_place_NAME`, `_place_ZIP`, `_place_CITY`, `_event_GLAT`, `_event_GLONG`, `_user_REALNAME` | Standard `highlight=high` zeigt nur Hervorgehobenes (312 Termine im Jahr); Kategorie 7 „Feste/Gemeindefeste“ mit `highlight=all`: 20 Termine. Lizenz nicht belegt. Nebenquelle |
| Landkreis-Kalender | Vogtlandkreis (iKISS + freizeitkalender.eu), Meißen (iKISS), Leipzig (TYPO3 `tx_ifabcultureevents`, HTML), Bautzen, Pirna, Zwickau („Veranstaltungstipps“) | HTML, kein Feed belegt | Landkreis Leipzig mit Weihnachtsmärkten (Markkleeberg) | nachrangig; Erzgebirgskreis, Mittelsachsen, Görlitz, Nordsachsen ohne Kalenderlink auf der Startseite |
| Outdooractive | Wiesenbad (Event-FlexView), Kirchberg und Eibenstock (Touren); Vollerhebung 10 sächsische Gemeinden | nur clientseitig mit Projektschlüssel | | kostenpflichtig (01-vollerhebung); Termine kommen über SaTourN teils ohnehin |
| Eigenbau, Fließtext, Tabellen | Amtsberg, Neukieritzsch (Eigenbau), Kirchberg (Fließtext), Lawalde (Tabelle), Diera-Zehren, Oderwitz, Niederdorf | HTML | Muster je Seite fest, aber je Gemeinde anders | allgemeiner Parser (Stufe E) |

Nicht vorgekommen in 30 Gemeinden: Cross7, Heimat-Info, Advantic iKISS (nur Kreise),
ionas, communice, Hirsch & Wölfl, LINUS WITTICH, NUSSBAUM, termine-regional.de.

### 2.6 Landesnetz V4SN: 29 Gemeindeseiten sperren alle Crawler

* **Befund:** Die robots.txt von aue-badschlema.de, burkhardtsdorf.de, weischlitz.de,
  treuen.de und glauchau.de ist byte-gleich (MD5 `feb98858…`): Googlebot, Bingbot,
  DuckDuckBot, Yandex u. a. nur `Disallow: /admin` mit `Crawl-delay: 15`, dann
  „# Alle anderen Crawler blockieren“ `User-agent: *` / `Disallow: /`. Server-Header
  `Apache`, Adressen 31.12.57.200 bis .226. RDAP: Netz `V4SN` 31.12.56.0/21, Admin-Kontakt
  „Staatsbetrieb Sächsische Informatik Dienste, Radebeul“
  (https://rdap.db.ripe.net/ip/31.12.57.226).
* **Umfang (DNS-Abgleich aller 418 Hosts der Vollerhebung):** 29 sächsische Gemeindeseiten
  im Netz, davon 27 in der Vollerhebung als „robots“ (von 28 „robots“ in Sachsen), 19 mit
  unter 10.000 Einwohnern, z. B. Burkhardtsdorf, Erlau, Weischlitz, Neuensalz, Treuen,
  Moritzburg, Priestewitz, Krauschwitz, Weißkeißel.
* **Betreiber der Websites:** nicht belegt (SID ist der Netzbetreiber; ob SID oder ein
  kommunaler Dienstleister die Seiten betreibt, ließ sich nicht klären). Inhalte wurden
  nicht abgerufen.
* **Nächster Schritt:** Eine Anfrage an den Betreiber der Plattform (zu klären über SID
  oder eine der Gemeinden) erschließt 29 Gemeinden auf einmal; ohne Freigabe bleiben sie
  im Rest.

## 3. Dorffest-Test je Quelle

| Quelle | Beispiel | Datum | Link |
|---|---|---|---|
| verwaltungsportal.de | Weihnachtsmarkt Großwig (Dreiheide) | 28.11.2026 | https://www.dreiheide.de/veranstaltungen/2841776/2026/11/28/weihnachtsmarkt-grosswig |
| verwaltungsportal.de | Halloweenfest der Feuerwehr Wiedemar | 31.10.2026 | https://www.wiedemar.de/veranstaltungen/2987376/2026/10/31/halloweenfest |
| NOLIS iCal | 150 Jahre Feuerwehr Elsdorf (Lunzenau) | 05.06.2027 | iCal Lunzenau, `selected_kommune=26250` |
| NOLIS iCal | Traditioneller Lunzenauer Weihnachtsmarkt | 12./13.12.2026 | https://www.lunzenau.de/veranstaltungen/veranstaltung/traditioneller-lunzenauer-weihnachtsmarkt-900000398-26250.ical |
| destination.one (SaTourN) | Kirmes in Carlsfeld (Eibenstock) | 03. bis 05.09.2027 | ID 100680493, `experience=open-data` |
| The Events Calendar | Oktoberfest, Kulturverein Seeligstadt (Großharthau) | 24.10.2026 (vergangen) | https://grossharthau.de/event/oktoberfest/ |
| Modern Events Calendar | kein Fest für Schönwölkau | | https://krostitz.de/feed/?post_type=mec-events |
| Freizeitkalender Vogtlandkreis | 4. Schönauer KürbisGlühen, Ortschaftsrat Schönau (Falkenstein) | 31.10.2026 | https://stadt-falkenstein.de/veranstaltung/4-schoenauer-kuerbisgluehen-am-31102026 |
| Contao | Weihnachtsmarkt Lichtenberg, Drachenfest | 13.12.2026, 31.10.2026 | https://www.gemeinde-lichtenberg.de/veranstaltungen.html |
| Eigenbau Amtsberg | Pyramidenanschieben in Dittersdorf, Ortschaftsrat | 25.11.2026 | https://amtsberg.eu/?content=105&pkat=11&rid=11 |
| Eigenbau Neukieritzsch | Maibaumsetzen; Heimatfest; Weihnachtsmarkt mit Vereinen | 30.04.2027; 04.09.2027; 12.12.2026 | https://www.neukieritzsch.de/kalender |
| TYPO3 Bad Düben | Tiefensee´er Adventsmarkt, Verein für Nachbarschaftshilfe | 28.11.2026 | https://www.bad-dueben.de/termin/tiefenseeer-adventsmarkt/ |
| TYPO3 Dommitzsch | Adventsmarkt Dommitzsch | 05.12.2026 | https://dommitzsch.de/stadt-und-ortsrecht/termine/termin/adventsmarkt-dommitzsch |
| WordPress Fließtext Kirchberg | Weihnachtsmarkt auf dem Altmarkt | 27. bis 29.11.2026 | https://www.kirchberg.de/tourismus-wirtschaft/das-ist-los/veranstaltungskalender/ |
| WordPress Niederdorf | Pyramide anschieben | 28.11.2026 | https://www.niederdorf-erzgebirge.de/buergerservice/veranstaltungen/ |
| Tabelle Lawalde | Weihnachtsmarkt in Lawalde, Löschangriffteam Lawalde e.V. | 13.12.2026 | http://www.lawalde.de/seite/416242/veranstaltung-und-feste.html |
| statische Liste Diera-Zehren | Dorffest Zadel, Heimatverein Zadel | 10. bis 12.09.2027 | https://www.diera-zehren.de/naherholung/freizeit-kultur/veranstaltungskalender |
| Startseite/PDF Oderwitz | Weihnachtsmarkt Kulturverein; Depotfest der Feuerwehr (PDF, 05.09.2026) | 28./29.11.2026 | https://www.oderwitz.de/home/ |
| Amtsblatt PDF (Eigenverlag) | 30. Weihnachtsmarkt in Doberschau, FFw und Heimatverein | 29.11.2026 | https://www.doberschau-gaussig.de/gemeindenachrichten.html (GN 11/2026) |
| kalender.evlks.de | Buntes Markttreiben zur Kirchweih, Trinitatiskirchgemeinde Chemnitz-Hilbersdorf; Weihnachtsmarkt an der Weinbergkirche Pillnitz | 14.11.2026; 13.12.2026 | https://kalender.evlks.de/xml?start=2026-10-29&end=2027-10-28&eventtype=7&highlight=all&itemsPerPage=500&dest=all |
| MUNIPOLIS | St. Martinstag, Feuerwehrverein Jöhstadt (nur Plakatbild der Gemeindeseite) | 11.11.2026 | https://www.joehstadt.de/ |
| Riedel-Amtsblatt | nicht möglich | | |

## 4. Abgleich destination.one

`experience=open-data`, `q=area:"Sachsen"`, Fenster 29.10.2026 bis 28.10.2027: 2.059
Treffer (fünf Seiten zu 500 abgerufen, ein Treffer je Termin), 1.089 verschiedene IDs in
181 Orten. Stichprobe zweifach geprüft: `q=city:"<Name>"` (deutscher Namensteil, ohne
„, Stadt“ und ohne sorbischen Namen) und lokal über die PLZ.

**7 von 30 Gemeinden mit mindestens einem Termin:** Lunzenau 21 (Schloss Rochsburg),
Eibenstock 8 (Kirmes in Carlsfeld, Märchenweihnacht, Mettenschicht Sosa), Bad Düben 3
(Weihnachtsmarkt, Adventsglühen), Großpösna 2 (Konzert, VINETA), Rammenau 1
(„Nikolausmanufaktur“), Brandis 1 („Brandiser Schlossweihnacht“), Dommitzsch 1
(„Dommitzscher Adventsmarkt“). Fehltreffer ausgeschlossen: `city:"Lichtenberg"` liefert
Lichtenberg/Erzgebirge (09638), nicht die Stichprobengemeinde; die PLZ von Niederdorf
(09366) trifft nur Stollberg. Kontrolle Zwickau: 150.

Von den 11 verwaltungsportal-Gemeinden haben nur Rammenau und Großpösna dort einen
Termin, keiner davon ein Dorffest.

## 5. Abdeckung (nur Stichprobenanteil)

| Kennzahl | Formel | Wert | 95 %-Intervall (Wilson) |
|---|---|---|---|
| kommende Termine dieser Gemeinde online | 24 / 30 | 80 % | |
| Fest in einer Quelle, die eine Integration greifen kann | 21 / 30 | 70 % | 52 % bis 83 % |
| Fest nur als PDF oder Bild | 2 / 30 | 7 % | |
| kein Fest online belegt | 7 / 30 | 23 % | |
| Auftritt auf verwaltungsportal.de | 11 / 30 | 37 % | 22 % bis 55 % |
| Termine über offenen Feed oder REST (NOLIS, Tribe) | 3 / 30 | 10 % | |
| Termine nur als HTML ohne Hersteller-Parser | 12 / 30 | 40 % | |
| Termin in destination.one `open-data` | 7 / 30 | 23 % | 12 % bis 41 % |
| Dorffest in destination.one | 3 / 30 (Eibenstock, Bad Düben, Dommitzsch) | 10 % | |
| Riedel-Amtsblatt | 6 / 30 | 20 % | |
| Stufe der Vollerhebung weicht ab | 4 / 30 | 13 % | |

Wilson für 21/30: z = 1,96, Mitte (0,7 + z²/60) / (1 + z²/30) = 0,677, Halbbreite
1,96 · √(0,7·0,3/30 + z²/3600) / (1 + z²/30) = 0,156. Für 11/30: Mitte 0,382, Halbbreite
0,163. Für 7/30: Mitte 0,264, Halbbreite 0,146. Eine Hochrechnung auf die 352 Gemeinden
ist nur als Spanne zulässig und nicht belegt.

„HTML ohne Hersteller-Parser“ zählt Amtsberg, Eibenstock, Niederdorf, Falkenstein,
Kirchberg, Lichtenberg, Oderwitz, Lawalde (Tabelle), Diera-Zehren, Neukieritzsch,
Bad Düben, Dommitzsch.

## 6. Priorisierte Liste für Sachsen

| # | Integration | Gemeinden (Beleg) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | verwaltungsportal.de, Parser Liste + JSON-LD | 84 von 418 (Vollerhebung), 11/30 Stichprobe | Datum, Ort meist als Name, Veranstalter teils; Ortsteilfeste gut abgedeckt; Serien und Ratssitzungen filtern | Nutzungsbedingungen nicht belegt; robots erlaubt `*` | Parser wie Thüringen, Pfad mit und ohne `.html`; Förderverein nach Teilnehmerliste und Schnittstelle fragen |
| 2 | NOLIS iCal | 20 (Vollerhebung, Kreise Leipzig, Nordsachsen, Mittelsachsen), 1/30 | Kommune, Ort, Veranstalter, Kategorie; `GEO` unbrauchbar | nicht belegt | bundesweiten NOLIS-Adapter bauen, Sachsen mitnehmen |
| 3 | destination.one `area:"Sachsen"` (SaTourN) | 1.089 Termine in 181 Orten, 7/30 | sehr gut (Koordinaten, Lizenz je Datensatz), kaum Dorffeste | CC0, CC BY, CC BY-SA | im bestehenden destination.one-Import; TMGS nach Meldeweg für Gemeinden fragen |
| 4 | Plugin-Detektor (Tribe, MEC) | Brandis, Großharthau, VG Krostitz; Vollerhebung Tribe 11, MEC 4 | Tribe sehr gut | Gemeinde-Websites | MEC-Feedpfad `/feed/?post_type=mec-events` als zweiten Versuch aufnehmen |
| 5 | Allgemeiner HTML-Parser (Stufe E) | 12/30 | Feste häufig (Amtsberg, Neukieritzsch, Lawalde, Diera-Zehren), Formate je Seite verschieden, Tippfehler im Datum (Kirchberg „29.11.026“) | Gemeinde-Websites | Registry mit Kalender-URL je Gemeinde; die korrigierten URLs dieser Stichprobe übernehmen |
| 6 | Anfrage Plattform im Landesnetz V4SN | 29 Gemeinden (19 unter 10.000 EW) | nicht belegt (nicht abgerufen) | robots.txt sperrt alle außer Suchmaschinen | Betreiber über SID oder eine Gemeinde ermitteln, Freigabe erfragen |
| 7 | Freizeitkalender Vogtlandkreis | Falkenstein, Pöhl, Neukirch, Steina (Vollerhebung); Kreis Greiz (TH) | Ort, Anschrift, Veranstalter, Bildlizenz | Abruf nur nach Anmeldung und Zulassung | beim Landratsamt Vogtlandkreis Zulassung anfragen |
| 8 | kalender.evlks.de | landesweit, Kirchgemeinden | Koordinaten, Ort, PLZ; wenige Volksfeste (20 Gemeindefeste) | nicht belegt | Nebenquelle nach den Gemeinde-Generics; Lizenz bei Vernetzte Kirche (kalender@evlks.de) klären |
| 9 | Riedel-Verlag | 117 Titel, 6/30 | nur PDF, Zugang per Mail | entfällt | nur falls ein Amtsblatt-Projekt kommt |
| 10 | MUNIPOLIS | 3/30 (Kalender nur Jöhstadt) | nicht belegt | API per robots gesperrt | nur mit Absprache, nachrangig |
| | Nicht weiter verfolgen | | | | Outdooractive (kostenpflichtig), Kreiskalender ohne Feed (außer Vogtland), Kabeljournal bis zur Zahl der Partner |

**Landesbesonderheiten für die Umsetzung:**

* **Sorbische Doppelnamen** (Spreetal / Sprjewiny Doł, Kreba-Neudorf / Chrjebja-Nowa Wjes,
  Bad Muskau / Mužakow): Suchen und Resolver mit dem deutschen Namensteil.
* **Erzgebirgische Festarten** sind die häufigsten Dorffeste im Advent:
  Pyramidenanschieben, Bergparade, Mettenschicht, Lichtelfest. Sie fehlen in der
  bundesweiten Festliste des Dorffest-Tests und sollten bei Kategorie und Taxonomie
  mitgedacht werden.
* **Kirmes statt Kirchweih:** In Sachsen heißt das Fest im Titel „Kirmes“ (destination.one:
  Kirmes 3, Kirchweih 0).

**Lücken:** 7 Gemeinden ohne Fest online (Wiesenbad, Spreetal, Radeburg, Brandis mit
Ortsteilen, Großpösna, Laußig, Schönwölkau). Laußig nennt auf der Startseite „zahlreiche
Dorffeste“, aber ohne Termine; Schönwölkaus „Wölkauer Wiesn“ stand nur auf regioactive
(heute 410). Diese Lücke schließt nur ein Amtsblatt-Weg oder ein Meldeweg für Vereine.
Nicht belegt: Teilnehmerliste von „Sachsen vernetzt“, Betreiber der V4SN-Seiten, Lizenz
von kalender.evlks.de, Zahl der Kabeljournal-Gemeinden, Landkreis Sächsische
Schweiz-Osterzgebirge (nicht in der Stichprobe).

## 7. Was der User selbst tun muss

1. Förderverein für regionale Entwicklung e.V.: Teilnehmerliste und Schnittstelle für
   „Sachsen vernetzt“ (zusammen mit „Thüringen vernetzt“, 07-thueringen 2.1).
2. TMGS: Meldeweg für Gemeinden in SaTourN, Anteil nicht offen lizenzierter Termine.
3. Betreiber der Gemeindeseiten im Landesnetz V4SN ermitteln (29 Gemeinden) und
   Freigabe erfragen.
4. Optional: Landratsamt Vogtlandkreis (freizeitkalender.eu), Vernetzte Kirche
   (kalender.evlks.de), NOLIS (Nutzungsbedingungen, bundesweit).

## 8. Anfragen

Alle Anfragen am 29.10.2026, lesend, UA `Mozilla/5.0 (research; lasstreffen.at)`.
Gemeinde-, Verbands- und Kreisseiten: höchstens 6 je Host, außer den unten genannten
Abweichungen. Einzelprotokolle der drei Prüfgruppen (Pfade und Status) liegen in den
Arbeitsnotizen der Sitzung; die Hosts und Pfade stehen in den Tabellen oben.

| Host | Anfragen | Status |
|---|---|---|
| www.destatis.de | Gemeindeverzeichnis-Auszug | 200 |
| meta.et4.de | `/robots.txt` (404), 1 Test `area:"Sachsen"`, 30 × `city:"<Gemeinde>"`, 5 Seiten `area:"Sachsen"` `limit=500` | 404, 36 × 200 |
| sachsen.tourismusnetzwerk.info | 5 Seiten (WebFetch): Digitalarchitektur, SaTourN, Dokumentation, Datenausgabe, FAQs | 200 |
| satourn.travel, www.sachsen-tourismus.de | `/` (301 auf tourismusnetzwerk), 1 Pressemeldung | 301, 404 |
| kalender.evlks.de | `/robots.txt`, `/`, 9 Exporte (`/xml`, `/json`) | 404, 10 × 200 |
| handbuch.evangelische-termine.de | 2 Seiten (WebFetch) | 200 |
| www.riedel-verlag.de | `/robots.txt`, `/de/aktuelle-ausgaben` | 200 |
| www.munipolis.de, info.munipolis.de | `/` (WebFetch) | 302, 200 |
| 10 Landkreis-Hosts | je `/robots.txt` und `/`, 6 Kalenderseiten, Landkreis Leipzig `/veranstaltungen` zweimal | 200 |
| 5 Gemeinde-Hosts im Netz V4SN, gemeinde-burkau.de | je `/robots.txt` (6), 3 × HEAD `/robots.txt` | 200 |
| rdap.db.ripe.net | `/ip/31.12.57.226` | 200 |
| DNS | 418 Namensauflösungen der Vollerhebungs-Hosts (kein HTTP) | |
| www.gemeinde-machern.de | `/robots.txt`, 2 iCal-Exporte | 200 |
| machern.de | 1 iCal-Versuch (Domain zum Verkauf) | 200 |
| Gruppe A (Nr. 1 bis 10) | 58 Anfragen auf 13 Hosts, u. a. joehstadt.munipolis.de 5, api.munipolis.com nur `/robots.txt`, freizeitkalender.eu 4 | 200, amtsberg.eu/robots.txt 404 |
| Gruppe B (Nr. 11 bis 20) | 49 Anfragen auf 13 Hosts, u. a. badmuskau.munipolis.de 4, lommatzscher-pflege.de 3 | 200, 2 × 404, 2 × 000 (HTTPS verweigert) |
| Gruppe C (Nr. 21 bis 30) | 59 Anfragen auf 15 Hosts, u. a. krostitz.de 6, regioactive.de 2 | 200, 404, 403, 410, 4 × DNS-Fehler |
| WebSearch | 3 eigene, 16 der Prüfgruppen | |

**Abweichungen von den Regeln, offen benannt:**

* kalender.evlks.de bekam 11 Anfragen statt höchstens 6, weil der Standardparameter
  `highlight=high` die Zählung verfälschte und erst die letzte Abfrage die Kategorie
  „Feste/Gemeindefeste“ vollständig zeigte. Es gibt dort keine robots.txt.
* Die Website Thermalbad Wiesenbad bekam 7 Anfragen, wenn man www.wiesenbad.de und
  wiesenbad.de zusammenzählt (2 davon automatische Weiterleitungen).
* Der Brief an Gruppe C nannte für Schönwölkau eine falsche Punycode-Form
  (`xn--schnwlkau-07ae.de`, 4 DNS-Fehler); richtig ist `xn--schnwlkau-27ac.de`.
* Gelesen, aber nicht aufgerufen: die Munipolis-API (POST, robots `Disallow: /`), die
  Outdooractive-API (Projektschlüssel im Seitenquelltext), meinOrt (robots), die
  Inhalte der V4SN-Seiten (robots). Ein PDF geöffnet (Gemeindenachrichten
  Doberschau-Gaußig 11/2026), eines in Laußig (Amtsblatt 09/2026), eines in Oderwitz
  (Veranstaltungsplan 2026).
