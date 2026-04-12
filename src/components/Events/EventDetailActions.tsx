'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { AfterSavePanel } from './AfterSavePanel';
import { toast } from 'sonner';
import { buildEventUrl } from '@/lib/utils/slugify';

interface EventDetailActionsProps {
  eventId: string;
  eventTitle: string;
  eventSlug?: string | null;
  city?: string | null;
  bundesland?: string | null;
  venueId?: string | null;
  venueName?: string | null;
  startDate?: string;
}

export function EventDetailActions({
  eventId,
  eventTitle,
  eventSlug,
  city,
  bundesland,
  venueId,
  venueName,
  startDate,
}: EventDetailActionsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [showAfterSave, setShowAfterSave] = useState(false);

  // Check if event is bookmarked on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from('saved_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .maybeSingle()
      .then(({ data }: { data: unknown }) => setBookmarked(!!data));
  }, [user, eventId, supabase]);

  const handleBack = useCallback(() => {
    // Only access window.history in event handler (not during render) to avoid hydration mismatch
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }, [router]);

  const handleBookmark = useCallback(async () => {
    if (!user) {
      toast.error('Bitte melde dich an, um Events zu speichern');
      return;
    }
    if (bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        await supabase
          .from('saved_events')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', eventId);
        setBookmarked(false);
        setShowAfterSave(false);
        toast.success('Event entfernt');
      } else {
        await supabase
          .from('saved_events')
          .insert({ user_id: user.id, event_id: eventId });
        setBookmarked(true);
        setShowAfterSave(true);
        toast.success('Event gespeichert');
      }
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setBookmarkLoading(false);
    }
  }, [user, bookmarked, bookmarkLoading, eventId, supabase]);

  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}${buildEventUrl(eventId, eventSlug)}`;
    const shareData = {
      title: eventTitle,
      url: shareUrl,
    };

    // Web Share API (mobile + modern desktop)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled or API failed — fall through to clipboard
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    // Fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link kopiert');
    } catch {
      toast.error('Link konnte nicht kopiert werden');
    }
  }, [eventId, eventSlug, eventTitle]);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm min-h-[44px] min-w-[44px]"
        >
          <span aria-hidden="true">&larr;</span> Zuruck
        </button>

        {/* Social actions */}
        <div className="flex items-center gap-2">
          {/* Save/Bookmark */}
          <button
            onClick={handleBookmark}
            disabled={bookmarkLoading}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-all duration-200 active:scale-[0.85] hover:bg-white/5"
            aria-label={bookmarked ? 'Nicht mehr speichern' : 'Speichern'}
          >
            <svg
              className={`w-6 h-6 transition-colors duration-200 ${
                bookmarked
                  ? 'text-white/90'
                  : 'text-white/60 hover:text-white/40'
              }`}
              fill={bookmarked ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-all duration-200 active:scale-[0.85] hover:bg-white/5"
            aria-label="Teilen"
          >
            <svg
              className="w-6 h-6 text-white/60 hover:text-white/40 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* After-Save Panel — only shows after a fresh save, not on page reload */}
      <AfterSavePanel
        visible={showAfterSave}
        onDismiss={() => setShowAfterSave(false)}
        eventId={eventId}
        eventTitle={eventTitle}
        startDate={startDate ?? new Date().toISOString()}
        city={city}
        bundesland={bundesland}
        venueId={venueId}
        venueName={venueName}
      />
    </>
  );
}
