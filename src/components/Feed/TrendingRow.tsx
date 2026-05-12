'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TrendingEvent } from './feed-types';
import { StoriesViewer } from './StoriesViewer';
import { EventImage } from '@/components/Events/EventImage';
import { isUsableImageCandidate } from '@/lib/event-images';

// Pool size for daily rotation — we randomize within the N nearest events,
// so the user still sees local events but different ones each day.
const POOL_SIZE = 50;
const VISIBLE_COUNT = 15;

/** Deterministic per-day seed: hash "YYYY-MM-DD" to a 32-bit uint. */
function dailySeed(): number {
  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, seeded PRNG — deterministic for a given seed. */
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle driven by a seeded PRNG — stable within the day. */
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

      // Fetch only events with a real image (no placeholders in story circles)
      // and coordinates so we can distance-sort. image_url IS NOT NULL alone isn't
      // enough — some rows store empty strings — additional client-side filter below.
      const { data } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, location_name, image_url, category, save_count, latitude, longitude, event_series_id, content_fingerprint, slug, postal_code, address, bundesland')
        .gte('start_date', new Date().toISOString())
        .lte('start_date', nextMonth.toISOString())
        .eq('visibility', 'public')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .order('start_date', { ascending: true })
        .limit(500);

      if (!data) {
        setEvents([]);
        setLoading(false);
        return;
      }

      // Extra client-side guard: reject data URIs / obviously-bad URLs
      const withRealImages = data.filter((e: { image_url: string | null }) =>
        isUsableImageCandidate(e.image_url),
      );

      // Deduplicate recurring series / near-duplicates. Keep the earliest
      // occurrence per group. Key preference: event_series_id → content_fingerprint
      // → normalized title + location.
      const seen = new Set<string>();
      const deduped: typeof withRealImages = [];
      for (const e of withRealImages) {
        const row = e as Record<string, unknown>;
        const seriesId = row.event_series_id as string | null;
        const fingerprint = row.content_fingerprint as string | null;
        const title = (row.title as string | null) ?? '';
        const location = (row.location_name as string | null) ?? '';
        const key =
          seriesId ||
          fingerprint ||
          `${title.toLowerCase().replace(/\s+/g, ' ').trim()}|${location.toLowerCase().trim()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(e);
      }

      let pool: typeof deduped;

      if (hasRealLocation && userLat && userLng) {
        // Haversine distance sort — nearest first
        const lat1 = userLat;
        const lng1 = userLng;
        const withDistance = deduped.map((e: Record<string, unknown>) => {
          const lat2 = e.latitude as number;
          const lng2 = e.longitude as number;
          const R = 6371;
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLng = (lng2 - lng1) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
          const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return { ...e, distance: d };
        });
        // Take nearest POOL_SIZE as candidates for daily rotation
        pool = withDistance.sort(
          (a: { distance: number }, b: { distance: number }) => a.distance - b.distance,
        ).slice(0, POOL_SIZE);
      } else {
        // No location — rotate within the nearest-by-date-only pool
        pool = deduped.slice(0, POOL_SIZE);
      }

      // Shuffle the pool with a daily seed → varies once per day, stable within the day
      const rng = mulberry32(dailySeed());
      const picked = seededShuffle(pool, rng).slice(0, VISIBLE_COUNT);

      setEvents(picked as TrendingEvent[]);
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
                <div className="w-[62px] h-[62px] rounded-full bg-slate-100 animate-pulse" />
                <div className="w-10 h-2 rounded bg-slate-50 animate-pulse" />
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
                  <div className="w-full h-full rounded-full p-[2px] bg-[#f8fafc]">
                    <div className="w-full h-full rounded-full overflow-hidden">
                      <EventImage
                        src={event.image_url}
                        category={event.category}
                        title={event.id}
                        alt={event.title}
                        sizes="62px"
                        className="group-hover:scale-110 transition-transform duration-300"
                        wrapperClassName="w-full h-full"
                        showSkeleton={false}
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 text-center truncate max-w-[66px] leading-tight">
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
