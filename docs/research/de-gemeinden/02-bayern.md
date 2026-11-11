# Gemeindekalender Bayern (Stand 2026-10-27)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.3`. Gesucht ist, wie lasstreffen die
Feste kleiner bayerischer Gemeinden bekommt (Kirchweih/Kirta/Kärwa, Feuerwehrfeste,
Maibaum, Volksfeste, Christkindlmärkte) und welche Integrationen viele Gemeinden auf
einmal liefern. Bundesweite Anbieter stehen in [00-bundesweit.md](00-bundesweit.md) und
werden hier nur verlinkt und um die Landessicht ergänzt.

Arbeitsweise: nur lesende GET-Anfragen, keine Konten, Formulare oder Mails, robots.txt vor
jedem Gemeinde-Host gelesen. Jede Zahl stammt aus einer eigenen Antwort vom 27.10.2026 oder
aus einer verlinkten Seite. „Eigenangabe“ heißt Werbeaussage des Betreibers. Alle Anfragen
und die Rohnotizen je Gemeinde: [02-bayern-anfragen.md](02-bayern-anfragen.md).

## Kurzfazit

1. **Kleine bayerische Gemeinden veröffentlichen fast immer selbst.** In der Zufallsstichprobe
   (30 Gemeinden unter 10.000 Einwohnern) ist der Hauptfundort 18 Mal die eigene Website,
   3 Mal der Kalender der Verwaltungsgemeinschaft, 4 Mal das Mitteilungsblatt als PDF,
   2 Mal eine Tourismusdatenbank, 2 Mal Heimat-Info und einmal nirgends. 20 von 30 haben
   einen maschinenlesbaren Weg (API, iCal, RSS, REST oder JSON-LD). Bei 24 von 30 ist ein
   konkretes Fest belegt.
2. **Kein Anbieter deckt Bayern allein ab, aber vier tragen zusammen gut die Hälfte.**
   Heimat-Info (5 von 30 mit Terminen in der API, landesweit 507 Einträge selbst gezählt),
   communice web von inixmedia (5 von 30 mit Terminen, neu gegenüber dem Vorbericht,
   Eigenangabe „500 Installationen in Deutschland“), RCE-Event (4 von 30, neu als
   Gemeinde-Generic) und das WordPress-Plugin The Events Calendar (3 von 30). Zusammen
   16 verschiedene Gemeinden, also 16 / 30 = 53 % der Stichprobe.
3. **destination.one deckt kleine bayerische Gemeinden kaum ab.** 6 von 30 Gemeinden haben
   im Fenster 27.10.2026 bis 27.10.2027 mindestens einen Treffer, fast nur Tourismusorte
   (Bad Hindelang 100, Flintsbach 11, Pappenheim 9, Nonnenhorn 7). Die Dorffeste der
   Gemeinde fehlen dort meist: Pappenheims „4. Bieswanger Weihnachtsmarkt“ und Flintsbachs
   „Adventsmarkt am Rathaus“ stehen nur im Gemeindekalender.
4. **BayernCloud steckt schon in destination.one.** In einer Probe von 500 Bayern-Events aus
   `open-data` tragen 358 die Quelle `DataCycleProxy` mit
   `"url": "https://data.bayerncloud.digital/api/v4"`. Die BayernCloud selbst verlangt einen
   Token (401 laut Vorbericht) und sperrt per robots.txt alles; ein direkter Anschluss brächte
   nach dieser Probe vor allem dieselben Tourismusdaten.
5. **Die Lizenzfrage ist auch in Bayern der Engpass**, aber die Partner sind kleiner und
   regionaler als bundesweit: neben WITTICH (Heimat-Info) sind es inixmedia (communice) und
   RCE Medien (RCE-Event). Bei RCE ist der zentrale Host per robots.txt gesperrt, die
   Gemeinde-Subdomains erlauben den Abruf.
6. **Die Zuordnung der Vollerhebung ist für Bayern zu optimistisch und an einigen Stellen zu
   vorsichtig.** [01-vollerhebung.md](01-vollerhebung.md) (28.10.2026) zählt für Bayern 88 %
   erreicht. In dieser Stichprobe ordnet sie 27 von 30 einer Integration zu; mit Terminen
   lesbar sind nach Handprüfung 20. Heimat-Info-Mitgliedschaft heißt nicht, dass Termine in
   der API stehen (Buttenheim, Riekofen: 0), und einige als tx_news, verwaltungsportal oder
   DigiPublica geführte Seiten haben keinen Kalender mit Terminen. Umgekehrt stehen
   Hohenpeißenberg, Pappenheim und Oberpöring dort als Rest, obwohl sie gefüllte Kalender
   haben. Details im Abschnitt „Abgleich mit der Vollerhebung“.

## Stichprobe

**Ziehung.** Quelle: Destatis-Gemeindeverzeichnis-Auszug, Stichtag 30.09.2026
(`AuszugGV3QAktuell.xlsx`, Blatt `Onlineprodukt_Gemeinden30092026`). Regel: Satzart 60, Land 09,
ohne gemeindefreie Gebiete (Textkennzeichen 66, 161 Zeilen), ergibt 2.056 Gemeinden (wie im
Epic). Davon Bevölkerung (31.12.2025) unter 10.000: 1.825. Liste nach AGS sortiert, dann
`random.Random(20261027).sample(liste, 30)` mit Python 3.14.2. 14 der 30 gehören zu einer
Verwaltungsgemeinschaft (Satzart 50, Textkennzeichen 54; in ganz Bayern 979 von 1.825).

