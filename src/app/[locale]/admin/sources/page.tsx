'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { useRouter } from 'next/navigation';

interface SourceMetrics {
  source_name: string;
  event_count: number;
  venue_match_count: number;
  venue_match_rate: number;
  earliest_event: string | null;
  latest_event: string | null;
}

export default function AdminSourcesPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [sources, setSources] = useState<SourceMetrics[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'event_count' | 'venue_match_rate'>('event_count');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
    if (!loading && user && profile && profile.role !== 'god' && profile.role !== 'admin') {
      router.push('/map');
    }
  }, [loading, user, profile, router]);

  const fetchSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const res = await fetch('/api/admin/sources');
      if (!res.ok) throw new Error('Failed to fetch sources');
      const data = await res.json();
      setSources(data.sources || []);
    } catch (err) {
      console.error('Failed to load sources:', err);
    } finally {
      setLoadingSources(false);
    }
  }, []);

  useEffect(() => {
    if (user && profile && (profile.role === 'god' || profile.role === 'admin')) {
      fetchSources();
    }
  }, [user, profile, fetchSources]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-AT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const filtered = sources
    .filter((s) =>
      search.trim()
        ? s.source_name.toLowerCase().includes(search.toLowerCase())
        : true
    )
    .sort((a, b) => {
      if (sortBy === 'venue_match_rate') return b.venue_match_rate - a.venue_match_rate;
      return b.event_count - a.event_count;
    });

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (profile.role !== 'god' && profile.role !== 'admin') {
    return null;
  }

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 60%), #000',
      }}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <Link
          href="/admin"
          className="text-white/40 hover:text-white transition-colors text-sm flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Admin Panel
        </Link>
        <p className="text-xs tracking-[0.2em] uppercase text-white/30">
          Sources
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Search + sort controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Quelle suchen..."
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'event_count' | 'venue_match_rate')
            }
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/30"
          >
            <option value="event_count">Nach Event-Anzahl</option>
            <option value="venue_match_rate">Nach Venue Match %</option>
          </select>
        </div>

        {loadingSources ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <p className="text-xs text-white/30 mb-4">
              {filtered.length} Quellen
            </p>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">
                      Quelle
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-white/40 font-medium">
                      Events
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-white/40 font-medium">
                      Venue Match %
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-white/40 font-medium hidden sm:table-cell">
                      Matched
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-white/40 font-medium hidden md:table-cell">
                      Erstes Event
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-white/40 font-medium hidden md:table-cell">
                      Letztes Event
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr
                      key={s.source_name}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 text-white/80 font-medium truncate max-w-[200px]">
                        {s.source_name}
                      </td>
                      <td className="px-4 py-3 text-right text-white/60 tabular-nums">
                        {s.event_count.toLocaleString('de-AT')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium tabular-nums ${
                            s.venue_match_rate >= 80
                              ? 'bg-green-400/15 text-green-400'
                              : s.venue_match_rate >= 40
                                ? 'bg-amber-400/15 text-amber-400'
                                : 'bg-red-400/15 text-red-400'
                          }`}
                        >
                          {s.venue_match_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-white/40 tabular-nums hidden sm:table-cell">
                        {s.venue_match_count.toLocaleString('de-AT')}
                      </td>
                      <td className="px-4 py-3 text-right text-white/30 text-xs hidden md:table-cell">
                        {formatDate(s.earliest_event)}
                      </td>
                      <td className="px-4 py-3 text-right text-white/30 text-xs hidden md:table-cell">
                        {formatDate(s.latest_event)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
