# DE-Adapter communice (fn-29.8, Prüfstand 2026-10-30)

communice web ist das kommunale TYPO3-Paket der inixmedia GmbH (Schwentinental, Bamberg),
Kalender-Extension `communice_calendar`. Der Adapter `de-communice`
(`src/lib/scrapers/de/CommuniceDeScraper.ts`, Parser `communice.ts`) liest die
Kalenderliste aller Registry-Einträge mit Merkmal `communice` (301 eigene, 49 über das
Amt; 187 verschiedene Registry-Seiten, daraus 155 Kalender), zwölf Termine je Seite
(`…/seite-N`), höchstens 40 Seiten. Er steht in `DE_SCRAPERS`, nicht im Nachtlauf
(fn-29.18). Abrufe über `BaseScraper.fetchHtml`, robots.txt je Website, mindestens 1 s
Pause.

## Nutzungsrecht (vor dem Bau geprüft)

Der Bayern-Bericht empfahl eine Anfrage an inixmedia nach zentralem Export und
Kundenliste; eine Lizenz war dort nicht verlangt. Geprüft am 2026-10-30:

* robots.txt: amt-boostedt-rickling.de, mitteldithmarschen.de, adelzhausen.de,
  neuburg-am-inn.de antworten 404 (keine Sperre); inixmedia.de sperrt nur `/typo3/`,
  `/*?id=*` und ein Formular. Im Lauf sperrten 22 Gemeinde-Websites des Amts Schenefeld den
  iCal-Download (`ical-download`), das hält der Adapter ein.
* Impressum: Herausgeber ist die Gemeinde bzw. das Amt (Körperschaft des öffentlichen
  Rechts), inixmedia steht nur unter „Realisierung“. Nutzungsbedingungen von inixmedia für
  Dritte gibt es auf den Kundenseiten nicht. Adelzhausen trägt die übliche bayerische
  Klausel (Vervielfältigung urheberrechtlich geschützten Materials nur mit Einwilligung);
  übernommen werden Termindaten, Text der Liste und Bild mit Quellenangabe, wie bei allen
  übrigen Gemeinde-Adaptern.

Ergebnis: keine Lizenz- oder Erlaubnispflicht, Bau freigegeben.

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Der Atom-Feed `…/rss` nennt bei Terminen ohne Uhrzeit die Uhrzeit der Anlage | Mitteldithmarschen „Churchnight“ 30.10.2026: Feed 12:10, Liste und Detailseite ohne Uhrzeit (`calendar-datetime--single-day-full-day`); Barlt „Laternelaufen“ Feed 12:07 | Feed nicht genutzt, nur die Liste |
| Feed leer heißt Kalender leer | Bad Segeberg, Wilster: „Keine Veranstaltung gefunden“ | Liste als Quelle, leere Liste erkannt |
| Zwei Vorlagen | neu: `.calendar-detail--meta--datetime`, `…--location`, `…--labels` (Mitteldithmarschen, Teisendorf); alt: `ul.list-meta-date` mit Kalender-, Uhr- und Ortssymbol (Babenhausen, Wacken) | beide gelesen |
| Mehrtägig ohne Jahr des Beginns | „14.11. – 31.12.2026“ begann am 14.11.2025 (Feed), Babenhausen „31.10. 09:33 Uhr – 31.12.2026“ am 31.10.2024 | Jahr aus dem iCal des Termins (Detailseite → Link mit cHash), nur wenn Tag und Monat passen; schon beendete Termine ohne Abruf verworfen; ohne iCal kein Termin (44, alle Amt Schenefeld, robots.txt) |
| Ende vor dem Beginn | Babenhausen „Christkindlmarkt im Schloss“: iCal `DTSTART 20261205`, `DTEND 20251207` | Ende offen |
| „00:00 Uhr“ ohne Ende ist die leere Uhrzeit | Reichertsheim „Nikolausdienst Landvolk Ramsau“ 06.12.2026 | ganztägig (Regel wie `jsonld.ts`) |
| Die Liste zeigt das Ende nicht immer | Mitteldithmarschen „Wochenmarkt“: Liste 08:00 Uhr, Detailseite 08:00 bis 12:30 Uhr | Ende nur, wenn die Liste es zeigt |
| Amtskalender: Etikett nennt die Gemeinde oder den Ortsteil | Mitteldithmarschen „Laternelaufen/ Martinsumzug“ Etikett Sarzbüttel; „Tensbüttel-Röst“ | Etikett, das genau eine Gemeinde des Amts nennt (Destatis), ist die Gemeinde; Rubriken („Kultur“) werden Kategorie |
| Etikett und Veranstaltungsort widersprechen sich | „Churchnight“: Etikett Bargenstedt, Ort Heide | Ort gilt (`otherGemeindeNamed`, 30 km) |
| Gemeinde-Websites eines Amts teilen eine Datenbank | „Laternenumzug Schenefeld“ auf wacken.de, vaale.de, besdorf.de und 20 weiteren; Holzland-Kopien `austraglertreffen-914/-940/-953` | gleicher Pfad ohne Zählsuffix, Beginn, Titel und Ort = ein Termin; die Website ist dann kein Ortsbeleg, Gemeinde nur aus Etikett, Ort oder Titel; Vertreter ist der Kalender mit der kleinsten URL (Dubletten 14,0 % → 0,0 %) |
| Kalender für zwei Gemeinden ohne Ortsnennung | Babenhausen/Kirchhaslach „DAV Ortsgruppe Babenhausen: Kletterhalle-Ottobeuren“ | kein Ort, Quarantäne |
| Laubannahme am Bauhof ist ein Gemeinde-Dienst | Wacken 07.11.2026 | Vokabular `municipal-service.ts`: `laub(annahme|abgabe|abfuhr|entsorgung)` |
| Registry nennt teils eine Detailseite oder die Startseite | Wacken `…/veranstaltung/laubannahme/2026-11-07?cHash=…`; amt-eider.de/ | Detail-URL → ihr Kalender; ohne Liste eine Ebene höher, dann `/veranstaltungen` |
| Bilder | Liste `img.news-image` / `event-item-image` | über `bild.ts`, robots.txt wie bei Hirsch & Wölfl |

