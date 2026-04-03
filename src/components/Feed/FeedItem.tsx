'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { FeedActivity } from './feed-types';
import { getActivityText, getActivityCaption, getUsername, isCompactActivity, formatRelativeTime } from './feed-types';
import { FeedEventMiniCard } from './FeedEventMiniCard';
import { ShareSheet } from '@/components/Share/ShareSheet';
import { DoubleTapHeart } from './DoubleTapHeart';
import { InlineCommentInput } from './InlineCommentInput';
import { PostMenu } from './PostMenu';

interface CommentPreview {
  id: string;
  content: string;
  created_at: string;
  user: { first_name: string; last_name: string; avatar_url: string | null };
}

interface FeedItemProps {
  activity: FeedActivity;
  index: number;
  currentUserId?: string;
  currentUserAvatar?: string | null;
  currentUserInitial?: string;
  onEventClick?: (eventId: string) => void;
  onDeleted?: (activityId: string) => void;
}

export function FeedItem({
  activity,
  index,
  currentUserId,
  currentUserAvatar,
  currentUserInitial = '?',
  onEventClick,
  onDeleted,
}: FeedItemProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [recentComments, setRecentComments] = useState<CommentPreview[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const commentInputRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef(0);
  const supabase = createClient();

  const username = getUsername(activity.profile);
  const caption = getActivityCaption(activity);
  const isOwner = currentUserId === activity.user_id;
  const hasEvent = !!activity.event;

  // --- Compact activity (group_joined, friend_added) ---
  if (isCompactActivity(activity.type)) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]"
        style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
      >
        {activity.profile?.avatar_url ? (
          <img src={activity.profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] font-medium text-white/40 shrink-0">
            {activity.profile?.first_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <p className="text-sm text-white/40 flex-1 min-w-0 truncate">
          <span className="font-semibold text-white/60">{username}</span>{' '}
          {caption}
        </p>
        <span className="text-[10px] text-white/20 shrink-0">{formatRelativeTime(activity.created_at)}</span>
      </div>
    );
  }

  // --- Data fetching ---

  // Like state + count
  useEffect(() => {
    if (!currentUserId) return;
    const fetch = async () => {
      const [{ data: myLike }, { count }] = await Promise.all([
        supabase.from('activity_likes').select('id').eq('user_id', currentUserId).eq('activity_id', activity.id).maybeSingle(),
        supabase.from('activity_likes').select('*', { count: 'exact', head: true }).eq('activity_id', activity.id),
      ]);
      setLiked(!!myLike);
      setLikeCount(count ?? 0);
    };
    fetch();
  }, [currentUserId, activity.id, supabase]);

  // Comment count + recent 2 comments
  useEffect(() => {
    const fetch = async () => {
      const [{ count }, { data: comments }] = await Promise.all([
        supabase.from('activity_comments').select('*', { count: 'exact', head: true }).eq('activity_id', activity.id),
        supabase.from('activity_comments')
          .select('id, content, created_at, user:profiles!activity_comments_user_id_fkey(first_name, last_name, avatar_url)')
          .eq('activity_id', activity.id)
          .order('created_at', { ascending: false })
          .limit(2),
      ]);
      setCommentCount(count ?? 0);
      if (comments) {
        const normalized = comments.map((c: Record<string, unknown>) => ({
          ...c,
          user: Array.isArray(c.user) ? c.user[0] : c.user,
        })) as CommentPreview[];
        setRecentComments(normalized.reverse());
      }
    };
    fetch();
  }, [activity.id, supabase]);

  // Bookmark state (for events)
  useEffect(() => {
    if (!currentUserId || !activity.event?.id) return;
    supabase.from('saved_events').select('id').eq('user_id', currentUserId).eq('event_id', activity.event.id).maybeSingle()
      .then(({ data }: { data: unknown }) => setBookmarked(!!data));
  }, [currentUserId, activity.event?.id, supabase]);

  // --- Handlers ---

  const handleLike = useCallback(async () => {
    if (!currentUserId || likeLoading) return;
    setLikeLoading(true);
    try {
      if (liked) {
        await supabase.from('activity_likes').delete().eq('user_id', currentUserId).eq('activity_id', activity.id);
        setLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase.from('activity_likes').insert({ user_id: currentUserId, activity_id: activity.id });
        setLiked(true);
        setLikeCount(prev => prev + 1);
        if (activity.user_id !== currentUserId) {
          await supabase.from('notifications').insert({
            user_id: activity.user_id,
            from_user_id: currentUserId,
            type: 'like',
            title: 'hat deinen Beitrag geliked',
            read: false,
          });
        }
      }
    } finally {
      setLikeLoading(false);
    }
  }, [currentUserId, liked, likeLoading, activity.id, activity.user_id, supabase]);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!liked) handleLike();
      setShowDoubleTapHeart(true);
      setTimeout(() => setShowDoubleTapHeart(false), 800);
    }
    lastTapRef.current = now;
  }, [liked, handleLike]);

  const handleBookmark = async () => {
    if (!currentUserId || !activity.event?.id) return;
    if (bookmarked) {
      await supabase.from('saved_events').delete().eq('user_id', currentUserId).eq('event_id', activity.event.id);
      setBookmarked(false);
    } else {
      await supabase.from('saved_events').insert({ user_id: currentUserId, event_id: activity.event.id });
      setBookmarked(true);
    }
  };

  const handleCommentAdded = (comment: CommentPreview) => {
    setRecentComments(prev => [...prev.slice(-1), comment]);
    setCommentCount(prev => prev + 1);
  };

  // --- Render ---
  return (
    <article className="border-b border-white/[0.06]">
      {/* Post Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {activity.profile?.avatar_url ? (
          <img src={activity.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-xs font-semibold text-white/50">
            {activity.profile?.first_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white">{username}</span>
          <span className="text-xs text-white/30 ml-2">{formatRelativeTime(activity.created_at)}</span>
        </div>
        <PostMenu
          activityId={activity.id}
          isOwner={isOwner}
          onShare={() => setShareOpen(true)}
          onDeleted={() => onDeleted?.(activity.id)}
        />
      </div>

      {/* Content Area — double-tap target */}
      <div className="relative" onClick={handleDoubleTap}>
        <DoubleTapHeart show={showDoubleTapHeart} />

        {/* Event image (full-width) */}
        {hasEvent && activity.event && (
          <FeedEventMiniCard
            event={activity.event}
            fullWidth
            onClick={onEventClick}
          />
        )}

        {/* Text-only post content */}
        {activity.type === 'post' && activity.content && !hasEvent && (
          <div className="px-4 py-3">
            <p className="text-[15px] text-white/80 leading-relaxed whitespace-pre-wrap">
              {activity.content}
            </p>
          </div>
        )}

        {/* Text post with event — show text above event */}
        {activity.type === 'post' && activity.content && hasEvent && (
          <div className="px-4 pt-2 pb-1">
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
              {activity.content}
            </p>
          </div>
        )}
      </div>

      {/* Action Row */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4">
          {/* Heart */}
          <button
            onClick={handleLike}
            disabled={likeLoading || !currentUserId}
            className="transition-transform duration-200 active:scale-[0.85]"
            aria-label={liked ? 'Nicht mehr liken' : 'Liken'}
          >
            <svg
              className={`w-6 h-6 transition-colors duration-200 ${liked ? 'text-red-500' : 'text-white/80 hover:text-white/50'}`}
              fill={liked ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={liked ? 0 : 1.5} d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>

          {/* Comment */}
          <button
            onClick={() => commentInputRef.current?.focus()}
            className="transition-transform duration-200 active:scale-[0.85]"
            aria-label="Kommentieren"
          >
            <svg className="w-6 h-6 text-white/80 hover:text-white/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </button>

          {/* Share (paper plane) */}
          <button
            onClick={() => setShareOpen(true)}
            className="transition-transform duration-200 active:scale-[0.85]"
            aria-label="Teilen"
          >
            <svg className="w-6 h-6 text-white/80 hover:text-white/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>

        {/* Bookmark (right side, only for events) */}
        {hasEvent && (
          <button
            onClick={handleBookmark}
            className="transition-transform duration-200 active:scale-[0.85]"
            aria-label={bookmarked ? 'Nicht mehr speichern' : 'Speichern'}
          >
            <svg
              className={`w-6 h-6 transition-colors duration-200 ${bookmarked ? 'text-white' : 'text-white/80 hover:text-white/50'}`}
              fill={bookmarked ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        )}
      </div>

      {/* Like Count */}
      {likeCount > 0 && (
        <p className="px-4 text-sm font-semibold text-white">
          {likeCount === 1 ? 'Gefällt 1 Person' : `Gefällt ${likeCount} Personen`}
        </p>
      )}

      {/* Caption */}
      <div className="px-4 mt-1">
        <p className="text-sm text-white/80 leading-relaxed">
          <span className="font-semibold text-white">{username}</span>{' '}
          {activity.type !== 'post' ? caption : ''}
        </p>
      </div>

      {/* Comment Preview */}
      {commentCount > 2 && (
        <Link href={`/feed/${activity.id}`} className="block px-4 mt-1">
          <span className="text-sm text-white/30">Alle {commentCount} Kommentare ansehen</span>
        </Link>
      )}
      {recentComments.length > 0 && (
        <div className="px-4 mt-1 space-y-0.5">
          {recentComments.map((c) => (
            <p key={c.id} className="text-sm text-white/60">
              <span className="font-semibold text-white/80">
                {[c.user.first_name, c.user.last_name].filter(Boolean).join(' ')}
              </span>{' '}
              {c.content}
            </p>
          ))}
        </div>
      )}

      {/* Inline Comment Input */}
      {currentUserId && (
        <InlineCommentInput
          ref={commentInputRef}
          activityId={activity.id}
          userId={currentUserId}
          userAvatar={currentUserAvatar || null}
          userInitial={currentUserInitial}
          activityOwnerId={activity.user_id}
          onCommentAdded={handleCommentAdded}
        />
      )}

      {/* Share Sheet */}
      <ShareSheet
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        shareData={{
          type: activity.event ? 'event' : 'post',
          id: activity.event?.id || activity.id,
          title: getActivityText(activity),
          url: activity.event ? `/events/${activity.event.id}` : `/feed/${activity.id}`,
        }}
      />
    </article>
  );
}
