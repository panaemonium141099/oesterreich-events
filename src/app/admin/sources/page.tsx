'use client';

import { useState, useEffect } from 'react';
import { Database } from 'lucide-react';
import { DataTable } from '@/components/Admin/DataTable';
import { ScoreBar } from '@/components/Admin/ScoreBar';

interface Source {
  source_name: string;
  total_runs: number;
  success_count: number;
  error_count: number;
  avg_quality_score: number | null;
  last_run_at: string | null;
  total_events_inserted: number;
  avg_parser_errors: number;
  total_events: number;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSources() {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/sources');
        const data = await res.json();
        setSources(data.sources || []);
      } catch {
        // silent
      }
      setLoading(false);
    }
    fetchSources();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('de-AT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  type Row = Record<string, unknown>;

  const columns = [
    {
      key: 'source_name',
      label: 'Source',
      sortable: true,
      render: (row: Row) => (
        <span className="font-medium text-white/80">{String(row.source_name)}</span>
      ),
    },
    {
      key: 'last_run_at',
      label: 'Last run',
      sortable: true,
      render: (row: Row) => (
        <span className="text-xs text-white/50">{formatDate(row.last_run_at as string | null)}</span>
      ),
    },
    {
      key: 'total_runs',
      label: 'Total runs',
      sortable: true,
    },
    {
      key: 'success_rate',
      label: 'Success rate',
      sortable: false,
      render: (row: Row) => {
        const totalRuns = row.total_runs as number;
        const successCount = row.success_count as number;
        const rate = totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0;
        return (
          <span
            className={`text-xs font-medium ${
              rate >= 80 ? 'text-emerald-400' : rate >= 50 ? 'text-amber-400' : 'text-red-400'
            }`}
          >
            {rate}%
          </span>
        );
      },
    },
    {
      key: 'avg_quality_score',
      label: 'Avg quality',
      sortable: true,
      render: (row: Row) => {
        const score = row.avg_quality_score as number | null;
        return score != null ? (
          <div className="w-24">
            <ScoreBar score={score} />
          </div>
        ) : (
          <span className="text-white/30 text-xs">--</span>
        );
      },
    },
    {
      key: 'total_events',
      label: 'Events',
      sortable: true,
    },
    {
      key: 'avg_parser_errors',
      label: 'Avg errors',
      sortable: true,
      render: (row: Row) => {
        const errors = row.avg_parser_errors as number;
        return (
          <span className={errors > 5 ? 'text-amber-400' : 'text-white/50'}>
            {errors}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Database className="w-5 h-5 text-white/40" />
        <h1 className="text-2xl font-semibold text-white/90">Sources</h1>
        <span className="text-sm text-white/40 ml-auto">{sources.length} sources</span>
      </div>

      {loading ? (
        <div className="text-center text-white/40 py-16">Loading...</div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
          <DataTable
            columns={columns}
            data={sources as unknown as Record<string, unknown>[]}
            keyField="source_name"
            emptyMessage="No sources found."
          />
        </div>
      )}
    </div>
  );
}
