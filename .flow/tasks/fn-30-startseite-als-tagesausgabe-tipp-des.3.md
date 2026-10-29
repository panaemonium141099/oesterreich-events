# fn-30-startseite-als-tagesausgabe-tipp-des.3 Landing-Datenschicht: Tipp, Saison 6, Programm, Wochenende, Künstler-Rotation, Festivals, Blog, Freizeit, Karten-Pins

## Description
## Ziel
`getLandingData()` liefert die Daten der Tagesausgabe; die Auswahl-Logik liegt pur und
getestet in `src/lib/v4/landing-picks.ts`. Größe M (Logik) + M (Abfragen) in einem Task,
weil beides dieselbe Datei und Tests teilt; bei Überlauf die Abfragen abspalten.

## Kontext
- `src/lib/v4/get-landing-data.ts`: `LandingData` (49-55), `hourlyShuffle` (145, nicht
  exportiert → exportieren), `withRetry` (315, modul-lokal), `uniqueByTitleAndImage` (91),
  `arrangeBySharpness` (119), `pickSeasonEvents` (175, heute count 4 → 6), `pickFestivals`
  (214, filtert `starts_at >= UTC-heute` → `ends_at >= Wiener Tag`), Anon-Client (328),
  `eventCols` (341; ergänzen um `latitude, longitude, geocoding_confidence, location_status,
  location_resolution, is_all_day, duration_type`), `weekendBase()` (360), featured-Abfrage
  (420-427, ohne publish_status/Datum → ergänzen), Fehlerverhalten (282-306, `isBuildPhase`).
- Wiener Tage: `src/lib/utils/event-time.ts` (`viennaToday` 213, `addViennaDays` 229,
  `viennaDayRange` 253, `hasKnownStartTime` 140, `EVENT_TZ`). Das alte Fenster „now + 7 Tage
  UTC“ entfällt.
- Pins: `locationOutputs(event).pin` (`src/lib/location/gating.ts:55`).
- Festivals: `festivals` + `festival_artists` (`20260413_festival_lineup_schema.sql:60-121`,
  `20261026100000_…`: image_url, ticket_url, date_status); Acts gebündelt mit `.in('festival_id',
  ids)`; Reihenfolge `toBlogLineup` (`src/lib/festivals/upcoming.ts:239`). Kein country-Feld:
  `parent_event.country` oder `state` in `BUNDESLAENDER`-Namen.
- Blog: `ALL_POSTS` (`src/content/blog/index.ts:231`, nach publishDate absteigend),
  `thumbnailImage ?? heroImage`.
- Freizeit: `poi_activities_public` (anon lesbar, ohne quality_score), `setting='indoor'`,
  nur mit `images`, Pool 40, `hourlyShuffle` → 8; Bilder über `renderableImageUrls`
  (`src/lib/activities/indexability.ts:42`).
- Zahl: RPC `event_counts_for_stats()` → `country_total` (Task 1).
- Reihenfolge der Auswahl (feste Regel, Test): Tipp → Saison → Programm → Wochenende; kein
  Event doppelt. Tipp: `landing_features.kind='sponsored'` für den Wiener Tag, sonst
  bestgescortes Event mit scharfem Bild der nächsten 7 Tage. Programm: heutiger Wiener Tag,
  `hasKnownStartTime`, ab 17:00, nach Uhrzeit, 10 Zeilen aus Pool 60. Wochenende: Fr bis So
  (Mo bis Do das kommende, Fr bis So das laufende inkl. heute), Pool 40, `uniqueByTitleAndImage`.
  Künstler: `event_artists` mit `events!inner` (`country`, `publish_status`, Fenster heute bis
  +7 Wiener Tage), Pool 120 nach `event_score`, je Künstler nächster Termin, mit Bild zuerst,
  `hourlyShuffle` → 3; `duplicate_of` auf den sichtbaren Primary auflösen.
