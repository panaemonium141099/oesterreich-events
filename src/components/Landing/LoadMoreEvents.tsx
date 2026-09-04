'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { Event } from '@/types/events';
import { EventListCard } from '@/components/Events/EventListCard';

interface LoadMoreEventsProps {
  /** Query params to pass to /api/events for pagination parity */
  apiParams: Record<string, string>;
  /** Cursor from the last server-loaded event */
  initialCursor: string | null;
  /** Whether there are more events beyond the initial batch */
  hasMore: boolean;
}

/**
 * Client component for paginating events on landing pages.
 * Uses /api/events with identical filters as the server query.
 */
export function LoadMoreEvents({
  apiParams,
  initialCursor,
  hasMore: initialHasMore,
}: LoadMoreEventsProps) {
  const t = useTranslations('HubLanding');
  const [events, setEvents] = useState<Event[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !cursor) return;
    setLoading(true);

    try {
      const params = new URLSearchParams(apiParams);
      params.set('cursor', cursor);
      params.set('limit', '20');

      const res = await fetch(`/api/events?${params.toString()}`);
      if (!res.ok) return;

      const data = await res.json();
      const newEvents = (data.events ?? []) as Event[];

      setEvents((prev) => [...prev, ...newEvents]);

      const nextCursor = res.headers.get('X-Next-Cursor');
      setCursor(nextCursor);
      setHasMore(!!nextCursor && newEvents.length > 0);
    } catch {
      // Silently fail — pagination is non-critical
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, cursor, apiParams]);

  if (events.length === 0 && !hasMore) return null;

  return (
    <div>
      {events.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {events.map((event) => (
            <EventListCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-2.5 rounded-full text-sm font-medium bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80 transition-colors disabled:opacity-50"
          >
            {loading ? t('loadingMore') : t('loadMore')}
          </button>
        </div>
      )}
    </div>
  );
}
