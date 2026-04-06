/**
 * Notification channel routing module.
 *
 * Routes notifications to the appropriate channels based on user preferences:
 *   - In-app: INSERT into notifications table (triggers Supabase Realtime)
 *   - Email: STUB (implemented in task .8 via Resend)
 *   - SMS: STUB (implemented in task .9 via Twilio)
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.7
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NotificationPayload {
  user_id: string;
  type: string;
  title: string;
  body: string;
  event_id?: string;
  action_url?: string;
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
  email: 'sent' | 'skipped' | 'stub';
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
 * STUB: Send an email notification.
 * Will be implemented in task .8 using Resend.
 */
export async function sendEmailNotification(
  _supabase: SupabaseClient,
  _payload: NotificationPayload,
  _userEmail: string
): Promise<'sent' | 'stub'> {
  // STUB: Email sending not yet implemented
  // Will use Resend API in task fn-10-spotify-artist-alerts-follow-artists.8
  console.log(`[STUB] Email notification for user ${_payload.user_id}: ${_payload.title}`);
  return 'stub';
}

/**
 * STUB: Send an SMS notification.
 * Will be implemented in task .9 using Twilio.
 */
export async function sendSmsNotification(
  _payload: NotificationPayload,
  _phoneNumber: string
): Promise<'sent' | 'stub'> {
  // STUB: SMS sending not yet implemented
  // Will use Twilio API in task fn-10-spotify-artist-alerts-follow-artists.9
  console.log(`[STUB] SMS notification to ${_phoneNumber}: ${_payload.title}`);
  return 'stub';
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

  // Email notification (stub)
  if (emailEnabled) {
    // Fetch user email from auth.users via service role
    const { data: userData } = await supabase.auth.admin.getUserById(payload.user_id);
    if (userData?.user?.email) {
      result.email = await sendEmailNotification(supabase, payload, userData.user.email);
    }
  }

  // SMS notification (stub)
  if (smsEnabled && prefs?.phone_number) {
    result.sms = await sendSmsNotification(payload, prefs.phone_number);
  }

  return result;
}
