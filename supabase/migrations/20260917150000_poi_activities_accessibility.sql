-- Barrierefreiheit fuer Freizeitaktivitaeten (2026-09-17).
--
-- Zwei Befund-Spalten, eine abgeleitete Flag-Spalte:
--   accessibility          Deskline-Befund (holidayThemes "Barrierefrei"/
--                          "Rollstuhlgaengig" oder Beschreibungstext), wird
--                          vom woechentlichen Ingest wie jede andere
--                          Business-Spalte zurueckgeschrieben.
--   accessibility_curated  kuratierte Angaben aus austria.info und den dort
--                          verlinkten Regionsseiten (features, note,
--                          source_url, source_label, checked_at). Der
--                          Deskline-Update-Pfad fasst sie NIE an — sonst
--                          wuerde der naechste Lauf die Markierung loeschen.
--   accessible             GENERATED: eine der beiden Spalten ist gesetzt.
--                          Filter "Barrierefrei" auf /aktivitaeten und
--                          /api/activities (barrierefrei=1).
-- Dazu themes_raw (holidayThemes roh, wie topics_raw) und fuer kuratierte
-- Quellen source_url/source_label (Attribution auf der Detailseite; die
-- Deskline-Zeilen behalten die feste Feratel-Attribution).
--
-- Ausfuehren per psql auf dem Server (kein PostgREST):
--   cd /opt/supabase && docker compose exec -T db psql -U supabase_admin -d postgres -f -

BEGIN;

ALTER TABLE poi_activities ADD COLUMN IF NOT EXISTS themes_raw jsonb;
ALTER TABLE poi_activities ADD COLUMN IF NOT EXISTS accessibility jsonb;
ALTER TABLE poi_activities ADD COLUMN IF NOT EXISTS accessibility_curated jsonb;
ALTER TABLE poi_activities ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE poi_activities ADD COLUMN IF NOT EXISTS source_label text;
ALTER TABLE poi_activities ADD COLUMN IF NOT EXISTS accessible boolean
  GENERATED ALWAYS AS (accessibility IS NOT NULL OR accessibility_curated IS NOT NULL) STORED;

-- Partial-Index: der Filter fragt immer visible AND accessible.
CREATE INDEX IF NOT EXISTS poi_activities_accessible_visible_idx
  ON poi_activities (quality_score DESC, id)
  WHERE visible AND accessible;

-- Public-View um die neuen Spalten erweitern (Spaltenliste == public-types.ts).
CREATE OR REPLACE VIEW poi_activities_public AS
  SELECT id, slug, shortid, name, description, description_short, tags, setting,
         lat, lng, town, gemeinde_slug, bundesland, opening_times, online_bookable,
         images, guest_cards, price_hint, affiliate_product, source, created_at,
         updated_at, accessible, accessibility, accessibility_curated, source_url,
         source_label
    FROM poi_activities
   WHERE visible = true AND is_closed = false;

COMMIT;

-- PostgREST liest das Schema sonst erst beim naechsten Neustart.
NOTIFY pgrst, 'reload schema';
