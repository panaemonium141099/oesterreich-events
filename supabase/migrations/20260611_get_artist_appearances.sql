-- get_artist_appearances(user) — saubere Künstler-Auftritte für die Anzeige.
--
-- Behebt die Match-Qualität: statt der verrauschten artist_event_notifications
-- (description-Matches erzeugten Falsch-Treffer wie "Linkin Park im Viper Room"
-- und Festival-Ticket-Fan-out) ist hier das kuratierte Line-up die Wahrheit:
--   - Festival-Auftritte: followed_artists × festival_artists × festivals
--     → 1 Zeile pro (Künstler × Festival), keine Falsch-Treffer.
--   - Solo-Konzerte: präzise Titel-Matches, dedupliziert pro (Künstler × Tag),
--     Tribute/Cover-Titel rausgefiltert.
-- Beide Surfaces (Landing "Auftritte deiner Lieblingskünstler" und /artists
-- "Gefundene Auftritte") konsumieren diese eine Funktion → identische Anzeige.
--
-- security definer + nur an service_role granted; Aufrufer (Server-Routen)
-- übergeben die serverseitig ermittelte user_id.

drop function if exists public.get_artist_appearances(uuid);

create function public.get_artist_appearances(p_user_id uuid)
returns table (
  artist_name   text,
  artist_image  text,
  kind          text,   -- 'festival' | 'concert'
  context       text,   -- Festivalname (festival) bzw. Event-Titel (concert)
  event_id      uuid,
  event_slug    text,
  start_date    timestamptz,
  location_name text,
  postal_code   text,
  bundesland    text
)
language sql
stable
security definer
set search_path = public
as $$
  with fest as (
    select distinct on (fo.artist_name_normalized, f.id)
      fo.artist_name::text                     as artist_name,
      fo.spotify_image_url::text               as artist_image,
      'festival'::text                         as kind,
      f.canonical_name::text                   as context,
      fa.derived_event_id                      as event_id,
      de.slug::text                            as event_slug,
      coalesce(de.start_date, f.starts_at)     as start_date,
      coalesce(de.location_name, f.city)::text as location_name,
      de.postal_code::text                     as postal_code,
      coalesce(de.bundesland, f.state)::text   as bundesland
    from public.followed_artists fo
    join public.festival_artists fa on fa.artist_name_normalized = fo.artist_name_normalized
    join public.festivals f          on f.id = fa.festival_id
    left join public.events de       on de.id = fa.derived_event_id
    where fo.user_id = p_user_id
      and coalesce(de.start_date, f.starts_at) >= current_date
    order by fo.artist_name_normalized, f.id, coalesce(de.start_date, f.starts_at)
  ),
  conc as (
    select distinct on (n.artist_name, e.start_date::date)
      n.artist_name::text         as artist_name,
      fo.spotify_image_url::text  as artist_image,
      'concert'::text             as kind,
      e.title::text               as context,
      e.id                        as event_id,
      e.slug::text                as event_slug,
      e.start_date                as start_date,
      e.location_name::text       as location_name,
      e.postal_code::text         as postal_code,
      e.bundesland::text          as bundesland
    from public.artist_event_notifications n
    join public.events e on e.id = n.event_id
    left join public.followed_artists fo
           on fo.user_id = n.user_id and fo.artist_name = n.artist_name
    where n.user_id = p_user_id
      and n.match_source = 'title'
      and e.start_date >= current_date
      and e.title !~* '(experience|tribute|cover\s?band|liveplay|karaoke)'
    order by n.artist_name, e.start_date::date,
             (e.image_url is null), length(e.title), e.start_date
  )
  select * from fest
  union all
  select * from conc
  order by start_date asc;
$$;

grant execute on function public.get_artist_appearances(uuid) to service_role;
