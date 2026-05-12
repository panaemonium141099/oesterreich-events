'use client';

import { getCategoryMeta } from '@/lib/event-images';
import { EventImage } from '@/components/Events/EventImage';
import { formatDate, formatTime } from '@/lib/utils/date';
import { AnimatedCard } from '@/components/UI/AnimatedCard';

interface MatchedArtist {
  name: string;
  match_score: number;
  match_source: string;
  image_url: string | null;
}

export interface ArtistEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  address: string | null;
  bundesland: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  price_text: string | null;
  image_url: string | null;
  organizer: string | null;
  tags: string[] | null;
  ticket_url: string | null;
  event_score: number | null;
  matched_artists: MatchedArtist[];
  best_match_score: number;
}

interface ArtistEventCardProps {
  event: ArtistEvent;
  isSelected: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
  eveningMode?: boolean;
  index?: number;
  reminderActive?: boolean;
  onToggleReminder?: () => void;
}


function MatchBadge({ score, eveningMode }: { score: number; eveningMode?: boolean }) {
  if (score >= 0.8) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
        eveningMode ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
      }`}>
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Sicherer Match
      </span>
    );
  }
  if (score >= 0.6) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
        eveningMode ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700'
      }`}>
        Wahrscheinlich
      </span>
    );
  }
  return null;
}

export function ArtistEventCard({
  event,
  isSelected,
  onSelect,
  onHover,
  eveningMode,
  index = 0,
  reminderActive,
  onToggleReminder,
}: ArtistEventCardProps) {
  const time = formatTime(event.start_date);
  const categoryBorderColor = getCategoryMeta(event.category).borderColor;
  const primaryArtist = event.matched_artists[0];

  const borderColor = isSelected
    ? eveningMode ? 'rgb(99, 102, 241)' : 'rgb(37, 99, 235)'
    : categoryBorderColor + (eveningMode ? '66' : '44');

  return (
    <AnimatedCard
      index={index}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`
        group flex flex-col gap-2 p-3 cursor-pointer transition-colors duration-200
        ${eveningMode
          ? `border-b border-gray-700/60 ${isSelected ? 'bg-indigo-900/30 shadow-[-4px_0_8px_rgba(129,140,248,0.2)]' : 'hover:bg-gray-700/50'}`
          : `border-b border-slate-100/80 ${isSelected ? 'bg-blue-50 shadow-[-4px_0_8px_rgba(59,130,246,0.15)]' : 'hover:bg-slate-50'}`
        }
      `}
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      {/* Main content row */}
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className={`w-20 h-20 rounded-lg overflow-hidden shrink-0 ${eveningMode ? 'bg-gray-700' : 'bg-slate-200'}`}>
          <EventImage
            src={event.image_url}
            category={event.category}
            title={event.title}
            sizes="80px"
            className="transition-all duration-200 group-hover:scale-110 motion-reduce:group-hover:scale-100"
            wrapperClassName="w-full h-full"
            showSkeleton={true}
            showGradientOverlay={true}
            loading="lazy"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm line-clamp-2 leading-snug ${
            eveningMode ? 'text-gray-100' : 'text-slate-800'
          }`}>
            {event.title}
          </h3>

          <div className="flex items-center gap-1.5 mt-1">
            <svg className={`w-3.5 h-3.5 shrink-0 ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={`text-xs ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
              {formatDate(event.start_date)}
              {time && ` um ${time}`}
            </span>
          </div>

          {event.location_name && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <svg className={`w-3.5 h-3.5 shrink-0 ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className={`text-xs truncate ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
                {event.location_name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Artist match info */}
      <div className="flex items-center gap-2 pl-1">
        {primaryArtist?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryArtist.image_url}
            alt=""
            width={20}
            height={20}
            className="w-5 h-5 rounded-full object-cover shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
            eveningMode ? 'bg-purple-900/60' : 'bg-purple-100'
          }`}>
            <svg className={`w-3 h-3 ${eveningMode ? 'text-purple-300' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
        <span className={`text-xs font-medium truncate ${eveningMode ? 'text-purple-300' : 'text-purple-700'}`}>
          {primaryArtist?.name}
          {event.matched_artists.length > 1 && (
            <span className={`ml-1 ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`}>
              +{event.matched_artists.length - 1}
            </span>
          )}
        </span>
        <MatchBadge score={event.best_match_score} eveningMode={eveningMode} />
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 pl-1">
        {event.ticket_url ? (
          <a
            href={event.ticket_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              eveningMode
                ? 'bg-purple-600 hover:bg-purple-500 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            Tickets sichern
          </a>
        ) : (
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg ${
            eveningMode
              ? 'bg-white/10 text-white/70'
              : 'bg-slate-100 text-slate-600'
          }`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Details ansehen
          </span>
        )}

        {onToggleReminder && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleReminder();
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              reminderActive
                ? eveningMode
                  ? 'text-amber-400 bg-amber-900/30 hover:bg-amber-900/50'
                  : 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                : eveningMode
                  ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title={reminderActive ? 'Erinnerung entfernen' : 'Erinnere mich'}
          >
            <svg className="w-4 h-4" fill={reminderActive ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
        )}
      </div>
    </AnimatedCard>
  );
}
