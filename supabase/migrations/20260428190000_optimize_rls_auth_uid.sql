-- Optimise RLS policies — wrap every bare `auth.uid()` in `(SELECT auth.uid())`.
--
-- Why: Postgres re-evaluates non-immutable functions per row when they appear
-- raw in a USING / WITH CHECK clause. `auth.uid()` itself reads
-- `current_setting('request.jwt.claims', ...)` and so is treated as volatile.
-- Wrapping it in a subquery lets the planner detect it as a stable side-effect-
-- free expression and lift the call once per query (the InitPlan optimisation),
-- which the Supabase advisor flags as `auth_rls_initplan` — 95 occurrences in
-- our DB on 2026-04-28.
--
-- Effect: queries that scan a few thousand rows go from running auth.uid()
-- N times to once. Combined with the ongoing scrape/enrich load that was
-- exhausting our connection pool, this is the single biggest perf win
-- available without touching application code.
--
-- The DO-block iterates over `pg_policies` in the public schema, regenerates
-- each policy's USING/WITH CHECK with auth.uid() wrapped, then DROP + CREATEs
-- it. Idempotent: re-running this migration on already-optimised policies is a
-- no-op (the regex skips already-wrapped occurrences).

DO $migration$
DECLARE
  rec RECORD;
  qual_new text;
  check_new text;
  parts text[];
  ddl text;
  fixed_count int := 0;
BEGIN
  FOR rec IN
    SELECT
      schemaname, tablename, policyname, cmd, permissive,
      roles::text[] AS roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual IS NOT NULL AND qual ~ 'auth\.uid\(\)' AND qual !~ '\(SELECT auth\.uid\(\)\)')
        OR
        (with_check IS NOT NULL AND with_check ~ 'auth\.uid\(\)' AND with_check !~ '\(SELECT auth\.uid\(\)\)')
      )
  LOOP
    -- Wrap any bare auth.uid() — handle the case where it's already inside a
    -- non-SELECT subquery by going through a marker substitution. (Two-pass
    -- regex avoids double-wrapping.)
    qual_new := rec.qual;
    IF qual_new IS NOT NULL THEN
      -- First, mark already-wrapped instances so we don't re-wrap them
      qual_new := regexp_replace(qual_new, '\(SELECT auth\.uid\(\)\)', '__AUID_WRAPPED__', 'g');
      -- Wrap the remaining bare ones
      qual_new := regexp_replace(qual_new, 'auth\.uid\(\)', '(SELECT auth.uid())', 'g');
      -- Restore the markers
      qual_new := regexp_replace(qual_new, '__AUID_WRAPPED__', '(SELECT auth.uid())', 'g');
    END IF;

    check_new := rec.with_check;
    IF check_new IS NOT NULL THEN
      check_new := regexp_replace(check_new, '\(SELECT auth\.uid\(\)\)', '__AUID_WRAPPED__', 'g');
      check_new := regexp_replace(check_new, 'auth\.uid\(\)', '(SELECT auth.uid())', 'g');
      check_new := regexp_replace(check_new, '__AUID_WRAPPED__', '(SELECT auth.uid())', 'g');
    END IF;

    -- Drop the old policy
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      rec.policyname, rec.schemaname, rec.tablename
    );

    -- Re-build the CREATE POLICY DDL piece by piece
    parts := ARRAY[
      format('CREATE POLICY %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename)
    ];

    IF rec.permissive = 'RESTRICTIVE' THEN
      parts := parts || 'AS RESTRICTIVE';
    END IF;

    -- cmd values: ALL, SELECT, INSERT, UPDATE, DELETE
    -- ALL is the default if FOR is omitted, but being explicit avoids surprises.
    IF rec.cmd <> 'ALL' THEN
      parts := parts || format('FOR %s', rec.cmd);
    END IF;

    -- roles
    IF array_length(rec.roles, 1) > 0 THEN
      parts := parts || format('TO %s',
        array_to_string(
          ARRAY(SELECT quote_ident(r) FROM unnest(rec.roles) AS r),
          ', '
        )
      );
    END IF;

    IF qual_new IS NOT NULL THEN
      parts := parts || format('USING (%s)', qual_new);
    END IF;

    IF check_new IS NOT NULL THEN
      parts := parts || format('WITH CHECK (%s)', check_new);
    END IF;

    ddl := array_to_string(parts, ' ');
    EXECUTE ddl;
    fixed_count := fixed_count + 1;
  END LOOP;

  RAISE NOTICE 'Optimised % RLS policies', fixed_count;
END $migration$;

-- Sanity-check: there should now be zero policies with bare auth.uid().
DO $verify$
DECLARE
  remaining int;
BEGIN
  SELECT count(*) INTO remaining
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (qual IS NOT NULL AND qual ~ 'auth\.uid\(\)' AND qual !~ '\(SELECT auth\.uid\(\)\)')
      OR
      (with_check IS NOT NULL AND with_check ~ 'auth\.uid\(\)' AND with_check !~ '\(SELECT auth\.uid\(\)\)')
    );

  IF remaining > 0 THEN
    RAISE EXCEPTION 'Still % policies with bare auth.uid() — migration incomplete', remaining;
  END IF;
END $verify$;
