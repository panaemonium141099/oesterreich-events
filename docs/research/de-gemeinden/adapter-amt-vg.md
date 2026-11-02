# Amts- und VG-Kalender als Ausweichweg (fn-29.17, Prüfstand 2026-11-02)

733 Gemeinden der Registry (Stufe V) haben keinen eigenen Kalender; die Vollerhebung
nennt für sie den Kalender ihres Amts, ihrer Verbandsgemeinde, Samtgemeinde oder
Verwaltungsgemeinschaft (`fallback.kind = 'verband'` in `data/de-gemeinde-registry.json`).
Diese Kalender laufen über die Systeme, für die es schon Adapter gibt. Gebaut wurde
deshalb kein zweiter Weg neben den Adaptern, sondern nur, was an der Verband-Zuordnung
fehlte. Ein Termin bekommt weiter nur die Gemeinde, die er selbst nennt
(`terminContext` in `src/lib/scrapers/de/kontext.ts`); nennt er keine, bleibt der Ort
offen und der Freigabevertrag hält ihn zurück.

## Ausgangslage

Vor dem Bau führten die Adapter 382 der 733 Gemeinden schon als `viaVerband` in ihren
Kalendergruppen (ionas 188, ikiss 62, nolis 42, allgemein 39, communice 33, weblication 7,
typo3 5, tribe 3, hw 2, digipublica 1). Gemessen mit allen Gruppenfunktionen der Adapter
gegen die Registry.

## Was gebaut wurde

| Lücke | Beleg | Umsetzung |
|---|---|---|
| Derselbe Kalender in zwei Schreibweisen war zwei Kalender; liest ihn eine Gemeinde allein, bekamen alle Termine des Amts deren Ort | Amt Nordsee-Treene: Mildstedt mit `http://`, elf Gemeinden mit `https://`; VG Lambsheim-Heßheim: Kleinniedesheim mit `events.json`, Heßheim mit `events.json?weekends=false&tagMode=ALL` | `pickFeedGroups` (`registry-de/load.ts`): gleiche Adresse (Protokoll, www, `&amp;`, Schrägstrich; ionas ohne Ansichts-Parameter) wird ein Kalender, mit allen Gemeinden. Er ist dann ein Amtskalender. |
| Liefert ein Amtskalender einen Termin, den die Gemeinde selbst führt, entschied die Reihenfolge, welche Zeile gilt | Ahlden: Grethem führt einen Ausschnitt des Samtgemeinde-Kalenders, gleiche UID | Kalender genau einer Gemeinde laufen vor den Amtskalendern; Sync und Prüfstand behalten je `source_id` die erste Zeile, also die der Gemeinde. Keine zweite Zeile, gleiche `source_id`. |
| MEC las keine Ausweichwege | Krostitz, Gundelfingen, Holzheim | `mecGroups` nimmt `fallback` auf |
| communice: Amt ohne Kalenderseite in der Erhebung | Amt Probstei (9), Kisdorf (4), Ostholstein-Mitte (2), Dänischer Wohld (1) | Standardseite des Herstellers `/veranstaltungen` (`calendarPageCandidates`, belegt in 03-schleswig-holstein) |
| Registry: Amt ohne Kalender-URL bekam nie einen Feed-Versuch | Builder fragte nur `vb_event_url` | Feed-Lauf fragt die Startseite des Amts (`verbandHomeUrl`), dann die Standardseiten; neu `--workers 1` für seriellen Abruf. Ergebnis: Amt Büsum-Wesselburen, Samtgemeinde Sottrum (NOLIS), Amt Ostholstein-Mitte (communice) |
| tribe: Erhebung verlinkte den iCal-Export statt der Kalenderseite | VG Leinetal `/events/?ical=1` | Standardseite `/events/` (Archiv des Plugins); Feed jetzt für Geisleden, Reinholterode, Wingerode |
| Die Verwaltung als Ortsangabe galt als Nennung der gleichnamigen Gemeinde | Kalender der Samtgemeinde Hanstedt: „Sitzung des Ausschusses … der Gemeinde Egestorf“, Ort „Samtgemeinde Hanstedt“, zugeordnet zu Hanstedt (erste Stichprobe) | Etiketten-Regel in `namedGemeinden`: „Samtgemeinde, Verbandsgemeinde, Verwaltungsgemeinschaft, (Gemeinde)Verwaltungsverband, Amt, VGem, VG“ mit Namen nennen die Gemeinde nicht. „Lembruch, Samtgemeinde Lemförde“ nennt weiter Lembruch. „SG“ bleibt ein Name (meist Sportgemeinschaft). Wirkung: 16 Zeilen von sichtbar in Quarantäne, eine gewonnen (Rheinzabern, siehe unten). |

