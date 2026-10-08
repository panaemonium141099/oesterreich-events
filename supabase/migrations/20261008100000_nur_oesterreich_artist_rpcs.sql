-- Künstler-Matching und Künstler-Auftritte nur noch für österreichische Events.
--
-- lasstreffen.at ist rein österreichisch (src/lib/site-country.ts). Die
-- Matching-RPCs filterten nicht auf das Land: Prod 2026-10-08 hatte
-- artist_event_notifications auf künftige Events AT 201, DE 23, CH 1, und
-- notifications vom Typ spotify_match 36 DE und 1 CH. Daraus entstehen
-- In-App-Benachrichtigungen, Erinnerungs-Mails und die Auftritte auf der
-- Landing und unter /artists (get_artist_appearances).
--
-- Die Funktionen sind die Prod-Definitionen (pg_get_functiondef, gelesen
-- 2026-10-08) mit genau einer zusätzlichen Bedingung `e.country = 'AT'`.
-- Signatur, RETURNS, Sprache, STABLE, SECURITY DEFINER und search_path
-- (proconfig) bleiben wie in Prod; CREATE OR REPLACE setzt proconfig sonst
-- zurück, deshalb steht SET search_path ausdrücklich da. Eigentümer und
-- Rechte bleiben bei CREATE OR REPLACE erhalten.
--
-- Die Bestandszeilen in artist_event_notifications und notifications
-- bleiben stehen (die Daten sind für spätere .de/.ch-Seiten gedacht); die
-- Anzeige filtert sie (ArtistMatchBundles, send-reminders).
--
-- Betroffene Aufrufer ohne Codeänderung: Edge Function match-artists
-- (pg_cron), runMatchingPipeline (src/lib/artist-matching.ts),
-- /api/artists/follow, /auth/spotify/callback, /api/me/landing,
-- /api/artists/events.
--
-- Alle sieben Funktionen gehören in Prod supabase_admin (pg_proc.proowner,
-- geprüft 2026-10-08); postgres ist weder Superuser noch Mitglied von
-- supabase_admin und scheitert mit „must be owner of function". Deshalb als
-- supabase_admin anwenden, in einer Transaktion (alles oder nichts):
--
-- Anwendung auf Prod (Hetzner, /opt/supabase):
--   docker compose exec -T db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < <datei>

BEGIN;

-- ── Titel-Treffer (Regex) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_exact_artist_title(p_regex text, p_since timestamp with time zone)
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
      AND e.country = 'AT'
      AND e.title ~* p_regex;
END;
$function$;

-- ── Titel-Treffer (Batch) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_exact_artist_titles_batch(p_artist_names text[], p_since timestamp with time zone)
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
      AND e.country = 'AT'
      AND e.title ~* (E'\\m' || a.name || E'\\M');
END;
$function$;

-- ── Titel-Treffer nur Musik/Nightlife ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_exact_artist_titles_music_only(p_artist_names text[], p_since timestamp with time zone)
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
      AND e.country = 'AT'
      AND e.category IN ('Musik', 'Nightlife')
      AND e.title ~* (E'\\m' || a.name || E'\\M');
END;
$function$;

-- ── Unscharfe Titel-Treffer (pg_trgm liegt im Schema extensions) ───────
CREATE OR REPLACE FUNCTION public.match_fuzzy_artist_titles(p_artist_names text[], p_threshold real, p_since timestamp with time zone)
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
      AND e.country = 'AT'
      AND a.name <% e.title;
END;
$function$;

-- ── Treffer in der Beschreibung ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_artist_descriptions(p_artist_names text[], p_since timestamp with time zone)
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
      AND e.country = 'AT'
      AND e.description IS NOT NULL
      AND position(lower(a.name) in lower(e.description)) > 0;
END;
$function$;

-- ── Festival-Lineups (nur CLI-Pfad; heute sind alle derived-Events AT) ──
CREATE OR REPLACE FUNCTION public.match_lineup_artists(p_artist_names text[], p_since timestamp with time zone)
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
      AND e.country = 'AT';
END;
$function$;

-- ── Auftritte gefolgter Künstler (/api/me/landing, /api/artists/events) ─
-- conc: Treffer aus artist_event_notifications, dort liegen die DE/CH-Zeilen.
-- fest: heute ohne ausländischen Treffer, der Filter steht im WHERE (nicht
-- im LEFT JOIN), damit Festivals ohne derived-Event erhalten bleiben.
CREATE OR REPLACE FUNCTION public.get_artist_appearances(p_user_id uuid)
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
      and (de.id is null or de.country = 'AT')
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
      and e.country = 'AT'
      and e.title !~* '(experience|tribute|cover\s?band|liveplay|karaoke)'
    order by n.artist_name, e.start_date::date,
             (e.image_url is null), length(e.title), e.start_date
  )
  select * from fest
  union all
  select * from conc
  order by start_date asc;
$function$;

-- Rechte bleiben bei CREATE OR REPLACE erhalten; die service_role-Grants der
-- Ursprungs-Migrationen werden zur Sicherheit wiederholt (idempotent).
GRANT EXECUTE ON FUNCTION public.match_exact_artist_title(text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_exact_artist_titles_batch(text[], timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_exact_artist_titles_music_only(text[], timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_fuzzy_artist_titles(text[], real, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_artist_descriptions(text[], timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_lineup_artists(text[], timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_artist_appearances(uuid) TO service_role;

COMMIT;
