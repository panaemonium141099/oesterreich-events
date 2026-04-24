import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { GroupsPageClient } from './GroupsPageClient';

/**
 * /groups — Planer hub (list of plans).
 *
 * Server-side auth-gate before any UI renders. The Planer flow owns
 * sensitive "who is invited where" data, so anonymous users should
 * never see the empty skeleton — they go straight to /auth/login.
 */
export default async function GroupsPage() {
  await requireUserOrRedirect('/groups');
  return <GroupsPageClient />;
}
