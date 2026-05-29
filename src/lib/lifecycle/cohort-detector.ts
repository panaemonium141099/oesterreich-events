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
  /** profiles.last_active_at — last time the user pinged detect-location. Null = never seen. */
  lastActiveAt: Date | string | null;
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
  const lastActive = input.lastActiveAt ? toDate(input.lastActiveAt).getTime() : null;
  const lastSent = input.lastLifecycleSentAt ? toDate(input.lastLifecycleSentAt).getTime() : null;
  const sinceLastSent = lastSent === null ? Infinity : now - lastSent;

  // Global spacing: ≥7d between any two lifecycle mails. Welcome is a one-off
  // gift (skip if already sent regardless of days).
  if (input.lastCohort === 'welcome') {
    // Welcome was already sent — never resend, treat as "no welcome eligible";
    // user can still get reactivation/weekend, subject to spacing.
  }

  // ── Tier 1: Welcome ─────────────────────────────────────────────────
  const ageDays = (now - created) / DAY;
  const welcomeAlreadySent = input.lastCohort === 'welcome';
  if (!welcomeAlreadySent && ageDays <= 7 && input.savedEventsCount === 0) {
    // ≥7d spacing only enforced if a previous lifecycle mail exists. For a
    // brand-new user who got nothing yet, send welcome immediately.
    return 'welcome';
  }

  // ── Tier 2: Reactivation ────────────────────────────────────────────
  // User considered "active" only if last_active_at exists AND is recent.
  // If we never saw them (lastActive=null) but they're > 21d old, treat as
  // inactive and fire reactivation.
  const daysSinceActive = lastActive ? (now - lastActive) / DAY : ageDays;
  const reactivationGap = input.lastCohort === 'reactivation' ? 60 : 0; // ≥60d between reactivations
  const sinceLastReactivation = (sinceLastSent / DAY) >= reactivationGap;
  if (daysSinceActive >= 21 && sinceLastReactivation && sinceLastSent >= 7 * DAY) {
    return 'reactivation';
  }

  // ── Tier 3: Weekend picks ───────────────────────────────────────────
  // For active users only. ≥7d since last lifecycle send.
  if (daysSinceActive < 21 && sinceLastSent >= 7 * DAY) {
    return 'weekend';
  }

  return 'skip';
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}
