import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { invalidateExperimentsCache } from '@/lib/seo/experiments-server';

/**
 * Admin CRUD for SEO experiments.
 *
 *   GET  /api/admin/seo/experiments            list all
 *   POST /api/admin/seo/experiments            create
 *
 * Conclusion/pause lives on the [id] route.
 *
 * Creates auto-start as `running`. Admin can pause via PATCH. DB-level
 * CHECK constraints validate scope/status so we trust the client less.
 */
export const dynamic = 'force-dynamic';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const sb = serviceClient();
  const { data, error } = await sb
    .from('seo_experiments')
    .select('*')
    .order('started_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ experiments: data ?? [] });
}

interface CreateBody {
  name?: string;
  scope?: 'gemeinde' | 'thema' | 'bundesland' | 'event_detail';
  variant_a?: Record<string, unknown>;
  variant_b?: Record<string, unknown>;
  split_b_pct?: number;
  notes?: string;
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const errors: string[] = [];
  if (!body.name || typeof body.name !== 'string') errors.push('name required');
  if (!body.scope || !['gemeinde', 'thema', 'bundesland', 'event_detail'].includes(body.scope)) {
    errors.push('scope must be gemeinde|thema|bundesland|event_detail');
  }
  if (!body.variant_a || typeof body.variant_a !== 'object') errors.push('variant_a must be object');
  if (!body.variant_b || typeof body.variant_b !== 'object') errors.push('variant_b must be object');
  if (errors.length) {
    return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
  }

  const sb = serviceClient();
  const { data, error } = await sb
    .from('seo_experiments')
    .insert({
      name: body.name,
      scope: body.scope,
      variant_a: body.variant_a,
      variant_b: body.variant_b,
      split_b_pct: body.split_b_pct ?? 50,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidateExperimentsCache(body.scope);
  return NextResponse.json({ experiment: data }, { status: 201 });
}
