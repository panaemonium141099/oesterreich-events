'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { downloadICS } from '@/lib/calendar/ics';
import { formatDateCompact, formatTime } from '@/lib/utils/date';
import { getCategoryBadgeClass } from '@/lib/event-images';
import { EventImage } from './EventImage';

interface EventData {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  image_url: string | null;
  category: string | null;
  source_url: string | null;
  description: string | null;
}

interface EventPreviewCardProps {
  eventId: string;
  isMe: boolean;
  onViewDetail?: (event: EventData) => void;
}

export function EventPreviewCard({ eventId, isMe, onViewDetail }: EventPreviewCardProps) {
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, location_name, image_url, category, source_url, description')
        .eq('id', eventId)
        .single();
      if (data) setEvent(data);
      setLoading(false);
    };
    if (eventId) fetchEvent();
  }, [eventId, supabase]);

  if (loading) {
    return (
      <div className={`w-64 rounded-xl overflow-hidden ${isMe ? 'bg-white/10' : 'bg-white/5'} border border-white/10 animate-pulse`}>
        <div className="h-28 bg-white/5" />
        <div className="p-3 space-y-2">
          <div className="h-4 bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-white/10 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className={`px-3 py-2 rounded-xl text-sm ${isMe ? 'bg-white/10 text-white/40' : 'bg-white/5 text-white/30'}`}>
        Event nicht gefunden
      </div>
    );
  }

  const time = formatTime(event.start_date);
  const categoryStyle = getCategoryBadgeClass(event.category, true);

  const handleCalendarAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadICS({
      title: event.title,
      description: event.description,
      start_date: event.start_date,
      end_date: event.end_date,
      location_name: event.location_name,
      source_url: event.source_url,
    });
  };

  return (
    <div className="w-64 rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
      {/* Thumbnail */}
      <EventImage
        src={event.image_url}
        category={event.category}
        title={event.title}
        sizes="256px"
        wrapperClassName="w-full h-28"
        loading="lazy"
      />

      <div className="p-3">
        {/* Category Badge */}
        {event.category && (
          <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-1.5 ${categoryStyle}`}>
            {event.category}
          </span>
        )}

        {/* Title */}
        <p className="text-sm font-medium text-white truncate mb-1">{event.title}</p>

        {/* Date + Time */}
        <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1">
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{formatDateCompact(event.start_date)}</span>
          {time && <span className="text-white/30">{time}</span>}
        </div>

        {/* Location */}
        {event.location_name && (
          <div className="flex items-center gap-1.5 text-xs text-white/30 mb-2">
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span className="truncate">{event.location_name}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-1.5">
          <button
            onClick={() => onViewDetail?.(event)}
            className="flex-1 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-white/90 transition-colors text-center"
          >
            Details anzeigen
          </button>
          <button
            onClick={handleCalendarAdd}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="Zum Kalender"
          >
            <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
