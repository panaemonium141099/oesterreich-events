import { createClient } from '@supabase/supabase-js';

/**
 * Stats fallback when the RPC is unreachable or returns no data.
 *
 * Order of preference at render time:
 *   1. `dedup_total` from `event_counts_for_stats` RPC (same number the
 *      map header shows — single source of truth).
 *   2. `total` from the same RPC (raw count before dedup).
 *   3. This static constant — only ever rendered if Supabase env vars
 *      are missing OR the RPC threw.
 */
const FALLBACK = 75000;

interface CountsPayload {
  regions?: Record<string, number>;
  categories?: Record<string, number>;
  total?: number;
  dedup_total?: number;
}

/**
 * Server-side fetch of the dedup_total — same RPC as
 * `/api/stats/counts`, but called inline from the Server Component so
 * the number lands in the prerendered ISR HTML and never roundtrips to
 * the browser. The page itself has `export const revalidate = 3600`
 * (set in `src/app/page.tsx`), so this query runs once per hour at the
 * Edge cache miss — not on every visitor.
 *
 * No cookies / no headers / no auth — we use the anon key, which has
 * `SELECT` on the RPC by RLS policy. That keeps the page route ISR-
 * eligible (a `cookies()` call would flip it back to `Dynamic`).
 */
async function fetchTotal(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return FALLBACK;

  try {
    const supabase = createClient(url, anonKey);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('event_counts_for_stats');
    if (error || !data) return FALLBACK;
    const payload = data as CountsPayload;
    const n = payload.dedup_total ?? payload.total ?? 0;
    return n > 0 ? n : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/**
 * LandingStats — fn-15.9: pure async RSC, no more client roundtrip.
 *
 * Pre-refactor this was a `'use client'` component that mounted, painted
 * the fallback "75.000+", then fired `/api/stats/counts` from the
 * browser and patched the DOM with the real number after the fetch
 * resolved. That meant:
 *   - +1 client-side network request from every page load.
 *   - The above-fold text changed value ~200–800 ms after first paint
 *     (a CLS-adjacent layout shift).
 *   - useState + useEffect dragged React-DOM-client (~3 KB-gz) onto the
 *     critical render path just to update one number.
 *
 * Post-refactor: this Server Component awaits the RPC at render time,
 * embeds the number in the prerendered HTML, and ships ZERO JS to the
 * client for this badge. The number stays accurate because the page
 * itself revalidates every hour (`revalidate = 3600` in page.tsx) —
 * which is the same TTL the /api/stats/counts endpoint uses for its
 * `s-maxage`, so we matched the old refresh cadence exactly.
 *
 * The badge below ("Täglich aktualisiert") with the pulsing dot is now
 * also pure HTML — the `animate-ping` keyframe is CSS, no JS hook
 * involved.
 */
export async function LandingStats() {
  const total = await fetchTotal();
  const formatted = total.toLocaleString('de-AT');

  return (
    <div
      className="flex flex-col items-center gap-2 animate-fade-in opacity-0"
      style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}
    >
      <p className="text-white/40 text-lg md:text-xl">
        <span className="text-white font-semibold">{formatted}+</span> Events in ganz Österreich
      </p>
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/25">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
        </span>
        Täglich aktualisiert
      </span>
    </div>
  );
}
