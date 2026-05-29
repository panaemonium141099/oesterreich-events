/**
 * Decide which lifecycle email cohort (if any) a user qualifies for.
 *
 * Priorities (highest first — only one cohort fires per run):
 *   1. WELCOME      — created_at within 7 days AND welcome never sent before
 *   2. REACTIVATION — last_active_at older than 21 days AND last reactivation > 60d ago (or never)
 *   3. WEEKEND      — active in the last 21 days AND ≥7 days since last lifecycle email
 *
 * Returns 'skip' when none apply or when the global ≥7-day spacing is violated.
 *
 * Time-zone note: we compute in UTC. The cron fires Do 15:00 UTC = 17:00 CET,
 * which means a user signed up at 18:00 CET Thursday won't be eligible for
 * welcome until next Thursday — that's fine, welcome is one-off and the user
 * has already received a "complete-profile" prompt in the app.
 */

export type LifecycleCohort = 'welcome' | 'reactivation' | 'weekend';
export type CohortDecision = LifecycleCohort | 'skip';

export interface CohortInputs {
  /** profiles.created_at — timestamp the user registered. */
  createdAt: Date | string;
  /**
   * profiles.last_active_at — bumped by /api/auth/detect-location on every
   * login. Null for users who haven't signed in since the column was added.
   */
  lastActiveAt: Date | string | null;
  /**
   * auth.users.last_sign_in_at — Supabase's own login timestamp. Used as a
   * fallback for last_active_at when our app-level column is null, so we
   * don't misclassify recently-logged-in users as "inactive for 21 days".
   */
  authLastSignInAt: Date | string | null;
  /** notification_preferences.lifecycle_emails_enabled — opt-out flag. */
  enabled: boolean;
  /** notification_preferences.lifecycle_email_sent_at — last lifecycle send. Null = never. */
  lastLifecycleSentAt: Date | string | null;
  /** notification_preferences.lifecycle_cohort_last — which cohort the last send was. */
  lastCohort: LifecycleCohort | null;
  /** Number of saved_events rows for this user (cheap count from the cron prefetch). */
  savedEventsCount: number;
  /** Reference "now" — pass Date.now() in prod, fix it in tests. */
  now: Date;
}

const DAY = 24 * 60 * 60 * 1000;

export function detectCohort(input: CohortInputs): CohortDecision {
  if (!input.enabled) return 'skip';

  const now = input.now.getTime();
  const created = toDate(input.createdAt).getTime();
  // Prefer our own column (bumped on every detect-location call); fall back
  // to Supabase's auth.users.last_sign_in_at when ours hasn't fired yet
  // (typical for any user who signed in before the column existed).
  const lastActiveSrc = input.lastActiveAt ?? input.authLastSignInAt;
  const lastActive = lastActiveSrc ? toDate(lastActiveSrc).getTime() : null;
  const lastSent = input.lastLifecycleSentAt ? toDate(input.lastLifecycleSentAt).getTime() : null;
  const sinceLastSent = lastSent === null ? Infinity : now - lastSent;

  // ── Tier 1: Welcome ─────────────────────────────────────────────────
  // Brand-new users with zero engagement. No activity signal needed —
  // we explicitly want to greet them in their first week.
  const ageDays = (now - created) / DAY;
  const welcomeAlreadySent = input.lastCohort === 'welcome';
  if (!welcomeAlreadySent && ageDays <= 7 && input.savedEventsCount === 0) {
    return 'welcome';
  }

  // ── Tier 2 + 3 need a positive activity signal ──────────────────────
  // If we have ZERO knowledge of when the user last logged in (both our
  // column AND auth.users are null) we skip rather than guess from
  // account-age — otherwise a user who signed up 3 months ago and was
  // active yesterday looks identical to one who registered once and
  // vanished. Account age is a registration signal, not an activity one.
  if (lastActive === null) {
    return 'skip';
  }

  const daysSinceActive = (now - lastActive) / DAY;

  // ── Tier 2: Reactivation ────────────────────────────────────────────
  // ≥21d since last login. ≥60d between two reactivation sends to avoid
  // pestering people who genuinely don't want to come back. Plus the
  // global ≥7d spacing.
  const reactivationGap = input.lastCohort === 'reactivation' ? 60 : 0;
  const sinceLastReactivationOk = (sinceLastSent / DAY) >= reactivationGap;
  if (daysSinceActive >= 21 && sinceLastReactivationOk && sinceLastSent >= 7 * DAY) {
    return 'reactivation';
  }

  // ── Tier 3: Weekend picks ───────────────────────────────────────────
  // Active in the last 21 days. ≥7d since last lifecycle send.
  if (daysSinceActive < 21 && sinceLastSent >= 7 * DAY) {
    return 'weekend';
  }

  return 'skip';
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}
