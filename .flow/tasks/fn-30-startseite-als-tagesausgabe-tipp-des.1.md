# fn-30-startseite-als-tagesausgabe-tipp-des.1 DB: event_artists, landing_features kind/sponsor_name, country_total in event_stats_cache

## Description
## Ziel
Datenbank-Grundlage für die Tagesausgabe: Tabelle `event_artists`, Spalten `kind` und
`sponsor_name` auf `landing_features`, Feld `country_total` in der Stats-MV. Größe M.

## Kontext
- Muster für neue Tabellen: `supabase/migrations/20260924180000_landing_features.sql`
  (RLS, Policy, Grants); Policy-Stil seit 2026-10-08: `for select to anon, authenticated
  using (true)` (`20261008120000_api_rollen_rechte_zurueckschneiden.sql:68-72`). Der
  Event-Trigger `20261008120100_api_rollen_neue_objekte.sql` schaltet RLS automatisch ein;
  ohne Policy liefert die Tabelle anon still nichts.
- `landing_features` hat heute id, event_id (unique), starts_at, ends_at, note, created_by,
  created_at. Bestehende Zeilen sind redaktionelle Pins → in der Migration auf `editorial`
  setzen, Default für neue Zeilen `editorial` (Admin setzt `sponsored` ausdrücklich).
- Stats: MV `event_stats_cache` (`20260704_stats_counts_read_mv.sql:31-80`), RPC
  `event_counts_for_stats()` (`20260429110000_stats_counts_rpc.sql`, SECURITY DEFINER,
  read-only, anon EXECUTE). Neues Feld `country_total`: published, `start_date >= now()`,
  `country = 'AT'`. pg_cron refresht alle 30 min, Refresh-Definition unverändert.
- `src/types/database.ts` kennt weder `landing_features` noch `event_artists`: Typen ergänzen.
- DDL läuft nicht über PostgREST: Migration als Datei, Ausführung im Supabase-Dashboard oder
  per MCP, danach `NOTIFY pgrst, 'reload schema'` (Ops-Hinweis in der Migration als Kommentar).

## Schema
`event_artists (event_id uuid not null references public.events(id) on delete cascade,
artist_id text not null, artist_name text not null, artist_image text, evo_link text,
source text not null default 'eventim', updated_at timestamptz not null default now(),
primary key (event_id, artist_id))`; Index `event_artists_artist_id_idx (artist_id)`,
Index `event_artists_artist_name_idx (lower(artist_name))`.
`landing_features`: `kind text not null default 'editorial' check (kind in
('sponsored','editorial'))`, `sponsor_name text`, Check: `kind <> 'sponsored' or sponsor_name
is not null`.

**Files:** `supabase/migrations/2026103xxxxxxx_event_artists.sql`,
`supabase/migrations/2026103xxxxxxx_landing_features_kind.sql`,
`supabase/migrations/2026103xxxxxxx_stats_country_total.sql`, `src/types/database.ts`,
`docs/ops/funktionsrechte-prod-stand-2026-10-08.md` (Hinweis auf event_artists-Policy).
## Acceptance
- [ ] Migration legt `event_artists` mit PK (event_id, artist_id), FK-Cascade, beiden Indizes,
      RLS, Select-Policy für anon/authenticated und `grant all` für service_role an.
- [ ] `landing_features` hat `kind` (Default `editorial`, Check) und `sponsor_name` (Check bei
      `sponsored`); bestehende Zeilen stehen auf `editorial`.
- [ ] `event_counts_for_stats()` liefert zusätzlich `country_total`; die MV-Definition zählt
      nur `country = 'AT'`, published, kommende Events.
- [ ] `src/types/database.ts` enthält `event_artists` und `landing_features` (Row/Insert/Update).
- [ ] `src/__tests__/db/security-definer-grants.test.ts` bleibt grün (keine neue schreibende
      SECURITY-DEFINER-Funktion); ein Migrations-Test prüft, dass die neue Tabelle eine
      Select-Policy für anon hat (Muster aus bestehenden Migrations-Tests, sonst neu anlegen).
- [ ] Kommentar in der Migration nennt `NOTIFY pgrst, 'reload schema'` als Pflichtschritt.
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
