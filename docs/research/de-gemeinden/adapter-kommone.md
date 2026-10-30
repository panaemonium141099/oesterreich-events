# DE-Adapter Komm.ONE Online-Suite (fn-29.10, Prüfstand 2026-10-30)

Komm.ONE liefert baden-württembergischen Gemeinden die Online-Suite mit dem
Veranstaltungsmodul der „dvv-Zusatzmodule“. Der Adapter `de-kommone`
(`src/lib/scrapers/de/KommOneDeScraper.ts`, Parser `kommone.ts`) liest die Terminliste
aller Registry-Einträge der Integration `komm1` (121 Kalenderseiten bzw. Feeds für
137 Gemeinden; 16 Einträge ohne Seite und Feed sowie Böllen, dessen GVV Schönau keine
Kalenderseite in der Registry hat, bleiben ohne Abruf). Er steht in `DE_SCRAPERS`, nicht im
Nachtlauf (fn-29.18).

## Abrufe

robots.txt aller geprüften Kunden: `Crawl-delay: 30`, gesperrt `/common/`, `/master/`,
`/zm/`, `/pirobase`, `/webadmin`; `/site/` frei. Die Websites liegen in wenigen
Komm.ONE-Netzen (DNS 2026-10-30: 46 auf 194.0.95.240, 86 in 194.59.37.0/24). Der Adapter
ruft nacheinander ab (nie zwei Abrufe gleichzeitig, mindestens 2 s dazwischen) und
wechselt zwischen den Websites, damit jede ihre 30 s Pause bekommt. Ein Lauf über alle
Kalender: 435 Abrufe in knapp 30 Minuten. Alle Abrufe über `BaseScraper.fetchHtml` mit dem neuen
Schalter `charset` (Zeichensatz aus Content-Type bzw. `<meta charset>`, nur auf Wunsch,
damit bestehende Scraper ihre Titel und source_ids behalten).

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| RSS gekürzt, Liste vollständig | Waldenbuch RSS 15, Liste 20 je Seite über fünf Seiten; Aichwald, Besigheim 10 | Terminliste, `…/node/<nodeID>/pageN/pageN` über „Weiter“ bis 10 Seiten; RSS nur, um die Liste zu finden (Kanal-Link) oder wenn es keine gibt |
| Pager-Links tragen eine Sitzungs-ID (`?zm.sid=…`) | Waldenbuch, Besigheim | ohne `zm.sid` abgerufen (geprüft: dieselbe Seite) |
| Vier Listenvorlagen | `article.vevent` mit vCard (Waldenbuch), `div.zmitem` mit `dtstart` (Schwörstadt, Bötzingen), `div.zmitem` mit Datum nur als Text (Besigheim, Ludwigsburg), Titel als Link `a.titel` (Berghaupten) | ein Parser: Datum aus `dtstart title`, sonst aus `.zmitem__time`; Titel aus `titelzmtitel`, sonst `.titel` |
| Uhrzeit frei getippt | „19:00“, „19.00 Uhr“, „10:00 - 12:00 Uhr“, „20-22 Uhr“ (Aichwald), leer bei ganztägig | Stunden ohne Minuten nur mit „Uhr“; ohne Uhrzeit ganztägig, keine erfundene Zeit |
| Ort als vCard, als Freitext oder nur Name | Waldenbuch „Schlosshof Waldenbuch, Kirchgasse 3, 71111“; Bötzingen „Gasthaus "Zur Krone", Gottenheimer Straße 1“; Besigheim „Steinhauskeller“ | vCard in Felder, sonst der Text als Ortsname; ohne Adresse gilt die Kalender-Gemeinde |
| Beschriftung im Ortsfeld | Ludwigsburg `<label>Veranstaltungsort</label> Musikhalle` (308 Zeilen) | Beschriftung entfernt |
| PLZ-Fehler der Quelle | Waldenbuch „7111“ statt 71111 | nur fünfstellige PLZ, sonst keine |
| Veranstalter mit Ansprechpartner | Schwörstadt „Schwarzwaldverein Schwörstadt e. V.<span class="fachbreich"> Clemens …</span>“ | Ansprechpartner entfernt |
| Logo als Bild | Berghaupten `logo-kksv-ok_6.png` | fällt über `bild.ts` weg |

