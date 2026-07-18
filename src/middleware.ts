import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { routing } from '@/i18n/routing';

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
/**
 * fn-17 i18n: Locale-Rewrite via next-intl. `as-needed` + Detection/Cookie
 * aus (siehe src/i18n/routing.ts): `/map` wird intern zu `/de/map`
 * rewritten, `/en/map` zu `[locale]=en` — OHNE Set-Cookie und OHNE
 * Accept-Language-Redirects, damit der SEO-Bypass unten (anonyme
 * Requests bleiben cache-/ISR-fähig) intakt bleibt.
 */
const intlMiddleware = createIntlMiddleware(routing);

/**
 * Routen, die AUSSERHALB des [locale]-Segments am App-Root leben und
 * deshalb keinen Locale-Rewrite bekommen dürfen:
 *  - /api/* (Route Handler)
 *  - OAuth-Callbacks (extern registrierte Redirect-URIs)
 *  - Root-Metadata-Routen ohne Dateiendung (og-image, icons)
 *  - alles mit Punkt: sitemap.xml, robots.txt, sw.js, manifest.webmanifest,
 *    llms-full.txt, Font-/Asset-Dateien …
 */
function isLocaleExempt(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/auth/spotify/callback') ||
    pathname === '/opengraph-image' ||
    pathname === '/icon' ||
    pathname === '/apple-icon' ||
    pathname.includes('.')
  );
}

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
  // ─── Rate-Limiting für /api/* ────────────────────────────────────
  // Schutz gegen einfache Scraper-Bots + bug-induzierte Loops + Bill-Spike.
  // Per-Function-Instance (Map<ip, bucket>) — gut genug als erstes Level,
  // bei Bedarf später Upstash Redis dranhängen (gleiches Interface).
  // GET sind großzügiger (Lesen ist normal), Mutations strenger.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Cron + Webhooks bekommen ihre eigene Auth-Kontrolle, nicht ratelimiten
    const skipPaths = ['/api/cron/', '/api/webhooks/'];
    const skip = skipPaths.some(p => request.nextUrl.pathname.startsWith(p));
    if (!skip) {
      const ip = getClientIp(request.headers);
      const isWrite = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
      const limit = isWrite ? 30 : 120; // 30 writes/min, 120 reads/min pro IP
      const result = checkRateLimit(`${ip}:${request.method}:${request.nextUrl.pathname}`, limit, 60_000);
      if (!result.ok) {
        return new NextResponse(
          JSON.stringify({ error: 'Too Many Requests', retry_after_s: Math.ceil((result.resetAt - Date.now()) / 1000) }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
              'X-RateLimit-Limit': String(limit),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
            },
          },
        );
      }
    }
  }

  // The landing (`/`) is reachable for everyone — anonymous AND logged-in
  // visitors. The fn-15.7 edge-redirect to `/feed` was removed because the
  // landing has its own role (search + discovery + brand) that authenticated
  // users still want to reach by typing the bare domain.
  //
  // ISR is preserved: the landing route itself reads no cookies/auth, so
  // `/` remains a prerendered static shell at the route level. The Anmelden/
  // Avatar swap is now a tiny Client Component (`LandingAuth`) that
  // self-hydrates its session state without taking the page out of ISR.

  // fn-17: Basis-Response pro Request — für Seiten der intl-Rewrite
  // (Locale aus URL), für Root-Handler (api, sitemap, callbacks, Assets)
  // ein unverändertes Pass-Through. Als Factory, weil der Supabase-
  // Cookie-Adapter unten die Response neu erzeugen muss.
  const localeExempt = isLocaleExempt(request.nextUrl.pathname);
  const baseResponse = () =>
    localeExempt ? NextResponse.next({ request }) : intlMiddleware(request);

  // Anonymous request? Skip the session refresh entirely so Next.js can
  // prerender + ISR-cache the response. This is what unblocks Google
  // indexing for the ~42 000 public event pages.
  // (intlMiddleware setzt kein Cookie — localeCookie: false — die
  // Response bleibt also weiterhin ISR-/cache-fähig.)
  if (!hasSupabaseAuthCookie(request)) {
    return baseResponse();
  }

  let supabaseResponse = baseResponse();

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
          // Neu erzeugen (inkl. intl-Rewrite), damit die aktualisierten
          // Request-Cookies die RSC-Renderer erreichen — Muster aus der
          // next-intl-Supabase-Integration.
          supabaseResponse = baseResponse();
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
    // (baseResponse() statt NextResponse.next(): der Locale-Rewrite
    // muss auch im Degraded-Modus erhalten bleiben, sonst 404t /en/*.)
    return baseResponse();
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
