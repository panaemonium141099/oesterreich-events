-- Index cleanup pass — drop one duplicate, add covering indexes for every
-- foreign key. Both come from the Supabase advisor's `unindexed_foreign_keys`
-- and `duplicate_index` lints (33 + 1 hits respectively on 2026-04-28).
--
-- Why FK indexes matter: when you DELETE a parent row Postgres has to
-- check every child table for referencing rows. Without a btree on the
-- FK column that's a sequential scan per child — fine for 100 rows,
-- catastrophic for 73k events. Same when JOIN-ing parent → child in
-- application queries.
--
-- The duplicate on event_reminders had two identical indexes
-- (idx_event_reminders_event and idx_event_reminders_event_id). Postgres
-- maintains both on every write. Drop the un-suffixed one, keep the
-- canonical "_id"-named one.
--
-- Idempotent: re-running this migration is a no-op (DROP IF EXISTS,
-- CREATE INDEX IF NOT EXISTS, plus the WHERE NOT EXISTS check on
-- pg_index for FK coverage).

DO $$
DECLARE
  rec RECORD;
  col_list text;
  idx_name text;
  ddl text;
  created_count int := 0;
BEGIN
  -- Drop the known duplicate on event_reminders.
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_event_reminders_event') THEN
    EXECUTE 'DROP INDEX public.idx_event_reminders_event';
    RAISE NOTICE 'Dropped duplicate index idx_event_reminders_event';
  END IF;

  -- For every FK without a covering index, build one.
  FOR rec IN
    SELECT
      n.nspname AS schema_name,
      cl.relname AS table_name,
      c.conname AS constraint_name,
      array_agg(a.attname ORDER BY u.ord) AS fk_columns
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON TRUE
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = c.conrelid
          AND (i.indkey::int2[])[0:array_length(c.conkey,1)-1] = c.conkey
      )
    GROUP BY n.nspname, cl.relname, c.conname, c.conkey
  LOOP
    col_list := array_to_string(
      ARRAY(SELECT quote_ident(c) FROM unnest(rec.fk_columns) AS c),
      ', '
    );
    idx_name := format('idx_%s_%s_fk', rec.table_name, rec.constraint_name);
    IF length(idx_name) > 63 THEN
      idx_name := substring(idx_name FROM 1 FOR 63);
    END IF;
    ddl := format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      idx_name, rec.schema_name, rec.table_name, col_list
    );
    EXECUTE ddl;
    created_count := created_count + 1;
  END LOOP;

  RAISE NOTICE 'Created/verified % FK indexes', created_count;
END $$;
