import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { searchAnalytics } from '@/lib/seo/gsc';
import { classifyPage, GSC_SITE_URL, type HubType } from '@/lib/seo/snapshot';

/**
 * GET /api/admin/seo/live-pages?days=7&rows=5000
 *
 * Live-Auswertung direkt aus der Search-Console — bewusst NEBEN
 * /api/admin/seo/pages (das den Tages-Snapshot liest).
 *
 * Warum eine eigene Route (Befund 2026-09-01): der Snapshot speichert nur
 * die Top-50-Seiten eines 28-Tage-Fensters. Darin dominieren die
 * abgelaufenen Sommer-Feste so stark, dass alles andere unsichtbar wird —
 * inklusive der 2.849 Aktivitaets-URLs, die pro Woche gut 20.000
 * Impressionen sammeln. Diese Route zieht bis zu 5.000 Zeilen eines frei
 * waehlbaren Fensters und beantwortet drei Fragen, die der Snapshot nicht
 * beantworten kann:
 *
 *   1. Wie verteilt sich die Nachfrage auf die Seitentypen? (byType)
 *   2. Bei Event-Seiten: laeuft die Nachfrage auf Termine, die noch
 *      STATTFINDEN, oder auf vergangene? (events.future / events.past)
 *   3. Wo steht viel Sichtbarkeit einer schlechten Klickrate gegenueber?
 *      (striking = Position 4-20, ctrGap = gute Position, magere CTR)
 *
 * GSC liefert Daten mit ~2 Tagen Verzug; das Fenster endet deshalb bei
 * heute-3, damit keine unvollstaendigen Tage die Quoten verzerren.
 */
export const dynamic = 'force-dynamic';

interface PageRow {
  url: string;
  path: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  type: HubType;
  /** Nur bei Event-Seiten: Termin laut URL (YYYY-MM-DD). */
  eventDate: string | null;
  /** Nur bei Event-Seiten: Termin liegt in der Zukunft. */
  isFuture: boolean | null;
}

interface Bucket {
  impressions: number;
  clicks: number;
  pageCount: number;
  positionSum: number;
}

const emptyBucket = (): Bucket => ({ impressions: 0, clicks: 0, pageCount: 0, positionSum: 0 });

function summarize(b: Bucket) {
  return {
    impressions: b.impressions,
    clicks: b.clicks,
    pageCount: b.pageCount,
    ctr: b.impressions > 0 ? b.clicks / b.impressions : 0,
    avgPosition: b.pageCount > 0 ? b.positionSum / b.pageCount : 0,
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Erwartete Klickrate je Position (grobe Branchenkurve für organische
 * Ergebnisse). Dient nur dazu, Seiten zu finden, die deutlich unter dem
 * liegen, was ihre Position hergeben würde — keine exakte Prognose.
 */
function expectedCtr(position: number): number {
  if (position < 1.5) return 0.28;
  if (position < 2.5) return 0.15;
  if (position < 3.5) return 0.10;
  if (position < 5) return 0.07;
  if (position < 7) return 0.045;
  if (position < 9) return 0.03;
  if (position < 11) return 0.022;
  if (position < 16) return 0.014;
  if (position < 21) return 0.009;
  return 0.005;
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '7', 10) || 7, 1), 90);
  const rowLimit = Math.min(Math.max(parseInt(searchParams.get('rows') ?? '5000', 10) || 5000, 100), 25000);

  const startDate = daysAgo(days + 3);
  const endDate = daysAgo(3);

  let rows;
  try {
    rows = await searchAnalytics({
      siteUrl: GSC_SITE_URL,
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'GSC-Abfrage fehlgeschlagen',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const pages: PageRow[] = [];
  const byType: Partial<Record<HubType, Bucket>> = {};
  const eventsFuture = emptyBucket();
  const eventsPast = emptyBucket();

  for (const r of rows) {
    const url = r.keys[0];
    let path = url;
    try {
      path = new URL(url).pathname;
    } catch { /* GSC liefert immer absolute URLs — defensiv trotzdem */ }

    const type = classifyPage(url);
    const dateMatch = path.match(/\/events\/[^/]+\/(\d{4}-\d{2}-\d{2})\//);
    const eventDate = dateMatch ? dateMatch[1] : null;
    const isFuture = eventDate ? eventDate >= today : null;

    const row: PageRow = {
      url,
      path,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      position: r.position,
      type,
      eventDate,
      isFuture,
    };
    pages.push(row);

    const bucket = (byType[type] ??= emptyBucket());
    bucket.impressions += r.impressions;
    bucket.clicks += r.clicks;
    bucket.pageCount += 1;
    bucket.positionSum += r.position;

    if (isFuture !== null) {
      const evb = isFuture ? eventsFuture : eventsPast;
      evb.impressions += r.impressions;
      evb.clicks += r.clicks;
      evb.pageCount += 1;
      evb.positionSum += r.position;
    }
  }

  // Striking Distance: erreichbare Positionen mit relevanter Nachfrage.
  // Zukuenftige Events zuerst — dort wirkt jede Verbesserung noch, bevor
  // der Termin verstreicht.
  const striking = pages
    .filter((p) => p.position >= 4 && p.position <= 20 && p.impressions >= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 100);

  // CTR-Luecke: gute Position, aber deutlich weniger Klicks als ueblich —
  // hier zahlen bessere Titel/Snippets sofort ein, ohne Rankinggewinn.
  const ctrGap = pages
    .filter((p) => p.position <= 12 && p.impressions >= 50)
    .map((p) => {
      const exp = expectedCtr(p.position);
      return { ...p, expectedCtr: exp, missedClicks: Math.round((exp - p.ctr) * p.impressions) };
    })
    .filter((p) => p.missedClicks >= 3)
    .sort((a, b) => b.missedClicks - a.missedClicks)
    .slice(0, 100);

  return NextResponse.json({
    window: { startDate, endDate, days },
    rowsReturned: rows.length,
    rowLimitHit: rows.length >= rowLimit,
    totals: summarize(
      Object.values(byType).reduce<Bucket>((acc, b) => {
        acc.impressions += b.impressions;
        acc.clicks += b.clicks;
        acc.pageCount += b.pageCount;
        acc.positionSum += b.positionSum;
        return acc;
      }, emptyBucket()),
    ),
    byType: Object.fromEntries(
      Object.entries(byType)
        .map(([k, b]) => [k, summarize(b)])
        .sort((a, b) => (b[1] as { impressions: number }).impressions - (a[1] as { impressions: number }).impressions),
    ),
    events: { future: summarize(eventsFuture), past: summarize(eventsPast) },
    striking,
    ctrGap,
    topPages: [...pages].sort((a, b) => b.impressions - a.impressions).slice(0, 100),
  });
}
