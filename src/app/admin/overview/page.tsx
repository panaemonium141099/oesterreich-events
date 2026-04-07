'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  Users,
  Calendar,
  UsersRound,
  UserPlus,
  MapPin,
} from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalEvents: number;
  totalGroups: number;
  newUsersToday: number;
  newUsersWeek: number;
  venueMatchCount: number;
  venueMatchRate: number;
  eventsByBundesland: { bundesland: string; count: number }[];
  eventsBySource: { source_name: string; count: number }[];
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  sub?: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5 text-white/30" />}
        <p className="text-xs text-white/40">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminOverviewPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
    if (!loading && user && profile && profile.role !== 'god' && profile.role !== 'admin') {
      router.push('/map');
    }
  }, [loading, user, profile, router]);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);

    const [
      { count: totalUsers },
      { count: totalEvents },
      { count: totalGroups },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('groups').select('*', { count: 'exact', head: true }),
    ]);

    // New users today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: newUsersToday } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // New users this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: newUsersWeek } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString());

    // Venue match count (events with venue_id)
    const { count: venueMatchCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .not('venue_id', 'is', null);

    const total = totalEvents || 0;
    const matched = venueMatchCount || 0;
    const venueMatchRate = total > 0 ? Math.round((matched / total) * 100) : 0;

    // Events by bundesland
    const { data: blData } = await supabase
      .from('events')
      .select('bundesland')
      .not('bundesland', 'is', null);

    const blCounts: Record<string, number> = {};
    (blData || []).forEach((e: { bundesland: string | null }) => {
      if (e.bundesland) {
        blCounts[e.bundesland] = (blCounts[e.bundesland] || 0) + 1;
      }
    });
    const eventsByBundesland = Object.entries(blCounts)
      .map(([bundesland, count]) => ({ bundesland, count }))
      .sort((a, b) => b.count - a.count);

    // Events by source
    const { data: srcData } = await supabase
      .from('events')
      .select('source_name')
      .not('source_name', 'is', null);

    const srcCounts: Record<string, number> = {};
    (srcData || []).forEach((e: { source_name: string | null }) => {
      if (e.source_name) {
        srcCounts[e.source_name] = (srcCounts[e.source_name] || 0) + 1;
      }
    });
    const eventsBySource = Object.entries(srcCounts)
      .map(([source_name, count]) => ({ source_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setStats({
      totalUsers: totalUsers || 0,
      totalEvents: total,
      totalGroups: totalGroups || 0,
      newUsersToday: newUsersToday || 0,
      newUsersWeek: newUsersWeek || 0,
      venueMatchCount: matched,
      venueMatchRate,
      eventsByBundesland,
      eventsBySource,
    });
    setLoadingStats(false);
  }, [supabase]);

  useEffect(() => {
    if (user && profile && (profile.role === 'god' || profile.role === 'admin')) {
      fetchStats();
    }
  }, [user, profile, fetchStats]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (profile.role !== 'god' && profile.role !== 'admin') {
    return null;
  }

  const maxBLCount = stats?.eventsByBundesland?.[0]?.count || 1;
  const maxSrcCount = stats?.eventsBySource?.[0]?.count || 1;

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 60%), #000' }}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <Link href="/admin" className="text-white/40 hover:text-white transition-colors text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Admin Panel
        </Link>
        <p className="text-xs tracking-[0.2em] uppercase text-white/30">Overview</p>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {loadingStats ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : stats && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Benutzer gesamt" value={stats.totalUsers} icon={Users} />
              <StatCard label="Events gesamt" value={stats.totalEvents} icon={Calendar} />
              <StatCard label="Gruppen gesamt" value={stats.totalGroups} icon={UsersRound} />
              <StatCard label="Neue User (Woche)" value={stats.newUsersWeek} icon={UserPlus} />
              <StatCard
                label="Venue Match Rate"
                value={`${stats.venueMatchRate}%`}
                icon={MapPin}
                sub={`${stats.venueMatchCount.toLocaleString('de-AT')} / ${stats.totalEvents.toLocaleString('de-AT')} Events`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Events by Bundesland */}
              <div>
                <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-3">Events nach Bundesland</h3>
                <div className="space-y-2">
                  {stats.eventsByBundesland.map((bl) => (
                    <div key={bl.bundesland} className="flex items-center gap-3">
                      <span className="text-xs text-white/60 w-32 truncate">{bl.bundesland}</span>
                      <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white/20 rounded-full"
                          style={{ width: `${(bl.count / maxBLCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-white/30 w-12 text-right">{bl.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Events by Source */}
              <div>
                <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-3">Events nach Quelle (Top 10)</h3>
                <div className="space-y-2">
                  {stats.eventsBySource.map((src) => (
                    <div key={src.source_name} className="flex items-center gap-3">
                      <span className="text-xs text-white/60 w-32 truncate">{src.source_name}</span>
                      <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400/30 rounded-full"
                          style={{ width: `${(src.count / maxSrcCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-white/30 w-12 text-right">{src.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* New Users */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <h3 className="text-sm font-medium mb-2">Neue Benutzer</h3>
              <div className="flex gap-6">
                <div>
                  <span className="text-2xl font-bold">{stats.newUsersToday}</span>
                  <span className="text-xs text-white/40 ml-2">heute</span>
                </div>
                <div>
                  <span className="text-2xl font-bold">{stats.newUsersWeek}</span>
                  <span className="text-xs text-white/40 ml-2">diese Woche</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