Die Adapter nehmen dazu `(limit?, onlyVerband = false)` im Konstruktor und wählen ihre
Kalender über `DeFeedScraper.pickGroups`. Die Prüfstand-Sicht `de-amt-vg`
(`AmtVgDeScraper.ts`) lässt jeden betroffenen Adapter nur seine Kalender mit
`viaVerband`-Gemeinden lesen; die Zeilen tragen `source_name` und `source_id` des Adapters.
Sie steht in `DE_PRUEFSTAND_SCRAPERS`, nicht in `DE_SCRAPERS`, und gehört nicht in den
Nachtlauf: dort lesen die Adapter ihre Amtskalender ohnehin mit (fn-29.18).

Abrufe: über `DeFeedScraper` (robots.txt je Website, Crawl-delay, mindestens 1 s Pause,
`BaseScraper.fetchHtml`), seriell, nur GET. Der Registry-Feed-Lauf lief mit `--workers 1`.

## Prüfstand

`npm run pruefstand:de -- --adapter de-amt-vg`, Quellstand 2026-11-02 (828 Abrufe),
danach offline mit der Etiketten-Korrektur:

| Prüfung | de-amt-vg | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 9,8 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,1 % |
| Dubletten in der Quelle | 0,1 % | 1,1 % |

Geliefert 4.308 (ionas 834, NOLIS 1.526, communice 617, allgemein 523, ikiss 398, tribe 166,
hwveranstaltung 157, MEC 47, weblication 23, typo3 12, digipublica 5), verworfen 54
(`start_in_past`), geschrieben 4.247, öffentlich 2.824, Quarantäne 1.423
(`no_location_evidence` 891, `no_position` 429, `municipal_service` 104,
`start_too_far_ahead` 4, `placeholder_location` 2).

Stichprobe 1 (30 öffentliche Zeilen): 29 von 30. Titel, Datum und Uhrzeit stimmten alle;
der Ausschuss der Gemeinde Egestorf stand in Hanstedt (Etikett, siehe oben, behoben).
Stichprobe 2 nach der Korrektur (30 neue Zeilen): 30 von 30 Titel, Datum, Uhrzeit und Ort.
Geprüft gegen die Detailseite; bei ionas, wo die Quelle nur die Kalenderseite zeigt, gegen
den iCal-Export und `events.json` der Kalenderseite (Winterzeit und Sommerzeit,
z. B. Eich 23.10.2027 17:00 = 15:00 UTC). Ganztägig bleibt ganztägig (Seulingen
14.11.2026 „ohne Uhrzeit“ laut Detailseite).

## Dorffest gegen die Quelle

„Schlachtfest beim PWV Hinzweiler“, Kalender der VG Lauterecken-Wolfstein (ionas).
Hinzweiler hat keinen eigenen Kalender (Stufe V). Die Kalenderseite der VG liefert über
`events.json`: 22.11.2026 ganztägig, Ort „Hinzweiler“, Kategorie „PWV Hütte“. Unsere
Zeile: 22.11.2026 ganztägig, Gemeinde Hinzweiler, öffentlich. Dazu aus Stichprobe und
Korrektur: „Anneresel Weihnachtsmarkt“, VG Jockgrim, 27. bis 29.11.2026, Detailseite
„Ortschaft: Rheinzabern, Region: Verbandsgemeinde Jockgrim“; vorher machte das VG-Etikett
den Termin mehrdeutig (Quarantäne), jetzt Rheinzabern.

