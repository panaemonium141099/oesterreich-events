/**
 * SEO snapshot — daily rollup of all KPIs into one JSON blob per day.
 *
 * Produced by `/api/cron/seo-daily-snapshot`, stored in `seo_snapshots`,
 * consumed by the admin dashboard trend widgets + the traffic-drop alerter.
 *
 * Shape is deliberately a single typed blob (not columns) so we can extend
 * the metric set additively without DB migrations. Missing fields in old
 * rows stay undefined — callers must tolerate that.
 *
 * The schema here is the *contract* between snapshot producer and the
 * dashboard/alerter consumers. When changing it, update all three in the
 * same commit.
 */

import { createClient } from '@supabase/supabase-js';
import { searchAnalytics, listSitemaps } from './gsc';
import { fetchVitalsSummary, type VitalsSummary } from './crux';

export const SITE_URL = 'https://lasstreffen.at';
/** GSC siteUrl property form — sc-domain for domain-level verification,
 *  otherwise the protocol+host. Domain-level gives us www + apex in one. */
export const GSC_SITE_URL = 'sc-domain:lasstreffen.at';

export interface SeoSnapshotMetrics {
  // ── Search Console, last-28-day window ending on the snapshot date ──
  gsc?: {
    windowStart: string;      // yyyy-mm-dd, inclusive
    windowEnd: string;        // yyyy-mm-dd, inclusive
    impressions: number;
    clicks: number;
    ctr: number;              // 0..1
    avgPosition: number;      // 1..n, lower is better
    topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
    topPages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>;
    byHubType: Record<HubType, {
      clicks: number;
      impressions: number;
      pageCount: number;      // distinct URLs in this hub-type with any impressions
    }>;
    sitemaps: Array<{ path: string; lastSubmitted?: string; indexedUrls?: number; submittedUrls?: number }>;
  };

  // ── Core Web Vitals — queried for the origin + one representative URL
  //    per hub-type. Pages with insufficient CrUX samples get null. ──
  cwv?: {
    origin: VitalsSummary | null;
    byHubType: Partial<Record<HubType, VitalsSummary | null>>;
  };

  // ── Internal DB counters — event catalog health ──
  internal?: {
    totalPublished: number;
    futurePublished: number;
    enrichedV3: number;
    sitemapUrlsGenerated: number;   // same count sitemap.xml would emit
    gemeindeHubsIndexable: number;  // gemeinden with ≥3 events (our noindex threshold)
  };

  // ── Traffic-drop alert baseline ──
  // Rolling 7-day clicks — alerter compares today vs 7-day avg.
  traffic?: {
    last24hClicks: number;
    rolling7dAvgClicks: number;
    rolling28dAvgClicks: number;
  };
}

export type HubType = 'event_detail' | 'gemeinde' | 'thema' | 'bundesland' | 'blog' | 'other';

/** URL → hub-type classifier. Matches against canonical URL shapes only. */
export function classifyPage(pagePath: string): HubType {
  try {
    const url = new URL(pagePath, SITE_URL);
    const path = url.pathname;
    if (path.startsWith('/events/')) return 'event_detail';
    if (path.startsWith('/gemeinde/')) return 'gemeinde';
    if (path.startsWith('/thema/')) return 'thema';
    if (path.startsWith('/blog/')) return 'blog';
    // Bundesland hubs are the nine top-level single-segment paths we control.
    const bl = path.match(/^\/(wien|niederoesterreich|oberoesterreich|steiermark|tirol|salzburg|kaernten|vorarlberg|burgenland)(\/|$)/);
    if (bl) return 'bundesland';
    return 'other';
  } catch {
    return 'other';
  }
}

// ─────────────────────────────────────────────────────────────────
// Snapshot builder — orchestrates the GSC + CrUX + DB queries
// ─────────────────────────────────────────────────────────────────

