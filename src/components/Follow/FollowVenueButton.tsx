'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { toast } from 'sonner';

interface FollowVenueButtonProps {
  venueId: string;
  venueName: string;
}

export function FollowVenueButton({
  venueId,
  venueName,
}: FollowVenueButtonProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const [followed, setFollowed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check follow status on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from('followed_venues')
      .select('id')
      .eq('user_id', user.id)
      .eq('venue_id', venueId)
      .maybeSingle()
      .then(({ data }: { data: unknown }) => setFollowed(!!data));
  }, [user, venueId, supabase]);

  const handleToggle = useCallback(async () => {
    if (!user) {
      toast.error('Bitte melde dich an, um Venues zu folgen');
      return;
    }
    if (loading) return;
    setLoading(true);

    try {
      if (followed) {
      // supabase-js wirft nicht — abgelehnte Schreibvorgaenge kommen als
      // { error } zurueck; ohne Pruefung laeuft der Erfolgs-Toast trotzdem.
        const { error } = await supabase
          .from('followed_venues')
          .delete()
          .eq('user_id', user.id)
          .eq('venue_id', venueId);
        if (error) throw error;
        setFollowed(false);
        toast.success(`${venueName} entfolgt`);
      } else {
        const { error } = await supabase.from('followed_venues').insert({
          user_id: user.id,
          venue_id: venueId,
        });
        if (error) throw error;
        setFollowed(true);
        toast.success(`${venueName} wird gefolgt`);
      }
    } catch (err) {
      console.error('[FollowVenueButton] toggle failed', err);
      toast.error('Fehler beim Folgen');
    } finally {
      setLoading(false);
    }
  }, [user, followed, loading, venueId, venueName, supabase]);

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
        followed
          ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
          : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80'
      }`}
    >
      {followed ? (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      )}
      {venueName} {followed ? 'gefolgt' : 'folgen'}
    </button>
  );
}
