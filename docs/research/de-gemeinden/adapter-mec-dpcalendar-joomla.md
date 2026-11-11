# DE-Adapter MEC, DPCalendar, JEvents, iCagenda (fn-29.7 Teil 3, Prüfstand 2026-10-29)

Die vier kleineren WordPress- und Joomla-Kalender aus fn-29.7. Alle stehen in
`DE_SCRAPERS`, nicht im Nachtlauf (fn-29.18). Quelle ist die Detailseite des Termins,
wo es eine gibt; Bilder nach `bild.ts` (PR #398), wo die Quelle sie liefert.

## Zugriffswege (Umfrage über alle Registry-Websites)

| Plugin | Registry | Weg | Ergebnis der Umfrage |
|---|---|---|---|
| MEC (WordPress) | 74 Gemeinden, 62 Kalenderseiten | JSON-LD der Kalenderseite, ohne Termine dort `/events/` | 34 Websites, 799 Termine; REST `/mec/v1/events` liefert `[]`, `/wp/v2/mec-events` keine Termine, der Registry-Feed `/events/feed/` ist teils der Kommentar-Feed |
| DPCalendar (Joomla) | 30 Gemeinden, 10 Feeds | iCal-Export `task=ical.download` | 10 Feeds |
| JEvents (Joomla) | 54 Gemeinden, 33 Feeds | RSS `modlatest.rss` und Detailseite | iCal-Export `icals.export` auf 52 Websites leer; RSS auf 22 Websites |
| iCagenda (Joomla) | 25 Gemeinden | RSS der Terminliste (`?format=feed&type=rss`) und Detailseite | 10 Websites; kein JSON-LD |

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Plugin-Dateien als Kalender-URL in der Registry | 63 Einträge, z. B. MEC `…/frontend.min.css` (Bad Frankenhausen), All-in-One-Event-Calendar-CSS, ein Slider-JavaScript | Registry-Bau verwirft Datei-URLs (`eventPageUrl`); MEC nimmt dann `/events/` |
| MEC-Liste: ganztägige Termine einen Tag zu früh (Widget in UTC) | Kindenheim „Abgabebasar“: Liste 29.10., Anzeige und Detailseite „30 Okt. 2026 Ganztags“; 7 von 332 Einzelterminen | Einzeltermine bekommen Datum, Ende und Bild der Detailseite |
| MEC-Monatsansicht wiederholt laufende Termine an jedem Tag | Zella-Mehlis „Zwei Generationen“ 29.10., 30.10., 31.10., 01.11., jeweils bis 30.04.2027, Beginn laut Detailseite 19.09.2026 | ein Termin, Beginn von der Detailseite; liegt er in der Vergangenheit, verwirft ihn der Freigabevertrag wie in Österreich |
| MEC zeigt den laufenden Monat, auch vergangene Tage | 472 Termine `start_in_past` | vom Schreibweg verworfen, richtig |
| DPCalendar `TZID=UTC` ist die Ortszeit | Weimar (Lahn) „Angst im Dunkeln“ 20:00 UTC, Seite 20:00; ebenso Mehlbek, Birgel, Oersdorf, Poyenberg | als Europe/Berlin gelesen; echte UTC (`Z`, Google-Spiegel Bramstedtlund) bleibt UTC |
| DPCalendar: Wiederholungen (`RRULE`, `EXDATE`, `RECURRENCE-ID`) | Bramstedtlund „Kirchspielarchiv“ jeden Mittwoch | node-ical `expandRecurringEvent`, ein Jahr ab heute |
| DPCalendar-Terminlink auf fremder Website | Poyenberg verlinkt den Veranstalter | Link nur auf derselben Website, sonst Kalenderseite (Bramstedtlund und Mehlbek haben keine Terminseite) |
| JEvents: Datum und Uhrzeit im RSS-Titel, Ende und Ort auf der Detailseite | Schönwalde „02.11.2026 09:30 Uhr : Bewegung im Alter“, Seite „09:30 Uhr - 10:30 Uhr“ | Detailseite vor RSS; abgewandelte Vorlagen (Rauschenberg, Nordendorf) über den Inhaltsbereich; „Ort“ als Beschriftung ist kein Ort |
| JEvents-RSS zeigt laufende Termine mit dem heutigen Datum | Nordendorf „Bühnenaufbau“, Seite 03.08. bis 23.11. | Datum der Detailseite |
| iCagenda: Vorlagen je Website verschieden | Titel in `h1` oder `h3`, Datum ISO, „04.12.2026“ oder „14. November 2026“, Ort als Absatz, Tabellenzelle oder hinter dem Ortssymbol, Zeiträume `ic-period` | Leser für alle Varianten; 89 von 89 Detailseiten gelesen |
| Schließung der Verwaltung und DRV-Beratung waren sichtbar | „Meldeamt geschlossen“ (Rosenthal am Rennsteig), „Beratungstermin der Deutschen Rentenversicherung“ (Auerbach) | Gemeinde-Dienst: `office_closed` (Verwaltungswort und „geschlossen“), `beratungstermin` bei den Sprechtagen; gilt auch für Österreich |

## Ergebnis

| Adapter | geschrieben | öffentlich | Quarantäne | Müll | ohne Uhrzeit | sichtbar ohne Koordinaten | Dubletten | Gemeinde-Dienste sichtbar |
|---|---|---|---|---|---|---|---|---|
| MEC | 394 | 360 (206 mit Bild) | 34 | 0,0 % | 47,2 % | 0,0 % | 0,3 % | 0 |
| DPCalendar | 237 | 218 | 19 | 0,0 % | 13,1 % | 0,0 % | 0,0 % | 0 |
| JEvents | 69 | 63 | 6 | 0,0 % | 17,4 % | 0,0 % | 0,0 % | 0 |
| iCagenda | 127 | 127 | 0 | 0,0 % | 24,4 % | 0,0 % | 0,0 % | 0 |

Grenzen (AT): Müll 0,1 %, ohne Uhrzeit 61,1 %, sichtbar ohne Koordinaten 0,07 %,
Dubletten 1,1 %, Gemeinde-Dienste 0.

Stichproben (je 30 öffentliche Zeilen, Seed 29) gegen die Detailseiten: Titel, Datum
und Uhrzeit nach den Korrekturen oben übereinstimmend. Gefunden und behoben wurden
dabei Weimar eine Stunde zu spät, Kindenheim einen Tag zu früh, laufende Ausstellungen
mit erfundenem Beginn, „Ort“ als Ortsname und fehlende Uhrzeiten abgewandelter
JEvents-Vorlagen. Ohne strukturierte Uhrzeit bleibt ein Termin ganztägig (Rhens
„Wochenmarkt“: „15:00 bis 18:00“ steht nur in der Beschreibung).

Dorffeste gegen die Quellseite: MEC „Weihnachtsmarkt in Dorf Mecklenburg“ 05.12.2026;
DPCalendar Weimar (Lahn) „St.-Martins-Umzug“ 11.11.2026 17:30 bis 19:30 und Birgel
„Martinsumzug“ 10.11.2026; JEvents Gelenau „Kirmes“ 06.11.2026 14:00; iCagenda
Oster-Ohrstedt „Weihnachtsbasar“ 05.12.2026.

## Offen

* JEvents-RSS zeigt nur die neuesten Termine (`modlatest`), MEC nur den laufenden Monat;
  spätere Termine kommen in den folgenden Nächten.
* 21 JEvents-Gemeinden ohne bestätigten Feed und 11 iCagenda-Websites ohne RSS bleiben
  für den allgemeinen Parser (fn-29.16).
