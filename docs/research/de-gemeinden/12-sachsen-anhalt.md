# Sachsen-Anhalt: Gemeindekalender und Dorffeste (Stand 2026-10-29)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.13`. Frage: Wie kommen wir an die
Termine der kleinen Gemeinden in Sachsen-Anhalt, also Dorffeste, Feuerwehrfeste, Kirmes,
Erntefeste, Heimatfeste und Weihnachtsmärkte? Bundesweite Anbieter stehen in
[00-bundesweit.md](00-bundesweit.md), die Zuordnung aller 218 Gemeinden des Landes in
[01-vollerhebung.md](01-vollerhebung.md) und
[data/vollerhebung-2026-10.csv](data/vollerhebung-2026-10.csv). Dieser Bericht prüft die
Zuordnung in einer Stichprobe nach und vertieft Dorffest-Test, Lizenzlage und
Landesbesonderheiten. verwaltungsportal.de ist in [07-thueringen.md](07-thueringen.md)
ausführlich beschrieben und wird hier nur aus Landessicht ergänzt.

Arbeitsweise: nur lesend, keine Konten, keine Formulare, keine Mails. Jede Zahl stammt aus
einer eigenen Antwort vom 29.10.2026 oder aus einer verlinkten Seite. Was sich nicht
belegen ließ, steht als „nicht belegt“ da. Alle Anfragen: Abschnitt 8.

## Kurzfazit

1. **Die Einheitsgemeinden sind der Hebel, die Verbandsgemeinden die Lücke.** Alle 11
   Einheitsgemeinden der Stichprobe haben einen eigenen Online-Kalender, und für alle 11
   steht dort mindestens ein Fest dieser Gemeinde (Weihnachtsmarkt, Martinsumzug,
   Volksfest, Feuerwehrveranstaltung). 9 dieser 11 Kalender führen auch Termine aus den
   Ortsteilen, z. B. Querfurt („Dorfglüh´n in Liederstädt“ der Pfingstburschen,
   „Thaldorfer Adventsmarkt“, „Weihnachtsmarkt im Schlosspark Lodersleben“), Harzgerode
   („Volksfest in Königerode“) oder Nienburg („Latdorfer Weihnachtsmarkt“). Von den 19
   Mitgliedsgemeinden einer Verbandsgemeinde ist das nur bei 2 der Fall (Flechtingen,
   Hötensleben, beide mit eigener Seite). Die Kalender der Verbandsgemeinden führen
   kaum Dorftermine (Goldene Aue 2 Termine, VG Flechtingen und Helbra keine).
2. **verwaltungsportal.de ist auch hier der größte Generic, aber kleiner als in
   Thüringen.** 12 der 30 Stichprobengemeinden (40 %) haben ihren Verwaltungsauftritt auf
   der Plattform, Programm „Sachsen-Anhalt vernetzt“ des Fördervereins für regionale
   Entwicklung (Fußzeile Klötze, Seeland; `sachsen-anhalt-vernetzt.de` leitet auf
   azubi-projekte.de). Die Vollerhebung zählt 55 der 218 Gemeinden. Neu für den Import:
   das JSON-LD schreibt den Ortsteil in `addressLocality` („Querfurt OT Liederstädt“,
   „Harzgerode OT Königerode“). Derselbe Parser wie in Thüringen reicht.
3. **GeoCMS von brain-SCC (Merseburg) ist ein Sachsen-Anhalt-Hersteller.** 43 der 63
   GeoCMS-Gemeinden der Vollerhebung liegen in Sachsen-Anhalt, in der Stichprobe 6 von 30.
   Kein Feed, einheitliches HTML in zwei Vorlagen-Generationen (5.52 und 26.8.8),
   Kategorie „Volksfeste, Märkte“, `Crawl-delay: 15`. Zwei der drei VG-Seiten dieses
   Herstellers waren am 29.10.2026 nicht erreichbar.
4. **SAiNT ist die Landesdatenbank mit offener Lizenz, aber mit Erlösverbot in der
   API-Nutzung.** Die IMG Sachsen-Anhalt bündelt dort Tourismusdaten; laut API-Schema
   stammen Veranstaltungen aus „Outdoor Active“ und „BrainSCC“, also auch aus dem
   GeoCMS-Hersteller. Die Daten stehen laut Betreiber unter Creative-Commons-Lizenzen,
   der API-Zugang kommt aber erst nach Registrierung, und die Nutzungsbedingungen
   verbieten, die API „extern geschäftlich [zu] nutzen“ oder „anderweitig Einnahmen aus
   der API [zu] generieren“ (Ziffer 3.1 a). Für eine werbefinanzierte Seite braucht es
   eine schriftliche Einzelvereinbarung (Ziffer 1.3). Welche GeoCMS-Kalender in SAiNT
   einfließen: nicht belegt.
5. **destination.one deckt die kleinen Gemeinden kaum ab.** 544 Termine mit Gebiet
   Sachsen-Anhalt im Fenster 29.10.2026 bis 28.10.2027, davon 180 in Wernigerode. Von 30
   Stichprobengemeinden haben 2 einen Treffer (Harzgerode 7, Benndorf 1). Im Titel kein
   „Kirmes“, „Feuerwehr“, „Dorffest“, „Schützenfest“ oder „Maibaum“; 14 Weihnachtsmärkte.
6. **Amtsblätter bleiben PDF.** Die verwaltungsportal-Seiten liefern sie nur über ein
   POST-Formular, die ULB Halle archiviert Pflichtexemplare mit Verzug (Ausgabe 2023
   eingestellt 2025). WITTICH (Herzberg) druckt Sachsen-Anhalt-Amtsblätter; der Weg
   bleibt das bundesweite WITTICH-Gespräch.

## 1. Stichprobe

**Ziehung (reproduzierbar).** Quelle: Destatis Gemeindeverzeichnis-Auszug, Stichtag
30.09.2026 (`AuszugGV3QAktuell.xlsx`, Blatt `Onlineprodukt_Gemeinden30092026`, abgerufen
29.10.2026, 200, 1.872.608 Byte, dieselbe Datei wie in Thüringen). Regel: Land `15`,
Satzart `60`, Textkennzeichen nicht 65/66, Bevölkerung unter 10.000, sortiert nach ARS;
dann `random.Random(28013).sample(liste, 30)` (Seed 28013 = fn-28, Ticket 13), Ausgabe
nach ARS. Grundgesamtheit 166 von 218 Gemeinden (594.746 von 2.120.252 Einwohnern).

