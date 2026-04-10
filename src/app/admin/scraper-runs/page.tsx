'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import { Activity, Clock, AlertTriangle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { StatusBadge } from '@/components/Admin/StatusBadge';

interface PipelineStep {
  status: string;
  duration_ms?: number;
  error?: string;
  reason?: string;
  succeeded?: number;
  failed?: number;
}

interface PipelineRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  trigger: 'cron' | 'manual' | 'github_dispatch';
  status: 'running' | 'success' | 'partial_failure' | 'failed';
  total_events_scraped: number;
  total_events_updated: number;
  total_errors: number;
  pipeline_steps: Record<string, PipelineStep>;
  github_run_url: string | null;
}

interface ScraperHealth {
  name: string;
  display_name: string;
  category: string;
  last_success_at: string | null;
  last_events_found: number;
  runs_last_7d: number;
  failures_last_7d: number;
  avg_duration_ms: number;
  health: 'healthy' | 'degraded' | 'failing' | 'inactive';
}

const HEALTH_DOT: Record<string, string> = {
  healthy: 'bg-emerald-400',
  degraded: 'bg-amber-400',
  failing: 'bg-red-400',
  inactive: 'bg-white/20',
};

const HEALTH_TEXT: Record<string, string> = {
  healthy: 'text-emerald-400',
  degraded: 'text-amber-400',
  failing: 'text-red-400',
  inactive: 'text-white/30',
};

