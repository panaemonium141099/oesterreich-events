-- Normalize events.district to canonical lowercase names matching
-- districtsAT.ts (lowercased). The DB had grown ~70 alias variants per
-- bundesland (ASCII like "suedoststeiermark", slash-form like
-- "waidhofen/thaya", short form like "graz", obsolete names like
-- "bruck-an-der-mur"). The list-view filter chip only sends one
-- canonical form per district so the alias rows were unreachable.
--
-- Safety: an audit column district_pre_normalize preserves the original
-- value before this run. Rollback:
--   UPDATE events SET district = district_pre_normalize
--   WHERE district_pre_normalize IS DISTINCT FROM district;
--
-- Scope: only "lossless" rewrites where alias→canonical is unambiguous
-- given the bundesland (and PLZ for stadt/land disambiguation).
-- Out of scope: events whose district names belong to a *different*
-- bundesland (e.g. district='schwechat' in bundesland='burgenland').
-- Those are bundesland-tagging mistakes, not district aliases — fixing
-- them needs the per-event coordinates, not a string rewrite.

BEGIN;

-- 1. Audit column for rollback. Idempotent.
ALTER TABLE events ADD COLUMN IF NOT EXISTS district_pre_normalize TEXT;
UPDATE events
SET district_pre_normalize = district
WHERE district_pre_normalize IS NULL AND district IS NOT NULL;

-- 2. Stadt/Land disambiguation via PLZ FIRST — has to run before the
-- generic alias map below, because the generic map collapses
-- "graz" → "graz (stadt)" unconditionally and we want the
-- non-stadt PLZ rows to stay as graz-umgebung etc.
--
-- For each Statutarstadt: if the bare name is recorded with a PLZ that
-- belongs to the surrounding district, rewrite to the *land* district
-- so the next pass doesn't promote it to *stadt*.

UPDATE events SET district = 'graz-umgebung'
 WHERE bundesland = 'steiermark' AND district = 'graz'
   AND postal_code IS NOT NULL
   AND postal_code NOT IN ('8010','8011','8013','8020','8021','8036','8041','8042','8043','8044','8045','8046','8047','8051','8052','8053','8054','8055','8063','8070','8071','8072','8073','8074','8075','8076','8077');

UPDATE events SET district = 'linz-land'
 WHERE bundesland = 'oberoesterreich' AND district IN ('linz','statutarstadt')
   AND postal_code IS NOT NULL
   AND postal_code NOT IN ('4010','4020','4030','4040','4050');

UPDATE events SET district = 'klagenfurt-land'
 WHERE bundesland = 'kaernten' AND district = 'klagenfurt'
   AND postal_code IS NOT NULL
   AND postal_code NOT IN ('9010','9020','9061','9062','9063');

UPDATE events SET district = 'villach-land'
 WHERE bundesland = 'kaernten' AND district = 'villach'
   AND postal_code IS NOT NULL
   AND postal_code NOT IN ('9500','9504','9505','9506','9507','9508');

UPDATE events SET district = 'innsbruck-land'
 WHERE bundesland = 'tirol' AND district = 'innsbruck'
   AND postal_code IS NOT NULL
   AND postal_code NOT IN ('6010','6015','6020');

UPDATE events SET district = 'wiener neustadt (land)'
 WHERE bundesland = 'niederoesterreich' AND district IN ('wiener-neustadt')
   AND postal_code IS NOT NULL
   AND postal_code <> '2700';

UPDATE events SET district = 'st. pölten (land)'
 WHERE bundesland = 'niederoesterreich' AND district = 'st-poelten'
   AND postal_code IS NOT NULL
   AND postal_code <> '3100';

UPDATE events SET district = 'krems (land)'
 WHERE bundesland = 'niederoesterreich' AND district IN ('krems','krems land')
   AND postal_code IS NOT NULL
   AND postal_code <> '3500';

