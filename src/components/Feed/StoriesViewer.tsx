'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import type { TrendingEvent } from './feed-types';
import { formatEventDate } from './feed-types';
import { getCategoryBadgeClass } from '@/lib/event-images';
import { EventImage } from '@/components/Events/EventImage';

const DURATION = 5000; // 5s per story

interface StoriesViewerProps {
  events: TrendingEvent[];
  initialIndex: number;
  onClose: () => void;
}

export function StoriesViewer({ events, initialIndex, onClose }: StoriesViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const router = useRouter();

  const event = events[index];

  const goNext = useCallback(() => {
    if (index >= events.length - 1) {
      onClose();
    } else {
      setDirection(1);
      setIndex(prev => prev + 1);
      setProgress(0);
    }
  }, [index, events.length, onClose]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      setDirection(-1);
      setIndex(prev => prev - 1);
      setProgress(0);
    } else {
      setProgress(0);
    }
  }, [index]);

  // Auto-advance timer
  useEffect(() => {
    if (paused) return;
    const startTime = Date.now() - progress * DURATION;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(elapsed / DURATION, 1);
      setProgress(p);
      if (p >= 1) {
        goNext();
      }
    }, 30);

    return () => clearInterval(timerRef.current);
  }, [index, paused, goNext, progress]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onClose]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setPaused(false);
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchStartRef.current = null;
  };

  // Tap left/right halves
  const handleTap = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.3) {
      goPrev();
    } else if (x > rect.width * 0.7) {
      goNext();
    }
  };

  const categoryStyle = event?.category ? getCategoryBadgeClass(event.category, true) : '';

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-2 pt-3 pb-1">
        {events.map((_, i) => (
          <div key={i} className="flex-1 h-[2px] rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-none"
              style={{
                width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-8 right-4 z-20 w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
        aria-label="Schließen"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Story content */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={event.id}
          initial={{ opacity: 0, x: direction > 0 ? 60 : -60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction > 0 ? -60 : 60 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="absolute inset-0"
          onClick={handleTap}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
        >
          {/* Blurred background layer */}
          <EventImage
            src={event.image_url}
            category={event.category}
            title={event.id}
            alt=""
            className="absolute inset-0 w-full h-full blur-2xl scale-110 brightness-50"
            wrapperClassName="absolute inset-0"
            showSkeleton={false}
            loading="eager"
          />
          {/* Sharp centered image */}
          <EventImage
            src={event.image_url}
            category={event.category}
            title={event.id}
            alt={event.title}
            className="absolute inset-0 w-full h-full"
            wrapperClassName="absolute inset-0"
            objectFit="contain"
            showSkeleton={false}
            loading="eager"
            fetchPriority="high"
          />

          {/* Top gradient for progress bars */}
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

          {/* Bottom gradient with event info */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-32 pb-10 px-5 pointer-events-none">
            {event.category && (
              <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-md backdrop-blur-sm mb-3 pointer-events-auto ${categoryStyle}`}>
                {event.category}
              </span>
            )}
            <h2 className="text-2xl font-bold text-white leading-tight mb-2">
              {event.title}
            </h2>
            <div className="flex items-center gap-4 text-white/60 text-sm mb-5">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatEventDate(event.start_date)}
              </span>
              {event.location_name && (
                <span className="flex items-center gap-1.5 truncate">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {event.location_name}
                </span>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/events/${event.id}`); }}
              className="pointer-events-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-[0.97] transition-all"
            >
              Event ansehen
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
