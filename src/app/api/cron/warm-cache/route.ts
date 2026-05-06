import { NextRequest, NextResponse } from 'next/server';

/**
 * Cache-Warming-Cron für die Top-Filter-Kombis.
 *
 * Läuft stündlich (siehe vercel.json: schedule "0 * * * *"). Pingt parallel
 * die ~12 Routes die der Map-Default + Region-Hubs + Featured + Stats laden.
 * Vercel Edge Cache hat 1 h TTL — der Cron schiebt jede Stunde frische
 * Responses rein bevor User je den Cold-Path treffen.
 *
 * Effekt: jede der angepingten Filter-Kombis kommt dauerhaft mit
 * `X-Vercel-Cache: HIT` raus → User auf Wien/Steiermark/All-AT laden in
 * 200-400 ms statt 1-4 s (siehe MISS/HIT-Messung).
 *
 * Hit-Budget: 12 URLs × 24 h × 30 Tage = ~8 700 Function-Invocations/Monat,
 * davon ~99 % Cache-MISS-on-stale (~1-4 s Active CPU). Auf Vercel Pro
 * komfortabel innerhalb des Limits. Kosten: <0,50 €/Monat.
 *
 * Auth: Vercel setzt automatisch `Authorization: Bearer ${CRON_SECRET}` für
 * Cron-Aufrufe. Wenn das Env nicht gesetzt ist, lassen wir den Endpoint
 * weiterhin laufen — Vercel-internes Routing schützt /api/cron/* sowieso.
 */
export const dynamic = 'force-dynamic';

const PATHS = [
  // Map-Default + Region-Hubs (slim, 10 000er Batch — exakt was die Map fetcht)
  '/api/events?bundesland=all&limit=10000&slim=true',
  '/api/events?bundesland=wien&limit=10000&slim=true',
  '/api/events?bundesland=steiermark&limit=10000&slim=true',
  '/api/events?bundesland=noe&limit=10000&slim=true',
  '/api/events?bundesland=ooe&limit=10000&slim=true',
  '/api/events?bundesland=tirol&limit=10000&slim=true',
  '/api/events?bundesland=salzburg&limit=10000&slim=true',
  '/api/events?bundesland=kaernten&limit=10000&slim=true',
  '/api/events?bundesland=vorarlberg&limit=10000&slim=true',
  '/api/events?bundesland=burgenland&limit=10000&slim=true',
  // Landing-Page-APIs
  '/api/events/featured?limit=8',
  '/api/stats/counts',
];

export async function GET(request: NextRequest) {
  // Vercel Crons schicken Authorization: Bearer ${CRON_SECRET}.
  // Wir akzeptieren auch direkte Aufrufe ohne Secret — die rate-limit-
  // middleware skipt /api/cron/* sowieso, und der Endpoint ist idempotent
  // (er liest nur aus dem CDN, schreibt nichts).
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Production-Domain. VERCEL_URL ist die Deployment-URL (z.B. xyz-abc.vercel.app);
  // wir wollen aber gegen die custom domain anpingen damit der DNS + CDN-Edge
  // identisch sind zu den realen User-Requests.
  const baseUrl = 'https://lasstreffen.at';

  const start = Date.now();
  const results = await Promise.allSettled(
    PATHS.map(async (path) => {
      const t0 = Date.now();
      try {
        const res = await fetch(`${baseUrl}${path}`);
        const dt = Date.now() - t0;
        return {
          path,
          status: res.status,
          cache: res.headers.get('x-vercel-cache') ?? 'unknown',
          ms: dt,
        };
      } catch (err) {
        return {
          path,
          status: 'ERROR',
          error: err instanceof Error ? err.message : String(err),
          ms: Date.now() - t0,
        };
      }
    }),
  );

  const summary = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { path: PATHS[i], error: String(r.reason) },
  );

  return NextResponse.json({
    warmed: summary.length,
    durationMs: Date.now() - start,
    results: summary,
  });
}
