# fn-29-de-gemeinde-registry-gemeindekalender.12 Adapter Hirsch & Wölfl hwveranstaltung (430 Gemeinden, BW)

## Description
HTML `<Seite>/seite-N/suche-none`, Klassen `hw_record__*`, Koordinaten aus dem OSM-Link; `?type=` per robots.txt gesperrt.

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
Adapter `de-hwveranstaltung` (Hirsch & Wölfl) auf master (PR #402): Kalenderlisten aller 429 hwext-Kalender seitenweise, Ort über den Kalender-Kontext, Wandzeit Europe/Berlin, Bilder nur mit Freigabe durch robots.txt, ältere Modulversionen ohne Detailseite erkannt und nicht gelesen. Prüfstand 2026-10-29: 18.913 Termine, öffentlich 17.898, alle Schwellen bestanden, Stichprobe 30 von 30, Dorffeste (Kirbe TV Tischardt, Dorffest Böhmenkirch und Kaisersbach) gegen die Quelle geprüft. Bericht docs/research/de-gemeinden/adapter-hwveranstaltung.md. Nicht im Nachtlauf (fn-29.18).
## Evidence
- Commits: 232962e90182723e016504e7ee1fc6f8b800ada1
- Tests: npx vitest run src/__tests__/lib/scrapers/hw-de.test.ts (19 grün), npm run pruefstand:de -- --adapter de-hwveranstaltung (Schwellen bestanden)
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/402