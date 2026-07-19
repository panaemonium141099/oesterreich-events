import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { FriendsPageClient } from './FriendsPageClient';

/**
 * /friends — friend list + discovery.
 *
 * Server-side auth-gate before any UI renders, kills the client-race
 * that caused the "muss immer einmal reload drücken" bug.
 */
export default async function FriendsPage() {
  await requireUserOrRedirect('/friends');
  return <FriendsPageClient />;
}
