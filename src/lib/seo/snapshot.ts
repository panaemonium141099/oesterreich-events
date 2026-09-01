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
    gemeindeHubsIndexable?: number; // gemeinden with ≥3 events (our noindex threshold) — optional, seit 2026-07-08 nicht mehr täglich erhoben (siehe collectInternalMetrics)
  };

  // ── Traffic-drop alert baseline ──
  // Rolling 7-day clicks — alerter compares today vs 7-day avg.
  traffic?: {
    last24hClicks: number;
    rolling7dAvgClicks: number;
    rolling28dAvgClicks: number;
  };
}

export type HubType =
  | 'event_detail'
  | 'aktivitaet'
  | 'gemeinde'
  | 'thema'
  | 'bundesland'
  | 'blog'
  | 'other';

/** URL → hub-type classifier. Matches against canonical URL shapes only. */
export function classifyPage(pagePath: string): HubType {
  try {
    const url = new URL(pagePath, SITE_URL);
    const path = url.pathname;
    if (path.startsWith('/events/')) return 'event_detail';
    // fn-18-Bestand: 2.849 Aktivitaets-URLs sammelten 20.492 Impressionen
    // pro Woche und liefen bis 2026-09-01 unsichtbar unter 'other' mit.
    if (path.startsWith('/aktivitaet/') || path.startsWith('/aktivitaeten')) return 'aktivitaet';
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

/**
 * Race a collector against a hard deadline. On timeout it resolves to
 * `fallback` (never rejects) and logs — so a slow/hung sub-step can NEVER
 * burn the whole 60s Vercel budget before writeSnapshot() runs.
 *
 * Root cause 2026-04-29 (seo_snapshots brach still ab): collectInternalMetrics
 * lief als Erstes mit 4× `count exact` (Full-Scans à 10–30s auf 304k Zeilen)
 * + einer teuren GROUP-BY-RPC → die Funktion lief ins 60s-Limit BEVOR der
 * Snapshot geschrieben wurde. Fix hier: harte Deadlines + externe Daten
 * zuerst + billige `planned`-Counts (siehe collectInternalMetrics).
 *
 * NB: Promise.race bricht die zugrundeliegende DB/HTTP-Arbeit nicht ab
 * (sie läuft im Hintergrund aus) — wir hören nur auf zu warten. Für einen
 * kurzlebigen Cron-Prozess ist das ok.
 */
function withDeadline<T>(p: Promise<T>, ms: number, label: string, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.error(`[seo/snapshot] ${label} exceeded ${ms}ms deadline — fallback`);
      resolve(fallback);
    }, ms);
  });
  return Promise.race([
    p.catch((err) => {
      console.error(`[seo/snapshot] ${label} failed:`, err);
      return fallback;
    }),
    deadline,
    // clearTimeout on settle: sonst feuert der Timer später ein falsches
    // "exceeded deadline"-Log und hält den Prozess unnötig am Leben.
  ]).finally(() => clearTimeout(timer));
}

export async function buildSnapshot(
  opts: BuildSnapshotOptions = {},
): Promise<SeoSnapshotMetrics> {
  const today = opts.snapshotDate ?? isoDate(new Date());
  const metrics: SeoSnapshotMetrics = {};

  // External data FIRST (highest value: search traffic + web vitals) and
  // each stage hard-deadlined. Sum of worst-case deadlines (12+12+12+12 =
  // 48s) stays comfortably under the 60s Vercel function limit so
  // writeSnapshot() in the caller always runs.
  if (!opts.skipExternal) {
    // ── Search Console (+ derived traffic baseline) ───────────────
    const gsc = await withDeadline(collectGscMetrics(today), 12_000, 'gsc', undefined);
    if (gsc) {
      metrics.gsc = gsc;
      metrics.traffic = await withDeadline(collectTraffic(today, gsc), 12_000, 'traffic', undefined);
    }

    // ── Core Web Vitals ───────────────────────────────────────────
    metrics.cwv = await withDeadline(collectCwvMetrics(), 12_000, 'cwv', undefined);
  }

  // ── Internal DB counters LAST — cheap planned counts, deadlined ──
  metrics.internal = await withDeadline(collectInternalMetrics(), 12_000, 'internal', undefined);

  return metrics;
}

