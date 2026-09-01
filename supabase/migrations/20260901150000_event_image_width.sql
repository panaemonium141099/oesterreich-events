-- SEO-Bilder-Fix (2026-09-01): gemessene Bildbreite pro Event.
--
-- Google zeigt mit max-image-preview:large grosse SERP-Thumbnails aus dem
-- Seiten-/Schema-Bild. Gescrapte Mini-Bilder (Stichprobe 222x222) wirken
-- hochskaliert verpixelt und druecken die CTR. probe-image-widths.ts misst
-- die echte Breite per Range-Request; der Bild-Resolver ersetzt Bilder
-- < 600px durch die grossen lokalen Kategorie-Fallbacks.
--
--   image_width : Pixel-Breite | -1 = Probe fehlgeschlagen | NULL = unvermessen
--   image_probed_url : welche URL vermessen wurde (Dokumentation/Debug)
--
-- Tauscht ein Scraper das Bild (image_url aendert sich), setzt der Trigger
-- den Probe-Status zurueck — der naechste Pipeline-Lauf vermisst neu.
-- (PostgREST kann nicht Spalte-mit-Spalte vergleichen, deshalb Trigger
-- statt "probed_url <> image_url"-Filter im Script.)

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_width smallint;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_probed_url text;

CREATE OR REPLACE FUNCTION public.reset_image_probe_on_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.image_url IS DISTINCT FROM OLD.image_url THEN
    -- Liefert der Updater (supabase-sync mit Scraper-Dims) selbst eine neue
    -- Breite mit, bleibt sie stehen — sonst zuruecksetzen fuer die Probe.
    IF NEW.image_width IS NOT DISTINCT FROM OLD.image_width THEN
      NEW.image_width := NULL;
    END IF;
    NEW.image_probed_url := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reset_image_probe ON public.events;
CREATE TRIGGER trg_reset_image_probe
  BEFORE UPDATE OF image_url ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.reset_image_probe_on_change();

-- Partial-Index fuer den Probe-Backlog (unvermessene Events mit Bild)
CREATE INDEX IF NOT EXISTS events_image_probe_backlog_idx
  ON public.events (start_date)
  WHERE image_url IS NOT NULL AND image_probed_url IS NULL;
