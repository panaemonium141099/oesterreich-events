import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createServerSupabaseClient } from './server';

/**
 * Server-side auth gate for protected pages.
 *
 * Call this at the top of a Server Component page and it will:
 *   - read the Supabase session cookie on the server,
 *   - call `auth.getUser()` which refreshes the session if needed,
 *   - **verify the user still has a `profiles` row**,
 *   - redirect to `/auth/login` (with a `?returnTo=` param) if the
 *     caller is anonymous or the profile is gone,
 *   - return the authenticated `User` object when OK.
 *
 * **Why the profile cross-check?** Supabase JWTs are self-contained
 * (signature + claims + 1h expiry). When an admin deletes a user via
 * `auth.admin.deleteUser()`, `auth.users` is gone, and so is the
 * user's `profiles` row (FK `profiles_id_fkey ... ON DELETE CASCADE`).
 * But the already-issued JWT in the deleted user's browser cookie
 * stays signature-valid until expiry. Naive `getUser()` calls may
 * return the deleted user's claims because Supabase's auth layer
 * accepts any signature-valid JWT for the user endpoint. So we treat
 * `profiles` as the source of truth for "user still exists" — if the
 * row is gone, the session is a ghost and we redirect to login.
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

  // Bail early on anonymous requests
  if (!user) {
    redirectToLogin(returnTo);
  }

  // Ghost-session check: JWT validated, but was the user deleted in the
  // meantime? profiles row existence is our ground truth. A missing
  // profile means auth.users was deleted (FK CASCADE) — the JWT in the
  // browser is stale and should be kicked to the login page.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    // Clear the stale session so the browser stops sending the dead
    // cookie on subsequent requests. signOut({ scope: 'local' }) just
    // wipes local cookies — no /auth/v1/logout round-trip that would
    // fail anyway (refresh_tokens was CASCADED too).
    await supabase.auth.signOut({ scope: 'local' });
    redirectToLogin(returnTo);
  }

  return user;
}

/** Internal — `redirect()` from next/navigation throws a redirect
 *  exception, which satisfies the `never` return so callers can treat
 *  the non-redirect path as a `User`. */
function redirectToLogin(returnTo?: string): never {
  const target = returnTo
    ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}`
    : '/auth/login';
  redirect(target);
}