Kalender ohne Termine im Lauf: 41 Registry-Seiten tragen kein Veranstaltungsmodul (PDF
„Veranstaltungskalender 2026“ in Dietenheim, eingebettete Fremdkalender in Biberach,
Bodelshausen, Gernsbach, Ringsheim, Wiesloch; Rubrikseiten wie „Veranstaltungsgebäude“,
„Terminvergabe“, „Impressionen von Veranstaltungen“; etermin.net), Tannheim liefert das
RSS nicht mehr (404). Termine kommen aus 55 Websites, davon 10 nur aus dem RSS (246
Zeilen, Kornwestheim, Hockenheim, Aichwald u. a.). Malsch, Böblingen, Rastatt, Urbach
und Haslach erreichen die 10 Seiten (gut 200 Termine ab heute).

## Ergebnis

Geliefert 3.474, verworfen 53 (`start_in_past`), geschrieben 3.421, öffentlich 3.338,
Quarantäne 83 (`municipal_service` 74, `no_position` 5, `placeholder_location` 3,
`start_too_far_ahead` 1). Zweiter Lauf offline aus dem Cache mit dem endgültigen Parser:
3.113 Zeilen unverändert, 308 geändert (nur der Ortsname ohne „Veranstaltungsort“), keine
neu, keine weg.

| Prüfung | Komm.ONE | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 20,5 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,1 % |
| Dubletten in der Quelle | 0,1 % | 1,1 % |

Gemeinde-Dienste aus echten Proben in Quarantäne: Altpapier- und Schrottsammlungen der
Feuerwehren, Weihnachtsbaumsammlung, „PV-Sprechstunde“. Sitzungen bleiben sichtbar wie in
Österreich und bei hwveranstaltung (71 öffentliche Zeilen mit Sitzung, Gemeinderat oder
Ausschuss im Titel); die Entscheidung dazu liegt beim User und käme als Änderung in
`municipal-service.ts` für AT und DE.

Stichprobe (30 öffentliche Zeilen aus dem Bericht) gegen die Detailseite der Quelle, je
Seite einzeln abgerufen: 30 von 30 Titel, Datum, Uhrzeit und Ort korrekt. Ganztägig ohne
Uhrzeit, wo die Seite keine nennt (Lorch „Montagswanderer“, Ludwigsburg „Formular- Guide“,
Notzingen, Heubach „Glühweinfest“); „22.00 h“ (Lorch), „19 Uhr“ (Heubach), „19:01 Uhr“
(Weikersheim „AMC Prunksitzung“) richtig gelesen; Ortsteile der richtigen Gemeinde
(Völkersbach in Malsch, Nimburg in Teningen, Laudenbach in Weikersheim). Der Tippfehler
„Leung neuer französischer Literatur“ steht so in der Quelle.

Dorffeste gegen die Quellseite:

* „Schwieberdinger Kirbe“, Schwieberdingen: Seite Sonntag, 08.11.2026, 11:30 bis 18:00,
  Rund ums Rathaus, Schloßhof 1, 71701 Schwieberdingen; Zeile 11:30 bis 18:00 Ortszeit,
  Gemeinde Schwieberdingen, öffentlich.
* „Kerwefest“, Bruchsal: Seite Sonntag, 08.11.2026, 11:30 bis 19:00 Uhr, Turnhalle
  Helmsheim; Zeile 11:30 bis 19:00 Ortszeit, Gemeinde Bruchsal.

Dorffest-artige Titel im Lauf (Kerwe, Kirbe, Kirchweih, Hocketse, Feuerwehrfest,
Weinfest, Straßenfest): 21, alle öffentlich.

## Offen

* 41 Registry-Einträge zeigen auf Seiten ohne Veranstaltungsmodul; die Registry
  nachpflegen (Waldenbuch etwa hat eine Terminliste unter
  `/start/waldenbuch+entdecken/veranstaltungen.html`, die Registry nennt
  „veranstaltungsuebersicht.html“).
* Die neuere Listenvorlage (Besigheim, Ludwigsburg) nennt nur den Ortsnamen; die Adresse
  steht auf der Detailseite, die bei 30 s Pause je Website nicht abgerufen wird.
