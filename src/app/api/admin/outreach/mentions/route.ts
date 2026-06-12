import { NextResponse } from 'next/server';
import { requireAdminDb } from '@/lib/outreach/admin-guard';

export async function GET() {
  const guard = await requireAdminDb();
  if ('error' in guard) return guard.error;
  const { db } = guard;

  const { data, error } = await db
    .from('outreach_mentions')
    .select('*')
    .order('is_new', { ascending: false })
    .order('first_seen', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mentions: data ?? [] });
}