/** Derived traffic baseline from GSC. The two trailing-window click
 *  queries run in parallel so the whole step stays inside its deadline. */
async function collectTraffic(
  today: string,
  gsc: NonNullable<SeoSnapshotMetrics['gsc']>,
): Promise<SeoSnapshotMetrics['traffic']> {
  const [clicks1d, clicks7d] = await Promise.all([
    gsc.impressions > 0 ? trailingWindowClicks(today, 1) : Promise.resolve(0),
    trailingWindowClicks(today, 7),
  ]);
  return {
    last24hClicks: clicks1d,
    rolling7dAvgClicks: clicks7d / 7,
    rolling28dAvgClicks: gsc.clicks / 28,
  };
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

  // `count: 'planned'` liest die Planner-Schätzung (pg_class.reltuples +
  // Selektivität) statt die Zeilen zu scannen — konstant schnell statt
  // 10–30s Full-Scan pro Query auf 304k Zeilen (das war die Root-Cause
  // des 2026-04-29-Ausfalls). Für SEO-Trend-Telemetrie (wächst der
  // Katalog?) ist die Näherung völlig ausreichend; ANALYZE hält sie
  // aktuell.
  // Nur die vier planner-schätzbaren Counts, parallel. Die frühere
  // Gemeinde-RPC (GROUP BY + HAVING über ~90k Zeilen) wurde ENTFERNT:
  // sie ließ sich nicht planner-schätzen, gab jeden Lauf ihre Deadline auf
  // — lief aber serverseitig weiter (withDeadline stoppt nur das Warten).
  // Diese verwaiste Query pinnte auf der Micro-Instanz einen Core + eine
  // Pooler-Connection und ließ dadurch die planned-Counts verhungern
  // (gemessen 2026-07-08: internal >12s). gemeindeHubsIndexable bleibt
  // jetzt weg (Feld ist optional; Admin-Dashboard zeigt null). Bei Bedarf
  // in der stats-MV vorberechnen — P2.
  const [
    { count: totalPublished },
    { count: futurePublished },
    { count: enrichedV3 },
    { count: sitemapUrlsGenerated },
  ] = await Promise.all([
    sb.from('events').select('*', { count: 'planned', head: true })
      .eq('publish_status', 'published'),
    sb.from('events').select('*', { count: 'planned', head: true })
      .eq('publish_status', 'published')
      .gte('start_date', today),
    sb.from('events').select('*', { count: 'planned', head: true })
      .eq('enrichment_version', 'v3'),
    // Sitemap-eligible ≈ future published with quality_score ≥ 40.
    sb.from('events').select('*', { count: 'planned', head: true })
      .eq('publish_status', 'published')
      .gte('start_date', today)
      .gte('quality_score', 40),
  ]);

  return {
    totalPublished: totalPublished ?? 0,
    futurePublished: futurePublished ?? 0,
    enrichedV3: enrichedV3 ?? 0,
    sitemapUrlsGenerated: sitemapUrlsGenerated ?? 0,
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
    aktivitaet: { clicks: 0, impressions: 0, pageCount: 0 },
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
  aktivitaet: `${SITE_URL}/aktivitaeten`,
  gemeinde: `${SITE_URL}/gemeinde/1010-wien`,
  thema: `${SITE_URL}/thema/musik`,
  bundesland: `${SITE_URL}/wien`,
  blog: `${SITE_URL}/blog`,
};

async function collectCwvMetrics(): Promise<SeoSnapshotMetrics['cwv']> {
  // All CrUX calls in parallel — origin + the per-hub sample URLs. Sequential
  // awaits (the old shape) meant 5 round-trips in series, which alone could
  // blow the cwv deadline; parallel keeps the whole step within one round-trip.
  const hubEntries = Object.entries(CWV_SAMPLE_URLS)
    .filter(([hub]) => hub !== 'event_detail'); // event pages have no CrUX data

  const [origin, ...hubResults] = await Promise.all([
    fetchVitalsSummary({ origin: SITE_URL }).catch(() => null),
    ...hubEntries.map(([, url]) => fetchVitalsSummary({ url }).catch(() => null)),
  ]);

  const byHubType: Partial<Record<HubType, VitalsSummary | null>> = {};
  hubEntries.forEach(([hub], i) => {
    byHubType[hub as HubType] = hubResults[i];
  });
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
