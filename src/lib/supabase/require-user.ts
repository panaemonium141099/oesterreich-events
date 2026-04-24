import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createServerSupabaseClient } from './server';

/**
 * Server-side auth gate for protected pages.
 *
 * Call this at the top of a Server Component page and it will:
 *   - read the Supabase session cookie on the server,
 *   - call `auth.getUser()` which refreshes the session if needed,
 *   - redirect to `/auth/login` (with a `?returnTo=` param) if the
 *     caller is anonymous,
 *   - return the authenticated `User` object when OK.
 *
 * Previously every protected page was a pure client component with an
 *   useEffect(() => { if (!loading && !user) router.push('/auth/login') })
 * pattern. That races with Supabase's client-side `getUser()` network
 * call: when the refresh is mid-flight, `user` momentarily reads null
 * even for a logged-in user, triggering a spurious login redirect —
 * the classic "muss immer einmal reload drücken" symptom on /feed,
 * /profile etc. Running the check server-side eliminates the race —
 * the browser either gets a 307 or the rendered HTML, never a flash of
 * broken content.
 *
 * Pages still render the interactive UI via a child client component;
 * this helper just guards which requests get far enough to hydrate.
 *
 * Usage:
 *   // src/app/feed/page.tsx
 *   import { requireUserOrRedirect } from '@/lib/supabase/require-user';
 *   import { FeedPageClient } from './FeedPageClient';
 *
 *   export default async function FeedPage() {
 *     await requireUserOrRedirect('/feed');
 *     return <FeedPageClient />;
 *   }
 *
 * @param returnTo Optional path to send the user back to after login.
 *                 Appended as `?returnTo=<encoded>` on the redirect URL
 *                 so /auth/login can bounce the user back where they
 *                 came from once authenticated.
 */
export async function requireUserOrRedirect(returnTo?: string): Promise<User> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const target = returnTo
      ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}`
      : '/auth/login';
    redirect(target);
  }

  return user;
}
