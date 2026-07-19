'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Database, Image, MapPin, FileText, Building2, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QualityStats {
  overall: {
    total: number;
    avgQuality: number;
    scoreBuckets: Record<string, number>;
  };
  publishStatus: Record<string, number>;
  sourceQuality: Array<{
    source_name: string;
    event_count: number;
    avg_quality: number;
  }>;
  coverage: {
    withVenue: number;
    withCoords: number;
    withDescription: number;
    withImage: number;
  };
}

// ---------------------------------------------------------------------------
// Score Distribution Bar
// ---------------------------------------------------------------------------

function DistributionBar({
  label,
  count,
  maxCount,
  color,
}: {
  label: string;
  count: number;
  maxCount: number;
  color: string;
}) {
  const widthPct = maxCount > 0 ? Math.max((count / maxCount) * 100, 1) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/50 w-12 text-right tabular-nums">{label}</span>
      <div className="flex-1 h-6 bg-white/[0.04] rounded overflow-hidden">
        <div
          className={`h-full rounded ${color} transition-all duration-500`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="text-xs text-white/70 w-14 tabular-nums">{count.toLocaleString()}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coverage Card
// ---------------------------------------------------------------------------

function CoverageCard({
  label,
  pct,
  icon: Icon,
}: {
  label: string;
  pct: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const color = pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400';
  const bg = pct >= 70 ? 'bg-emerald-400/10' : pct >= 40 ? 'bg-amber-400/10' : 'bg-red-400/10';
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <span className="text-sm text-white/60">{label}</span>
      </div>
      <span className={`text-2xl font-bold tabular-nums ${color}`}>{pct}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status, count }: { status: string; count: number }) {
  const styles: Record<string, string> = {
    published: 'bg-emerald-400/15 text-emerald-400',
    published_low_confidence: 'bg-amber-400/15 text-amber-400',
    needs_review: 'bg-orange-400/15 text-orange-400',
    suppressed: 'bg-red-400/15 text-red-400',
    duplicate: 'bg-purple-400/15 text-purple-400',
    expired: 'bg-gray-400/15 text-gray-400',
    draft: 'bg-blue-400/15 text-blue-400',
    null: 'bg-white/10 text-white/50',
  };
  const style = styles[status] ?? 'bg-white/10 text-white/50';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style}`}>
      {status === 'null' ? 'unset' : status.replace(/_/g, ' ')}
      <span className="tabular-nums opacity-80">{count.toLocaleString()}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function QualityStatsPage() {
  const [stats, setStats] = useState<QualityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/quality-stats');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6">
        <p className="text-red-400">Error: {error ?? 'No data'}</p>
      </div>
    );
  }

  const { overall, publishStatus, sourceQuality, coverage } = stats;
  const bucketEntries = [
    { label: '80-100', count: overall.scoreBuckets['80-100'] ?? 0, color: 'bg-emerald-500' },
    { label: '60-80', count: overall.scoreBuckets['60-80'] ?? 0, color: 'bg-emerald-400/70' },
    { label: '40-60', count: overall.scoreBuckets['40-60'] ?? 0, color: 'bg-amber-400' },
    { label: '20-40', count: overall.scoreBuckets['20-40'] ?? 0, color: 'bg-orange-400' },
    { label: '0-20', count: overall.scoreBuckets['0-20'] ?? 0, color: 'bg-red-400' },
    { label: 'null', count: overall.scoreBuckets['null'] ?? 0, color: 'bg-white/20' },
  ];
  const maxBucketCount = Math.max(...bucketEntries.map((b) => b.count), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-amber-400/10">
          <BarChart3 className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Quality Stats</h1>
          <p className="text-sm text-white/40">
            {overall.total.toLocaleString()} total events
          </p>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-white/40 mb-1">Total Events</p>
          <p className="text-2xl font-bold text-white tabular-nums">
            {overall.total.toLocaleString()}
          </p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <p className="text-xs text-white/40 mb-1">Avg Quality</p>
          <p className="text-2xl font-bold text-amber-400 tabular-nums">{overall.avgQuality}</p>
        </div>
        <CoverageCard label="With Coords" pct={coverage.withCoords} icon={MapPin} />
        <CoverageCard label="With Image" pct={coverage.withImage} icon={Image} />
      </div>

      {/* Coverage grid */}
      <div>
        <h2 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
          <Database className="w-4 h-4" />
          Data Coverage
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CoverageCard label="Venue Linked" pct={coverage.withVenue} icon={Building2} />
          <CoverageCard label="Coordinates" pct={coverage.withCoords} icon={MapPin} />
          <CoverageCard label="Description" pct={coverage.withDescription} icon={FileText} />
          <CoverageCard label="Image" pct={coverage.withImage} icon={Image} />
        </div>
      </div>

      {/* Score distribution */}
      <div>
        <h2 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Score Distribution
        </h2>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5 space-y-2">
          {bucketEntries.map((b) => (
            <DistributionBar
              key={b.label}
              label={b.label}
              count={b.count}
              maxCount={maxBucketCount}
              color={b.color}
            />
          ))}
        </div>
      </div>

      {/* Publish status */}
      <div>
        <h2 className="text-sm font-medium text-white/60 mb-3">Publish Status</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(publishStatus)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <StatusBadge key={status} status={status} count={count} />
            ))}
        </div>
      </div>

      {/* Source quality ranking */}
      <div>
        <h2 className="text-sm font-medium text-white/60 mb-3">Source Quality Ranking</h2>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-2.5 text-xs text-white/40 font-medium">Source</th>
                <th className="text-right px-4 py-2.5 text-xs text-white/40 font-medium">Events</th>
                <th className="text-right px-4 py-2.5 text-xs text-white/40 font-medium">Avg Quality</th>
              </tr>
            </thead>
            <tbody>
              {sourceQuality.slice(0, 30).map((src) => {
                const qColor =
                  src.avg_quality >= 70
                    ? 'text-emerald-400'
                    : src.avg_quality >= 40
                      ? 'text-amber-400'
                      : 'text-red-400/70';
                return (
                  <tr
                    key={src.source_name}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-2 text-white/70 truncate max-w-[200px]">
                      {src.source_name}
                    </td>
                    <td className="px-4 py-2 text-right text-white/50 tabular-nums">
                      {src.event_count.toLocaleString()}
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums font-medium ${qColor}`}>
                      {src.avg_quality}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
