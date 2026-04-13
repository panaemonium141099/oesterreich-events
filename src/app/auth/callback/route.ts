import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isProfileComplete } from '@/lib/utils/profile';
import { cookies } from 'next/headers';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/map';
  const redirectOrigin = SITE_URL || origin;

  if (code) {
    // Log cookies for debugging PKCE issues
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const codeVerifierCookie = allCookies.find(c => c.name.includes('code-verifier'));
    console.log('Auth callback: code received, cookies:', allCookies.length,
      '| code-verifier present:', !!codeVerifierCookie,
      '| origin:', origin, '| redirectOrigin:', redirectOrigin);

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Auth callback FAILED:', error.message,
        '| status:', error.status,
        '| code length:', code.length,
        '| cookies:', allCookies.map(c => c.name).join(', '));
    }
    if (!error) {
      // Check if profile is complete before redirecting
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, birth_date')
          .eq('id', user.id)
          .single();

        if (!isProfileComplete(profile)) {
          return NextResponse.redirect(`${redirectOrigin}/auth/complete-profile`);
        }
      }

      return NextResponse.redirect(`${redirectOrigin}${next}`);
    }
  }

  // Auth error — redirect to landing with error
  return NextResponse.redirect(`${redirectOrigin}/?auth_error=true`);
}
