-- Zweiter Schritt zu 20261115120000 (fn-31.17): die Eindeutigkeit ohne Land
-- entfernen. Erst ausführen, wenn der Code mit
-- `onConflict: user_id,artist_name_normalized,country` schreibt (PR zu
-- fn-31.17 ausgerollt); vorher schlüge jeder Follow fehl (kein passender
-- Unique-Index für ON CONFLICT).
--
-- Danach kann ein Nutzer demselben Künstler auf lasstreffen.at und auf
-- lasstreffen.de folgen (uq_followed_user_artist_country).

BEGIN;

ALTER TABLE public.followed_artists DROP CONSTRAINT IF EXISTS uq_followed_user_artist;

COMMIT;
