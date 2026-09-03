/**
 * GET /api/cron/send-reminders
 *
 * Vercel Cron job that runs daily at 8:00 UTC (10:00 CET).
 * Sends event reminders for:
 *   1. Saved events approaching (7d / 1d based on user preferences)
 *   2. Artist-matched events approaching (same logic)
 *
 * Uses unique partial indexes on notifications to prevent duplicate sends.
 * Authentication via CRON_SECRET Bearer token.
 *
 * vercel.json cron config: { "path": "/api/cron/send-reminders", "schedule": "0 8 * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import {
  sendArtistReminderEmail,
  sendGenericEmail,
  generateUnsubscribeToken,
  type ArtistReminderEmailData,
} from '@/lib/email';
import { reminderToken, reminderMailHtml } from '@/lib/event-reminder';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── Helpers ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getServiceClient(): SupabaseClient<any> {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function formatDateDE(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('de-AT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ReminderTarget {
  user_id: string;
  event_id: string;
  event_title: string;
  event_date: string;
  location_name: string | null;
  ticket_url: string | null;
  image_url: string | null;
  artist_name: string | null;
  source: 'saved' | 'artist_match';
  // URL-builder fields — passed to buildEventUrlV2() so the
  // notification's action_url is the canonical /events/{plz-ort}/{date}/
  // {slug} form. Without these the URL falls back to the legacy UUID
  // form, which works for the server-side 308-redirect but breaks
  // client-side router.push() navigation from notifications (RSC fetch
  // chokes on the 308 — user sees "This page couldn't load").
  slug: string | null;
  postal_code: string | null;
  address: string | null;
  bundesland: string | null;
}

interface WindowStats {
  found: number;
  in_app: number;
  email: number;
  skipped: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = SupabaseClient<any>;

// ── Core processing ────────────────────────────────────────────────────────

/**
 * Process a single reminder window (either 7d or 1d).
 *
 * Finds all saved_events and artist_event_notifications where the linked
 * event starts within [daysAhead - 0.5, daysAhead + 0.5] days from now.
 * Creates in-app notifications (with dedup) and sends emails for users
 * with the corresponding reminder toggle and channel_email enabled.
 */
