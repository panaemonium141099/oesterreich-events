import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  // ── Admin auth (same pattern as /api/admin/analytics) ──
  const authClient = await createServerSupabaseClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await authClient
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['god', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Data (service role — outreach_prospects has RLS enabled, no policies) ──
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const kind = searchParams.get('kind');

  let q = supabase
    .from('outreach_prospects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (status) q = q.eq('status', status);
  if (kind) q = q.eq('kind', kind);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospects: data ?? [] });
}
