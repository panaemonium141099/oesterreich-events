'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { EventCard } from './EventCard';
import { SkeletonList } from '@/components/UI/Skeleton';
import type { Event } from '@/types/events';

interface EventListProps {
  events: Event[];
  onSelectEvent: (event: Event) => void;
  selectedEventId: string | null;
  onHoverEvent: (id: string | null) => void;
  eveningMode?: boolean;
  loading?: boolean;
}

const BATCH_SIZE = 50;

export function EventList({ events, onSelectEvent, selectedEventId, onHoverEvent, eveningMode, loading }: EventListProps) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const loaderRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Reset visible count when events change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [events]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < events.length) {
          setVisibleCount(prev => Math.min(prev + BATCH_SIZE, events.length));
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loader);
    return () => observer.disconnect();
  }, [visibleCount, events.length]);

  const visibleEvents = events.slice(0, visibleCount);

  return (
    <div>
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="skeleton"
            initial={shouldReduceMotion ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <SkeletonList count={8} eveningMode={eveningMode} />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={shouldReduceMotion ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            {visibleEvents.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                index={index}
                isSelected={selectedEventId === event.id}
                onSelect={() => onSelectEvent(event)}
                onHover={(hovering) => onHoverEvent(hovering ? event.id : null)}
                eveningMode={eveningMode}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {!loading && visibleCount < events.length && (
        <div ref={loaderRef} className="py-4 text-center">
          <p className={`text-sm animate-fade-in ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
            {visibleCount} von {events.length} angezeigt — scrolle für mehr
          </p>
        </div>
      )}
    </div>
  );
}
