# Vollerhebung: Wie wir jede deutsche Gemeinde bekommen (Stand 2026-10-28)

Ergänzung zu `fn-28` (Querschnitt [00-bundesweit.md](00-bundesweit.md), Länderdateien
03 bis 08). Statt Stichproben je Land sind hier **alle 10.749 Gemeinden** erfasst: jede
Gemeinde-Website wurde einmal abgerufen, der Hersteller erkannt, die Veranstaltungsseite
einmal geprüft und jede Gemeinde genau einer Integration zugeordnet. Ergebnis je Gemeinde:
[data/vollerhebung-2026-10.csv](data/vollerhebung-2026-10.csv). Methode und Skripte:
Abschnitt 7. Alle Anfragen: [01-vollerhebung-anfragen.md](01-vollerhebung-anfragen.md).

Was „erreicht“ hier heißt: Die Gemeinde hat einen Online-Kalender, und wir kennen einen
technischen Weg, ihn zu lesen. Ob darin Dorffeste stehen, zeigt der Dorffest-Test je
Hersteller (Abschnitt 3), nicht die Zuordnung. Dünne Kalender (Thüringen: 8 von 15
verwaltungsportal-Seiten mit 0 bis 3 Terminen, [07-thueringen.md](07-thueringen.md)) zählen
als erreicht.

## Kurzfazit

1. **Mit eigener Website und bekannter Technik erreichen wir 79,0 % der Gemeinden**
   (8.494 von 10.749, 84,3 % der Einwohner). Rund 40 Integrationen für Hersteller und
   eingebettete Kalender tragen 61,3 %, zwei allgemeine Parser (JSON-LD und HTML-Liste
   mit Datum) den Rest.
2. **Mit dem Kalender des Amts oder der Verbandsgemeinde kommen 733 Gemeinden dazu,
   mit meinOrt nach Lizenz weitere 335: zusammen 89,0 %** (9.562 Gemeinden).
3. **Der Rest sind 1.187 Gemeinden (11,0 %)**, im Median 1.667 Einwohner. 1.006 davon
   haben online keinen erkennbaren Kalender (Seite ohne Termine oder kein Kalenderlink),
   101 waren nicht erreichbar, 80 sperren per robots.txt. Für sie bleiben Amtsblätter,
   Landes- und Kreisdatenbanken und Vereine (Abschnitt 5).
4. **Die größten Hebel in Reihenfolge:** verwaltungsportal.de (1.165 Gemeinden), ionas
   (931), Heimat-Info (571), NOLIS (481), Hirsch & Wölfl `hwveranstaltung` (430),
   The Events Calendar (370), Advantic iKISS (364), communice (301). Diese acht decken
   43 % aller Gemeinden.
5. **Zwei neue Groß-Hersteller** gegenüber dem Querschnitt: **ionas** (Chamaeleon, auch
   ekom21 cms21) mit offenem `events.json` und `event.ics`, und **Hirsch & Wölfl** (TYPO3,
   Baden-Württemberg) mit einheitlichem HTML samt Koordinaten.

## 1. Ergebnis

### Stufen gesamt

Jede Gemeinde steht in genau einer Stufe, die erste passende gewinnt.

| Stufe | Gemeinden | Anteil | Einwohner-Anteil |
|---|---|---|---|
| A API oder Feed | 3.203 | 29,8 % | 21,9 % |
| B Hersteller-HTML | 2.872 | 26,7 % | 26,1 % |
| C eingebetteter Fremdkalender | 511 | 4,8 % | 5,6 % |
| D JSON-LD/Mikrodaten | 61 | 0,6 % | 0,4 % |
| E Kalender, allgemeiner Parser | 1.847 | 17,2 % | 30,3 % |
| V Kalender des Amts/der VG | 733 | 6,8 % | 1,0 % |
| M nur meinOrt (Lizenz) | 335 | 3,1 % | 0,6 % |
| R Rest | 1.187 | 11,0 % | 14,2 % |
| Summe | 10.749 | 100 % | 100 % |

