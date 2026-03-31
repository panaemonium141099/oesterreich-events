import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';

// Simple in-memory rate limiting (per session per minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(sessionId, { count: 1, resetAt: now + 60_000 });
    return false;
  }

  entry.count++;
  if (entry.count > 100) return true;
  return false;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data, page, referrer } = body;

    if (!type || typeof type !== 'string') {
      return NextResponse.json({ error: 'Missing event type' }, { status: 400 });
    }

    // Get session ID from body or generate one
    const sessionId = body.sessionId || 'unknown';

    // Rate limit
    if (isRateLimited(sessionId)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    // Hash IP for privacy
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const ipHash = createHash('sha256').update(ip + '_analytics_salt').digest('hex').slice(0, 16);

    const userAgent = request.headers.get('user-agent') || undefined;

    // Get authenticated user (if any)
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('analytics_events').insert({
      user_id: user?.id || null,
      session_id: sessionId,
      event_type: type,
      event_data: data || {},
      page: page || null,
      referrer: referrer || null,
      user_agent: userAgent || null,
      ip_hash: ipHash,
    });

    if (error) {
      console.error('Analytics insert error:', error);
      return NextResponse.json({ error: 'Failed to store event' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Analytics API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
