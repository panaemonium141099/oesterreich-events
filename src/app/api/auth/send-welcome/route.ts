/**
 * POST /api/auth/send-welcome
 *
 * Sends the welcome email to the currently-authenticated user IF they haven't
 * received it yet (profiles.welcome_email_sent_at IS NULL). Fire-and-forget
 * from the signup completion flow — failures are logged but never returned
 * as a hard error so the signup UX stays smooth.
 *
 * Idempotent — safe to call from anywhere in the auth flow.
 */
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendGenericEmail } from '@/lib/email';
import { renderWelcomeEmail } from '@/emails/welcome';

export async function POST(request: Request) {
  const cookieStore = await cookies();
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
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: 'not_authenticated' }, { status: 401 });
  }

  // Pull profile to check status + greet them by first name
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('email, first_name, welcome_email_sent_at')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ ok: false, reason: 'profile_missing' }, { status: 404 });
  }

  if (profile.welcome_email_sent_at) {
    return NextResponse.json({ ok: true, status: 'already_sent' });
  }

  if (!profile.email) {
    return NextResponse.json({ ok: false, reason: 'no_email_on_profile' }, { status: 422 });
  }

  // Build & send
  const url = new URL(request.url);
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${url.protocol}//${url.host}`;
  const displayName = (profile.first_name || profile.email.split('@')[0] || 'there').trim();

  const html = renderWelcomeEmail({
    displayName,
    mapUrl: `${baseUrl}/map`,
    preferencesUrl: `${baseUrl}/settings/notifications`,
    unsubscribeUrl: `${baseUrl}/api/notifications/unsubscribe?user=${user.id}`,
  });

  const result = await sendGenericEmail(
    profile.email,
    'Willkommen bei LassTreffen!',
    html,
  );

  if (!result.success) {
    console.error('[send-welcome]', profile.email, result.error);
    // Don't bubble error to the client — sign-up UX shouldn't break on email
    // service blip. The next blast script run will pick this user up because
    // welcome_email_sent_at stays NULL.
    return NextResponse.json({ ok: false, reason: 'send_failed', error: result.error }, { status: 502 });
  }

  // Stamp idempotency marker
  await supabase
    .from('profiles')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', user.id);

  return NextResponse.json({ ok: true, status: 'sent', messageId: result.id });
}
