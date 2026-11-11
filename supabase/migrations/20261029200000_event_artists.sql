-- Künstler je Event aus der Eventim-Quelle (fn-30, Startseite als Tagesausgabe).
--
-- Der PFT-Feed liefert je Serie `artists` (artistId, artistName, artistImage,
-- evoLink). Die Kachel „Diese Woche live“ auf der Startseite rotiert daraus
-- drei Künstler mit AT-Termin in den nächsten 7 Tagen; /api/me/landing gleicht
-- gefolgte Künstler dagegen ab. Der Import (upsertEventimEvents) ersetzt je
-- Event die Zeilen des Feeds: Upsert auf (event_id, artist_id), Löschen der
-- Zeilen, die der Feed nicht mehr nennt. Alle Länder des Feeds (DE/CH für
-- spätere .de/.ch-Seiten), der Länderfilter läuft über den Join auf events.
--
-- Lesen: öffentlich (die Landing ist eine ISR-Shell mit Anon-Client; die
-- Kachel liest `event_artists` mit `events!inner`, das Embedding braucht den
-- FK im Schema-Cache von PostgREST).
-- Schreiben: nur der Import mit Service-Role, deshalb keine
-- Insert/Update/Delete-Policy. Der Event-Trigger
-- api_rollen_neue_objekte_absichern (20261008120100) schaltet RLS ohnehin
-- ein; ohne die Select-Policy liefert die Tabelle anon still nichts.
--
-- Ops (Pflicht nach dem Ausführen im Dashboard/MCP): der Schema-Cache von
-- PostgREST kennt die Tabelle und den FK erst nach
--   NOTIFY pgrst, 'reload schema';
-- sonst antwortet /rest/v1/event_artists mit 404 bzw. das Embedding
-- `events!inner` mit „Could not find a relationship“.

create table if not exists public.event_artists (
  event_id uuid not null references public.events(id) on delete cascade,
  artist_id text not null,
  artist_name text not null,
  artist_image text,
  evo_link text,
  source text not null default 'eventim',
  updated_at timestamptz not null default now(),
  primary key (event_id, artist_id)
);

-- Gefolgte Künstler → Termine (Abgleich über die Feed-ID).
create index if not exists event_artists_artist_id_idx
  on public.event_artists (artist_id);

-- Namensabgleich (normalizeArtistName arbeitet kleingeschrieben).
create index if not exists event_artists_artist_name_idx
  on public.event_artists (lower(artist_name));

alter table public.event_artists enable row level security;

drop policy if exists event_artists_public_read on public.event_artists;
create policy event_artists_public_read
  on public.event_artists for select
  to anon, authenticated
  using (true);

revoke all on public.event_artists from public, anon, authenticated;
grant select on public.event_artists to anon, authenticated;
grant all on public.event_artists to service_role;

notify pgrst, 'reload schema';
