-- Künstler folgen und Erkennung je Land (fn-31.17).
--
-- lasstreffen.de zeigt dieselben Künstler wie lasstreffen.at (event_artists
-- führt alle Feed-Länder), benachrichtigt wird aber nur für Termine im Land
-- der Seite, auf der gefolgt wurde: ein Follow auf .de meldet Termine in
-- Deutschland, ein Follow auf .at Termine in Österreich.
--
-- 1. followed_artists.country: das Land der Seite, auf der gefolgt wurde.
--    Bestand 'AT' (88 Follows von 6 Nutzern, Prod 15.11.2026; .de hat noch
--    keinen Login). Eindeutig je (Nutzer, Künstler, Land): wer auf beiden
--    Seiten folgt, hat zwei Follows. Die bisherige Eindeutigkeit
--    uq_followed_user_artist bleibt in dieser Migration stehen, weil der
--    laufende Code noch mit `onConflict: user_id,artist_name_normalized`
--    schreibt; sie fällt in 20261115130000, wenn der neue Code läuft.
-- 2. Die sechs Matching-Funktionen und get_artist_appearances bekommen
--    `p_country text DEFAULT 'AT'` statt des festen `e.country = 'AT'`
--    (20261008100000). Ein Aufruf ohne Land liefert dasselbe wie bisher,
--    der laufende Code und die Edge Function arbeiten ohne Änderung weiter.
--    Die alten Signaturen werden entfernt: zwei Fassungen mit und ohne Land
--    könnte PostgREST bei einem Aufruf ohne p_country nicht unterscheiden.
--
-- Die Migration ist wiederholbar: sie entfernt auch die neue Fassung, bevor
-- sie sie anlegt.
--
-- Neue Funktionen sind nicht öffentlich (Default-Privileges seit
-- 20261008130000). Die Rechte stehen ausdrücklich da, wie Prod sie am
-- 15.11.2026 hatte: service_role für alle sieben, authenticated für die
-- vier, die /api/artists/follow mit der Sitzung des Nutzers ruft. Alle
-- sieben lesen nur (STABLE).
--
-- Als supabase_admin anwenden (Eigentümer der Funktionen):
--   docker compose exec -T db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < <datei>
-- danach liest PostgREST das Schema neu (NOTIFY am Ende).

BEGIN;

ALTER TABLE public.followed_artists
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'AT';

COMMENT ON COLUMN public.followed_artists.country IS
  'Land der Seite, auf der gefolgt wurde (AT, DE). Die Erkennung meldet nur Termine in diesem Land.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_followed_user_artist_country
  ON public.followed_artists (user_id, artist_name_normalized, country);

DROP FUNCTION IF EXISTS public.match_exact_artist_title(text, timestamptz);
DROP FUNCTION IF EXISTS public.match_exact_artist_title(text, timestamptz, text);
DROP FUNCTION IF EXISTS public.match_exact_artist_titles_batch(text[], timestamptz);
DROP FUNCTION IF EXISTS public.match_exact_artist_titles_batch(text[], timestamptz, text);
DROP FUNCTION IF EXISTS public.match_exact_artist_titles_music_only(text[], timestamptz);
DROP FUNCTION IF EXISTS public.match_exact_artist_titles_music_only(text[], timestamptz, text);
DROP FUNCTION IF EXISTS public.match_fuzzy_artist_titles(text[], real, timestamptz);
DROP FUNCTION IF EXISTS public.match_fuzzy_artist_titles(text[], real, timestamptz, text);
DROP FUNCTION IF EXISTS public.match_artist_descriptions(text[], timestamptz);
DROP FUNCTION IF EXISTS public.match_artist_descriptions(text[], timestamptz, text);
DROP FUNCTION IF EXISTS public.match_lineup_artists(text[], timestamptz);
DROP FUNCTION IF EXISTS public.match_lineup_artists(text[], timestamptz, text);
DROP FUNCTION IF EXISTS public.get_artist_appearances(uuid);
DROP FUNCTION IF EXISTS public.get_artist_appearances(uuid, text);

