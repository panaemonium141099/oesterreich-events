# fn-29-de-gemeinde-registry-gemeindekalender.10 Adapter Komm.ONE RSS (137 Gemeinden, BW)

## Description
RSS `/site/<Mandant>/zmrss/<nodeID>/rss.xml` mit hCalendar; RSS ist gekürzt, sonst HTML-Liste; Crawl-delay 30.

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
Adapter `de-kommone` (Komm.ONE Online-Suite) auf master per PR #408 (Squash b84d8a71). Liest die Terminliste der dvv-Zusatzmodule aller `komm1`-Einträge seitenweise (bis 10 Seiten), RSS nur zum Finden der Liste oder als Ersatz; vier Listenvorlagen, freie Uhrzeiten, Ort als vCard oder Freitext. Abrufe nacheinander, 2 s Abstand, wechselnd zwischen den Websites (Crawl-delay 30 je Website). fetchHtml hat dafür den Schalter `charset`.

Prüfstand: geliefert 3.474, geschrieben 3.421, öffentlich 3.338, Quarantäne 83 (municipal_service 74). Schwellen bestanden (0 sichtbare Gemeinde-Dienste, Müll 0,0 %, ohne Uhrzeit 20,5 %, sichtbar ohne Koordinaten 0,0 %, Dubletten 0,1 %). Stichprobe 30/30 gegen die Detailseiten. Dorffeste geprüft: „Schwieberdinger Kirbe“ (Schwieberdingen), „Kerwefest“ (Bruchsal-Helmsheim). Bericht docs/research/de-gemeinden/adapter-kommone.md. Nicht im Nachtlauf (fn-29.18). Offen: 41 Registry-Seiten ohne Veranstaltungsmodul.
## Evidence
- Commits: b84d8a71bcdac24a486481a84f5e8cf7f518f522
- Tests: src/__tests__/lib/scrapers/kommone-de.test.ts, src/__tests__/lib/scrapers/fetch-html.test.ts, npm run pruefstand:de -- --adapter de-kommone
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/408