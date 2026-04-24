import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { ActivityPageClient } from './ActivityPageClient';

/**
 * /feed/[activityId] — single post / activity detail view.
 *
 * Server-side auth-gate before any UI renders. The client component
 * keeps its own useParams() lookup, so the wrapper doesn't need to
 * thread the id through — the redirect path uses the resolved id so
 * after login the user lands back on the exact post.
 */
export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  await requireUserOrRedirect(`/feed/${activityId}`);
  return <ActivityPageClient />;
}
