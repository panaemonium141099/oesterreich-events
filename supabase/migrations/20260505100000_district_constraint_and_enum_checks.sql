-- Lock down event taxonomy at the DB layer so future writes can't drift.
-- Replaces the "trust the app pipeline" model with hard constraints:
--   * district  → FK into a new district_canonical lookup (114 names)
--   * bundesland → CHECK in the 9 lowercase IDs
--   * visibility, publish_status, category, price_tier, language,
--     duration_type → CHECK in their closed enum sets
--
-- Pre-flight already passed: a SELECT against the planned canonical sets
-- returned zero rows for every column except district, which had ~5k
-- aliases that the migration cleans up before adding the FK.

-- 1. Last canonical fixups uncovered against districtsAT.ts.
UPDATE events SET district = 'sankt veit an der glan'
 WHERE bundesland = 'kaernten' AND district = 'st. veit an der glan';
UPDATE events SET district = 'eisenstadt'
 WHERE bundesland = 'burgenland' AND district IN ('eisenstadt (stadt)','eisenstadt-umgebung');

-- 2. "Wandernde" districts: name belongs to a different bundesland than
--    the row claims. Can't tell from a string alone whether bundesland
--    or district is wrong, so blank the district. The bundesland stays
--    — usually came from a more reliable source (PLZ/coords).
WITH canonical(bl, name) AS (VALUES
  ('wien','1. innere stadt'),('wien','2. leopoldstadt'),('wien','3. landstraße'),('wien','4. wieden'),
  ('wien','5. margareten'),('wien','6. mariahilf'),('wien','7. neubau'),('wien','8. josefstadt'),
  ('wien','9. alsergrund'),('wien','10. favoriten'),('wien','11. simmering'),('wien','12. meidling'),
  ('wien','13. hietzing'),('wien','14. penzing'),('wien','15. rudolfsheim-fünfhaus'),('wien','16. ottakring'),
  ('wien','17. hernals'),('wien','18. währing'),('wien','19. döbling'),('wien','20. brigittenau'),
  ('wien','21. floridsdorf'),('wien','22. donaustadt'),('wien','23. liesing'),
  ('niederoesterreich','amstetten'),('niederoesterreich','baden'),('niederoesterreich','bruck an der leitha'),
  ('niederoesterreich','gänserndorf'),('niederoesterreich','gmünd'),('niederoesterreich','hollabrunn'),
  ('niederoesterreich','horn'),('niederoesterreich','korneuburg'),('niederoesterreich','krems (land)'),
  ('niederoesterreich','krems (stadt)'),('niederoesterreich','lilienfeld'),('niederoesterreich','melk'),
  ('niederoesterreich','mistelbach'),('niederoesterreich','mödling'),('niederoesterreich','neunkirchen'),
  ('niederoesterreich','st. pölten (land)'),('niederoesterreich','st. pölten (stadt)'),('niederoesterreich','scheibbs'),
  ('niederoesterreich','tulln'),('niederoesterreich','waidhofen an der thaya'),('niederoesterreich','waidhofen an der ybbs'),
  ('niederoesterreich','wiener neustadt (land)'),('niederoesterreich','wiener neustadt (stadt)'),('niederoesterreich','zwettl'),
  ('oberoesterreich','braunau am inn'),('oberoesterreich','eferding'),('oberoesterreich','freistadt'),
  ('oberoesterreich','gmunden'),('oberoesterreich','grieskirchen'),('oberoesterreich','kirchdorf'),
  ('oberoesterreich','linz (stadt)'),('oberoesterreich','linz-land'),('oberoesterreich','perg'),
  ('oberoesterreich','ried im innkreis'),('oberoesterreich','rohrbach'),('oberoesterreich','schärding'),
  ('oberoesterreich','steyr (stadt)'),('oberoesterreich','steyr-land'),('oberoesterreich','urfahr-umgebung'),
  ('oberoesterreich','vöcklabruck'),('oberoesterreich','wels (stadt)'),('oberoesterreich','wels-land'),
  ('salzburg','hallein'),('salzburg','salzburg (stadt)'),('salzburg','salzburg-umgebung'),
  ('salzburg','sankt johann im pongau'),('salzburg','tamsweg'),('salzburg','zell am see'),
  ('steiermark','bruck-mürzzuschlag'),('steiermark','deutschlandsberg'),('steiermark','graz (stadt)'),
  ('steiermark','graz-umgebung'),('steiermark','hartberg-fürstenfeld'),('steiermark','leibnitz'),
  ('steiermark','leoben'),('steiermark','liezen'),('steiermark','murau'),('steiermark','murtal'),
  ('steiermark','südoststeiermark'),('steiermark','voitsberg'),('steiermark','weiz'),
  ('kaernten','feldkirchen'),('kaernten','hermagor'),('kaernten','klagenfurt (stadt)'),
  ('kaernten','klagenfurt-land'),('kaernten','sankt veit an der glan'),('kaernten','spittal an der drau'),
  ('kaernten','villach (stadt)'),('kaernten','villach-land'),('kaernten','völkermarkt'),('kaernten','wolfsberg'),
  ('tirol','imst'),('tirol','innsbruck (stadt)'),('tirol','innsbruck-land'),('tirol','kitzbühel'),
  ('tirol','kufstein'),('tirol','landeck'),('tirol','lienz'),('tirol','reutte'),('tirol','schwaz'),
  ('vorarlberg','bludenz'),('vorarlberg','bregenz'),('vorarlberg','dornbirn'),('vorarlberg','feldkirch'),
  ('burgenland','neusiedl am see'),('burgenland','eisenstadt'),('burgenland','mattersburg'),
  ('burgenland','oberpullendorf'),('burgenland','oberwart'),('burgenland','güssing'),('burgenland','jennersdorf')
)
UPDATE events e
SET district = NULL
WHERE e.district IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM canonical c WHERE c.bl = e.bundesland AND c.name = e.district);

