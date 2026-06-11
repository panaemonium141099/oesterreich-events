'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import {
  EyeIcon,
  UsersIcon,
  SearchIcon,
  UserIcon,
  ChartBarIcon,
  ClockIcon,
  SlidersIcon,
  ExternalLinkIcon,
  FunnelIcon,
  MapIcon,
  InboxIcon,
  BarChart3Icon,
  GlobeIcon,
} from '@/components/UI/Icons';

type Period = 'today' | '7d' | '30d' | 'all';

interface AnalyticsData {
  overview: {
    pageViews: number;
    pageViewsToday: number;
    pageViewsWeek: number;
    uniqueSessions: number;
    sessionsToday: number;
    sessionsWeek: number;
    totalSearches: number;
    activeUsers: number;
  };
  viewsByDay: { date: string; count: number }[];
  topEvents: { id: string; title: string; clicks: number; saves: number }[];
  topSearches: { query: string; count: number; avgResults: number }[];
  behavior: {
    topFilters: { filter: string; count: number }[];
    nachtlebenToggles: number;
    avgSessionDuration: number;
    hourCounts: number[];
  };
  linkClicks: { domain: string; count: number; topEvents: string[] }[];
  funnel: {
    pageViews: number;
    eventClicks: number;
    eventSaves: number;
    ticketClicks: number;
  };
  bundeslandHeatmap: { name: string; count: number }[];
  users: UserActivity[];
  anonSessions: AnonSession[];
  anonTotals: { sessions: number; pageViews: number; searches: number; clicks: number };
}

interface AnonSession {
  id: string;
  total: number;
  pageViews: number;
  searches: number;
  clicks: number;
  firstSeen: string;
  lastActive: string;
  entryPage: string | null;
  referrer: string | null;
}

interface UserActivity {
  id: string;
  name: string;
  email: string | null;
  total: number;
  pageViews: number;
  searches: number;
  clicks: number;
  saves: number;
  /** Tatsächlich aktuell gemerkte Events (saved_events, all-time) — nicht der
   *  zeitraum-/tracking-abhängige event_save-Aktions-Log. */
  savedTotal: number;
  lastActive: string;
}

interface UserDrilldownEvent {
  event_type: string;
  event_data: Record<string, unknown> | null;
  page: string | null;
  created_at: string;
}

/* ─── Helpers ─────────────────────────────────────── */

const fmt = (n: number) => n.toLocaleString('de-AT');

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

const periodLabels: Record<Period, string> = {
  today: 'Heute',
  '7d': '7 Tage',
  '30d': '30 Tage',
  all: 'Alle',
};

/* ─── CSS for animations (injected once) ──────────── */

const ANIM_STYLE = `
@keyframes analyticsSlideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes analyticsBarGrow {
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
}
@media (prefers-reduced-motion: reduce) {
  .analytics-animate { animation: none !important; opacity: 1 !important; transform: none !important; }
  .analytics-bar-animate { animation: none !important; transform: scaleY(1) !important; }
  .analytics-transition { transition: none !important; }
}
`;

/* ─── Main Component ──────────────────────────────── */

