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

  // ─── Supabase calls with hard timeout ──────────────────────────
  //
  // Both the session-refresh getUser() and the profile-existence
  // lookup go to Supabase. On 2026-04-28 we observed every request
  // 504-ing because Supabase was unreachable and these calls hung
  // until Vercel's 25s middleware limit killed the function. The
  // entire site went down for the duration of the Supabase incident.
  //
  // Defense in depth: race each call against a 3s timeout. If
  // Supabase doesn't answer, we return `NextResponse.next()` without
  // touching auth — the user is served the ISR-cached page the same
  // way an anonymous request would be. The trade-off:
  //   - they MAY momentarily appear logged-out on server-rendered
  //     surfaces until Supabase recovers, but
  //   - the site stays UP for everyone (most importantly Googlebot)
  //     and the client-side AuthContext re-establishes the session
  //     within seconds via its own subscription.
  //
  // Without this guard a 30-second Supabase blip becomes a 30-second
  // total outage. With it, only auth-aware features degrade.
  const withTimeout = async <T>(p: Promise<T>, ms = 3000): Promise<T | null> => {
    let t: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race<T | null>([
        p,
        new Promise<null>((resolve) => {
          t = setTimeout(() => resolve(null), ms);
        }),
      ]);
    } finally {
      if (t) clearTimeout(t);
    }
  };

  // Refresh session if expired
  const userResult = await withTimeout(
    (async () => await supabase.auth.getUser())(),
  );
  if (!userResult) {
    // Supabase didn't answer in time — bail out without session
    // touch. Browser keeps its cookies; next refresh will retry.
    return NextResponse.next({ request });
  }
  const { data: { user } } = userResult;

  // Ghost-session detection — also timeout-protected. If the
  // profile lookup hangs we pessimistically allow the request rather
  // than block forever; a real ghost session is a much rarer harm
  // than a sitewide outage. The next request will retry the check.
  if (user) {
    const profileResult = await withTimeout(
      (async () =>
        await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle())(),
    );
    if (profileResult && !profileResult.data) {
      await withTimeout(
        (async () => await supabase.auth.signOut({ scope: 'local' }))(),
        1500,
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|geojson|json)$).*)',
  ],
};
