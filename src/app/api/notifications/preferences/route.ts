/**
 * GET/PUT /api/notifications/preferences
 *
 * Authenticated endpoint for reading and updating notification preferences.
 * Uses upsert (INSERT ON CONFLICT UPDATE) for the notification_preferences table.
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.10
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/** E.164 phone number format: +<country code><number>, 7-15 digits total */
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

async function getAuthUser() {
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
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/notifications/preferences
 * Returns the current user's notification preferences.
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[preferences:GET] Failed to fetch:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Einstellungen' },
      { status: 500 }
    );
  }

  // Return defaults if no row exists
  const prefs = data ?? {
    artist_alerts_enabled: true,
    channel_in_app: true,
    channel_email: false,
    channel_sms: false,
    reminder_7d: true,
    reminder_1d: true,
    phone_number: null,
    city_digest_enabled: true,
    venue_alerts_enabled: true,
    today_near_you_enabled: true,
    student_alerts_enabled: false,
  };

  return NextResponse.json({ preferences: prefs });
}

/**
 * PUT /api/notifications/preferences
 * Upserts notification preferences for the authenticated user.
 */
export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  // Validate phone number if SMS is enabled
  const channelSms = body.channel_sms === true;
  const phoneNumber = typeof body.phone_number === 'string' ? body.phone_number.trim() : null;

  if (channelSms && phoneNumber && !E164_REGEX.test(phoneNumber)) {
    return NextResponse.json(
      { error: 'Ungueltige Telefonnummer. Bitte im Format +43... angeben.' },
      { status: 400 }
    );
  }

  if (channelSms && !phoneNumber) {
    return NextResponse.json(
      { error: 'Telefonnummer erforderlich fuer SMS-Benachrichtigungen.' },
      { status: 400 }
    );
  }

  const upsertData = {
    user_id: user.id,
    artist_alerts_enabled: body.artist_alerts_enabled !== false,
    channel_in_app: true, // Always enabled
    channel_email: body.channel_email === true,
    channel_sms: channelSms,
    reminder_7d: body.reminder_7d !== false,
    reminder_1d: body.reminder_1d !== false,
    phone_number: channelSms ? phoneNumber : null,
    city_digest_enabled: body.city_digest_enabled !== false,
    venue_alerts_enabled: body.venue_alerts_enabled !== false,
    today_near_you_enabled: body.today_near_you_enabled !== false,
    student_alerts_enabled: body.student_alerts_enabled === true,
    updated_at: new Date().toISOString(),
  };

  const supabase = getServiceClient();
  const { error } = await supabase
    .from('notification_preferences')
    .upsert(upsertData, { onConflict: 'user_id' });

  if (error) {
    console.error('[preferences:PUT] Failed to upsert:', error);
    return NextResponse.json(
      { error: 'Fehler beim Speichern der Einstellungen' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, preferences: upsertData });
}