-- 3. Lookup table — the SoT for every valid district name.
CREATE TABLE IF NOT EXISTS district_canonical (
  name TEXT PRIMARY KEY,
  bundesland TEXT NOT NULL
);

INSERT INTO district_canonical (name, bundesland) VALUES
  ('1. innere stadt','wien'),('2. leopoldstadt','wien'),('3. landstraße','wien'),('4. wieden','wien'),
  ('5. margareten','wien'),('6. mariahilf','wien'),('7. neubau','wien'),('8. josefstadt','wien'),
  ('9. alsergrund','wien'),('10. favoriten','wien'),('11. simmering','wien'),('12. meidling','wien'),
  ('13. hietzing','wien'),('14. penzing','wien'),('15. rudolfsheim-fünfhaus','wien'),('16. ottakring','wien'),
  ('17. hernals','wien'),('18. währing','wien'),('19. döbling','wien'),('20. brigittenau','wien'),
  ('21. floridsdorf','wien'),('22. donaustadt','wien'),('23. liesing','wien'),
  ('amstetten','niederoesterreich'),('baden','niederoesterreich'),('bruck an der leitha','niederoesterreich'),
  ('gänserndorf','niederoesterreich'),('gmünd','niederoesterreich'),('hollabrunn','niederoesterreich'),
  ('horn','niederoesterreich'),('korneuburg','niederoesterreich'),('krems (land)','niederoesterreich'),
  ('krems (stadt)','niederoesterreich'),('lilienfeld','niederoesterreich'),('melk','niederoesterreich'),
  ('mistelbach','niederoesterreich'),('mödling','niederoesterreich'),('neunkirchen','niederoesterreich'),
  ('st. pölten (land)','niederoesterreich'),('st. pölten (stadt)','niederoesterreich'),('scheibbs','niederoesterreich'),
  ('tulln','niederoesterreich'),('waidhofen an der thaya','niederoesterreich'),('waidhofen an der ybbs','niederoesterreich'),
  ('wiener neustadt (land)','niederoesterreich'),('wiener neustadt (stadt)','niederoesterreich'),('zwettl','niederoesterreich'),
  ('braunau am inn','oberoesterreich'),('eferding','oberoesterreich'),('freistadt','oberoesterreich'),
  ('gmunden','oberoesterreich'),('grieskirchen','oberoesterreich'),('kirchdorf','oberoesterreich'),
  ('linz (stadt)','oberoesterreich'),('linz-land','oberoesterreich'),('perg','oberoesterreich'),
  ('ried im innkreis','oberoesterreich'),('rohrbach','oberoesterreich'),('schärding','oberoesterreich'),
  ('steyr (stadt)','oberoesterreich'),('steyr-land','oberoesterreich'),('urfahr-umgebung','oberoesterreich'),
  ('vöcklabruck','oberoesterreich'),('wels (stadt)','oberoesterreich'),('wels-land','oberoesterreich'),
  ('hallein','salzburg'),('salzburg (stadt)','salzburg'),('salzburg-umgebung','salzburg'),
  ('sankt johann im pongau','salzburg'),('tamsweg','salzburg'),('zell am see','salzburg'),
  ('bruck-mürzzuschlag','steiermark'),('deutschlandsberg','steiermark'),('graz (stadt)','steiermark'),
  ('graz-umgebung','steiermark'),('hartberg-fürstenfeld','steiermark'),('leibnitz','steiermark'),
  ('leoben','steiermark'),('liezen','steiermark'),('murau','steiermark'),('murtal','steiermark'),
  ('südoststeiermark','steiermark'),('voitsberg','steiermark'),('weiz','steiermark'),
  ('feldkirchen','kaernten'),('hermagor','kaernten'),('klagenfurt (stadt)','kaernten'),
  ('klagenfurt-land','kaernten'),('sankt veit an der glan','kaernten'),('spittal an der drau','kaernten'),
  ('villach (stadt)','kaernten'),('villach-land','kaernten'),('völkermarkt','kaernten'),('wolfsberg','kaernten'),
  ('imst','tirol'),('innsbruck (stadt)','tirol'),('innsbruck-land','tirol'),('kitzbühel','tirol'),
  ('kufstein','tirol'),('landeck','tirol'),('lienz','tirol'),('reutte','tirol'),('schwaz','tirol'),
  ('bludenz','vorarlberg'),('bregenz','vorarlberg'),('dornbirn','vorarlberg'),('feldkirch','vorarlberg'),
  ('neusiedl am see','burgenland'),('eisenstadt','burgenland'),('mattersburg','burgenland'),
  ('oberpullendorf','burgenland'),('oberwart','burgenland'),('güssing','burgenland'),('jennersdorf','burgenland')
