'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Event } from '@/types/events';
import { formatDate } from '@/lib/utils/date';
import { getEventImage } from '@/lib/categoryImages';

function IconCal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1" y="2" width="12" height="11" rx="1.5" />
      <path d="M1 6h12M5 1v2M9 1v2" strokeLinecap="round" />
    </svg>
  );
}

function IconLoc({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M7 1a4 4 0 0 1 4 4c0 3-4 8-4 8S3 8 3 5a4 4 0 0 1 4-4z" />
      <circle cx="7" cy="5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  Musik: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Nightlife: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'Wein & Kulinarik': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  Kultur: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Märkte: 'bg-green-500/20 text-green-300 border-green-500/30',
  Sport: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Familie: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  Natur: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Feste & Brauchtum': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Bildung: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Gesundheit: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  Religion: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  Sonstiges: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const CATEGORY_FALLBACK = 'bg-white/10 text-white/60 border-white/10';

function SkeletonCard() {
  return (
    <div className="flex-none w-60 snap-start bg-white/4 rounded-2xl overflow-hidden border border-white/8 animate-pulse">
      <div className="w-full h-40 bg-white/8" />
      <div className="p-4 h-[90px] space-y-2.5">
        <div className="h-4 bg-white/8 rounded w-4/5" />
        <div className="h-3 bg-white/8 rounded w-2/5" />
        <div className="h-3 bg-white/8 rounded w-3/5" />
      </div>
    </div>
  );
}

function HighlightCard({ event }: { event: Event }) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = getEventImage(event.image_url, event.category);
  const badgeClass = CATEGORY_COLORS[event.category ?? ''] ?? CATEGORY_FALLBACK;

  const locationText = event.location_name || event.bundesland || null;

  return (
    <Link href={`/events/${event.id}`} className="flex-none w-60 snap-start group block">
      {/* Fixed total height = image 160px + content 90px = 250px — always uniform */}
      <div className="bg-[#111] rounded-2xl overflow-hidden border border-white/8 hover:border-white/20 hover:shadow-xl hover:shadow-black/40 transition-all duration-200">
        {/* Image — fixed height */}
        <div className="relative w-full h-40 bg-white/8 overflow-hidden flex-shrink-0">
          {imageUrl && !imgError ? (
            <Image
              src={imageUrl}
              alt={event.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="240px"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-10 h-10 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {/* Category pill — top-left overlay on image */}
          {event.category && (
            <div className="absolute top-2.5 left-2.5">
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-sm bg-black/50 backdrop-blur-sm text-white/70 border border-white/15">
                {event.category}
              </span>
            </div>
          )}
          {event.event_score && event.event_score >= 55 && (
            <div className="absolute top-2.5 right-2.5 bg-white/90 text-gray-900 text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide">
              Top
            </div>
          )}
        </div>

        {/* Content — fixed height, title can wrap to 3 lines */}
        <div className="p-3.5 h-[100px] flex flex-col justify-between overflow-hidden">
          <p className="text-white font-semibold text-[13px] leading-snug line-clamp-3 group-hover:text-white/85 transition-colors">
            {event.title}
          </p>
          <div className="space-y-0.5 mt-1">
            <div className="flex items-center gap-1.5 text-white/40 text-[11px]">
              <IconCal className="w-3 h-3 shrink-0" />
              <span className="truncate">{formatDate(event.start_date)}</span>
            </div>
            {locationText && (
              <div className="flex items-center gap-1.5 text-white/30 text-[11px]">
                <IconLoc className="w-3 h-3 shrink-0" />
                <span className="truncate">{locationText}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function WeeklyHighlights() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('Top Events diese Woche');
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const loadEvents = async (lat?: number, lng?: number) => {
      try {
        const url = new URL('/api/events/featured', window.location.origin);
        url.searchParams.set('limit', '10');
        if (lat !== undefined && lng !== undefined) {
          url.searchParams.set('lat', lat.toFixed(4));
          url.searchParams.set('lng', lng.toFixed(4));
        }
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const data = await res.json();
        setEvents(data.events ?? []);
      } catch {
        // silently fail — empty state shown
      } finally {
        setLoading(false);
      }
    };

    // Try geolocation for "Events in deiner Nähe"
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setLabel('Top Events in deiner Nähe');
          loadEvents(pos.coords.latitude, pos.coords.longitude);
        },
        () => loadEvents(),
        { timeout: 3000, maximumAge: 300_000 }
      );
    } else {
      loadEvents();
    }
  }, []);

  return (
    <motion.section
      className="w-full py-8"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between mb-5 px-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 mb-1">
            Empfohlen für dich
          </p>
          <h2 className="text-white font-bold text-xl md:text-2xl">{label}</h2>
        </div>
        <Link
          href="/map"
          className="hidden sm:inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm font-medium transition-colors group"
        >
          Alle Events
          <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div
        className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1"
        style={{ scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' }}
      >
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : events.length === 0
          ? <p className="text-white/35 text-sm py-8 px-1">Keine Highlights verfügbar</p>
          : events.map(event => <HighlightCard key={event.id} event={event} />)}

        {!loading && events.length > 0 && (
          <div className="flex-none w-44 snap-start flex items-center justify-center">
            <Link
              href="/map"
              className="group flex flex-col items-center gap-2 text-white/40 hover:text-white/80 transition-colors duration-200 text-center"
            >
              <span className="w-12 h-12 rounded-full border border-white/15 flex items-center justify-center group-hover:border-white/40 transition-colors">
                <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
              <span className="text-xs font-medium leading-snug">
                Alle Events<br />entdecken
              </span>
            </Link>
          </div>
        )}
      </div>
    </motion.section>
  );
}
