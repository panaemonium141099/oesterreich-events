-- fn-25 Phase A4: Master-Koordinaten-Trigger und Bulk-RPC stilllegen.
--
-- Der BEFORE-Trigger trg_apply_master_coords setzte bei jedem Insert/Update
-- von location_name, postal_code, latitude oder longitude die Koordinate aus
-- location_master_coords ein — auch dann, wenn der Freigabevertrag sie
-- gerade verworfen hatte (1.982 Live-Events mit Pin, aber
-- geocoding_confidence IS NULL, gemessen 2026-09-13). 5.266 der 7.275 Master
-- stammen aus demselben GeoNames-Namensabgleich, der die Fehler erzeugt hat
-- (docs/ORTSDATEN-ANALYSE-2026-09-13.md, §5 D5).
--
-- Regel ab jetzt: Kein Trigger ändert Ortswerte eigenmächtig. Master sind
-- höchstens eine Evidenzquelle des Resolvers (Phase C), nie ein
-- Datenbank-Automatismus. Tabelle und Funktion bleiben für Forensik und
-- Phase C4 (versioniertes Ungültigsetzen) erhalten.
--
-- Anwendung auf Prod (Hetzner, /opt/supabase):
--   docker compose exec -T db psql -U supabase_admin -d postgres < <datei>

set statement_timeout = '5min';

drop trigger if exists trg_apply_master_coords on public.events;

comment on function public.apply_master_coords() is
  'fn-25 (2026-09-13): STILLGELEGT. Trigger trg_apply_master_coords wurde entfernt; '
  'die Funktion bleibt nur als Referenz erhalten und darf nicht erneut an events gehängt werden.';

-- Bulk-Anwendung ebenfalls stilllegen: gleiche Signatur, kein Schreibzugriff.
create or replace function public.apply_master_coords_bulk(days_from integer default 0, days_to integer default 1825)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_catalog'
as $$
begin
  raise warning 'apply_master_coords_bulk ist seit fn-25 (2026-09-13) stillgelegt: Master-Koordinaten werden nicht mehr automatisch auf events angewendet (days_from=%, days_to=%).', days_from, days_to;
  return 0;
end;
$$;

comment on function public.apply_master_coords_bulk(integer, integer) is
  'fn-25 (2026-09-13): STILLGELEGT (No-op mit WARNING). Ehemals Massenzuweisung der Master-Koordinaten auf events.';

notify pgrst, 'reload schema';
