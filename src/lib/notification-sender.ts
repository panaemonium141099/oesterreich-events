/**
 * Notification channel routing module.
 *
 * Routes notifications to the appropriate channels based on user preferences:
 *   - In-app: INSERT into notifications table (triggers Supabase Realtime)
 *   - Email: Resend integration (task .8)
 *   - SMS: Twilio integration (task .9)
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.7, .8, .9, .12
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { sendArtistAlertSMS, isValidE164 } from './sms';
import {
  sendArtistAlertEmail as sendAlertViaResend,
  generateUnsubscribeToken,
  type ArtistAlertEmailData,
} from './email';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NotificationPayload {
  user_id: string;
  type: string;
  title: string;
  body: string;
  event_id?: string;
  action_url?: string;
  /** Optional email-specific data for artist alert emails */
  email_data?: {
    artist_name: string;
    artist_image_url?: string | null;
    event_title: string;
    event_date: string;
    event_time?: string | null;
    venue_name?: string | null;
    location: string;
    ticket_url?: string | null;
  };
}

export interface NotificationPreferences {
  user_id: string;
  artist_alerts_enabled: boolean;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_sms: boolean;
  phone_number: string | null;
}

export interface SendResult {
  in_app: boolean;
  email: 'sent' | 'skipped' | 'failed';
  sms: 'sent' | 'skipped' | 'stub';
}

// ── Channel implementations ─────────────────────────────────────────────────

/**
 * Send an in-app notification by inserting into the notifications table.
 * Supabase Realtime picks this up automatically for the NotificationBell.
 */
export async function sendInAppNotification(
  supabase: SupabaseClient,
  payload: NotificationPayload
): Promise<boolean> {
  const { error } = await supabase.from('notifications').insert({
    user_id: payload.user_id,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    event_id: payload.event_id,
    action_url: payload.action_url,
    read: false,
  });

  if (error) {
    // 23505 = unique_violation (duplicate notification, expected)
    if (error.code === '23505') {
      return false; // Already exists, not an error
    }
    console.error('Failed to send in-app notification:', error);
    return false;
  }

  return true;
}

/**
 * Send an email notification via Resend.
 * Requires email_data in the payload for artist alert emails.
 * Generates HMAC-based unsubscribe token for GDPR compliance.
 */
export async function sendEmailNotification(
  _supabase: SupabaseClient,
  payload: NotificationPayload,
  userEmail: string
): Promise<'sent' | 'skipped' | 'failed'> {
  const emailData = payload.email_data;
  if (!emailData) {
    console.warn(`[email] No email_data in payload for user ${payload.user_id}, skipping`);
    return 'skipped';
  }

  const secret =
    process.env.UNSUBSCRIBE_SECRET ??
    process.env.SUPABASE_JWT_SECRET ??
    '';

  if (!secret) {
    console.error('[email] No unsubscribe secret configured');
    return 'failed';
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://osterreich.events';
  const token = await generateUnsubscribeToken(payload.user_id, secret);

  const alertData: ArtistAlertEmailData = {
    artistName: emailData.artist_name,
    artistImageUrl: emailData.artist_image_url,
    eventTitle: emailData.event_title,
    eventDate: emailData.event_date,
    eventTime: emailData.event_time,
    venueName: emailData.venue_name,
    location: emailData.location,
    ticketUrl: emailData.ticket_url,
    eventPageUrl: `${baseUrl}/events/${payload.event_id}`,
    unsubscribeUrl: `${baseUrl}/api/notifications/unsubscribe?user_id=${payload.user_id}&token=${token}`,
    preferencesUrl: `${baseUrl}/settings/notifications`,
  };

  return sendAlertViaResend(userEmail, alertData);
}

/**
 * Send an SMS notification via Twilio.
 * Validates phone number (E.164) before sending.
 * Extracts artist name and event details from the notification payload.
 */
export async function sendSmsNotification(
  payload: NotificationPayload,
  phoneNumber: string
): Promise<'sent' | 'skipped' | 'stub'> {
  if (!isValidE164(phoneNumber)) {
    console.warn(`[SMS] Invalid phone number, skipping: ${phoneNumber}`);
    return 'skipped';
  }

  // Check if Twilio env vars are configured
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.log(`[SMS] Twilio not configured, skipping SMS for user ${payload.user_id}`);
    return 'stub';
  }

  try {
    // Use email_data for richer information when available
    const ed = payload.email_data;
    const result = await sendArtistAlertSMS(phoneNumber, {
      artistName: ed?.artist_name || payload.title.replace(/^Neues Event: /, ''),
      eventDate: ed?.event_date || '',
      location: ed?.venue_name || ed?.location || '',
      ticketUrl: ed?.ticket_url || payload.action_url || null,
      eventId: payload.event_id || '',
    });

    if (result.success) {
      console.log(`[SMS] Sent to ${phoneNumber} (SID: ${result.sid})`);
      return 'sent';
    }

    console.error(`[SMS] Failed for ${phoneNumber}: ${result.errorCode} - ${result.errorMessage}`);
    return 'skipped';
  } catch (err) {
    console.error(`[SMS] Error sending to ${phoneNumber}:`, err);
    return 'skipped';
  }
}

