'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SocialNav } from '@/components/Layout/SocialNav';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { CreatePost } from '@/components/Feed/CreatePost';
import { FeedItem } from '@/components/Feed/FeedItem';
import { TrendingRow } from '@/components/Feed/TrendingRow';
import { FeedSkeletonList } from '@/components/Feed/FeedSkeleton';
import type { FeedActivity } from '@/components/Feed/feed-types';
import { trackEvent } from '@/lib/analytics';

export default function FeedPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  useEffect(() => { trackEvent('page_view', { path: '/feed' }); }, []);

  const fetchActivities = useCallback(async (offset = 0, append = false) => {
    if (!user) return;
    if (offset === 0) setLoadingData(true);
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

    // Include own activities too
    const allIds = [...friendIds, user.id];

    if (allIds.length === 0) {
      setActivities([]);
      setLoadingData(false);
      return;
    }

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

    setLoadingData(false);
    setLoadingMore(false);
  }, [user, supabase]);

  useEffect(() => {
    if (user) fetchActivities();
  }, [user, fetchActivities]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loadingMore) {
        fetchActivities(activities.length, true);
      }
    }, { threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, activities.length, fetchActivities]);

  const handleEventClick = (eventId: string) => {
    router.push(`/events/${eventId}`);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white pb-24 bg-surface">
      <SocialNav />

      <main className="max-w-lg mx-auto px-0 py-6">
        {/* Create Post section */}
        <CreatePost
          userId={user.id}
          userAvatar={profile?.avatar_url || null}
          userInitial={profile?.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
          onPostCreated={() => fetchActivities()}
        />
        <div className="h-[6px] bg-white/[0.03] border-t border-white/[0.06]" />

        {/* Trending section */}
        <div className="mb-2">
          <TrendingRow />
        </div>

        {/* Feed items */}
        {loadingData ? (
          <FeedSkeletonList count={5} />
        ) : activities.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16" />
                <circle cx="5" cy="19" r="1" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <p className="text-white/40 text-sm font-medium mb-1">Noch keine Aktivitäten</p>
            <p className="text-white/30 text-xs mb-4">Füge Freunde hinzu, um ihren Feed zu sehen</p>
            <Link
              href="/friends"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.06] border border-white/[0.10] text-white/40 hover:text-white/60 hover:border-white/[0.15] transition-all duration-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span>Freunde finden</span>
            </Link>
          </div>
        ) : (
          <div>
            {activities.map((activity, index) => (
              <FeedItem
                key={activity.id}
                activity={activity}
                index={index}
                currentUserId={user?.id}
                currentUserAvatar={profile?.avatar_url}
                currentUserInitial={profile?.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                onEventClick={handleEventClick}
                onDeleted={(id) => setActivities(prev => prev.filter(a => a.id !== id))}
              />
            ))}

            {hasMore && <div ref={sentinelRef} className="h-10" />}
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            )}
            {!hasMore && !loadingMore && activities.length > 0 && (
              <div className="flex flex-col items-center py-10 gap-2">
                <div className="w-10 h-[1px] bg-white/[0.08] mb-2" />
                <p className="text-white/30 text-xs font-medium">Du hast alles gesehen</p>
                <p className="text-white/20 text-[10px]">Schau spaeter wieder vorbei</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
