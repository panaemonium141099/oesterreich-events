-- Re-tag events that were mis-filed as the surrounding Land-Bezirk but
-- whose postal code falls inside a Statutarstadt block. The original
-- district normalisation only ran the Stadt → Land direction (catch
-- wrong-PLZ on stadt-tag rows); this reverse pass catches Land → Stadt
-- (correct PLZ that the scraper put under the wrong tag).
--
-- Affected counts before this migration (land rows with stadt PLZ):
--   graz-umgebung      → 1428  (the worst offender — Erlebnisregion Graz feed)
--   wiener neustadt l. →  265
--   wels-land          →  167
--   steyr-land         →  100
--   st. pölten (land)  →   96
--   klagenfurt-land    →   72
--   krems (land)       →   50
--   linz-land          →   33
--   innsbruck-land     →   17
--   salzburg-umgebung  →    4
--   total              → ~2232 events promoted to their Stadt-Bezirk
--
-- Audit trail: the original district_pre_normalize column is unchanged
-- (it already holds the truly-original spelling from the very first
-- normalisation pass) so a full rollback is still:
--   UPDATE events SET district = district_pre_normalize
--   WHERE district_pre_normalize IS DISTINCT FROM district;
--
-- The scrape pipeline is updated in the same commit
-- (src/lib/district-normalizer.ts LAND_TO_STADT) so this won't
-- regenerate on the next scrape.

UPDATE events SET district = 'graz (stadt)'
 WHERE bundesland = 'steiermark' AND district = 'graz-umgebung'
   AND postal_code IN ('8010','8011','8013','8020','8021','8036','8041','8042','8043','8044','8045','8046','8047','8051','8052','8053','8054','8055','8063','8070','8071','8072','8073','8074','8075','8076','8077');

UPDATE events SET district = 'linz (stadt)'
 WHERE bundesland = 'oberoesterreich' AND district = 'linz-land'
   AND postal_code IN ('4010','4020','4030','4040','4050');

UPDATE events SET district = 'steyr (stadt)'
 WHERE bundesland = 'oberoesterreich' AND district = 'steyr-land'
   AND postal_code IN ('4400','4402');

UPDATE events SET district = 'wels (stadt)'
 WHERE bundesland = 'oberoesterreich' AND district = 'wels-land'
   AND postal_code = '4600';

UPDATE events SET district = 'klagenfurt (stadt)'
 WHERE bundesland = 'kaernten' AND district = 'klagenfurt-land'
   AND postal_code IN ('9010','9020','9061','9062','9063');

UPDATE events SET district = 'villach (stadt)'
 WHERE bundesland = 'kaernten' AND district = 'villach-land'
   AND postal_code IN ('9500','9504','9505','9506','9507','9508');

UPDATE events SET district = 'innsbruck (stadt)'
 WHERE bundesland = 'tirol' AND district = 'innsbruck-land'
   AND postal_code IN ('6010','6015','6020');

UPDATE events SET district = 'salzburg (stadt)'
 WHERE bundesland = 'salzburg' AND district = 'salzburg-umgebung'
   AND postal_code IN ('5020','5023','5026');

UPDATE events SET district = 'wiener neustadt (stadt)'
 WHERE bundesland = 'niederoesterreich' AND district = 'wiener neustadt (land)'
   AND postal_code = '2700';

UPDATE events SET district = 'st. pölten (stadt)'
 WHERE bundesland = 'niederoesterreich' AND district = 'st. pölten (land)'
   AND postal_code IN ('3100','3104','3107','3109');

UPDATE events SET district = 'krems (stadt)'
 WHERE bundesland = 'niederoesterreich' AND district = 'krems (land)'
   AND postal_code = '3500';
