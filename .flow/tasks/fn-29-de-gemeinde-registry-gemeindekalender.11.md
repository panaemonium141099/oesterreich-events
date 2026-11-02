# fn-29-de-gemeinde-registry-gemeindekalender.11 Adapter verwaltungsportal.de (1.165 Gemeinden)

## Description
Liste `/veranstaltungen/index.php` (12 Monate), weitere Monate über AJAX `/event/event/ajaxlist/year/<J>/month/<M>/day/<T>/`, Detail mit JSON-LD (kein Ende, keine Koordinaten); dünne Kalender sind kein Fehler.

Rahmenbedingungen: Der Qualitätsvertrag DE im Epic-Spec (`flowctl cat fn-29-de-gemeinde-registry-gemeindekalender`) gilt verbindlich. Belege und Zugriffswege: `docs/research/de-gemeinden/01-vollerhebung.md` und `00-bundesweit.md`.
## Acceptance
- [ ] Adapter liest alle Registry-Einträge der Integration, Schreibweg nur `supabase-sync.ts` mit `country = 'DE'`
- [ ] Golden-Tests aus echten, gecachten Proben (mindestens 3 Gemeinden), inklusive Zeit/Offset, Ganztägig, Ort, Gemeinde-Dienst
- [ ] Prüfstand-Bericht im PR: Titel/Datum/Uhrzeit 30/30, Ort korrekt oder Quarantäne 30/30, 0 sichtbare Gemeinde-Dienste, Müll- und Platzhalter-Quoten nicht schlechter als AT-Referenz
- [ ] robots.txt und Crawl-delay eingehalten, Abrufe über `BaseScraper.fetchHtml`
- [ ] `source_id` stabil, `source_name`/`source_url` gesetzt
- [ ] Mindestens ein echtes Dorffest aus dem Adapter, gegen die Quellseite geprüft
- [ ] Erst nach bestandenem Prüfstand in den Nachtlauf

## Done summary
Adapter `de-verwaltungsportal` auf master per PR #401 (Merge 2493c3cf). Liest die Kalenderliste `/veranstaltungen/index.php` (drei Layouts) aller verwaltungsportal-Websites der Registry (752 Websites, 1.165 Gemeinden) und je Termin die Druckansicht der Detailseite (JSON-LD, Datumszeile, Bild mit Maßen); Widerspruch zwischen Link, JSON-LD und Zeile verwirft den Termin. Serien über die Listen-Uhrzeit abgeleitet, Fortsetzungs-Cursor. Alle Websites liegen auf einem Server: ein Abrufstrang, 4 s Pause (`DE_VP_DELAY_MS`); acht parallele Websites hatten am 29.10. eine IP-Sperre bis 02.11. ausgelöst.

Prüfstand (60 verteilte Websites): geliefert 1.515, geschrieben 1.507, öffentlich 1.418, Quarantäne 89 (no_position 57 nur in Mehr-Gemeinde-Kalendern, municipal_service 32). Schwellen bestanden (0 sichtbare Gemeinde-Dienste, Müll 0,0 %, ohne Uhrzeit 21,4 %, sichtbar ohne Koordinaten 0,0 %, Dubletten 0,0 %). Stichprobe 30/30 (Titel, Datum, Uhrzeit, Ort). Dorffeste geprüft: „Kirmes in Hauteroda“ (An der Schmücke), „Kerwe mit Hammeltanz in Vilchband“ (Wittighausen). Bericht docs/research/de-gemeinden/adapter-verwaltungsportal.md. Nicht im Nachtlauf (fn-29.18); bei 4 s rund 160 Websites je Nacht, alle in fünf Nächten.
## Evidence
- Commits: 2493c3cf010d8387dbbd47c89bccd7672dbb5b27
- Tests: src/__tests__/lib/scrapers/verwaltungsportal-de.test.ts, npm run pruefstand:de -- --adapter de-verwaltungsportal (DE_VP_WEBSITES=60)
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/401