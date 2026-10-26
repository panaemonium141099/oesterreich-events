-- Festivals: Tickets, Preis, Beschreibung, Bild und Terminstatus direkt in
-- der Tabelle (2026-10-26). Bisher lagen Beschreibung/Preis/Bild nur in
-- data/festival-overrides.json und wurden zur Laufzeit von der Festival-
-- Website nachgeladen; ein Ticketlink fehlte ganz. Die Festivalseite listet
-- nur Festivals mit ends_at >= heute — mit den 2026er-Terminen der mica-
-- Registry war sie im Oktober 2026 fast leer. Die kommenden Ausgaben kommen
-- aus data/festivals-upcoming.json (npm run import:festivals).
--
-- Ausfuehren auf Hetzner (DDL geht nicht ueber PostgREST), danach
-- NOTIFY pgrst, 'reload schema';

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS ticket_url text,
  ADD COLUMN IF NOT EXISTS price_text text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text,
  -- 'confirmed' = offiziell veroeffentlichter Termin,
  -- 'expected'  = nur Monat/Wochenende angekuendigt (Seite zeigt "voraussichtlich")
  ADD COLUMN IF NOT EXISTS date_status text NOT NULL DEFAULT 'confirmed'
    CHECK (date_status IN ('confirmed', 'expected')),
  -- Wann die Daten zuletzt aus der Seed-Datei kamen (Nachvollziehbarkeit).
  ADD COLUMN IF NOT EXISTS seed_updated_at timestamptz;

COMMENT ON COLUMN festivals.ticket_url IS 'Offizieller Ticketlink (oeticket/Eventim bevorzugt); null bei Eintritt frei';
COMMENT ON COLUMN festivals.price_text IS 'Kurzer Preistext, z. B. "Festivalpass ab 229 €"';
COMMENT ON COLUMN festivals.description IS 'Kuratierte Beschreibung (3-6 Saetze, deutsch)';
COMMENT ON COLUMN festivals.image_url IS 'Hero-/Kartenbild (Sujet der Festival-Website oder og:image)';
COMMENT ON COLUMN festivals.date_status IS 'confirmed = offizieller Termin, expected = nur angekuendigtes Fenster';

NOTIFY pgrst, 'reload schema';
