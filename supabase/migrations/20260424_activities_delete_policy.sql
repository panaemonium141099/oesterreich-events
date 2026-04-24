-- Activities table was missing a DELETE policy, so every client-side
-- delete (e.g. Feed PostMenu "Löschen") got silently blocked by RLS.
-- Every other user-authored table in this schema (activity_comments,
-- activity_likes, saved_events, friendships, group_members,
-- followed_artists, push_subscriptions, ...) follows the same self-delete
-- pattern: `auth.uid() = user_id`. Activities was the only odd one out.
--
-- This is a pure additive fix: the existing client code
--   `supabase.from('activities').delete().eq('id', activityId)`
-- starts working again, nothing else is affected.
--
-- Idempotent: safe to re-run (e.g. in a staging reset).
DROP POLICY IF EXISTS "Users can delete own activities" ON activities;
CREATE POLICY "Users can delete own activities" ON activities
  FOR DELETE USING (auth.uid() = user_id);
