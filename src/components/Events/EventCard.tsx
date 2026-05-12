'use client';

import type { Event } from '@/types/events';
import { getCategoryMeta, getCategoryBadgeClass } from '@/lib/event-images';
import { formatDate, formatTime } from '@/lib/utils/date';
import { TagChip, TagOverflow } from '@/components/UI/TagChip';
import { AnimatedCard } from '@/components/UI/AnimatedCard';
import { EventImage } from './EventImage';
import { useSavedEvents } from '@/lib/saved-events-context';

interface EventCardProps {
  event: Event;
  isSelected: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
  eveningMode?: boolean;
  index?: number;
  variant?: 'compact' | 'expanded';
}

export function EventCard({ event, isSelected, onSelect, onHover, eveningMode, index = 0, variant = 'compact' }: EventCardProps) {
  const time = formatTime(event.start_date);
  const meta = getCategoryMeta(event.category);
  const categoryColor = eveningMode ? meta.badgeDark : meta.badgeLight;
  const { isSaved } = useSavedEvents();
  const saved = isSaved(event.id);

  const borderColor = isSelected
    ? eveningMode ? 'rgb(99, 102, 241)' : 'rgb(37, 99, 235)'
    : meta.borderColor + (eveningMode ? '66' : '44');

  if (variant === 'expanded') {
    return (
      <AnimatedCard
        index={index}
        animateEnter={false}
        onClick={onSelect}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        className={`group flex flex-col overflow-hidden rounded-xl border cursor-pointer transition-all duration-200 ${
          eveningMode
            ? `bg-gray-800/60 border-gray-700/50 hover:border-gray-500/60 ${isSelected ? 'ring-2 ring-indigo-400/60 border-indigo-400/60' : ''}`
            : `bg-white border-slate-200/70 hover:border-slate-300 hover:shadow-md ${isSelected ? 'ring-2 ring-blue-500/50 border-blue-300' : ''}`
        }`}
      >
        {/* Image with category badge */}
        <div className={`relative aspect-[16/10] overflow-hidden ${eveningMode ? 'bg-gray-700' : 'bg-slate-200'}`}>
          <EventImage
            src={event.image_url}
            category={event.category}
            title={event.title}
            bundesland={event.bundesland}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
            wrapperClassName="w-full h-full"
            showGradientOverlay={false}
            loading="lazy"
          />
          {event.category && (
            <span
              className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-1 rounded-md backdrop-blur-md ${categoryColor}`}
            >
              {meta.label}
            </span>
          )}
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5">
            {saved && <SavedBadge eveningMode={eveningMode} />}
            {event.price_text && (
              <span className={`text-[11px] font-semibold px-2 py-1 rounded-md backdrop-blur-md ${
                eveningMode ? 'bg-indigo-500/80 text-white' : 'bg-white/90 text-blue-700 ring-1 ring-blue-200'
              }`}>
                {event.price_text}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-2 p-3.5 flex-1">
          <h3 className={`font-semibold text-[15px] leading-snug line-clamp-2 ${
            eveningMode ? 'text-gray-100' : 'text-slate-900'
          }`}>
            {event.title}
          </h3>

          <div className={`flex items-center gap-1.5 text-xs ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="truncate">
              {formatDate(event.start_date)}
              {time && ` • ${time}`}
            </span>
          </div>

          {event.location_name && (
            <div className={`flex items-center gap-1.5 text-xs ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{event.location_name}</span>
            </div>
          )}

          {event.description && (
            <p className={`text-xs line-clamp-3 leading-relaxed ${eveningMode ? 'text-gray-500' : 'text-slate-500'}`}>
              {event.description}
            </p>
          )}

          {event.tags && event.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-auto pt-1 flex-wrap">
              {event.tags.slice(0, 5).map((tag) => (
                <TagChip key={tag} tag={tag} eveningMode={eveningMode} size="sm" />
              ))}
              {event.tags.length > 5 && (
                <TagOverflow count={event.tags.length - 5} eveningMode={eveningMode} size="sm" />
              )}
            </div>
          )}
        </div>

        <div
          className="h-0.5 w-full"
          style={{ backgroundColor: borderColor }}
          aria-hidden="true"
        />
      </AnimatedCard>
    );
  }

  return (
    <AnimatedCard
      index={index}
      animateEnter={false}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`
        group flex gap-3 p-3 cursor-pointer transition-colors duration-200
        ${eveningMode
          ? `border-b border-gray-700/60 ${isSelected ? 'bg-indigo-900/30 shadow-[-4px_0_8px_rgba(129,140,248,0.2)]' : 'hover:bg-gray-700/50'}`
          : `border-b border-slate-100/80 ${isSelected ? 'bg-blue-50 shadow-[-4px_0_8px_rgba(59,130,246,0.15)]' : 'hover:bg-slate-50'}`
        }
      `}
      style={{
        borderLeft: `3px solid ${borderColor}`,
      }}
    >
      {/* Thumbnail */}
      <div className={`relative w-20 h-20 rounded-lg overflow-hidden shrink-0 tilt-card ${eveningMode ? 'bg-gray-700' : 'bg-slate-200'}`}>
        <EventImage
          src={event.image_url}
          category={event.category}
          title={event.title}
          bundesland={event.bundesland}
          sizes="80px"
          className="transition-all duration-200 group-hover:scale-110 motion-reduce:group-hover:scale-100"
          wrapperClassName="w-full h-full"
          showGradientOverlay={true}
          loading="lazy"
        />
        {saved && (
          <span
            className="absolute top-1 right-1 inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-500 text-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] ring-1 ring-white/30"
            title="Gespeichert"
            aria-label="Gespeichert"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </span>
        )}
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
            <span className={`text-xs truncate ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>{event.location_name}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {event.tags && event.tags.length > 0 ? (
            <>
              {event.tags.slice(0, 3).map((tag) => (
                <TagChip key={tag} tag={tag} eveningMode={eveningMode} size="sm" />
              ))}
              {event.tags.length > 3 && (
                <TagOverflow count={event.tags.length - 3} eveningMode={eveningMode} size="sm" />
              )}
            </>
          ) : event.category ? (
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${categoryColor} ${eveningMode ? 'animate-pulse-glow' : ''}`}
              style={eveningMode ? { '--glow-color': meta.glowRgb } as React.CSSProperties : undefined}
            >
              {meta.label}
            </span>
          ) : null}
          {event.price_text && (
            <span className={`text-[10px] font-medium ${eveningMode ? 'text-indigo-400' : 'text-blue-600'}`}>
              {event.price_text}
            </span>
          )}
        </div>

        {event.description && (
          <div className="max-h-0 group-hover:max-h-8 overflow-hidden transition-all duration-300 ease-out">
            <p className={`text-[10px] mt-1 line-clamp-1 ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`}>
              {event.description.substring(0, 80)}...
            </p>
          </div>
        )}
      </div>
    </AnimatedCard>
  );
}

function SavedBadge({ eveningMode }: { eveningMode?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.25)] ${
        eveningMode
          ? 'bg-emerald-500/90 text-white ring-1 ring-emerald-300/40'
          : 'bg-emerald-500 text-white ring-1 ring-white/40'
      }`}
      title="Gespeichert"
      aria-label="Gespeichert"
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
      Gespeichert
    </span>
  );
}
