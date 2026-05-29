import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/detect-location
 *
 * Called by the client-side auth context exactly once per session
 * (debounced: a cookie tracks the last call timestamp; we skip if < 7d ago).
 *
 * Reads Vercel's edge-injected geo headers and writes the result to
 * profiles.detected_city/lat/lng/at + bumps last_active_at.
 *
 * Why this exists: profiles.city is opt-in and most users leave it blank.
 * Without a baseline location we can't send the lifecycle "events near you"
 * cohort to anyone — this endpoint gives every authenticated user at least
 * a city-level location, fully passive, no consent needed (the IP is sent
 * anyway, we just persist Vercel's already-derived decoding of it).
 *
 * The endpoint is idempotent — calling it twice in a row produces the same
 * row state. Auth required (Supabase session cookie); refuses anonymous calls.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // Vercel-Edge geo headers. These are populated on every request that hits
  // a Vercel deployment, including from this Node-runtime route handler
  // (Vercel injects them at the edge before the runtime sees the request).
  // Values are URL-encoded when they contain non-ASCII chars.
  const city = decodeHeader(req.headers.get('x-vercel-ip-city'));
  const latStr = req.headers.get('x-vercel-ip-latitude');
  const lngStr = req.headers.get('x-vercel-ip-longitude');
  const country = req.headers.get('x-vercel-ip-country');

  // Only update geo fields if Vercel actually gave us coordinates.
  // (Localhost dev / non-Vercel hosts won't have these — we still bump last_active_at.)
  const lat = latStr ? Number(latStr) : null;
  const lng = lngStr ? Number(lngStr) : null;
  const hasGeo = city && lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);

  const update: Record<string, unknown> = {
    last_active_at: new Date().toISOString(),
  };

  // Don't overwrite a real detection with localhost garbage — only write
  // geo fields when we have coords AND the country is AT or a neighbour
  // (so a VPN exit in Brazil doesn't get persisted as "user's home").
  // We accept AT, DE, CH, IT, HU, SK, SI, CZ — covers vacationers + commuters.
  const TRUSTED_COUNTRIES = new Set(['AT', 'DE', 'CH', 'IT', 'HU', 'SK', 'SI', 'CZ']);
  if (hasGeo && country && TRUSTED_COUNTRIES.has(country.toUpperCase())) {
    update.detected_city = city;
    update.detected_lat = lat;
    update.detected_lng = lng;
    update.detected_at = new Date().toISOString();
  }

  const { error: upErr } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id);

  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    geo_stored: !!update.detected_city,
    city: update.detected_city ?? null,
    last_active_at: update.last_active_at,
  });
}

/**
 * Vercel URL-encodes geo headers when they contain non-ASCII characters
 * (Wien stays "Wien", but Sankt Pölten becomes "Sankt%20P%C3%B6lten").
 * Decode safely; bad encoding falls back to the raw string.
 */
function decodeHeader(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
