'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Check, EyeOff, Eye } from 'lucide-react';
import { SeverityBadge } from '@/components/Admin/SeverityBadge';

interface QualityFlag {
  id: string;
  event_id: string;
  flag_type: string;
  severity: string;
  message: string | null;
  created_at: string;
  resolved_at: string | null;
  event_title: string | null;
  event_source: string | null;
}

export default function QualityPage() {
  const [flags, setFlags] = useState<QualityFlag[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [flagTypeFilter, setFlagTypeFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);
  const [publishUpdating, setPublishUpdating] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (severityFilter) params.set('severity', severityFilter);
    if (flagTypeFilter) params.set('flagType', flagTypeFilter);
    if (resolvedFilter) params.set('resolved', resolvedFilter);
    params.set('limit', '50');

    try {
      const res = await fetch(`/api/admin/quality-flags?${params}`);
      const data = await res.json();
      setFlags(data.flags || []);
      setTotal(data.total || 0);
    } catch {
      // silent
    }
    setLoading(false);
  }, [severityFilter, flagTypeFilter, resolvedFilter]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const resolveFlag = async (flagId: string) => {
    setResolving(flagId);
    try {
      await fetch(`/api/admin/quality-flags/${flagId}/resolve`, { method: 'POST' });
      setFlags((prev) =>
        prev.map((f) => (f.id === flagId ? { ...f, resolved_at: new Date().toISOString() } : f))
      );
    } catch {
      // silent
    }
    setResolving(null);
  };

  const updatePublishStatus = async (eventId: string, publishStatus: string) => {
    setPublishUpdating(eventId);
    try {
      await fetch(`/api/admin/events/${eventId}/publish-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish_status: publishStatus }),
      });
    } catch {
      // silent
    }
    setPublishUpdating(null);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-AT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  // Extract unique flag types from data
  const flagTypes = Array.from(new Set(flags.map((f) => f.flag_type))).sort();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="w-5 h-5 text-white/40" />
        <h1 className="text-2xl font-semibold text-white/90">Quality Flags</h1>
        <span className="text-sm text-white/40 ml-auto">{total} total</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/70 focus:outline-none focus:border-white/20"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={flagTypeFilter}
          onChange={(e) => setFlagTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/70 focus:outline-none focus:border-white/20"
        >
          <option value="">All flag types</option>
          {flagTypes.map((ft) => (
            <option key={ft} value={ft}>
              {ft.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <select
          value={resolvedFilter}
          onChange={(e) => setResolvedFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/70 focus:outline-none focus:border-white/20"
        >
          <option value="">All</option>
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-white/40 py-16">Loading...</div>
      ) : flags.length === 0 ? (
        <div className="text-center text-white/40 py-16">No quality flags found.</div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Event</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Flag type</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Severity</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Created</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <tr
                    key={flag.id}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="text-white/80 font-medium truncate max-w-[200px]">
                        {flag.event_title || 'Unknown event'}
                      </div>
                      {flag.message && (
                        <div className="text-xs text-white/40 truncate max-w-[200px] mt-0.5">
                          {flag.message}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-white/[0.06] border border-white/[0.06]">
                        {flag.flag_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={flag.severity} />
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs">{formatDate(flag.created_at)}</td>
                    <td className="px-4 py-3">
                      {flag.resolved_at ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <Check className="w-3 h-3" />
                          Resolved
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400">Open</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!flag.resolved_at && (
                          <button
                            onClick={() => resolveFlag(flag.id)}
                            disabled={resolving === flag.id}
                            className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                          >
                            {resolving === flag.id ? '...' : 'Resolve'}
                          </button>
                        )}
                        <button
                          onClick={() => updatePublishStatus(flag.event_id, 'rejected')}
                          disabled={publishUpdating === flag.event_id}
                          title="Suppress event"
                          className="text-xs px-2 py-1 rounded-lg text-red-400/70 hover:bg-red-400/10 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => updatePublishStatus(flag.event_id, 'published')}
                          disabled={publishUpdating === flag.event_id}
                          title="Publish event"
                          className="text-xs px-2 py-1 rounded-lg text-emerald-400/70 hover:bg-emerald-400/10 hover:text-emerald-400 transition-colors disabled:opacity-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
