# DE-Adapter allgemeiner Parser, Stufen D und E (fn-29.16, Prüfstand 2026-10-29)

Der Adapter `de-allgemein` (`src/lib/scrapers/de/AllgemeinDeScraper.ts`, Parser
`allgemein.ts`, Datumsangaben `datum.ts`) liest die Kalenderseiten aller Registry-Einträge
mit den Integrationen `jsonld` (Stufe D), `html_generic` und `js_oder_feed` (Stufe E), dazu
Gemeinden, die einen solchen Kalender ihres Amts bzw. ihrer VG nutzen. Er steht in
`DE_SCRAPERS`, nicht im Nachtlauf (fn-29.18).

## Lesart einer Seite

Dieselben Module wie in Österreich: Titel über `event-title.ts` (`isNamelessTitle`,
`eventNameNodes`, `visibleText`), Folgeseiten über `pagination.ts`, Abrufe über
`BaseScraper.fetchHtml` (nur HTML, höchstens 5 MB), Müll-Titel über `garbage-filter.ts`,
Ort über `kontext.ts` und den Resolver, Bild über `bild.ts`. Keine Wortlisten für Titel.

1. **JSON-LD** (`jsonld.ts`, dieselbe Datei wie fn-29.7): `@type` …Event, Wandzeit als
   deutsche Ortszeit, reines Datum ganztägig.
2. **Mikrodaten** (`itemtype=…/Event`): dieselben Felder, gelesen über `toLdEvent`.
3. **Liste mit Datum:** Ein Termin ist eine Kachel, Zeile oder ein Listeneintrag, der sich
   neben gleichartigen Geschwistern mit Datum wiederholt. Die Kachel nennt genau ein
   Datum oder eine Spanne. Name in dieser Reihenfolge: ausgezeichneter Name, Überschrift,
   Titel-Element, Tabellenspalte, Link auf eine Seite derselben Website, Fettdruck.
   Fließtext ist nie ein Name.

Es gilt die Lesart mit den meisten künftigen Terminen, bei Gleichstand die mit mehr
Uhrzeiten, nie zwei zusammen.

## Befunde und Umsetzung

Jeder Befund stammt aus der Probe aller 1.614 erreichbaren Kalenderseiten bzw. aus den
Stichproben des Prüfstands (2026-10-29).

| Befund | Beleg | Umsetzung |
|---|---|---|
| Startseiten mischen Termine und Meldungen | havelberg.de: „Halbseitige Sperrung der Fahrbahn" mit Datumsspanne; hausen-am-tann.de: „Öffentliche Bekanntmachung … Wahl" | Startseiten nicht gelesen (163 Registry-Einträge) |
| Kalender eines Amts steht als Seite einer Gemeinde in der Registry | Hintersee → Kalender des Amts am Stettiner Haff mit Terminen in Eggesin, Mönkebude | Teilen sich Gemeinden die Website, ist jede Seite ein Amtskalender: Ort nur, wenn der Termin die Gemeinde nennt |
| Termin im Nachbarort im Kalender einer Gemeinde | Tröndel: „Kegeln", Ort: Witt's Gasthof, Krummbek | nennt die Kachel eine andere Gemeinde (`otherGemeindeNamed`), gilt der Kalender nicht als Ort |
| derselbe Termin auf zwei Gemeindeseiten | „gemeinsamer Kalender" Güglingen und Pfaffenhofen; amt-ssl.de und www.amt-ssl.de | eine Zeile mit dem Kontext beider Seiten; Schreibweisen derselben Seite zusammengeführt |
| Tabelle „Datum, Verein, Veranstaltung, Ort" | Contwig | Spalte, die der Kopf als Veranstaltung beschriftet; mehrere Textzellen ohne Kopf: kein Termin |
| Datum und Uhrzeit in der Überschrift | Ornbau „07. November 2026, 15:00 Uhr Weinfahrt" | Datum, Wochentag und Uhrzeit am Rand des Titels entfernt |
| Beschriftung vor dem Datum | Hamminkeln „Meldung vom: 29.10.2026 Sprachcafé Russisch" | entfernt |
| Feld im Namens-Element | Tönisvorst „Kategorie: Brauchtum", Sulzbach „Veranstaltungsort: …" | Feld hinter dem Namen fällt weg |
| Ortsname als `.title` | Baiern: `.location .title` = „Netterndorf" | Namen in Ort und Veranstalter zählen nicht |
| Knöpfe als Name | „› weiterlesen", „Tickets kaufen" (Woldegk), Cloudflare „[email protected]" | Müll-Filter, nur Links auf die eigene Website, keine Adressen |
| Beschreibung als Name | Flechtingen „Wir basteln … Herbstlaub. Bitte anmelden unter Tel. …" | Zelle, Link, Fettdruck mit mehreren Sätzen oder über 120 Zeichen ist kein Name |
| Spanne über zwei Elemente | Kempen `<time>16.10</time> - <time>05.11.2026</time>` | Spanne erkannt; ein Beginn vor heute verwirft der Freigabevertrag (`start_in_past`) |
| „bis 20.12.2026" ohne Beginn | Kalkar, Ausstellungen | kein Termin an diesem Tag |
| mehrtägig mit einer Uhrzeit | Kenzingen „31.10.2026 bis 01.11.2026, 01:00 Uhr" | ganztägig, keine erfundene Uhrzeit |
| Uhrzeit weit hinter dem Datum (Einrückung, wiederholtes Datum) | Viersen „Datum 06.11.2026 Uhrzeit 18:00 bis 19:30 Uhr", Augsburg „Montag, 23.11.2026 Bildnachweis … 23.11.2026 18:00 Uhr" | Leerraum zusammengefasst, Uhrzeit nach jeder Nennung des Datums |
| „von 16 bis 17 Uhr" | Flechtingen | Beginn 16:00, Ende 17:00 |
| Kopf ohne Jahr, anderes Datum im Text | Eitorf „JUNI 5. Juni, 15:00 Uhr Dorffest in Halft", im Text ein Termin 2027 | kein Termin |
| Mikrodaten nur mit Datum, Liste mit Uhrzeit | Gemmingen | Lesart mit Uhrzeiten |
| ISO-8859-1-Seiten | Denzlingen „Schach f�r Jung & Alt" | Zeichensatz aus Content-Type bzw. `<meta charset>` (nur dieser Adapter, `detectCharset`) |
| Folgeseite verschiebt sich | Woldegk `?from=40` | Termine ohne Detailseite bekommen ihre Identität von der Kalenderseite |
| geteilte Server | verwaltungsportal.de sperrte bei 8 parallelen Websites die IP (fn-29.11) | höchstens 4 Websites gleichzeitig, je Website nacheinander mit Crawl-delay |

