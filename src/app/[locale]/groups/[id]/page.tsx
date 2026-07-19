import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { GroupDetailPageClient } from './GroupDetailPageClient';

/**
 * /groups/[id] — plan detail (Planer pinboard, chat, contributions).
 *
 * Server-side auth-gate before any UI renders. Anonymous visitors
 * bounce to /auth/login with returnTo set to the exact plan URL so
 * they land back here after signing in.
 */
export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUserOrRedirect(`/groups/${id}`);
  return <GroupDetailPageClient />;
}
