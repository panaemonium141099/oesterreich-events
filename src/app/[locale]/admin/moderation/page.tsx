'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Trash2, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BoostControl } from '@/components/Admin/BoostControl';
import { setEventBoost } from '@/lib/admin/boost';

interface EventRow {
  id: string;
  title: string;
  start_date: string;
  location_name: string | null;
  category: string | null;
  source_name: string | null;
  source_type: string;
  bundesland: string | null;
  is_boosted: boolean;
  boost_until: string | null;
}

export default function ModerationPage() {
  const supabase = createClient();
  const [userEvents, setUserEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModeration = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select(
        'id, title, start_date, location_name, category, source_name, source_type, bundesland, is_boosted, boost_until'
      )
      .in('source_type', ['user', 'business'])
      .order('created_at', { ascending: false })
      .limit(50);

    setUserEvents((data as EventRow[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchModeration();
  }, [fetchModeration]);

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Event wirklich loschen?')) return;
    await supabase.from('events').delete().eq('id', eventId);
    setUserEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  const [boostingId, setBoostingId] = useState<string | null>(null);

  /** Boost setzen/beenden. Der Cron /api/cron/expire-boosts beendet später
   *  automatisch alle Boosts, deren boost_until abgelaufen ist. */
  const setBoost = async (eventId: string, boosted: boolean, days = 0) => {
    setBoostingId(eventId);
    try {
      const { boost_until } = await setEventBoost(eventId, boosted, days);
      setUserEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, is_boosted: boosted, boost_until } : e
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Boost fehlgeschlagen');
    } finally {
      setBoostingId(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-AT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-5 h-5 text-white/40" />
        <h1 className="text-2xl font-semibold text-white/90">Moderation</h1>
      </div>

      <h2 className="text-sm uppercase tracking-wider text-white/40 font-medium mb-4">
        User-created Events
      </h2>

      {loading ? (
        <div className="text-center text-white/40 py-16">Loading...</div>
      ) : userEvents.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white/20" />
          </div>
          <p className="text-white/40 text-sm">No user-created events to moderate</p>
        </div>
      ) : (
        <div className="space-y-2">
          {userEvents.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate text-white/90">{e.title}</p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                      e.source_type === 'business'
                        ? 'bg-purple-400/20 text-purple-400'
                        : 'bg-blue-400/20 text-blue-400'
                    }`}
                  >
                    {e.source_type}
                  </span>
                  {e.is_boosted && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0 bg-violet-500/20 text-violet-300 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      {e.boost_until ? `geboostet bis ${formatDate(e.boost_until)}` : 'geboostet'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-white/30">{formatDate(e.start_date)}</span>
                  {e.location_name && (
                    <span className="text-xs text-white/20">{e.location_name}</span>
                  )}
                </div>
              </div>
              <BoostControl
                boosted={e.is_boosted}
                busy={boostingId === e.id}
                onStart={(days) => setBoost(e.id, true, days)}
                onEnd={() => setBoost(e.id, false)}
              />
              <button
                onClick={() => deleteEvent(e.id)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-red-400/60 hover:bg-red-400/10 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reported Content */}
      <div className="mt-8">
        <h3 className="text-sm uppercase tracking-wider text-white/40 font-medium mb-3">
          Reported Content
        </h3>
        <div className="text-center py-12 rounded-xl border border-dashed border-white/[0.06]">
          <AlertTriangle className="w-8 h-8 text-white/10 mx-auto mb-2" />
          <p className="text-xs text-white/20">No reported content</p>
        </div>
      </div>
    </div>
  );
}
