import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * DELETE /api/admin/users/[id] — remove a user from the system completely.
 *
 * Why this route exists:
 *   The admin/users page previously tried
 *     `supabase.from('profiles').delete().eq('id', userId)`
 *   from the client. That call used the anon key, and `profiles` had no
 *   DELETE policy, so RLS silently blocked every attempt. Even if we
 *   added an admin-delete RLS policy on profiles, deleting only the
 *   profile row leaves the auth.users entry intact — the user could
 *   sign back in and a new profile would be auto-created on first
 *   login, effectively making the delete a no-op.
 *
 *   The clean fix is to delete `auth.users`, which cascades via
 *   `profiles.id → auth.users(id) ON DELETE CASCADE` (and ~30 downstream
 *   FKs that cascade from profiles). Only `supabase.auth.admin.deleteUser()`
 *   on a service-role client can do this — hence this server route.
 *
 * Safeguards:
 *   - Caller must be admin/god (same pattern as /api/admin/dedup/... etc).
 *   - Self-delete is blocked (prevents accidentally locking yourself out).
 *   - Deleting a 'god' user requires the caller to be 'god' as well, so
 *     an admin can't escalate to "nuke the owner".
 *
 * Returns:
 *   200 { success: true } on success
 *   400 on bad id
 *   401 Unauthorized / 403 Forbidden
 *   404 if target profile does not exist
 *   500 on unexpected failure
 */

/** Verify the caller is an authenticated admin/god user. Returns either the caller's
 *  profile (with id + role) on success, or a NextResponse error to return. */
async function requireAdmin(): Promise<
  | { error: NextResponse }
  | { caller: { id: string; role: string } }
> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['god', 'admin'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { caller: { id: user.id, role: profile.role } };
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin();
    if ('error' in auth) return auth.error;
    const { caller } = auth;

    const { id } = await params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
    }

    // Safeguard 1: self-delete
    if (id === caller.id) {
      return NextResponse.json(
        { error: 'Du kannst dich nicht selbst löschen.' },
        { status: 400 },
      );
    }

    // Read the target profile (role check + existence) via the user-scoped
    // client — Profile.SELECT policy is `true`, so this works without
    // needing service role.
    const userClient = await createServerSupabaseClient();
    const { data: target } = await userClient
      .from('profiles')
      .select('id, role, first_name, last_name')
      .eq('id', id)
      .single();

    if (!target) {
      return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 });
    }

    // Safeguard 2: only god can delete god
    if (target.role === 'god' && caller.role !== 'god') {
      return NextResponse.json(
        { error: 'Nur ein god-User kann andere god-User löschen.' },
        { status: 403 },
      );
    }

    // Spin up the service-role client for `auth.admin.deleteUser` — the
    // only auth API that actually removes the user from auth.users.
    // FK CASCADE (`profiles.id → auth.users(id) ON DELETE CASCADE`)
    // takes care of the profile row + every downstream table.
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceUrl || !serviceKey) {
      console.error('[admin/users DELETE] SUPABASE_SERVICE_ROLE_KEY is missing');
      return NextResponse.json(
        { error: 'Server not configured for admin operations' },
        { status: 500 },
      );
    }
    const serviceClient = createClient(serviceUrl, serviceKey);

    const { error: delErr } = await serviceClient.auth.admin.deleteUser(id);
    if (delErr) {
      console.error('[admin/users DELETE] auth.admin.deleteUser failed:', delErr);
      return NextResponse.json(
        { error: delErr.message || 'Löschen fehlgeschlagen' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err) {
    console.error('[admin/users DELETE] unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