```python
import random, openpyxl
ws = openpyxl.load_workbook(path, read_only=True)['Onlineprodukt_Gemeinden30092026']
gem = [r for r in ws.iter_rows(min_row=7, values_only=True)
       if r[2] == '15' and r[0] == '60' and r[1] not in ('65', '66') and r[9] < 10000]
gem.sort(key=lambda r: r[2]+r[3]+r[4]+r[5]+r[6])
sample = random.Random(28013).sample(gem, 30)
```

Gemeindeverbände laut Datei: 104 verbandsfreie Gemeinden (Kennzeichen 50, in
Sachsen-Anhalt meist Einheitsgemeinden mit Ortschaften) und 18 Verbandsgemeinden
(Kennzeichen 53) mit zusammen 114 Mitgliedsgemeinden. In der Stichprobe: 11
Einheitsgemeinden, 19 Mitgliedsgemeinden aus 9 Verbandsgemeinden.

**Spalten:** VE = Zuordnung der Vollerhebung (Spalte `integration`); Fundort = wo Termine
dieser Gemeinde stehen (oder ihrer Verwaltung, wenn die Gemeinde keine eigene Seite hat);
VP = verwaltungsportal.de; Termine = Termin-Links in der Liste am 29.10.2026; d.one =
Treffer `city` beginnt mit dem Gemeindenamen in destination.one `open-data` (Abschnitt 4);
OT = Kalender führt Ortsteil-Termine (nur Einheitsgemeinden); Fest = Dorffest-Test für
diese Gemeinde bestanden.

| # | Gemeinde | AGS | EW | Verwaltung | VE | Fundort, nachgeprüft | CMS/Plattform | Link | Termine | d.one | OT | Fest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Klötze, Stadt | 15081280 | 9.609 | Einheitsgemeinde | VP | eigene Seite | VP 864 | https://www.stadt-kloetze.de/veranstaltungen/index.php | 8 | 0 | ja (Kusey, Schwiesau) | ja |
| 2 | Zörbig, Stadt | 15082440 | 8.787 | Einheitsgemeinde | ikiss | eigene Seite; Amtsblatt „Zörbiger Bote“ | Advantic iKISS | https://www.stadt-zoerbig.de/Willkommen/Veranstaltungen/ | 7 | 0 | ja (Löberitz, Mößlitz) | ja |
| 3 | Colbitz | 15083130 | 3.420 | VG Elbe-Heide | V (VP) | VG-Kalender, im Titel kein Colbitzer Termin; eigene Seite ohne Kalender | VP 40 (VG) | https://www.elbe-heide.de/veranstaltungen/index.php | 26 | 0 | | nein |
| 4 | Flechtingen | 15083230 | 2.646 | VG Flechtingen | html_generic | eigene Seite, Jahresplan 2026 als statische Liste mit Ortsteilen | Zeta Producer 17.2.5 | https://www.luftkurortflechtingen.de/veranstaltungskalender.html | ganzes Jahr | 0 | | ja |
| 5 | Ingersleben | 15083323 | 1.251 | VG Flechtingen | leer | VG-Seite ohne Termine | Neos (Münsmedia) | https://www.vg-flechtingen.de/rathaus/verbandsgemeinde/veranstaltungen | 0 | 0 | | nein |
| 6 | Hötensleben | 15083320 | 3.329 | VG Obere Aller | VP | eigene Seite | VP 110 | https://www.hoetensleben.de/veranstaltungen/index.php | 7 | 0 | | ja |
| 7 | Teuchern, Stadt | 15084490 | 7.645 | Einheitsgemeinde | html_generic | eigene Seite (Korrektur: GeoCMS) | GeoCMS 26.8.8 | https://www.stadt-teuchern.de/de/veranstaltungen.html | 5 | 0 | nicht erkennbar | ja |
| 8 | Schnaudertal | 15084442 | 863 | VG Droyßiger-Zeitzer Forst | geocms | VG-Kalender, kein Schnaudertaler Ortsname im Titel erkennbar | GeoCMS 5.52.00 | https://www.vgem-dzf.de/de/veranstaltungen.html | 10 je Seite | 0 | | nein |
| 9 | Balgstädt | 15084025 | 1.041 | VG Unstruttal | geocms | VG-Link leitet per 302 auf destination.one-Experience `saale-unstrut-tourismus` (Korrektur) | GeoCMS (VG), Kalender destination.one | https://www.verbgem-unstruttal.de/de/veranstaltungen.html | Tourismus, Umkreis 18 km | 0 | | nein |
| 10 | Schönburg | 15084445 | 953 | VG Wethautal | geocms | nicht nachgeprüft: Host am 29.10.2026 ohne Verbindung | GeoCMS (laut VE) | https://www.vgem-wethautal.de/de/veranstaltungen-wethautal.html | | 0 | | nicht prüfbar |
| 11 | Harzgerode, Stadt | 15085145 | 7.185 | Einheitsgemeinde | VP | eigene Seite; Amtsblatt „Unterharz Bote“ | VP 3102 | https://www.harzgerode.de/veranstaltungen/index.php | 15 | 7 | ja (Königerode, Mägdesprung) | ja |
| 12 | Nordharz | 15085227 | 7.550 | Einheitsgemeinde | eventsmanager | eigene Seite, iCal | WordPress + Events Manager 7.4.8 | https://gemeinde-nordharz.de/veranstaltungskalender/ | 50 (ICS) | 0 | ja (Langeln, Danstedt, Heudeber u. a.) | ja |
| 13 | Ditfurt | 15085090 | 1.336 | VG Vorharz | VP | eigene Seite (nur Vereinstraining) | VP 12021 | https://www.ditfurt.de/veranstaltungen/index.php | 8 | 0 | | nein |
| 14 | Möser | 15086145 | 8.381 | Einheitsgemeinde | js_oder_feed | eigene Seite, RSS mit Ortschaft als Kategorie | django CMS | https://www.gemeinde-moeser.de/de/feeds/kalender/ | 19 (RSS) | 0 | ja (Hohenwarthe, Körbelitz, Pietzpuhl) | ja |
| 15 | Berga | 15087055 | 1.641 | VG Goldene Aue | VP | VG-Kalender, kein Termin hier; Amtsblatt „Goldene Aue Kurier“ | VP 30 (VG) | https://www.vwg-goldene-aue.de/veranstaltungen/index.php | 2 | 0 | | nein |
| 16 | Edersleben | 15087125 | 916 | VG Goldene Aue | VP | wie 15 | VP 30 (VG) | wie 15 | 2 | 0 | | nein |
| 17 | Benndorf | 15087045 | 1.891 | VG Mansfelder Grund-Helbra | html_generic | VG-Kalender ohne Termin im Oktober 2026, letzter Beitrag „Kinderfest in Benndorf“ 2024 | WordPress + My Calendar | https://www.verwaltungsamt-helbra.de/veranstaltungen/ | 0 | 1 | | nein |
| 18 | Mücheln (Geiseltal), Stadt | 15088235 | 8.039 | Einheitsgemeinde | VP | eigene Seite | VP 3139 | https://www.muecheln.de/veranstaltungen/index.php | 1 | 0 | nein | ja |
| 19 | Querfurt, Stadt | 15088305 | 9.868 | Einheitsgemeinde | VP | eigene Seite | VP 8568 | https://www.querfurt.de/veranstaltungen/index.php | 152 | 0 | ja (Liederstädt, Lodersleben, Thaldorf, Gatterstädt u. a.) | ja |
| 20 | Barnstädt | 15088030 | 890 | VG Weida-Land | geocms | nicht nachgeprüft: Host ohne Verbindung | GeoCMS (laut VE) | https://www.weida-land.de/de/veranstaltungen.html | | 0 | | nicht prüfbar |
| 21 | Farnstädt | 15088100 | 1.418 | VG Weida-Land | geocms | wie 20 | wie 20 | wie 20 | | 0 | | nicht prüfbar |
| 22 | Nienburg (Saale), Stadt | 15089235 | 5.607 | Einheitsgemeinde | VP | eigene Seite | VP 2452 | https://www.stadt-nienburg-saale.de/veranstaltungen/index.php | 159 | 0 | ja (Latdorf, Neugattersleben, Wedlitz) | ja |
| 23 | Seeland, Stadt | 15089307 | 7.420 | Einheitsgemeinde | VP | eigene Seite, Termine mit „OT …“ im Titel | VP 3234 | https://www.stadt-seeland.de/veranstaltungen/index.php | 26 | 0 | ja (Friedrichsaue, Hoym, Gatersleben, Frose) | ja |
| 24 | Arneburg, Stadt | 15090010 | 1.379 | VG Arneburg-Goldbeck | V | eigene Seite ohne Kalender; VG verlinkt nur altmark.de (Korrektur) | eigenes CMS (laleike), VG WordPress/Elementor | https://www.arneburg-goldbeck.de/ | 0 | 0 | | nein |
| 25 | Goldbeck | 15090180 | 1.363 | VG Arneburg-Goldbeck | html_generic | VG ohne Kalender, Link auf Tourismusportal altmark.de (Korrektur); Amtsblatt „Hallo Nachbar“ | WordPress/Elementor | https://www.altmark.de/veranstaltungen/ | 336 regional | 0 | | nein |
| 26 | Hassel | 15090220 | 910 | VG Arneburg-Goldbeck | html_generic | wie 25 | wie 25 | wie 25 | | 0 | | nein |
| 27 | Iden | 15090270 | 711 | VG Arneburg-Goldbeck | html_generic | wie 25 | wie 25 | wie 25 | | 0 | | nein |
| 28 | Rochau | 15090435 | 965 | VG Arneburg-Goldbeck | html_generic | wie 25 | wie 25 | wie 25 | | 0 | | nein |
| 29 | Zehrental | 15090635 | 775 | VG Seehausen (Altmark) | ionas | VG-Seite ohne eigenes Kalendermodul, verweist auf Mitteilungsblatt und altmark.de (Korrektur) | ionas ohne TVM | https://www.seehausen-altmark.de/familie-freizeit/kultur-tourismus/veranstaltungskalender/ | 0 | 0 | | nein |
| 30 | Bad Schmiedeberg, Stadt | 15091020 | 7.852 | Einheitsgemeinde | VP | eigene Seite | VP 17885 | https://www.bad-schmiedeberg.de/veranstaltungen/index.php | 12 | 0 | ja (Trebitz, Großwig) | ja |

