# fn-29-de-gemeinde-registry-gemeindekalender.5 Adapter ionas (events.json/event.ics, 931 Gemeinden)

## Description
Zugriff über `data-source` der Kalenderseite: `<kalenderpfad>/events.json?weekends=false&tagMode=ALL` bzw. `event.ics`; Zeiten ohne Offset sind Ortszeit; nicht jede ionas-Seite nutzt TVM (dann allgemeiner Parser). Deskline-Termine (UUID-IDs) gegen die Feratel-Quelle deduplizieren.

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
Adapter de-ionas gebaut und auf dem Prüfstand bestanden (PR #367): iCal-Exporte aller ionas-Feeds der DE-Registry, Amtskalender ordnen nur die vom Termin genannte Gemeinde zu, Feed-Dubletten zusammengefasst. Dazu DE-Stammdaten um Ortsteile ergänzt (GeoNames-Ort in VG250-Fläche, orteGemeinde), Resolver löst Ortsteile auf; Freigabevertrag: DE ohne Position → no_position, Muster-Orte → placeholder_location. Prüfstand: Dubletten nach Minute, Schwelle sichtbar ohne Koordinaten, AT-Referenz neu gemessen. Ergebnis: alle Schwellen eingehalten, Stichprobe 30/30. Nicht im Nachtlauf (fn-29.18).
## Evidence
- Commits: ccfbcbc9
- Tests: npx vitest run (3900 grün, 3 bekannte CRLF-Fälle), npm run pruefstand:de -- --adapter de-ionas --offline (Exit 0)
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/367