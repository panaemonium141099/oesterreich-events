'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDateCompact, formatTime } from '@/lib/utils/date';

interface RelatedEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  image_url: string | null;
  category: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  Musik: 'bg-purple-500/20 text-purple-400',
  Nightlife: 'bg-pink-500/20 text-pink-400',
  'Wein & Kulinarik': 'bg-amber-500/20 text-amber-400',
  Kultur: 'bg-blue-500/20 text-blue-400',
  'Markte': 'bg-orange-500/20 text-orange-400',
  Sport: 'bg-green-500/20 text-green-400',
  Familie: 'bg-cyan-500/20 text-cyan-400',
  Natur: 'bg-emerald-500/20 text-emerald-400',
  'Feste & Brauchtum': 'bg-red-500/20 text-red-400',
  Bildung: 'bg-indigo-500/20 text-indigo-400',
  Gesundheit: 'bg-teal-500/20 text-teal-400',
  Religion: 'bg-yellow-500/20 text-yellow-400',
  Sonstiges: 'bg-gray-500/20 text-gray-400',
};

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
              const categoryStyle =
                CATEGORY_COLORS[event.category || ''] ||
                'bg-white/10 text-white/50';

              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-colors group"
                >
                  {event.image_url && (
                    <div className="relative h-32 overflow-hidden">
                      <Image
                        src={event.image_url}
                        alt=""
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                    </div>
                  )}

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