Einwohner: Destatis, Stand 31.12.2025 (Spalte des Gemeindeverzeichnisses). Der hohe
Einwohner-Anteil in E und R kommt von Großstädten (Köln, Düsseldorf, Nürnberg u. a. im
Rest); die laufen ohnehin über Tourismus und Ticketing
(`docs/research/deutschland-event-quellen-2026-10.md`).

### Matrix Land × Stufe (Gemeinden)

| Land | Gemeinden | A | B | C | D | E | V | M | R | erreicht A bis M |
|---|---|---|---|---|---|---|---|---|---|---|
| RP | 2300 | 833 | 181 | 96 | 10 | 412 | 400 | 260 | 108 | 95 % |
| BY | 2056 | 781 | 429 | 193 | 14 | 368 | 21 | 5 | 245 | 88 % |
| SH | 1104 | 310 | 243 | 56 | 7 | 202 | 115 | 0 | 171 | 85 % |
| BW | 1101 | 287 | 542 | 23 | 16 | 117 | 6 | 0 | 110 | 90 % |
| NI | 941 | 375 | 199 | 65 | 1 | 134 | 81 | 0 | 86 | 91 % |
| MV | 724 | 163 | 255 | 5 | 6 | 93 | 36 | 41 | 125 | 83 % |
| TH | 601 | 43 | 294 | 6 | 1 | 114 | 35 | 1 | 107 | 82 % |
| HE | 421 | 189 | 101 | 14 | 2 | 62 | 0 | 21 | 32 | 92 % |
| SN | 418 | 53 | 122 | 25 | 3 | 115 | 17 | 3 | 80 | 81 % |
| BB | 413 | 46 | 253 | 9 | 0 | 66 | 14 | 0 | 25 | 94 % |
| NW | 396 | 98 | 113 | 12 | 0 | 96 | 0 | 0 | 77 | 81 % |
| ST | 218 | 15 | 125 | 2 | 1 | 52 | 8 | 0 | 15 | 93 % |
| SL | 52 | 10 | 15 | 5 | 0 | 14 | 0 | 4 | 4 | 92 % |
| HB | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 % |
| HH | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 100 % |
| BE | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 100 % |

Bremen und Bremerhaven: Startseite nicht erreichbar bzw. ohne Kalender; Berlin, Hamburg
und Bremen kommen über die Stadt- und Ticketing-Quellen, nicht über Gemeindekalender.

## 2. Umsetzungsreihenfolge

Reihenfolge: zuerst Feeds und APIs (stabil, wenig Parserpflege), dann Hersteller-HTML
nach Zahl der Gemeinden, dann eingebettete Kalender, dann die allgemeinen Parser, zuletzt
die Ausweichwege. Die Spalte „kumuliert“ zählt nur Gemeinden mit eigener Website.

