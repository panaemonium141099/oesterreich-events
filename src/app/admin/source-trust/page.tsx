'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ArrowUpDown } from 'lucide-react';
import { ScoreBar } from '@/components/Admin/ScoreBar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SourceTrustData {
  sourceName: string;
  eventCount: number;
  avgQualityScore: number;
  venueMatchRate: number;
  duplicateRate: number;
  coordsRate: number;
  descriptionRate: number;
  imageRate: number;
  ticketRate: number;
  futureEventRate: number;
  trustScore: number;
}

type SortKey = 'trustScore' | 'eventCount' | 'avgQualityScore' | 'venueMatchRate' | 'duplicateRate' | 'coordsRate' | 'descriptionRate';

// ---------------------------------------------------------------------------
// Trust Score Badge
// ---------------------------------------------------------------------------

function TrustBadge({ score }: { score: number }) {
  const style =
    score >= 70
      ? 'bg-emerald-400/15 text-emerald-400'
      : score >= 40
        ? 'bg-amber-400/15 text-amber-400'
        : 'bg-red-400/15 text-red-400';

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium tabular-nums ${style}`}>
      {score}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Rate Cell
// ---------------------------------------------------------------------------

function RateCell({ value }: { value: number }) {
  const color =
    value >= 70 ? 'text-emerald-400' : value >= 40 ? 'text-amber-400' : 'text-red-400/70';
  return <span className={`text-xs tabular-nums ${color}`}>{value}%</span>;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SourceTrustPage() {
  const [sources, setSources] = useState<SourceTrustData[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('trustScore');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/source-trust');
      const data = await res.json();
      setSources(data.sources || []);
      setTotalEvents(data.totalEvents || 0);
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const filtered = sources
    .filter((s) =>
      search.trim()
        ? s.sourceName.toLowerCase().includes(search.toLowerCase())
        : true
    )
    .sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  // Summary stats
  const avgTrust = sources.length > 0
    ? Math.round(sources.reduce((s, x) => s + x.trustScore, 0) / sources.length)
    : 0;
  const greenCount = sources.filter((s) => s.trustScore >= 70).length;
  const yellowCount = sources.filter((s) => s.trustScore >= 40 && s.trustScore < 70).length;
  const redCount = sources.filter((s) => s.trustScore < 40).length;

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="text-right px-4 py-3 text-xs text-white/40 font-medium cursor-pointer hover:text-white/60 select-none"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === field && <ArrowUpDown className="w-3 h-3" />}
      </span>
    </th>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="w-5 h-5 text-white/40" />
        <h1 className="text-2xl font-semibold text-white/90">Source Trust</h1>
        <span className="text-sm text-white/40 ml-auto">
          {sources.length} sources / {totalEvents.toLocaleString()} events
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="text-xs text-white/50 mb-1">Avg Trust</div>
          <div className="text-xl font-semibold text-white/90">{avgTrust}</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="text-xs text-white/50 mb-1">Healthy (70+)</div>
          <div className="text-xl font-semibold text-emerald-400">{greenCount}</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="text-xs text-white/50 mb-1">Warning (40-69)</div>
          <div className="text-xl font-semibold text-amber-400">{yellowCount}</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="text-xs text-white/50 mb-1">Low (&lt;40)</div>
          <div className="text-xl font-semibold text-red-400">{redCount}</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search source..."
          className="w-full max-w-xs px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder-white/30 focus:outline-none focus:border-white/20"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-white/40 py-16">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-white/40 py-16">No sources found.</div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Source</th>
                  <SortHeader label="Events" field="eventCount" />
                  <SortHeader label="Trust" field="trustScore" />
                  <SortHeader label="Avg Quality" field="avgQualityScore" />
                  <SortHeader label="Venue%" field="venueMatchRate" />
                  <SortHeader label="Dup%" field="duplicateRate" />
                  <SortHeader label="Coords%" field="coordsRate" />
                  <SortHeader label="Desc%" field="descriptionRate" />
                  <th className="text-right px-4 py-3 text-xs text-white/40 font-medium">Trust Bar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.sourceName}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 text-white/80 font-medium truncate max-w-[200px]">
                      {s.sourceName}
                    </td>
                    <td className="px-4 py-3 text-right text-white/60 tabular-nums">
                      {s.eventCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TrustBadge score={s.trustScore} />
                    </td>
                    <td className="px-4 py-3 text-right text-white/60 tabular-nums text-xs">
                      {s.avgQualityScore}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RateCell value={s.venueMatchRate} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RateCell value={s.duplicateRate} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RateCell value={s.coordsRate} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RateCell value={s.descriptionRate} />
                    </td>
                    <td className="px-4 py-3 w-32">
                      <ScoreBar score={s.trustScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
