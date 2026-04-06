'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDateCompact, formatTime } from '@/lib/utils/date';
import Link from 'next/link';

interface EventData {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  image_url: string | null;
  category: string | null;
  source_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface EventPreviewMessageProps {
  eventId: string;
  isMe: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Musik': 'bg-purple-500/20 text-purple-400',
  'Nightlife': 'bg-pink-500/20 text-pink-400',
  'Wein & Kulinarik': 'bg-amber-500/20 text-amber-400',
  'Kultur': 'bg-blue-500/20 text-blue-400',
  'Märkte': 'bg-orange-500/20 text-orange-400',
  'Sport': 'bg-green-500/20 text-green-400',
  'Familie': 'bg-cyan-500/20 text-cyan-400',
  'Natur': 'bg-emerald-500/20 text-emerald-400',
  'Feste & Brauchtum': 'bg-red-500/20 text-red-400',
  'Bildung': 'bg-indigo-500/20 text-indigo-400',
  'Gesundheit': 'bg-teal-500/20 text-teal-400',
  'Religion': 'bg-yellow-500/20 text-yellow-400',
  'Sonstiges': 'bg-gray-500/20 text-gray-400',
};

export function EventPreviewMessage({ eventId, isMe }: EventPreviewMessageProps) {
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, location_name, image_url, category, source_url, latitude, longitude')
        .eq('id', eventId)
        .single();
      if (data) setEvent(data);
      setLoading(false);
    };
    if (eventId) fetchEvent();
  }, [eventId, supabase]);

  if (loading) {
    return (
      <div className={`w-64 rounded-xl overflow-hidden ${isMe ? 'bg-white/[0.06]' : 'bg-white/[0.04]'} border border-white/[0.06] animate-pulse`}>
        <div className="h-28 bg-white/[0.06]" />
        <div className="p-3 space-y-2">
          <div className="h-4 bg-white/[0.08] rounded w-3/4" />
          <div className="h-3 bg-white/[0.08] rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className={`px-3 py-2 rounded-xl text-sm ${isMe ? 'bg-white/[0.06] text-white/40' : 'bg-white/[0.04] text-white/30'}`}>
        Event nicht gefunden
      </div>
    );
  }

  const time = formatTime(event.start_date);
  const categoryStyle = CATEGORY_COLORS[event.category || ''] || 'bg-white/[0.06] text-white/40';

  // Deep-link: if the event has coordinates, link to map view; otherwise link to source
  const mapLink = event.latitude && event.longitude
    ? `/?event=${event.id}`
    : null;

  return (
    <div className="w-64 rounded-xl overflow-hidden bg-[#141416] border border-white/[0.06] hover:border-white/[0.10] transition-colors shadow-sm">
      {/* Thumbnail */}
      {event.image_url && (
        <div className="w-full h-28 overflow-hidden">
          <img
            src={event.image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-3">
        {/* Category Badge */}
        {event.category && (
          <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-1.5 ${categoryStyle}`}>
            {event.category}
          </span>
        )}

        {/* Title */}
        <p className="text-sm font-medium text-white/90 truncate mb-1">{event.title}</p>

        {/* Date + Time */}
        <div className="flex items-center gap-1.5 text-xs text-white/50 mb-1">
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{formatDateCompact(event.start_date)}</span>
          {time && <span className="text-white/40">{time}</span>}
        </div>

        {/* Location */}
        {event.location_name && (
          <div className="flex items-center gap-1.5 text-xs text-white/40 mb-2">
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span className="truncate">{event.location_name}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-1.5">
          {mapLink ? (
            <Link
              href={mapLink}
              className="flex-1 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-400 transition-colors text-center"
            >
              Auf Karte anzeigen
            </Link>
          ) : event.source_url ? (
            <a
              href={event.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-400 transition-colors text-center"
            >
              Details anzeigen
            </a>
          ) : (
            <span className="flex-1 py-1.5 rounded-lg bg-white/[0.06] text-white/40 text-xs font-medium text-center">
              Event
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
