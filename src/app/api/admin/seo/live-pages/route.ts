import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { collectCtrFindings } from '@/lib/seo/ctr-findings';

/**
 * GET /api/admin/seo/live-pages?days=7&rows=5000
 *
 * Live-Auswertung direkt aus der Search-Console — bewusst neben
 * /api/admin/seo/pages (das den Tages-Snapshot liest, und der hält nur
 * die Top-50-Seiten eines 28-Tage-Fensters fest).
 *
 * Die Auswertung selbst lebt in lib/seo/ctr-findings.ts, damit diese
 * Ansicht und der tägliche Wächter (/api/cron/seo-ctr-watch) garantiert
 * dieselben Zahlen zeigen.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '7', 10) || 7, 1), 90);
  const rows = Math.min(Math.max(parseInt(searchParams.get('rows') ?? '5000', 10) || 5000, 100), 25000);

  try {
    return NextResponse.json(await collectCtrFindings(days, rows));
  } catch (err) {
    return NextResponse.json(
      {
        error: 'GSC-Abfrage fehlgeschlagen',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
