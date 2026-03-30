'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import ScraperPanel from '@/components/Admin/ScraperPanel';

type Tab = 'overview' | 'users' | 'events' | 'scraper' | 'moderation';

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

interface EventRow {
  id: string;
  title: string;
  start_date: string;
  location_name: string | null;
  category: string | null;
  source_name: string | null;
  source_type: string;
  bundesland: string | null;
}

interface Stats {
  totalUsers: number;
  totalEvents: number;
  totalGroups: number;
  newUsersToday: number;
  newUsersWeek: number;
  eventsByBundesland: { bundesland: string; count: number }[];
  eventsBySource: { source_name: string; count: number }[];
}

export default function AdminPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Users tab
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<{ savedEvents: number; groups: number; friends: number } | null>(null);
  const [roleChanging, setRoleChanging] = useState<string | null>(null);

  // Events tab
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventSearch, setEventSearch] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventStats, setEventStats] = useState<{ byCategory: { category: string; count: number }[]; byBundesland: { bundesland: string; count: number }[] } | null>(null);

  // Scraper tab (now handled by ScraperPanel component)

  // Moderation tab
  const [userEvents, setUserEvents] = useState<EventRow[]>([]);
  const [loadingModeration, setLoadingModeration] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
    if (!loading && user && profile && profile.role !== 'god' && profile.role !== 'admin') {
      router.push('/map');
    }
  }, [loading, user, profile, router]);

  // Fetch overview stats
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

    // Events by bundesland - use RPC or a manual approach
    const { data: blData } = await supabase
      .from('events')
      .select('bundesland')
      .not('bundesland', 'is', null);

    const blCounts: Record<string, number> = {};
    (blData || []).forEach((e: any) => {
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
    (srcData || []).forEach((e: any) => {
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
      totalEvents: totalEvents || 0,
      totalGroups: totalGroups || 0,
      newUsersToday: newUsersToday || 0,
      newUsersWeek: newUsersWeek || 0,
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

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    let query = supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, avatar_url, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (userSearch.trim()) {
      query = query.or(`first_name.ilike.%${userSearch}%,last_name.ilike.%${userSearch}%,email.ilike.%${userSearch}%`);
    }

    const { data } = await query;
    setUsers((data as UserRow[]) || []);
    setLoadingUsers(false);
  }, [supabase, userSearch]);

  useEffect(() => {
    if (tab === 'users') {
      const timer = setTimeout(() => fetchUsers(), 300);
      return () => clearTimeout(timer);
    }
  }, [tab, userSearch, fetchUsers]);

  // Expand user details
  const toggleExpandUser = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      setExpandedData(null);
      return;
    }
    setExpandedUser(userId);
    const [
      { count: savedEvents },
      { count: groups },
      { count: friends },
    ] = await Promise.all([
      supabase.from('saved_events').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('status', 'accepted').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    ]);
    setExpandedData({
      savedEvents: savedEvents || 0,
      groups: groups || 0,
      friends: friends || 0,
    });
  };

  const changeRole = async (userId: string, newRole: string) => {
    setRoleChanging(userId);
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    setRoleChanging(null);
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Benutzer wirklich l\u00f6schen? Diese Aktion kann nicht r\u00fcckg\u00e4ngig gemacht werden.')) return;
    await supabase.from('profiles').delete().eq('id', userId);
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  // Fetch events
  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    let query = supabase
      .from('events')
      .select('id, title, start_date, location_name, category, source_name, source_type, bundesland')
      .order('start_date', { ascending: false })
      .limit(50);

    if (eventSearch.trim()) {
      query = query.ilike('title', `%${eventSearch}%`);
    }

    const { data } = await query;
    setEvents((data as EventRow[]) || []);

    // Event stats
    const { data: catData } = await supabase
      .from('events')
      .select('category')
      .not('category', 'is', null);

    const catCounts: Record<string, number> = {};
    (catData || []).forEach((e: any) => {
      if (e.category) catCounts[e.category] = (catCounts[e.category] || 0) + 1;
    });

    const { data: blData } = await supabase
      .from('events')
      .select('bundesland')
      .not('bundesland', 'is', null);

    const blCounts: Record<string, number> = {};
    (blData || []).forEach((e: any) => {
      if (e.bundesland) blCounts[e.bundesland] = (blCounts[e.bundesland] || 0) + 1;
    });

    setEventStats({
      byCategory: Object.entries(catCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      byBundesland: Object.entries(blCounts)
        .map(([bundesland, count]) => ({ bundesland, count }))
        .sort((a, b) => b.count - a.count),
    });

    setLoadingEvents(false);
  }, [supabase, eventSearch]);

  useEffect(() => {
    if (tab === 'events') {
      const timer = setTimeout(() => fetchEvents(), 300);
      return () => clearTimeout(timer);
    }
  }, [tab, eventSearch, fetchEvents]);

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Event wirklich l\u00f6schen?')) return;
    await supabase.from('events').delete().eq('id', eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
  };

  // Scraper sources fetching moved to ScraperPanel component

  // Fetch moderation items
  const fetchModeration = useCallback(async () => {
    setLoadingModeration(true);
    const { data } = await supabase
      .from('events')
      .select('id, title, start_date, location_name, category, source_name, source_type, bundesland')
      .in('source_type', ['user', 'business'])
      .order('created_at', { ascending: false })
      .limit(50);

    setUserEvents((data as EventRow[]) || []);
    setLoadingModeration(false);
  }, [supabase]);

  useEffect(() => {
    if (tab === 'moderation') fetchModeration();
  }, [tab, fetchModeration]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-AT', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: '\u00dcbersicht' },
    { key: 'users', label: 'Users' },
    { key: 'events', label: 'Events' },
    { key: 'scraper', label: 'Scraper' },
    { key: 'moderation', label: 'Moderation' },
  ];

  const StatCard = ({ label, value }: { label: string; value: string | number }) => (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );

  const maxBLCount = stats?.eventsByBundesland?.[0]?.count || 1;
  const maxSrcCount = stats?.eventsBySource?.[0]?.count || 1;

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 60%), #000' }}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <Link href="/map" className="text-white/40 hover:text-white transition-colors text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zur&uuml;ck zur Karte
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-xs">&#9889;</span>
          <p className="text-xs tracking-[0.2em] uppercase text-white/30">Admin Panel</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 p-1 rounded-xl bg-white/5 border border-white/10 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                tab === t.key
                  ? 'bg-white text-black'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          loadingStats ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : stats && (
            <div className="space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Benutzer gesamt" value={stats.totalUsers} />
                <StatCard label="Events gesamt" value={stats.totalEvents} />
                <StatCard label="Gruppen gesamt" value={stats.totalGroups} />
                <StatCard label="Neue User (Woche)" value={stats.newUsersWeek} />
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
          )
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div>
            <div className="relative mb-4">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Benutzer suchen..."
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>

            {loadingUsers ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => toggleExpandUser(u.id)}
                    >
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white/60">
                          {u.first_name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-white/30 truncate">{u.email}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        u.role === 'god' ? 'bg-amber-400/20 text-amber-400' :
                        u.role === 'admin' ? 'bg-blue-400/20 text-blue-400' :
                        u.role === 'business' ? 'bg-purple-400/20 text-purple-400' :
                        'bg-white/10 text-white/40'
                      }`}>
                        {u.role}
                      </span>
                      <span className="text-xs text-white/20">{formatDate(u.created_at)}</span>
                      <svg className={`w-4 h-4 text-white/20 transition-transform ${expandedUser === u.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>

                    {expandedUser === u.id && (
                      <div className="px-3 pb-3 pt-1 border-t border-white/5">
                        {expandedData && (
                          <div className="flex gap-4 mb-3">
                            <span className="text-xs text-white/30">{expandedData.savedEvents} gespeicherte Events</span>
                            <span className="text-xs text-white/30">{expandedData.groups} Gruppen</span>
                            <span className="text-xs text-white/30">{expandedData.friends} Freunde</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-white/40">Rolle:</label>
                          <select
                            value={u.role}
                            onChange={(e) => changeRole(u.id, e.target.value)}
                            disabled={roleChanging === u.id}
                            className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none disabled:opacity-50"
                          >
                            <option value="user">user</option>
                            <option value="business">business</option>
                            <option value="admin">admin</option>
                            <option value="god">god</option>
                          </select>
                          <button
                            onClick={() => deleteUser(u.id)}
                            className="text-xs px-3 py-1 rounded-lg text-red-400/60 hover:bg-red-400/10 hover:text-red-400 transition-colors ml-auto"
                          >
                            L&ouml;schen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Events Tab */}
        {tab === 'events' && (
          <div>
            <div className="relative mb-4">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                placeholder="Events suchen..."
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>

            {/* Event Stats Summary */}
            {eventStats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">Nach Kategorie</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {eventStats.byCategory.slice(0, 10).map((c) => (
                      <div key={c.category} className="flex items-center justify-between">
                        <span className="text-xs text-white/60 truncate">{c.category}</span>
                        <span className="text-xs text-white/30">{c.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">Nach Bundesland</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {eventStats.byBundesland.map((bl) => (
                      <div key={bl.bundesland} className="flex items-center justify-between">
                        <span className="text-xs text-white/60 truncate">{bl.bundesland}</span>
                        <span className="text-xs text-white/30">{bl.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {loadingEvents ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-white/30">{formatDate(e.start_date)}</span>
                        {e.location_name && <span className="text-xs text-white/20 truncate">{e.location_name}</span>}
                      </div>
                    </div>
                    {e.category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/40 shrink-0">{e.category}</span>
                    )}
                    {e.source_name && (
                      <span className="text-[10px] text-white/20 shrink-0">{e.source_name}</span>
                    )}
                    <button
                      onClick={() => deleteEvent(e.id)}
                      className="text-xs px-2 py-1 rounded-lg text-red-400/60 hover:bg-red-400/10 hover:text-red-400 transition-colors shrink-0"
                    >
                      L&ouml;schen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Scraper Tab */}
        {tab === 'scraper' && <ScraperPanel />}

        {/* Moderation Tab */}
        {tab === 'moderation' && (
          <div>
            <h2 className="text-lg font-bold mb-4">User-erstellte Events</h2>

            {loadingModeration ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : userEvents.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-white/40 text-sm">Keine user-erstellten Events zur Moderation</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{e.title}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          e.source_type === 'business' ? 'bg-purple-400/20 text-purple-400' : 'bg-blue-400/20 text-blue-400'
                        }`}>
                          {e.source_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-white/30">{formatDate(e.start_date)}</span>
                        {e.location_name && <span className="text-xs text-white/20">{e.location_name}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteEvent(e.id)}
                      className="text-xs px-3 py-1.5 rounded-lg text-red-400/60 hover:bg-red-400/10 hover:text-red-400 transition-colors"
                    >
                      L&ouml;schen
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Reported Content Placeholder */}
            <div className="mt-8">
              <h3 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-3">Gemeldete Inhalte</h3>
              <div className="text-center py-12 rounded-xl border border-dashed border-white/10">
                <svg className="w-8 h-8 text-white/10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-xs text-white/20">Noch keine gemeldeten Inhalte</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
