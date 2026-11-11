# fn-29-de-gemeinde-registry-gemeindekalender.7 Adapter WordPress- und Joomla-Kalender (The Events Calendar, MEC, Events Manager, JEvents, iCagenda, DPCalendar; 606 Gemeinden)

## Description
Tribe REST `/wp-json/tribe/events/v1/events`, MEC RSS `/events/feed/`, Events Manager `/events.ics`, JEvents und iCagenda Joomla-RSS, DPCalendar iCal. Ein Adapter je Plugin, gemeinsamer Registry-Einstieg.

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
Alle sechs Plugins aus fn-29.7 gebaut und auf dem Prüfstand bestanden: Tribe (PR #396), Events Manager (PR #397), MEC, DPCalendar, JEvents, iCagenda (PR #399). Je Adapter Stichprobe gegen die Detailseiten und ein Dorffest gegen die Quellseite. Dazu für alle DE-Adapter: Kalenderort gegen genannte Gemeinde (kontext.ts), JSON-LD-Leser, HTML-Abruf über fetchHtml mit robots.txt und Crawl-delay; Registry verwirft Plugin-Dateien als Kalender-URL; Gemeinde-Dienste um Verwaltungsschließung und Beratungstermin ergänzt. Nicht im Nachtlauf (fn-29.18). Rest für fn-29.16: 21 JEvents-Gemeinden ohne Feed, 11 iCagenda-Websites ohne RSS.
## Evidence
- Commits: 011bd241
- Tests: npx vitest run (3960 grün; 3 CRLF-Fälle, Timeouts unter Last einzeln grün), npm run pruefstand:de für de-tribe, de-eventsmanager, de-mec, de-dpcalendar, de-jevents, de-icagenda
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/396, https://github.com/panaemonium141099/oesterreich-events/pull/397, https://github.com/panaemonium141099/oesterreich-events/pull/399