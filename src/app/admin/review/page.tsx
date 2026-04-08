'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck,
  GitMerge,
  ShieldCheck,
  AlertTriangle,
  Check,
  X,
  EyeOff,
  Eye,
  SkipForward,
  Loader2,
} from 'lucide-react';
import { SeverityBadge } from '@/components/Admin/SeverityBadge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewItem {
  id: string;
  type: 'dedup' | 'quality' | 'confidence';
  event_id: string;
  title: string;
  source_name: string | null;
  severity: string;
  details: string;
  created_at: string;
}

interface ReviewCounts {
  dedup: number;
  quality: number;
  confidence: number;
}

type TabFilter = 'all' | 'dedup' | 'quality' | 'confidence';

// ---------------------------------------------------------------------------
// Tab Button
// ---------------------------------------------------------------------------

function TabButton({
  label,
  count,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
        ${active
          ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
          : 'bg-white/[0.03] text-white/50 border border-white/[0.06] hover:text-white/70 hover:bg-white/[0.05]'
        }
      `}
    >
      <Icon className="w-4 h-4" />
      {label}
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-amber-400/20' : 'bg-white/[0.06]'}`}>
        {count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Type Badge
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: ReviewItem['type'] }) {
  const styles = {
    dedup: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    quality: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
    confidence: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  };
  const labels = {
    dedup: 'Dedup',
    quality: 'Quality',
    confidence: 'Confidence',
  };

  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ReviewQueuePage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [counts, setCounts] = useState<ReviewCounts>({ dedup: 0, quality: 0, confidence: 0 });
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [sourceFilter, setSourceFilter] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '50' });
    if (activeTab !== 'all') params.set('type', activeTab);
    if (sourceFilter) params.set('source_name', sourceFilter);

    try {
      const res = await fetch(`/api/admin/review-queue?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setCounts(data.counts || { dedup: 0, quality: 0, confidence: 0 });
    } catch {
      // silent
    }
    setLoading(false);
  }, [activeTab, sourceFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const resolveItem = async (itemId: string, action: string) => {
    setResolving(itemId);
    try {
      const res = await fetch(`/api/admin/review-queue/${encodeURIComponent(itemId)}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        // Update counts
        const item = items.find((i) => i.id === itemId);
        if (item) {
          setCounts((prev) => ({
            ...prev,
            [item.type]: Math.max(0, prev[item.type] - 1),
          }));
        }
      }
    } catch {
      // silent
    }
    setResolving(null);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-AT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const totalPending = counts.dedup + counts.quality + counts.confidence;

  // Extract unique sources for filter
  const uniqueSources = Array.from(new Set(items.map((i) => i.source_name).filter(Boolean) as string[])).sort();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <ClipboardCheck className="w-5 h-5 text-white/40" />
        <h1 className="text-2xl font-semibold text-white/90">Review Queue</h1>
        <span className="text-sm text-white/40 ml-auto">{totalPending} pending</span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-purple-500/10">
              <GitMerge className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <span className="text-xs text-white/50">Dedup Uncertain</span>
          </div>
          <div className="text-xl font-semibold text-white/90">{counts.dedup.toLocaleString()}</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-orange-500/10">
              <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <span className="text-xs text-white/50">Quality Flags</span>
          </div>
          <div className="text-xl font-semibold text-white/90">{counts.quality.toLocaleString()}</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <AlertTriangle className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <span className="text-xs text-white/50">Low Confidence</span>
          </div>
          <div className="text-xl font-semibold text-white/90">{counts.confidence.toLocaleString()}</div>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <TabButton
          label="All"
          count={totalPending}
          active={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          icon={ClipboardCheck}
        />
        <TabButton
          label="Dedup"
          count={counts.dedup}
          active={activeTab === 'dedup'}
          onClick={() => setActiveTab('dedup')}
          icon={GitMerge}
        />
        <TabButton
          label="Quality"
          count={counts.quality}
          active={activeTab === 'quality'}
          onClick={() => setActiveTab('quality')}
          icon={ShieldCheck}
        />
        <TabButton
          label="Confidence"
          count={counts.confidence}
          active={activeTab === 'confidence'}
          onClick={() => setActiveTab('confidence')}
          icon={AlertTriangle}
        />

        <div className="ml-auto">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/70 focus:outline-none focus:border-white/20"
          >
            <option value="">All sources</option>
            {uniqueSources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Items Table */}
      {loading ? (
        <div className="text-center text-white/40 py-16">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-white/40 py-16">
          No items to review. The queue is empty.
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Event</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Source</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Severity</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Details</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Date</th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isResolving = resolving === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <TypeBadge type={item.type} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white/80 font-medium truncate max-w-[220px]">
                          {item.title}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs">
                        {item.source_name || '--'}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={item.severity} />
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs truncate max-w-[180px]">
                        {item.details}
                      </td>
                      <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Approve / Publish */}
                          {(item.type === 'quality' || item.type === 'confidence') && (
                            <button
                              onClick={() => resolveItem(item.id, 'approve')}
                              disabled={isResolving}
                              title="Approve"
                              className="p-1.5 rounded-lg text-emerald-400/70 hover:bg-emerald-400/10 hover:text-emerald-400 transition-colors disabled:opacity-50"
                            >
                              {isResolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Merge (dedup only) */}
                          {item.type === 'dedup' && (
                            <button
                              onClick={() => resolveItem(item.id, 'merge')}
                              disabled={isResolving}
                              title="Merge"
                              className="p-1.5 rounded-lg text-emerald-400/70 hover:bg-emerald-400/10 hover:text-emerald-400 transition-colors disabled:opacity-50"
                            >
                              {isResolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Split (dedup only) */}
                          {item.type === 'dedup' && (
                            <button
                              onClick={() => resolveItem(item.id, 'split')}
                              disabled={isResolving}
                              title="Split"
                              className="p-1.5 rounded-lg text-red-400/70 hover:bg-red-400/10 hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Suppress */}
                          {(item.type === 'quality' || item.type === 'confidence') && (
                            <button
                              onClick={() => resolveItem(item.id, 'suppress')}
                              disabled={isResolving}
                              title="Suppress"
                              className="p-1.5 rounded-lg text-red-400/70 hover:bg-red-400/10 hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Skip (all types) */}
                          <button
                            onClick={() => resolveItem(item.id, 'skip')}
                            disabled={isResolving}
                            title="Skip"
                            className="p-1.5 rounded-lg text-white/30 hover:bg-white/[0.05] hover:text-white/50 transition-colors disabled:opacity-50"
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