// ── Channel router ──────────────────────────────────────────────────────────

/**
 * Route a notification to all enabled channels for a user.
 *
 * Checks the user's notification_preferences to determine which channels
 * to use. Defaults to in-app only if no preferences exist.
 */
export async function routeNotification(
  supabase: SupabaseClient,
  payload: NotificationPayload,
  prefs: NotificationPreferences | null
): Promise<SendResult> {
  const result: SendResult = {
    in_app: false,
    email: 'skipped',
    sms: 'skipped',
  };

  // Default behavior: in-app only
  const alertsEnabled = prefs?.artist_alerts_enabled ?? true;
  if (!alertsEnabled) return result;

  const inAppEnabled = prefs?.channel_in_app ?? true;
  const emailEnabled = prefs?.channel_email ?? false;
  const smsEnabled = prefs?.channel_sms ?? false;

  // In-app notification
  if (inAppEnabled) {
    result.in_app = await sendInAppNotification(supabase, payload);
  }

  // Email notification (Resend)
  if (emailEnabled) {
    // Fetch user email from auth.users via service role
    const { data: userData } = await supabase.auth.admin.getUserById(payload.user_id);
    if (userData?.user?.email) {
      result.email = await sendEmailNotification(supabase, payload, userData.user.email);
    }
  }

  // SMS notification (Twilio)
  if (smsEnabled && prefs?.phone_number) {
    result.sms = await sendSmsNotification(payload, prefs.phone_number);
  }

  return result;
}

// ── Reminder notification helpers ──────────────────────────────────────────

export type ReminderType = '7d_before' | '1d_before';

/**
 * Build a reminder notification payload for an upcoming artist event.
 * Used by the send-reminders Edge Function to create conversion-focused
 * notifications with ticket CTAs.
 */
export function buildReminderPayload(opts: {
  user_id: string;
  event_id: string;
  artist_name: string | null;
  event_title: string;
  event_date: string;
  ticket_url: string | null;
  reminder_type: ReminderType;
  venue_name?: string | null;
  location?: string | null;
}): NotificationPayload {
  const { user_id, event_id, artist_name, event_title, ticket_url, reminder_type } = opts;
  const artist = artist_name || 'Dein Kuenstler';
  const fallbackUrl = `/events/${event_id}`;
  const url = ticket_url || fallbackUrl;

  const isWeek = reminder_type === '7d_before';
  const type = isWeek ? 'artist_reminder_7d' : 'artist_reminder_1d';
  const title = isWeek ? 'In einer Woche!' : 'Morgen!';
  const body = isWeek
    ? `In einer Woche: ${artist} bei ${event_title}! Sichere dir jetzt Tickets: ${url}`
    : `Morgen: ${artist} live! Letzte Chance fuer Tickets: ${url}`;

  return {
    user_id,
    type,
    title,
    body,
    event_id,
    action_url: url,
    email_data: {
      artist_name: artist,
      event_title,
      event_date: opts.event_date,
      venue_name: opts.venue_name,
      location: opts.location || '',
      ticket_url,
    },
  };
}