| # | Stufe | Integration | Zugriff (Belege Abschnitt 3) | Gemeinden | kumuliert | Anteil |
|---|---|---|---|---|---|---|
| 1 | A | ionas | `events.json`/`event.ics` am `data-source` der Kalenderseite | 931 | 931 | 8,7 % |
| 2 | A | Heimat-Info | JSON-API, nach Lizenz WITTICH | 571 | 1.502 | 14,0 % |
| 3 | A | NOLIS | iCal je Kommune | 481 | 1.983 | 18,4 % |
| 4 | A | The Events Calendar | WP-REST `/wp-json/tribe/events/v1/events` | 370 | 2.353 | 21,9 % |
| 5 | A | communice (inixmedia) | Atom `/veranstaltungen/rss`, iCal | 301 | 2.654 | 24,7 % |
| 6 | A | Cross7 | JSON-API `api.cross-7.de` | 176 | 2.830 | 26,3 % |
| 7 | A | Komm.ONE | RSS mit hCalendar | 137 | 2.967 | 27,6 % |
| 8 | A | Modern Events Calendar | RSS `/events/feed/` | 74 | 3.041 | 28,3 % |
| 9 | A | JEvents | Joomla-RSS | 54 | 3.095 | 28,8 % |
| 10 | A | Events Manager | `/events.ics` | 53 | 3.148 | 29,3 % |
| 11 | A | DPCalendar | iCal | 30 | 3.178 | 29,6 % |
| 12 | A | iCagenda | Joomla-RSS | 25 | 3.203 | 29,8 % |
| 13 | B | verwaltungsportal.de | Liste + AJAX-Monatsfragment + JSON-LD je Termin | 1.165 | 4.368 | 40,6 % |
| 14 | B | Hirsch & Wölfl `hwveranstaltung` | HTML `seite-N/suche-none`, `hw_record__*` | 430 | 4.798 | 44,6 % |
| 15 | B | Advantic iKISS | HTML `ModID=11` | 364 | 5.162 | 48,0 % |
| 16 | B | TYPO3 tx_news | HTML/JSON-LD | 153 | 5.315 | 49,4 % |
| 17 | B | Contao Kalender | HTML `mod_eventlist` | 117 | 5.432 | 50,5 % |
| 18 | B | Weblication | HTML `listEntry*`, iCal `createICal.php` | 102 | 5.534 | 51,5 % |
| 19 | B | cEasy (hitcom) | HTML `cVeka_*`, Paging `offset=N` | 102 | 5.636 | 52,4 % |
| 20 | B | GeoCMS (brain-SCC) | HTML `gcevent-*`/`btp_event`, Crawl-delay 15 | 63 | 5.699 | 53,0 % |
| 21 | B | DigiPublica | Inline-JSON `events:[…]` | 60 | 5.759 | 53,6 % |
| 22 | B | Open2C | HTML `.o<id>.html?page=N` | 57 | 5.816 | 54,1 % |
| 23 | B | calendarize | HTML (schon in AT: `calendarize-card.ts`) | 52 | 5.868 | 54,6 % |
| 24 | B | active-City | HTML `spectaculum_*` | 51 | 5.919 | 55,1 % |
| 25 | B | cmcitymedia (ohne Cross7) | HTML Klassikansicht | 38 | 5.957 | 55,4 % |
| 26 | B | Sitepark | HTML `SP-Teaser*`, iCal je Termin | 29 | 5.986 | 55,7 % |
| 27 | B | townhall (Spiegel Heimat-Info) | über Heimat-Info | 27 | 6.013 | 55,9 % |
| 28 | B | contentXXL | Widgets imx/infomax | 24 | 6.037 | 56,2 % |
| 29 | B | events2, EventON, sf_event_mgt | HTML/JSON-LD | 38 | 6.075 | 56,5 % |
| 30 | C | destination.one-Widget | Experience je Ort, `open-data` nur Teilmenge | 119 | 6.194 | 57,6 % |
| 31 | C | Feratel Deskline | Web-API wie AT (Linkkey aus `tagcontext.js`) | 115 | 6.309 | 58,7 % |
| 32 | C | termine-regional.de | nur mit Vertrag | 49 | 6.358 | 59,1 % |
| 33 | C | weitere eingebettete (kalender.digital, freizeitkalender.eu, ILE Lech-Wertach, infomax) | je Quelle | 41 | 6.399 | 59,5 % |
| 34 | C | regiogate | HTML `?ev[id]=` | 38 | 6.437 | 59,9 % |
| 35 | C | RCE-Event | robots.txt sperrt, nur Vertrag | 38 | 6.475 | 60,2 % |
| 36 | C | toubiz | API mit Kunden-Token | 34 | 6.509 | 60,6 % |
| 37 | C | outdooractive | kostenpflichtig, nicht indexierbar | 30 | 6.539 | 60,8 % |
| 38 | C | StadtLandNews, SQR (Rhön-Grabfeld), Crossiety | je Quelle | 47 | 6.586 | 61,3 % |
| 39 | D | JSON-LD/Mikrodaten | allgemeiner JSON-LD-Parser | 61 | 6.647 | 61,8 % |
| 40 | E | HTML-Liste mit Datum | allgemeiner Parser (wie `GenericGemeindeScraper`) | 1.165 | 7.812 | 72,7 % |
| 41 | E | Termine per JS oder Feed | Feed bzw. JS-Endpunkt je Seite | 682 | 8.494 | 79,0 % |
| | V | Kalender des Amts/der VG | Integration des Amts (eine der obigen) | 733 | 9.227 | 85,8 % |
| | M | meinOrt | nur nach Lizenz WITTICH | 335 | 9.562 | 89,0 % |

