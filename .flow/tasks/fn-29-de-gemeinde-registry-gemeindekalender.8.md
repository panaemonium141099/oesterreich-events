# fn-29-de-gemeinde-registry-gemeindekalender.8 Adapter communice (inixmedia, 301 Gemeinden)

## Description
Atom `/veranstaltungen/rss`, iCal je Termin (`tx_communicecalendar_*`); Amtskalender mit Terminen mehrerer Gemeinden, Ort aus dem Termin (03-schleswig-holstein.md).

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
Adapter de-communice gebaut und gemergt (PR #410). Vorab geprüft: keine Lizenz nötig (robots.txt der Kalender frei, Herausgeber laut Impressum Gemeinde/Amt, inixmedia nur Realisierung, keine Nutzungsbedingungen für Dritte; die Bayern-Anfrage betraf nur einen zentralen Export).

Liest die Kalenderliste (beide Vorlagen) aller 187 Registry-Seiten (155 Kalender), Jahr mehrtägiger Termine aus dem iCal des Termins, Verbund-Websites mit gemeinsamer Datenbank zusammengefasst (Ort nur aus Etikett/Ort/Titel). Atom-Feed bewusst nicht genutzt (Anlagezeit statt Uhrzeit).

Prüfstand: 3.179 Termine, Schwellen bestanden (Gemeinde-Dienste 0, Müll 0,0 %, Dubletten 0,0 %), Stichprobe 30/30. Dorffeste gegen Quelle: Dorffest der Ortsvereine Großkarolinenfeld, Weihnachtsmarkt Westermoor. Bericht docs/research/de-gemeinden/adapter-communice.md. Nicht im Nachtlauf (fn-29.18).
## Evidence
- Commits: a0fafaf9
- Tests: src/__tests__/lib/scrapers/communice-de.test.ts, src/__tests__/lib/category-classifier/municipal-service.test.ts
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/410