**Nachprüfung der Vollerhebung:** 19 von 30 Zuordnungen bestätigt, 8 korrigiert, 3 nicht
prüfbar (Hosts ohne Verbindung). Die Korrekturen: Teuchern ist GeoCMS in neuer Vorlage
(Generator `GeoCMS Version:26.8.8`, Links HTML-kodiert, deshalb vom allgemeinen Muster
nicht erkannt); der Kalender der VG Unstruttal ist eine Weiterleitung auf
destination.one; die fünf Gemeinden der VG Arneburg-Goldbeck und Zehrental haben keinen
Gemeindekalender, ihr Weg ist das Tourismusportal altmark.de (Abschnitt 2.4). Die
Zählung VP und GeoCMS der Vollerhebung bleibt damit eher Untergrenze.

**Auffällig:** Je kleiner die Gemeinde, desto seltener ein eigener Termin. Unter den 17
Gemeinden unter 2.000 Einwohnern hat keine einen bestandenen Dorffest-Test (3 davon
nicht prüfbar). Der
Unterschied liegt in der Verwaltungsform: Die Einheitsgemeinde pflegt einen Kalender für
alle Ortschaften, die Verbandsgemeinde meist keinen oder einen fast leeren.

## 2. Generics

### 2.1 verwaltungsportal.de („Sachsen-Anhalt vernetzt“)

* **Betreiber:** Förderverein für regionale Entwicklung e.V., Nuthetal
  ([00-bundesweit.md](00-bundesweit.md) C7, [07-thueringen.md](07-thueringen.md) 2.1).
  Landesprogramm „Sachsen-Anhalt vernetzt“: Klötze und Seeland tragen den Text und das
  Logo `layout.verwaltungsportal.de/864/img/vernetzt.png`; `http://www.sachsen-anhalt-vernetzt.de/`
  leitet auf https://www.azubi-projekte.de/ (eigener Abruf). Eine Teilnehmerliste für
  Sachsen-Anhalt wurde nicht gefunden.