-- ── Titel-Treffer (Regex) ──────────────────────────────────────────────
CREATE FUNCTION public.match_exact_artist_title(p_regex text, p_since timestamp with time zone, p_country text DEFAULT 'AT')
 RETURNS TABLE(event_id uuid, event_title text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN QUERY
    SELECT e.id AS event_id, e.title AS event_title
    FROM events e
    WHERE e.start_date >= now()
      AND e.updated_at > p_since
      AND e.source_type IS DISTINCT FROM 'derived'
      AND (e.publish_status IS NULL OR e.publish_status IN ('published', 'published_low_confidence'))
      AND e.country = p_country
      AND e.title ~* p_regex;
END;
$function$;

-- ── Titel-Treffer (Batch) ──────────────────────────────────────────────
CREATE FUNCTION public.match_exact_artist_titles_batch(p_artist_names text[], p_since timestamp with time zone, p_country text DEFAULT 'AT')
 RETURNS TABLE(event_id uuid, event_title text, artist_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN QUERY
    SELECT e.id AS event_id,
           e.title AS event_title,
           a.name AS artist_name
    FROM events e
    CROSS JOIN unnest(p_artist_names) AS a(name)
    WHERE e.start_date >= now()
      AND e.updated_at > p_since
      AND e.source_type IS DISTINCT FROM 'derived'
      AND (e.publish_status IS NULL OR e.publish_status IN ('published', 'published_low_confidence'))
      AND e.country = p_country
      AND e.title ~* (E'\\m' || a.name || E'\\M');
END;
$function$;

-- ── Titel-Treffer nur Musik/Nightlife ──────────────────────────────────
CREATE FUNCTION public.match_exact_artist_titles_music_only(p_artist_names text[], p_since timestamp with time zone, p_country text DEFAULT 'AT')
 RETURNS TABLE(event_id uuid, event_title text, artist_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN QUERY
    SELECT e.id AS event_id,
           e.title AS event_title,
           a.name AS artist_name
    FROM events e
    CROSS JOIN unnest(p_artist_names) AS a(name)
    WHERE e.start_date >= now()
      AND e.updated_at > p_since
      AND e.source_type IS DISTINCT FROM 'derived'
      AND (e.publish_status IS NULL OR e.publish_status IN ('published', 'published_low_confidence'))
      AND e.country = p_country
      AND e.category IN ('Musik', 'Nightlife')
      AND e.title ~* (E'\\m' || a.name || E'\\M');
END;
$function$;

-- ── Unscharfe Titel-Treffer (pg_trgm liegt im Schema extensions) ───────
CREATE FUNCTION public.match_fuzzy_artist_titles(p_artist_names text[], p_threshold real, p_since timestamp with time zone, p_country text DEFAULT 'AT')
 RETURNS TABLE(event_id uuid, event_title text, artist_name text, similarity real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
BEGIN
  PERFORM set_config('pg_trgm.word_similarity_threshold', p_threshold::text, true);

  RETURN QUERY
    SELECT e.id AS event_id,
           e.title AS event_title,
           a.name AS artist_name,
           word_similarity(a.name, e.title) AS similarity
    FROM events e
    CROSS JOIN unnest(p_artist_names) AS a(name)
    WHERE e.start_date >= now()
      AND e.updated_at > p_since
      AND e.source_type IS DISTINCT FROM 'derived'
      AND (e.publish_status IS NULL OR e.publish_status IN ('published', 'published_low_confidence'))
      AND e.country = p_country
      AND a.name <% e.title;
END;
$function$;

-- ── Treffer in der Beschreibung ────────────────────────────────────────
CREATE FUNCTION public.match_artist_descriptions(p_artist_names text[], p_since timestamp with time zone, p_country text DEFAULT 'AT')
 RETURNS TABLE(event_id uuid, event_title text, artist_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  RETURN QUERY
    SELECT e.id AS event_id,
           e.title AS event_title,
           a.name AS artist_name
    FROM events e
    CROSS JOIN unnest(p_artist_names) AS a(name)
    WHERE e.start_date >= now()
      AND e.updated_at > p_since
      AND e.source_type IS DISTINCT FROM 'derived'
      AND (e.publish_status IS NULL OR e.publish_status IN ('published', 'published_low_confidence'))
      AND e.country = p_country
      AND e.description IS NOT NULL
      AND position(lower(a.name) in lower(e.description)) > 0;
END;
$function$;

-- ── Festival-Lineups (nur CLI-Pfad) ────────────────────────────────────
CREATE FUNCTION public.match_lineup_artists(p_artist_names text[], p_since timestamp with time zone, p_country text DEFAULT 'AT')
 RETURNS TABLE(derived_event_id uuid, event_title text, parent_event_id uuid, festival_id uuid, festival_name text, artist_name_raw text, artist_name_normalized text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
    SELECT
      fa.derived_event_id,
      e.title AS event_title,
      f.parent_event_id,
      f.id AS festival_id,
      f.canonical_name AS festival_name,
      fa.artist_name_raw,
      fa.artist_name_normalized
    FROM festival_artists fa
    JOIN festivals f ON f.id = fa.festival_id
    JOIN events e ON e.id = fa.derived_event_id
    WHERE fa.artist_name_normalized = ANY(p_artist_names)
      AND f.starts_at >= current_date
      AND fa.updated_at > p_since
      AND fa.derived_event_id IS NOT NULL
      AND (e.publish_status IS NULL OR e.publish_status IN ('published', 'published_low_confidence'))
      AND e.country = p_country;
END;
$function$;

-- ── Auftritte gefolgter Künstler (/api/me/landing, /api/artists/events) ─
-- Nur Follows und Termine des Landes. Der Landesfilter der Festivals steht im
-- WHERE (nicht im LEFT JOIN), damit Festivals ohne derived-Event für
-- Österreich erhalten bleiben.
CREATE FUNCTION public.get_artist_appearances(p_user_id uuid, p_country text DEFAULT 'AT')
 RETURNS TABLE(artist_name text, artist_image text, kind text, context text, event_id uuid, event_slug text, start_date timestamp with time zone, location_name text, postal_code text, bundesland text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and fo.country = p_country
      -- Festivals ohne eigenes Event führt nur die österreichische Registry.
      and ((de.id is null and p_country = 'AT') or de.country = p_country)
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
          and fo.country = p_country
    where n.user_id = p_user_id
      and n.match_source = 'title'
      and e.start_date >= current_date
      and e.country = p_country
      -- Außerhalb Österreichs nur mit Follow des Landes: aus der Zeit vor
      -- 20261008100000 liegen Treffer in DE und CH zu Follows von lasstreffen.at vor.
      and (p_country = 'AT' or fo.id is not null)
      and e.title !~* '(experience|tribute|cover\s?band|liveplay|karaoke)'
    order by n.artist_name, e.start_date::date,
             (e.image_url is null), length(e.title), e.start_date
  )
  select * from fest
  union all
  select * from conc
  order by start_date asc;
$function$;

-- Rechte ausdrücklich (siehe Kopf).
REVOKE ALL ON FUNCTION public.match_exact_artist_title(text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_exact_artist_title(text, timestamptz, text) TO service_role, postgres, authenticated;
REVOKE ALL ON FUNCTION public.match_exact_artist_titles_batch(text[], timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_exact_artist_titles_batch(text[], timestamptz, text) TO service_role, postgres;
REVOKE ALL ON FUNCTION public.match_exact_artist_titles_music_only(text[], timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_exact_artist_titles_music_only(text[], timestamptz, text) TO service_role, postgres;
REVOKE ALL ON FUNCTION public.match_fuzzy_artist_titles(text[], real, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_fuzzy_artist_titles(text[], real, timestamptz, text) TO service_role, postgres, authenticated;
REVOKE ALL ON FUNCTION public.match_artist_descriptions(text[], timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_artist_descriptions(text[], timestamptz, text) TO service_role, postgres, authenticated;
REVOKE ALL ON FUNCTION public.match_lineup_artists(text[], timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_lineup_artists(text[], timestamptz, text) TO service_role, postgres, authenticated;
REVOKE ALL ON FUNCTION public.get_artist_appearances(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_artist_appearances(uuid, text) TO service_role, postgres;

NOTIFY pgrst, 'reload schema';

COMMIT;
