'use client';

import { useState, useEffect, useCallback } from 'react';
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

  const handleEventClick = (eventId: string) => {
    router.push(`/map?search=&eventId=${eventId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white pb-24 gradient-mesh">
      <SocialNav />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full bg-white/20" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Feed</h1>
              <p className="text-[11px] text-white/30 mt-0.5">Was deine Freunde machen</p>
            </div>
          </div>
          <button
            onClick={() => fetchActivities()}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-white/60 hover:border-white/[0.12] transition-all duration-200 min-h-[36px]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Aktualisieren</span>
          </button>
        </div>

        {/* Create Post section */}
        <div className="mb-6">
          <CreatePost
            userId={user!.id}
            userAvatar={profile?.avatar_url || null}
            userInitial={profile?.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
            onPostCreated={() => fetchActivities()}
          />
        </div>

        {/* Trending section */}
        <div className="mb-6">
          <TrendingRow onEventClick={handleEventClick} />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-white/20 uppercase tracking-wider">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16" />
              <circle cx="5" cy="19" r="1" fill="currentColor" stroke="none" />
            </svg>
            <span>Aktivitäten</span>
          </div>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* Feed items */}
        {loadingData ? (
          <FeedSkeletonList count={5} />
        ) : activities.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16" />
                <circle cx="5" cy="19" r="1" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <p className="text-white/40 text-sm font-medium mb-1">Noch keine Aktivitäten</p>
            <p className="text-white/20 text-xs mb-4">Füge Freunde hinzu, um ihren Feed zu sehen</p>
            <Link
              href="/friends"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.06] border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/[0.15] transition-all duration-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span>Freunde finden</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity, index) => (
              <FeedItem
                key={activity.id}
                activity={activity}
                index={index}
                onEventClick={handleEventClick}
              />
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="text-center pt-4 pb-2">
                <button
                  onClick={() => fetchActivities(activities.length, true)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-white/60 hover:border-white/[0.12] transition-all duration-200 disabled:opacity-50 min-h-[40px]"
                >
                  {loadingMore ? (
                    <div className="w-4 h-4 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span>Mehr laden</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
