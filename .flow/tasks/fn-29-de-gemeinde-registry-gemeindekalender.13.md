# fn-29-de-gemeinde-registry-gemeindekalender.13 Adapter Advantic iKISS (364 Gemeinden)

## Description
HTML `ModID=11` (`result-list veranstaltungen`, `<time datetime>`), `/output/` per robots.txt gesperrt; Kalender oft nur Sitzungen (Gemeinde-Dienste-Quarantäne).

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
Adapter `de-ikiss` (Advantic iKISS) auf master per PR #420 (Squash 90fb7453). Liest die Veranstaltungsliste (ModID=11, ofs_N, höchstens 300 Termine je Kalender) aller `ikiss`-Einträge und je Termin die Detailseite; vier Vorlagen, Titel aus dem <h1> vor dem Datumsfeld, Screenreader-Beschriftungen ausgeschlossen, Monatsnamen, Ende 23:59 offen, Adressen in einer Zeile geteilt; RSS über Kanal-Link, fremder RSS-Host auf die Website (Magdeburg). Zeichensatz über den charset-Schalter aus #408.

Prüfstand: geliefert 7.626, geschrieben 7.173, öffentlich 6.713, Quarantäne 460 (municipal_service 211). Schwellen bestanden (0 sichtbare Gemeinde-Dienste, Müll 0,0 %, ohne Uhrzeit 5,3 %, sichtbar ohne Koordinaten 0,0 %, Dubletten 0,1 %). Stichprobe zweimal 30/30. Dorffeste geprüft: „Schützenfest Hordorf“ (Oschersleben), „Backofenfest“ (Königstein). Bericht docs/research/de-gemeinden/adapter-ikiss.md. Sitzungen bleiben sichtbar (Entscheidung des Users 2026-11-02), Qualitätsvertrag Punkt 5 angepasst. Nicht im Nachtlauf (fn-29.18); Lauf über alle Kalender gut zwei Stunden, fn-29.18 muss sharden.
## Evidence
- Commits: 90fb745368a5b4bb9221652188fcd9b8d49a228e
- Tests: src/__tests__/lib/scrapers/ikiss-de.test.ts, npm run pruefstand:de -- --adapter de-ikiss
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/420