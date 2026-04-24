/**
 * Email notification service using Resend API.
 *
 * Uses fetch() directly (no npm package) for compatibility with both
 * Node.js and Deno (Supabase Edge Functions).
 *
 * Env: RESEND_API_KEY
 * From: alerts@osterreich.events
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.8
 */

import { renderArtistAlertEmail } from '@/emails/artist-alert';
import { renderArtistReminderEmail } from '@/emails/artist-reminder';

// ── Constants ───────────────────────────────────────────────────────────────

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'alerts@osterreich.events';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500; // 500ms, 1s, 2s

// ── Types ───────────────────────────────────────────────────────────────────

export interface ArtistAlertEmailData {
  artistName: string;
  artistImageUrl?: string | null;
  eventTitle: string;
  eventDate: string; // formatted display date
  eventTime?: string | null;
  venueName?: string | null;
  location: string;
  ticketUrl?: string | null;
  eventPageUrl: string; // /events/{id}
  unsubscribeUrl: string;
  preferencesUrl: string;
}

export interface ArtistReminderEmailData extends ArtistAlertEmailData {
  daysUntil: 7 | 1;
}

interface ResendEmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
}

interface ResendSuccessResponse {
  id: string;
}

interface ResendErrorResponse {
  statusCode: number;
  message: string;
  name: string;
}

// ── Unsubscribe token ───────────────────────────────────────────────────────

/**
 * Generate an HMAC-based unsubscribe token.
 * Works in both Node.js and Deno via Web Crypto API.
 */
export async function generateUnsubscribeToken(
  userId: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(userId)
  );
  // Convert to URL-safe base64
  const bytes = new Uint8Array(signature);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Verify an unsubscribe token.
 */
export async function verifyUnsubscribeToken(
  userId: string,
  token: string,
  secret: string
): Promise<boolean> {
  const expected = await generateUnsubscribeToken(userId, secret);
  return token === expected;
}

// ── Resend API client ───────────────────────────────────────────────────────

/**
 * Send an email via Resend API with retry logic.
 * Retries up to 3 times with exponential backoff on failure.
 */
async function sendViaResend(
  payload: ResendEmailPayload,
  apiKey: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  let lastError = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = (await response.json()) as ResendSuccessResponse;
        return { success: true, id: data.id };
      }

      // Don't retry 4xx client errors (except 429 rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        const errorData = (await response.json().catch(() => null)) as ResendErrorResponse | null;
        lastError = errorData?.message ?? `HTTP ${response.status}`;
        break;
      }

      // 5xx or 429 -- retry
      const errorData = (await response.json().catch(() => null)) as ResendErrorResponse | null;
      lastError = errorData?.message ?? `HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return { success: false, error: lastError };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Send an artist discovery alert email.
 *
 * "{Artist} tritt in {Location} auf!"
 */
export async function sendArtistAlertEmail(
  to: string,
  data: ArtistAlertEmailData
): Promise<'sent' | 'failed'> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[email] RESEND_API_KEY not configured');
    return 'failed';
  }

  const subject = `${data.artistName} tritt in ${data.location} auf!`;
  const html = renderArtistAlertEmail(data);

  const result = await sendViaResend(
    { from: FROM_ADDRESS, to, subject, html },
    apiKey
  );

  if (!result.success) {
    console.error(`[email] Failed to send artist alert to ${to}:`, result.error);
    return 'failed';
  }

  return 'sent';
}

/**
 * Send an artist event reminder email.
 *
 * 7d: "In 7 Tagen: {Artist} live!"
 * 1d: "Morgen: {Artist} live!"
 */
export async function sendArtistReminderEmail(
  to: string,
  data: ArtistReminderEmailData
): Promise<'sent' | 'failed'> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[email] RESEND_API_KEY not configured');
    return 'failed';
  }

  const subject =
    data.daysUntil === 1
      ? `Morgen: ${data.artistName} live!`
      : `In ${data.daysUntil} Tagen: ${data.artistName} live!`;
  const html = renderArtistReminderEmail(data);

  const result = await sendViaResend(
    { from: FROM_ADDRESS, to, subject, html },
    apiKey
  );

  if (!result.success) {
    console.error(`[email] Failed to send reminder to ${to}:`, result.error);
    return 'failed';
  }

  return 'sent';
}

// ────────────────────────────────────────────────────────────────────
// Generic HTML-email send — used by admin/cron code that already
// produces a rendered HTML string (e.g. the SEO weekly report and the
// traffic-drop alert). Thin wrapper around sendViaResend so the cron
// routes don't have to know about Resend's payload shape.
// ────────────────────────────────────────────────────────────────────

export async function sendGenericEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }
  return sendViaResend({ from: FROM_ADDRESS, to, subject, html }, apiKey);
}
