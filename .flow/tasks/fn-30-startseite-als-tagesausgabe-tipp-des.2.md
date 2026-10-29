# fn-30-startseite-als-tagesausgabe-tipp-des.2 Eventim-Import: Serien-Künstler parsen und event_artists je Event ersetzen

## Description
## Ziel
Der Eventim-Import speichert die Serien-Künstler je Event in `event_artists` und entfernt
Zeilen, die der Feed nicht mehr nennt. Größe M.

## Kontext
- `src/lib/eventim/parse.ts:44` `parseEventimFeed(series, nowIso, notBookable?)` iteriert
  Serien (51) und Events (54) und baut `ScrapedEvent` in `mapEvent` (80-150). `s.artists`
  (`EventimSeries.artists?: EventimArtist[]`, `types.ts:46-59`) wird nie gelesen.
- `ScrapedEvent` (`src/types/events.ts:146`) und `rawContentHash` (`src/lib/db/raw-persist.ts:28`)
  bleiben unverändert: Künstler als Nebenergebnis des Parsers (z. B. `Map<source_id,
  EventimArtist[]>`) statt als Feld am Event.
- `src/lib/eventim/import.ts:70` `upsertEventimEvents(events, log)` schreibt in Batches von 500
  über `syncEventsToSupabase` (`src/lib/db/supabase-sync.ts:1156`), das nur Zähler zurückgibt.
  Event-IDs danach über `source_name = 'Eventim'` + `.in('source_id', chunk ≤ 200)` auflösen,
  Muster `src/lib/db/source-id-migration.ts:141-156`.
- Upsert `onConflict: 'event_id,artist_id'` in Batches ≤ 500; je Chunk nach (event_id,
  artist_id) entdoppeln (Postgres bricht sonst mit „cannot affect row a second time“ ab).
  Fehlende Zeilen je Event löschen (`.delete().eq('event_id', id).not('artist_id', 'in', …)`
  oder delete+insert je Event); Events werden nie gelöscht, der Cascade greift nicht.
- Tabelle und Typ liegen vor: `supabase/migrations/20261029200000_event_artists.sql`,
  `Database['public']['Tables']['event_artists']` in `src/types/database.ts`. Die Migration ist
  in Prod noch NICHT ausgeführt (Dashboard/MCP + `NOTIFY pgrst, 'reload schema'`); vor dem
  ersten echten Import-Lauf nötig, sonst wird der Künstler-Schritt jeden Lauf rot.
  <!-- Updated by plan-sync: fn-30.1 lieferte die Migration nur als Datei, Prod-Ausführung offen -->
- Aufrufer: `src/scripts/import-eventim.ts:96` (GH-Action, Dry-Run bei 91) und
  `src/app/api/cron/eventim/route.ts:37`. Dry-Run schreibt keine Künstler. Fehler im
  Künstler-Schritt machen den Lauf rot, lassen den Event-Import aber gültig.
- Alle Länder des Feeds speichern (DE/CH für spätere Seiten). Leere Namen verwerfen.
- Tests: `src/__tests__/lib/eventim/parse.test.ts` mit Fixture-Helfern `baseEvent`/`series`
  (7-30); für den Import gibt es keinen Test, neu mit gemocktem Client (Chunk-Grenzen zählen).

**Files:** `src/lib/eventim/parse.ts`, `src/lib/eventim/import.ts`,
`src/lib/eventim/types.ts` (falls Rückgabetyp), `src/scripts/import-eventim.ts`,
`src/app/api/cron/eventim/route.ts`, `src/__tests__/lib/eventim/parse.test.ts`,
`src/__tests__/lib/eventim/import-artists.test.ts` (neu).
## Acceptance
- [ ] `parseEventimFeed` liefert je Event die Serien-Künstler (artistId, artistName,
      artistImage, evoLink); `ScrapedEvent` und `rawContentHash` sind unverändert (bestehende
      Parser-Tests grün, neue Fixture mit `artists`).
- [ ] Nach dem Event-Upsert werden Event-IDs in Chunks ≤ 200 aufgelöst und `event_artists` in
      Batches ≤ 500 mit `onConflict 'event_id,artist_id'` geschrieben; Duplikate je Chunk
      werden vorher entfernt (Test zählt Chunk-Größen).
- [ ] Zeilen eines importierten Events, die der Feed nicht mehr nennt, werden gelöscht (Test).
- [ ] Dry-Run (`--dry-run`) schreibt keine Künstler; der Log nennt Anzahl Events mit Künstlern
      und geschriebene/gelöschte Zeilen.
- [ ] Ein Fehler im Künstler-Schritt beendet den Lauf mit Exit ≠ 0 und Meldung, ohne den
      Event-Upsert zurückzunehmen.
- [ ] `npm test` grün.
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
