import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { ArtistsPageClient } from './ArtistsPageClient';

/**
 * /artists — Spotify-connected artist management.
 *
 * Server component: auth-gate runs before any UI renders. Anonymous
 * visitors get a 307 to /auth/login with ?returnTo=/artists, not a
 * flash of empty artist list that then client-redirects. See
 * FeedPageClient.tsx for the full post-mortem on the original race.
 *
 * The client component keeps its defensive `!loading && !user` effect
 * to handle mid-session logouts from another tab.
 */
export default async function ArtistsPage() {
  await requireUserOrRedirect('/artists');
  return <ArtistsPageClient />;
}