async function processWindow(
  supabase: ServiceClient,
  now: Date,
  daysAhead: 7 | 1,
  notificationType: string,
  stats: WindowStats
): Promise<void> {
  const prefKey = daysAhead === 7 ? 'reminder_7d' : 'reminder_1d';

  // 1-day window centered on the target day to account for daily cron jitter
  const windowStart = new Date(now.getTime() + (daysAhead - 0.5) * 86_400_000).toISOString();
  const windowEnd = new Date(now.getTime() + (daysAhead + 0.5) * 86_400_000).toISOString();

  // 1. Find saved events in the window.
  //    Exclude duplicates / suppressed rows so the reminder link doesn't
  //    point at a hidden event_id. The `events!inner` join already filters
  //    the parent; publish_status is added as an AND predicate below.
  // publish_status ist seit 2026-04-29 NOT NULL DEFAULT 'published' →
  // kein OR IS NULL nötig; .in() statt .or() für bessere Index-Nutzung.
  const { data: savedRows } = await supabase
    .from('saved_events')
    .select(`
      user_id, event_id,
      events!inner (id, title, start_date, location_name, ticket_url, image_url, publish_status, slug, postal_code, address, bundesland)
    `)
    .gte('events.start_date', windowStart)
    .lt('events.start_date', windowEnd)
    .in('events.publish_status', ['published', 'published_low_confidence']);

  // 2. Find artist-matched events in the window (same filter).
  const { data: matchedRows } = await supabase
    .from('artist_event_notifications')
    .select(`
      user_id, event_id, artist_name,
      events!inner (id, title, start_date, location_name, ticket_url, image_url, publish_status, slug, postal_code, address, bundesland)
    `)
    .gte('events.start_date', windowStart)
    .lt('events.start_date', windowEnd)
    .in('events.publish_status', ['published', 'published_low_confidence']);

  // 3. Build unified target list (deduplicate by user_id + event_id)
  const targetMap = new Map<string, ReminderTarget>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (savedRows || []) as any[]) {
    const event = row.events;
    const key = `${row.user_id}:${event.id}`;
    if (!targetMap.has(key)) {
      targetMap.set(key, {
        user_id: row.user_id,
        event_id: event.id,
        event_title: event.title,
        event_date: event.start_date,
        location_name: event.location_name,
        ticket_url: event.ticket_url,
        image_url: event.image_url,
        artist_name: null,
        source: 'saved',
        slug: event.slug ?? null,
        postal_code: event.postal_code ?? null,
        address: event.address ?? null,
        bundesland: event.bundesland ?? null,
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (matchedRows || []) as any[]) {
    const event = row.events;
    const key = `${row.user_id}:${event.id}`;
    const existing = targetMap.get(key);
    if (existing) {
      // Merge: prefer artist name from match over null
      existing.artist_name = existing.artist_name || row.artist_name;
    } else {
      targetMap.set(key, {
        user_id: row.user_id,
        event_id: event.id,
        event_title: event.title,
        event_date: event.start_date,
        location_name: event.location_name,
        ticket_url: event.ticket_url,
        image_url: event.image_url,
        artist_name: row.artist_name,
        source: 'artist_match',
        slug: event.slug ?? null,
        postal_code: event.postal_code ?? null,
        address: event.address ?? null,
        bundesland: event.bundesland ?? null,
      });
    }
  }

  const targets = Array.from(targetMap.values());
  stats.found = targets.length;
  if (targets.length === 0) return;

  // 4. Fetch notification preferences for all affected users
  const userIds = [...new Set(targets.map(t => t.user_id))];
  const { data: prefsData } = await supabase
    .from('notification_preferences')
    .select('user_id, artist_alerts_enabled, channel_email, channel_in_app, reminder_7d, reminder_1d')
    .in('user_id', userIds);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prefsMap = new Map<string, any>();
  for (const p of prefsData || []) {
    prefsMap.set(p.user_id, p);
  }

  // 5. Process each target
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://osterreich.events';
  const secret = process.env.UNSUBSCRIBE_SECRET ?? process.env.SUPABASE_JWT_SECRET ?? '';

  for (const target of targets) {
    const prefs = prefsMap.get(target.user_id);

    // Check if this reminder type is enabled (default: enabled when no prefs row)
    const reminderEnabled = prefs ? prefs[prefKey] !== false : true;
    if (!reminderEnabled) {
      stats.skipped++;
      continue;
    }

    const displayName = target.artist_name || target.event_title;

    // Canonical event URL — uses slug + plz-ort + date so the notification
    // click does a clean client-side navigation instead of triggering a
    // 308 in the RSC fetch. See ReminderTarget interface for context.
    const eventCanonicalPath = buildEventUrlV2({
      id: target.event_id,
      slug: target.slug,
      start_date: target.event_date,
      postal_code: target.postal_code,
      address: target.address,
      bundesland: target.bundesland,
      location_name: target.location_name,
    });

    // 5a. In-app notification (unique partial index prevents duplicates)
    const inAppEnabled = prefs ? prefs.channel_in_app !== false : true;
    if (inAppEnabled) {
      const { error } = await supabase.from('notifications').insert({
        user_id: target.user_id,
        type: notificationType,
        title: daysAhead === 7 ? 'In einer Woche!' : 'Morgen!',
        body: daysAhead === 7
          ? `In einer Woche: ${displayName} – Sichere dir jetzt Tickets!`
          : `Morgen: ${displayName} – Letzte Chance fuer Tickets!`,
        event_id: target.event_id,
        action_url: eventCanonicalPath,
        read: false,
      });

      if (error) {
        if (error.code === '23505') {
          // Already sent (dedup index), skip email too to avoid double send
          stats.skipped++;
          continue;
        }
        console.error(`[cron] In-app notification error for ${target.user_id}:`, error.message);
      } else {
        stats.in_app++;
      }
    }

    // 5b. Email notification
    const emailEnabled = prefs?.channel_email === true;
    if (emailEnabled) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(target.user_id);
        if (userData?.user?.email) {
          const token = secret ? await generateUnsubscribeToken(target.user_id, secret) : '';

          const emailData: ArtistReminderEmailData = {
            artistName: displayName,
            artistImageUrl: target.image_url,
            eventTitle: target.event_title,
            eventDate: formatDateDE(target.event_date),
            venueName: null,
            location: target.location_name || 'Österreich',
            ticketUrl: target.ticket_url,
            eventPageUrl: `${baseUrl}${eventCanonicalPath}`,
            unsubscribeUrl: `${baseUrl}/api/notifications/unsubscribe?user_id=${target.user_id}&token=${token}`,
            preferencesUrl: `${baseUrl}/settings`,
            daysUntil: daysAhead,
          };

          const result = await sendArtistReminderEmail(userData.user.email, emailData);
          if (result === 'sent') stats.email++;
        }
      } catch (err) {
        console.error(`[cron] Email error for user ${target.user_id}:`, err);
      }
    }
  }
}

// ── Anonyme E-Mail-Reminder (User-Auftrag 2026-07-15) ─────────────────────
//
// event_email_reminders: ohne Konto per Mail eingetragen (Double-Opt-in via
// /api/event-reminder/*). Zwei Fenster: 2 Tage vor dem Event + Event-Tag.
// Die reminded_*-Spalten machen den Versand idempotent (Cron darf
// mehrfach laufen). Budget 100 Mails/Fenster/Tag — Brevo-Free teilt sich
// 300/Tag mit Newsletter + Artist-Alerts.

interface AnonStats { due: number; sent: number; errors: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processAnonEmailReminders(supabase: SupabaseClient<any>, now: Date, stats: AnonStats): Promise<void> {
  const dateFmt = new Intl.DateTimeFormat('de-AT', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Vienna',
  });

