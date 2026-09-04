-- Englische Beschreibungen fuer Freizeit-POIs (fn-17).
--
-- Warum nur die Beschreibung und nicht der Name: POI-Namen sind
-- Eigennamen ("Tennisplatz Stumm", "Seeschloss Ort"). Sie bleiben in
-- beiden Sprachen gleich — genauso, wie die Event-Uebersetzung
-- Veranstaltungsorte und Bandnamen unveraendert laesst. Uebersetzt wird
-- der Fliesstext, der die Seite ueberhaupt indexierbar macht: das E7-Gate
-- in src/lib/activities/indexability.ts verlangt >= 200 Zeichen
-- Beschreibung (oder Bild + Oeffnungszeiten).
--
-- Stand bei Anlage (2026-09-04): 11 367 POIs, davon 10 654 sichtbar und
-- 6 329 mit >= 250 Zeichen Text, Schnitt 548 Zeichen.
--
-- description_short_en bleibt bewusst weg: description_short ist bei den
-- Deskline-Quellen fast immer der abgeschnittene Anfang von description,
-- und die Meta-Description zieht sich ihren Satz seit dem CTR-Fix aus
-- strukturierten Feldern (src/lib/seo/activity-meta.ts).

ALTER TABLE public.poi_activities
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS translated_at timestamptz;

-- Der Batch sucht "sichtbar, offen, langer Text, noch nicht uebersetzt"
-- und arbeitet nach id aufsteigend. Partieller Index, weil die Zeilen MIT
-- Uebersetzung nach dem Backfill die grosse Mehrheit sind und nie wieder
-- gelesen werden muessen.
CREATE INDEX IF NOT EXISTS poi_activities_untranslated_idx
  ON public.poi_activities (id)
  WHERE description_en IS NULL AND visible AND NOT is_closed;

COMMENT ON COLUMN public.poi_activities.description_en IS
  'Englische Uebersetzung von description (Gemini, fn-17). NULL = /en/aktivitaet/<slug> rendert deutschen Text und kanonisiert auf die DE-URL.';
COMMENT ON COLUMN public.poi_activities.translated_at IS
  'Zeitpunkt der letzten Uebersetzung. NULL = nie uebersetzt.';
