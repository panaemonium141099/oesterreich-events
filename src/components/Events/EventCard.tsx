'use client';

import type { Event } from '@/types/events';
import { getCategoryMeta, getCategoryBadgeClass } from '@/lib/event-images';
import { formatDate, formatTime } from '@/lib/utils/date';
import { TagChip, TagOverflow } from '@/components/UI/TagChip';
import { AnimatedCard } from '@/components/UI/AnimatedCard';
import { EventImage } from './EventImage';

interface EventCardProps {
  event: Event;
  isSelected: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
  eveningMode?: boolean;
  index?: number;
}

export function EventCard({ event, isSelected, onSelect, onHover, eveningMode, index = 0 }: EventCardProps) {
  const time = formatTime(event.start_date);
  const meta = getCategoryMeta(event.category);
  const categoryColor = eveningMode ? meta.badgeDark : meta.badgeLight;

  const borderColor = isSelected
    ? eveningMode ? 'rgb(99, 102, 241)' : 'rgb(37, 99, 235)'
    : meta.borderColor + (eveningMode ? '66' : '44');

  return (
    <AnimatedCard
      index={index}
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
      <div className={`w-20 h-20 rounded-lg overflow-hidden shrink-0 tilt-card ${eveningMode ? 'bg-gray-700' : 'bg-slate-200'}`}>
        <EventImage
          src={event.image_url}
          category={event.category}
          title={event.title}
          className="w-full h-full transition-all duration-200 group-hover:scale-110 motion-reduce:group-hover:scale-100"
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
