# fn-29-de-gemeinde-registry-gemeindekalender.16 Allgemeiner Parser für Stufe D und E (JSON-LD und Listen mit Datum; 1.908 Gemeinden)

## Description
Nach dem Muster von `GenericGemeindeScraper` und den Titel- und Pager-Regeln aus AT (`event-title.ts`, `pagination.ts`); JSON-LD zuerst; besonders strenger Prüfstand, weil ohne Hersteller-Schema.

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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
