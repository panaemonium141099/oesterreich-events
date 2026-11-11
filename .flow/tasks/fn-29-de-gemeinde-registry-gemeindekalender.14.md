# fn-29-de-gemeinde-registry-gemeindekalender.14 Adapter TYPO3- und Contao-Kalender (tx_news, calendarize, events2, sf_event_mgt, Contao; 347 Gemeinden)

## Description
HTML bzw. JSON-LD je Extension; calendarize-Logik aus AT (`calendarize-card.ts`) wiederverwenden.

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
Adapter `de-typo3` (Typo3DeScraper.ts, contao.ts, typo3.ts, cms-termin.ts) liest 271 Kalenderseiten der Merkmale contao_events, calendarize, events2, sfeventmgt, txnews. Contao über datetime/Linktitel/times=, TYPO3-Extensions über Detail-Links (calendarize mit parseCalendarizeTerm aus calendarize-card.ts, events2 per JSON-LD der Detailseite), Schema.org-Events der Seite. tx_news-Listen werden nicht gelesen (Nachrichtendatum). Prüfstand 2026-10-30: 2.947 geliefert, 2.440 geschrieben, 2.285 öffentlich, 88 Websites; 0 sichtbare Gemeinde-Dienste, Müll 0,0 %, ohne Uhrzeit 20,0 %, sichtbar ohne Koordinaten 0,0 %, Dubletten 0,0 %; Stichprobe 30/30. Dorffeste gegen Quelle: Gründungsfest FF Eberspoint, Babinger Waldfest (Markt Velden), Kirmes Pustleben (Bleicherode). 27 Golden-Tests aus 12 Gemeinden. Bericht docs/research/de-gemeinden/adapter-typo3.md. Nicht im Nachtlauf (fn-29.18).
## Evidence
- Commits: 42a7c164
- Tests: src/__tests__/lib/scrapers/typo3-de.test.ts (27), npm run pruefstand:de -- --adapter de-typo3 --offline: Schwellen bestanden, Stichprobe 30/30
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/413