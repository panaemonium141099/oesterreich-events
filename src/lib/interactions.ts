import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Event Interaction Tracking
// ---------------------------------------------------------------------------

export type InteractionType =
  | 'view'
  | 'save'
  | 'reminder_set'
  | 'share'
  | 'click_ticket'
  | 'click_source';

/**
 * Track an event interaction.
 *
 * Writes to the `event_interactions` table:
 *   id           uuid PK default gen_random_uuid()
 *   event_id     uuid NOT NULL REFERENCES events(id)
 *   user_id      uuid NULL REFERENCES auth.users(id)
 *   interaction_type text NOT NULL
 *   metadata_json jsonb NULL
 *   created_at   timestamptz NOT NULL default now()
 *
 * Migration (run manually):
 * ```sql
 * CREATE TABLE IF NOT EXISTS event_interactions (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 *   user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 *   interaction_type text NOT NULL,
 *   metadata_json jsonb,
 *   created_at timestamptz NOT NULL DEFAULT now()
 * );
 * CREATE INDEX idx_event_interactions_event ON event_interactions(event_id);
 * CREATE INDEX idx_event_interactions_type ON event_interactions(interaction_type);
 * CREATE INDEX idx_event_interactions_created ON event_interactions(created_at);
 * ```
 */
export async function trackInteraction(
  eventId: string,
  userId: string | null,
  type: InteractionType,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const supabase = createClient(url, key);

  const { error } = await supabase.from('event_interactions').insert({
    event_id: eventId,
    user_id: userId ?? null,
    interaction_type: type,
    metadata_json: metadata ?? null,
  });

  if (error) {
    // Log but don't throw — interaction tracking is non-critical
    console.error('[interactions] Failed to track:', error.message);
  }
}

// ---------------------------------------------------------------------------
// Rate Limiting (in-memory, per-IP)
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 100; // max requests per window

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Periodic cleanup to avoid unbounded memory growth
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 300_000; // 5 minutes

function cleanupRateLimits(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const expired: string[] = [];
  rateLimitMap.forEach((entry, key) => {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      expired.push(key);
    }
  });
  for (const key of expired) {
    rateLimitMap.delete(key);
  }
}

/**
 * Check if a request from the given IP is within rate limits.
 * Returns true if allowed, false if rate-limited.
 */
export function checkRateLimit(ip: string): boolean {
  cleanupRateLimits();

  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return false;
  }
  return true;
}

/** Reset rate limits (for testing) */
export function resetRateLimits(): void {
  rateLimitMap.clear();
}
