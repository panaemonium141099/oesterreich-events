'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import type { FeedActivity, TrendingEvent } from './feed-types';
import { getActivityText, getActivityTypeLabel, formatRelativeTime } from './feed-types';
import { FeedActivityIcon, getTypeColor } from './FeedActivityIcon';
import { FeedEventMiniCard } from './FeedEventMiniCard';
import { SidebarFeedItemSkeleton } from './FeedSkeleton';

interface SidebarFeedProps {
  eveningMode?: boolean;
  onEventClick?: (eventId: string) => void;
}

export function SidebarFeed({ eveningMode, onEventClick }: SidebarFeedProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [trending, setTrending] = useState<TrendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 15;

  const fetchActivities = useCallback(async (offset = 0, append = false) => {
    if (!user) return;
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);

    // Get friend IDs
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const friendIds = (friendships || []).map((f: { requester_id: string; addressee_id: string }) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );

    const allIds = [...friendIds, user.id];

    const { data } = await supabase
      .from('activities')
      .select(`
        id, user_id, type, event_id, group_id, target_user_id, memory_id, content, metadata, created_at,
        profile:profiles!activities_user_id_fkey(first_name, last_name, avatar_url),
        event:events(id, title, start_date, end_date, location_name, image_url, category, save_count),
        group:groups(id, name),
        target_user:profiles!activities_target_user_id_fkey(first_name, last_name)
      `)
      .in('user_id', allIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (data) {
      const normalized: FeedActivity[] = data.map((a: Record<string, unknown>) => ({
        ...a,
        profile: Array.isArray(a.profile) ? a.profile[0] : a.profile,
        event: Array.isArray(a.event) ? a.event[0] : a.event,
        group: Array.isArray(a.group) ? a.group[0] : a.group,
        target_user: Array.isArray(a.target_user) ? a.target_user[0] : a.target_user,
      })) as FeedActivity[];

      if (append) {
        setActivities(prev => [...prev, ...normalized]);
      } else {
        setActivities(normalized);
      }
      setHasMore(normalized.length === PAGE_SIZE);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [user, supabase]);

  const fetchTrending = useCallback(async () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { data } = await supabase
      .from('events')
      .select('id, title, start_date, end_date, location_name, image_url, category, save_count')
      .gte('start_date', new Date().toISOString())
      .lte('start_date', nextWeek.toISOString())
      .eq('visibility', 'public')
      .not('image_url', 'is', null)
      .order('save_count', { ascending: false, nullsFirst: false })
      .order('start_date', { ascending: true })
      .limit(5);

    setTrending((data as TrendingEvent[]) || []);
  }, [supabase]);

  useEffect(() => {
    if (user) {
      fetchActivities();
      fetchTrending();
    }
  }, [user, fetchActivities, fetchTrending]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className={`w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center ${
          eveningMode ? 'bg-gray-800' : 'bg-slate-100'
        }`}>
          <svg className={`w-6 h-6 ${eveningMode ? 'text-gray-600' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <p className={`text-sm font-medium ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>Melde dich an</p>
        <p className={`text-xs mt-1 ${eveningMode ? 'text-gray-600' : 'text-slate-400'}`}>Um den Feed zu sehen</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-3 space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <SidebarFeedItemSkeleton key={i} index={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Trending section */}
      {trending.length > 0 && (
        <div className={`px-3 py-3 border-b ${eveningMode ? 'border-gray-800/50' : 'border-slate-100'}`}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <svg className={`w-3.5 h-3.5 ${eveningMode ? 'text-amber-400/70' : 'text-amber-500/70'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`}>
              Trending
            </span>
          </div>
          <div className="space-y-1">
            {trending.slice(0, 3).map((event) => (
              <FeedEventMiniCard
                key={event.id}
                event={event}
                compact
                onClick={onEventClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Activities feed */}
      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className={`w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center ${
            eveningMode ? 'bg-gray-800' : 'bg-slate-100'
          }`}>
            <svg className={`w-6 h-6 ${eveningMode ? 'text-gray-600' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className={`text-sm font-medium ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>Noch keine Aktivitäten</p>
          <p className={`text-xs mt-1 ${eveningMode ? 'text-gray-600' : 'text-slate-400'}`}>Füge Freunde hinzu</p>
        </div>
      ) : (
        <div>
          {activities.map((activity, index) => (
            <SidebarFeedItem
              key={activity.id}
              activity={activity}
              index={index}
              eveningMode={eveningMode}
              onEventClick={onEventClick}
            />
          ))}

          {hasMore && (
            <div className="px-3 py-3 text-center">
              <button
                onClick={() => fetchActivities(activities.length, true)}
                disabled={loadingMore}
                className={`text-xs transition-colors ${
                  eveningMode ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'
                } disabled:opacity-50`}
              >
                {loadingMore ? (
                  <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin mx-auto" />
                ) : (
                  'Mehr laden'
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SidebarFeedItem({
  activity,
  index,
  eveningMode,
  onEventClick,
}: {
  activity: FeedActivity;
  index: number;
  eveningMode?: boolean;
  onEventClick?: (eventId: string) => void;
}) {
  const isPost = activity.type === 'post';
  const typeColor = getTypeColor(activity.type);

  return (
    <div
      className={`flex gap-2.5 px-3 py-2.5 transition-colors duration-150 feed-item-enter ${
        eveningMode
          ? 'hover:bg-gray-700/30 border-b border-gray-800/30'
          : 'hover:bg-slate-50 border-b border-slate-100/50'
      }`}
      style={{ animationDelay: `${Math.min(index * 40, 300)}ms` }}
    >
      {/* Mini avatar */}
      <div className="relative shrink-0">
        {activity.profile?.avatar_url ? (
          <img
            src={activity.profile.avatar_url}
            alt=""
            className="w-8 h-8 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold ${
            eveningMode ? 'bg-white/10 text-white/50' : 'bg-slate-100 text-slate-500'
          }`}>
            {activity.profile?.first_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ${typeColor}`}>
          <FeedActivityIcon type={activity.type} className="w-2 h-2" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs leading-tight ${eveningMode ? 'text-gray-300' : 'text-slate-700'}`}>
          {isPost ? (
            <span className="font-medium">{getActivityText(activity)}</span>
          ) : (
            getActivityText(activity)
          )}
        </p>

        {isPost && activity.content && (
          <p className={`text-[11px] mt-0.5 line-clamp-2 ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
            {activity.content}
          </p>
        )}

        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[10px] ${eveningMode ? 'text-gray-600' : 'text-slate-300'}`}>
            {formatRelativeTime(activity.created_at)}
          </span>
        </div>

        {/* Compact event preview */}
        {activity.event && (
          <div className="mt-1.5">
            <FeedEventMiniCard
              event={activity.event}
              compact
              onClick={onEventClick}
            />
          </div>
        )}
      </div>
    </div>
  );
}