export interface BuildSnapshotOptions {
  /** yyyy-mm-dd — the snapshot's "today". Defaults to now (UTC). */
  snapshotDate?: string;
  /** If true, skip GSC + CrUX calls — useful for testing internals alone. */
  skipExternal?: boolean;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysAgo(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return isoDate(d);
}

export async function buildSnapshot(
  opts: BuildSnapshotOptions = {},
): Promise<SeoSnapshotMetrics> {
  const today = opts.snapshotDate ?? isoDate(new Date());
  const metrics: SeoSnapshotMetrics = {};

  // ── Internal DB counters ────────────────────────────────────────
  try {
    metrics.internal = await collectInternalMetrics();
  } catch (err) {
    console.error('[seo/snapshot] internal collection failed:', err);
  }

  if (opts.skipExternal) return metrics;

  // ── Search Console ──────────────────────────────────────────────
  try {
    metrics.gsc = await collectGscMetrics(today);
    if (metrics.gsc) {
      metrics.traffic = {
        last24hClicks: metrics.gsc.impressions > 0
          ? await trailingWindowClicks(today, 1)
          : 0,
        rolling7dAvgClicks: (await trailingWindowClicks(today, 7)) / 7,
        rolling28dAvgClicks: metrics.gsc.clicks / 28,
      };
    }
  } catch (err) {
    console.error('[seo/snapshot] GSC collection failed:', err);
  }

  // ── Core Web Vitals ─────────────────────────────────────────────
  try {
    metrics.cwv = await collectCwvMetrics();
  } catch (err) {
    console.error('[seo/snapshot] CrUX collection failed:', err);
  }

  return metrics;
}

// ─────────────────────────────────────────────────────────────────
// Sub-collectors
// ─────────────────────────────────────────────────────────────────

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function collectInternalMetrics(): Promise<SeoSnapshotMetrics['internal']> {
  const sb = serviceClient();
  const today = new Date().toISOString();

  const [{ count: totalPublished }, { count: futurePublished }, { count: enrichedV3 }] =
    await Promise.all([
      sb.from('events').select('*', { count: 'exact', head: true })
        .eq('publish_status', 'published'),
      sb.from('events').select('*', { count: 'exact', head: true })
        .eq('publish_status', 'published')
        .gte('start_date', today),
      sb.from('events').select('*', { count: 'exact', head: true })
        .eq('enrichment_version', 'v3'),
    ]);

  // Sitemap-eligible ≈ future published with quality_score ≥ 40.
  const { count: sitemapUrlsGenerated } = await sb
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('publish_status', 'published')
    .gte('start_date', today)
    .gte('quality_score', 40);

  // Gemeinden with ≥3 upcoming events — matches the noindex threshold in
  // the gemeinde-hub page builder. We count distinct (postal_code, city)
  // pairs with at least 3 future rows. Done via a raw SQL call because
  // PostgREST doesn't support GROUP BY + HAVING in the query builder.
  const { data: gemCountRow } = await sb
    .rpc('seo_count_indexable_gemeinde_hubs')
    .single<{ count: number }>();
  const gemeindeHubsIndexable = gemCountRow?.count ?? 0;

  return {
    totalPublished: totalPublished ?? 0,
    futurePublished: futurePublished ?? 0,
    enrichedV3: enrichedV3 ?? 0,
    sitemapUrlsGenerated: sitemapUrlsGenerated ?? 0,
    gemeindeHubsIndexable,
  };
}

async function collectGscMetrics(today: string): Promise<SeoSnapshotMetrics['gsc']> {
  const windowStart = daysAgo(28, new Date(today));
  const windowEnd = today;

  const [totals, queries, pages, sitemaps] = await Promise.all([
    searchAnalytics({
      siteUrl: GSC_SITE_URL,
      startDate: windowStart,
      endDate: windowEnd,
      dimensions: [],
      rowLimit: 1,
    }),
    searchAnalytics({
      siteUrl: GSC_SITE_URL,
      startDate: windowStart,
      endDate: windowEnd,
      dimensions: ['query'],
      rowLimit: 100,
    }),
    searchAnalytics({
      siteUrl: GSC_SITE_URL,
      startDate: windowStart,
      endDate: windowEnd,
      dimensions: ['page'],
      rowLimit: 250,
    }),
    listSitemaps(GSC_SITE_URL).catch(() => []),
  ]);

  const totalRow = totals[0];
  const agg = {
    clicks: totalRow?.clicks ?? 0,
    impressions: totalRow?.impressions ?? 0,
    ctr: totalRow?.ctr ?? 0,
    avgPosition: totalRow?.position ?? 0,
  };

  // ── By hub-type — classify each top-page row into bucket ──
  const byHubType: Record<HubType, { clicks: number; impressions: number; pageCount: number }> = {
    event_detail: { clicks: 0, impressions: 0, pageCount: 0 },
    gemeinde: { clicks: 0, impressions: 0, pageCount: 0 },
    thema: { clicks: 0, impressions: 0, pageCount: 0 },
    bundesland: { clicks: 0, impressions: 0, pageCount: 0 },
    blog: { clicks: 0, impressions: 0, pageCount: 0 },
    other: { clicks: 0, impressions: 0, pageCount: 0 },
  };
  for (const row of pages) {
    const page = row.keys[0];
    const bucket = byHubType[classifyPage(page)];
    bucket.clicks += row.clicks;
    bucket.impressions += row.impressions;
    bucket.pageCount += 1;
  }

  return {
    windowStart,
    windowEnd,
    ...agg,
    topQueries: queries.slice(0, 50).map(r => ({
      query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
    })),
    topPages: pages.slice(0, 50).map(r => ({
      page: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
    })),
    byHubType,
    sitemaps: sitemaps.map(s => ({
      path: s.path,
      lastSubmitted: s.lastSubmitted,
      indexedUrls: s.contents?.[0]?.indexed
        ? parseInt(String(s.contents[0].indexed), 10) : undefined,
      submittedUrls: s.contents?.[0]?.submitted
        ? parseInt(String(s.contents[0].submitted), 10) : undefined,
    })),
  };
}

async function trailingWindowClicks(endDate: string, days: number): Promise<number> {
  const start = daysAgo(days, new Date(endDate));
  const rows = await searchAnalytics({
    siteUrl: GSC_SITE_URL,
    startDate: start,
    endDate,
    dimensions: [],
    rowLimit: 1,
  });
  return rows[0]?.clicks ?? 0;
}

/** Representative URL per hub-type for CrUX per-type vitals. */
const CWV_SAMPLE_URLS: Record<Exclude<HubType, 'other'>, string> = {
  event_detail: `${SITE_URL}/`, // event pages are too numerous — skip in CrUX
  gemeinde: `${SITE_URL}/gemeinde/1010-wien`,
  thema: `${SITE_URL}/thema/musik`,
  bundesland: `${SITE_URL}/wien`,
  blog: `${SITE_URL}/blog`,
};

async function collectCwvMetrics(): Promise<SeoSnapshotMetrics['cwv']> {
  const origin = await fetchVitalsSummary({ origin: SITE_URL }).catch(() => null);

  const byHubType: Partial<Record<HubType, VitalsSummary | null>> = {};
  for (const [hub, url] of Object.entries(CWV_SAMPLE_URLS)) {
    if (hub === 'event_detail') continue; // skip — individual event pages have no CrUX data
    try {
      byHubType[hub as HubType] = await fetchVitalsSummary({ url });
    } catch {
      byHubType[hub as HubType] = null;
    }
  }
  return { origin, byHubType };
}

// ─────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────

export async function writeSnapshot(
  snapshotDate: string,
  metrics: SeoSnapshotMetrics,
): Promise<void> {
  const sb = serviceClient();
  const { error } = await sb
    .from('seo_snapshots')
    .upsert({ snapshot_date: snapshotDate, metrics, collected_at: new Date().toISOString() });
  if (error) {
    throw new Error(`[seo/snapshot] write failed: ${error.message}`);
  }
}

export async function readSnapshot(snapshotDate: string): Promise<SeoSnapshotMetrics | null> {
  const sb = serviceClient();
  const { data } = await sb
    .from('seo_snapshots')
    .select('metrics')
    .eq('snapshot_date', snapshotDate)
    .maybeSingle();
  return (data?.metrics as SeoSnapshotMetrics | undefined) ?? null;
}

export async function readLatestSnapshot(): Promise<{ date: string; metrics: SeoSnapshotMetrics } | null> {
  const sb = serviceClient();
  const { data } = await sb
    .from('seo_snapshots')
    .select('snapshot_date, metrics')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { date: data.snapshot_date as string, metrics: data.metrics as SeoSnapshotMetrics };
}

export async function readSnapshotRange(
  startDate: string,
  endDate: string,
): Promise<Array<{ date: string; metrics: SeoSnapshotMetrics }>> {
  const sb = serviceClient();
  const { data } = await sb
    .from('seo_snapshots')
    .select('snapshot_date, metrics')
    .gte('snapshot_date', startDate)
    .lte('snapshot_date', endDate)
    .order('snapshot_date', { ascending: true });
  return (data ?? []).map(r => ({
    date: r.snapshot_date as string,
    metrics: r.metrics as SeoSnapshotMetrics,
  }));
}