Stufe E ist der aufwendigste Teil: 1.847 Seiten ohne erkannten Hersteller. Wie in
Österreich trägt hier ein allgemeiner Parser, der Listen mit Datum liest, plus eine
Registry mit Kalender-URL je Gemeinde (Spalte `event_url` der CSV). Ein Teil davon wird
in einer nächsten Erhebung einem Hersteller zugeordnet werden können (Abschnitt 6).

## 3. Zugriffswege der neuen Hersteller

Belege der bekannten Hersteller stehen in [00-bundesweit.md](00-bundesweit.md); hier nur
die neu gefundenen. Rohbefunde mit allen Anfragen: Abschnitt 7.

* **ionas (Chamaeleon AG; ekom21 cms21 läuft auf ionas, [08-hessen.md](08-hessen.md)):**
  Kalendermodul „TVM“. Die Kalenderseite trägt
  `data-source="https://<host>/<kalenderpfad>/events.json?weekends=false&tagMode=ALL"` und
  den Export `…/event.ics?weekends=false&tagMode=ALL`. Der Pfad ist je Gemeinde anders
  (amt-sn.de `/kalender/`, hachenburg-vg.de `/kalender/kombinierte-terminquelle/`).
  Felder `events.json`: `id`, `start`, `end` (lokal ohne Offset), `allDay`, `title`,
  `website`, `imageSrc`, `category`, `tags`, `location`; das ICS hat zusätzlich
  `X-STREET-ADDRESS`, `X-POSTAL-CODE`, `X-ORGANIZER-*`. Dorffest: „Nostalgischer
  Weihnachtsmarkt in Hachenburg“ im `events.json` der VG Hachenburg; Hessen: „Pfirschbacher
  Kerb“ der Feuerwehr Höchst i. Odw. Einschränkung: Nicht jede ionas-Seite nutzt TVM
  (Großhansdorf leer, Lengerich bettet destination.one ein); der TVM-Anteil an den 931 ist
  nicht gemessen.
* **Hirsch & Wölfl, TYPO3-Extension `hwveranstaltung` (Baden-Württemberg):** Liste
  serverseitig, 10 Termine je Seite, `<Seite>/seite-N/suche-none`; Klassen
  `hw_record__title`, `__date`, `__time`, `__organizer`, `__simpleLocation`, OSM-Link mit
  Koordinaten. iCal nur je Termin mit cHash. robots.txt (neckartenzlingen.de, owen.de,
  deckenpfronn.de) lässt Liste und Detail frei, sperrt `?type=`. Dorffest-Belege in den
  Rohbefunden (Weihnachtsmärkte, Martinsmarkt).
* **cEasy (hitcom):** Modul `cVeka`, Klassen `cVeka_box_*`, Paging
  `?item=eventDate&view=find&doPage=1&limit=15&offset=N`, iCal je Termin
  `/ceasy/ics/veka/eventDate/<id>.ics`. Gezählt nur über den Generator „cEasy“ (der
  Consent-Dienst `ccm.ceasy.de` allein ist kein cEasy).
* **Weblication:** Liste `listEntry*`, iCal je Veranstaltung über
  `/de-wGlobal/wGlobal/scripts/php/createICal.php?path=<Detailpfad>` (Marienheide, Lorsch).
* **Sitepark IES:** Liste `SP-Teaser*`, Paging `sp:page[eventSearch-1.form][0]=N`, iCal je
  Termin `<Detail>?sp:out=iCal`.
* **Open2C, GeoCMS, DigiPublica:** einheitliches HTML bzw. Inline-JSON, kein Feed;
  Open2C-Export `export_ical.php` ist bei Pörnbach per robots.txt gesperrt, GeoCMS hat
  Crawl-delay 15.
* **verwaltungsportal.de (vertieft):** Die Liste zeigt 12 Monate; weitere Monate über das
  AJAX-Fragment `/event/event/ajaxlist/year/<J>/month/<M>/day/<T>/`. Kein RSS/iCal/JSON.
  JSON-LD `name`, `description`, `startDate`, Adresse; kein Ende, keine Koordinaten.
