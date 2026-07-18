'use client';

/**
 * /admin/seo — the SEO KPI dashboard.
 *
 * Single-page view composed of widgets that each fetch their own API
 * route. Keeping widgets independent means one slow call (e.g. GSC)
 * doesn't block the others — each gets its own skeleton/error state.
 *
 * Widgets (top to bottom):
 *   - SetupStatus        — banner if GSC or CrUX env vars aren't wired
 *   - OverviewCards      — 28d impressions / clicks / CTR / position + deltas
 *   - HubTypeBreakdown   — traffic per hub (event/gemeinde/thema/blog/bundesland)
 *   - KeywordsTable      — tabbed: top/gainers/losers
 *   - PagesTable         — top pages, filter by hub-type
 *   - VitalsGrid         — LCP/INP/CLS per hub-type from CrUX
 *   - HistoryChart       — 30-day trend of headline metrics
 *
 * Role guard: mirrors the pattern in other admin pages (useAuth +
 * redirect). The API routes also gate via requireAdmin — defense in
 * depth against direct URL access.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { BarChart3, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2, Search, Globe, Gauge, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/supabase/auth-context';

// ─────────────────────────────────────────────────────────────────
// Types — duplicated minimally from the backend, not imported, so the
// client bundle doesn't pull in server-only modules (supabase-js etc).
// ─────────────────────────────────────────────────────────────────

interface OverviewResponse {
  site: string;
  gscSite: string;
  current: { date: string; metrics: SnapshotMetricsLite };
  prior: { date: string; metrics: SnapshotMetricsLite } | null;
  synthetic: boolean;
  ageHours: number;
  stale: boolean;
  setup: {
    gsc: { ok: true; sitesVerified: number } | { ok: false; error: string };
    crux: { ok: true } | { ok: false; error: string };
  };
}
interface SnapshotMetricsLite {
  gsc?: {
    windowStart: string;
    windowEnd: string;
    impressions: number;
    clicks: number;
    ctr: number;
    avgPosition: number;
    byHubType: Record<string, { clicks: number; impressions: number; pageCount: number }>;
  };
  cwv?: { origin: VitalsLite | null; byHubType: Record<string, VitalsLite | null> };
  internal?: {
    totalPublished: number;
    futurePublished: number;
    enrichedV3: number;
    sitemapUrlsGenerated: number;
    gemeindeHubsIndexable: number;
  };
}
interface VitalsLite {
  lcp: { p75ms: number; verdict: 'good' | 'ni' | 'poor' } | null;
  inp: { p75ms: number; verdict: 'good' | 'ni' | 'poor' } | null;
  cls: { p75: number; verdict: 'good' | 'ni' | 'poor' } | null;
  sampleDays: string | null;
}

interface KeywordRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  deltaClicks: number | null;
  deltaImpressions: number | null;
  deltaPosition: number | null;
}

interface PageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  hubType: string;
}

interface HistoryPoint {
  date: string;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  avgPosition: number | null;
  sitemapUrlsGenerated: number | null;
  gemeindeHubsIndexable: number | null;
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
}

type SortMode = 'clicks' | 'impressions' | 'position' | 'gain' | 'loss';

// ─────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────

export default function SeoAdminPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  // Auth gate — redirect non-admins away (same pattern as admin/users/)
  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return; }
    if (!authLoading && user && profile && profile.role !== 'god' && profile.role !== 'admin') {
      router.push('/map');
    }
  }, [authLoading, user, profile, router]);
  const isAdmin = !!profile && (profile.role === 'god' || profile.role === 'admin');

  if (authLoading || !user || !profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="space-y-8 pb-16">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-white/40" />
          <h1 className="text-2xl font-semibold text-white/90">SEO</h1>
        </div>
        <RefreshButton />
      </div>

      <SetupAndOverview />
      <HubBreakdown />
      <KeywordsTable />
      <PagesTable />
      <VitalsGrid />
      <HistoryPanel />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// RefreshButton — forces a new snapshot without waiting for the cron
// ─────────────────────────────────────────────────────────────────

function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/seo/snapshot', { method: 'POST' });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      toast.success(`Snapshot erneuert: ${body.date}`);
      // Trigger re-render of widgets
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Snapshot fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/80 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Lädt …' : 'Snapshot jetzt'}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Setup + Overview widget
// ─────────────────────────────────────────────────────────────────

function SetupAndOverview() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/seo/overview')
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<OverviewResponse>;
      })
      .then(setData)
      .catch(err => setError(err.message));
  }, []);

  if (error) return <WidgetError title="Overview" error={error} />;
  if (!data) return <WidgetSkeleton height="h-40" />;

  const curr = data.current.metrics.gsc;
  const prior = data.prior?.metrics.gsc;

  return (
    <div className="space-y-4">
      {/* Setup banners */}
      {!data.setup.gsc.ok && (
        <SetupBanner
          tone="warn"
          title="Search Console nicht erreichbar"
          body={data.setup.gsc.error}
          docLink="/docs/seo/gsc-setup"
        />
      )}
      {!data.setup.crux.ok && (
        <SetupBanner
          tone="warn"
          title="CrUX API-Key nicht gesetzt"
          body={data.setup.crux.error}
          docLink="/docs/seo/gsc-setup"
        />
      )}
      {data.synthetic && (
        <SetupBanner
          tone="info"
          title="Erster Snapshot steht aus"
          body={'Der Daily-Cron hat noch nicht gelaufen. Klick oben auf „Snapshot jetzt" um die GSC-Daten einmalig zu ziehen, oder warte bis die Cron-Schedule feuert.'}
        />
      )}
      {data.stale && !data.synthetic && (
        <SetupBanner
          tone="info"
          title={`Letzter Snapshot ist ${data.ageHours}h alt`}
          body="Der Daily-Cron läuft normalerweise um 06:00 UTC. Prüfe Vercel → Crons, wenn es länger her ist."
        />
      )}

      {/* Overview tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          label="Impressionen"
          value={curr?.impressions ?? null}
          prior={prior?.impressions ?? null}
          hint={`${curr?.windowStart ?? '—'} → ${curr?.windowEnd ?? '—'}`}
        />
        <KpiTile
          label="Klicks"
          value={curr?.clicks ?? null}
          prior={prior?.clicks ?? null}
          hint="28-Tage-Fenster"
        />
        <KpiTile
          label="CTR"
          value={curr?.ctr ?? null}
          prior={prior?.ctr ?? null}
          formatter={v => `${(v * 100).toFixed(2)}%`}
          hint="Klicks ÷ Impressionen"
        />
        <KpiTile
          label="Ø Position"
          value={curr?.avgPosition ?? null}
          prior={prior?.avgPosition ?? null}
          formatter={v => v.toFixed(1)}
          inverseDelta
          hint="niedriger = besser"
        />
      </section>

      {/* Internal catalog counters */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CatalogTile
          label="Published future"
          value={data.current.metrics.internal?.futurePublished ?? null}
          hint="DB: zukünftige Events"
        />
        <CatalogTile
          label="Sitemap-URLs"
          value={data.current.metrics.internal?.sitemapUrlsGenerated ?? null}
          hint="quality_score ≥ 40"
        />
        <CatalogTile
          label="Gemeinde-Hubs"
          value={data.current.metrics.internal?.gemeindeHubsIndexable ?? null}
          hint="≥3 upcoming events"
        />
        <CatalogTile
          label="Enriched v3"
          value={data.current.metrics.internal?.enrichedV3 ?? null}
          hint="AI-enriched rows"
        />
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Hub-type breakdown — one row per hub, stacked bars
// ─────────────────────────────────────────────────────────────────

function HubBreakdown() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  useEffect(() => {
    fetch('/api/admin/seo/overview').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  const byHub = data?.current.metrics.gsc?.byHubType;
  if (!byHub) return null;

  const rows = Object.entries(byHub)
    .map(([hub, m]) => ({ hub, ...m }))
    .filter(r => r.impressions > 0 || r.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks);

  const maxClicks = Math.max(1, ...rows.map(r => r.clicks));

  return (
    <section className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-4 h-4 text-white/40" />
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
          Traffic nach Hub-Typ
        </h2>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-white/40">Keine GSC-Daten im aktuellen Snapshot.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.hub} className="grid grid-cols-[120px_1fr_auto_auto] items-center gap-4">
              <span className="text-xs uppercase tracking-wider text-white/60">{formatHubLabel(r.hub)}</span>
              <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500/70 to-indigo-400/80"
                  style={{ width: `${(r.clicks / maxClicks) * 100}%` }}
                />
              </div>
              <span className="tabular-nums text-sm text-white/80">{r.clicks.toLocaleString('de-AT')}</span>
              <span className="tabular-nums text-xs text-white/40 w-20 text-right">{r.impressions.toLocaleString('de-AT')} imp</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Keywords table — tabs for top/gainers/losers
// ─────────────────────────────────────────────────────────────────

function KeywordsTable() {
  const [sort, setSort] = useState<SortMode>('clicks');
  const [rows, setRows] = useState<KeywordRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (mode: SortMode) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/seo/keywords?sort=${mode}&limit=30`);
      const body = await res.json();
      setRows(body.keywords ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(sort); }, [sort, load]);

  return (
    <section className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-white/40" />
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Keywords</h2>
        </div>
        <div className="flex gap-1 text-xs">
          {(['clicks', 'impressions', 'position', 'gain', 'loss'] as const).map(m => (
            <button
              key={m}
              onClick={() => setSort(m)}
              className={`px-2.5 py-1 rounded ${
                sort === m ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {m === 'gain' ? 'Gainers' : m === 'loss' ? 'Losers' : m === 'position' ? 'Position' : m === 'clicks' ? 'Top Klicks' : 'Top Impressions'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <WidgetSkeleton height="h-60" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-white/40">Noch keine GSC-Daten.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-white/40 uppercase tracking-wider">
            <tr className="border-b border-white/[0.06]">
              <th className="text-left py-2">Query</th>
              <th className="text-right py-2">Klicks</th>
              <th className="text-right py-2">Impr.</th>
              <th className="text-right py-2">CTR</th>
              <th className="text-right py-2">Pos.</th>
              {(sort === 'gain' || sort === 'loss') && <th className="text-right py-2">Δ Klicks</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.query + i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                <td className="py-2 text-white/80 truncate max-w-md">{r.query}</td>
                <td className="py-2 text-right tabular-nums">{r.clicks}</td>
                <td className="py-2 text-right tabular-nums text-white/60">{r.impressions}</td>
                <td className="py-2 text-right tabular-nums text-white/60">{(r.ctr * 100).toFixed(1)}%</td>
                <td className="py-2 text-right tabular-nums text-white/60">{r.position.toFixed(1)}</td>
                {(sort === 'gain' || sort === 'loss') && (
                  <td className={`py-2 text-right tabular-nums ${
                    (r.deltaClicks ?? 0) > 0 ? 'text-emerald-400' : (r.deltaClicks ?? 0) < 0 ? 'text-rose-400' : 'text-white/40'
                  }`}>
                    {r.deltaClicks === null ? '—' : (r.deltaClicks > 0 ? `+${r.deltaClicks}` : r.deltaClicks)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Pages table
// ─────────────────────────────────────────────────────────────────

function PagesTable() {
  const [hub, setHub] = useState<string>('all');
  const [rows, setRows] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (h: string) => {
    setLoading(true);
    try {
      const url = h === 'all'
        ? '/api/admin/seo/pages?limit=30'
        : `/api/admin/seo/pages?hub=${h}&limit=30`;
      const res = await fetch(url);
      const body = await res.json();
      setRows(body.pages ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(hub); }, [hub, load]);

  const hubs = ['all', 'gemeinde', 'thema', 'event_detail', 'bundesland', 'blog', 'other'];

  return (
    <section className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-white/40" />
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Top Pages</h2>
        </div>
        <div className="flex gap-1 text-xs flex-wrap">
          {hubs.map(h => (
            <button
              key={h}
              onClick={() => setHub(h)}
              className={`px-2.5 py-1 rounded ${
                hub === h ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {h === 'all' ? 'Alle' : formatHubLabel(h)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <WidgetSkeleton height="h-60" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-white/40">Keine Pages im Filter.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-white/40 uppercase tracking-wider">
            <tr className="border-b border-white/[0.06]">
              <th className="text-left py-2">Page</th>
              <th className="text-right py-2">Klicks</th>
              <th className="text-right py-2">Impr.</th>
              <th className="text-right py-2">Pos.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.page + i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                <td className="py-2 text-white/80 truncate max-w-lg">
                  <a href={r.page} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {r.page.replace('https://lasstreffen.at', '')}
                  </a>
                  <span className="ml-2 text-[10px] text-white/30 uppercase tracking-wider">{formatHubLabel(r.hubType)}</span>
                </td>
                <td className="py-2 text-right tabular-nums">{r.clicks}</td>
                <td className="py-2 text-right tabular-nums text-white/60">{r.impressions}</td>
                <td className="py-2 text-right tabular-nums text-white/60">{r.position.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Core Web Vitals grid
// ─────────────────────────────────────────────────────────────────

function VitalsGrid() {
  const [data, setData] = useState<{
    origin: VitalsLite | null;
    byHubType: Record<string, VitalsLite | null>;
  } | null>(null);

  useEffect(() => {
    fetch('/api/admin/seo/vitals').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <WidgetSkeleton height="h-40" />;

  const groups = [
    { key: 'origin', label: 'Gesamt (Origin)', vitals: data.origin },
    ...Object.entries(data.byHubType ?? {}).map(([k, v]) => ({
      key: k,
      label: formatHubLabel(k),
      vitals: v,
    })),
  ];

  return (
    <section className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-4 h-4 text-white/40" />
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
          Core Web Vitals (CrUX 28-Tage-Feld)
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map(g => (
          <VitalsCard key={g.key} label={g.label} v={g.vitals} />
        ))}
      </div>
    </section>
  );
}

function VitalsCard({ label, v }: { label: string; v: VitalsLite | null }) {
  return (
    <div className="rounded-xl bg-black/40 border border-white/[0.04] p-3">
      <p className="text-[11px] uppercase tracking-wider text-white/50 mb-2">{label}</p>
      {!v ? (
        <p className="text-xs italic text-white/30">Zu wenig Field-Daten</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <VitalMetric label="LCP" value={v.lcp ? `${v.lcp.p75ms}ms` : '—'} verdict={v.lcp?.verdict} />
          <VitalMetric label="INP" value={v.inp ? `${v.inp.p75ms}ms` : '—'} verdict={v.inp?.verdict} />
          <VitalMetric label="CLS" value={v.cls ? v.cls.p75.toFixed(3) : '—'} verdict={v.cls?.verdict} />
        </div>
      )}
    </div>
  );
}
function VitalMetric({ label, value, verdict }: { label: string; value: string; verdict?: 'good' | 'ni' | 'poor' }) {
  const color = verdict === 'good' ? 'text-emerald-400' : verdict === 'ni' ? 'text-amber-400' : verdict === 'poor' ? 'text-rose-400' : 'text-white/50';
  return (
    <div>
      <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
      <p className={`text-sm tabular-nums font-medium ${color}`}>{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// History sparkline panel
// ─────────────────────────────────────────────────────────────────

function HistoryPanel() {
  const [days, setDays] = useState(30);
  const [series, setSeries] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/seo/history?days=${days}`)
      .then(r => r.json())
      .then(j => setSeries(j.series ?? []))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <section className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-white/40" />
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">Historie</h2>
        </div>
        <div className="flex gap-1 text-xs">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded ${days === d ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <WidgetSkeleton height="h-32" />
      ) : series.length === 0 ? (
        <p className="text-sm text-white/40">Noch keine historischen Snapshots.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SparkCard label="Impressionen" series={series.map(s => s.impressions)} />
          <SparkCard label="Klicks" series={series.map(s => s.clicks)} />
          <SparkCard label="Ø Position" series={series.map(s => s.avgPosition)} inverse />
          <SparkCard label="Sitemap-URLs" series={series.map(s => s.sitemapUrlsGenerated)} />
        </div>
      )}
    </section>
  );
}

function SparkCard({ label, series, inverse = false }: { label: string; series: Array<number | null>; inverse?: boolean }) {
  const valid = series.filter((v): v is number => typeof v === 'number');
  const latest = valid[valid.length - 1] ?? null;
  const min = Math.min(...(valid.length ? valid : [0]));
  const max = Math.max(...(valid.length ? valid : [1]));
  const range = max - min || 1;
  const w = 120, h = 32;
  const step = valid.length > 1 ? w / (valid.length - 1) : 0;
  const points = valid.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="rounded-xl bg-black/30 border border-white/[0.04] p-3">
      <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1">{label}</p>
      <p className="text-lg font-semibold text-white tabular-nums">
        {latest !== null ? (label.includes('Position') ? latest.toFixed(1) : Math.round(latest).toLocaleString('de-AT')) : '—'}
      </p>
      {valid.length > 1 && (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8 mt-1" preserveAspectRatio="none">
          <polyline
            points={points}
            fill="none"
            stroke={inverse ? '#fca5a5' : '#a5b4fc'}
            strokeWidth="1.5"
          />
        </svg>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────

function formatHubLabel(hub: string): string {
  switch (hub) {
    case 'gemeinde': return 'Gemeinden';
    case 'thema': return 'Themen';
    case 'event_detail': return 'Events';
    case 'bundesland': return 'Bundesländer';
    case 'blog': return 'Blog';
    case 'other': return 'Andere';
    default: return hub;
  }
}

function KpiTile({
  label, value, prior, hint, formatter = (v: number) => Math.round(v).toLocaleString('de-AT'), inverseDelta = false,
}: {
  label: string;
  value: number | null;
  prior: number | null;
  hint?: string;
  formatter?: (v: number) => string;
  inverseDelta?: boolean;
}) {
  const delta = value !== null && prior !== null && prior !== 0 ? ((value - prior) / prior) * 100 : null;
  const deltaSign = delta === null ? null : inverseDelta ? -Math.sign(delta) : Math.sign(delta);
  const deltaColor = deltaSign === 1 ? 'text-emerald-400' : deltaSign === -1 ? 'text-rose-400' : 'text-white/40';

  return (
    <div className="rounded-xl bg-black/40 border border-white/[0.04] p-3">
      <p className="text-[11px] uppercase tracking-wider text-white/50">{label}</p>
      <p className="text-2xl font-semibold text-white tabular-nums">
        {value === null ? '—' : formatter(value)}
      </p>
      <div className="flex items-center gap-2 mt-1">
        {delta !== null && (
          <span className={`text-xs tabular-nums ${deltaColor}`}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-[11px] text-white/30">{hint}</span>}
      </div>
    </div>
  );
}

function CatalogTile({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
      <p className="text-[11px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="text-xl font-medium text-white/80 tabular-nums">
        {value === null ? '—' : value.toLocaleString('de-AT')}
      </p>
      {hint && <p className="text-[11px] text-white/30 mt-0.5">{hint}</p>}
    </div>
  );
}

function WidgetSkeleton({ height }: { height: string }) {
  return <div className={`rounded-2xl bg-white/[0.02] border border-white/[0.04] ${height} animate-pulse`} />;
}

function WidgetError({ title, error }: { title: string; error: string }) {
  return (
    <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-rose-200">{title} — Fehler</p>
        <p className="text-xs text-rose-200/60 mt-0.5 font-mono">{error}</p>
      </div>
    </div>
  );
}

function SetupBanner({
  tone, title, body, docLink,
}: {
  tone: 'warn' | 'info';
  title: string;
  body: string;
  docLink?: string;
}) {
  const palette = tone === 'warn'
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
    : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200';
  const Icon = tone === 'warn' ? AlertTriangle : CheckCircle2;
  return (
    <div className={`rounded-xl border p-3 flex items-start gap-3 ${palette}`}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs mt-0.5 opacity-80">{body}</p>
        {docLink && (
          <Link href={docLink} className="text-xs underline mt-1 inline-block opacity-80 hover:opacity-100">
            Setup-Anleitung →
          </Link>
        )}
      </div>
    </div>
  );
}
