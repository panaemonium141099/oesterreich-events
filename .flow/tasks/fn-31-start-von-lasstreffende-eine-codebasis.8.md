# fn-31-start-von-lasstreffende-eine-codebasis.8 DB-Objekte je Land: Karte, Statistik, Zähler

## Description
Datenbank-Objekte je Land: Karten-MV mit Payload, Statistik-Cache, Zählfunktion, öffentliche Künstler-Funktion.

**Size:** M
**Files:** `supabase/migrations/<ts>_db_objekte_je_land.sql` (neu), `src/app/api/events/map-points/route.ts`, `src/app/api/stats/counts/route.ts`, `src/lib/v4/get-landing-data.ts`, `src/lib/v4/landing-picks.ts`, `src/__tests__/lib/security-definer-grants.test.ts` (falls betroffen)

## Approach
- `event_map_points` (`20261006120000_map_points_vienna_days.sql`): Spalten `country` und `region_id` dazu, Filter auf die Länder der Sites. Der eindeutige Index auf `id` bleibt (Voraussetzung für `REFRESH … CONCURRENTLY`).
- `event_map_points_payload` und `rebuild_event_map_points_payload()` (`20260826210000_map_points_payload.sql:23` bis 87): je Land eine Zeile; `get_event_map_points(p_country text default 'AT')`.
- `event_stats_cache` und `event_counts_for_stats` (`20261029200200_stats_country_total.sql`): je Land.
- Geänderte Signaturen: alte Funktion mit `DROP FUNCTION` entfernen und neu anlegen, sonst entsteht eine zweite Überladung und der Aufruf ohne Parameter wird mehrdeutig (PGRST203). Danach Rechte ausdrücklich vergeben (Standard seit 2026-10-08: nur Eigentümer und service_role) und `NOTIFY pgrst, 'reload schema'`.
- Die sechs `match_*`-Funktionen bleiben AT-fest (Matching läuft nur im AT-Lauf, `AT_ONLY_STEPS`); `get_artist_appearances` bekommt `p_country` nur, wenn ein öffentlicher Leser es braucht.
- Leser übergeben `getSite().country`.
- Messen: Refresh-Dauer und Payload-Größe (roh und gzip) für AT vorher, AT nachher, DE. Trägt der DE-Snapshot nicht, die Kachelung als eigenen Folgetask im Epic anlegen statt hier zu bauen.

## Key context
- Der Live-Cron-Job der Karte wurde per `cron.alter_job` geändert (Job 4), das Repo zeigt nicht den Live-Stand: vor der Migration `cron.job` lesen.
- Migration für MVs als `supabase_admin` per psql.
- Deploy-Reihenfolge: Migration zuerst, der alte AT-Container muss mit den neuen Funktionen weiterlaufen (Standardwert `'AT'`).
## Acceptance
- [ ] Karte, Statistik und Zähler liefern je Land; AT-Ergebnisse vor und nach der Migration gleich (Vergleich im PR)
- [ ] Kein mehrdeutiger RPC-Aufruf; Rechte je Funktion ausdrücklich; Wächter `security-definer-grants` grün
- [ ] Refresh-Dauer und Payload-Größe AT vorher, AT nachher, DE dokumentiert; AT nicht schlechter
- [ ] Entscheidung Gesamtsnapshot oder Kachelung für DE mit Messwerten in der Epic-Spec
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
