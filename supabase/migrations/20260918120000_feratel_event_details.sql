-- Feratel Deskline: Detail-Cache und Bildnachweis (2026-09-18).
--
-- Die Listen-Antwort der WebAPI liefert pro Event nur den naechsten Termin,
-- keine Adresse, keinen Veranstalter, keinen Link, keinen Preis. Die
-- Detailseite (/events/{dbCode}/{id}) liefert das alles; ein Aufruf pro
-- Event und Stunde ist zu viel (Feratel-IP-Limit), deshalb liegt der
-- komprimierte Auszug hier und wird pro Lauf nur fuer ein Budget an Events
-- aufgefrischt (src/lib/scrapers/feratel-details.ts).

CREATE TABLE IF NOT EXISTS public.feratel_event_details (
  event_id   text PRIMARY KEY,
  db_code    text NOT NULL,
  region     text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  detail     jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS feratel_event_details_fetched_at_idx
  ON public.feratel_event_details (fetched_at);

ALTER TABLE public.feratel_event_details ENABLE ROW LEVEL SECURITY;
-- Nur der Service-Key (Scraper) liest und schreibt; keine Policies fuer anon/authenticated.

-- Bildnachweis der Quelle (Feratel images.copyright/author), pro Event.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_credit text;

NOTIFY pgrst, 'reload schema';