Spalten: Fundort = Hauptfundort der Veranstaltungen; d.one = Treffer in destination.one
`open-data`, `q=city:"<Gemeinde>"`, Fenster 27.10.2026 bis 27.10.2027 (Syntax siehe
[00-bundesweit.md, Abschnitt G](00-bundesweit.md#g-abgleich-destinationone)).

| Nr | Gemeinde | AGS | EW | Fundort | CMS/Plattform (Gemeinde / VGem) | Link | d.one |
|---|---|---|---|---|---|---|---|
| 1 | Flintsbach a.Inn | 09187131 | 2.924 | Gemeinde-Website | WordPress + RCE-Event (Kunde 1428) | https://veranstaltungen.flintsbach.de/flintsbach/ | 11 |
| 2 | Stammham | 09176161 | 4.159 | Gemeinde-Website | Cosmema-WordPress `townhall` (Heimat-Info-Daten) | https://www.stammham.de/veranstaltungen/ | 0 |
| 3 | Nonnenhorn | 09776120 | 1.779 | Gemeinde-Website | Canvayo, JS-Kalender plus PDF | https://www.nonnenhorn.de/termine-und-feste-im-ueberblick/ | 7 |
| 4 | Pullach i.Isartal | 09184139 | 8.545 | Gemeinde-Website | WordPress + RCE-Event (Kunde 1111) | https://veranstaltungen.pullach.de/pullach-i-isartal/ | 0 |
| 5 | Hohenpeißenberg | 09190130 | 3.845 | Gemeinde-Website | TYPO3 communice | https://www.hohenpeissenberg.de/freizeit-erholung/veranstaltungen/veranstaltungskalender | 0 |
| 6 | Pappenheim, St | 09577158 | 3.934 | Gemeinde-Website | TYPO3 events2 | https://www.pappenheim.de/stadt-ortsteile/veranstaltungen/kalender/ | 9 |
| 7 | Böbing | 09190117 | 1.911 | Gemeinde-Website | WordPress The Events Calendar / VGem Rottenbuch RCE-Event | https://www.boebing.de/veranstaltungen/ | 0 |
| 8 | Kastl | 09377128 | 1.468 | Amtsblatt | TYPO3 `c3_planer`, Kalender leer / VGem Kemnath destination.one-Widget | KEM-Journal auf https://www.kastl-kem.de/ | 0 ¹ |
| 9 | Pürgen | 09181141 | 3.740 | Amtsblatt (dazu Heimat-Info) | TYPO3 (abavo), Termine leer / VGem ebenso | https://www.puergen.de/gmoa-blattl/ | 0 |
| 10 | Painten, M | 09273159 | 2.313 | Gemeinde-Website (Jahres-PDF) | Cosmema-WordPress `townhall` | https://www.painten.de/wp-content/uploads/2026/10/Veraka2026-26.10.2026.pdf | 0 |
| 11 | Bergkirchen | 09174113 | 7.636 | Gemeinde-Website | Umbraco akdb.digitalfabriX + RCE-Event-Iframe (Kunde 1248) | https://www.bergkirchen.de/aktuelles-aus-bergkirchen/veranstaltungen/ | 0 |
| 12 | Odelzhausen | 09174135 | 5.727 | Gemeinde-Website | WordPress + RCE-Event-Iframe (Kunde 1255) | https://www.odelzhausen.de/aktuelles/veranstaltungen | 0 |
| 13 | Grafengehaig, M | 09477117 | 840 | Gemeinde-Website | TYPO3 calendarize, gleiche Daten wie VGem Marktleugast | https://www.grafengehaig.de/freizeit-tourismus/veranstaltungen/alle-veranstaltungen | 0 |
| 14 | Gerach | 09471133 | 1.039 | VGem-Kalender | keine eigene Seite / VGem Baunach TYPO3 communice | https://www.vg-baunach.de/freizeit-tourismus/veranstaltungen/veranstaltungskalender | 0 |
| 15 | Buttenheim, M | 09471123 | 3.680 | Gemeinde-Website | TYPO3 communice | https://www.buttenheim.de/freizeit-tourismus/veranstaltungen | 0 |
| 16 | Seukendorf | 09573126 | 3.124 | Gemeinde-Website | WordPress-Multisite der VGem Veitsbronn, The Events Calendar | https://seukendorf.de/veranstaltungskalender/ | 0 |
| 17 | Nesselwang, M | 09777153 | 3.749 | Tourismusdatenbank | Contao + Feratel Deskline DW5 (`NESSELWANG`) | https://www.nesselwang.de/veranstaltungskalender-nesselwang.html | 1 |
| 18 | Buxheim (Lkr. Eichstätt) | 09176118 | 3.771 | Gemeinde-App | Cosmema-WordPress, Heimat-Info-Iframe | https://www.buxheim.eu/veranstaltungskalender/ | 0 |
| 19 | Mittelstetten | 09179137 | 1.691 | VGem-Kalender | open2c (kinetiqa) der VGem Mammendorf | https://www.mittelstetten.de/veranstaltungen-mittelsetten | 0 |
| 20 | Holzkirchen (Lkr. Würzburg) | 09679149 | 945 | nirgends | Neos DigiPublica, kein Kalender / VGem Helmstadt ebenso | https://www.holzkirchen-ufr.de/ | 0 |
| 21 | Wattendorf | 09471209 | 644 | Amtsblatt | verwaltungsportal, Kalender leer / VGem Steinfeld ebenso | https://www.steinfeld-oberfranken.de/amtsblatt/index.php | 0 |
| 22 | Aham | 09274112 | 1.937 | Gemeinde-App | Open2C (Kinetiqa) mit Heimat-Info-Iframe / VGem Gerzen ebenso | https://www.gemeinde-aham.de/veranstaltungen-aham | 0 |
| 23 | Haunsheim | 09773137 | 1.583 | Gemeinde-Website | WordPress The Events Calendar Pro | https://haunsheim.de/termine/ | 2 |
| 24 | Ködnitz | 09477127 | 1.469 | Amtsblatt | verwaltungsportal, statisch / VGem Trebgast ohne Kalender | https://daten.verwaltungsportal.de/dateien//publication/3/0/3/3/2/KO_NA_10_2026_web.pdf | 0 |
| 25 | Adelzhausen | 09771111 | 1.875 | Gemeinde-Website | TYPO3 communice | https://www.adelzhausen.de/leben-erleben/freizeit-kultur/veranstaltungskalender | 0 |
| 26 | Bad Hindelang, M | 09780123 | 5.039 | Tourismusdatenbank | Feratel Deskline TOSC5 (`ALLGAUHIND`); Markt-Website communice | https://www.badhindelang.de/veranstaltungskalender | 100 |
| 27 | Bergrheinfeld | 09678115 | 5.208 | Gemeinde-Website (Jahres-PDF) | TYPO3 tx_news | https://bergrheinfeld.de/fileadmin/user_upload/Downloadcenter/Infomaterial_und_Broschueren/2026_Veranstaltungskalender.pdf | 0 |
| 28 | Oberpöring | 09271139 | 1.205 | VGem-Kalender | Contao der VGem Oberpöring | https://vg-oberpoering.de/vereine-veranstaltungen | 0 |
| 29 | Neuburg a.Inn | 09275133 | 4.473 | Gemeinde-Website | TYPO3 communice | https://www.neuburg-am-inn.de/neuburg-erleben/kultur-und-veranstaltungen/veranstaltungskalender | 0 |
| 30 | Riekofen | 09375191 | 806 | Gemeinde-Website (Jahres-PDF) | Umbraco akdb.digitalfabriX / VGem Sünching ebenso | https://www.gemeinde-riekofen.de/media/100726/veranstaltungskalender-2026-2027.pdf | 0 |

¹ `city:"Kastl"` liefert 10 Treffer, alle mit PLZ 92280 (Markt Kastl, Lkr. Amberg-Sulzbach),
keiner mit 95506. Kastl im Lkr. Tirschenreuth hat damit 0. Bei den übrigen Treffern stimmt die
PLZ mit der Gemeinde überein.

Zu Nonnenhorn: Die robots.txt sperrt `User-agent: *` und gibt benannte Bots frei, darunter
`Claude-User`. Die Seite wurde deshalb nur über WebFetch (Claude-User) gelesen, nicht per curl.

## Generics

Bewertung wie im Vorbericht: hoch = eine Integration liefert viele Gemeinden in festen Feldern.
„Stichprobe“ zählt Gemeinden, bei denen das Merkmal auf dem Weg zu ihren Terminen vorkommt.

| Kandidat | Betreiber | Stichprobe | Gemeinden (Beleg) | Zugriff | Lizenz/robots | Generic |
|---|---|---|---|---|---|---|
| Heimat-Info | Cosmema WITTICH GmbH | 7 gelistet, 5 mit Terminen | 507 bayerische Einträge (selbst gezählt) | offene JSON-API | keine Regel für Dritte | hoch |
| communice web | inixmedia GmbH | 6 Merkmal, 5 mit Terminen | „500 Installationen in Deutschland“ (Eigenangabe); Vollerhebung Bayern 88 | iCal je Liste oder Termin, RSS | keine robots.txt, AGB nicht belegt | mittel bis hoch |
| RCE-Event | RCE Medien GmbH & Co. KG | 4 (dazu VGem Rottenbuch) | Vollerhebung Bayern 37; Kundennummern bis 1438 sind Kennungen, keine Zählung | vCalendar je Termin | Subdomains erlaubt, zentraler Host gesperrt | mittel, mit Vertrag hoch |
| The Events Calendar | WordPress-Plugin | 3 | Vollerhebung Bayern 67 | REST + iCal | je Gemeinde | mittel |
| destination.one / BayernCloud | hubermedia / BayTM | 6 mit Treffern | 8.717 Bayern-Events im Fenster (eigene Anfrage) | offene JSON-API | CC-BY, CC-BY-SA in der Probe | hoch für Tourismus, niedrig für Dorffeste |
| Feratel Deskline | feratel | 2 | Vollerhebung Bayern 24 (Untergrenze, siehe Abgleich) | Deskline-API (in lasstreffen schon angebunden) | wie Österreich | mittel, nur Tourismusorte |
| open2c | kinetiqa GmbH | 2 | Vollerhebung Bayern 57 | iCal, RSS je VGem | robots `Allow: /` | mittel |
| verwaltungsportal.de | Förderverein für regionale Entwicklung e.V. | 2, beide Kalender leer | Vollerhebung Bayern 95 (Obergrenze) | HTML + JSON-LD | siehe Vorbericht C7 | niedrig in Bayern |
| akdb.digitalfabriX | AKDB-Tochter | 2, kein Kalendermodul gesehen | nicht belegt | entfällt | entfällt | niedrig |
| Cross7, iKISS, NOLIS | siehe Vorbericht | 0 | Vollerhebung Bayern: Cross7 33, iKISS 21 | | | in der Stichprobe nicht vorgekommen |

### Heimat-Info (Landessicht)

Anbieter, API und Felder: [00-bundesweit.md, A1](00-bundesweit.md#a1-heimat-info). Neu hier:

* **Bayernanteil, selbst gezählt:** `communes/search` lieferte 648 Einträge. Jeden Eintrag der
  nächstgelegenen Gemeinde des Destatis-Verzeichnisses zugeordnet (Mittelpunktkoordinaten):
  602 Einträge liegen in Bayern, davon 507 ohne `parentCommuneId` (Hauptkommunen); 5 Einträge
  haben keine Koordinate. 93 der 507 führen einen externen Kalender
  (`externalEventsCalendarUrl`). Ein Eintrag kann auch eine VGem sein; die Zahl der Gemeinden
  ist also nicht genau 507.
* **In der Stichprobe:** 7 von 30 gelistet (Stammham, Pürgen, Buttenheim, Buxheim, Aham,
  Adelzhausen, Riekofen). Termine ab 27.10.2026 in der API: Aham 25, Stammham 22, Buxheim 20,
  Adelzhausen 6, Pürgen 5, Buttenheim 0, Riekofen 0. Auf der Gemeinde-Website eingebunden:
  Stammham (Cosmema-Plugin `townhall`, serverseitig), Buxheim (Iframe im Borlabs-Blocker),
  Aham (Iframe, die VGem Gerzen bindet vier Kommunen mit mehreren `c=` ein). Pürgen kündigt im
  „'s Gmoa-Blattl“ 10/2026 den Wechsel zur App an und bittet die Vereine, ihre Termine dort
  einzustellen. Anteil mit Terminen: 5 / 30 = 17 %. Die Vollerhebung führt 532 bayerische
  Gemeinden als `heimatinfo`; nach der Stichprobe hat ein Teil davon keine Termine in der API.
* **Inhalt:** fast nur Vereinstermine, also genau die gesuchte Ebene. Beispiele siehe
  Dorffest-Test. Aham zeigt auch Termine aus Nachbarorten („Volksfest Gerzen“, Skifahrten).
* **modbox.cosmema.de:** Der externe Kalender von Adelzhausen
  (`https://modbox.cosmema.de/live/adelzhausen/GV49YWXXDZ`) liefert eine Ladeseite mit dem Titel
  „Hier gelangen Sie zum Veranstaltungskalender“ ohne Termine im HTML. Adelzhausen selbst führt
  seine Termine in communice.

### communice web (inixmedia GmbH), neu

* **Betreiber:** inixmedia GmbH, Schwentinental, Standorte u. a. Hamburg und Bamberg
  (https://www.inixmedia.de/impressum/). communice.de leitet auf
  https://www.inixmedia.de/communice-web/ um: „communice web, CMS für kommunale Website- &
  Intranetprojekte“, Eigenangabe „500 Installationen in Deutschland“. Referenzen auf der Seite
  u. a. Stadt Stein, Markt Markt Erlbach, Gemeinde Ottobrunn (Bayern) und Itzehoe, Amt
  Mittelholstein, Reinbek (SH). Zahl der bayerischen Kunden: nicht belegt.
* **In der Stichprobe:** Hohenpeißenberg, Gerach (über VGem Baunach), Buttenheim, Adelzhausen,
  Neuburg a.Inn mit Terminen; Markt Bad Hindelang mit leerem Vereinskalender. Außerhalb der
  Stichprobe gesehen: Dasing. 5 / 30 = 17 % mit Terminen.
* **Erkennung:** `typo3conf/ext/communice_*`, `communicecalendar`, `communice_instance`,
  Cookies `communice_consent_*`, `matomo01.communice.de`.
* **Zugriff:** iCal der Liste unter
  `…/ical-download?tx_communicecalendar_calendar[action]=ical&…[controller]=Event&…[eventlist]=<IDs>&cHash=…`
  (Link mit cHash von der Listenseite übernehmen), iCal je Termin, RSS (Hohenpeißenberg). Seiten
  mit Teaser tragen inline `var eventArray` (`link`, `title`, `start`, `end`, `date`,
  `humandate`, `humantime`). Detail-URL `/veranstaltung/<slug>/<JJJJ-MM-TT>`. Kein JSON-LD.
* **Echte iCal-Felder:** `UID`, `DTSTAMP`, `DTSTART`, `DTEND`, `SUMMARY`, `LOCATION`; kein
  `DESCRIPTION`, kein `TZID`. Befunde: In Adelzhausen liegt `DTEND` vor `DTSTART`
  (`20261212T160000` bis `20261212T000000`); in Buttenheim nur `VALUE=DATE` und `DTEND` ist der
  letzte Tag selbst (nach RFC 5545 exklusiv, Ende also einen Tag zu früh). Ein Import muss
  Uhrzeit und Ende aus der Detailseite oder dem `eventArray` nehmen. Die VGem-Liste nennt die
  Mitgliedsgemeinde und eine Kategorie. RSS der VGem Baunach antwortete mit 500.
* **robots/Lizenz:** keine robots.txt auf den vier geprüften Gemeinde-Hosts (404). AGB oder
  Nutzungsbedingungen für Dritte: nicht belegt.
* **Gemeinde-Beispiele:** Adelzhausen, Buttenheim, Neuburg a.Inn (Links in der Stichprobe).

### RCE-Event (RCE Medien GmbH & Co. KG), in Bayern ein Generic

* **Betreiber:** `PRODID:-//RCE Medien GmbH & Co. KG//RCE-Event//DE` in der vCalendar-Probe,
  Logo-Link http://www.rce.de/. Im Vorbericht nur beim Landkreis München
  ([00-bundesweit.md, E](00-bundesweit.md#e-landkreis--und-regionalkalender)). Zahl der Kunden:
  nicht belegt. Das WordPress-Plugin „rce-event“ wurde laut wordpress.org am 03.12.2025
  geschlossen.
* **In der Stichprobe:** Flintsbach (1428) und Pullach (1111) mit eigener Subdomain
  `veranstaltungen.<gemeinde>.de`, Bergkirchen (1248) und Odelzhausen (1255) als Iframe von
  `www.rce-event.de/output.php?id=<Kunde>&mode=L`, Bergkirchen mit `gembox=9174113` (AGS ohne
  führende Null). Dazu VGem Rottenbuch (1438). 4 / 30 = 13 %. Der AGS-Parameter spricht für eine
  zentrale Datenbank mit Gemeindefilter; selbst geprüft ist das nicht.
* **Zugriff:** Detail `/<Kunde>/<ort>/<slug>-e<hash>.html`, vCalendar je Termin
  `output.php?mode=vcs&hid=<hash>&id=<Kunde>`. Felder: `TZID`, `DTSTART`, `DTEND` (Wandzeit),
  `UID`, `DTSTAMP`, `LOCATION` (Ort, Gemeinde), `DESCRIPTION`, `URL`, `SUMMARY`; Inhalt Latin-1
  trotz `charset=utf-8`. Die Detailseite nennt zusätzlich Veranstaltungsort mit Straße und PLZ,
  Veranstalter mit Adresse und „Quelle: Gemeinde …“. Kein JSON-LD, kein Listen-Feed gefunden.
* **robots:** Gemeinde-Subdomains sperren nur `/export/`, `/import/` u. ä., `output.php` ist
  erlaubt. `www.rce-event.de` lieferte einer Gruppe `User-agent: *`, `Disallow: /`,
  `Allow: /veranstaltungen/` (Rohnotiz Gruppe b); spätere Abrufe der Hauptsession bekamen 444.
  Die Iframes von Bergkirchen und Odelzhausen sind damit gesperrt und wurden nicht abgerufen.

### The Events Calendar und weitere Einzel-CMS

* **The Events Calendar:** Böbing, Seukendorf (Multisite der VGem Veitsbronn), Haunsheim (Pro).
  Felder wie im Vorbericht D1. Befunde: viele Termine von 00:00 bis 23:59:59 mit der Uhrzeit nur
  im Titel („Beginn: 14:00“), `venue` und `organizer` oft leer (Böbing alle 32), Hallenbelegungen
  als Kategorie „Geschlossene Gesellschaft“ (Haunsheim). 3 / 30 = 10 %.
* **open2c (kinetiqa GmbH), neu:** VGem Mammendorf für alle Mitgliedsgemeinden und VGem Gerzen
  (dort mit Heimat-Info). Merkmal Generator `open2c - kinetiqa GmbH - www.kinetiqa.de`, `/plugins/eventcalendar/`.
  Exporte `export_ical.php?idlist=`, `export_events.php?idlist=`, `rss.php?id=2` (Termine der
  ganzen VGem, 100 Einträge, ohne Gemeindefeld). iCal-Felder `ORGANIZER;CN`, `DTSTART`,
  `DTEND`, `URL`, `SUMMARY`, `DESCRIPTION`, `LOCATION`; Uhrzeit aus dem HTML fehlt im iCal
  (`VALUE=DATE`). Ein Feed je VGem liefert mehrere Gemeinden: im RSS der VGem Mammendorf stehen
  auch „Dorffest Burschenverein Oberschweinbach am Maibaum“ und „Dorffest der FFW Günzlhofen“.
* **Mit JSON-LD oder ICS je Termin:** TYPO3 events2 (Pappenheim: `startDate`, `endDate`,
  `name`, `location.address`, `organizer.name`, dazu .ics), TYPO3 calendarize (Grafengehaig und
  VGem Marktleugast, ICS mit `UID`, `DTSTART` in UTC, `SUMMARY`, `DESCRIPTION`, `LOCATION`),
  Contao (VGem Oberpöring, JSON-LD nur `name`, `startDate`, `url`). Das ist das Gegenstück zum
  `GenericGemeindeScraper`: je Seite eine Kalender-URL, gemeinsamer Parser je CMS.

### destination.one und BayernCloud

* **Abdeckung:** 6 / 30 = 20 % der Stichprobe mit mindestens einem Treffer (Tabelle oben). Alle
  sechs sind Tourismusorte. Gemeindefeste fehlen meist (Pappenheim, Flintsbach siehe
  Kurzfazit); Nonnenhorn hat „Weihnachtsmärktle“ und „Winzerfest Nonnenhorn“ in beiden Quellen.
* **Herkunft:** In der Probe `q=area:"Bayern"`, `offset=1000`, `limit=500` (Gesamt im Fenster
  8.717): 358 × Quelle `DataCycleProxy` (BayernCloud), 142 × `destination.one`. In den 30
  Gemeindeabfragen kamen alle Treffer bis auf einen über `DataCycleProxy`. Lizenz in der Probe
  362 × `CC-BY`, 138 × `CC-BY-SA` (Vorbericht: anderswo `CC0`). Kategorien u. a.
  „Weihnachtsmärkte“ 78, „Brauchtum/Kultur“ 50. Bad Hindelang trägt `tz: Europe/Vienna`; der
  Offset stimmt, die Zeitzonenangabe muss ein Import aber ignorieren.
* **BayernCloud direkt:** API nur mit Token (Vorbericht), `data.bayerncloud.digital/robots.txt`
  `Disallow: /`. Ein Abgleich je Gemeinde ist ohne Konto nicht möglich. Das öffentliche Portal
  bayern.by leitet auf erlebe.bayern um; der Kalender `veranstaltungen.erlebe.bayern` antwortete
  automatisierten Abrufen mit 444. Nach der Probe oben enthält destination.one die offenen
  BayernCloud-Events bereits; nicht offene Daten dürfen laut AGB § 14 nur zur touristischen
  Vermarktung genutzt werden (Vorbericht). Damit ist ein eigener BayernCloud-Anschluss für
  Dorffeste nicht nötig.

### Landkreise, Kirche, Vereine

* **Kirchweihkalender der fränkischen Landkreise:** Das Landratsamt Roth veröffentlicht einen
  Kirchweihkalender als PDF, gefunden die Ausgaben 2023 und 2024 (Websuche, z. B.
  https://landratsamt-roth.de/uwao-api/web/files/bypath/Subportal%20-%20Freizeit%20%26%20Tourismus/Bilder%20und%20Dateien%20-%20Prospekte%20und%20Publikationen/LRG24042_Kirchweihkalender_WEB.pdf ;
  nicht abgerufen). Für Erlangen-Höchstadt und Neustadt a.d.Aisch-Bad Windsheim nennen nur
  Einträge auf festivalsindeutschland.de eine amtliche Kirchweihübersicht 2026; selbst gesehen:
  nicht belegt. Die Stadt Nürnberg führt `kirchweihtermine2026.pdf`
  (https://www.nuernberg.de/imperia/md/liegenschaftsamt/dokumente/la_4/kirchweihtermine2026.pdf,
  Websuche). Kreiskalender in der Stichprobe: Landkreis Dachau keiner gefunden; Bergrheinfeld
  verweist auf tourismus.schweinfurt.de und https://www.fraenkischer-weinfestkalender.de/ (nicht
  geprüft).
* **Evangelische Termine (ELKB):** Anbieter und Lizenzlage im Bericht
  `docs/research/deutschland-event-quellen-2026-10.md` (Abschnitt 8). `xml?q=Kirchweih`
  liefert 129 Einträge, in der ersten Seite durchweg Kirchweih-Gottesdienste mit Ort, Datum und
  Koordinate (`_event_GLAT`, `_event_GLONG`), z. B. „Gottesdienst zur Kirchweih“, Ottowind,
  31.10.2026 19:00 (`_event_ID` 3016321). Das Fest selbst steht dort nicht, aber das Datum der
  Kirchweih eines Dorfes. Nur evangelische Gemeinden, also vor allem Franken.
* **Feuerwehren:** LFV-Website-Kit siehe Vorbericht F (niedrig). In der Stichprobe nur als Link
  (flintsbach.feuerwehren.bayern, nicht abgerufen).
* **Gemeinde-Apps ohne zentrale Daten:** „Boin-App“ (Painten), „Zeigmal. App“ (Nonnenhorn),
  eigene App Seukendorf; Anbieter und Zugang nicht belegt.

## Dorffest-Test

Je Quelle ein belegtes Beispiel (vollständige Liste je Gemeinde im Anhang).

| Quelle | Gemeinde | Fest | Datum | Beleg |
|---|---|---|---|---|
| Heimat-Info API | Buxheim | „155 Jahre Freiwillige Feuerwehr“, Festplatz am Feuerwehrhaus | 25.06.2027 | https://www.heimat-info.de/veranstaltungen/5a589d51-b8f0-43c6-ad36-ad9aa13acff4 |
| Heimat-Info API | Pürgen | „Weinfest“, Mehrzweckhalle Lengenfeld | 07.11.2026 | https://www.heimat-info.de/veranstaltungen/6e957dec-272c-4199-8171-9054a91c51ba |
| Heimat-Info Embed | Aham | „Ahamer Adventsmarkt mit großer Tombola“ | 28.11.2026 | https://www.gemeinde-aham.de/veranstaltungen-aham |
| communice | Adelzhausen | „Christkindlmarkt“ der KLJB | 12.12.2026 | https://www.adelzhausen.de/leben-erleben/freizeit-kultur/veranstaltungskalender/veranstaltung/christkindlmarkt/2026-12-12?cHash=c98f3bff8b2c33d27b38e185d5220773 |
| communice | Neuburg a.Inn | „Sommerfest der FF Höch-Fürstdobl“ | 07.08.2027 | https://www.neuburg-am-inn.de/neuburg-erleben/kultur-und-veranstaltungen/veranstaltungskalender/veranstaltung/sommerfest-der-ff-hoech-fuerstdobl/2027-08-07?cHash=7e0ff3e67d1cff36d1701b8f8cd9e648 |
| communice (VGem) | Gerach | Kirchweih „am 4. Sonntag im Juni“, nur Regel, kein Datum | | https://www.vg-baunach.de/freizeit-tourismus/veranstaltungen/kirchweihen/kirchweih-gerach |
| RCE-Event | Flintsbach | „Adventsmarkt am Rathaus“ | 28.11.2026 | https://veranstaltungen.flintsbach.de/1428/flintsbach-ainn/adventsmarkt-am-rathaus-e0f2f3b1486ad0696dd5048652e45607a.html |
| RCE-Event | Pullach | „Fahnenweihe“ der Soldatenkameradschaft; „Kirta-Café der Senioren Union“ 27.10.2026 | 30.10.2026 | https://veranstaltungen.pullach.de/pullach-i-isartal/fahnenweihe-e91a72e911fd468274ccadf8bd7feeb2f.html |
| The Events Calendar | Haunsheim | „Maifeiern in beiden Ortsteilen FFW Haunsheim und FFW Unterbechingen“ | 30.04.2026 | https://haunsheim.de/termin/maifeiern-in-beiden-ortsteilen-ffw-haunsheim-und-ffw-unterbechingen/ |
| The Events Calendar | Seukendorf | „Adventsmarkt Seukendorf“ | 06.12.2026 | https://seukendorf.de/event/adventsmarkt-seukendorf/ |
| open2c | Mittelstetten | „Adventsmarkt“, Glonnquell Schützen und Ländlicher Garten | 28.11.2026 | https://www.mittelstetten.de/veranstaltungen-mittelsetten |
| TYPO3 events2 | Pappenheim | „4. Bieswanger Weihnachtsmarkt“ | 29.11.2026 | https://www.pappenheim.de/stadt-ortsteile/veranstaltungen/kalender/detail/event/d/s/ts/2026-11-29/1400/t/4-bieswanger-weihnachtsmarkt-1364.html |
| TYPO3 calendarize | Grafengehaig | „2. Grafengehaiger Weihnachtsmarkt“ | 19.12.2026 | https://www.grafengehaig.de/freizeit-tourismus/veranstaltungen/alle-veranstaltungen |
| Contao | Oberpöring | „Gneidinger Kirta“ | 25.10.2026 | https://vg-oberpoering.de/eventleser-3/gneidinger-kirta-11-00-uhr |
| Feratel / Gemeindeliste | Nesselwang | „16. Nesselwanger Adventsmarkt“ | 12.12.2026 | https://www.nesselwang-buergerservice.de/termine-und-veranstaltungen.html |
| destination.one | Bad Hindelang | Feuerwehrfest zu 150 Jahren FF Vorderhindelang (Termine u. a. 18.06.2027) | 18.06.2027 | `id` 449499f3-54e4-49c5-bd49-a298d53e5c8f |
| destination.one | Nonnenhorn | „Winzerfest Nonnenhorn“ | 13.08.2027 | Abfrage `city:"Nonnenhorn"` |
| Jahres-PDF | Painten | Kirchweih Maierhofen; Maibaumfest 25.04.2026; Weihnachtsmarkt 28.11.2026 | 09.08.2026 | https://www.painten.de/wp-content/uploads/2026/10/Veraka2026-26.10.2026.pdf |
| Jahres-PDF | Bergrheinfeld | „Kirchweih“ am Festplatz Holderhecke; Feuerwehrfest 18.07.2026 | 21. bis 24.08.2026 | https://bergrheinfeld.de/fileadmin/user_upload/Downloadcenter/Infomaterial_und_Broschueren/2026_Veranstaltungskalender.pdf |
| Jahres-PDF | Riekofen | „FF Riekofen: Sommerfest am Gerätehaus“; Maibaumaufstellen Taimering 30.04.2026 | 28.06.2026 | https://www.gemeinde-riekofen.de/media/100726/veranstaltungskalender-2026-2027.pdf |
| Mitteilungsblatt | Ködnitz | „TSV Ködnitz, Weihnachtsmarkt auf der TSV Sportanlage“ | 06.12.2026 | https://daten.verwaltungsportal.de/dateien//publication/3/0/3/3/2/KO_NA_10_2026_web.pdf |
| Mitteilungsblatt | Pürgen | Fahrzeugsegnung HLF 10 der Feuerwehr Lengenfeld mit Festzug | 11.10.2026 | „'s Gmoa-Blattl“ 10/2026, https://www.puergen.de/gmoa-blattl/ |
| ELKB | Ottowind | „Gottesdienst zur Kirchweih“ | 31.10.2026 | `_event_ID` 3016321, `xml?q=Kirchweih` |

Nicht bestanden: Hohenpeißenberg (Kalender, RSS, iCal, Websuche), Odelzhausen (Kalender
gesperrt), Kastl (nur „Erntedankfest Kastl“ 2025 auf https://www.erntedankfest-kastl.de/),
Gerach (nur Regel), Holzkirchen (nur festivalsindeutschland.de: „130 Jahre FFW Holzkirchen &
Sportfest“ 17. bis 19.07.2026, AGB verbieten die Nutzung), Wattendorf (beide Kalender leer).
Bestanden: 24 / 30 = 80 %.

## Abdeckung (nur als Stichprobenanteil)

Formel jeweils: Gemeinden mit Merkmal / 30 Stichprobengemeinden. Die Stichprobe ist klein; ein
Anteil von 5 / 30 hat bei dieser Größe eine weite Unsicherheit und ist nur als Größenordnung
zu lesen.

| Merkmal | Gemeinden | Anteil |
|---|---|---|
| Hauptfundort eigene Website | 18 | 60 % |
| Hauptfundort VGem-Kalender | 3 (Gerach, Mittelstetten, Oberpöring) | 10 % |
| Hauptfundort PDF (Mitteilungsblatt oder Jahreskalender) | 7 (Kastl, Pürgen, Wattendorf, Ködnitz, Painten, Bergrheinfeld, Riekofen) | 23 % |
| maschinenlesbarer Weg mit Terminen | 20 (1, 2, 4, 5, 6, 7, 9, 13, 14, 15, 16, 17, 18, 19, 22, 23, 25, 26, 28, 29) | 67 % |
| Heimat-Info mit Terminen | 5 | 17 % |
| communice mit Terminen | 5 | 17 % |
| RCE-Event | 4 | 13 % |
| The Events Calendar | 3 | 10 % |
| Heimat-Info, communice, RCE-Event oder Tribe (ohne Doppelzählung) | 16 | 53 % |
| destination.one mindestens ein Treffer | 6 | 20 % |
| Feratel Deskline | 2 | 7 % |
| Dorffest belegt (irgendeine Quelle) | 24 | 80 % |

Doppelzählung: Adelzhausen steht bei Heimat-Info und communice und zählt einmal. Die 16 sind
Stammham, Pürgen, Buxheim, Aham, Adelzhausen (Heimat-Info), Hohenpeißenberg, Gerach,
Buttenheim, Neuburg a.Inn (communice), Flintsbach, Pullach, Bergkirchen, Odelzhausen
(RCE-Event), Böbing, Seukendorf, Haunsheim (Tribe). Markt Bad Hindelang zählt nicht, weil sein
communice-Vereinskalender leer war.

## Abgleich mit der Vollerhebung

[01-vollerhebung.md](01-vollerhebung.md) hat am 28.10.2026, nach dieser Stichprobe, jede
Gemeinde einmal automatisch zugeordnet (CSV
[data/vollerhebung-2026-10.csv](data/vollerhebung-2026-10.csv)). Bayern laut CSV, 2.056
Gemeinden: `heimatinfo` 532, `html_generic` 220, `js_oder_feed` 148, `leer` 137,
`verwaltungsportal` 95, `communice` 88, `kein_link` 74, `hwext` 74, `tribe` 67, `open2c` 57,
`digipublica` 55, `fehler` 48, `txnews` 41, `destinationone` 40, `rce` 37, `regiogate` 35,
`cross7` 33, `deskline` 24, `townhall` 23, `ikiss` 21. Die Handprüfung der 30 Gemeinden dieser
Datei gegen die Spalte `integration`:

| Ergebnis | Gemeinden |
|---|---|
| gleiche Integration, Termine vorhanden (12) | Flintsbach, Pullach, Bergkirchen (`rce`); Stammham, Buxheim, Aham (`heimatinfo`); Böbing, Seukendorf, Haunsheim (`tribe`); Grafengehaig (`calendarize`); Gerach (`communice`); Mittelstetten (`open2c`) |
| zugeordnet, aber ohne Termine auf diesem Weg (8) | Buttenheim, Riekofen (`heimatinfo`, API 0 Termine; Buttenheim hat communice, Riekofen ein PDF); Kastl, Pürgen (`txnews`, Kalender leer); Bergrheinfeld (`txnews`, Termine nur im Jahres-PDF); Wattendorf, Ködnitz (`verwaltungsportal`, leer bzw. statisch); Holzkirchen (`digipublica`, kein Kalender) |
| anderer Weg gefunden (7) | Adelzhausen (`heimatinfo`, Hauptkalender communice); Painten (`townhall`, Termine nur als PDF); Nonnenhorn (`outdooractive`, Kalender JS-Widget plus PDF); Odelzhausen (`js_oder_feed`, RCE-Iframe); Nesselwang, Bad Hindelang (`js_oder_feed`, Feratel Deskline); Neuburg a.Inn (`js_oder_feed`, communice) |
| als Rest `leer`, aber gefüllter Kalender (3) | Hohenpeißenberg (communice), Pappenheim (events2), Oberpöring (Contao) |

Folgerungen: Die bayerischen Zahlen der Vollerhebung sind Obergrenzen für Heimat-Info,
verwaltungsportal und tx_news (Merkmal gefunden heißt nicht Termine vorhanden) und
Untergrenzen für communice, Feratel und RCE-Event (hinter `js_oder_feed` und `leer`
verbergen sich bekannte Hersteller). Bei RCE-Event führt die Vollerhebung „robots.txt sperrt,
nur Vertrag“; das gilt nur für Iframes von `www.rce-event.de`, nicht für die
Gemeinde-Subdomains (Flintsbach, Pullach). Ein Import sollte je Gemeinde zählen, ob Termine
ankommen, statt die Zuordnung als Abdeckung zu nehmen.

## Priorisierte Liste für Bayern

Reihenfolge nach Gemeinden je Integration, dann Datenqualität, dann Rechtslage.

| # | Integration | Stichprobe | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | Heimat-Info JSON-API | 5 / 30 mit Terminen, 507 bayerische Einträge | Vereinstermine, Freitext-Ort, keine Koordinate am Termin | keine Regel für Dritte | Teil der WITTICH-Anfrage aus dem Vorbericht (B1); danach ein Dry-Run über alle bayerischen Einträge |
| 2 | communice web (inixmedia) | 5 / 30 mit Terminen | iCal fehlerhaft (Ende, Zeitzone), Detailseite oder `eventArray` vollständig | nicht belegt, keine robots.txt | inixmedia nach zentralem Export und Kundenliste fragen; bis dahin Merkmal-Detektor und Parser für Liste plus Detailseite planen |
| 3 | RCE-Event (RCE Medien) | 4 / 30 | vCalendar mit Ort, Detailseite mit Adresse und Veranstalter | Subdomains erlaubt, zentraler Host gesperrt | RCE Medien nach Feed je AGS und Lizenz fragen (der `gembox`-Parameter deutet auf einen zentralen Abruf) |
| 4 | Plugin-Detektor (The Events Calendar) | 3 / 30 | REST gut, Uhrzeit oft im Titel | Gemeinde-Websites | Detektor-Regeln aus dem Vorbericht D5 übernehmen, Titel-Uhrzeit-Regel ergänzen |
| 5 | destination.one `open-data` | 6 / 30 | sehr gut, aber kaum Dorffeste | CC-BY, CC-BY-SA | ohnehin bundesweit geplant; kein eigener BayernCloud-Anschluss |
| 6 | Gemeinde-Registry Bayern (Kalender-URL je Gemeinde, Parser je CMS) | events2, calendarize, Contao, open2c: je 1 bis 2 | JSON-LD oder ICS je Termin | Gemeinde-Websites | die DE-Registry aus der Vollerhebung (fn-29.4, Spalte `event_url`) nutzen; die drei als `leer` geführten Gemeinden mit Kalender (Abgleich) dort nachtragen |
| 7 | Feratel Deskline DE | 2 / 30 | gut, nur Tourismusorte | wie Österreich | Kanäle `NESSELWANG`, `ALLGAUHIND` als Ergänzung prüfen, Überschneidung mit destination.one messen |
| 8 | PDF (Mitteilungsblatt, Jahreskalender) | 7 / 30 | unstrukturiert | je Gemeinde; WITTICH-Blätter (VGem Steinfeld, VGem Helmstadt) im WITTICH-Gespräch | zurückstellen; PDF-Parsing erst, wenn 1 bis 6 laufen |
| 9 | Kirchweihkalender der Landkreise, ELKB-Kirchweih-Gottesdienste | Franken | Datum und Ort, kein Programm | Landkreis-PDF; ELKB-Lizenz offen | nur als Lückenliste: welches Dorf wann Kirchweih hat |
| | Nicht verfolgen | | | | BayernCloud direkt (in destination.one enthalten), erlebe.bayern (blockt), verwaltungsportal in Bayern (Kalender leer), akdb.digitalfabriX (kein Kalendermodul gesehen), festivalsindeutschland (AGB) |

**Lücken:** Gemeinden, die nur ein Mitteilungsblatt als PDF oder gar nichts veröffentlichen
(8 / 30 = 27 %: die sieben PDF-Gemeinden plus Holzkirchen), erreicht keine der Integrationen.
Kundenzahlen von communice in Bayern und von RCE-Event sind nicht belegt. Die Gleichheit der
Daten auf stammham.de mit der Heimat-Info-API ist nicht geprüft.

## Was der User selbst tun muss

1. WITTICH-Gespräch aus dem Vorbericht (Heimat-Info, meinOrt, Amtsblätter) um die bayerische
   Zahl ergänzen: 507 Heimat-Info-Einträge in Bayern.
2. inixmedia GmbH (communice web): Nutzung der Kalenderdaten der Kundenseiten, zentraler
   Export, Kundenliste. Kontakt laut Website support@communice.de bzw. bayern@inixmedia.de.
3. RCE Medien GmbH & Co. KG (RCE-Event): Feed je Gemeinde oder AGS und Lizenz.

## Anfragen

Vollständige Liste mit Statuscodes und Rohnotizen: [02-bayern-anfragen.md](02-bayern-anfragen.md).
Hauptsession 69 Anfragen, Gruppe a 63, Gruppe b 81, Gruppe c 71 (Summen der Host-Tabellen der
Gruppen); kein Gemeinde-Host über 6, meta.et4.de 36 (Zählung je Stichprobengemeinde, mit Pause).
