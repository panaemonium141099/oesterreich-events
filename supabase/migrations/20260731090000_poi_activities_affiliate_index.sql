-- fn-18 Task 5: Index fuer den taeglichen Viator-Refresh.
--
-- NICHT AUTOMATISCH ANWENDEN — wie alle Index-Migrationen des Epics wird
-- diese Datei im Supabase-Dashboard/MCP eingespielt (Maintenance-SQL geht
-- nicht ueber PostgREST/Service-Key; Muster:
-- 20260724121000_poi_activities_indexes.sql).
--
-- Warum:
--   (a) Der Refresh-Lauf selektiert taeglich `affiliate_product IS NOT NULL`.
--       Ohne partiellen Index ist das ein Seq-Scan ueber den gesamten
--       POI-Bestand (zehntausende Rows) — auf der Supabase-Micro-Instanz
--       genau das Muster, das in Statement-Timeouts laeuft (MASTERPLAN
--       §10.1). Der Index ist winzig, weil nur die wenigen Rows MIT
--       Angebot darin landen.
--   (b) Der Matching-Lauf selektiert `visible AND NOT is_closed AND
--       affiliate_product IS NULL AND tags && '{...}'` — das Tag-Gate
--       laeuft ueber den bestehenden GIN(tags)-Index, der Rest ueber die
--       vorhandenen Teilindizes.

create index if not exists poi_activities_affiliate_product_idx
  on public.poi_activities (id)
  where affiliate_product is not null;

-- Nach dem Anlegen einmalig ausfuehren (Planner-Statistiken):
-- ANALYZE public.poi_activities;