`source_id` = `allg-<Host>-<Hash>-<Tag>`, Hash aus Detailseite und Tag, ohne Detailseite
aus Kalenderseite, Titel und Tag (nie gekürzter Text). `source_url` ist die Detailseite des
Termins, wenn die Kachel eine nennt (Link am Namen, verlinkte Kachel, Knopf, Bild-Link auf
derselben Website), sonst die Kalenderseite. Ein Link, den Kacheln verschiedener Termine
teilen, ist der Kalender, keine Detailseite.

Gemeinde-Dienste: zwei deutsche Begriffe aus den Stichproben ergänzt
(`municipal-service.ts`): „Laubannahme" (Bergfeld), „Gartenabfälle" (Rantrum).

## Ergebnis (Prüfstand 2026-10-30, frischer Cache: 3.475 Abrufe aus dem Netz)

1.542 Kalenderseiten (1.890 Registry-Einträge mit Kalender-URL, ohne 163 Startseiten,
Schreibweisen derselben Seite zusammengeführt), davon 556 mit künftigen Terminen.
Geliefert 10.837, vom Sync verworfen 0, geschrieben 10.791, öffentlich 9.450,
Quarantäne 1.341 (`no_location_evidence` 1.199, `municipal_service` 164,
`start_too_far_ahead` 3).

| Prüfung | allgemeiner Parser | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 27,6 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,07 % |
| Dubletten in der Quelle | 0,0 % | 1,1 % |

