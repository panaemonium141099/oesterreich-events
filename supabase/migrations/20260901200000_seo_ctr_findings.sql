-- SEO-CTR-Monitor (2026-09-01): taegliche Momentaufnahme der Klickrate je
-- Seitentyp plus die konkreten Seiten mit der groessten Luecke zwischen
-- Sichtbarkeit und Klicks.
--
-- Warum eine eigene Tabelle neben seo_snapshots: der Snapshot haelt nur die
-- Top-50-Seiten eines 28-Tage-Fensters fest. Fuer die Wirkungsmessung einer
-- Snippet-Aenderung brauchen wir aber (a) alle Seitentypen, auch die
-- Aktivitaeten, und (b) einen kurzen 7-Tage-Blick, der eine Veraenderung
-- zeitnah zeigt statt sie ueber vier Wochen zu verwaessern.

CREATE TABLE IF NOT EXISTS public.seo_ctr_findings (
  id           bigserial PRIMARY KEY,
  measured_at  timestamptz NOT NULL DEFAULT now(),
  window_start date NOT NULL,
  window_end   date NOT NULL,
  -- Kennzahlen je Seitentyp: { event_detail: {impressions, clicks, ctr, avgPosition, pageCount}, ... }
  by_type      jsonb NOT NULL,
  -- Events getrennt nach kommenden/vergangenen Terminen
  events       jsonb NOT NULL,
  -- Top-Seiten mit CTR-Luecke (gute Position, zu wenige Klicks)
  ctr_gap      jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Seiten in Reichweite (Position 4-20)
  striking     jsonb NOT NULL DEFAULT '[]'::jsonb,
  totals       jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS seo_ctr_findings_measured_idx
  ON public.seo_ctr_findings (measured_at DESC);

ALTER TABLE public.seo_ctr_findings ENABLE ROW LEVEL SECURITY;
-- Kein anon-Zugriff: Geschaeftskennzahlen. Lesen ueber service_role
-- (Admin-Routen) — deshalb bewusst KEINE SELECT-Policy fuer anon.
GRANT ALL ON public.seo_ctr_findings TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.seo_ctr_findings_id_seq TO service_role;
