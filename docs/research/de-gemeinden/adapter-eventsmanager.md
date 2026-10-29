# DE-Adapter Events Manager (fn-29.7 Teil 2, Prüfstand 2026-10-29)

Events Manager (WordPress, „wp-events-plugin“) bietet `/events.ics`. Der Adapter
`de-eventsmanager` (`src/lib/scrapers/de/EventsManagerDeScraper.ts`, Parser `em.ts`)
liest alle 47 Feeds der DE-Registry (48 Gemeinden). Er steht in `DE_SCRAPERS`, nicht im
Nachtlauf (fn-29.18).

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Export ohne Parameter: `limit`, `scope`, `page`, `pno` wirken nicht; die nächsten Termine ab heute bis zur Grenze der Website (meist 50), nach Beginn sortiert | Langenselbold: jede Variante 50 Termine bis 26.11. | eine Abfrage je Website; bei genau 50 fällt der letzte, angeschnittene Tag weg (9 Websites); spätere Termine kommen in den folgenden Nächten |
| `Z` ohne `TZID` ist die Ortszeit der Website (Website auf Zeitzone UTC) | Laubach „Repair Café“ 14:30Z, Seite 14:30; Schlossvippach 11:00, Gommersheim 18:00 | als deutsche Ortszeit gelesen (3 Websites) |
| 00:00 heißt ohne Uhrzeit; Ende um Mitternacht ist der letzte Tag einschließlich | Leiblfing „Sa. 19. Dezember bis So. 20. Dezember, 00:00 Uhr“ | wie bei NOLIS |
| echte ganztägige Termine als `VALUE=DATE`, Ende ausschließlich | Bergenhusen „Halloween Ralley“, Seite „31/10/2026 Ganztägig“ | Ende nach RFC |
| `LOCATION` „Name, Straße, Ort, PLZ, Deutschland“, PLZ oft fehlend | Langenselbold, Laubach | eigene Zerlegung; Land und doppelte Teile entfernt („Kirchplatz, Kirchplatz“), Links sind kein Ort (Bensheim) |
| Koordinate in `X-APPLE-STRUCTURED-LOCATION` (`geo:Breite,Länge`), oft 0,0 | Laubach | übernommen, 0,0 nicht |
| Serien bis Jahre im Voraus | Gommersheim „Maibaum stellen“ bis 2034 | Horizont des Freigabevertrags (3 Jahre) hält sie zurück |

`source_id` = `em-<Host>-<UID>-<Termintag>`, Quelle die Detailseite aus `URL`, keine
Bilder.

## Ergebnis

Geliefert 937, verworfen 4 (`start_in_past`), geschrieben 933, öffentlich 912,
Quarantäne 21 (`start_too_far_ahead` 13, `no_position` 6, `municipal_service` 2).

| Prüfung | Events Manager | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 15,8 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,07 % |
| Dubletten in der Quelle | 0,3 % | 1,1 % |

Stichprobe (30 öffentliche Zeilen, Seed 29) gegen die Detailseiten: Titel, Datum und
Uhrzeit 30 von 30 nach den Korrekturen. Die erste Stichprobe fand Laubach eine Stunde
zu spät (`Z`), die zweite das Ende von `VALUE=DATE`-Terminen einen Tag zu lang; beide
behoben. Seiten ohne Datum im HTML (Nordharz lädt es per Skript) über den Einzel-Export
`<Termin-URL>/ical/` geprüft.

Dorffest gegen die Quellseite: „Dorfweihnacht in Heudeber“ (Ortsteil von Nordharz),
Einzel-Export 06.12.2026 15:00 Uhr; Zeile 15:00 Ortszeit, Gemeinde Nordharz.

## Offen

* Termine, die die Quelle führt, aber keine öffentlichen Veranstaltungen sind
  („Familienfeier“, „Personalversammlung“ in Hüffler), bleiben sichtbar; keine Wortliste.