`no_location_evidence` sind Termine aus Amtskalendern und Kalendern, die eine andere
Gemeinde nennen: kein Ort, also nicht öffentlich („Ort korrekt oder Quarantäne").

## Stichproben

Acht Stichproben zu je 30 öffentlichen Zeilen, jede mit neuem Seed, jede Zeile gegen
den sichtbaren Text der Quellseite geprüft (Datum, Uhrzeit, Titel; bei Zweifel die Kachel
im HTML). Die Fehler der Stichproben 1 bis 7 stehen in der Tabelle oben und sind behoben,
jeder mit Golden-Test (`src/__tests__/lib/scrapers/allgemein-de.test.ts`).

| Stichprobe | Stand | korrekt | Fehler |
|---|---|---|---|
| 1 | Lauf 1 | Sichtprüfung | Datum ohne Uhrzeit nach Leerraum, Gleichstand Mikrodaten/Liste |
| 2 | Lauf 3 | 26/30 | Viersen, Augsburg, Ratingen ohne Uhrzeit; Gemmingen ohne Uhrzeit |
| 3 | Lauf 4 | 25/30 | „Tickets kaufen" (2×), Feld im Namen, Ort als Name, Gartenabfälle sichtbar |
| 4 | Lauf 5 | 28/30 | Augsburg ohne Uhrzeit (2×) |
| 5 | Lauf 7 | 26/30 | Kopf „Aktuell notiert", „ca. 22:00 Uhr", „zum Konzert", Altenmarkt 17:30 statt 16:30 |
| 6 | Lauf 8 | 28/30 | Willich ohne Uhrzeit, Rubrik im Titel (Nettetal) |
| 7 | Lauf 9 | 29/30 | Vettelschoß „19.30 •" ohne Uhrzeit |
| 7b | Lauf 10 | 29/30 | Wemding: Öffnungszeit aus dem Text als Beginn, „Sonntag" abgeschnitten |
| **8** | **Lauf 12, frischer Cache** | **30/30** | keine |

Stichprobe 8 (Seed 8029), alle gegen die Quellseite geprüft: Wülknitz, Piesport,
Walldorf, Villmar, Gerolzhofen (2), Nettetal, Viersen, Eberdingen, Eitorf, Eningen,
Luckau, Voerde, Drei Gleichen, Freilassing, Ingenried, Ludwigsfelde, Denzlingen,
Vetschau, Denkendorf, Augsburg, Emmerich, Pfeffenhausen, Hanerau-Hademarschen,
Holzheim, Ellingen, Saarbrücken, Medebach, Goch, Schwentinental. Ort: alle mit der
Gemeinde ihres Kalenders oder in Quarantäne; ein Ortsteil („Streumen", „Pfalzdorf")
liegt in der genannten Gemeinde.

Was die Stichproben als richtig zählen: Steht die Uhrzeit nur auf der Detailseite und
nicht in der Liste (Greetsiel, Werdum), bleibt der Termin ganztägig; es wird keine
Uhrzeit erfunden. Titel, die die Quelle selbst falsch führt (Beckingen „Neujahrsempfang
2019 in Beckingen Adventssingen …" als Überschrift eines Termins 2026), bleiben wie in der
Quelle.

## Dorffeste, gegen die Quelle geprüft

* **Dorffest, FF Bergendorf** (Holzheim, Lkr. Dillingen): Liste „Sa. 17. Juli 2027
  Dorffest, FF Bergendorf, Freiwillige Feuerwehr Bergendorf, Feuerwehrhaus Bergendorf";
  Zeile 17.07.2027 ganztägig, Gemeinde Holzheim, öffentlich.
* **Feuerwehrfest** (Hetzerath, Eifel): Liste „15.05.-16.05.2027 Feuerwehrfest Feuerwehr";
  Zeile 15. bis 16.05.2027, Gemeinde Hetzerath, öffentlich.
* Weitere im Lauf: „Dorffest mit Kirchweih, FF Pessenburgheim" (Holzheim), „Feuerwehrfest
  in Borstendorf" (Grünhainichen), „Kirchweih" (Gochsheim), „Niederalteicher
  Dorfweihnacht", „Kirmeswochenende in Blintendorf" (Gefell).

## Abdeckung

Gemeinden mit mindestens einem öffentlichen Termin (eigene Kalenderseite):

| Stufe, Integration | Gemeinden | ohne URL | Startseite | mit öffentlichen Terminen |
|---|---|---|---|---|
| D `jsonld` | 61 | 0 | 0 | 48 |
| E `html_generic` | 1.165 | 1 | 128 | 478 |
| E `js_oder_feed` | 682 | 17 | 35 | 21 |
| V über Amt/VG | 49 |  |  | 8 |

Zusammen 555 Gemeinden, davon 499 der 1.847 aus Stufe E (27 %).

## Ausgeschlossen, mit Begründung

Erste Kalenderseite je Gruppe, ausgewertet aus dem Prüfstand-Cache (`why`-Auswertung):

| Gruppe | Seiten | Gemeinden | Grund |
|---|---|---|---|
| Startseiten | | 163 | Termine und Meldungen nicht zu trennen (oben) |
| kein Datum im HTML | 517 | 567 | Kalender per Skript (Google Calendar, All-in-One Event Calendar, EventON, FullCalendar) oder leer; Google Calendar sperrt alles per robots.txt (`Disallow: /`) |
| künftige Daten, keine Kachel mit Namen | 235 | 281 | Fließtext, Zeilen mit mehreren Textspalten ohne Kopf, Datum ohne Jahr; nicht sicher lesbar, also kein Termin |
| nur vergangene Daten | 191 | 207 | Kalender nicht gepflegt |
| HTTP 4xx, Netz, kein HTML | 27 | 30 | erneut prüfen in der nächsten Erhebung |
| robots.txt sperrt | 5 | 12 | nicht gelesen |

## Offen

* `js_oder_feed`: die Feeds der WordPress-Plugins (All-in-One Event Calendar mit
  iCal-Export, Event Organiser `eo-events`, ICS Calendar) als eigene Adapter; die 31
  ai1ec-Seiten der Probe zuerst.
* Termine, die die Quelle führt, aber keine öffentlichen Veranstaltungen sind (Ferien,
  Feiertage wie „1. Weihnachtsfeiertag" in Högersdorf), bleiben sichtbar; keine Wortliste.
* Nachtlauf in fn-29.18 (Shards, Fortsetzungs-Cursor): der frische Prüfstand-Lauf brauchte
  22 Minuten (3.475 Abrufe, vier Websites gleichzeitig).
