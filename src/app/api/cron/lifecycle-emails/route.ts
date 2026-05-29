/**
 * GET /api/cron/lifecycle-emails — weekly lifecycle mailer.
 *
 * Schedule: Donnerstag 15:00 UTC (= 17:00 CET, just before commuters check
 * mail) via vercel.json `crons` entry. Authentication via CRON_SECRET.
 *
 * For each user with `notification_preferences.lifecycle_emails_enabled = true`
 * (the default) we:
 *   1. Detect cohort: welcome / reactivation / weekend / skip
 *      (cohort-detector.ts — based on created_at, last_active_at, savedEvents
 *      count, and last lifecycle send timestamp)
 *   2. Resolve location: PLZ → bundesland → IP-detected → null
 *      (location-resolver.ts — uses gemeinden.json for exact PLZ→coords)
 *   3. Pick top events in the cohort's date window + location bbox
 *      (event-picker.ts — ordered by event_score DESC, dedup by venue)
 *   4. Render + send via Brevo, record lifecycle_email_sent_at on success
 *
 * Daily cap: Brevo free tier = 300 mails/day. We cap to 250 per cron run
 * to leave headroom for artist alerts / reminders that also share the quota.
 * The remaining users get their turn next Thursday — global ≥7d spacing
 * is enforced per user anyway.
 *
 * No user is mailed if pickLifecycleEvents() returns < 3 events for their
 * region (avoids a sad-looking 1-event email).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { detectCohort, type LifecycleCohort } from '@/lib/lifecycle/cohort-detector';
import { resolveUserLocation } from '@/lib/lifecycle/location-resolver';
import { pickLifecycleEvents } from '@/lib/lifecycle/event-picker';
import { sendLifecycleEmail, generateUnsubscribeToken } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DAILY_CAP = 250;        // Brevo free tier guard
const MIN_EVENTS_TO_SEND = 3; // Don't bother with sad 1-event emails

interface CronResponse {
  ok: boolean;
  durationMs: number;
  scanned: number;
  cohort: { welcome: number; reactivation: number; weekend: number; skip: number };
  sent: number;
  failed: number;
  skippedThinResult: number;  // < MIN_EVENTS_TO_SEND for region
  cappedAt?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getServiceClient(): SupabaseClient<any> {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const start = Date.now();
  const supabase = getServiceClient();
  const now = new Date();
  const unsubSecret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || 'dev-secret';

  const stats: CronResponse = {
    ok: true,
    durationMs: 0,
    scanned: 0,
    cohort: { welcome: 0, reactivation: 0, weekend: 0, skip: 0 },
    sent: 0,
    failed: 0,
    skippedThinResult: 0,
  };

  try {
    // ── 1. Prefetch candidate set ───────────────────────────────────────
    // Join profiles + notification_preferences. We deliberately page-fetch
    // (1000-row chunks) so memory stays bounded even at 100k users.

    const PAGE = 1000;
    let offset = 0;
    let processedThisRun = 0;

    while (processedThisRun < DAILY_CAP) {
      const { data: rows, error: fetchErr } = await supabase
        .from('profiles')
        .select(`
          id, email, first_name, city, postal_code, preferred_bundesland,
          detected_city, detected_lat, detected_lng,
          created_at, last_active_at,
          notification_preferences (
            lifecycle_emails_enabled,
            lifecycle_email_sent_at,
            lifecycle_cohort_last
          )
        `)
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE - 1);

      if (fetchErr) throw fetchErr;
      if (!rows || rows.length === 0) break;
      offset += rows.length;
      stats.scanned += rows.length;

      // Batch-prefetch auth.users.last_sign_in_at for this page so the
      // cohort detector can fall back to it when profiles.last_active_at
      // is null (which it is for ~every user the first weeks after rollout).
      // Service role can read auth schema via supabase.auth.admin.listUsers,
      // but that's pageable per-100 — for a 1k batch we fire a single SQL
      // through the postgres-rest service role token.
      const userIds = rows.map((row) => (row as { id: string }).id);
      const { data: authRows } = await supabase
        .schema('auth')
        .from('users')
        .select('id, last_sign_in_at')
        .in('id', userIds);
      const lastSignInById = new Map<string, string | null>(
        (authRows ?? []).map((u: { id: string; last_sign_in_at: string | null }) => [u.id, u.last_sign_in_at]),
      );

      // ── 2. Per-user processing ─────────────────────────────────────────
      for (const row of rows) {
        if (processedThisRun >= DAILY_CAP) {
          stats.cappedAt = DAILY_CAP;
          break;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = row as any;
        const prefs = Array.isArray(r.notification_preferences)
          ? r.notification_preferences[0]
          : r.notification_preferences;

        // Default to enabled when no pref row exists (backfill case)
        const enabled = prefs?.lifecycle_emails_enabled ?? true;

        // Cheap saved_events count (single query — we accept the latency
        // for correctness over a join that overfetches).
        const { count: savedCount } = await supabase
          .from('saved_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', r.id);

        const cohort: ReturnType<typeof detectCohort> = detectCohort({
          createdAt: r.created_at,
          lastActiveAt: r.last_active_at,
          authLastSignInAt: lastSignInById.get(r.id) ?? null,
          enabled,
          lastLifecycleSentAt: prefs?.lifecycle_email_sent_at ?? null,
          lastCohort: (prefs?.lifecycle_cohort_last as LifecycleCohort) ?? null,
          savedEventsCount: savedCount ?? 0,
          now,
        });

        stats.cohort[cohort === 'skip' ? 'skip' : cohort]++;
        if (cohort === 'skip' || !r.email) continue;

        const location = resolveUserLocation({
          city: r.city,
          postal_code: r.postal_code,
          preferred_bundesland: r.preferred_bundesland,
          detected_city: r.detected_city,
          detected_lat: r.detected_lat,
          detected_lng: r.detected_lng,
        });

        const events = await pickLifecycleEvents({ supabase, cohort, location, now });
        if (events.length < MIN_EVENTS_TO_SEND) {
          stats.skippedThinResult++;
          continue;
        }

        const cityForSubject = location?.display ?? 'Österreich';
        // /entdecken supports ?bl=… (bundesland) but not lat/lng filtering.
        // When we have the bundesland — directly from preferred_bundesland,
        // back-resolved from PLZ, or nearest-gemeinde from IP — link to that
        // filtered view so the CTA actually narrows the list. Without
        // bundesland (rare: no PLZ, no IP geo) we link to the unfiltered
        // discover page.
        const exploreUrl = location?.bundesland
          ? `https://lasstreffen.at/entdecken?bl=${encodeURIComponent(location.bundesland)}`
          : 'https://lasstreffen.at/entdecken';
        const unsubToken = await generateUnsubscribeToken(r.id, unsubSecret);

        const send = await sendLifecycleEmail(r.email, {
          cohort,
          firstName: r.first_name ?? undefined,
          cityName: cityForSubject,
          events,
          exploreUrl,
          unsubscribeUrl: `https://lasstreffen.at/api/notifications/unsubscribe?token=${unsubToken}&user_id=${r.id}&kind=lifecycle`,
          preferencesUrl: `https://lasstreffen.at/profil/notifications`,
        });

        if (send === 'sent') {
          stats.sent++;
          processedThisRun++;
          // Record sent timestamp for spacing/dedup. Upsert so users without
          // a row get one created on first lifecycle send.
          await supabase
            .from('notification_preferences')
            .upsert(
              {
                user_id: r.id,
                lifecycle_email_sent_at: now.toISOString(),
                lifecycle_cohort_last: cohort,
              },
              { onConflict: 'user_id' },
            );
        } else {
          stats.failed++;
        }
      }

      if (rows.length < PAGE) break; // last page
    }

    stats.durationMs = Date.now() - start;
    console.log('[cron:lifecycle-emails] done', stats);
    return NextResponse.json(stats);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.durationMs = Date.now() - start;
    console.error('[cron:lifecycle-emails] failed', { err: msg, stats });
    return NextResponse.json({ ...stats, ok: false, error: msg }, { status: 500 });
  }
}
