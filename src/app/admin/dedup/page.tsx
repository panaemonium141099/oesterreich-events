'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  GitMerge,
  Layers,
  AlertTriangle,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  SkipForward,
  Loader2,
} from 'lucide-react';
import { ScoreBar } from '@/components/Admin/ScoreBar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DedupStats {
  totalClusters: number;
  eventsInClusters: number;
  uncertainCount: number;
  garbageSuppressed: number;
}

interface UncertainPair {
  id: string;
  event_a_id: string;
  event_b_id: string;
  event_a_title: string;
  event_a_source: string | null;
  event_a_date: string | null;
  event_a_location: string | null;
  event_b_title: string;
  event_b_source: string | null;
  event_b_date: string | null;
  event_b_location: string | null;
  title_score: number;
  datetime_score: number;
  venue_score: number;
  geo_score: number;
  url_score: number;
  overall_score: number;
  decision: string;
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm text-white/50">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-white/90">{value.toLocaleString()}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score Breakdown
// ---------------------------------------------------------------------------

function ScoreBreakdown({ pair }: { pair: UncertainPair }) {
  const scores = [
    { label: 'Title', value: pair.title_score },
    { label: 'DateTime', value: pair.datetime_score },
    { label: 'Venue', value: pair.venue_score },
    { label: 'Geo', value: pair.geo_score },
    { label: 'URL', value: pair.url_score },
  ];

  return (
    <div className="grid grid-cols-5 gap-3 mt-3">
      {scores.map((s) => (
        <div key={s.label}>
          <div className="text-xs text-white/40 mb-1">{s.label}</div>
          <ScoreBar score={s.value} maxScore={1} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DedupPage() {
  const [stats, setStats] = useState<DedupStats | null>(null);
  const [pairs, setPairs] = useState<UncertainPair[]>([]);
  const [totalPairs, setTotalPairs] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedPair, setExpandedPair] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dedup/stats');
      const data = await res.json();
      setStats(data);
    } catch {
      // silent
    }
  }, []);

  // Fetch uncertain queue
  const fetchPairs = useCallback(async (cursor?: string) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({ limit: '20' });
      if (cursor) params.set('cursor', cursor);
      const res = await fetch(`/api/admin/dedup/uncertain?${params}`);
      const data = await res.json();

      if (cursor) {
        setPairs((prev) => [...prev, ...(data.pairs || [])]);
      } else {
        setPairs(data.pairs || []);
      }
      setTotalPairs(data.total || 0);
      setNextCursor(data.nextCursor || null);
    } catch {
      // silent
    }

    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    fetchStats();
    fetchPairs();
  }, [fetchStats, fetchPairs]);