* **Gemeinden:** Vollerhebung 55 von 218 Gemeinden auf 49 Hosts (CSV, selbst gezählt),
  davon 52 unter 10.000 Einwohnern. Stichprobe 12 von 30 (Wilson 95 %: 25 % bis 58 %).
* **Zugriffsweg:** wie Thüringen: Liste `/veranstaltungen/index.php`, Detail
  `/veranstaltungen/<id>/<JJJJ>/<MM>/<TT>/<slug>` (in Sachsen-Anhalt ohne `.html`), JSON-LD
  je Termin, kein RSS/iCal. Die Liste zeigt bis zu 12 Monate (Querfurt bis 13.10.2027,
  Nienburg bis 28.10.2027). Serientermine stehen einzeln in der Liste (Querfurt 98 Links
  auf eine Sonderausstellung, Nienburg 52 auf einen Kindertreff); der Import muss sie
  zusammenfassen.
* **Felder (Proben Harzgerode, Querfurt, selbst abgerufen):** `@type: Event`, `name`,
  `description`, `startDate` (nur Datum), `endDate`, `image[]`
  (fotos.verwaltungsportal.de), `location` (`@type: Place`, `name`, `address`
  `{streetAddress, postalCode, addressLocality, addressCountry}`, `url`), `organizer`
  (`@type: Organization`, `name`, `address`, `url`). Keine Koordinaten.
  **Landesbesonderheit:** `addressLocality` nennt den Ortsteil, z. B.
  `"Querfurt OT Liederstädt"` mit `streetAddress "Querfurter Straße 19"` und Veranstalter
  „Pfingstburschenverein Liederstädt e.V.“. Der Resolver kann „<Gemeinde> OT <Ortsteil>“
  direkt zerlegen; destination.one schreibt Orte in Sachsen-Anhalt im selben Muster
  („Harzgerode OT Alexisbad“, Abschnitt 4).
* **Regionale Kalender:** Seeland führt auch Termine der Nachbarstadt Falkenstein/Harz
  („Weihnachtsmarkt auf dem Markt in Ermsleben“, „Meisdorfer Lichterumzug“). Ort nur aus
  `location`, nie aus dem Host ableiten.
* **robots.txt:** auf allen 12 geprüften Hosts gleich: Sperren nur für eine Liste benannter
  Bots, `Crawl-delay: 10` für einzelne, keine Regel für `*`. Nutzungsbedingungen nicht
  belegt.
* **Dorffest-Test:** „Volksfest in Königerode“, 18. bis 20.06.2027
  https://www.harzgerode.de/veranstaltungen/2943357/2027/06/18/volksfest-in-koenigerode ;
  „Dorfglüh´n in Liederstädt“, 05.12.2026
  https://www.querfurt.de/veranstaltungen/2870536/2026/12/05/dorfgluehn-in-liederstaedt ;
  in den Listen außerdem „2. Halloweenfest der Querfurter Feuerwehr“ (31.10.2026),
  „Martinsfest mit Laternenumzug“ (Querfurt, 10.11.2026), „Weihnachtsmarkt auf dem
  Schlosshof“ (Hötensleben, 28.11.2026), „Trebitzer Weihnachtsmarkt“ (Bad Schmiedeberg,
  28.11.2026), „14. Neugatterslebener Weihnachtsmarkt“ (Nienburg, 19.12.2026),
  „Halloween auf dem Gelände der FF Mücheln“ (30.10.2026).
* **Nächster Schritt:** derselbe Parser wie für Thüringen und Brandenburg; die 49 Hosts
  stehen in der CSV. Anfrage beim Förderverein nach Teilnehmerliste und Feed läuft
  bundesweit mit.

### 2.2 GeoCMS (brain-SCC GmbH, Merseburg)

* **Betreiber:** brain-SCC GmbH, Merseburg (Fußzeile https://www.brain-scc.de/ :
  „brain-SCC GmbH, Merseburg, Sachsen-Anhalt, Deutschland“). Referenz- oder Kundenliste
  auf der Startseite nicht gefunden.
* **Gemeinden:** Vollerhebung 43 Gemeinden auf 25 Hosts in Sachsen-Anhalt, bundesweit 63
  (CSV, selbst gezählt); 68 % aller GeoCMS-Gemeinden liegen also hier. Stichprobe 6 von
  30 (Wilson 95 %: 10 % bis 37 %), davon 3 am 29.10.2026 ohne Verbindung (Wethautal,
  Weida-Land) und eine mit Weiterleitung auf destination.one (Unstruttal).
* **Zugriffsweg:** einheitliches HTML, kein Feed gefunden. Zwei Vorlagen:
  * 5.52.00 (VG Droyßiger-Zeitzer Forst): Liste `/de/veranstaltungen.html`, Klassen
    `gcevent-list-row`, `gcevent-list-datetime`, `gcevent-list-location`,
    `gcevent-list-categories`, 10 Termine je Seite; Detail
    `/de/veranstaltungen/event/<id>,<mandant>/<slug>-<TT-MM-JJJJ>.html`.
  * 26.8.8 (Teuchern): Bootstrap-Karten, `btp_event_tooltip`, `gcevent-list-location-span`,
    Links HTML-kodiert (`&#x2F;de&#x2F;veranstaltungen&#x2F;event&#x2F;36239,42&#x2F;…`).
    Detailseite ohne JSON-LD und ohne iCal-Link, mit Kategorie, Termin, Veranstaltungsort
    samt Adresse, Preis und Veranstalter im HTML.
  * iCal je Termin `?ical=1` ist für GeoCMS 5.52 in Thüringen belegt
    ([07-thueringen.md](07-thueringen.md) 2.4); hier nicht erneut abgerufen, weil der
    Detailabruf bei vgem-dzf.de zweimal ohne Verbindung blieb.
* **Felder (Probe Teuchern, HTML):** Titel, Kategorie („Volksfeste, Märkte“), Datum und
  Uhrzeit („16.01.2027 von 15:00 Uhr bis 22:00 Uhr“), Veranstaltungsort („Platz vor der
  Turnhalle, Am Stadion, 06682 Teuchern“), Preis („Eintritt frei“), Veranstalter
  („Heimatverein Teuchern e.V“). Filterkategorien der Liste: Bühne/Theater, Bildung,
  Kunst/Kultur, Musik, Politik, Sonstiges, Sport, „Volksfeste, Märkte“.
