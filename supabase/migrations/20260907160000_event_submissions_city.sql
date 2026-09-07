-- Inserate: Ortsangabe ergänzen.
--
-- Das Formular fragte Veranstaltungsort (Venue), Strasse, PLZ und
-- Bundesland ab, aber NICHT den Ort. Damit liess sich keine geocodierbare
-- Adresse bilden: "Esterhazyplatz 5, 7000, Schlosspark Esterhazy" liefert
-- bei Nominatim nichts (gemessen 2026-09-07), "Esterhazyplatz 5, 7000
-- Eisenstadt" dagegen sofort einen Treffer.
--
-- Ohne Koordinaten ist ein freigegebenes Inserat unsichtbar, nicht bloss
-- unbepinnt: /api/events filtert mit `.not('latitude','is',null)` und die
-- MV event_map_points verlangt lat/lng. Genau das ist am 2026-09-07 in
-- Produktion passiert.
--
-- Nullable, weil die Spalte für bereits eingereichte Zeilen nachträglich
-- kommt. Das Formular verlangt sie ab jetzt.
--
-- Anwendung auf Prod (Hetzner, /opt/supabase):
--   docker compose exec -T db psql -U supabase_admin -d postgres < <datei>

set statement_timeout = '5min';

alter table public.event_submissions
  add column if not exists city text;

comment on column public.event_submissions.city is
  'Ort/Gemeinde der Veranstaltung. Pflichtfeld im Formular; zusammen mit '
  'postal_code die Grundlage der Geocoding-Anfrage und der kanonischen '
  'events.address ("Strasse, PLZ Ort").';

notify pgrst, 'reload schema';
select pg_sleep(0.5);
notify pgrst, 'reload schema';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'event_submissions'
      and column_name  = 'city'
  ) then
    raise exception 'event_submissions.city fehlt';
  end if;
end
$$;
