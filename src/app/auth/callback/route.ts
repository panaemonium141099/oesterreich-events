import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isProfileComplete } from '@/lib/utils/profile';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Only allow relative same-origin paths — prevents open-redirect.
  const rawNext = searchParams.get('next');
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  if (code) {
    const cookieStore = await cookies();

    // Create Supabase client INLINE — critical for Route Handlers
    // so that setAll can write cookies without try/catch swallowing errors
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error.message, '| status:', error.status);
    }

    if (!error) {
      // Use x-forwarded-host for production redirect (Vercel sets this)
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      let redirectBase: string;

      if (isLocalEnv) {
        redirectBase = origin;
      } else if (forwardedHost) {
        redirectBase = `https://${forwardedHost}`;
      } else {
        redirectBase = origin;
      }

      // Check if profile is complete before redirecting
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name, birth_date')
          .eq('id', user.id)
          // maybeSingle statt single: "keine Zeile" (echter Neu-User) ist
          // KEIN Fehler -> data null -> Formular. Nur echte Fehler
          // (Timeout, Uhr-Drift) ueberspringen den Redirect.
          .maybeSingle();

        // Nur bei ERFOLGREICH gelesenem, tatsaechlich unvollstaendigem
        // Profil ins Formular schicken. Ein Query-Fehler (Timeout,
        // DB-Uhr-Drift) hiess beim Incident 2026-08-26/27, dass JEDER
        // Login faelschlich in "Profil vervollstaendigen" landete —
        // im Zweifel weiter zur Ziel-URL, das Formular kommt beim
        // naechsten sauberen Login wieder.
        if (!profileError && !isProfileComplete(profile)) {
          return NextResponse.redirect(`${redirectBase}/auth/complete-profile`);
        }
      }

      return NextResponse.redirect(`${redirectBase}${next}`);
    }
  }

  // Auth error — redirect to landing
  const forwardedHost = request.headers.get('x-forwarded-host');
  const errorBase = forwardedHost ? `https://${forwardedHost}` : origin;
  return NextResponse.redirect(`${errorBase}/?auth_error=true`);
}
