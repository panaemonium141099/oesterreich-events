'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Event } from '@/types/events';
import { getEventImage, getCategoryFallbackImage } from '@/lib/categoryImages';
import { formatDate, formatTime } from '@/lib/utils/date';
import { TagChip, TagOverflow } from '@/components/UI/TagChip';
import { AnimatedCard } from '@/components/UI/AnimatedCard';

interface EventCardProps {
  event: Event;
  isSelected: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
  eveningMode?: boolean;
  index?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Musik': 'bg-purple-100 text-purple-700',
  'Rave': 'bg-violet-100 text-violet-700',
  'Wein & Kulinarik': 'bg-rose-100 text-rose-700',
  'Kultur': 'bg-amber-100 text-amber-700',
  'Märkte': 'bg-green-100 text-green-700',
  'Sport': 'bg-blue-100 text-blue-700',
  'Familie': 'bg-pink-100 text-pink-700',
  'Natur': 'bg-emerald-100 text-emerald-700',
  'Sonstiges': 'bg-slate-100 text-slate-700',
};

const CATEGORY_COLORS_DARK: Record<string, string> = {
  'Musik': 'bg-purple-900/50 text-purple-300',
  'Rave': 'bg-violet-900/50 text-violet-300',
  'Wein & Kulinarik': 'bg-rose-900/50 text-rose-300',
  'Kultur': 'bg-amber-900/50 text-amber-300',
  'Märkte': 'bg-green-900/50 text-green-300',
  'Sport': 'bg-blue-900/50 text-blue-300',
  'Familie': 'bg-pink-900/50 text-pink-300',
  'Natur': 'bg-emerald-900/50 text-emerald-300',
  'Sonstiges': 'bg-gray-700 text-gray-300',
};

const CATEGORY_GLOW_COLORS: Record<string, string> = {
  'Musik': '168,85,247',
  'Rave': '139,92,246',
  'Wein & Kulinarik': '244,63,94',
  'Kultur': '245,158,11',
  'Märkte': '34,197,94',
  'Sport': '59,130,246',
  'Familie': '236,72,153',
  'Natur': '16,185,129',
  'Sonstiges': '148,163,184',
};

// Category border CSS colors for the left indicator
const CATEGORY_BORDER_CSS: Record<string, string> = {
  'Musik': '#a855f7',
  'Rave': '#8b5cf6',
  'Wein & Kulinarik': '#f43f5e',
  'Kultur': '#f59e0b',
  'Märkte': '#22c55e',
  'Sport': '#3b82f6',
  'Familie': '#ec4899',
  'Natur': '#10b981',
  'Sonstiges': '#94a3b8',
};

export function EventCard({ event, isSelected, onSelect, onHover, eveningMode, index = 0 }: EventCardProps) {
  const time = formatTime(event.start_date);
  const colors = eveningMode ? CATEGORY_COLORS_DARK : CATEGORY_COLORS;
  const categoryColor = colors[event.category || ''] || colors['Sonstiges'];
  const categoryBorderColor = CATEGORY_BORDER_CSS[event.category || ''] || CATEGORY_BORDER_CSS['Sonstiges'];
  const [imageLoaded, setImageLoaded] = useState(false);

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
      {/* Thumbnail with shimmer loading */}
      <div className={`w-20 h-20 rounded-lg overflow-hidden shrink-0 tilt-card ${eveningMode ? 'bg-gray-700' : 'bg-slate-200'}`}>
        <div className="relative w-full h-full">
          {!imageLoaded && (
            <div className="absolute inset-0 skeleton rounded-lg" />
          )}
          <Image
            src={getEventImage(event.image_url, event.category)}
            alt=""
            width={80}
            height={80}
            className={`w-full h-full object-cover transition-all duration-200 group-hover:scale-110 motion-reduce:group-hover:scale-100 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              // Swap to local category fallback (always available) and show immediately
              img.src = getCategoryFallbackImage(event.category);
              setImageLoaded(true);
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg" />
        </div>
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
              style={eveningMode ? { '--glow-color': CATEGORY_GLOW_COLORS[event.category] || CATEGORY_GLOW_COLORS['Sonstiges'] } as React.CSSProperties : undefined}
            >
              {event.category}
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
