-- Normalise events.bundesland to the 9 canonical lowercase IDs that
-- bundeslandToId() in src/lib/bundeslaender.ts recognises. The DB held
-- 9 canonical IDs (niederoesterreich, …) plus 9 Title-Case display
-- names (Salzburg, Kärnten, Tirol, …) — the client filter compares
-- by the canonical id, so 9,492 events under "Tirol"/"Salzburg"/etc.
-- were invisible on the map and list view.
--
-- Audit column bundesland_pre_normalize preserves the original spelling.
-- Rollback:
--   UPDATE events SET bundesland = bundesland_pre_normalize
--   WHERE bundesland_pre_normalize IS DISTINCT FROM bundesland;
--
-- Plus a statistical PLZ→bundesland + coord-bin lookup pass (in
-- ad-hoc SQL, not in this migration file) populated 6,072 of the 6,430
-- NULL-bundesland rows. Coverage is now 99.81%.

ALTER TABLE events ADD COLUMN IF NOT EXISTS bundesland_pre_normalize TEXT;
UPDATE events
SET bundesland_pre_normalize = bundesland
WHERE bundesland_pre_normalize IS NULL AND bundesland IS NOT NULL;

UPDATE events SET bundesland = 'burgenland'        WHERE bundesland = 'Burgenland';
UPDATE events SET bundesland = 'kaernten'          WHERE bundesland IN ('Kärnten','Karnten','kärnten');
UPDATE events SET bundesland = 'niederoesterreich' WHERE bundesland IN ('Niederösterreich','Niederoesterreich','niederösterreich');
UPDATE events SET bundesland = 'oberoesterreich'   WHERE bundesland IN ('Oberösterreich','Oberoesterreich','oberösterreich');
UPDATE events SET bundesland = 'salzburg'          WHERE bundesland = 'Salzburg';
UPDATE events SET bundesland = 'steiermark'        WHERE bundesland = 'Steiermark';
UPDATE events SET bundesland = 'tirol'             WHERE bundesland = 'Tirol';
UPDATE events SET bundesland = 'vorarlberg'        WHERE bundesland = 'Vorarlberg';
UPDATE events SET bundesland = 'wien'              WHERE bundesland = 'Wien';
