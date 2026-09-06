/**
 * GET /api/admin/event-submissions
 *
 * Arbeitsliste der Event-Inserate für /admin/inserate.
 *
 * Query-Parameter:
 *   status  pending | approved | rejected   (Default: pending)
 *   limit   1–200                            (Default: 50)
 *   offset  Paginierung                      (Default: 0)
 *
 * Warum Service-Role statt des Session-Clients: die self-hosted PostgREST
 * kürzt jede Antwort still auf 1000 Zeilen und die Zählungen sollen auch
 * dann stimmen, wenn die RLS-Policy später enger gefasst wird. Der
 * Rollencheck steht vorher — `requireAdmin()` ist die Autorisierung, die
 * Service-Role nur der Transportweg.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/supabase/require-admin';

export const dynamic = 'force-dynamic';

const STATUSES = ['pending', 'approved', 'rejected'] as const;
type Status = (typeof STATUSES)[number];

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const statusRaw = searchParams.get('status') ?? 'pending';
  const status: Status = (STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as Status)
    : 'pending';
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1),
    200
  );
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('event_submissions')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[admin/event-submissions] list failed:', error);
    return NextResponse.json({ error: 'Laden fehlgeschlagen' }, { status: 500 });
  }

  // Zähler pro Status für die Tab-Leiste. `count: 'exact'` ist hier
  // unbedenklich: die Tabelle ist klein (Einreichungen, keine 280k Events).
  const counts: Record<Status, number> = { pending: 0, approved: 0, rejected: 0 };
  await Promise.all(
    STATUSES.map(async (s) => {
      const { count } = await supabase
        .from('event_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', s);
      counts[s] = count ?? 0;
    })
  );

  return NextResponse.json({ submissions: data ?? [], counts });
}
