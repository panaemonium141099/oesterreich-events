import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Supabase session refresh middleware — with a critical SEO bypass.
 *
 * **Why the bypass exists:** `supabase.auth.getUser()` reads request cookies
 * and writes `Set-Cookie` response headers for session refresh. Once the
 * middleware writes a cookie, Next.js correctly marks the response as
 * personalised (`Cache-Control: private, no-store`) and disables ISR
 * prerendering. Result: Google refuses to index the page.
 *
 * Until we observed the GSC report (9 / 45 656 indexed on 2026-04-23) this
 * was applied to every request. For anonymous visitors — which is **every
 * Googlebot hit** and most first-time human visitors — the cookie write is
 * wasted work AND it actively kills indexability.
 *
 * **The fix:** check whether a Supabase auth cookie is present on the
 * incoming request. If not, the request is anonymous, there is no session
 * to refresh, and we return a plain `NextResponse.next()` without ever
 * touching `getUser()`. Logged-in users keep their session refresh because
 * their browsers send the `sb-*-auth-token` cookie with every request.
 *
 * Trade-off: if a user signs in in tab A, a Server Component in tab B that
 * was rendered before sign-in won't see them as authenticated until the
 * next refresh. Acceptable — client components (`use client`) subscribe to
 * Supabase's auth state changes directly via `onAuthStateChange`, so UI
 * updates within the active tab remain instant.
 */
function hasSupabaseAuthCookie(request: NextRequest): boolean {
  for (const cookie of request.cookies.getAll()) {
    // Supabase SSR cookies look like `sb-<projectRef>-auth-token` or
    // `sb-<projectRef>-auth-token.0` / `.1` (split when too large).
    if (cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')) {
      return true;
    }
  }
  return false;
}

export async function middleware(request: NextRequest) {
  // Anonymous request? Skip the session refresh entirely so Next.js can
  // prerender + ISR-cache the response. This is what unblocks Google
  // indexing for the ~42 000 public event pages.
  if (!hasSupabaseAuthCookie(request)) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser();

  // Ghost-session detection. Supabase JWTs are self-contained — signature
  // valid until the 1h access-token expiry. When an admin deletes a user
  // via auth.admin.deleteUser(), `auth.users` is gone and so is the
  // user's `profiles` row (FK CASCADE), but the deleted user's browser
  // still holds a signature-valid JWT. Without this check they would
  // appear logged-in on public pages (homepage, map, hub pages) until
  // their access token expires up to an hour later.
  //
  // Profile row existence is our ground-truth indicator. If the JWT
  // maps to a user without a profile, treat it as a ghost session and
  // nuke the cookies. signOut({ scope: 'local' }) fires the cookies
  // setAll callback above with expired entries — those get written
  // onto `supabaseResponse`, the SSR pages reading `request.cookies`
  // see cleared state, and the browser's next request no longer sends
  // the dead cookie.
  //
  // We skip the profile round-trip when there's no user at all, so the
  // lookup cost only applies to authenticated requests (a tiny, cached
  // index lookup on `profiles.id` — primary key).
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      await supabase.auth.signOut({ scope: 'local' });
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|geojson|json)$).*)',
  ],
};
