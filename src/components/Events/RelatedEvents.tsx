'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDateCompact, formatTime } from '@/lib/utils/date';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { getCategoryBadgeClass } from '@/lib/event-images';
import { EventImage } from './EventImage';

interface RelatedEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  image_url: string | null;
  category: string | null;
  slug?: string | null;
  // Additional fields for V2 URL generation (via buildEventUrlV2). All
  // optional because the API may still serve older rows without them.
  postal_code?: string | null;
  address?: string | null;
  bundesland?: string | null;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-white/5 border border-white/10 animate-pulse">
      <div className="h-32 bg-white/5" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
      </div>
    </div>
  );
}

export function RelatedEvents({ eventId }: { eventId: string }) {
  const [events, setEvents] = useState<RelatedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRelated = async () => {
      try {
        const res = await fetch(
          `/api/events/related?eventId=${eventId}&limit=4`,
        );
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events ?? []);
        }
      } catch {
        // Silently fail — related events are non-critical
      } finally {
        setLoading(false);
      }
    };
    fetchRelated();
  }, [eventId]);

  if (!loading && events.length === 0) return null;

  return (
    <section className="mt-10 pt-8 border-t border-white/10">
      <h2 className="text-lg font-semibold text-white mb-4">
        Ahnliche Events
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : events.map((event) => {
              const time = formatTime(event.start_date);
              const categoryStyle = getCategoryBadgeClass(event.category, true);

              return (
                <Link
                  key={event.id}
                  href={buildEventUrlV2(event)}
                  className="rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-colors group"
                >
                  <EventImage
                    src={event.image_url}
                    category={event.category}
                    title={event.title}
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="group-hover:scale-105 transition-transform duration-300"
                    wrapperClassName="h-32"
                    showSkeleton={false}
                    loading="lazy"
                  />

                  <div className="p-3">
                    {event.category && (
                      <span
                        className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-1.5 ${categoryStyle}`}
                      >
                        {event.category}
                      </span>
                    )}

                    <p className="text-sm font-medium text-white truncate mb-1">
                      {event.title}
                    </p>

                    <div className="flex items-center gap-1.5 text-xs text-white/40">
                      <span>{formatDateCompact(event.start_date)}</span>
                      {time && (
                        <span className="text-white/30">{time}</span>
                      )}
                    </div>

                    {event.location_name && (
                      <p className="text-xs text-white/30 mt-0.5 truncate">
                        {event.location_name}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
      </div>
    </section>
  );
}
