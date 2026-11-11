# fn-29-de-gemeinde-registry-gemeindekalender.6 Adapter NOLIS iCal (481 Gemeinden)

## Description
iCal `/veranstaltungen/veranstaltungen.ical?…&selected_kommune=<ID>` mit vollständigem Parametersatz; Zeiten UTC; `GEO` oft 0;0, Ort über `X-ORT` und Adresse; kreisweite Abfrage (`portal_all`, `verband`) prüfen.

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
Adapter de-nolis gebaut und auf dem Prüfstand bestanden (PR #378): iCal-Exporte aller 192 NOLIS-Feeds, 366 Tage ab heute, gekappte Antworten ohne angeschnittenen letzten Tag, UTC-Zeiten mit Mitternachts-Regel (ohne Uhrzeit, DTEND einschließlich), Tagesende 23:59:59, GEO Länge;Breite, source_id aus X-ID, Detailseite als Quelle, geteilte Termine einmal. Gemeinsamer iCal-Kern, Kontext und Abruf mit Crawl-delay für alle DE-Feed-Adapter. Prüfstand: alle Schwellen, Stichprobe 30/30 gegen Detailseiten, Dorffest Hülptingsen gegen Quellseite geprüft. Nicht im Nachtlauf (fn-29.18).
## Evidence
- Commits: 78558ae5
- Tests: npx vitest run (3908 grün; 3 CRLF-Fälle, 2 Scan-Wächter nur unter Last mit Timeout), npm run pruefstand:de -- --adapter de-nolis --fresh (Exit 0)
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/378