  // Die Fenster sind seit 2026-09 waehlbar (Spalte `windows`): '7d' eine
  // Woche vorher, '2d' zwei Tage vorher, 'day' am Tag des Events. Der
  // Default in der Tabelle ist {2d,day} — bestehende Abos verhalten sich
  // damit unveraendert. `key` filtert auf die Auswahl, `col` merkt den
  // Versand, damit dieselbe Erinnerung nicht zweimal rausgeht.
  for (const win of [
    { daysAhead: 7, col: 'reminded_7d_at', key: '7d', isEventDay: false },
    { daysAhead: 2, col: 'reminded_2d_at', key: '2d', isEventDay: false },
    { daysAhead: 0, col: 'reminded_day_at', key: 'day', isEventDay: true },
  ] as const) {
    const from = new Date(now);
    from.setUTCHours(0, 0, 0, 0);
    from.setUTCDate(from.getUTCDate() + win.daysAhead);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);

    const { data: rows, error } = await supabase
      .from('event_email_reminders')
      .select('id,email,event_id,events!inner(id,slug,title,start_date,postal_code,address,bundesland,location_name)')
      .not('confirmed_at', 'is', null)
      .is('unsubscribed_at', null)
      .is(win.col, null)
      .contains('windows', [win.key])
      .gte('events.start_date', from.toISOString())
      .lt('events.start_date', to.toISOString())
      .limit(100);
    if (error) {
      console.error(`[cron/send-reminders] anon ${win.col} query failed:`, error);
      stats.errors++;
      continue;
    }

    for (const row of rows ?? []) {
      stats.due++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ev: any = Array.isArray(row.events) ? row.events[0] : row.events;
      if (!ev) continue;
      try {
        const unsubToken = await reminderToken('unsub', row.email, row.event_id);
        const unsubscribeUrl = `https://lasstreffen.at/api/event-reminder/unsubscribe?email=${encodeURIComponent(row.email)}&event=${row.event_id}&token=${unsubToken}`;
        const sent = await sendGenericEmail(
          row.email,
          // Betreff aus dem Fenster ableiten — vorher stand hier fest
          // "In 2 Tagen", was mit dem neuen 7-Tage-Fenster gelogen waere.
          win.isEventDay
            ? `Heute: ${ev.title}`
            : win.daysAhead === 7
              ? `In einer Woche: ${ev.title}`
              : `In ${win.daysAhead} Tagen: ${ev.title}`,
          reminderMailHtml({
            eventTitle: ev.title ?? 'Dein Event',
            eventDate: dateFmt.format(new Date(ev.start_date)),
            locationName: ev.location_name,
            eventUrl: `https://lasstreffen.at${buildEventUrlV2(ev)}`,
            isEventDay: win.isEventDay,
            daysAhead: win.daysAhead,
            unsubscribeUrl,
          }),
        );
        if (sent.success) {
          await supabase
            .from('event_email_reminders')
            .update({ [win.col]: new Date().toISOString() })
            .eq('id', row.id);
          stats.sent++;
        } else {
          stats.errors++;
        }
      } catch (err) {
        console.error('[cron/send-reminders] anon send failed:', err);
        stats.errors++;
      }
    }
  }
}

// ── HTTP Handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel Cron sends this automatically)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date();

  const stats = {
    reminders_7d: { found: 0, in_app: 0, email: 0, skipped: 0 } as WindowStats,
    reminders_1d: { found: 0, in_app: 0, email: 0, skipped: 0 } as WindowStats,
    anon: { due: 0, sent: 0, errors: 0 } as AnonStats,
    errors: 0,
    duration_ms: 0,
  };
  const startTime = Date.now();

  try {
    // Process 7-day-ahead reminders
    await processWindow(supabase, now, 7, 'saved_event_reminder_7d', stats.reminders_7d);

    // Process 1-day-ahead reminders
    await processWindow(supabase, now, 1, 'saved_event_reminder_1d', stats.reminders_1d);

    // Anonyme E-Mail-Reminder (2 Tage vorher + Event-Tag)
    await processAnonEmailReminders(supabase, now, stats.anon);

    stats.duration_ms = Date.now() - startTime;

    console.log(
      `[cron/send-reminders] Done: ` +
      `7d(found=${stats.reminders_7d.found}, emails=${stats.reminders_7d.email}), ` +
      `1d(found=${stats.reminders_1d.found}, emails=${stats.reminders_1d.email}), ` +
      `${stats.duration_ms}ms`
    );

    return NextResponse.json({ success: true, stats });
  } catch (err) {
    stats.errors++;
    stats.duration_ms = Date.now() - startTime;
    console.error('[cron/send-reminders] Fatal error:', err);
    return NextResponse.json(
      { success: false, error: String(err), stats },
      { status: 500 }
    );
  }
}
