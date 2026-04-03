'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TrendingEvent } from './feed-types';
import { StoriesViewer } from './StoriesViewer';

export function TrendingRow() {
  const [events, setEvents] = useState<TrendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchTrending = async () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const { data } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, location_name, image_url, category, save_count')
        .gte('start_date', new Date().toISOString())
        .lte('start_date', nextWeek.toISOString())
        .eq('visibility', 'public')
        .not('image_url', 'is', null)
        .order('save_count', { ascending: false, nullsFirst: false })
        .order('start_date', { ascending: true })
        .limit(12);

      setEvents((data as TrendingEvent[]) || []);
      setLoading(false);
    };
    fetchTrending();
  }, [supabase]);

  if (!loading && events.length === 0) return null;

  return (
    <>
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 py-3"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 shrink-0" style={{ scrollSnapAlign: 'start' }}>
                <div className="w-[62px] h-[62px] rounded-full bg-white/[0.06] animate-pulse" />
                <div className="w-10 h-2 rounded bg-white/[0.04] animate-pulse" />
              </div>
            ))
          ) : (
            events.map((event, i) => (
              <button
                key={event.id}
                onClick={() => { setViewerIndex(i); setViewerOpen(true); }}
                className="flex flex-col items-center gap-1.5 shrink-0 group"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="w-[62px] h-[62px] rounded-full p-[2px]" style={{ background: 'linear-gradient(135deg, #833AB4, #FD1D1D, #F77737)' }}>
                  <div className="w-full h-full rounded-full p-[2px] bg-[#141416]">
                    <div className="w-full h-full rounded-full overflow-hidden">
                      {event.image_url ? (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-white/[0.08] flex items-center justify-center">
                          <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-white/50 text-center truncate max-w-[66px] leading-tight">
                  {event.title.length > 12 ? event.title.slice(0, 12) + '...' : event.title}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Stories fullscreen viewer */}
      {viewerOpen && events.length > 0 && (
        <StoriesViewer
          events={events}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
