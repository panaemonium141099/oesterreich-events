import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { ProfilePageClient } from './ProfilePageClient';

/**
 * /profile — user profile editor.
 *
 * Server component: runs the auth gate before the page even starts
 * rendering so anonymous visitors get a 307 to /auth/login, not a
 * flash of empty form fields that then redirects client-side.
 * The original fully-client version was prone to the same race as
 * /feed — see FeedPageClient.tsx for the detailed post-mortem.
 */
export default async function ProfilePage() {
  await requireUserOrRedirect('/profile');
  return <ProfilePageClient />;
}
