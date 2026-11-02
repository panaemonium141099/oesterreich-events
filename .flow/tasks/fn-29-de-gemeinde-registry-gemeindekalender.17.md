# fn-29-de-gemeinde-registry-gemeindekalender.17 Amts- und VG-Kalender als Fallback (733 Gemeinden)

## Description
Gemeinden ohne eigenen Kalender über den Kalender ihres Amts oder ihrer VG; Termine nur der Gemeinde zuordnen, die der Termin selbst nennt (Etiketten-Regel), sonst Ort offen lassen.

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
Amts- und VG-Kalender laufen über die bestehenden Adapter (viaVerband), keine zweite Logik. Neu: pickFeedGroups (gleicher Kalender einmal, Gemeinde vor Amt, keine Dubletten bei gleicher source_id), MEC- und communice-Ausweichwege, Registry-Builder fragt Amts-Startseiten (seriell), tribe-Standardseite, Etiketten-Regel „Samtgemeinde X“ ist kein Ort. Prüfstand-Sicht de-amt-vg (nicht Nachtlauf), Abdeckungs-Skript, Golden-Tests RP/NI/BB, Bericht docs/research/de-gemeinden/adapter-amt-vg.md. Prüfstand bestanden, Stichprobe 30/30, Dorffest Hinzweiler gegen Quelle geprüft. Abdeckung: 80 von 733 Gemeinden mit sichtbarem Termin.
## Evidence
- Commits: 5af61554
- Tests: src/__tests__/lib/scrapers/amt-vg-de.test.ts, src/__tests__/lib/registry-de/registry-de.test.ts
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/428