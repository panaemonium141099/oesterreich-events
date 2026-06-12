import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Admin gate for all /api/admin/outreach routes. Returns a service-role db
 * client (bypasses the outreach tables' RLS) on success, or a 401/403 to
 * return directly. Auth = same profiles.role check as other admin routes.
 */
export async function requireAdminDb(): Promise<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { error: NextResponse } | { db: SupabaseClient<any>; userId: string }
> {
  const auth = await createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: profile } = await auth.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['god', 'admin'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  return { db, userId: user.id };
}