Keine Kalenderliste (32 Registry-Seiten): andere Systeme (kalender.digital, Kirchroth
verweist auf ein externes Portal, Tourismusseiten Güstrow/Torgau/Malchow), Unterseiten
ohne Kalender (Märkte, Kulturkreis, Nachrichtenartikel) und Startseiten ohne
`/veranstaltungen`. 20 Seiten nicht lesbar (404 oder kein HTML).

`source_id` = `communice-<Host>-<Pfad nach /veranstaltung/>`, bei Serien mit Datum in der
URL oder derselben Seite an mehreren Tagen mit dem Tag. Der TYPO3-Pfad bleibt bei
Titeländerungen in der Regel stehen; ein verschobener Termin behält seine Zeile.

## Ergebnis

Erster Lauf online (1.245 Abrufe), danach offline aus dem Cache mit dem endgültigen
Parser. Geliefert 3.179, verworfen 15 (`start_in_past`), geschrieben 3.164, öffentlich
2.793, Quarantäne 371 (`no_position` 230, `no_location_evidence` 93, `municipal_service`
41, `placeholder_location` 5, `start_too_far_ahead` 3). `no_position` und
`no_location_evidence` sind Termine aus Amts- und Verbundkalendern, die keine Gemeinde
nennen.

| Prüfung | communice | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 9,2 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,1 % |
| Dubletten in der Quelle | 0,0 % (vor der Verbund-Regel 14,0 %) | 1,1 % |

Stichprobe (30 öffentliche Zeilen, Seed des Prüfstands) gegen die Detailseiten: 30 von
30 Titel, Datum, Uhrzeit und Ort korrekt, darunter Ortsteile (Schönningstedt → Reinbek,
Waldhausen → Schnaitsee, Lohklindt → Breiholz, Schwindach → Schwindegg) und
„Oberpfälzer Erntedankbauernmarkt“ Schwarzenfeld mit Jahr aus dem iCal (Liste
„09.10. 10:00 Uhr – 10.10.2027“). Gefunden und behoben: „Nikolausdienst Landvolk Ramsau“
stand mit „00:00 Uhr“ in der Quelle, jetzt ganztägig (25 Zeilen geändert).

## Dorffest-Probe gegen die Quellseite

| Termin | Adapter | Quellseite |
|---|---|---|
| Dorffest der Ortsvereine, Großkarolinenfeld | 03.07.2027 15:00, Kolbererplatz/Max-Joseph-Halle, Gemeinde Großkarolinenfeld | 03.07.2027 15:00 Uhr, Kolbererplatz/Max-Joseph-Halle |
| Weihnachtsmarkt Westermoor | 06.12.2026 11:00, Moordörper-Huus, Gemeinde Westermoor | 06.12.2026 11:00 bis 17:00 Uhr, Moordörper-Huus |

Weitere im Lauf: Kirchweih Greßhausen (Gädheim), Kirchweih Losaurach (Markt Erlbach),
Dorffest Eldering (Steinkirchen), Adventsmarkt in Grundhof, Weihnachtsmarkt Christiansholm,
Schützenfest 75 Jahre Schützenverein „Glück-Auf“ Stulln.

## Offen

* Öffentliche Sitzungen (Birkenau „Einladung zur Sitzung des Ausschusses …“) bleiben wie in
  Österreich sichtbar; Entscheidung offen (gilt für AT und DE gemeinsam).
* Termine eines Verbunds ohne Ortsnennung bleiben in Quarantäne
  (`no_location_evidence`, `no_position`), auch wenn sie im Ortsteil einer der Gemeinden
  stattfinden („Kirchweihfeier, Forster Burgharting“ auf drei Websites des Holzlands).
* 137 Registry-Einträge ohne bestätigten Feed liest der Adapter über ihre Kalenderseite
  mit; eine nächste Erhebung kann die 32 Seiten ohne Liste neu zuordnen.
