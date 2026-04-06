'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { SocialNav } from '@/components/Layout/SocialNav';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { CommentItem } from '@/components/Feed/CommentItem';
import { FeedEventMiniCard } from '@/components/Feed/FeedEventMiniCard';
import { getActivityText, formatRelativeTime } from '@/components/Feed/feed-types';
import type { FeedActivity } from '@/components/Feed/feed-types';

interface CommentWithUser {
  id: string;
  activity_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

export default function PostDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const activityId = params.activityId as string;
  const supabase = createClient();

  const [activity, setActivity] = useState<FeedActivity | null>(null);
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  // Fetch activity
  useEffect(() => {
    if (!user || !activityId) return;

    const fetchActivity = async () => {
      setLoadingActivity(true);
      const { data } = await supabase
        .from('activities')
        .select(`
          id, user_id, type, event_id, group_id, target_user_id, memory_id, content, metadata, created_at,
          profile:profiles!activities_user_id_fkey(first_name, last_name, avatar_url),
          event:events(id, title, start_date, end_date, location_name, image_url, category, save_count),
          group:groups(id, name),
          target_user:profiles!activities_target_user_id_fkey(first_name, last_name)
        `)
        .eq('id', activityId)
        .single();

      if (data) {
        const normalized: FeedActivity = {
          ...(data as Record<string, unknown>),
          profile: Array.isArray(data.profile) ? data.profile[0] : data.profile,
          event: Array.isArray(data.event) ? data.event[0] : data.event,
          group: Array.isArray(data.group) ? data.group[0] : data.group,
          target_user: Array.isArray(data.target_user) ? data.target_user[0] : data.target_user,
        } as FeedActivity;
        setActivity(normalized);
      }
      setLoadingActivity(false);
    };

    fetchActivity();
  }, [user, activityId, supabase]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!activityId) return;
    setLoadingComments(true);

    const { data } = await supabase
      .from('activity_comments')
      .select('*, user:profiles!activity_comments_user_id_fkey(first_name, last_name, avatar_url)')
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true });

    if (data) {
      const normalized = data.map((c: Record<string, unknown>) => ({
        ...c,
        user: Array.isArray(c.user) ? c.user[0] : c.user,
      })) as CommentWithUser[];
      setComments(normalized);
    }
    setLoadingComments(false);
  }, [activityId, supabase]);

  useEffect(() => {
    if (user && activityId) fetchComments();
  }, [user, activityId, fetchComments]);

  // Submit comment
  const handleSubmitComment = async () => {
    if (!user || !commentText.trim() || submitting || !activity) return;
    setSubmitting(true);

    try {
      await supabase.from('activity_comments').insert({
        activity_id: activityId,
        user_id: user.id,
        content: commentText.trim(),
      });

      // Send notification (not to yourself)
      if (activity.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: activity.user_id,
          from_user_id: user.id,
          type: 'comment',
          title: 'hat deinen Beitrag kommentiert',
          read: false,
        });
      }

      setCommentText('');
      await fetchComments();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEventClick = (eventId: string) => {
    router.push(`/map?search=&eventId=${eventId}`);
  };

  if (loading || loadingActivity) {
    return (
      <div className="min-h-screen bg-surface-elevated text-white">
        <SocialNav />
        <main className="max-w-lg mx-auto px-4 sm:px-6 py-6">
          <div className="h-3 w-16 rounded bg-white/[0.06] mb-6 animate-pulse motion-reduce:animate-none" />
          <div className="border-b border-white/[0.06] animate-pulse motion-reduce:animate-none">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.06]" />
              <div className="w-24 h-3 rounded bg-white/[0.06]" />
            </div>
            <div className="aspect-[4/5] w-full bg-white/[0.04]" />
            <div className="px-4 py-3 space-y-2">
              <div className="w-20 h-3 rounded bg-white/[0.06]" />
              <div className="w-48 h-3 rounded bg-white/[0.04]" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-surface-elevated text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 text-sm mb-4">Beitrag nicht gefunden</p>
          <button
            onClick={() => router.push('/feed')}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Zuruck zum Feed
          </button>
        </div>
      </div>
    );
  }

  const isPost = activity.type === 'post';

  return (
    <div className="min-h-screen bg-surface-elevated text-white pb-24">
      <SocialNav />

      <main className="max-w-lg mx-auto px-4 sm:px-6 py-6">
        {/* Back button */}
        <button
          onClick={() => router.push('/feed')}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Zuruck</span>
        </button>

        {/* Activity card — Instagram-style clean layout */}
        <div className="border-b border-white/[0.06]">
          {/* Header: avatar + name + time */}
          <div className="flex items-center gap-3 px-4 py-3">
            {activity.profile?.avatar_url ? (
              <img
                src={activity.profile.avatar_url}
                alt=""
                className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/[0.08] ring-1 ring-white/10 flex items-center justify-center text-xs font-semibold text-white/50">
                {activity.profile?.first_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/90 font-medium truncate">
                {getActivityText(activity)}
              </p>
              <span className="text-[10px] text-white/20">{formatRelativeTime(activity.created_at)}</span>
            </div>
          </div>

          {/* Post content */}
          {isPost && activity.content && (
            <div className="px-4 pb-3">
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                {activity.content}
              </p>
            </div>
          )}

          {/* Event preview card */}
          {activity.event && (
            <div className="px-4 pb-3">
              <FeedEventMiniCard
                event={activity.event}
                onClick={handleEventClick}
              />
            </div>
          )}

          {/* Group reference */}
          {activity.group && (
            <div className="px-4 pb-3 flex items-center gap-1.5 text-xs text-white/25">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>{activity.group.name}</span>
            </div>
          )}
        </div>

        {/* Comments section */}
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-white/20 uppercase tracking-wider">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <span>Kommentare ({comments.length})</span>
            </div>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Comments list */}
          {loadingComments ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/20 text-xs">Noch keine Kommentare</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map(comment => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Sticky comment input */}
      <div className="fixed bottom-20 left-0 right-0 px-4 py-3 bg-surface-elevated/90 backdrop-blur-xl border-t border-white/[0.06]">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <input
            type="text"
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitComment();
              }
            }}
            placeholder="Kommentar schreiben..."
            className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/[0.15] transition-colors"
          />
          <button
            onClick={handleSubmitComment}
            disabled={!commentText.trim() || submitting}
            className="bg-white text-black rounded-xl w-10 h-10 flex items-center justify-center shrink-0 disabled:opacity-30 transition-opacity"
            aria-label="Kommentar senden"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
