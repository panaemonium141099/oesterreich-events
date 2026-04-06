'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArtistEventCard } from './ArtistEventCard';
import type { ArtistEvent } from './ArtistEventCard';
import { SkeletonList } from '@/components/UI/Skeleton';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface ArtistEventsSectionProps {
  onSelectEvent: (event: ArtistEvent) => void;
  selectedEventId: string | null;
  onHoverEvent: (id: string | null) => void;
  eveningMode?: boolean;
}

const BATCH_SIZE = 50;

function getTimeGroup(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);

  // Diese Woche: same ISO week
  const nowDay = now.getDay() || 7; // convert Sunday=0 to 7
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (7 - nowDay));
  endOfWeek.setHours(23, 59, 59, 999);

  if (date <= endOfWeek) return 'Diese Woche';

  // Naechste Woche
  const endOfNextWeek = new Date(endOfWeek);
  endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);
  if (date <= endOfNextWeek) return 'Naechste Woche';

  // Diesen Monat
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  if (date <= endOfMonth) return 'Diesen Monat';

  return 'Spaeter';
}

const GROUP_ORDER = ['Diese Woche', 'Naechste Woche', 'Diesen Monat', 'Spaeter'];

export function ArtistEventsSection({
  onSelectEvent,
  selectedEventId,
  onHoverEvent,
  eveningMode,
}: ArtistEventsSectionProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const shouldReduceMotion = useReducedMotion();

  const [events, setEvents] = useState<ArtistEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [reminders, setReminders] = useState<Set<string>>(new Set());
  const loaderRef = useRef<HTMLDivElement>(null);

  // Fetch artist events
  const fetchArtistEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/artists/events?limit=200');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch existing reminders
  const fetchReminders = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('event_reminders')
        .select('event_id')
        .eq('user_id', user.id);
      if (data) {
        setReminders(new Set(data.map((r: { event_id: string }) => r.event_id)));
      }
    } catch {
      // event_reminders table may not exist yet - silently handle
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) {
      fetchArtistEvents();
      fetchReminders();
    }
  }, [user, fetchArtistEvents, fetchReminders]);

  // Reset visible count when events change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [events]);

  // Infinite scroll
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

  // Toggle reminder
  const toggleReminder = async (eventId: string) => {
    if (!user) return;

    if (reminders.has(eventId)) {
      // Remove reminder
      try {
        await supabase
          .from('event_reminders')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', eventId);
        setReminders(prev => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      } catch {
        // silently handle
      }
    } else {
      // Create reminder
      try {
        await supabase
          .from('event_reminders')
          .insert({ user_id: user.id, event_id: eventId });
        setReminders(prev => new Set(prev).add(eventId));
      } catch {
        // silently handle
      }
    }
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  if (loading) {
    return <SkeletonList count={6} eveningMode={eveningMode} />;
  }

  if (events.length === 0) {
    return <ArtistEventsEmptyState eveningMode={eveningMode} />;
  }

  // Group events by time period
  const visibleEvents = events.slice(0, visibleCount);
  const grouped = new Map<string, ArtistEvent[]>();

  for (const event of visibleEvents) {
    const group = getTimeGroup(event.start_date);
    if (!grouped.has(group)) {
      grouped.set(group, []);
    }
    grouped.get(group)!.push(event);
  }

  // Sort groups in defined order
  const sortedGroups = GROUP_ORDER.filter(g => grouped.has(g));

  let globalIndex = 0;

  return (
    <div>
      <AnimatePresence mode="wait">
        <motion.div
          key="artist-events"
          initial={shouldReduceMotion ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          {sortedGroups.map((groupName) => {
            const groupEvents = grouped.get(groupName) || [];
            const isCollapsed = collapsedGroups.has(groupName);

            return (
              <div key={groupName}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(groupName)}
                  className={`w-full flex items-center justify-between px-4 py-2 sticky top-0 z-10 ${
                    eveningMode
                      ? 'bg-slate-900/90 backdrop-blur-sm border-b border-gray-700/40'
                      : 'bg-white/90 backdrop-blur-sm border-b border-slate-100'
                  }`}
                >
                  <span className={`text-xs font-semibold uppercase tracking-wider ${
                    eveningMode ? 'text-gray-400' : 'text-slate-500'
                  }`}>
                    {groupName}
                    <span className={`ml-2 text-[10px] font-normal ${
                      eveningMode ? 'text-gray-600' : 'text-slate-400'
                    }`}>
                      ({groupEvents.length})
                    </span>
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isCollapsed ? '' : 'rotate-180'
                    } ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Group events */}
                {!isCollapsed && groupEvents.map((event) => {
                  const idx = globalIndex++;
                  return (
                    <ArtistEventCard
                      key={event.id}
                      event={event}
                      index={idx}
                      isSelected={selectedEventId === event.id}
                      onSelect={() => onSelectEvent(event)}
                      onHover={(hovering) => onHoverEvent(hovering ? event.id : null)}
                      eveningMode={eveningMode}
                      reminderActive={reminders.has(event.id)}
                      onToggleReminder={() => toggleReminder(event.id)}
                    />
                  );
                })}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {visibleCount < events.length && (
        <div ref={loaderRef} className="py-4 text-center">
          <p className={`text-sm animate-fade-in ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
            {visibleCount} von {events.length} angezeigt -- scrolle fuer mehr
          </p>
        </div>
      )}
    </div>
  );
}

function ArtistEventsEmptyState({ eveningMode }: { eveningMode?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <svg className={`w-12 h-12 mb-3 ${eveningMode ? 'text-gray-600' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
      <p className={`text-sm font-medium ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
        Noch keine Events gefunden
      </p>
      <p className={`text-xs mt-1 text-center ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`}>
        Folge Kuenstlern um benachrichtigt zu werden!
      </p>
      <Link
        href="/artists"
        className={`mt-4 text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
          eveningMode
            ? 'bg-purple-600 hover:bg-purple-500 text-white'
            : 'bg-purple-600 hover:bg-purple-700 text-white'
        }`}
      >
        Kuenstler entdecken
      </Link>
    </div>
  );
}
