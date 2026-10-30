# DE-Adapter Weblication (fn-29.15, Prüfstand 2026-10-30)

Weblication ist das CMS der Scholl Communications AG (Kehl). Die Gemeinden bauen ihre
Veranstaltungsseite selbst aus dem Listen-Element des CMS; einheitlich ist nur der
Eintrag des Listenobjekts „eventMulti“. Der Adapter `de-weblication`
(`src/lib/scrapers/de/WeblicationDeScraper.ts`, Parser `weblication.ts`) liest diese
Liste mit allen Folgeseiten für die Registry-Einträge mit Merkmal `weblication`
(102 eigene, 8 über die Verbandsgemeinde; 90 Kalender). Er steht in `DE_SCRAPERS`,
nicht im Nachtlauf (fn-29.18). Abrufe über `BaseScraper.fetchHtml`, robots.txt je
Website, mindestens 1 s Pause. Teil von fn-29.15; cmcitymedia entfällt (Lizenz nötig).

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| `listEntry*`-Klassen stehen auf jeder Weblication-Seite im CSS, auch ohne Liste | Peine, Beverungen: nur CSS | erkannt wird nur `li.listEntry.listEntryObject-eventMulti` |
| Zwei Aufbauten des Eintrags | Titelzeile `.listEntryTitle` mit Link und `.listEntryDate` (Laer, Borchen, Lorsch); Kacheln aus `.listEntryElement` mit `.listEntryObjectEventMultiTitle`, `.dayDate` und „Ort: …“ (Neunkirchen) | beide gelesen |
| Datumszeile in vielen Formen | „Mi., 04.11.2026, 15:00 Uhr - 16:30 Uhr“ (199 Einträge), „Fr., 06. November 2026, 19:00 Uhr“, „Sa, 31. Okt 2026, 17:00 Uhr“, „27.03.2026“, mehrtägig mit zwei Daten (Auswertung der ersten Seite aller 89 Registry-Seiten) | Monat voll oder abgekürzt, Ortszeit; ohne Uhrzeit ganztägig |
| Serienlinks tragen die Wandzeit | `…/termine/Schlaenger-Markt.php?splitId=18&from=2026-10-30 00:00:00&to=2026-10-31 00:00:00` | `from`/`to` gehen vor dem Text; `source_url` ist dieser Link (zeigt den Termin) |
| Platzhalterzeiten | Laer „MÜNSTERLAND-KRIMI am Kaminfeuer“ 19:00 bis 23:59; „00:00 Uhr“ ohne Ende | 23:59 heißt Ende offen, 00:00 ohne Ende ganztägig |
| Dieselbe Seite mehrmals am selben Tag | Neunkirchen „Buchausstellung“ 10:00 und 13:30 Uhr | `source_id` = Pfad, bei Serien mit Tag, bei mehreren Terminen am Tag mit Uhrzeit |
| Einträge mit Link auf ein anderes System | Gütersloh „Sitzung des Rates“ → `ratsinfo.guetersloh.de/tops/` (keine Terminseite) | Quelle ist die Liste |
| Registry nennt oft einen Einzeltermin | Beverungen `…/veranstaltungen/termine/Die-Raeuber.php` | Kalender = Seite über `/termine/`; sonst der Kalender, auf den die Termin-Links der Seite zeigen |
| Lazy-Loading der Vorschaubilder | `srcset` ist ein SVG-Platzhalter, Bild in `data-src` | `data-src` vor `srcset`; über `bild.ts`, robots.txt wie bei Hirsch & Wölfl |
| Kacheln ohne Datum | Oerlinghausen „Halloweenfeier 31.10.“, Benningen (Seite verlinkt Memminger Termine) | nicht gelesen (Datum nur auf der Detailseite) |

Ohne eventMulti-Liste blieben 33 Registry-Seiten (eigene Kalender anderer Anbieter wie
kalender.marsberg.com, eoevents in Wald, Bad Saulgau; Unterseiten ohne Kalender;
Bücherei- und Formularseiten), 1 nicht lesbar.

## Ergebnis

Erster Lauf online (369 Abrufe), danach offline aus dem Cache. Geliefert 3.341, verworfen
176 (`start_in_past`: laufende mehrtägige Termine), geschrieben 3.160, öffentlich 3.066,
Quarantäne 94 (`municipal_service` 59, `no_location_evidence` 18, `start_too_far_ahead`
13, `no_position` 4).

| Prüfung | Weblication | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,1 % | 0,1 % |
| ohne Uhrzeit | 6,6 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,1 % |
| Dubletten in der Quelle | 0,1 % | 1,1 % |

Die zwei Müll-Titel sind Güterslohs Theaterstück „K.“ (so auch Seitentitel und
Überschrift der Quelle).

Stichprobe (30 öffentliche Zeilen) gegen die Detailseiten: 30 von 30 Titel, Datum,
Uhrzeit und Gemeinde korrekt, auch Serien (Lichtenau „AWO Seniorenkreis“, Neunkirchen
„Öffnungszeit Bücherei“) und Teiltermine einer Reihe (Versmold „Energiesparwoche“:
„jeweils von 19.00 bis 20.30 Uhr“). Gefunden und behoben: Gütersloh „Sitzung des Rates“
verlinkte auf das Ratsinformationssystem statt auf eine Terminseite.

## Dorffest-Probe gegen die Quellseite

| Termin | Adapter | Quellseite |
|---|---|---|
| Glühweinkerwe, Bockenheim an der Weinstraße | 04.12.2026 18:00 | 04.12.2026, 18:00 Uhr, Platz der Partnerschaft |
| Wintermarkt, Esselborn | 28.11.2026 ganztägig | „Sa., 28. November 2026“, Ort Esselborn |

## Offen

* Öffentliche Sitzungen (Ortsbeirat Elgershausen, Rat Gütersloh) bleiben wie in
  Österreich sichtbar; Entscheidung offen.
* 33 Registry-Seiten ohne eventMulti-Liste; eine nächste Erhebung kann sie anderen
  Integrationen zuordnen.
