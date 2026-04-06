/**
 * Post-scrape hook: triggers the match-artists Edge Function
 * after scraper runs complete.
 *
 * Falls back gracefully if the Edge Function is not deployed or
 * environment variables are missing.
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.7
 */

const EDGE_FUNCTION_TIMEOUT_MS = 150_000; // 150s (Edge Function limit)

/**
 * Trigger the match-artists Edge Function via HTTP POST.
 * Non-blocking: logs result but does not throw on failure.
 */
export async function triggerMatchArtists(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.log('[post-scrape] Skipping match-artists: missing SUPABASE_URL or SERVICE_ROLE_KEY');
    return;
  }

  const url = `${supabaseUrl}/functions/v1/match-artists`;

  console.log('\n[post-scrape] Triggering artist-event matching pipeline...');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EDGE_FUNCTION_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ source: 'post-scrape-hook', timestamp: new Date().toISOString() }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const result = await response.json();
      console.log('[post-scrape] Match-artists completed:', {
        artists_checked: result.stats?.artists_checked,
        matches_found: result.stats?.matches_found,
        notifications_created: result.stats?.notifications_created,
        duration_ms: result.stats?.duration_ms,
      });
    } else {
      const errorText = await response.text().catch(() => 'unknown');
      console.error(`[post-scrape] Match-artists failed (HTTP ${response.status}):`, errorText);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[post-scrape] Match-artists timed out after 150s');
    } else {
      // Non-fatal: log and continue
      console.error('[post-scrape] Match-artists error (non-fatal):', error instanceof Error ? error.message : error);
    }
  }
}