* **SQR (Landkreis Rhön-Grabfeld):** offenes GET
  `aht1gh-api.sqronline.de/…/getevents?module_division_uuid=` mit Adresse.
* **toubiz, RCE-Event, termine-regional.de:** nur mit Zugang bzw. Vertrag (Token je Kunde,
  robots.txt sperrt RCE vollständig, termine-regional laut Vertrag nur nicht kommerziell).
* **destination.one-Widgets:** Die Widgets nutzen eigene Experiences (rhede-ems, geeste,
  emsland, wilhelmshaven-touristik u. a.); `open-data` enthält nur einen Teil
  (Geeste 11 gegenüber 40, Wilhelmshaven 45 gegenüber 230).

## 4. Ausweichwege für Gemeinden ohne eigenen Kalender

* **V, Kalender des Amts oder der Verbandsgemeinde (733):** Die Gemeinde hat keinen
  Kalender, ihr Amt bzw. ihre VG schon. In Rheinland-Pfalz 400, Schleswig-Holstein 115,
  Niedersachsen 81. Ob der Amtskalender die Termine dieser Gemeinde führt, ist je Amt
  verschieden ([03-schleswig-holstein.md](03-schleswig-holstein.md): 4 von 25 Ämtern mit
  Dorfterminen; [06-mecklenburg-vorpommern.md](06-mecklenburg-vorpommern.md): Amt ist die
  Kalenderebene).
* **M, meinOrt (335 zusätzlich, 1.734 insgesamt zugeordnet):** nur mit Zustimmung von
  WITTICH (AGB IV.9, [00-bundesweit.md](00-bundesweit.md) B1). Schwerpunkt RP (260 der
  335) und MV (41). Anfrage ist am 27.10.2026 verschickt.

## 5. Plan für den Rest (1.187 Gemeinden)

| Grund | Gemeinden | Weg |
|---|---|---|
| Seite ohne Termine | 556 | Kalender existiert, aber leer oder nur per Klick; nächste Erhebung prüft erneut, sonst Amtsblatt |
| kein Kalenderlink, auch nicht unter `/veranstaltungen/`, `/termine/`, `/veranstaltungskalender/`, `/events/` | 450 | Amtsblatt, Kreis- oder Landesdatenbank |
| nicht erreichbar | 101 | erneut prüfen, Website-URL in Wikidata fehlerhaft oder veraltet |
| robots.txt sperrt | 80 | bei der Gemeinde anfragen |

Die Bausteine für den Rest, jeweils nur mit Beleg aus den Länderdateien:

1. **Landesdatenbanken mit offener Lizenz:** TA.SH auf dem Open-Data-Portal
   Schleswig-Holstein (CC0, CC BY, CC BY-SA je Eintrag, [03](03-schleswig-holstein.md)),
   ThüCAT (CC, API-Key, [07](07-thueringen.md)), DZT Knowledge Graph (alle Länder). Sie
   decken kleine Gemeinden kaum (SH 4 von 30, TH 3 von 30), schließen aber
   Traditionsfeste.
2. **termine-regional.de (Vertrag):** 291 SH-Gemeinden im Ortsfilter, dazu iKISS-Gemeinden
   bundesweit; kommerziell nur auf Anfrage.
3. **Amtsblätter:** LINUS WITTICH (über dieselbe Lizenzanfrage), NUSSBAUM (BW), sonst PDF.
   37 der Rest-Gemeinden verlinken ein WITTICH-Amtsblatt.
4. **Tourismusverband MV (infomax/imx):** Datenzugang anfragen ([06](06-mecklenburg-vorpommern.md)).
5. **Großstädte im Rest (32 über 50.000 Einwohner):** über Tourismus, Ticketing und offene
   Stadtdaten (Köln dl-zero-de, siehe Quellenbericht).

Gemeinden, die nirgends online veröffentlichen, bleiben ohne Daten; das ist der gemessene
Rest, keine Lücke der Methode. Er wird mit jeder Wiederholung der Erhebung kleiner, weil
Gemeinden Websites umbauen.

## 6. Grenzen der Erhebung

