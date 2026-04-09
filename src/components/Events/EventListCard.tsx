import Image from 'next/image';
import Link from 'next/link';
import type { Event } from '@/types/events';
import { formatDateCompact, formatTime } from '@/lib/utils/date';

const CATEGORY_COLORS: Record<string, string> = {
  Musik: 'bg-purple-500/20 text-purple-400',
  Nightlife: 'bg-pink-500/20 text-pink-400',
  'Wein & Kulinarik': 'bg-amber-500/20 text-amber-400',
  Kultur: 'bg-blue-500/20 text-blue-400',
  'Märkte': 'bg-orange-500/20 text-orange-400',
  Sport: 'bg-green-500/20 text-green-400',
  Familie: 'bg-cyan-500/20 text-cyan-400',
  Natur: 'bg-emerald-500/20 text-emerald-400',
  'Feste & Brauchtum': 'bg-red-500/20 text-red-400',
  Bildung: 'bg-indigo-500/20 text-indigo-400',
  Gesundheit: 'bg-teal-500/20 text-teal-400',
  Religion: 'bg-yellow-500/20 text-yellow-400',
  Wirtschaft: 'bg-slate-500/20 text-slate-400',
  Sonstiges: 'bg-gray-500/20 text-gray-400',
};

interface EventListCardProps {
  event: Event;
}

/**
 * Simplified event card for listing/landing pages.
 * Server Component — no client state, no map interaction.
 */
export function EventListCard({ event }: EventListCardProps) {
  const time = formatTime(event.start_date);
  const categoryStyle =
    CATEGORY_COLORS[event.category || ''] || 'bg-white/10 text-white/50';

  return (
    <Link
      href={`/events/${event.id}`}
      className="flex gap-4 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors group"
    >
      {/* Thumbnail */}
      {event.image_url ? (
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden shrink-0">
          <Image
            src={event.image_url}
            alt=""
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="112px"
          />
        </div>
      ) : (
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-white/5 shrink-0" />
      )}

      {/* Content */}
      <div className="flex flex-col justify-center min-w-0 flex-1">
        {event.category && (
          <span
            className={`inline-block self-start text-[10px] font-medium px-2 py-0.5 rounded-full mb-1.5 ${categoryStyle}`}
          >
            {event.category}
          </span>
        )}

        <h3 className="text-sm font-medium text-white truncate mb-1">
          {event.title}
        </h3>

        <div className="flex items-center gap-1.5 text-xs text-white/50 mb-0.5">
          <svg
            className="w-3 h-3 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>{formatDateCompact(event.start_date)}</span>
          {time && <span className="text-white/30">{time}</span>}
        </div>

        {event.location_name && (
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <svg
              className="w-3 h-3 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
            </svg>
            <span className="truncate">{event.location_name}</span>
          </div>
        )}

        {event.price_text && (
          <span className="text-[10px] text-white/30 mt-1">
            {event.price_text}
          </span>
        )}
      </div>
    </Link>
  );
}
