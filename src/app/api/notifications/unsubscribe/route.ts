/**
 * GET /api/notifications/unsubscribe?user_id=<uuid>&token=<hmac>
 *
 * GDPR-compliant unsubscribe endpoint.
 * Sets channel_email=false in notification_preferences for the user.
 * Token is HMAC-SHA256(user_id) signed with UNSUBSCRIBE_SECRET or SUPABASE_JWT_SECRET.
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.8
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyUnsubscribeToken } from '@/lib/email';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const userId = searchParams.get('user_id');
  const token = searchParams.get('token');

  if (!userId || !token) {
    return new NextResponse(renderPage('Fehler', 'Ungueltiger Abmelde-Link.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const secret =
    process.env.UNSUBSCRIBE_SECRET ??
    process.env.SUPABASE_JWT_SECRET ??
    '';

  if (!secret) {
    console.error('[unsubscribe] No secret configured');
    return new NextResponse(
      renderPage('Fehler', 'Serverkonfigurationsfehler.'),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const valid = await verifyUnsubscribeToken(userId, token, secret);
  if (!valid) {
    return new NextResponse(
      renderPage('Fehler', 'Ungueltiger oder abgelaufener Abmelde-Link.'),
      { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  // Use service role to update preferences
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return new NextResponse(
      renderPage('Fehler', 'Serverkonfigurationsfehler.'),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { error } = await supabase
    .from('notification_preferences')
    .update({ channel_email: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error('[unsubscribe] Failed to update preferences:', error);
    return new NextResponse(
      renderPage('Fehler', 'Abmeldung fehlgeschlagen. Bitte versuche es erneut.'),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  return new NextResponse(
    renderPage(
      'Erfolgreich abgemeldet',
      'Du erhaeltst keine E-Mail-Benachrichtigungen mehr. Du kannst dies jederzeit in deinen Benachrichtigungseinstellungen aendern.'
    ),
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/**
 * Render a minimal HTML page for unsubscribe confirmation/errors.
 */
function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - osterreich.events</title>
  <style>
    body { margin: 0; padding: 48px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; color: #374151; text-align: center; }
    .card { max-width: 480px; margin: 0 auto; background: #fff; padding: 40px 32px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { margin: 0 0 12px; font-size: 24px; color: #111827; }
    p { margin: 0; font-size: 16px; line-height: 1.6; color: #6b7280; }
    a { color: #6366f1; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <p style="margin-top: 24px;">
      <a href="https://osterreich.events">Zurueck zu osterreich.events</a>
    </p>
  </div>
</body>
</html>`;
}