* **Eine Startseite, eine Veranstaltungsseite:** Wer den Kalender tief verlinkt oder nur
  per JavaScript lädt, landet in E oder F. Die Zahl der Gemeinden mit Kalender ist also
  eher unterschätzt.
* **Hersteller-Merkmal ist nicht Kalenderinhalt:** Ein Hersteller auf der Startseite heißt
  nicht, dass sein Kalendermodul Termine führt (ionas ohne TVM, cmcitymedia ohne Cross7).
* **Website-Quelle Wikidata:** 10.730 von 10.749 Gemeinden haben dort eine Website, 15
  nur die ihres Verbands, 4 keine. Bei Ortsgemeinden zeigt Wikidata teils auf die Seite
  der VG; dann zählt die Gemeinde mit der Integration der VG.
* **meinOrt-Zuordnung über Ortsnamen:** 1.734 eindeutig, 109 mehrdeutig (nicht gezählt),
  354 ohne Treffer (meist Ortsteile).
* **Datumserkennung:** Formate `27.10.2026`, `27. Oktober 2026`, ISO und Wochentag mit Datum;
  andere Formate fallen in F.

## 7. Methode, Daten, Reproduzierbarkeit

* **Gemeinden:** Destatis Gemeindeverzeichnis-Auszug, Stichtag 30.09.2026 (Satzart 60 ohne
  Textkennzeichen 66 „gemeindefreies Gebiet“ = 10.749).
* **Websites:** Wikidata SPARQL, `P439` (Gemeindeschlüssel) und `P1388` (Regionalschlüssel)
  mit `P856` (offizielle Website); Gemeindeverbände über den 9-stelligen Regionalschlüssel.
  8.749 eindeutige Hosts.
* **Durchgang 1:** je Host robots.txt, dann Startseite (8.167 mit 200, 107 per robots.txt
  gesperrt und nicht abgerufen). Gespeichert nur Merkmale (Generator, Fremd-Hosts,
  Hersteller-Muster, Kalenderlinks), kein HTML.
* **Durchgang 2:** je Host die wahrscheinlichste Veranstaltungsseite (robots.txt geprüft):
  6.904 abgerufen, 1.160 ohne Kalenderlink.
* **Durchgang 3:** Restgruppen: breitere Datumserkennung (1.483), Standardpfade
  `/veranstaltungen/`, `/termine/`, `/veranstaltungskalender/`, `/events/` (896),
  URL-Varianten für Fehler (448); höchstens 5 Anfragen je Host.
* **Listen:** meinOrt-Ortsliste über Namen, Heimat-Info über Name und Koordinate auf den
  Gemeindeschlüssel abgebildet (551 Hauptkommunen).
* **Zuordnung:** erste passende Stufe in der Reihenfolge der Tabelle in Abschnitt 2.
* **Skripte:** [vollerhebung/](vollerhebung/) (`detect.py`, `detect2.py`, `detect3.py`,
  `match_lists.py`, `classify.py`), Python 3 mit `requests`. Wiederholung empfohlen je
  Quartal; vorher Wikidata und Destatis neu laden.
* **CSV-Spalten:** `ags`, `land`, `name`, `ew`, `kreis`, `vb`, `host`, `stufe`, `klasse`,
  `integration`, `vb_host`, `vb_integration`, `meinort`, `event_url`. Das ist ein
  Rechercheergebnis, keine Stammdaten-Datei für den Betrieb (die kommt im eigenen Epic).

## 8. Nächste Schritte

1. Epic „DE-Gemeinde-Registry“: aus der CSV eine Registry (Gemeindeschlüssel → Integration
   → Kalender-URL) nach dem Muster von `GemeindeRegistryScraper` bauen, mit den Stammdaten
   aus Destatis.
2. Adapter in der Reihenfolge von Abschnitt 2, zuerst ionas, NOLIS, The Events Calendar,
   communice, Cross7 (offene Feeds), parallel der allgemeine Parser für Stufe E.
3. Lizenzen: WITTICH (meinOrt, Heimat-Info, Amtsblätter, Anfrage läuft), termine-regional.de,
   toubiz, TMV, cm city media (Feed), NUSSBAUM.
4. Erhebung je Quartal wiederholen und die Stufen-Matrix fortschreiben.
