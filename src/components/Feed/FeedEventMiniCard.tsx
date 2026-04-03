'use client';

import Image from 'next/image';
import { formatEventDate } from './feed-types';

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
  'Sonstiges': 'bg-gray-500/20 text-gray-400',
};

interface FeedEventMiniCardProps {
  event: {
    id: string;
    title: string;
    start_date: string;
    location_name: string | null;
    image_url: string | null;
    category: string | null;
    save_count?: number | null;
  };
  compact?: boolean;
  fullWidth?: boolean;
  onClick?: (eventId: string) => void;
}

export function FeedEventMiniCard({ event, compact, fullWidth, onClick }: FeedEventMiniCardProps) {
  const categoryStyle = CATEGORY_COLORS[event.category || ''] || 'bg-white/10 text-white/50';

  if (fullWidth) {
    return (
      <div
        className="relative w-full cursor-pointer"
        onClick={() => onClick?.(event.id)}
      >
        {event.image_url ? (
          <div className="relative aspect-[4/5] w-full overflow-hidden">
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* Category badge overlay */}
            {event.category && (
              <span className={`absolute top-3 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-sm ${categoryStyle}`}>
                {event.category}
              </span>
            )}
            {/* Bottom gradient with event info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 pt-12">
              <p className="text-white font-semibold text-sm leading-tight">{event.title}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-white/60 text-xs flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {formatEventDate(event.start_date)}
                </span>
                {event.location_name && (
                  <span className="text-white/60 text-xs flex items-center gap-1 truncate">
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {event.location_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Gradient placeholder when no image */
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-gradient-to-br from-white/[0.08] to-white/[0.02] flex items-center justify-center">
            <div className="text-center px-8">
              {event.category && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${categoryStyle}`}>
                  {event.category}
                </span>
              )}
              <p className="text-white/70 font-semibold text-lg mt-3 leading-tight">{event.title}</p>
              <p className="text-white/30 text-sm mt-2">{formatEventDate(event.start_date)}</p>
              {event.location_name && (
                <p className="text-white/20 text-xs mt-1">{event.location_name}</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <button
        onClick={() => onClick?.(event.id)}
        className="flex items-center gap-2.5 w-full p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 text-left group"
      >
        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-white/5">
          {event.image_url ? (
            <Image src={event.image_url} alt="" width={36} height={36} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/15">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white/90 truncate group-hover:text-white transition-colors">{event.title}</p>
          <p className="text-[10px] text-white/30 truncate">
            {formatEventDate(event.start_date)}
            {event.location_name ? ` \u00b7 ${event.location_name}` : ''}
          </p>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => onClick?.(event.id)}
      className="w-full rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 text-left group"
    >
      {event.image_url && (
        <div className="w-full h-32 overflow-hidden relative">
          <Image
            src={event.image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          {event.category && (
            <span className={`absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm ${categoryStyle}`}>
              {event.category}
            </span>
          )}
        </div>
      )}
      <div className="p-3">
        {!event.image_url && event.category && (
          <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-1.5 ${categoryStyle}`}>
            {event.category}
          </span>
        )}
        <p className="text-sm font-medium text-white/90 truncate group-hover:text-white transition-colors">{event.title}</p>
        <div className="flex items-center gap-1.5 mt-1 text-xs text-white/35">
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{formatEventDate(event.start_date)}</span>
        </div>
        {event.location_name && (
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-white/25">
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span className="truncate">{event.location_name}</span>
          </div>
        )}
        {event.save_count != null && event.save_count > 0 && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-rose-400/70">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span>{event.save_count} gespeichert</span>
          </div>
        )}
      </div>
    </button>
  );
}
