# DE-Adapter Advantic iKISS (fn-29.13, Prüfstand 2026-10-30 bis 2026-11-02)

Advantic liefert das Kommunal-CMS iKISS mit dem Veranstaltungsmodul `ModID=11`. Der
Adapter `de-ikiss` (`src/lib/scrapers/de/IkissDeScraper.ts`, Parser `ikiss.ts`) liest die
Veranstaltungsliste aller Registry-Einträge der Integration `ikiss` (364 Gemeinden, 190
Kalenderseiten; 75 Einträge ohne Kalenderseite über die Startseite ihrer Website, dazu
62 Ausweichwege über Amt bzw. VG; zusammen 226 Kalender) und je Termin die Detailseite.
Er steht in `DE_SCRAPERS`, nicht im Nachtlauf (fn-29.18).

## Abrufe

robots.txt der Kunden sperrt `/cache/`, `/output/` (dort liegt der iCal-Export je Termin),
`/suche.phtml`, `/redirect.phtml`, `/showobject.phtml`; keiner setzt Crawl-delay. Der
Adapter ruft nacheinander ab, mindestens 1 s Pause, über `BaseScraper.fetchHtml` mit dem
Schalter `charset` (PR #408): die meisten iKISS-Websites liefern ISO-8859-15, ohne den
Schalter würden Umlaute zu Ersatzzeichen. Je Kalender höchstens 300 Termine ab heute. Ein
Lauf über alle Kalender: 8.465 Abrufe, gut zwei Stunden; fn-29.18 muss den Adapter auf
Shards verteilen.

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Drei Listenvorlagen, nicht jede trägt Uhrzeit und Ort | `result-list veranstaltungen` mit Kategorie und Ort (Pfatter), `list-title` (Kasseburg), `liste_titel` nur mit Datum (Amt Hohe Elbgeest) | Liste nur für die Detailseiten (`…?ModID=11&FID=<Mandant>.<ID>.<Sprache>`), maßgeblich ist die Detailseite |
| Folgeseiten über `ofs_<Liste>=<Versatz>` | Pfatter `ofs_2=25`, Hamwarde `ofs_1=25` mit Gemeinde-Filter `ort=1798.5` | Versatz bis zur Zahl aus „Es wurden N Veranstaltungen gefunden“ |
| Vier Vorlagen der Detailseite | „Datum:“/„Uhrzeit:“ in `column-3` (Pfatter) oder `spalte_links` (Hamwarde); `dl.object-data` mit „Beginn:“/„Ende:“ (Gemünden (Felda), Gießen); `.event-info` mit `<time>` und Kartenlink (Hennigsdorf) | Beschriftung und Wert als Paar; Icons in der Beschriftung zählen nicht, Screenreader-Text („Datum: “ als `sr-only`) ist keine Beschriftung |
| Erstes `<h1>` ist nicht immer der Titel | Algermissen: „Veranstaltungen“ im Suchformular (273 Termine im ersten Lauf vom Sync als Müll verworfen); Kleinmachnow: Überschrift einer Nachricht („Veränderte Öffnungszeiten im Bürgerbüro“ an 86 Terminen) | Titel ist das letzte `<h1>` vor dem Datumsfeld |
| Datum aus fremden Listen auf der Detailseite | Wismar: Slider mit „Datum: 20.12.2024“ vor dem Termin; Amt Schrevenborn: Teaserliste | Screenreader-Beschriftungen ausgeschlossen; Wismar liefert damit 281 Termine statt 300 verworfener |
| Monatsnamen | Bad Oldesloe „14. November 2026“, Hennigsdorf „04. Dezember 2026 bis 06. Dezember 2026“ | in Ziffern umgesetzt |
| Ende „23:59“ ist die Vorgabe des Formulars | 147 von 7.910 Detailseiten enden um 23:59, 138 davon aus Lennestadt („14:45 bis 23:59“) und Oberviechtach („04:00 bis 23:59“) | Ende bleibt offen, ein anderes Enddatum bleibt |
| Ort mit Adresse oder nur Name, dazu „Ortschaft:“, „Gemeinde:“, „Region:“ | Pfatter „Gasthaus zur Post (Gierstorfer), Haidauer Str. 29, 93102 Pfatter“; Hamwarde „Ortschaft: Hamwarde, Region: Amt Hohe Elbgeest“ | Adresse in Felder; Ortschaft, Gemeinde und Region nennen im Amtskalender die Gemeinde des Termins, sind aber kein Ortsname |
| Adresse in einer Zeile oder PLZ zuerst | Bützow „Gutshotel Groß Breesen · Groß Breesen 10 · 18276 Zehna“; Elmshorn „Stadtbücherei Elmshorn, Königstraße 56, 25335 Elmshorn“; Kleinmachnow „14532 Kleinmachnow“ vor „Rathaus Kleinmachnow, Bürgersaal“ | an `·` bzw. Komma geteilt, wenn ein Teil mit einer PLZ beginnt; mehr als Name und Straße vor der PLZ bleibt Ortsname („Caritashaus, Kirchplatz1, 1. Etage, Raum 1“) |
| Kartenlink mit Koordinate | Hennigsdorf `maps?q=52.637430,13.204573` | als Koordinate der Quelle |
| RSS statt Kalenderseite in der Registry | Giesen, Holle, Kelsterbach, Wismar `/media/rss/<Name>.xml`, 20 Einträge, `<generator>IKISS</generator>` | Kanal-Link ist die Liste, sonst die Einträge des RSS |
| RSS verlinkt einen internen Host | Magdeburg `projekt13.kid-magdeburg.de` (HTTP 401) | derselbe Pfad auf der Website des RSS (geprüft, 79 Termine) |
| Registry-Seite ohne Liste | Teaser „Weitere Termine“ (amt-vioel.de), Rubrikseiten | Kalenderpfad der verlinkten Detailseiten (`<Pfad>/<Slug>.php` → `<Pfad>/`) |

Kalender ohne Termine im Lauf: 88 Registry-Seiten tragen keine Veranstaltungsliste
(Raumvermietung, „Veranstaltungsorte“, Klimaschutz, Terminvergabe, eTermin, fremde
Kalender wie glueckstadt-tourismus.de). Nicht lesbar: Schellerten (134 Termine) und Freden
(2) leiten jede Detailseite auf eine kaputte Adresse um (HTTP 307 auf
`…/Veranstaltungen/https://…`, Fehler der Website), Kreis Lippe-Weser (4) und
Einzelseiten mit HTTP 404. Sieben Kalender haben mehr als 300 Termine (Geesthacht 1.717,
Neustadt in Holstein 894, Elmshorn 699, Korbach 640, Quedlinburg, Leonberg, Wismar); die
Liste beginnt heute, spätere Termine rücken in den folgenden Nächten nach. Acht
Detailseiten tragen keinen Termin (Amt Eiderstedt, Neustadt an der Weinstraße, Westliche
Börde: Seiten ohne Datum).

## Ergebnis

Termine aus 119 Websites. Geliefert 7.626, verworfen 453 (`start_in_past`, Lauf
2026-11-02 aus dem Cache vom 30.10.), geschrieben 7.173, öffentlich 6.713, Quarantäne 460
(`municipal_service` 211, `no_location_evidence` 151, `no_position` 68,
`placeholder_location` 16, `start_too_far_ahead` 14). Die Ortsquarantäne trifft vor allem
Bergen auf Rügen (104), die VG Königstein (48) und Bützow (17): ihre Kalender gehören
mehreren Gemeinden (Bergen zehn), die Termine nennen keinen Ort oder nur einen Namen, und
die Adresse im Seitenkasten gehört dem Veranstalter. Gegenüber dem ersten Lauf
(6.736 geschrieben) bringen die Korrekturen 437 Zeilen mehr (Wismar 281, Algermissen,
Magdeburg, Hennigsdorf, Kelsterbach), 83 richtige Titel (Kleinmachnow) und Adressen in
Feldern statt im Ortsnamen; letzter Lauf offline aus dem Cache mit dem endgültigen
Parser.

| Prüfung | iKISS | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 5,3 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,1 % |
| Dubletten in der Quelle | 0,1 % | 1,1 % |

Gemeinde-Dienste aus echten Proben in Quarantäne (nach den bestehenden Regeln von
`municipal-service.ts`, keine Sonderregel im Adapter): Bürgermeistersprechstunden (28,
Amt Hohe Elbgeest), „Elterntreff mit Hebammensprechstunde“ (66), Pflege- und
Digitalsprechstunden. Sitzungen bleiben sichtbar: Entscheidung des Users vom 2026-11-02
(„Nein, sichtbar lassen“), Gemeinderats- und Ausschusssitzungen bleiben in AT und DE
sichtbar, nur die Smart-Suche filtert sie. 261 öffentliche Zeilen mit Sitzung,
Gemeinderat, Stadtrat oder Ausschuss im Titel (Lennestadt 41 von 202). Qualitätsvertrag Punkt 5 im Epic und das Ticket sind
entsprechend angepasst.

Stichprobe gegen den Text der Detailseite, zweimal je 30 öffentliche Zeilen aus dem
Bericht (Lauf vom 02.11. vor und nach den Ortskorrekturen): beide Male 30 von 30 Titel,
Datum, Uhrzeit und Ort korrekt. Ganztägig, wo die Seite keine Uhrzeit nennt
(Giesen „Familienwandertag“); Termine 2027 und 2028 in Sommer- und Winterzeit richtig
(Norddeich „Wochenmarkt“ 26.05.2028 08:00, Teunz 18.09.2027 07:00); Ortsteile der richtigen
Gemeinde (Heiningen in der Samtgemeinde Oderwald, Teunz über „Ortschaft: Gemeinde Teunz“,
Jersbek im Amt Bargteheide-Land). Seesen „Offenes Gründungscoaching“ trägt als Ortsnamen
wörtlich „Pei e“, die Adresse darunter (Poststraße 14, 38723 Seesen) stimmt; Velten nennt
„kein Raum bekannt“, der Termin gilt der Gemeinde Velten.

Dorffeste gegen die Quellseite:

* „Schützenfest Hordorf“, Oschersleben (Bode): Seite 16.07.2027 bis 18.07.2027, ohne
  Uhrzeit, Festplatz, Ortschaft Hordorf; Zeile ganztägig über drei Tage, Gemeinde
  Oschersleben (Bode), öffentlich.
* „Freie Wähler Königstein - Backofenfest“, Königstein (Oberpfalz): Seite 16.05.2027,
  14:00 Uhr, Rathaus Königstein, Oberer Markt 20, 92281 Königstein; Zeile 14:00 Ortszeit,
  öffentlich.

Dorffest-artige Titel im Lauf (Schützenfest, Kirmes, Dorffest, Erntefest, Laternenumzug,
Sommerfest, Weinfest u. a.): 50, davon 47 öffentlich.

## Offen

* Lauf über alle Kalender gut zwei Stunden (Detailseiten): fn-29.18 verteilt den Adapter
  auf Shards; Detailseiten schon bekannter FIDs müssten nicht jede Nacht neu geladen werden.
* 88 Registry-Seiten ohne Veranstaltungsliste; die Registry nachpflegen.
* Schellerten und Freden leiten Detailseiten auf kaputte Adressen um; Hinweis an die
  Gemeinden wäre der einzige Weg.
