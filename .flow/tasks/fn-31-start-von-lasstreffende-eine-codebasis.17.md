# fn-31-start-von-lasstreffende-eine-codebasis.17 Künstler-Bereich auf .de, Follows und Erkennung je Land

## Description
Künstler-Bereich auf lasstreffen.de, mit Erkennung je Land. Auftrag des Nutzers (15.11.2026): „baue musik artists auch nimm die gleichen die es in österreich auch gibt […] aber die erkennung muss halt so funktionieren wenn in der de db der artist erscheint wird informiert und nciht wenns in österreich ist“.

**Size:** L, in zwei PRs: (A) lesender Teil, (B) Follows und Erkennung je Land.

## Befund (Code und Prod, 15.11.2026, nur lesend)
- Schon länderfähig: `get-artists-directory.ts` (`event.country = SITE_COUNTRY`), `/api/me/landing` (`followed-live`), Kachel „Diese Woche live“ (`get-landing-data.ts`). `event_artists` führt alle Feed-Länder: kommend AT 1.290 Künstler / 9.133 Events, DE 441 / 3.564, CH 40 / 124; in 90 Tagen veröffentlicht AT 735 / 4.305, DE 207 / 1.006.
- Nicht länderfähig: `followed_artists` hat kein Land (Spalten user_id, artist_name, artist_name_normalized, spotify_*, source; UNIQUE (user_id, artist_name_normalized); 88 Follows von 6 Nutzern). Die sechs `match_*`-Funktionen und `get_artist_appearances` filtern fest `e.country = 'AT'` (`20261008100000_nur_oesterreich_artist_rpcs.sql`). Die Erkennung läuft doppelt: `src/lib/artist-matching.ts` (Pipeline-Schritt, nur AT-Lauf) und die Edge-Function `supabase/functions/match-artists` (pg_cron Job 7, stündlich); beide rufen die AT-festen RPCs und schreiben `notifications` (type `spotify_match`, 567 Zeilen, ohne Land).
- Kachel-Abfrage: für AT und DE derselbe Plan (Bitmap über `idx_events_start_date`, 50.709 Zeilen der nächsten 7 Tage, 37.344 Blöcke). Kalt 2,4 s (DE zuerst gemessen), warm 0,19 s (AT danach, dieselben Blöcke). Kein Länderproblem; `artists` ist eine optionale Quelle.

## Entscheidung: woher ein Follow sein Land bekommt
Spalte `country` an `followed_artists`, gesetzt von der Seite, auf der gefolgt wird (`SITE_COUNTRY` in `/api/artists/follow`); Bestand `'AT'`. Eindeutigkeit (user_id, artist_name_normalized, country): wer auf beiden Seiten folgt, hat zwei Follows. Nicht aus dem Profil oder der Domain der Sitzung abgeleitet: ein Nutzerkonto gilt für beide Seiten (eine Datenbank), der Follow ist die Stelle, an der der Wunsch „dieses Land“ entsteht. Keine zweite Tabelle.

## Approach
- (A) Säule `artists` auf .de an; Wand, Blatt, Kachel zeigen nur Termine in Deutschland (Filter besteht). Folgen-Knöpfe nur mit der Säule `account`.
- (B) Migration: `followed_artists.country` (NOT NULL DEFAULT 'AT'), neuer Unique-Index. RPCs mit `p_country text DEFAULT 'AT'` (alte Signaturen entfernen, Rechte neu). `artist-matching.ts` und die Edge-Function gruppieren die Follows je Land und rufen die RPCs je Land. Follow-, Following-, Events- und Landing-Routen filtern das Land der Seite. Benachrichtigungen zeigt jede Seite nur für Events ihres Landes (`NotificationsProvider` filtert schon).
- Login auf .de (Säule `account`) braucht die Domain und die Auth-Rückwege; bis dahin entsteht auf .de kein Follow.

## Key context
- `artist_matching` ist `AT_ONLY_STEPS`; mit Ländern je Follow kann der Schritt beide Länder in einem Lauf bedienen.
- Die Edge-Function liegt auf dem Server (self-hosted), Deploy ist ein eigener Schritt.
## Acceptance
- [ ] .de: `/artists`, `/kuenstler/[slug]` und die Kachel zeigen nur Termine in Deutschland; .at unverändert (Vergleichsskript)
- [ ] `followed_artists.country` in Prod, Bestand 'AT', Eindeutigkeit mit Land
- [ ] Follow auf .de schreibt 'DE'; Following, Landing und Events-Routen lesen nur Follows des Landes der Seite
- [ ] Erkennung: ein DE-Follow erzeugt eine Benachrichtigung nur für einen Termin in Deutschland, ein AT-Follow nur für Österreich (Tests mit beiden Ländern, beide Implementierungen)
- [ ] Für AT-Follows entstehen dieselben Treffer wie vorher (Vergleich der RPC-Ergebnisse vor und nach der Migration)
- [ ] Rechte der neuen Funktionen ausdrücklich, Wächter `security-definer-grants` grün
## Done summary
Künstler-Säule auf lasstreffen.de an (Wand, Blatt, Kachel, Sitemap; 204 Künstler mit Termin in Deutschland). Follows tragen das Land der Seite (followed_artists.country, Bestand AT, eindeutig mit Land); Erkennung je Land in artist-matching.ts und der Edge Function, RPCs mit p_country. Beide Migrationen in Prod, Edge Function ausgerollt (Sicherung /root/match-artists-index.ts.vor-fn-31-17). AT: sieben Funktionen vor und nach der Migration gleich (Zeilenzahl, md5); SEO-Vergleich vor und nach dem Deploy: 9 Seiten, nur Zahlen.
Offen: Login auf .de (Säule account, Task 15), bis dahin entsteht dort kein Follow; Kachel-Abfrage liest für beide Länder 37.344 Blöcke (0,2 s warm, 2,3 s kalt bei 3 s Grenze); Anmelden-Link und Meta-Keywords auf .de noch österreichisch; 14 Alt-Benachrichtigungen zu DE-Terminen aus AT-Follows.
## Evidence
- Commits:
- Tests: src/__tests__/lib/artist-matching-je-land.test.ts
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/488