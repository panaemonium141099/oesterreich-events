-- Ortsdaten: ein Schreibweg (fn-27, 2026-09-24).
--
-- 1. Events entstehen nur noch serverseitig über den Resolver
--    (Scraper-Sync, Einreichung mit Admin-Freigabe). Die Policy, mit der
--    jeder eingeloggte Nutzer direkt aus dem Browser Events anlegen konnte
--    (/events/create, inzwischen Umleitung auf /event-inserieren), und das
--    Ändern eigener Events samt Ortsangaben fallen weg. Admins (is_god)
--    ändern weiter; Löschen bleibt unverändert.
-- 2. DB-seitige Zweitquellen für Ortsdaten entfallen: der Trigger, der das
--    Bundesland aus einer eigenen PLZ-Tabelle setzte (der Resolver setzt es
--    selbst), und die Reste des Master-Koordinaten-Systems, dessen Trigger
--    seit fn-25 abgeschaltet ist.
--
-- Rückweg: die alten Definitionen stehen in früheren Migrationen dieses
-- Ordners, die Tabelleninhalte im nächtlichen pg_dump.

drop policy if exists "Authenticated users can insert events" on public.events;
drop policy if exists "Users can update own events" on public.events;
create policy "Admins can update events" on public.events
  for update using (is_god()) with check (is_god());

drop trigger if exists trg_bundesland_from_plz on public.events;
drop function if exists public.set_bundesland_from_plz();
drop table if exists public.plz_bundesland;

drop function if exists public.apply_master_coords_bulk cascade;
drop function if exists public.apply_master_coords cascade;
drop table if exists public.location_master_coords;
