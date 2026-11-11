/**
 * GET /api/cron/revalidate-landing
 *
 * Baut die Startseite (`/` und `/en`, ISR revalidate 3600) neu. Läuft um
 * 00:05 Europe/Vienna über den systemd-Timer `lt-cron@revalidate-landing`
 * auf Hetzner (curl auf 127.0.0.1:3000 mit Bearer CRON_SECRET), damit die
 * Tagesausgabe nach Mitternacht den neuen Wiener Tag zeigt: Datumszeile,
 * Tipp des Tages (landing_features kind = sponsored), Programm „Heute Abend“.
 *
 * Auth: Bearer CRON_SECRET ist Pflicht. Ohne gesetztes Secret antwortet die
 * Route mit 401 (fail closed), sonst könnte jeder den ISR-Cache leeren.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LANDING_PATHS, revalidateLanding } from '@/lib/landing/revalidate-landing';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  revalidateLanding();
  return NextResponse.json({ ok: true, revalidated: [...LANDING_PATHS], at: new Date().toISOString() });
}
