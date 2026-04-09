'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { normalizeCity } from '@/lib/utils/city';
import { toast } from 'sonner';

interface FollowCityButtonProps {
  city: string;
  bundesland: string;
}

export function FollowCityButton({ city, bundesland }: FollowCityButtonProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const [followed, setFollowed] = useState(false);
  const [loading, setLoading] = useState(false);

  const cityNorm = normalizeCity(city);

  // Check follow status on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from('followed_cities')
      .select('id')
      .eq('user_id', user.id)
      .eq('city_normalized', cityNorm)
      .eq('bundesland', bundesland)
      .maybeSingle()
      .then(({ data }: { data: unknown }) => setFollowed(!!data));
  }, [user, cityNorm, bundesland, supabase]);

  const handleToggle = useCallback(async () => {
    if (!user) {
      toast.error('Bitte melde dich an, um Stadten zu folgen');
      return;
    }
    if (loading) return;
    setLoading(true);

    try {
      if (followed) {
        await supabase
          .from('followed_cities')
          .delete()
          .eq('user_id', user.id)
          .eq('city_normalized', cityNorm)
          .eq('bundesland', bundesland);
        setFollowed(false);
        toast.success(`${city} entfolgt`);
      } else {
        await supabase.from('followed_cities').insert({
          user_id: user.id,
          city,
          city_normalized: cityNorm,
          bundesland,
        });
        setFollowed(true);
        toast.success(`${city} wird gefolgt`);
      }
    } catch {
      toast.error('Fehler beim Folgen');
    } finally {
      setLoading(false);
    }
  }, [user, followed, loading, city, cityNorm, bundesland, supabase]);

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
      {city} {followed ? 'gefolgt' : 'folgen'}
    </button>
  );
}
