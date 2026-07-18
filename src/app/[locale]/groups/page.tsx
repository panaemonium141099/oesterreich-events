import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { AppShell } from '@/components/Layout/AppShell';
import { GroupsPageClient } from './GroupsPageClient';

/**
 * /groups — Planer hub (list of plans).
 *
 * Server-side auth-gate before any UI renders. The Planer flow owns
 * sensitive "who is invited where" data, so anonymous users should
 * never see the empty skeleton — they go straight to /auth/login.
 *
 * fn-15.5 round-12 (codex): AppShell wraps THIS leaf, not the parent
 * `/groups/layout.tsx`. App Router composes parent layouts top-down
 * onto every child segment, so mounting AppShell in the parent layout
 * meant /groups/[id] also paid for the full NotificationsProvider +
 * social shell — the regression this refactor was trying to avoid.
 * Keeping AppShell at the leaf scopes it to /groups only. The detail
 * route /groups/[id] has its own minimal wrapper (no AppShell).
 */
export default async function GroupsPage() {
  await requireUserOrRedirect('/groups');
  return (
    <AppShell>
      <GroupsPageClient />
    </AppShell>
  );
}
