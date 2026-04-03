'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TrendingEvent } from './feed-types';
import { StoriesViewer } from './StoriesViewer';
import { getEventImage } from '@/lib/categoryImages';

// Shuffle array (Fisher-Yates) with seed from current hour so it changes per refresh but stays stable within a render
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function TrendingRow() {
  const [events, setEvents] = useState<TrendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchNearbyEvents = async () => {
      // Get user location via browser geolocation
      let userLat: number | null = null;
      let userLng: number | null = null;
      let hasRealLocation = false;

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 600000, // cache 10 min
          });
        });
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        hasRealLocation = true;
      } catch {
        // No location available — will show random events from all of Austria
        userLat = null;
        userLng = null;
      }

      // Fetch upcoming events with coordinates, filter by distance client-side
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);

      const { data } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, location_name, image_url, category, save_count, latitude, longitude')
        .gte('start_date', new Date().toISOString())
        .lte('start_date', nextMonth.toISOString())
        .eq('visibility', 'public')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('start_date', { ascending: true })
        .limit(500);

      if (!data) {
        setEvents([]);
        setLoading(false);
        return;
      }

      let result;

      if (hasRealLocation && userLat && userLng) {
        // Calculate distance for each event using Haversine
        const lat1 = userLat;
        const lng1 = userLng;
        const withDistance = data.map((e: Record<string, unknown>) => {
          const lat2 = e.latitude as number;
          const lng2 = e.longitude as number;
          if (!lat2 || !lng2) return { ...e, distance: 9999 };

          const R = 6371;
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLng = (lng2 - lng1) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
          const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return { ...e, distance: d };
        });

        // 50km radius, fallback to closest events if too few
        const RADIUS_KM = 50;
        let nearby = withDistance.filter((e: { distance: number }) => e.distance <= RADIUS_KM);
        if (nearby.length < 8) {
          nearby = withDistance.sort((a: { distance: number }, b: { distance: number }) => a.distance - b.distance);
        }
        result = nearby;
      } else {
        // No location — just use all events
        result = data;
      }

      // Random shuffle so each refresh shows different events
      const shuffled = shuffleArray(result).slice(0, 15);

      setEvents(shuffled as TrendingEvent[]);
      setLoading(false);
    };

    fetchNearbyEvents();
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
                      <img
                        src={getEventImage(event.image_url, event.category, event.id)}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        loading="lazy"
                      />
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