* **robots.txt:** `User-agent: *`, `Crawl-delay: 15`, `Disallow: /admin` (vgem-dzf.de,
  verbgem-unstruttal.de, stadt-teuchern.de, auch brain-scc.de). Nutzungsbedingungen nicht
  belegt.
* **Dorffest-Test:** „Weihnachtsbaum verbrennen“ des Heimatvereins, Kategorie „Volksfeste,
  Märkte“, 16.01.2027
  https://www.stadt-teuchern.de/de/veranstaltungen/event/36239,42/weihnachtsbaum-verbrennen-16-01-2027.html ;
  „Halloween-Party in Döschwitz“ (VG Droyßiger-Zeitzer Forst, 30.10.2026). Ein klassisches
  Dorffest im Kalender eines GeoCMS-Kunden in Sachsen-Anhalt fand sich in den
  erreichbaren Listen nicht; in Thüringen „Kirmes in Oberellen“ (Gerstungen, GeoCMS).
* **Verbindung zu SAiNT:** Das API-Schema von SAiNT nennt für Veranstaltungen die Quelle
  `2 = BrainSCC` (Abschnitt 2.3). Ob und welche GeoCMS-Gemeindekalender darüber
  einfließen, ist nicht belegt.
* **Nächster Schritt:** zuerst über SAiNT klären, ob GeoCMS-Termine dort ankommen
  (dann eine Integration statt 25 Hosts). Sonst ein HTML-Parser für beide Vorlagen mit
  15 s Abstand je Host; bei brain-SCC nach einem Listen-Export fragen.

### 2.3 SAiNT (IMG Sachsen-Anhalt)

