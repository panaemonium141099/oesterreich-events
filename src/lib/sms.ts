/**
 * SMS Notification Service via Twilio REST API.
 *
 * Uses raw fetch (no npm SDK) for Deno + Node.js compatibility.
 * Conversion-focused SMS with ticket links, max ~300 chars (1-2 segments).
 *
 * Env vars required:
 *   TWILIO_ACCOUNT_SID   — Twilio Account SID
 *   TWILIO_AUTH_TOKEN     — Twilio Auth Token
 *   TWILIO_PHONE_NUMBER   — Twilio sender phone number (E.164)
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.9
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ArtistAlertSMSPayload {
  artistName: string;
  eventDate: string;       // Human-readable, e.g. "15. Mai 2026"
  location: string;        // Venue / city
  ticketUrl: string | null;
  eventId: string;         // Fallback link: /events/{id}
}

export type ReminderType = '7d' | '1d';

export interface ArtistReminderSMSPayload extends ArtistAlertSMSPayload {
  reminderType: ReminderType;
}

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

interface TwilioSendResult {
  success: boolean;
  sid?: string;
  errorCode?: string;
  errorMessage?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_SMS_LENGTH = 300; // Stay within 1-2 SMS segments
const MAX_RETRIES = 2;
const BASE_URL = 'https://osterreich.events/events';

// ── Phone number validation ─────────────────────────────────────────────────

/**
 * Validate that a phone number is in E.164 format.
 * Austrian mobile numbers start with +43 6XX.
 */
export function isValidE164(phone: string): boolean {
  // E.164: + followed by 7-15 digits
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * Validate that a phone number is an Austrian mobile number.
 * Austrian mobiles: +43 6XX XXX XXXX (10-13 digits after +43)
 */
export function isAustrianMobile(phone: string): boolean {
  return /^\+436\d{8,11}$/.test(phone);
}

// ── SMS formatting ──────────────────────────────────────────────────────────

function getEventLink(ticketUrl: string | null, eventId: string): string {
  return ticketUrl || `${BASE_URL}/${eventId}`;
}

/**
 * Truncate text to fit within a max length, adding "..." if truncated.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Build a discovery SMS message.
 * Format: "{artist} tritt am {date} in {location} auf! Tickets: {url}"
 */
export function formatDiscoverySMS(payload: ArtistAlertSMSPayload): string {
  const link = getEventLink(payload.ticketUrl, payload.eventId);
  const suffix = ` Tickets: ${link}`;
  const prefix = `${payload.artistName} tritt am ${payload.eventDate} in `;
  const available = MAX_SMS_LENGTH - prefix.length - suffix.length - ' auf!'.length;

  const location = truncate(payload.location, Math.max(available, 10));
  const msg = `${prefix}${location} auf!${suffix}`;
  return msg.slice(0, MAX_SMS_LENGTH);
}

/**
 * Build a reminder SMS message.
 * 7d: "In 1 Woche: {artist} live in {location}! Tickets: {url}"
 * 1d: "Morgen: {artist} in {location}! Letzte Chance: {url}"
 */
export function formatReminderSMS(payload: ArtistReminderSMSPayload): string {
  const link = getEventLink(payload.ticketUrl, payload.eventId);

  if (payload.reminderType === '7d') {
    const suffix = ` Tickets: ${link}`;
    const prefix = `In 1 Woche: ${payload.artistName} live in `;
    const available = MAX_SMS_LENGTH - prefix.length - suffix.length - '!'.length;
    const location = truncate(payload.location, Math.max(available, 10));
    return `${prefix}${location}!${suffix}`.slice(0, MAX_SMS_LENGTH);
  }

  // 1d reminder
  const suffix = ` Letzte Chance: ${link}`;
  const prefix = `Morgen: ${payload.artistName} in `;
  const available = MAX_SMS_LENGTH - prefix.length - suffix.length - '!'.length;
  const location = truncate(payload.location, Math.max(available, 10));
  return `${prefix}${location}!${suffix}`.slice(0, MAX_SMS_LENGTH);
}

// ── Twilio API ──────────────────────────────────────────────────────────────

function getTwilioConfig(): TwilioConfig {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      'Missing Twilio env vars. Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER'
    );
  }

  return { accountSid, authToken, fromNumber };
}

/**
 * Send an SMS via Twilio REST API (raw fetch, no SDK).
 * Retries up to MAX_RETRIES times on transient failures.
 */
async function sendViaTwilio(
  to: string,
  body: string,
  config: TwilioConfig
): Promise<TwilioSendResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');

  const params = new URLSearchParams({
    To: to,
    From: config.fromNumber,
    Body: body,
  });

  let lastError: string | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, sid: data.sid };
      }

      // Non-retryable errors (invalid number, etc.)
      const nonRetryable = [21211, 21214, 21217, 21610, 21612, 21408];
      if (nonRetryable.includes(data.code)) {
        console.error(`[SMS] Non-retryable Twilio error ${data.code}: ${data.message}`);
        return {
          success: false,
          errorCode: String(data.code),
          errorMessage: data.message,
        };
      }

      lastError = `Twilio API error ${data.code}: ${data.message}`;
      console.warn(`[SMS] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed: ${lastError}`);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[SMS] Attempt ${attempt + 1}/${MAX_RETRIES + 1} network error: ${lastError}`);
    }

    // Wait before retry (exponential backoff: 1s, 2s)
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  return {
    success: false,
    errorCode: 'RETRY_EXHAUSTED',
    errorMessage: lastError || 'All retry attempts failed',
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Send an artist alert discovery SMS.
 * Validates phone number and sends conversion-focused message with ticket link.
 */
export async function sendArtistAlertSMS(
  to: string,
  payload: ArtistAlertSMSPayload
): Promise<TwilioSendResult> {
  if (!isValidE164(to)) {
    return {
      success: false,
      errorCode: 'INVALID_PHONE',
      errorMessage: `Invalid E.164 phone number: ${to}`,
    };
  }

  const body = formatDiscoverySMS(payload);
  const config = getTwilioConfig();

  console.log(`[SMS] Sending artist alert to ${to}: ${payload.artistName}`);
  return sendViaTwilio(to, body, config);
}

/**
 * Send an artist event reminder SMS (7d or 1d before event).
 * Validates phone number and sends urgency-focused message.
 */
export async function sendArtistReminderSMS(
  to: string,
  payload: ArtistReminderSMSPayload
): Promise<TwilioSendResult> {
  if (!isValidE164(to)) {
    return {
      success: false,
      errorCode: 'INVALID_PHONE',
      errorMessage: `Invalid E.164 phone number: ${to}`,
    };
  }

  const body = formatReminderSMS(payload);
  const config = getTwilioConfig();

  console.log(`[SMS] Sending ${payload.reminderType} reminder to ${to}: ${payload.artistName}`);
  return sendViaTwilio(to, body, config);
}
