import 'server-only';
/**
 * Server-side helper to load + apply the current refresh state for a
 * given hub path.
 *
 * Called by hub pages to:
 *   1. Look up `intro_variant_index` for this hub (default 0 if no row)
 *   2. Render the current intro variant via intro-pool.ts
 *
 * Tiny in-memory cache (60s) prevents per-render DB hits — the
 * monthly cron is the only writer so staleness is acceptable.
 */

import { createClient } from '@supabase/supabase-js';
import { renderIntro, type HubType, type IntroContext } from './intro-pool';

interface RefreshRow {
  hub_path: string;
  intro_variant_index: number;
  last_refreshed_at: string;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; row: RefreshRow | null }>();

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function getRefreshRow(hubPath: string): Promise<RefreshRow | null> {
  const entry = cache.get(hubPath);
  if (entry && Date.now() - entry.at < CACHE_TTL_MS) return entry.row;

  const sb = serviceClient();
  const { data } = await sb
    .from('seo_hub_refreshes')
    .select('hub_path, intro_variant_index, last_refreshed_at')
    .eq('hub_path', hubPath)
    .maybeSingle();
  const row = (data ?? null) as RefreshRow | null;
  cache.set(hubPath, { at: Date.now(), row });
  return row;
}

export function invalidateHubRefreshCache(hubPath?: string) {
  if (hubPath) cache.delete(hubPath);
  else cache.clear();
}

/**
 * Primary entry-point for hub pages. Returns:
 *   { intro: string, lastModifiedAt: string | null }
 *
 * `lastModifiedAt` is used by the sitemap to emit an accurate `lastmod`
 * when this hub has been refreshed, giving Google an explicit re-crawl
 * signal.
 */
export async function getHubIntro(
  hubType: HubType,
  hubPath: string,
  ctx: IntroContext,
): Promise<{ intro: string; lastModifiedAt: string | null; variantIndex: number }> {
  const row = await getRefreshRow(hubPath);
  const variantIndex = row?.intro_variant_index ?? 0;
  return {
    intro: renderIntro(hubType, variantIndex, ctx),
    lastModifiedAt: row?.last_refreshed_at ?? null,
    variantIndex,
  };
}
