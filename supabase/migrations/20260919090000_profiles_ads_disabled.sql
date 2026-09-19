-- Werbefreie Accounts (2026-09-19).
--
-- AdSense hat die Einnahmen wegen ungueltiger Klicks eingeschraenkt (bis zu
-- 30 Tage ohne Ausschuettung). Eigene Klicks auf eigene Anzeigen sind der
-- klassische Ausloeser, deshalb koennen Admins einzelne Accounts (vor allem
-- die eigenen und die des Teams) im Adminbereich unter Users werbefrei
-- schalten: fuer diese Accounts laedt der Client weder das AdSense-Script
-- noch eine Anzeigenflaeche (src/lib/ads/ads-allowed.ts, /api/me/ads).
--
-- Die Spalte schreibt NUR /api/admin/users/[id] (PATCH, service_role):
-- die UPDATE-Policy auf profiles erlaubt nur das eigene Profil, ein
-- Admin-Update aus dem Browser wuerde still 0 Zeilen treffen.
--
-- Ausfuehren per psql auf dem Server (kein PostgREST):
--   cd /opt/supabase && docker compose exec -T db psql -U supabase_admin -d postgres -f -

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ads_disabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.ads_disabled IS
  'Werbefrei: kein AdSense-Script und keine Anzeigenflaechen fuer diesen Account (Admin-Schalter unter /admin/users).';