export default function AnalyticsPanel() {
  const [period, setPeriod] = useState<Period>('7d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const styleInjected = useRef(false);

  // Inject animation CSS once
  useEffect(() => {
    if (styleInjected.current) return;
    styleInjected.current = true;
    const style = document.createElement('style');
    style.textContent = ANIM_STYLE;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError('Fehler beim Laden der Statistiken');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  /* ── Loading skeleton ── */
  if (loading) {
    return <SkeletonLayout />;
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="text-center py-20">
        <svg className="w-12 h-12 text-white/10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-white/40 text-sm">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="mt-3 min-h-[44px] min-w-[44px] px-4 py-2 text-xs text-white/30 hover:text-white/60 analytics-transition transition-colors duration-200 underline cursor-pointer"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  /* ── Empty state ── */
  if (!data) {
    return <EmptyDashboard onRetry={fetchAnalytics} />;
  }

  const maxDayViews = Math.max(...data.viewsByDay.map(d => d.count), 1);
  const maxHourCount = Math.max(...data.behavior.hourCounts, 1);
  const maxBLCount = data.bundeslandHeatmap[0]?.count || 1;

  // Funnel percentages
  const funnelBase = data.funnel.pageViews || 1;
  const funnelSteps = [
    { label: 'Seitenaufrufe', value: data.funnel.pageViews, pct: 100 },
    { label: 'Event-Klicks', value: data.funnel.eventClicks, pct: Math.round((data.funnel.eventClicks / funnelBase) * 100) },
    { label: 'Gespeichert', value: data.funnel.eventSaves, pct: Math.round((data.funnel.eventSaves / funnelBase) * 100) },
    { label: 'Ticket-Klicks', value: data.funnel.ticketClicks, pct: Math.round((data.funnel.ticketClicks / funnelBase) * 100) },
  ];

  return (
    <div className="space-y-6">

      {/* Period selector */}
      <AnimatedSection index={0}>
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
          {(['today', '7d', '30d', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg text-xs font-medium analytics-transition transition-all duration-200 cursor-pointer ${
                period === p
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </AnimatedSection>

      {/* Section 1: Overview Cards */}
      <AnimatedSection index={1}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassCard>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <EyeIcon size={14} className="text-blue-400" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/30">Seitenaufrufe</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{fmt(data.overview.pageViews)}</p>
            <div className="flex gap-3 mt-1">
              <span className="text-[10px] text-white/30">Heute: {fmt(data.overview.pageViewsToday)}</span>
              <span className="text-[10px] text-white/30">Woche: {fmt(data.overview.pageViewsWeek)}</span>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <UsersIcon size={14} className="text-emerald-400" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/30">Besucher</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{fmt(data.overview.uniqueSessions)}</p>
            <div className="flex gap-3 mt-1">
              <span className="text-[10px] text-white/30">Heute: {fmt(data.overview.sessionsToday)}</span>
              <span className="text-[10px] text-white/30">Woche: {fmt(data.overview.sessionsWeek)}</span>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <SearchIcon size={14} className="text-amber-400" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/30">Suchanfragen</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{fmt(data.overview.totalSearches)}</p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <UserIcon size={14} className="text-purple-400" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-white/30">Aktive User</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{fmt(data.overview.activeUsers)}</p>
            <span className="text-[10px] text-white/30">eingeloggt im Zeitraum</span>
          </GlassCard>
        </div>
      </AnimatedSection>

      {/* Section 2: Page Views Chart */}
      <AnimatedSection index={2}>
        <GlassCard>
          <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-4 flex items-center gap-2">
            <BarChart3Icon size={16} className="text-white/20" />
            Seitenaufrufe pro Tag
          </h3>
          {data.viewsByDay.length === 0 ? (
            <EmptyState text="Keine Daten im Zeitraum" />
          ) : (
            <div className="flex items-end gap-[2px] h-32" role="img" aria-label="Balkendiagramm der täglichen Seitenaufrufe">
              {data.viewsByDay.map((day, i) => {
                const height = maxDayViews > 0 ? (day.count / maxDayViews) * 100 : 0;
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full rounded-t analytics-bar-animate analytics-transition transition-all duration-300 min-h-[2px]"
                      style={{
                        height: `${Math.max(height, 2)}%`,
                        background: 'linear-gradient(to top, rgba(59,130,246,0.15), rgba(59,130,246,0.45))',
                        transformOrigin: 'bottom',
                        animation: `analyticsBarGrow 400ms ease-out ${i * 20}ms both`,
                      }}
                    />
                    {/* Hover highlight */}
                    <div
                      className="absolute bottom-0 w-full rounded-t opacity-0 group-hover:opacity-100 analytics-transition transition-opacity duration-150 pointer-events-none"
                      style={{ height: `${Math.max(height, 2)}%`, background: 'rgba(59,130,246,0.25)' }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 analytics-transition transition-opacity duration-150 pointer-events-none z-10">
                      <div className="bg-black/90 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                        {new Date(day.date + 'T12:00:00').toLocaleDateString('de-AT', { day: '2-digit', month: 'short' })}
                        <span className="ml-1 font-bold tabular-nums">{fmt(day.count)}</span>
                      </div>
                    </div>
                    {/* X-axis label for first, middle, last */}
                    {(i === 0 || i === data.viewsByDay.length - 1 || i === Math.floor(data.viewsByDay.length / 2)) && (
                      <span className="text-[8px] text-white/20 absolute -bottom-4 whitespace-nowrap">
                        {new Date(day.date + 'T12:00:00').toLocaleDateString('de-AT', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </AnimatedSection>

      <AnimatedSection index={3}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 3: Top Events */}
          <GlassCard>
            <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-3 flex items-center gap-2">
              <ChartBarIcon size={16} className="text-white/20" />
              Top Events
            </h3>
            {data.topEvents.length === 0 ? (
              <EmptyState text="Noch keine Event-Klicks" />
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {data.topEvents.map((ev, i) => (
                  <div key={ev.id} className="flex items-center gap-2 min-h-[36px]">
                    <span className="text-[10px] text-white/20 w-5 text-right shrink-0 tabular-nums">{i + 1}.</span>
                    <span className="text-xs text-white/70 truncate flex-1">{ev.title}</span>
                    <span className="text-[10px] text-blue-400/70 shrink-0 tabular-nums">{fmt(ev.clicks)} Klicks</span>
                    <span className="text-[10px] text-amber-400/50 shrink-0 tabular-nums">{fmt(ev.saves)} Saves</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Section 4: Top Searches */}
          <GlassCard>
            <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-3 flex items-center gap-2">
              <SearchIcon size={16} className="text-white/20" />
              Top Suchanfragen
            </h3>
            {data.topSearches.length === 0 ? (
              <EmptyState text="Noch keine Suchanfragen" />
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {data.topSearches.map((s, i) => (
                  <div key={s.query} className="flex items-center gap-2 min-h-[36px]">
                    <span className="text-[10px] text-white/20 w-5 text-right shrink-0 tabular-nums">{i + 1}.</span>
                    <span className="text-xs text-white/70 truncate flex-1">&ldquo;{s.query}&rdquo;</span>
                    <span className="text-[10px] text-white/30 shrink-0 tabular-nums">{fmt(s.count)}x</span>
                    <span className="text-[10px] text-white/20 shrink-0 tabular-nums">~{fmt(s.avgResults)} Ergebnisse</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </AnimatedSection>

      {/* Section 5: User Behavior */}
      <AnimatedSection index={4}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassCard>
            <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-3 flex items-center gap-2">
              <SlidersIcon size={16} className="text-white/20" />
              Filterverhalten
            </h3>
            {data.behavior.topFilters.length === 0 ? (
              <EmptyState text="Noch keine Filternutzung" />
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {data.behavior.topFilters.map((f) => (
                  <div key={f.filter} className="flex items-center gap-2 min-h-[32px]">
                    <span className="text-xs text-white/60 truncate flex-1">{f.filter}</span>
                    <span className="text-[10px] text-white/30 tabular-nums">{fmt(f.count)}x</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-white/[0.06] flex gap-4">
              <div>
                <p className="text-[10px] text-white/30">Nachtleben-Toggles</p>
                <p className="text-sm font-bold tabular-nums">{fmt(data.behavior.nachtlebenToggles)}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/30">~Session-Dauer</p>
                <p className="text-sm font-bold tabular-nums">{formatDuration(data.behavior.avgSessionDuration)}</p>
              </div>
            </div>
          </GlassCard>

          {/* Active Hours Chart */}
          <GlassCard>
            <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-3 flex items-center gap-2">
              <ClockIcon size={16} className="text-white/20" />
              Aktivste Stunden
            </h3>
            <div className="flex items-end gap-[1px] h-24" role="img" aria-label="Balkendiagramm der aktivsten Stunden">
              {data.behavior.hourCounts.map((count, hour) => {
                const height = maxHourCount > 0 ? (count / maxHourCount) * 100 : 0;
                return (
                  <div key={hour} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                    <div
                      className="w-full rounded-t analytics-bar-animate analytics-transition transition-all duration-300 min-h-[1px]"
                      style={{
                        height: `${Math.max(height, 1)}%`,
                        background: 'linear-gradient(to top, rgba(52,211,153,0.15), rgba(52,211,153,0.45))',
                        transformOrigin: 'bottom',
                        animation: `analyticsBarGrow 400ms ease-out ${hour * 15}ms both`,
                      }}
                    />
                    {/* Hover highlight */}
                    <div
                      className="absolute bottom-0 w-full rounded-t opacity-0 group-hover:opacity-100 analytics-transition transition-opacity duration-150 pointer-events-none"
                      style={{ height: `${Math.max(height, 1)}%`, background: 'rgba(52,211,153,0.25)' }}
                    />
                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 analytics-transition transition-opacity duration-150 pointer-events-none z-10">
                      <div className="bg-black/90 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                        {hour}:00 &mdash; <span className="font-bold tabular-nums">{fmt(count)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px] text-white/20">0h</span>
              <span className="text-[8px] text-white/20">6h</span>
              <span className="text-[8px] text-white/20">12h</span>
              <span className="text-[8px] text-white/20">18h</span>
              <span className="text-[8px] text-white/20">23h</span>
            </div>
          </GlassCard>
        </div>
      </AnimatedSection>

      {/* Section 6: Link Clicks (Affiliate) */}
      <AnimatedSection index={5}>
        <GlassCard>
          <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-3 flex items-center gap-2">
            <ExternalLinkIcon size={16} className="text-white/20" />
            Externe Link-Klicks
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400/70 ml-auto">Affiliate-relevant</span>
          </h3>
          {data.linkClicks.length === 0 ? (
            <EmptyState text="Noch keine externen Klicks" />
          ) : (
            <div className="space-y-3">
              {data.linkClicks.map((d) => (
                <div key={d.domain} className="flex items-start gap-3 min-h-[44px]">
                  <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                    <GlobeIcon size={12} className="text-white/20" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white/70">{d.domain}</span>
                      <span className="text-[10px] text-white/30 tabular-nums">{fmt(d.count)} Klicks</span>
                    </div>
                    {d.topEvents.length > 0 && (
                      <p className="text-[10px] text-white/20 truncate">
                        via: {d.topEvents.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </AnimatedSection>

      {/* Section 7: Conversion Funnel — visual funnel shape */}
      <AnimatedSection index={6}>
        <GlassCard>
          <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-4 flex items-center gap-2">
            <FunnelIcon size={16} className="text-white/20" />
            Conversion Funnel
          </h3>
          <div className="space-y-2 max-w-xl mx-auto">
            {funnelSteps.map((step, i) => {
              const bgColors = ['rgba(59,130,246,0.15)', 'rgba(52,211,153,0.15)', 'rgba(251,191,36,0.15)', 'rgba(248,113,113,0.15)'];
              const fillColors = ['rgba(59,130,246,0.4)', 'rgba(52,211,153,0.4)', 'rgba(251,191,36,0.4)', 'rgba(248,113,113,0.4)'];
              const textColors = ['text-blue-400', 'text-emerald-400', 'text-amber-400', 'text-red-400'];
              // Width narrows from 100% to minimum ~40% based on step index
              const widthPct = 100 - (i * 15);
              return (
                <div key={step.label} className="flex flex-col items-center">
                  <div
                    className="analytics-transition transition-all duration-500 rounded-lg overflow-hidden relative"
                    style={{ width: `${widthPct}%`, height: '40px', background: bgColors[i] }}
                  >
                    <div
                      className="h-full analytics-transition transition-all duration-700 rounded-lg"
                      style={{ width: `${step.pct}%`, background: fillColors[i] }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-3">
                      <span className="text-xs text-white/60 font-medium">{step.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/50 tabular-nums">{fmt(step.value)}</span>
                        <span className={`text-xs font-bold tabular-nums ${textColors[i]}`}>
                          {step.pct}%
                        </span>
                        {i > 0 && funnelSteps[i - 1].value > 0 && (
                          <span className="text-[9px] text-white/20 tabular-nums">
                            ({Math.round((step.value / funnelSteps[i - 1].value) * 100)}% conv.)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </AnimatedSection>

      {/* Section 8: Bundesland Heatmap */}
      <AnimatedSection index={7}>
        <GlassCard>
          <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-3 flex items-center gap-2">
            <MapIcon size={16} className="text-white/20" />
            Bundesland-Interesse
          </h3>
          {data.bundeslandHeatmap.length === 0 ? (
            <EmptyState text="Noch keine Bundesland-Daten" />
          ) : (
            <div className="space-y-2">
              {data.bundeslandHeatmap.map((bl) => {
                const intensity = maxBLCount > 0 ? bl.count / maxBLCount : 0;
                return (
                  <div key={bl.name} className="flex items-center gap-3 min-h-[32px]">
                    <span className="text-xs text-white/60 w-32 truncate">{bl.name}</span>
                    <div className="flex-1 h-5 bg-white/[0.03] rounded-full overflow-hidden border border-white/[0.06]">
                      <div
                        className="h-full rounded-full analytics-transition transition-all duration-300"
                        style={{
                          width: `${intensity * 100}%`,
                          background: `linear-gradient(to right, rgba(251,191,36,${0.15 + intensity * 0.25}), rgba(251,191,36,${0.2 + intensity * 0.45}))`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-white/30 w-12 text-right tabular-nums">{fmt(bl.count)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </AnimatedSection>

      {/* Section 9: Nutzer-Aktivität */}
      <AnimatedSection index={8}>
        <UserActivitySection users={data.users} />
      </AnimatedSection>

      {/* Section 10: Anonyme Besucher */}
      <AnimatedSection index={9}>
        <AnonSessionsSection sessions={data.anonSessions} totals={data.anonTotals} />
      </AnimatedSection>
    </div>
  );
}

/* ─── Nutzer-Aktivität ────────────────────────────── */

function formatLastActive(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs} Std`;
  return d.toLocaleDateString('de-AT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function UserActivitySection({ users }: { users: UserActivity[] }) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [drill, setDrill] = useState<Record<string, UserDrilldownEvent[] | 'loading'>>({});

  const filtered = users.filter((u) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return u.name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q);
  });

  const toggle = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!drill[id]) {
      setDrill((p) => ({ ...p, [id]: 'loading' }));
      try {
        const res = await fetch(`/api/admin/analytics/user/${id}?limit=60`);
        const json = await res.json();
        setDrill((p) => ({ ...p, [id]: (json.events ?? []) as UserDrilldownEvent[] }));
      } catch {
        setDrill((p) => ({ ...p, [id]: [] }));
      }
    }
  };

  return (
    <GlassCard>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium flex items-center gap-2">
          <UsersIcon size={16} className="text-white/20" />
          Nutzer-Aktivität
          <span className="text-[10px] text-white/25 normal-case tracking-normal">({users.length} eingeloggte im Zeitraum)</span>
        </h3>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nutzer suchen…"
          className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30"
        />
      </div>

      {users.length === 0 ? (
        <EmptyState text="Keine eingeloggten Nutzer im Zeitraum" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 text-left border-b border-white/[0.06]">
                <th className="font-medium py-2 pr-3">Nutzer</th>
                <th className="font-medium py-2 px-2 text-right tabular-nums">Aufrufe</th>
                <th className="font-medium py-2 px-2 text-right tabular-nums">Suchen</th>
                <th className="font-medium py-2 px-2 text-right tabular-nums">Klicks</th>
                <th className="font-medium py-2 px-2 text-right tabular-nums">Gespeichert</th>
                <th className="font-medium py-2 px-2 text-right tabular-nums">Aktiv</th>
                <th className="font-medium py-2 pl-2 text-right">Zuletzt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <FragmentRow
                  key={u.id}
                  u={u}
                  open={openId === u.id}
                  onToggle={() => toggle(u.id)}
                  drill={drill[u.id]}
                />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-xs text-white/20 py-6">Kein Treffer für &ldquo;{query}&rdquo;</p>
          )}
        </div>
      )}
    </GlassCard>
  );
}

function FragmentRow({
  u, open, onToggle, drill,
}: {
  u: UserActivity;
  open: boolean;
  onToggle: () => void;
  drill: UserDrilldownEvent[] | 'loading' | undefined;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-b border-white/[0.04] cursor-pointer transition-colors ${open ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}
      >
        <td className="py-2 pr-3">
          <div className="flex items-center gap-2">
            <span className={`text-white/30 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
            <div className="min-w-0">
              <p className="text-white/80 truncate">{u.name}</p>
              {u.email && <p className="text-[10px] text-white/25 truncate">{u.email}</p>}
            </div>
          </div>
        </td>
        <td className="py-2 px-2 text-right tabular-nums text-white/60">{fmt(u.pageViews)}</td>
        <td className="py-2 px-2 text-right tabular-nums text-white/60">{fmt(u.searches)}</td>
        <td className="py-2 px-2 text-right tabular-nums text-blue-400/70">{fmt(u.clicks)}</td>
        <td className="py-2 px-2 text-right tabular-nums text-amber-400/60">{fmt(u.savedTotal)}</td>
        <td className="py-2 px-2 text-right tabular-nums text-white/80 font-semibold">{fmt(u.total)}</td>
        <td className="py-2 pl-2 text-right text-white/40 whitespace-nowrap">{formatLastActive(u.lastActive)}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="bg-black/20 px-4 py-3">
            {drill === 'loading' || drill === undefined ? (
              <p className="text-[11px] text-white/30">Lade Aktivität…</p>
            ) : drill.length === 0 ? (
              <p className="text-[11px] text-white/30">Keine Einzel-Events.</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {drill.map((ev, i) => (
                  <div key={i} className="flex items-center gap-3 text-[11px]">
                    <span className="text-white/30 w-28 shrink-0 tabular-nums">
                      {new Date(ev.created_at).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/60 shrink-0">{ev.event_type}</span>
                    <span className="text-white/40 truncate">
                      {ev.page ?? ''}
                      {ev.event_data && drillDetail(ev.event_data) ? ` · ${drillDetail(ev.event_data)}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/** Kurz-Detail aus event_data für die Drilldown-Zeile (Suchbegriff, Event-Titel…). */
function drillDetail(d: Record<string, unknown>): string {
  const pick = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
  return pick('query') || pick('event_title') || pick('value') || pick('to') || pick('path') || '';
}

/* ─── Anonyme Besucher ────────────────────────────── */

function refLabel(referrer: string | null): string {
  if (!referrer) return 'Direkt';
  try {
    const h = new URL(referrer).hostname.replace(/^www\./, '');
    return h.includes('lasstreffen') ? 'intern' : h;
  } catch {
    return referrer.slice(0, 30);
  }
}

function AnonSessionsSection({
  sessions,
  totals,
}: {
  sessions: AnonSession[];
  totals: { sessions: number; pageViews: number; searches: number; clicks: number };
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [drill, setDrill] = useState<Record<string, UserDrilldownEvent[] | 'loading'>>({});

  const toggle = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!drill[id]) {
      setDrill((p) => ({ ...p, [id]: 'loading' }));
      try {
        const res = await fetch(`/api/admin/analytics/session/${encodeURIComponent(id)}?limit=60`);
        const json = await res.json();
        setDrill((p) => ({ ...p, [id]: (json.events ?? []) as UserDrilldownEvent[] }));
      } catch {
        setDrill((p) => ({ ...p, [id]: [] }));
      }
    }
  };

  return (
    <GlassCard>
      <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-1 flex items-center gap-2">
        <GlobeIcon size={16} className="text-white/20" />
        Anonyme Besucher
        <span className="text-[10px] text-white/25 normal-case tracking-normal">(nicht eingeloggt)</span>
      </h3>
      {/* Summary */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-4 text-[11px] text-white/40">
        <span><span className="text-white/70 font-semibold tabular-nums">{fmt(totals.sessions)}</span> Sitzungen</span>
        <span><span className="text-white/70 font-semibold tabular-nums">{fmt(totals.pageViews)}</span> Aufrufe</span>
        <span><span className="text-white/70 font-semibold tabular-nums">{fmt(totals.searches)}</span> Suchen</span>
        <span><span className="text-white/70 font-semibold tabular-nums">{fmt(totals.clicks)}</span> Klicks</span>
      </div>

      {sessions.length === 0 ? (
        <EmptyState text="Keine anonymen Sitzungen im Zeitraum" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 text-left border-b border-white/[0.06]">
                <th className="font-medium py-2 pr-3">Sitzung</th>
                <th className="font-medium py-2 px-2 text-right tabular-nums">Aufrufe</th>
                <th className="font-medium py-2 px-2 text-right tabular-nums">Suchen</th>
                <th className="font-medium py-2 px-2 text-right tabular-nums">Klicks</th>
                <th className="font-medium py-2 px-2">Kommt von</th>
                <th className="font-medium py-2 pl-2 text-right">Zuletzt</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const isUnknown = s.id === 'unknown';
                const open = openId === s.id;
                const d = drill[s.id];
                return (
                  <Fragment key={s.id}>
                    <tr
                      onClick={() => !isUnknown && toggle(s.id)}
                      className={`border-b border-white/[0.04] transition-colors ${
                        isUnknown ? '' : open ? 'bg-white/[0.04] cursor-pointer' : 'hover:bg-white/[0.02] cursor-pointer'
                      }`}
                    >
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {!isUnknown && <span className={`text-white/30 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>}
                          <div className="min-w-0">
                            {isUnknown ? (
                              <span className="text-white/35 italic">vor Session-Fix (nicht aufschlüsselbar)</span>
                            ) : (
                              <>
                                <span className="text-white/70 font-mono">#{s.id.slice(0, 8)}</span>
                                {s.entryPage && (
                                  <span className="text-[10px] text-white/25 truncate block">Einstieg: {s.entryPage}</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-white/60">{fmt(s.pageViews)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-white/60">{fmt(s.searches)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-blue-400/70">{fmt(s.clicks)}</td>
                      <td className="py-2 px-2 text-white/40 truncate max-w-[160px]">{isUnknown ? '—' : refLabel(s.referrer)}</td>
                      <td className="py-2 pl-2 text-right text-white/40 whitespace-nowrap">{formatLastActive(s.lastActive)}</td>
                    </tr>
                    {open && !isUnknown && (
                      <tr>
                        <td colSpan={6} className="bg-black/20 px-4 py-3">
                          {d === 'loading' || d === undefined ? (
                            <p className="text-[11px] text-white/30">Lade Aktivität…</p>
                          ) : d.length === 0 ? (
                            <p className="text-[11px] text-white/30">Keine Einzel-Events.</p>
                          ) : (
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                              {d.map((ev, i) => (
                                <div key={i} className="flex items-center gap-3 text-[11px]">
                                  <span className="text-white/30 w-28 shrink-0 tabular-nums">
                                    {new Date(ev.created_at).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/60 shrink-0">{ev.event_type}</span>
                                  <span className="text-white/40 truncate">
                                    {ev.page ?? ''}
                                    {ev.event_data && drillDetail(ev.event_data) ? ` · ${drillDetail(ev.event_data)}` : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}

/* ─── Sub-components ──────────────────────────────── */

function AnimatedSection({ children, index }: { children: React.ReactNode; index: number }) {
  return (
    <div
      className="analytics-animate"
      style={{
        animation: `analyticsSlideUp 350ms ease-out ${index * 60}ms both`,
      }}
    >
      {children}
    </div>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] analytics-transition transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.08] hover:shadow-[0_0_20px_rgba(255,255,255,0.02)]">
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-8">
      <InboxIcon size={32} className="text-white/10 mx-auto mb-2" />
      <p className="text-xs text-white/20">{text}</p>
    </div>
  );
}

function EmptyDashboard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-20">
      <BarChart3Icon size={48} className="text-white/10 mx-auto mb-4" />
      <h3 className="text-sm font-medium text-white/40 mb-1">Noch keine Analysedaten</h3>
      <p className="text-xs text-white/20 mb-4 max-w-xs mx-auto">
        Sobald Besucher die Seite nutzen, erscheinen hier Statistiken zu Aufrufen, Suchen und Interaktionen.
      </p>
      <button
        onClick={onRetry}
        className="min-h-[44px] min-w-[44px] px-4 py-2 text-xs text-white/30 hover:text-white/60 analytics-transition transition-colors duration-200 underline cursor-pointer"
      >
        Erneut versuchen
      </button>
    </div>
  );
}

function SkeletonPulse({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse bg-white/[0.06] rounded-lg ${className}`} style={style} />;
}

function SkeletonLayout() {
  return (
    <div className="space-y-6">
      {/* Period selector skeleton */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonPulse key={i} className="w-16 h-[44px] rounded-lg" />
        ))}
      </div>

      {/* Overview cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <SkeletonPulse className="w-7 h-7 rounded-lg" />
              <SkeletonPulse className="w-20 h-2" />
            </div>
            <SkeletonPulse className="w-24 h-7 mb-2" />
            <div className="flex gap-3">
              <SkeletonPulse className="w-16 h-2" />
              <SkeletonPulse className="w-16 h-2" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <SkeletonPulse className="w-40 h-3 mb-4" />
        <div className="flex items-end gap-[2px] h-32">
          {Array.from({ length: 14 }).map((_, i) => (
            <SkeletonPulse
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${20 + Math.random() * 60}%` } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      {/* Two-column skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <SkeletonPulse className="w-32 h-3 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="flex items-center gap-2">
                  <SkeletonPulse className="w-5 h-3" />
                  <SkeletonPulse className="flex-1 h-3" />
                  <SkeletonPulse className="w-12 h-3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
