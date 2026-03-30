'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { EventCard } from './EventCard';
import type { Event } from '@/types/events';

interface EventListProps {
  events: Event[];
  onSelectEvent: (event: Event) => void;
  selectedEventId: string | null;
  onHoverEvent: (id: string | null) => void;
  eveningMode?: boolean;
}

const BATCH_SIZE = 50;

export function EventList({ events, onSelectEvent, selectedEventId, onHoverEvent, eveningMode }: EventListProps) {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const loaderRef = useRef<HTMLDivElement>(null);

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
      {visibleCount < events.length && (
        <div ref={loaderRef} className="py-4 text-center">
          <p className={`text-sm animate-fade-in ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
            {visibleCount} von {events.length} angezeigt — scrolle für mehr
          </p>
        </div>
      )}
    </div>
  );
}
