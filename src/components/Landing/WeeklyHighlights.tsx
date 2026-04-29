'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Event } from '@/types/events';
import { formatDate } from '@/lib/utils/date';
import { getCategoryBadgeClass } from '@/lib/event-images';
import { EventImage } from '@/components/Events/EventImage';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

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
  const locationText = event.location_name || event.bundesland || null;

  return (
    <Link href={buildEventUrlV2(event)} className="flex-none w-60 snap-start group block">
      {/* Fixed total height = image 160px + content 90px = 250px — always uniform */}
      <div className="bg-[#111] rounded-2xl overflow-hidden border border-white/8 hover:border-white/20 hover:shadow-xl hover:shadow-black/40 transition-all duration-200">
        {/* Image — fixed height */}
        <div className="relative w-full h-40 bg-white/8 overflow-hidden flex-shrink-0">
          <EventImage
            src={event.image_url}
            category={event.category}
            title={event.title}
            alt={event.title}
            className="w-full h-full group-hover:scale-105 transition-transform duration-500"
            wrapperClassName="w-full h-full"
            showSkeleton={false}
            loading="lazy"
          />
          {/* Category pill — top-left overlay on image */}
          {event.category && (
            <div className="absolute top-2.5 left-2.5 z-10">
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-sm bg-black/50 backdrop-blur-sm text-white/70 border border-white/15">
                {event.category}
              </span>
            </div>
          )}
          {event.event_score && event.event_score >= 55 && (
            <div className="absolute top-2.5 right-2.5 z-10 bg-white/90 text-gray-900 text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide">
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

    // KEINE lat/lng-Params an /api/events/featured.
    // Pre-Refactor: bei jedem unique lat/lng spawnte Vercel eine neue
    // Lambda-Instanz (cold-start ~13s) und der Edge-Cache hatte für jeden
    // Nutzer einen anderen Key. Der API-Endpunkt nutzt lat/lng eh nicht
    // zum Filtern — wir kennzeichnen "in deiner Nähe" nur im Label.
    // Eine generische URL → einen Edge-Cache-Eintrag → instant für alle.
    const loadEvents = async () => {
      try {
        const res = await fetch('/api/events/featured?limit=10');
        const data = await res.json();
        setEvents(data.events ?? []);
      } catch {
        // silently fail — empty state shown
      } finally {
        setLoading(false);
      }
    };

    // Try geolocation just for the LABEL ("in deiner Nähe" vs "diese Woche")
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => setLabel('Top Events in deiner Nähe'),
        () => { /* keep default label */ },
        { timeout: 3000, maximumAge: 300_000 }
      );
    }
    loadEvents();
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
