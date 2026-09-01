/**
 * CTR-Auswertung der Search-Console-Daten (2026-09-01).
 *
 * Gemeinsame Quelle für die Admin-Ansicht (/api/admin/seo/live-pages) und
 * den täglichen Wächter (/api/cron/seo-ctr-watch) — beide sollen exakt
 * dieselben Zahlen zeigen.
 *
 * Der bestehende Tages-Snapshot reicht dafür nicht: er speichert nur die
 * Top-50-Seiten eines 28-Tage-Fensters, in dem abgelaufene Sommer-Feste
 * alles überdecken. Genau dadurch blieb monatelang unbemerkt, dass die
 * 2.849 Aktivitäts-URLs bei 20.492 Impressionen pro Woche nur 157 Klicks
 * einbrachten (0,8 % gegenüber 3,7 % bei den Gemeinde-Hubs).
 */

import { searchAnalytics } from '@/lib/seo/gsc';
import { classifyPage, GSC_SITE_URL, type HubType } from '@/lib/seo/snapshot';

export interface CtrSummary {
  impressions: number;
  clicks: number;
  pageCount: number;
  ctr: number;
  avgPosition: number;
}

export interface CtrPageRow {
  url: string;
  path: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  type: HubType;
  /** Nur bei Event-Seiten: Termin laut URL (YYYY-MM-DD). */
  eventDate: string | null;
  /** Nur bei Event-Seiten: liegt der Termin noch vor uns? */
  isFuture: boolean | null;
  /** Nur in ctrGap: geschätzte Klicks, die ein besseres Snippet holen würde. */
  missedClicks?: number;
  expectedCtr?: number;
}

export interface CtrFindings {
  window: { startDate: string; endDate: string; days: number };
  rowsReturned?: number;
  rowLimitHit?: boolean;
  totals: CtrSummary;
  byType: Record<string, CtrSummary>;
  events: { future: CtrSummary; past: CtrSummary };
  striking: CtrPageRow[];
  ctrGap: CtrPageRow[];
  topPages?: CtrPageRow[];
}

interface Bucket {
  impressions: number;
  clicks: number;
  pageCount: number;
  positionSum: number;
}

const emptyBucket = (): Bucket => ({ impressions: 0, clicks: 0, pageCount: 0, positionSum: 0 });

function summarize(b: Bucket): CtrSummary {
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
 * Übliche Klickrate je Position (grobe Kurve für organische Ergebnisse).
 * Dient allein dazu, Seiten zu finden, die klar unter dem liegen, was ihre
 * Position hergeben würde — keine Prognose.
 */
export function expectedCtr(position: number): number {
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

/**
 * Holt die Seitendaten der letzten `days` Tage und wertet sie aus.
 * Das Fenster endet bei heute-3, weil GSC rund zwei Tage Verzug hat und
 * unvollständige Tage die Quoten sonst nach unten ziehen.
 */
export async function collectCtrFindings(days = 7, rowLimit = 5000): Promise<CtrFindings> {
  const startDate = daysAgo(days + 3);
  const endDate = daysAgo(3);

  const rows = await searchAnalytics({
    siteUrl: GSC_SITE_URL,
    startDate,
    endDate,
    dimensions: ['page'],
    rowLimit,
  });

  const today = new Date().toISOString().slice(0, 10);
  const pages: CtrPageRow[] = [];
  const byTypeBuckets: Partial<Record<HubType, Bucket>> = {};
  const eventsFuture = emptyBucket();
  const eventsPast = emptyBucket();

  for (const r of rows) {
    const url = r.keys[0];
    let path = url;
    try {
      path = new URL(url).pathname;
    } catch { /* GSC liefert absolute URLs — defensiv trotzdem */ }

    const type = classifyPage(url);
    const dateMatch = path.match(/\/events\/[^/]+\/(\d{4}-\d{2}-\d{2})\//);
    const eventDate = dateMatch ? dateMatch[1] : null;
    const isFuture = eventDate ? eventDate >= today : null;

    pages.push({
      url, path,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      position: r.position,
      type, eventDate, isFuture,
    });

    const bucket = (byTypeBuckets[type] ??= emptyBucket());
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

  const striking = pages
    .filter((p) => p.position >= 4 && p.position <= 20 && p.impressions >= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 100);

  const ctrGap = pages
    .filter((p) => p.position <= 12 && p.impressions >= 50)
    .map((p) => {
      const exp = expectedCtr(p.position);
      return { ...p, expectedCtr: exp, missedClicks: Math.round((exp - p.ctr) * p.impressions) };
    })
    .filter((p) => (p.missedClicks ?? 0) >= 3)
    .sort((a, b) => (b.missedClicks ?? 0) - (a.missedClicks ?? 0))
    .slice(0, 100);

  const totals = summarize(
    Object.values(byTypeBuckets).reduce<Bucket>((acc, b) => {
      acc.impressions += b.impressions;
      acc.clicks += b.clicks;
      acc.pageCount += b.pageCount;
      acc.positionSum += b.positionSum;
      return acc;
    }, emptyBucket()),
  );

  return {
    window: { startDate, endDate, days },
    rowsReturned: rows.length,
    rowLimitHit: rows.length >= rowLimit,
    totals,
    byType: Object.fromEntries(
      Object.entries(byTypeBuckets)
        .map(([k, b]) => [k, summarize(b)] as const)
        .sort((a, b) => b[1].impressions - a[1].impressions),
    ),
    events: { future: summarize(eventsFuture), past: summarize(eventsPast) },
    striking,
    ctrGap,
    topPages: [...pages].sort((a, b) => b.impressions - a.impressions).slice(0, 100),
  };
}
