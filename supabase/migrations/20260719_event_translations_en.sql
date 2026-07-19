-- fn-17 Slice 3: Lazy-Übersetzung der Event-Inhalte (EN).
--
-- Beim ersten EN-Aufruf einer Event-Detailseite übersetzt Gemini 2.5 Flash
-- Titel + Beschreibung; das Ergebnis wird hier gecacht (ein Event wird nur
-- EINMAL übersetzt). Nur Future-Events werden übersetzt — der Long-Tail an
-- nie besuchten bzw. vergangenen Events kostet damit nichts.
--
-- Nullable ADD COLUMN = metadata-only, kein Table-Rewrite (280k rows safe).
-- Partial-Index für die Sitemap-Query (nur übersetzte Future-Events landen
-- als /en-URLs in der Sitemap).
--
-- Applied to prod via Supabase MCP on 2026-07-19.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS translated_at timestamptz;

CREATE INDEX IF NOT EXISTS events_translated_future_idx
  ON public.events (start_date)
  WHERE description_en IS NOT NULL;
