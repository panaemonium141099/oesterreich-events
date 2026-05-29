/**
 * Email notification service.
 *
 * Provider: Brevo (formerly Sendinblue) — EU-hosted, GDPR-native,
 * 300 mails/day free tier. Uses the v3 transactional API via fetch()
 * for cross-runtime compatibility (Node.js + Supabase Edge Functions).
 *
 * Env:
 *   BREVO_API_KEY   — required, format `xkeysib-...`
 *   EMAIL_FROM      — sender email (default: noreply@lasstreffen.at)
 *   EMAIL_FROM_NAME — sender display name (default: LassTreffen!)
 *
 * Falls back to RESEND_API_KEY for legacy compat if no Brevo key set.
 */

import { renderArtistAlertEmail } from '@/emails/artist-alert';
import { renderArtistReminderEmail } from '@/emails/artist-reminder';
import { renderLifecycleEmail, type LifecycleEmailData } from '@/emails/lifecycle-weekend';

// ── Constants ───────────────────────────────────────────────────────────────

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM_EMAIL = 'noreply@lasstreffen.at';
const DEFAULT_FROM_NAME = 'LassTreffen!';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500; // 500ms, 1s, 2s

function getFromAddress(): { email: string; name: string } {
  return {
    email: process.env.EMAIL_FROM || DEFAULT_FROM_EMAIL,
    name: process.env.EMAIL_FROM_NAME || DEFAULT_FROM_NAME,
  };
}

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

/** Provider-agnostic email payload — same shape regardless of provider. */
interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

interface BrevoSuccessResponse {
  messageId: string;
}

interface ResendSuccessResponse {
  id: string;
}

interface BrevoErrorResponse {
  code: string;
  message: string;
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

// ── Provider clients (Brevo primary, Resend legacy fallback) ────────────────

/**
 * Send an email via Brevo Transactional API with retry logic.
 * Retries up to 3 times with exponential backoff on 5xx/429.
 */
async function sendViaBrevo(
  payload: EmailPayload,
  apiKey: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { email: fromEmail, name: fromName } = getFromAddress();
  const body = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: payload.to }],
    subject: payload.subject,
    htmlContent: payload.html,
  };

  let lastError = '';
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    try {
      const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = (await response.json()) as BrevoSuccessResponse;
        return { success: true, id: data.messageId };
      }

      // 4xx (except 429): permanent failure, don't retry
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        const errorData = (await response.json().catch(() => null)) as BrevoErrorResponse | null;
        lastError = errorData?.message ?? `HTTP ${response.status}`;
        break;
      }
      // 5xx / 429: retry
      const errorData = (await response.json().catch(() => null)) as BrevoErrorResponse | null;
      lastError = errorData?.message ?? `HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { success: false, error: lastError };
}

/**
 * Send an email via Resend API (legacy fallback).
 */
async function sendViaResend(
  payload: EmailPayload,
  apiKey: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { email: fromEmail, name: fromName } = getFromAddress();
  const body = {
    from: `${fromName} <${fromEmail}>`,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  };

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
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = (await response.json()) as ResendSuccessResponse;
        return { success: true, id: data.id };
      }
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        const errorData = (await response.json().catch(() => null)) as ResendErrorResponse | null;
        lastError = errorData?.message ?? `HTTP ${response.status}`;
        break;
      }
      const errorData = (await response.json().catch(() => null)) as ResendErrorResponse | null;
      lastError = errorData?.message ?? `HTTP ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { success: false, error: lastError };
}

/**
 * Provider-router: prefers Brevo if BREVO_API_KEY is set, else falls back
 * to Resend. This keeps existing artist-alert / cron paths working during
 * the migration.
 */
async function sendEmail(
  payload: EmailPayload,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) return sendViaBrevo(payload, brevoKey);

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) return sendViaResend(payload, resendKey);

  return { success: false, error: 'No email provider configured (set BREVO_API_KEY or RESEND_API_KEY)' };
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
  const subject = `${data.artistName} tritt in ${data.location} auf!`;
  const html = renderArtistAlertEmail(data);
  const result = await sendEmail({ to, subject, html });

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
  const subject =
    data.daysUntil === 1
      ? `Morgen: ${data.artistName} live!`
      : `In ${data.daysUntil} Tagen: ${data.artistName} live!`;
  const html = renderArtistReminderEmail(data);
  const result = await sendEmail({ to, subject, html });

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
  return sendEmail({ to, subject, html });
}

/**
 * Send a lifecycle email (welcome / reactivation / weekend) — single entry
 * point used by the /api/cron/lifecycle-emails route. Subject is generated
 * inside the template per cohort + city.
 */
export async function sendLifecycleEmail(
  to: string,
  data: LifecycleEmailData,
): Promise<'sent' | 'failed'> {
  const { subject, html } = renderLifecycleEmail(data);
  const result = await sendEmail({ to, subject, html });
  if (!result.success) {
    console.error(`[email] Lifecycle (${data.cohort}) to ${to} failed:`, result.error);
    return 'failed';
  }
  return 'sent';
}
