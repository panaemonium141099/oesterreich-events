'use client';

import { useState } from 'react';
import type { FeedActivity } from './feed-types';
import { getActivityText, getActivityTypeLabel, formatRelativeTime } from './feed-types';
import { FeedActivityIcon, getTypeColor } from './FeedActivityIcon';
import { FeedEventMiniCard } from './FeedEventMiniCard';

interface FeedItemProps {
  activity: FeedActivity;
  index: number;
  onEventClick?: (eventId: string) => void;
}

export function FeedItem({ activity, index, onEventClick }: FeedItemProps) {
  const [liked, setLiked] = useState(false);
  const isPost = activity.type === 'post';
  const typeColor = getTypeColor(activity.type);

  return (
    <div
      className="feed-item-enter p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.10] transition-all duration-200"
      style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          {activity.profile?.avatar_url ? (
            <img
              src={activity.profile.avatar_url}
              alt=""
              className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/[0.08] ring-1 ring-white/10 flex items-center justify-center text-sm font-semibold text-white/50">
              {activity.profile?.first_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${typeColor}`}>
            <FeedActivityIcon type={activity.type} className="w-2.5 h-2.5" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm text-white/90 font-medium truncate">
              {getActivityText(activity)}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${typeColor}`}>
              {getActivityTypeLabel(activity.type)}
            </span>
            <span className="text-[10px] text-white/20">{formatRelativeTime(activity.created_at)}</span>
          </div>

          {/* Post content */}
          {isPost && activity.content && (
            <p className="mt-2 text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
              {activity.content}
            </p>
          )}

          {/* Event preview card */}
          {activity.event && (
            <div className="mt-2.5">
              <FeedEventMiniCard
                event={activity.event}
                onClick={onEventClick}
              />
            </div>
          )}

          {/* Group reference */}
          {activity.group && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-white/25">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>{activity.group.name}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={() => setLiked(!liked)}
              className={`flex items-center gap-1.5 text-xs transition-all duration-200 group/like ${
                liked ? 'text-rose-400' : 'text-white/20 hover:text-rose-400/70'
              }`}
              aria-label={liked ? 'Nicht mehr liken' : 'Liken'}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${liked ? 'scale-110' : 'group-hover/like:scale-110'}`}
                fill={liked ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
            <button className="flex items-center gap-1.5 text-xs text-white/20 hover:text-white/50 transition-colors group/comment" aria-label="Kommentieren">
              <svg className="w-4 h-4 group-hover/comment:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </button>
            <button className="flex items-center gap-1.5 text-xs text-white/20 hover:text-white/50 transition-colors group/share" aria-label="Teilen">
              <svg className="w-4 h-4 group-hover/share:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="18" cy="5" r="3" strokeWidth={1.5} />
                <circle cx="6" cy="12" r="3" strokeWidth={1.5} />
                <circle cx="18" cy="19" r="3" strokeWidth={1.5} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