const TRIGGER_STYLES: Record<string, string> = {
  cron: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  manual: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  github_dispatch: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

const TRIGGER_LABELS: Record<string, string> = {
  cron: 'cron',
  manual: 'manual',
  github_dispatch: 'dispatch',
};

const STEP_STATUS_ICON: Record<string, string> = {
  success: '✓',
  failed: '✕',
  skipped: '–',
  running: '…',
};

function formatDuration(start: string, end: string | null): string {
  if (!end) return '--';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const totalSecs = Math.round(ms / 1000);
  if (totalSecs < 60) return `${totalSecs}s`;
  const m = Math.floor(totalSecs / 60);
  return `${m}m ${totalSecs % 60}s`;
}

function formatDurationMs(ms: number | undefined): string {
  if (ms == null) return '--';
  if (ms < 1000) return `${ms}ms`;
  const totalSecs = Math.round(ms / 1000);
  if (totalSecs < 60) return `${totalSecs}s`;
  const m = Math.floor(totalSecs / 60);
  return `${m}m ${totalSecs % 60}s`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-AT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Pipeline Runs Tab ───────────────────────────────────────────────────────

function PipelineRunsTab() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    params.set('limit', '50');
    try {
      const res = await fetch(`/api/admin/scrape-runs?${params}`);
      const data = await res.json();
      setRuns(data.runs || []);
      setTotal(data.total || 0);
    } catch {
      // silent
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/70 focus:outline-none focus:border-white/20"
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="partial_failure">Partial failure</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </select>
        <span className="ml-auto text-sm text-white/40 self-center">{total} total</span>
      </div>

      {loading ? (
        <div className="text-center text-white/40 py-16">Loading...</div>
      ) : runs.length === 0 ? (
        <div className="text-center text-white/40 py-16">No pipeline runs found.</div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-white/50 font-medium w-8" />
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Started</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Trigger</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Duration</th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium">Scraped</th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium">Updated</th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium">Errors</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium w-10">GH</th>
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
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                        {formatDate(run.started_at)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${TRIGGER_STYLES[run.trigger] ?? TRIGGER_STYLES.manual}`}
                        >
                          {TRIGGER_LABELS[run.trigger] ?? run.trigger}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/60">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-white/30" />
                          {formatDuration(run.started_at, run.finished_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/60 text-right">{run.total_events_scraped}</td>
                      <td className="px-4 py-3 text-white/60 text-right">{run.total_events_updated}</td>
                      <td className="px-4 py-3 text-right">
                        {run.total_errors > 0 ? (
                          <span className="flex items-center justify-end gap-1 text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            {run.total_errors}
                          </span>
                        ) : (
                          <span className="text-white/40">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {run.github_run_url ? (
                          <a
                            href={run.github_run_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-white/30 hover:text-white/70 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-white/20">–</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded: pipeline_steps */}
                    {expandedId === run.id && (
                      <tr className="border-b border-white/[0.03]">
                        <td colSpan={9} className="px-4 py-4 bg-white/[0.01]">
                          <div className="mb-3 text-xs text-white/40">
                            Started {formatDate(run.started_at)}
                            {run.finished_at && ` → ${formatDate(run.finished_at)}`}
                          </div>
                          {Object.keys(run.pipeline_steps).length > 0 ? (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-white/[0.04]">
                                  <th className="text-left py-1.5 pr-4 text-white/40 font-medium">Step</th>
                                  <th className="text-left py-1.5 pr-4 text-white/40 font-medium">Status</th>
                                  <th className="text-left py-1.5 pr-4 text-white/40 font-medium">Duration</th>
                                  <th className="text-right py-1.5 pr-4 text-white/40 font-medium">Succeeded</th>
                                  <th className="text-right py-1.5 text-white/40 font-medium">Failed</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(run.pipeline_steps).map(([stepName, step]) => (
                                  <tr key={stepName} className="border-b border-white/[0.02]">
                                    <td className="py-1.5 pr-4 text-white/70 font-mono">{stepName}</td>
                                    <td className="py-1.5 pr-4">
                                      <span
                                        className={
                                          step.status === 'success'
                                            ? 'text-emerald-400'
                                            : step.status === 'failed'
                                              ? 'text-red-400'
                                              : step.status === 'skipped'
                                                ? 'text-white/30'
                                                : 'text-blue-400'
                                        }
                                      >
                                        {STEP_STATUS_ICON[step.status] ?? step.status} {step.status}
                                      </span>
                                    </td>
                                    <td className="py-1.5 pr-4 text-white/50">{formatDurationMs(step.duration_ms)}</td>
                                    <td className="py-1.5 pr-4 text-right text-white/50">
                                      {step.succeeded != null ? step.succeeded : '--'}
                                    </td>
                                    <td className="py-1.5 text-right">
                                      {step.failed != null && step.failed > 0 ? (
                                        <span className="text-amber-400">{step.failed}</span>
                                      ) : (
                                        <span className="text-white/30">{step.failed ?? '--'}</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="text-white/30 text-xs">No step details available.</div>
                          )}
                          {/* Errors from steps */}
                          {Object.entries(run.pipeline_steps)
                            .filter(([, s]) => s.error)
                            .map(([stepName, step]) => (
                              <div
                                key={stepName}
                                className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400"
                              >
                                <span className="font-medium">{stepName}:</span> {step.error}
                              </div>
                            ))}
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

// ─── Scraper Health Tab ──────────────────────────────────────────────────────

function ScraperHealthTab() {
  const [scrapers, setScrapers] = useState<ScraperHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthFilter, setHealthFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/scraper-health');
        const data = await res.json();
        setScrapers(data.scrapers || data || []);
      } catch {
        // silent
      }
      setLoading(false);
    })();
  }, []);

  const categories = Array.from(new Set(scrapers.map((s) => s.category))).sort();

  const filtered = scrapers.filter((s) => {
    if (healthFilter && s.health !== healthFilter) return false;
    if (categoryFilter && s.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/70 focus:outline-none focus:border-white/20"
        >
          <option value="">All health states</option>
          <option value="healthy">Healthy</option>
          <option value="degraded">Degraded</option>
          <option value="failing">Failing</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/70 focus:outline-none focus:border-white/20"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="ml-auto text-sm text-white/40 self-center">
          {filtered.length} / {scrapers.length} scrapers
        </span>
      </div>

      {loading ? (
        <div className="text-center text-white/40 py-16">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-white/40 py-16">No scrapers found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((scraper) => (
            <div
              key={scraper.name}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex flex-col gap-3"
            >
              {/* Header */}
              <div className="flex items-start gap-2">
                <span
                  className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${HEALTH_DOT[scraper.health] ?? 'bg-white/20'}`}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white/80 truncate" title={scraper.display_name}>
                    {scraper.display_name}
                  </div>
                  <div className="text-xs text-white/30 truncate">{scraper.category}</div>
                </div>
              </div>

              {/* Health label */}
              <div className={`text-xs font-medium capitalize ${HEALTH_TEXT[scraper.health] ?? 'text-white/30'}`}>
                {scraper.health}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="text-white/40 block">Last success</span>
                  <span className="text-white/70">{formatRelative(scraper.last_success_at)}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Events found</span>
                  <span className="text-white/70">{scraper.last_events_found}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Runs (7d)</span>
                  <span className="text-white/70">{scraper.runs_last_7d}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Failures (7d)</span>
                  <span className={scraper.failures_last_7d > 0 ? 'text-amber-400' : 'text-white/70'}>
                    {scraper.failures_last_7d}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-white/40 block">Avg duration</span>
                  <span className="text-white/70">{formatDurationMs(scraper.avg_duration_ms)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Tab = 'runs' | 'health';

export default function ScraperRunsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('runs');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-5 h-5 text-white/40" />
        <h1 className="text-2xl font-semibold text-white/90">Scraper Pipeline</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/[0.06]">
        {(
          [
            { id: 'runs', label: 'Pipeline Runs' },
            { id: 'health', label: 'Scraper Health' },
          ] as { id: Tab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-white/60 text-white/90'
                : 'border-transparent text-white/40 hover:text-white/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'runs' ? <PipelineRunsTab /> : <ScraperHealthTab />}
    </div>
  );
}