* **Betreiber:** Investitions- und Marketinggesellschaft Sachsen-Anhalt mbH, Magdeburg
  (Nutzungsbedingungen Ziffer 1.1, https://saint.tech/de/nutzungsbedingungen); Kontakt
  laut API-Spezifikation info@muensmedia.de (Dienstleister), für Datenfehler laut
  https://saint.tech/de/datenpflege saint@img-sachsen-anhalt.de.
* **Inhalt:** „SAiNT bündelt alle Daten aus Sachsen-Anhalt. Diese stammen aus den
  verschiedenen bereits bestehenden regionalen touristischen Datenbanken sowie ebenso aus
  Datenbanken von Verwaltung und Wirtschaft“ (https://saint.tech/de/ueber-saint). Die
  Daten werden „nicht bei SAiNT gepflegt …, sondern nur auf der Quellenseite“
  (Datenpflege-Seite). Menge der Veranstaltungen: nicht belegt (kein Abruf, siehe unten).
* **Zugriffsweg:** REST-API `https://saint.tech/api/v1/{api-key}/…`, Suche per POST
  (`/action` für Veranstaltungen, `/updated` für Änderungen seit Zeitstempel), Projekt-Key
  im Header. Spezifikation offen unter https://saint.tech/api/annotations?api-docs.json
  (abgerufen, 200). Dazu ein „Event-Embed“ mit Filter nach Gemeinde, Kategorie und
  Umkreis (https://saint.tech/de/events-einbetten). Beides „kostenlos nach
  Registrierung“.
* **Felder laut Spezifikation (Schema `ACTION`, „The Object Data for Action (Event)“):**
  `id`, `source` („0 = None, 1 = Outdoor Active, 2 = BrainSCC, 99 = Test Data“),
  `sourceId`, `lastImport`, `active`, `title`, `description`, `organizer`, `location`
  (Geo „11.88004,52.90869“), `eventBegin`, `eventEnd`, `eventFirst`, `eventLast`,
  `price`, `currencyType`, `primaryImage[]`, `category[]`, `homepage`, `author`,
  `timings[]`, `event_timing[]`. Suchfilter u. a. `region`, `district`, `location`,
  `title`, `text`. Aus einer echten Probe: nicht belegt.
* **Lizenz:** Datenebene offen: „Alle integrierten Daten … werden innerhalb von SAiNT mit
  einer Creative-Commons-Lizenz versehen“ und „SAiNT ist ein Open-Data-Projekt“
  (Über-SAiNT-Seite). Zugangsebene eingeschränkt: Ziffer 2.1 gewährt ein „unentgeltliches,
  einfaches, … widerrufliches Recht, die API … zu nutzen“; Ziffer 3.1 a verbietet, die API
  „extern geschäftlich [zu] nutzen … oder anderweitig Einnahmen aus der API [zu]
  generieren“; Ziffer 3.1 j verbietet den Verkauf der Daten; Ziffer 5 erlaubt Limits und
  Widerruf jederzeit. Ziffer 1.2: Mit dem ersten Zugriff auf die API gelten die
  Bedingungen als bestätigt. Ziffer 1.3: individuelle schriftliche Vereinbarungen haben
  Vorrang.
* **Warum kein Abruf:** Die Spezifikation nennt einen Demo-Projektschlüssel. Ein Aufruf
  hätte nach Ziffer 1.2 die Nutzungsbedingungen bestätigt, das ist eine Vereinbarung und
  fällt unter „keine Konten“. Deshalb nur Doku und Spezifikation gelesen.
* **robots.txt:** `User-agent: *` mit leerem `Disallow:`, nur „Sogou Spider“ gesperrt.
* **Dorffest-Test:** nicht möglich ohne Abruf. Hinweis: Outdooractive ist die Quelle hinter
  altmark.de (Abschnitt 2.4), dort steht kein Dorffest auf der ersten Seite.
* **Nächster Schritt (User):** bei der IMG schriftlich anfragen: Nutzung der
  Veranstaltungsdaten auf lasstreffen.de mit Werbefinanzierung trotz Ziffer 3.1 a,
  Bestätigung der CC-Lizenz je Datensatz, Zahl der Veranstaltungen mit `source = 2`
  (BrainSCC) und welche Gemeinden das sind. Danach Konto anlegen (User) und einen
  Dry-Run gegen die Stichprobe fahren.

### 2.4 altmark.de (Altmark-Tourismus, Outdooractive)

* **Fund:** Die VG Arneburg-Goldbeck verlinkt als Veranstaltungsseite nur
  https://www.altmark.de/veranstaltungen/ , die VG Seehausen verweist ebenfalls dorthin.
  TYPO3 mit Extension `tx_altmarkoaevents` („oa“ = Outdooractive, Detail-IDs wie
  `811693642` im Outdooractive-Schema), „12 von 336 Veranstaltungen werden angezeigt“, 15
  Seiten. Seite 1: Ausstellungen, Stadtführungen, Musikfest; kein Dorffest. Eigener
  „Redakteurszugang“ für Veranstalter (`/veranstaltungen/anmeldung-redakteurszugang/`).
* **robots.txt:** `User-agent: *` ohne Sperre. Lizenz nicht belegt.
* **Bewertung:** kein Gemeinde-Generic, sondern regionale Tourismusdatenbank; besser über
  SAiNT (`source = 1`) als per HTML. Ob die Dörfer der VG Arneburg-Goldbeck darin
  vorkommen: nicht geprüft.

### 2.5 Weitere Funde (je einmal)

| Fund | Wo | Zugriff | Bewertung |
|---|---|---|---|
| Advantic iKISS | Zörbig (7 Termine, Kategorie „Feste & Märkte“, „Feuerwehr“) | HTML `data-ikiss-mfid`, `ModID=11`, wie [00-bundesweit.md](00-bundesweit.md) C3; robots.txt sperrt `/output/`; Sitemap-Zeile verweist auf `projekt8.kid-magdeburg.de` | bundesweiter Generic, 26 Gemeinden in Sachsen-Anhalt (VE); Rolle der KID Magdeburg (kommunaler IT-Dienstleister) nicht belegt |
| Events Manager (WordPress) | Nordharz | `https://gemeinde-nordharz.de/events.ics`, PRODID `-//wp-events-plugin.com//7.4.8//EN`, 50 VEVENT, Felder `UID`, `DTSTART;TZID=Europe/Berlin`, `DTEND`, `URL`, `SUMMARY`, `DESCRIPTION`, `LOCATION` (9 von 50), `X-APPLE-STRUCTURED-LOCATION` | Plugin-Detektor ([00-bundesweit.md](00-bundesweit.md) D1); Ob das ICS bei 50 kappt, nicht belegt |
| django CMS mit Kalender-RSS | Möser | `https://www.gemeinde-moeser.de/de/feeds/kalender/`, RSS 2.0 mit Namensraum `ev:`, je Item `title` (Datum, Bindestrich, Titel, z. B. `05.12.2026 - Weihnachtsmarkt`), `link`, `description`, `pubDate` (Beginn mit Offset), `guid`, `category` („Veranstaltungen Hohenwarthe“) | Einzelfall, aber sauberster Feed der Stichprobe; Ortschaft steht in `category` |
| Zeta Producer | Flechtingen | statische Jahresliste, Datum und Text je Zeile, Ortsteile im Text | allgemeiner Parser (Stufe E) |
| WordPress My Calendar | VG Mansfelder Grund-Helbra | Plugin `my-calendar`, Kalender Oktober 2026 ohne Termin; RSS nur für Beiträge `/category/veranstaltungen/feed/` | leer, kein Wert |
| ionas ohne TVM | VG Seehausen (Altmark) | kein `data-source`, kein `events.json` | bestätigt die Einschränkung in [01-vollerhebung.md](01-vollerhebung.md) Abschnitt 3 |
| Neos (Münsmedia) | VG Flechtingen | Veranstaltungsseite ohne Inhalt | kein Wert; Münsmedia ist auch Dienstleister von SAiNT |

Nicht vorgekommen in 30 Gemeinden: Cross7, Heimat-Info/Cosmema, NOLIS, communice,
Komm.ONE, The Events Calendar, Modern Events Calendar, feratel, meinOrt, NUSSBAUM,
Riedel-Verlag (keiner der Stichprobennamen in https://www.riedel-verlag.de/de/aktuelle-ausgaben).

### 2.6 Amtsblätter

* **In der Stichprobe genannt:** „Zörbiger Bote“ (eigene Rubrik mit „Termine“), „Unterharz
  Bote“ (Harzgerode), „Goldene Aue Kurier“, „Hallo Nachbar“ (VG Arneburg-Goldbeck),
  Mitteilungsblatt der Hansestadt Seehausen („Eine liebevoll zusammengestellte Übersicht
  aller Veranstaltungen finden Sie im Mitteilungsblatt“), Amtsblatt-Module auf allen
  verwaltungsportal-Seiten (Download per POST-Formular, nicht abgeschickt). Verlage dieser
  Titel: nicht belegt (keine PDFs geöffnet; wittich.de am 29.10.2026 zweimal ohne
  Verbindung).
* **WITTICH in Sachsen-Anhalt:** Der Katalog der ULB Halle nennt „Verlag + Druck Linus
  Wittich KG“ in Herzberg als Verlag des „Amts- und Mitteilungsblatt der Stadt Südliches
  Anhalt“ (https://epflicht.bibliothek.uni-halle.de/entities/journalissue/0ee95f72-0090-4fd1-a0d1-f4d450e367b2/full).
  Laut Suchergebnis auch Amtsbote Zerbst und Amtsblatt Dessau-Roßlau (nicht einzeln
  geöffnet).
* **ULB Halle Pflichtexemplare:** PDFs anonym abrufbar, aber mit Verzug: Ausgabe 2023
  Nr. 7 mit Zugangsdatum 19.08.2025. Für aktuelle Termine ungeeignet.
* **Nächster Schritt:** keiner eigener; Sachsen-Anhalt in das bundesweite WITTICH-Gespräch
  aufnehmen ([00-bundesweit.md](00-bundesweit.md) B1).

## 3. Dorffest-Test je Quelle

| Quelle | Beispiel | Datum | Link |
|---|---|---|---|
| verwaltungsportal.de | Volksfest in Königerode (Harzgerode) | 18. bis 20.06.2027 | https://www.harzgerode.de/veranstaltungen/2943357/2027/06/18/volksfest-in-koenigerode |
| verwaltungsportal.de | Dorfglüh´n in Liederstädt, Pfingstburschenverein (Querfurt) | 05.12.2026 | https://www.querfurt.de/veranstaltungen/2870536/2026/12/05/dorfgluehn-in-liederstaedt |
| verwaltungsportal.de | Weihnachtsmarkt auf dem Schlosshof (Hötensleben) | 28.11.2026 | https://www.hoetensleben.de/veranstaltungen/index.php |
| GeoCMS 26.8.8 | Weihnachtsbaum verbrennen, Heimatverein, Kategorie „Volksfeste, Märkte“ (Teuchern) | 16.01.2027 | https://www.stadt-teuchern.de/de/veranstaltungen/event/36239,42/weihnachtsbaum-verbrennen-16-01-2027.html |
| Events Manager iCal | Weihnachtsmarkt der Freiwilligen Feuerwehr in Langeln (Nordharz) | 05.12.2026 | https://gemeinde-nordharz.de/veranstaltungskalender/ |
| django-CMS-RSS | Martinsfest des Heimatvereins Körbelitz; Weihnachtsmarkt Pietzpuhl (Möser) | 11.11., 19.12.2026 | https://www.gemeinde-moeser.de/de/feeds/kalender/ |
| iKISS | 14. Adventstreffen Löberitz (Zörbig) | 29.11.2026 | https://www.stadt-zoerbig.de/Willkommen/Veranstaltungen/14-Adventstreffen-L%C3%B6beritz.php?object=tx,3940.4.1&ModID=11&FID=3940.310.1&NavID=3940.15 |
| Zeta Producer (Jahresliste) | Traditionelles Dorffest in Böddensell (05./06.09.2026, vergangen); Adventssingen der Behnsdorfer Feuerwehr | 05.12.2026 | https://www.luftkurortflechtingen.de/veranstaltungskalender.html |
| destination.one `open-data` | Volksfest Königerode, ID `101330615`, CC-BY-SA | 18.06.2027 | `meta.et4.de` Abschnitt 4 |
| SAiNT | nicht prüfbar ohne API-Zugang | | |
| altmark.de | kein Dorffest auf Seite 1 von 15 | | https://www.altmark.de/veranstaltungen/ |
| Amtsblatt | nicht ausgewertet (POST bzw. PDF) | | |

Das Volksfest Königerode steht sowohl bei verwaltungsportal.de als auch bei
destination.one. Der bestehende Dedup muss beide Lesarten zusammenführen.

## 4. Abgleich destination.one

`experience=open-data`, `q=area:"Sachsen-Anhalt"`, Fenster 29.10.2026 bis 28.10.2027,
`limit=1000`, eine Anfrage: `status OK`, 544 Termine (die Ticketangabe 725 bezog sich auf
alle Termine ohne Fenster). Verteilung auf 52 Orte: Wernigerode 180, Thale 44,
Halberstadt 41, Freyburg 31, Quedlinburg 29, Wernigerode OT Schierke 25, Weißenfels 23,
Rest darunter. Lizenz je Datensatz: CC BY-SA 383, CC BY 108, CC0 51, PD 2.

Festarten im Titel (Wortanfang): Weihnachtsmarkt 14, Martin 5, Laternen 2, Erntedank 1
(„Erntedankfest mit Herbstmarkt“, Freyburg), Volksfest 1, Adventsmarkt 1; Kirmes,
Feuerwehr, Dorffest, Heimatfest, Schützenfest, Maibaum, Maifeuer, Osterfeuer, Sommerfest,
Kirchweih: 0.

Stichprobe: Feld `city` beginnt mit dem Gemeindenamen (erfasst auch „Harzgerode OT
Alexisbad“): **2 von 30** mit Treffer, Harzgerode 7 (u. a. „Volksfest Königerode“,
„Country meets Schlager“, „11. Großes Sommermärchen“), Benndorf 1 („Martinsfahrt mit
Laternenumzug | Mansfelder Bergwerksbahn“, 07.11.2026, ID `101301879`). Einschränkung:
Ortsteile mit eigenem Namen ohne Gemeindepräfix wären nicht erfasst; in den 544 Orten
kommt aber kein Ortsteil einer Stichprobengemeinde vor.

Die VG Unstruttal bettet die Experience `saale-unstrut-tourismus` ein (Umkreis 18 km um
Freyburg). Wie viel davon in `open-data` steht, ist für Sachsen-Anhalt nicht gemessen;
bundesweit ist `open-data` nur eine Teilmenge ([01-vollerhebung.md](01-vollerhebung.md)
Abschnitt 3).

## 5. Abdeckung (nur Stichprobenanteil)

| Kennzahl | Formel | Wert | 95 %-Intervall (Wilson) |
|---|---|---|---|
| Verwaltungsauftritt auf verwaltungsportal.de | 12 / 30 | 40 % | 25 % bis 58 % |
| GeoCMS (Gemeinde oder VG) | 6 / 30 | 20 % | 10 % bis 37 % |
| Dorffest-Beleg online für diese Gemeinde (alle Quellen) | 13 / 30 | 43 % | 27 % bis 61 % |
| davon Einheitsgemeinden | 11 / 11 | 100 % | 74 % bis 100 % |
| davon Mitgliedsgemeinden einer VG | 2 / 19 | 11 % | 3 % bis 31 % |
| Einheitsgemeinde-Kalender mit Ortsteil-Terminen | 9 / 11 | 82 % | 52 % bis 95 % |
| Termin in destination.one | 2 / 30 | 7 % | 2 % bis 21 % |
| Zuordnung der Vollerhebung bestätigt | 19 / 27 prüfbar | 70 % | |

Wilson für 12/30: z = 1,96, Mitte (0,4 + z²/60) / (1 + z²/30) = 0,416, Halbbreite
1,96 · √(0,4·0,6/30 + z²/3600) / (1 + z²/30) = 0,165. Eine Hochrechnung auf die 166
Gemeinden unter 10.000 Einwohnern ist nur als Spanne zulässig und nicht belegt. Die
Gruppen Einheitsgemeinde und VG-Mitglied sind klein; der Unterschied (11/11 gegen 2/19)
ist trotzdem deutlich, die Intervalle überschneiden sich nicht.

## 6. Priorisierte Liste für Sachsen-Anhalt

| # | Integration | Gemeinden (Beleg) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | verwaltungsportal.de (Liste + JSON-LD) | 55 von 218 (VE), 12/30 Stichprobe | Datum, Adresse mit „Gemeinde OT Ortsteil“, Veranstalter, Bild; keine Koordinaten; Serientermine einzeln | Nutzungsbedingungen nicht belegt; robots erlaubt `*` | Parser aus Thüringen übernehmen, OT-Zerlegung im Resolver; Förderverein bundesweit anfragen |
| 2 | SAiNT-API (IMG) | landesweit, Zahl der Termine nicht belegt; Quellen Outdooractive und BrainSCC | laut Schema Koordinaten, Beginn/Ende, Veranstalter, Kategorie | Daten CC laut Betreiber; API-Bedingungen verbieten Erlöse (3.1 a), Einzelvereinbarung möglich (1.3) | User: schriftliche Anfrage bei der IMG (Abschnitt 2.3), dann Konto und Dry-Run |
| 3 | GeoCMS brain-SCC (HTML) | 43 Gemeinden auf 25 Hosts (VE), 6/30 | Kategorie „Volksfeste, Märkte“, Adresse, Veranstalter; zwei Vorlagen | nicht belegt; Crawl-delay 15 | erst klären, ob über SAiNT verfügbar; sonst Parser für beide Vorlagen |
| 4 | Advantic iKISS | 26 Gemeinden (VE), 1/30 | wie bundesweit | nicht belegt | bundesweiter iKISS-Adapter |
| 5 | Plugin- und Feed-Detektor (Events Manager, RSS) | je 1/30 | iCal bzw. RSS mit Ortschaft | Gemeinde-Websites | mitlaufen lassen ([00-bundesweit.md](00-bundesweit.md) D5) |
| 6 | destination.one `open-data` | 2/30 | gut, CC-Lizenzen | offen | schon angebunden, kein eigener Schritt |
| 7 | allgemeiner Parser (Stufe E) | 1/30 (Flechtingen) | Jahreslisten mit Ortsteilen im Text | Gemeinde-Websites | über die Registry |
| | Nicht weiter verfolgen | | | | altmark.de als HTML (besser über SAiNT), Amtsblätter als PDF, ULB-Halle-Archiv (Verzug), Riedel |

**Lücken:**

* **Mitgliedsgemeinden der Verbandsgemeinden** (114 im Land, 19 in der Stichprobe): 17 von
  19 ohne belegtes Fest (3 davon nicht prüfbar). Die VG-Kalender sind leer oder dünn (Flechtingen 0, Goldene Aue
  2, Helbra 0), Arneburg-Goldbeck und Seehausen verweisen auf Tourismusportal und
  Mitteilungsblatt. Hier helfen nur Amtsblätter (PDF, WITTICH-Gespräch) oder ein Kanal,
  über den Vereine selbst melden.
* **GeoCMS-Hosts ohne Verbindung** (Wethautal, Weida-Land): erneut prüfen; ob es eine
  Sperre nach wenigen Abrufen ist, ist nicht belegt (vgem-dzf.de antwortete erst, beim
  Detailabruf dann nicht mehr).
* **Nicht belegt:** Inhalt und Umfang von SAiNT-Veranstaltungen, Verlage der meisten
  Amtsblätter, Zahl der Teilnehmer „Sachsen-Anhalt vernetzt“, Rolle der KID Magdeburg bei
  iKISS-Seiten.

## 7. Was der User selbst tun muss

1. IMG Sachsen-Anhalt (SAiNT): schriftliche Vereinbarung für die Nutzung der
   Veranstaltungsdaten auf einer werbefinanzierten Seite (Ziffer 3.1 a, 1.3 der
   Nutzungsbedingungen); Frage nach Umfang `source = 2` (BrainSCC). Danach Konto anlegen.
2. Optional brain-SCC: Listen-Export oder Feed für GeoCMS-Kalender, falls SAiNT sie nicht
   vollständig führt.
3. Förderverein (verwaltungsportal.de) und WITTICH: laufen über die bundesweiten Anfragen.

## 8. Anfragen

Alle am 29.10.2026, lesend, User-Agent `Mozilla/5.0 (compatible; lasstreffen-recherche/1.0;
+https://lasstreffen.at)`. Gemeinde- und VG-Hosts: höchstens 4 Anfragen je Host, je zuerst
robots.txt. Insgesamt rund 85 HTTP-Anfragen per curl plus Websuchen.

| Host | Anfragen | Status |
|---|---|---|
| www.destatis.de | Gemeindeverzeichnis-Auszug | 200 |
| meta.et4.de | 1 × `area:"Sachsen-Anhalt"` mit Fenster, `limit=1000` | 200 |
| 27 Gemeinde- und VG-Hosts (Tabelle Abschnitt 1) | je `/robots.txt` und Startseite bzw. Veranstaltungsseite | 200; robots.txt 404 bei gemeinde-colbitz.de, vg-flechtingen.de, seehausen-altmark.de; ohne Verbindung (000) www.vgem-wethautal.de und www.weida-land.de (je mit und ohne www, http und https) |
| www.stadt-teuchern.de | Veranstaltungsliste, 1 Detail | 200 |
| www.verbgem-unstruttal.de | Veranstaltungsseite (302 auf pages.et4.de, Inhalt der Weiterleitung gelesen) | 200 |
| www.vgem-dzf.de | 1 Detail, zweimal | 000 |
| www.harzgerode.de, www.querfurt.de | je 1 Detail (JSON-LD) | 200 |
| gemeinde-nordharz.de | `/events.ics` | 200 |
| www.gemeinde-moeser.de | `/de/feeds/kalender/` | 200 |
| www.altmark.de | `/robots.txt`, `/veranstaltungen/` | 200 |
| saint.tech | `/robots.txt`, `/de/ueber-saint`, `/de/ueber-saint-api`, `/de/nutzungsbedingungen`, `/de/events-einbetten`, `/de/datenpflege`, `/api/docs`, `/api/annotations?api-docs.json` | 200; keine API-Abfrage |
| www.brain-scc.de, www.kid-magdeburg.de | je `/robots.txt` und Startseite | 200 |
| www.sachsen-anhalt-vernetzt.de | Startseite (301 auf azubi-projekte.de) | 200 |
| www.sachsen-anhalt-tourismus.de | `/robots.txt`, `/veranstaltungen` | 404, 404 |
| www.riedel-verlag.de | `/de/aktuelle-ausgaben` | 200 |
| www.wittich.de | `/produkte/zeitungen`, zweimal | 000 |
| epflicht.bibliothek.uni-halle.de | 1 Katalogeintrag (WebFetch) | 200 |

Websuchen: SAiNT, brain-SCC/GeoCMS, „Sachsen-Anhalt vernetzt“, KID Magdeburg,
Amtsblatt-Verlage, WITTICH in Sachsen-Anhalt. Keine Formulare abgeschickt (auch nicht die
POST-Downloads der Amtsblatt-Module), keine Cookies akzeptiert, keine API mit Schlüssel
aufgerufen. Skript der Ziehung und Rohdaten liegen nur lokal im Scratchpad.
