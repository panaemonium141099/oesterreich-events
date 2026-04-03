'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SocialNav } from '@/components/Layout/SocialNav';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { HeartIcon, HeartBrokenIcon, CalendarIcon, MapPinIcon } from '@/components/UI/Icons';
import { ProfileDropdown } from '@/components/Layout/ProfileDropdown';

interface SavedEvent {
  id: string;
  event_id: string;
  remind_at: string | null;
  notes: string | null;
  created_at: string;
  events: {
    id: string;
    title: string;
    start_date: string;
    location_name: string | null;
    image_url: string | null;
    category: string | null;
    bundesland: string | null;
  };
}

export default function SavedEventsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      fetchSavedEvents();
    }
  }, [user]);

  const fetchSavedEvents = async () => {
    setLoadingEvents(true);
    const { data, error } = await supabase
      .from('saved_events')
      .select(`
        id, event_id, remind_at, notes, created_at,
        events (id, title, start_date, location_name, image_url, category, bundesland)
      `)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSavedEvents(data as any);
    }
    setLoadingEvents(false);
  };

  const removeSaved = async (savedId: string) => {
    await supabase.from('saved_events').delete().eq('id', savedId);
    setSavedEvents(prev => prev.filter(s => s.id !== savedId));
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white pb-24 bg-[#141416]"
    >
      <SocialNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold flex items-center gap-2"><HeartIcon size={24} className="text-red-400" /> Gespeicherte Events</h1>
          <ProfileDropdown />
        </div>
        <p className="text-white/40 text-sm mb-8">
          {savedEvents.length} {savedEvents.length === 1 ? 'Event' : 'Events'} gespeichert
        </p>

        {loadingEvents ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : savedEvents.length === 0 ? (
          <div className="text-center py-20">
            <div className="flex justify-center mb-4"><HeartBrokenIcon size={48} className="text-white/30" /></div>
            <p className="text-white/40 mb-6">Noch keine Events gespeichert</p>
            <Link
              href="/map"
              className="inline-block px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-colors"
            >
              Events entdecken
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {savedEvents.map((saved) => {
              const event = saved.events;
              if (!event) return null;
              return (
                <div
                  key={saved.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group"
                >
                  {/* Image */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-white/10">
                    {event.image_url ? (
                      <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20">
                        <CalendarIcon size={24} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{event.title}</h3>
                    <p className="text-xs text-white/40 mt-0.5">{formatDate(event.start_date)}</p>
                    {event.location_name && (
                      <p className="text-xs text-white/30 mt-0.5 truncate flex items-center gap-1"><MapPinIcon size={12} />{event.location_name}</p>
                    )}
                  </div>

                  {/* Category badge */}
                  {event.category && (
                    <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50 shrink-0">
                      {event.category}
                    </span>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={() => removeSaved(saved.id)}
                    className="text-white/30 hover:text-red-400 transition-colors shrink-0"
                    title="Entfernen"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
