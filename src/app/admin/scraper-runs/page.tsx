'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, ChevronDown, ChevronRight, Clock, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '@/components/Admin/StatusBadge';
import { ScoreBar } from '@/components/Admin/ScoreBar';

interface ScrapeRun {
  id: string;
  source_name: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_found: number | null;
  items_inserted: number | null;
  parser_errors: number | null;
  avg_quality_score: number | null;
  error_message: string | null;
  metrics: Record<string, unknown> | null;
}

export default function ScraperRunsPage() {
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sourceFilter) params.set('source', sourceFilter);
    if (statusFilter) params.set('status', statusFilter);
    params.set('limit', '50');

    try {
      const res = await fetch(`/api/admin/scrape-runs?${params}`);
      const data = await res.json();
      setRuns(data.runs || []);
      setTotal(data.total || 0);

      // Extract unique sources for the filter dropdown
      const uniqueSources = Array.from(new Set((data.runs || []).map((r: ScrapeRun) => r.source_name))).sort() as string[];
      if (sources.length === 0 && uniqueSources.length > 0) {
        setSources(uniqueSources);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [sourceFilter, statusFilter, sources.length]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Build unique sources from all runs (initial load)
  useEffect(() => {
    if (sources.length === 0 && runs.length > 0) {
      const unique = Array.from(new Set(runs.map((r) => r.source_name))).sort();
      setSources(unique);
    }
  }, [runs, sources.length]);

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return '--';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-AT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-5 h-5 text-white/40" />
        <h1 className="text-2xl font-semibold text-white/90">Scraper Runs</h1>
        <span className="text-sm text-white/40 ml-auto">{total} total</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/70 focus:outline-none focus:border-white/20"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/70 focus:outline-none focus:border-white/20"
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="running">Running</option>
          <option value="partial">Partial</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-white/40 py-16">Loading...</div>
      ) : runs.length === 0 ? (
        <div className="text-center text-white/40 py-16">No scrape runs found.</div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-white/50 font-medium w-8" />
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Source</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Duration</th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium">Found</th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium">Inserted</th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium">Errors</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium w-32">Quality</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <Fragment key={run.id}>
                    <tr
                      className="border-b border-white/[0.03] cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
                    >
                      <td className="px-4 py-3 text-white/30">
                        {expandedId === run.id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/80 font-medium">{run.source_name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-3 text-white/60">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-white/30" />
                          {formatDuration(run.started_at, run.finished_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/60 text-right">{run.items_found ?? '--'}</td>
                      <td className="px-4 py-3 text-white/60 text-right">{run.items_inserted ?? '--'}</td>
                      <td className="px-4 py-3 text-right">
                        {(run.parser_errors ?? 0) > 0 ? (
                          <span className="flex items-center justify-end gap-1 text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            {run.parser_errors}
                          </span>
                        ) : (
                          <span className="text-white/40">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {run.avg_quality_score != null ? (
                          <ScoreBar score={run.avg_quality_score} />
                        ) : (
                          <span className="text-white/30 text-xs">--</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {expandedId === run.id && (
                      <tr className="border-b border-white/[0.03]">
                        <td colSpan={8} className="px-4 py-4 bg-white/[0.01]">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div>
                              <span className="text-white/40 block mb-1">Started at</span>
                              <span className="text-white/70">{formatDate(run.started_at)}</span>
                            </div>
                            <div>
                              <span className="text-white/40 block mb-1">Finished at</span>
                              <span className="text-white/70">
                                {run.finished_at ? formatDate(run.finished_at) : '--'}
                              </span>
                            </div>
                            <div>
                              <span className="text-white/40 block mb-1">Items found</span>
                              <span className="text-white/70">{run.items_found ?? '--'}</span>
                            </div>
                            <div>
                              <span className="text-white/40 block mb-1">Items inserted</span>
                              <span className="text-white/70">{run.items_inserted ?? '--'}</span>
                            </div>
                          </div>
                          {run.error_message && (
                            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                              {run.error_message}
                            </div>
                          )}
                          {run.metrics && Object.keys(run.metrics).length > 0 && (
                            <div className="mt-3">
                              <span className="text-white/40 text-xs block mb-2">Metrics</span>
                              <pre className="text-xs text-white/50 bg-white/[0.02] rounded-lg p-3 overflow-x-auto">
                                {JSON.stringify(run.metrics, null, 2)}
                              </pre>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Need Fragment for expandable rows
import { Fragment } from 'react';
