import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/seo/experiment-impression
 *
 * Public endpoint — writes one row to `seo_experiment_impressions`.
 * Called by the `<ExperimentImpressionLogger>` client island on every
 * hub-page mount that resolved a live experiment.
 *
 * **Why no auth**: experiment impressions are a count signal, not
 * sensitive data. We deliberately don't gate this, otherwise server-
 * rendered first-page-loads from fresh browsers couldn't log (no
 * session yet).
 *
 * **Rate-limiting**: not implemented at the route level. The impression
 * rows are cheap, and the client island only fires once per page
 * mount. A malicious client could spam this, but the downside is
 * corrupt experiment metrics — not a security issue — and the admin
 * UI shows raw counts so anomalies are visible.
 *
 * Body shape: `{ experimentId: string, variant: 'A'|'B', path: string }`
 */

export const dynamic = 'force-dynamic';

interface ImpressionBody {
  experimentId?: string;
  variant?: 'A' | 'B';
  path?: string;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  let body: ImpressionBody;
  try {
    body = (await request.json()) as ImpressionBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { experimentId, variant, path } = body;
  if (
    typeof experimentId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(experimentId)
    || (variant !== 'A' && variant !== 'B')
    || typeof path !== 'string'
    || path.length > 200
  ) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const sb = serviceClient();
  const { error } = await sb.from('seo_experiment_impressions').insert({
    experiment_id: experimentId,
    variant,
    path: path.slice(0, 200),
  });

  if (error) {
    // FK violation (experiment was concluded + deleted between server
    // render and client mount) or unknown DB issue. Return 204-style
    // silent-success for FK errors so the client doesn't retry.
    if (error.code === '23503') {
      return NextResponse.json({ success: false, stale: true });
    }
    console.error('[experiment-impression] insert failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
