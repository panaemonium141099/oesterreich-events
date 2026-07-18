import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { FeedPageClient } from './FeedPageClient';

/**
 * /feed — activity feed.
 *
 * Server component: does the auth gate BEFORE any UI renders, so an
 * anonymous visitor sees a 307 to /auth/login, not a flash of empty
 * feed skeleton that then redirects client-side. The existing client
 * logic (realtime subscriptions, infinite scroll, post-create form)
 * lives in FeedPageClient.tsx.
 *
 * Why this split exists: the original client-only page relied on
 *   useEffect(() => if (!loading && !user) router.push('/auth/login'))
 * which raced with Supabase's own client-side session refresh call.
 * When the refresh was mid-flight the effect saw user=null and fired
 * a spurious login redirect, even for fully authenticated users —
 * the "muss immer einmal reload drücken" bug the user reported.
 */
export default async function FeedPage() {
  await requireUserOrRedirect('/feed');
  return <FeedPageClient />;
}