## Abdeckung der 733 Gemeinden

* In einer Kalendergruppe eines Adapters: 406 (vorher 382).
* Amtskalender lieferte im Lauf Termine: rund 255 (nach Website des Amts gezählt).
* Gemeinde mit mindestens einem eigenen, sichtbaren Termin: **80** (11 %).
  `npx tsx src/scripts/amt-vg-abdeckung.ts` nach dem Prüfstand-Lauf.

| Integration des Amts | Gemeinden | mit Termin |
|---|---|---|
| ionas | 340 | 38 |
| verwaltungsportal | 74 | 0 |
| ikiss | 62 | 6 |
| nolis | 54 | 26 |
| communice | 49 | 6 |
| html_generic, js_oder_feed | 49 | 1 |
| deskline, destinationone, termineregional, stadtlandnews, outdooractive, embed_other | 54 | 0 |
| übrige | 51 | 3 |

Warum aus 255 nur 80 werden: Ein Amtskalender ordnet nur zu, was der Termin selbst nennt.
Viele Termine nennen den Ort gar nicht oder nur einen Ortsteil ohne Gemeinde
(„Steinhöfel OT Jänickendorf“ ohne Straße, Amt Odervorland), die meisten liegen im Sitz
des Amts. Diese Termine bleiben ohne Ort in Quarantäne, wie der Qualitätsvertrag es
verlangt; ein Gemeinde-Mittelpunkt des Amts ist kein Ort des Termins.

## Offen (nicht in diesem Task)

* **152 Gemeinden in Rheinland-Pfalz über ionas ohne TVM-Kalender:** Die VG-Websites laufen
  auf dem ionas-CMS, haben aber kein `events.json` (Builder fragte Kalenderseite und
  `/kalender/`, `/veranstaltungen/`, `/termine/`). Belege: VG Wittlich-Land zeigt „Es
  wurden keine Termine gefunden“, Bitburger Land verlinkt auf eifel-direkt.de,
  Simmern-Rheinböllen lädt die Liste per Skript nach. Eigener Adapter nötig.
* **verwaltungsportal (74):** Adapter PR #401 als Entwurf, IP-Sperre nach parallelen
  Abrufen (fn-29.11).
* **Tourismus-Systeme (54):** deskline, destination.one, termine-regional, stadtlandnews,
  outdooractive; kein Gemeinde-Adapter (Epic-Grenze: nur eingebettete Gemeinde-Widgets).
* **„Gemeinde OT Ortsteil“ im Ortsfeld** (tribe, Amt Odervorland: „Jacobsdorf OT
  Pillgram“) liest der Resolver nicht; die Termine stehen in Quarantäne. Das betrifft den
  gemeinsamen Resolver und gehört in eine eigene Aufgabe.

## Tests

`src/__tests__/lib/scrapers/amt-vg-de.test.ts`: Gruppen (gleicher Kalender, Gemeinde vor
Amt, `onlyVerband`), Ausweichwege MEC und communice, Etiketten-Regel, Golden-Tests aus
dem Prüfstand-Cache: VG Lauterecken-Wolfstein (RP, ionas: Dorffest ganztägig, Gemeinde aus
dem Titel, Winter-Offset, Termin ohne Ort in Quarantäne), Samtgemeinde Sottrum (NI, NOLIS:
Mitgliedsgemeinde, Bürgermeistersprechstunde als Gemeinde-Dienst, ganztägig), Amt
Odervorland (BB, The Events Calendar: Adresse in Briesen (Mark), Ortsteil ohne Gemeinde
in Quarantäne). `registry-de.test.ts`: Feed von der Startseite des Amts.