ON CONFLICT (name) DO NOTHING;

-- 4. FK on events.district. ON DELETE SET NULL so removing a district
-- from the lookup doesn't cascade-delete events.
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_district_fkey,
  ADD CONSTRAINT events_district_fkey
    FOREIGN KEY (district) REFERENCES district_canonical(name) ON DELETE SET NULL;

-- 5. CHECK constraints — the seven enum-shaped columns.
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_bundesland_check;
ALTER TABLE events ADD CONSTRAINT events_bundesland_check
  CHECK (bundesland IS NULL OR bundesland IN
    ('burgenland','kaernten','niederoesterreich','oberoesterreich','salzburg','steiermark','tirol','vorarlberg','wien'));

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_visibility_check;
ALTER TABLE events ADD CONSTRAINT events_visibility_check
  CHECK (visibility IN ('public','private'));

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_publish_status_check;
ALTER TABLE events ADD CONSTRAINT events_publish_status_check
  CHECK (publish_status IN ('published','published_low_confidence','duplicate','suppressed','needs_review'));

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_category_check;
ALTER TABLE events ADD CONSTRAINT events_category_check
  CHECK (category IS NULL OR category IN
    ('Musik','Kultur & Bühne','Märkte & Feste','Essen & Trinken','Sport & Bewegung',
     'Natur & Abenteuer','Wissen & Karriere','Familie & Kinder','Community & Freizeit',
     'Wellness & Spiritualität','Nightlife & Party','Sonstiges'));

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_price_tier_check;
ALTER TABLE events ADD CONSTRAINT events_price_tier_check
  CHECK (price_tier IS NULL OR price_tier IN ('gratis','günstig','mittel','premium','unbekannt'));

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_language_check;
ALTER TABLE events ADD CONSTRAINT events_language_check
  CHECK (language IS NULL OR language IN ('deutsch','dialekt','englisch','mehrsprachig','ohne-sprache'));

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_duration_type_check;
ALTER TABLE events ADD CONSTRAINT events_duration_type_check
  CHECK (duration_type IS NULL OR duration_type IN
    ('abend','ganztag','kurz','mehrtägig','nacht-bis-morgen','dauerausstellung','24-stunden'));