-- 3. Canonical alias map — bundesland scoped. Each row: (bl, alias, canonical).
-- Only rewrites events whose bundesland matches, so e.g. an accidental
-- "schwechat" inside burgenland is left alone (separate fix needed).
WITH mapping(bl, alias, canonical) AS (VALUES
  -- ── Burgenland ──
  ('burgenland', 'guessing', 'güssing'),
  ('burgenland', 'neusiedl-am-see', 'neusiedl am see'),
  ('burgenland', 'eisenstadt', 'eisenstadt (stadt)'),
  ('burgenland', 'hartberg-fuerstenfeld', 'hartberg-fürstenfeld'),

  -- ── Niederösterreich ──
  ('niederoesterreich', 'gaenserndorf', 'gänserndorf'),
  ('niederoesterreich', 'moedling', 'mödling'),
  ('niederoesterreich', 'gmuend', 'gmünd'),
  ('niederoesterreich', 'bruck/leitha', 'bruck an der leitha'),
  ('niederoesterreich', 'bruck-an-der-leitha', 'bruck an der leitha'),
  ('niederoesterreich', 'waidhofen/thaya', 'waidhofen an der thaya'),
  ('niederoesterreich', 'waidhofenthaya', 'waidhofen an der thaya'),
  ('niederoesterreich', 'krems an der donau (stadt)', 'krems (stadt)'),
  ('niederoesterreich', 'krems land', 'krems (land)'),
  ('niederoesterreich', 'krems', 'krems (land)'),
  ('niederoesterreich', 'wiener neustadt land', 'wiener neustadt (land)'),
  ('niederoesterreich', 'wiener-neustadt', 'wiener neustadt (stadt)'),
  ('niederoesterreich', 'st. pölten land', 'st. pölten (land)'),
  ('niederoesterreich', 'st-poelten', 'st. pölten (land)'),
  ('niederoesterreich', 'waidhofenybbstal', 'waidhofen an der ybbs'),

  -- ── Oberösterreich ──
  ('oberoesterreich', 'voecklabruck', 'vöcklabruck'),
  ('oberoesterreich', 'schaerding', 'schärding'),
  ('oberoesterreich', 'gmuend', 'gmünd'),
  ('oberoesterreich', 'braunau/inn', 'braunau am inn'),
  ('oberoesterreich', 'braunau', 'braunau am inn'),
  ('oberoesterreich', 'ried/innkreis', 'ried im innkreis'),
  ('oberoesterreich', 'ried', 'ried im innkreis'),
  ('oberoesterreich', 'kirchdorf/krems', 'kirchdorf'),
  ('oberoesterreich', 'kirchdorf an der krems', 'kirchdorf'),
  ('oberoesterreich', 'steyr-steyr-land', 'steyr-land'),
  ('oberoesterreich', 'wels-wels-land', 'wels-land'),
  ('oberoesterreich', 'linz', 'linz (stadt)'),
  ('oberoesterreich', 'statutarstadt', 'linz (stadt)'),
  ('oberoesterreich', 'enns', 'linz-land'),
  ('oberoesterreich', 'grieskirchen-eferding', 'grieskirchen'),

  -- ── Salzburg ──
  ('salzburg', 'salzburg', 'salzburg (stadt)'),
  ('salzburg', 'salzburg-stadt', 'salzburg (stadt)'),
  ('salzburg', 'st. johann/pongau', 'sankt johann im pongau'),
  ('salzburg', 'pongau', 'sankt johann im pongau'),
  ('salzburg', 'flachgau', 'salzburg-umgebung'),
  ('salzburg', 'tennengau', 'hallein'),
  ('salzburg', 'pinzgau', 'zell am see'),
  ('salzburg', 'lungau', 'tamsweg'),

  -- ── Steiermark ──
  ('steiermark', 'suedoststeiermark', 'südoststeiermark'),
  ('steiermark', 'hartberg-fuerstenfeld', 'hartberg-fürstenfeld'),
  ('steiermark', 'graz', 'graz (stadt)'),
  ('steiermark', 'bruck-an-der-mur', 'bruck-mürzzuschlag'),
  ('steiermark', 'muerztal', 'bruck-mürzzuschlag'),

  -- ── Kärnten ──
  ('kaernten', 'voelkermarkt', 'völkermarkt'),
  ('kaernten', 'klagenfurt', 'klagenfurt (stadt)'),
  ('kaernten', 'villach', 'villach (stadt)'),
  ('kaernten', 'spittal', 'spittal an der drau'),
  ('kaernten', 'sankt veit an der glan', 'st. veit an der glan'),
  ('kaernten', 'st-veit', 'st. veit an der glan'),
  ('kaernten', 'gailtal', 'hermagor'),
  ('kaernten', 'lavanttal', 'wolfsberg'),

  -- ── Tirol ──
  ('tirol', 'kitzbuehel', 'kitzbühel'),
  ('tirol', 'innsbruck', 'innsbruck (stadt)'),
  ('tirol', 'osttirol', 'lienz'),
  ('tirol', 'hall-rum', 'innsbruck-land'),
  ('tirol', 'stubai-wipptal', 'innsbruck-land'),
  ('tirol', 'westliches-mittelgebirge', 'innsbruck-land'),
  ('tirol', 'telfs', 'innsbruck-land'),

  -- ── Wien (Bezirks-Nummer-Präfix kanonisch) ──
  ('wien', 'innere-stadt', '1. innere stadt'),
  ('wien', 'leopoldstadt', '2. leopoldstadt'),
  ('wien', 'landstrasse', '3. landstraße'),
  ('wien', 'wieden', '4. wieden'),
  ('wien', 'margareten', '5. margareten'),
  ('wien', 'mariahilf', '6. mariahilf'),
  ('wien', 'neubau', '7. neubau'),
  ('wien', 'josefstadt', '8. josefstadt'),
  ('wien', 'alsergrund', '9. alsergrund'),
  ('wien', 'favoriten', '10. favoriten'),
  ('wien', 'simmering', '11. simmering'),
  ('wien', 'meidling', '12. meidling'),
  ('wien', 'hietzing', '13. hietzing'),
  ('wien', 'penzing', '14. penzing'),
  ('wien', 'rudolfsheim-fuenfhaus', '15. rudolfsheim-fünfhaus'),
  ('wien', 'ottakring', '16. ottakring'),
  ('wien', 'hernals', '17. hernals'),
  ('wien', 'waehring', '18. währing'),
  ('wien', 'doebling', '19. döbling'),
  ('wien', 'brigittenau', '20. brigittenau'),
  ('wien', 'floridsdorf', '21. floridsdorf'),
  ('wien', 'donaustadt', '22. donaustadt'),
  ('wien', 'liesing', '23. liesing')
)
UPDATE events e
SET district = m.canonical
FROM mapping m
WHERE e.bundesland = m.bl
  AND e.district = m.alias
  AND e.district IS DISTINCT FROM m.canonical;

COMMIT;
