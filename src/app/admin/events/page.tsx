'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Search, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { StatusBadge } from '@/components/Admin/StatusBadge';
import { ScoreBar } from '@/components/Admin/ScoreBar';

interface EventRow {
  id: string;
  title: string;
  start_date: string;
  location_name: string | null;
  category: string | null;
  source_name: string | null;
  source_type: string;
  bundesland: string | null;
  quality_score: number | null;
  publish_status: string | null;
}

interface EventStats {
  byCategory: { category: string; count: number }[];
  byBundesland: { bundesland: string; count: number }[];
}

export default function EventsPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventSearch, setEventSearch] = useState('');
  const [publishStatusFilter, setPublishStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('events')
      .select('id, title, start_date, location_name, category, source_name, source_type, bundesland, quality_score, publish_status')
      .order('start_date', { ascending: false })
      .limit(50);

    if (eventSearch.trim()) {
      query = query.ilike('title', `%${eventSearch}%`);
    }
    if (publishStatusFilter) {
      query = query.eq('publish_status', publishStatusFilter);
    }

    const { data } = await query;
    setEvents((data as EventRow[]) || []);

    // Event stats
    const { data: catData } = await supabase
      .from('events')
      .select('category')
      .not('category', 'is', null);

    const catCounts: Record<string, number> = {};
    (catData || []).forEach((e: { category: string | null }) => {
      if (e.category) catCounts[e.category] = (catCounts[e.category] || 0) + 1;
    });

    const { data: blData } = await supabase
      .from('events')
      .select('bundesland')
      .not('bundesland', 'is', null);

    const blCounts: Record<string, number> = {};
    (blData || []).forEach((e: { bundesland: string | null }) => {
      if (e.bundesland) blCounts[e.bundesland] = (blCounts[e.bundesland] || 0) + 1;
    });

    setEventStats({
      byCategory: Object.entries(catCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      byBundesland: Object.entries(blCounts)
        .map(([bundesland, count]) => ({ bundesland, count }))
        .sort((a, b) => b.count - a.count),
    });

    setLoading(false);
  }, [supabase, eventSearch, publishStatusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => fetchEvents(), 300);
    return () => clearTimeout(timer);
  }, [fetchEvents]);

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Event wirklich loschen?')) return;
    await supabase.from('events').delete().eq('id', eventId);
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-AT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-5 h-5 text-white/40" />
        <h1 className="text-2xl font-semibold text-white/90">Events</h1>
      </div>

      {/* Search and filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            placeholder="Events suchen..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
          />
        </div>

        <select
          value={publishStatusFilter}
          onChange={(e) => setPublishStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/70 focus:outline-none focus:border-white/20"
        >
          <option value="">All publish statuses</option>
          <option value="published">Published</option>
          <option value="published_low_confidence">Published (low confidence)</option>
          <option value="needs_review">Needs review</option>
          <option value="suppressed">Suppressed</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {/* Event Stats Summary */}
      {eventStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <h4 className="text-xs text-white/40 uppercase tracking-wider mb-3">By Category</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {eventStats.byCategory.slice(0, 10).map((c) => (
                <div key={c.category} className="flex items-center justify-between">
                  <span className="text-xs text-white/60 truncate">{c.category}</span>
                  <span className="text-xs text-white/30">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <h4 className="text-xs text-white/40 uppercase tracking-wider mb-3">By Bundesland</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {eventStats.byBundesland.map((bl) => (
                <div key={bl.bundesland} className="flex items-center justify-between">
                  <span className="text-xs text-white/60 truncate">{bl.bundesland}</span>
                  <span className="text-xs text-white/30">{bl.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Events list */}
      {loading ? (
        <div className="text-center text-white/40 py-16">Loading...</div>
      ) : events.length === 0 ? (
        <div className="text-center text-white/40 py-16">No events found.</div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-white/90">{e.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-white/30">{formatDate(e.start_date)}</span>
                  {e.location_name && (
                    <span className="text-xs text-white/20 truncate">{e.location_name}</span>
                  )}
                </div>
              </div>

              {/* Quality score */}
              {e.quality_score != null && (
                <div className="w-20 shrink-0">
                  <ScoreBar score={e.quality_score} />
                </div>
              )}

              {/* Publish status */}
              {e.publish_status && (
                <div className="shrink-0">
                  <StatusBadge status={e.publish_status} />
                </div>
              )}

              {e.category && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40 shrink-0">
                  {e.category}
                </span>
              )}
              {e.source_name && (
                <span className="text-[10px] text-white/20 shrink-0">{e.source_name}</span>
              )}
              <button
                onClick={() => deleteEvent(e.id)}
                className="p-1.5 rounded-lg text-red-400/60 hover:bg-red-400/10 hover:text-red-400 transition-colors shrink-0"
                title="Delete event"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
