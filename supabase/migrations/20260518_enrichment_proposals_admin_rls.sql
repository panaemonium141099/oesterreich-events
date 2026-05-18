-- Admin RLS policy for event_enrichment_proposals.
--
-- The original migration enabled RLS without policies — locking the table
-- against the user-session client used by the admin UI (createServerSupabaseClient
-- uses NEXT_PUBLIC_SUPABASE_ANON_KEY + cookie session, not service role).
-- API-level gating happens in requireAdmin(); this policy mirrors that at the
-- DB level so admins can SELECT/UPDATE/DELETE proposals from the admin UI.
--
-- The agent-enrich.ts script uses SUPABASE_SERVICE_ROLE_KEY and bypasses RLS,
-- so INSERTs still work without explicit policy for that path.

CREATE POLICY "admin_god_full_access" ON event_enrichment_proposals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('god', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('god', 'admin')
    )
  );
