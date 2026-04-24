import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from './server';

/**
 * Server-side admin gate for API routes under /api/admin/*.
 *
 * The codebase already had this exact helper inlined into 14 different
 * route files (all byte-identical). This module is the canonical single
 * source of truth — future admin routes import from here instead of
 * re-inlining.
 *
 * Two flavors on purpose:
 *
 *   `requireAdmin()`
 *     Drop-in replacement for the old inline helper. Returns either a
 *     NextResponse error (401/403) that the caller should return as-is,
 *     or `null` on success. Most admin routes only need to gate access
 *     and don't care who the caller is.
 *
 *   `requireAdminWithCaller()`
 *     For routes that need to make decisions based on the caller's role
 *     (e.g. only god can delete other god users, or the caller should
 *     never be able to mutate their own row). Returns a discriminated
 *     union so TypeScript forces the "error vs ok" check.
 *
 * "Admin" here means the caller's `profiles.role` is in the set
 *   ['god', 'admin']
 * — the same set every previous inline helper used. Changing that set
 * in one place now applies everywhere.
 *
 * Usage — the simple case:
 *   export async function POST(req: NextRequest) {
 *     const authError = await requireAdmin();
 *     if (authError) return authError;
 *     // …admin-only logic
 *   }
 *
 * Usage — when you need the caller's identity:
 *   export async function DELETE(req: NextRequest, { params }) {
 *     const auth = await requireAdminWithCaller();
 *     if ('error' in auth) return auth.error;
 *     const { caller } = auth;
 *     if (params.id === caller.id) {
 *       return NextResponse.json({ error: 'no self' }, { status: 400 });
 *     }
 *     // …
 *   }
 */

export type AdminCaller = { id: string; role: 'god' | 'admin' };

/**
 * Returns a NextResponse to send on auth failure, or `null` when the
 * caller is an authenticated admin/god. Shape preserved exactly so
 * existing call-sites (`const authError = await requireAdmin(); if
 * (authError) return authError;`) keep working unchanged.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const result = await checkAdmin();
  if ('error' in result) return result.error;
  return null;
}

/**
 * Like requireAdmin() but also hands back the caller's id + role on
 * success. Use when the route needs to authorize based on who is
 * making the call (self-delete guards, role-gated escalation, etc).
 */
export async function requireAdminWithCaller(): Promise<
  | { error: NextResponse }
  | { caller: AdminCaller }
> {
  return checkAdmin();
}

// ─────────────────────────────────────────────────────────────────
// Internal — does the actual work, both exports thin-wrap this.
// ─────────────────────────────────────────────────────────────────

async function checkAdmin(): Promise<
  | { error: NextResponse }
  | { caller: AdminCaller }
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
  return { caller: { id: user.id, role: profile.role as 'god' | 'admin' } };
}
