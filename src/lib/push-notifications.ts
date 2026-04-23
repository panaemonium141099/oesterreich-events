/**
 * Server-side Web-Push helper. Uses VAPID over the standard Push API so
 * messages land on the user's OS even when the lasstreffen.at tab is closed.
 *
 * Only loaded from Server Components / Route Handlers — never ship to client.
 *
 * Required env vars:
 *   VAPID_PUBLIC_KEY          — uncompressed P-256 public key (base64url)
 *   VAPID_PRIVATE_KEY         — matching private scalar (base64url)
 *   VAPID_SUBJECT             — mailto:info@lasstreffen.at  (spec requires mailto: or URL)
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY — mirror of VAPID_PUBLIC_KEY for the client
 *
 * Generate new keys with:
 *   npx web-push generate-vapid-keys --json
 */

import webpush from 'web-push';

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT ?? 'mailto:info@lasstreffen.at';

let configured = false;
let warned     = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    if (!warned) {
      console.warn('[push] VAPID keys missing — push notifications disabled');
      warned = true;
    }
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

/**
 * Send one push. Returns `true` on success, `false` if the subscription is
 * gone (caller should delete it).
 */
export async function sendPush(
  sub: PushSubscriptionRow,
  payload: PushPayload,
): Promise<{ ok: boolean; gone: boolean }> {
  if (!ensureConfigured()) return { ok: false, gone: false };

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },
    );
    return { ok: true, gone: false };
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    // 404 = endpoint unknown · 410 = user unsubscribed → caller should prune the row.
    const gone = statusCode === 404 || statusCode === 410;
    if (!gone) {
      console.warn('[push] sendNotification failed', statusCode, err);
    }
    return { ok: false, gone };
  }
}

/**
 * Send the same payload to every subscription we have for a user. Returns the
 * list of endpoints that came back as 404/410 so the caller can prune them.
 * Non-blocking for the caller's latency — each send runs in parallel.
 */
export async function sendPushToSubscriptions(
  subs: PushSubscriptionRow[],
  payload: PushPayload,
): Promise<{ sent: number; stale: string[] }> {
  if (!ensureConfigured() || subs.length === 0) {
    return { sent: 0, stale: [] };
  }
  const results = await Promise.allSettled(subs.map(s => sendPush(s, payload)));
  const stale: string[] = [];
  let sent = 0;
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      if (r.value.ok) sent += 1;
      if (r.value.gone) stale.push(subs[idx].endpoint);
    }
  });
  return { sent, stale };
}

export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}
