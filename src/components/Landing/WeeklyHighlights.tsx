'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Event } from '@/types/events';
import { formatDate } from '@/lib/utils/date';
import { getEventImage } from '@/lib/categoryImages';

const CATEGORY_COLORS: Record<string, string> = {
  'Musik': 'bg-purple-100 text-purple-700',
  'Nightlife': 'bg-violet-100 text-violet-700',
  'Wein & Kulinarik': 'bg-rose-100 text-rose-700',
  'Kultur': 'bg-amber-100 text-amber-700',
  'Märkte': 'bg-green-100 text-green-700',
  'Sport': 'bg-blue-100 text-blue-700',
  'Familie': 'bg-pink-100 text-pink-700',
  'Natur': 'bg-emerald-100 text-emerald-700',
  'Feste & Brauchtum': 'bg-orange-100 text-orange-700',
  'Bildung': 'bg-cyan-100 text-cyan-700',
  'Gesundheit': 'bg-teal-100 text-teal-700',
  'Religion': 'bg-indigo-100 text-indigo-700',
  'Sonstiges': 'bg-slate-100 text-slate-700',
};

function SkeletonCard() {
  return (
    <div className="flex-none w-64 snap-start bg-white/5 rounded-2xl overflow-hidden border border-white/10 animate-pulse">
      <div className="w-full h-40 bg-white/10" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
        <div className="h-3 bg-white/10 rounded w-2/3" />
        <div className="h-5 bg-white/10 rounded-full w-20 mt-2" />
      </div>
    </div>
  );
}

function HighlightCard({ event }: { event: Event }) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = getEventImage(event.image_url, event.category);
  const badgeClass = CATEGORY_COLORS[event.category ?? ''] ?? CATEGORY_COLORS['Sonstiges'];

  return (
    <div className="flex-none w-64 snap-start bg-white/5 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10 hover:border-white/25 transition-colors duration-200">
      <div className="relative w-full h-40 bg-white/10">
        {imageUrl && !imgError ? (
          <Image
            src={imageUrl}
            alt={event.title}
            fill
            className="object-cover"
            sizes="256px"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-4xl select-none">
            🎪
          </div>
        )}
      </div>
      <div className="p-4 space-y-1">
        <p className="text-white font-semibold text-sm leading-tight line-clamp-2">
          {event.title}
        </p>
        <p className="text-white/50 text-xs">
          {formatDate(event.start_date)}
        </p>
        {event.location_name && (
          <p className="text-white/40 text-xs truncate">
            {event.location_name}
          </p>
        )}
        {event.category && (
          <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 ${badgeClass}`}>
            {event.category}
          </span>
        )}
      </div>
    </div>
  );
}

export function WeeklyHighlights() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/events/featured?limit=8')
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setEvents(data.events ?? []);
        }
      })
      .catch(() => {
        // silently fail — empty state shown
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <motion.section
      className="w-full py-8"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-white font-bold text-xl md:text-2xl">
          Highlights der Woche
        </h2>
      </div>

      <div
        className="flex gap-4 overflow-x-auto pb-4"
        style={{ scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' }}
      >
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : events.length === 0 ? (
          <p className="text-white/40 text-sm py-8 px-1">Keine Highlights verfügbar</p>
        ) : (
          events.map(event => (
            <HighlightCard key={event.id} event={event} />
          ))
        )}

        {/* "Alle Events entdecken" link card */}
        {!loading && (
          <div className="flex-none w-48 snap-start flex items-center justify-center">
            <Link
              href="/map"
              className="group flex flex-col items-center gap-2 text-white/60 hover:text-white transition-colors duration-200"
            >
              <span className="text-3xl group-hover:scale-110 transition-transform duration-200">
                &rarr;
              </span>
              <span className="text-sm font-medium text-center leading-snug">
                Alle Events entdecken
              </span>
            </Link>
          </div>
        )}
      </div>
    </motion.section>
  );
}
