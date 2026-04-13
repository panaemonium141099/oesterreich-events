import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isProfileComplete } from '@/lib/utils/profile';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

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
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, birth_date')
          .eq('id', user.id)
          .single();

        if (!isProfileComplete(profile)) {
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
