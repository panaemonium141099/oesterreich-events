import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isProfileComplete } from '@/lib/utils/profile';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/map';

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
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
          return NextResponse.redirect(`${origin}/auth/complete-profile`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to landing with error
  return NextResponse.redirect(`${origin}/?auth_error=true`);
}
