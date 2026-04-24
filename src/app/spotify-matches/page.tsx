import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { SpotifyMatchesPageClient } from './SpotifyMatchesPageClient';

/**
 * /spotify-matches — matched events for followed Spotify artists.
 *
 * Server-side auth-gate before any UI renders.
 */
export default async function SpotifyMatchesPage() {
  await requireUserOrRedirect('/spotify-matches');
  return <SpotifyMatchesPageClient />;
}