  // Resolve a pair
  const resolvePair = async (pairId: string, decision: 'manual_merge' | 'manual_split') => {
    setResolving(pairId);
    try {
      const res = await fetch(`/api/admin/dedup/${pairId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });

      if (res.ok) {
        // Remove from list
        setPairs((prev) => prev.filter((p) => p.id !== pairId));
        setTotalPairs((prev) => prev - 1);
        // Refresh stats
        fetchStats();
      }
    } catch {
      // silent
    }
    setResolving(null);
  };

  // Skip = just remove from the local view (no backend change)
  const skipPair = (pairId: string) => {
    setPairs((prev) => prev.filter((p) => p.id !== pairId));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('de-AT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <GitMerge className="w-5 h-5 text-white/40" />
        <h1 className="text-2xl font-semibold text-white/90">Dedup Dashboard</h1>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Clusters"
            value={stats.totalClusters}
            icon={Layers}
            color="bg-blue-500/10 text-blue-400"
          />
          <StatCard
            label="Events in Clusters"
            value={stats.eventsInClusters}
            icon={GitMerge}
            color="bg-purple-500/10 text-purple-400"
          />
          <StatCard
            label="Uncertain Queue"
            value={stats.uncertainCount}
            icon={AlertTriangle}
            color="bg-amber-500/10 text-amber-400"
          />
          <StatCard
            label="Garbage Suppressed"
            value={stats.garbageSuppressed}
            icon={Trash2}
            color="bg-red-500/10 text-red-400"
          />
        </div>
      )}

      {/* Uncertain Queue */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h2 className="text-lg font-medium text-white/80">Uncertain Queue</h2>
          <span className="text-sm text-white/40 ml-2">{totalPairs} pairs</span>
        </div>
        <p className="text-sm text-white/40 mt-1">
          Pairs that scored between merge and distinct thresholds. Review and decide manually.
        </p>
      </div>

      {loading ? (
        <div className="text-center text-white/40 py-16">Loading...</div>
      ) : pairs.length === 0 ? (
        <div className="text-center text-white/40 py-16">
          No uncertain pairs to review. The queue is empty.
        </div>
      ) : (
        <div className="space-y-3">
          {pairs.map((pair) => {
            const isExpanded = expandedPair === pair.id;
            const isResolving = resolving === pair.id;

            return (
              <div
                key={pair.id}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden"
              >
                {/* Pair Header */}
                <button
                  onClick={() => setExpandedPair(isExpanded ? null : pair.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/80 font-medium truncate">
                        {pair.event_a_title}
                      </span>
                      <span className="text-xs text-white/30">vs</span>
                      <span className="text-sm text-white/80 font-medium truncate">
                        {pair.event_b_title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {pair.event_a_source && (
                        <span className="text-xs text-white/40">{pair.event_a_source}</span>
                      )}
                      {pair.event_b_source && pair.event_b_source !== pair.event_a_source && (
                        <>
                          <span className="text-xs text-white/20">/</span>
                          <span className="text-xs text-white/40">{pair.event_b_source}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-sm font-medium text-amber-400">
                      {(pair.overall_score * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-white/40">similarity</div>
                  </div>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-white/[0.06]">
                    {/* Side-by-side comparison */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="bg-white/[0.02] rounded-lg p-3">
                        <div className="text-xs text-white/40 mb-2 uppercase tracking-wide">Event A</div>
                        <div className="text-sm text-white/80 font-medium">{pair.event_a_title}</div>
                        <div className="text-xs text-white/50 mt-1">{formatDate(pair.event_a_date)}</div>
                        {pair.event_a_location && (
                          <div className="text-xs text-white/40 mt-0.5">{pair.event_a_location}</div>
                        )}
                        {pair.event_a_source && (
                          <div className="text-xs text-white/30 mt-0.5">{pair.event_a_source}</div>
                        )}
                      </div>
                      <div className="bg-white/[0.02] rounded-lg p-3">
                        <div className="text-xs text-white/40 mb-2 uppercase tracking-wide">Event B</div>
                        <div className="text-sm text-white/80 font-medium">{pair.event_b_title}</div>
                        <div className="text-xs text-white/50 mt-1">{formatDate(pair.event_b_date)}</div>
                        {pair.event_b_location && (
                          <div className="text-xs text-white/40 mt-0.5">{pair.event_b_location}</div>
                        )}
                        {pair.event_b_source && (
                          <div className="text-xs text-white/30 mt-0.5">{pair.event_b_source}</div>
                        )}
                      </div>
                    </div>

                    {/* Score Breakdown */}
                    <ScoreBreakdown pair={pair} />

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/[0.06]">
                      <button
                        onClick={() => resolvePair(pair.id, 'manual_merge')}
                        disabled={isResolving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {isResolving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Merge
                      </button>
                      <button
                        onClick={() => resolvePair(pair.id, 'manual_split')}
                        disabled={isResolving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {isResolving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                        Split
                      </button>
                      <button
                        onClick={() => skipPair(pair.id)}
                        disabled={isResolving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.05] text-white/50 hover:bg-white/[0.08] hover:text-white/70 transition-colors text-sm disabled:opacity-50"
                      >
                        <SkipForward className="w-4 h-4" />
                        Skip
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Load More */}
          {nextCursor && (
            <div className="text-center pt-4">
              <button
                onClick={() => fetchPairs(nextCursor)}
                disabled={loadingMore}
                className="px-5 py-2.5 rounded-lg bg-white/[0.05] text-white/60 hover:bg-white/[0.08] hover:text-white/80 transition-colors text-sm disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  'Load more'
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
