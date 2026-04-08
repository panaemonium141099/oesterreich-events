import { NextRequest, NextResponse } from 'next/server';
import { trackInteraction, checkRateLimit } from '@/lib/interactions';
import type { InteractionType } from '@/lib/interactions';

export const dynamic = 'force-dynamic';

const VALID_TYPES: ReadonlySet<string> = new Set([
  'view',
  'save',
  'reminder_set',
  'share',
  'click_ticket',
  'click_source',
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params;

  // Rate limit by IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 },
    );
  }

  // Parse body
  let body: { type?: string; metadata?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const { type, metadata } = body;

  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.json(
      { error: `Invalid interaction type. Must be one of: ${Array.from(VALID_TYPES).join(', ')}` },
      { status: 400 },
    );
  }

  // userId could come from auth header in the future; for now nullable
  const userId: string | null = null;

  await trackInteraction(eventId, userId, type as InteractionType, metadata);

  return NextResponse.json({ ok: true });
}
