-- Fix: user-event-creation was completely broken since the source_type rename.
--
-- Background:
--   The 20260502120000_security_rls_hardening migration's H2 fix kept the
--   pre-existing "source_type = 'user_created'" check in the INSERT policy,
--   but the events_source_type_check CHECK constraint only allows
--   ('scraped','user','business','derived'). 'user_created' violates the
--   constraint, so every authenticated user-event INSERT was rejected with
--   a row-level security policy violation. Verified by query: 0 events with
--   source_type IN ('user','business') and 0 with created_by IS NOT NULL
--   exist in the table.
--
-- This migration aligns the policy with the CHECK constraint and the
-- source_type values the CreateEventPageClient actually writes ('user' or
-- 'business' depending on the submitter's profile.role).

DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.events;

CREATE POLICY "Authenticated users can insert events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    source_type IN ('user', 'business')
    AND created_by = (SELECT auth.uid())
  );