- Wächter: `src/__tests__/lib/site-country-guard.test.ts` (jede events-Kette inkl. Embeds
  braucht `country`), `landing-url-columns.test.ts` (EVENT_URL_COLUMNS in jedem Select),
  `hubs-seo.test.ts:147-176` (zählt heute 5 Event-Ketten, prüft `todayWeekend`/`concerts`:
  auf neue Form umstellen), `landing-query-failures.test.ts` und `season-picks.test.ts`
  (Mocks ohne `rpc` → Stub ergänzen), `src/test/landing-selection.test.ts`.

**Files:** `src/lib/v4/get-landing-data.ts`, `src/lib/v4/landing-picks.ts` (neu),
`src/lib/v4/map-static-url.ts` (neu, reine URL-Funktion), `src/__tests__/lib/v4/*.test.ts`,
`src/__tests__/nur-oesterreich/hubs-seo.test.ts`, `src/test/landing-selection.test.ts`.
## Acceptance
- [ ] `LandingData` enthält `tip` (mit `kind: 'sponsored'|'editorial'|'auto'`,
      `sponsorName`), `season` (6 Picks), `program`, `weekend`, `artistsLive`, `festivals`
      (mit `acts`), `posts`, `activities`, `mapPins`, `countryTotal`; `todayWeekend`,
      `concerts`, `popularArtists`, `FALLBACK_ARTISTS` sind entfernt.
- [ ] Unit-Tests für `landing-picks.ts`: Auswahlreihenfolge ohne Dubletten, Tipp-Fallback
      ohne Buchung, Wochenend-Fenster an Mo/Do/Fr/So (Wiener Tage), Programm ab 17:00 nur mit
      bekannter Startzeit, Rotation wählt je Künstler einen Termin und bevorzugt Bilder.
- [ ] `map-static-url.ts`: gerundete, sortierte Pins, max. 40, URL < 8.192 Zeichen, fester
      Ausschnitt ohne Pins, `logo` nicht unterdrückt (Test).
- [ ] Jede events-Abfrage und jedes Embed trägt `country = SITE_COUNTRY`; Wächter grün.
- [ ] Gepinnte Events werden auf `publish_status`, Land und Enddatum geprüft.
- [ ] Festivals: `ends_at >= Wiener Tag`, `date_status = 'confirmed'`, Land über parent_event
      oder `state`; drei Acts in Headliner-Reihenfolge.
- [ ] `hubs-seo.test.ts`, `landing-query-failures.test.ts`, `season-picks.test.ts`,
      `landing-url-columns.test.ts` auf die neue Form angepasst und grün; `npm test` grün.
## Done summary
getLandingData() liefert die Tagesausgabe (today, countryTotal, tip, season 6, program, weekend + weekendRange, artistsLive, festivals mit acts, posts, activities, mapPins); todayWeekend/concerts/popularArtists/FALLBACK_ARTISTS sind weg. Die Auswahl-Logik liegt pur und getestet in src/lib/v4/landing-picks.ts (Tipp → Saison → Programm → Wochenende ohne Dubletten, Wiener Tage), die Karten-URL in src/lib/v4/map-static-url.ts. Künstler-Rotation liest events + event_artists!inner (Score-Sortierung auf der Basistabelle) statt event_artists + events!inner. page.tsx: ArtistTeaserV4/WeekendSection/ConcertsSection vorerst entfernt (Tasks 5/6 bringen die neuen Komponenten), ArtistTeaserV4 trägt einen eigenen Typ. Nicht committet: .agents/, .codex/ (fremde Tooling-Ordner) und der Plan-Sync in .flow/tasks/…9.md.
## Evidence
- Commits: b47c5f1d681f6d6944aad9b0e491d3e0d5b756fc
- Tests: npx vitest run src/__tests__/lib/v4 src/__tests__/nur-oesterreich src/__tests__/lib/site-country-guard.test.ts src/test/landing-selection.test.ts (19 Dateien, 208 Tests grün), npx vitest run (Gesamtsuite: 3978 grün, 3 bekannte Windows-Fehler in search-event-ids-migration, sheet-css-guard, patch-next-static-search-nav; hubs-seo lief unter Last in den 5-s-Timeout und ist mit 20 s Timeout isoliert grün), npx tsc --noEmit (identisch zur Baseline: 24 vorbestehende Fehler nur in Testdateien, keine in den geänderten Dateien)
- PRs: