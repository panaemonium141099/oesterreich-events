'use client';

import { useState, useRef, useEffect } from 'react';
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
  variant?: 'compact' | 'expanded';
}

const BATCH_SIZE = 50;

export function EventList({ events, onSelectEvent, selectedEventId, onHoverEvent, eveningMode, loading, variant = 'compact' }: EventListProps) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Reset visible count only when the event SET changes (not reorder).
  // Using `events.length` as the key prevents a full reset when sort swaps
  // items in place, which keeps the scroll position stable.
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [events.length]);

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

  // Loading state without cross-fade: if we already have events to show,
  // render them and the fresh batch replaces them in place — no blank flash.
  if (loading && events.length === 0) {
    return <SkeletonList count={8} eveningMode={eveningMode} />;
  }

  return (
    <div>
      {variant === 'expanded' ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleEvents.map((event, index) => (
            <EventCard
              key={event.id}
              event={event}
              index={index}
              isSelected={selectedEventId === event.id}
              onSelect={() => onSelectEvent(event)}
              onHover={(hovering) => onHoverEvent(hovering ? event.id : null)}
              eveningMode={eveningMode}
              variant="expanded"
            />
          ))}
        </div>
      ) : (
        visibleEvents.map((event, index) => (
          <EventCard
            key={event.id}
            event={event}
            index={index}
            isSelected={selectedEventId === event.id}
            onSelect={() => onSelectEvent(event)}
            onHover={(hovering) => onHoverEvent(hovering ? event.id : null)}
            eveningMode={eveningMode}
          />
        ))
      )}
      {visibleCount < events.length && (
        <div ref={loaderRef} className="py-4 text-center">
          <p className={`text-sm ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
            {visibleCount} von {events.length} angezeigt — scrolle für mehr
          </p>
        </div>
      )}
    </div>
  );
}
