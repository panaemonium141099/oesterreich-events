'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';

interface CalendarEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  image_url: string | null;
  category: string | null;
  source_url: string | null;
  description: string | null;
}

interface SavedEventRow {
  id: string;
  event_id: string;
  events: CalendarEvent;
}

interface ReminderRow {
  id: string;
  event_id: string;
  remind_at: string;
  type: string;
  sent: boolean;
}

interface Friend {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

interface CalendarShare {
  id: string;
  owner_id: string;
  viewer_id: string;
  status: string;
  color: string;
}

interface FriendEvent extends CalendarEvent {
  friend_id?: string;
}

type ViewMode = 'mine' | 'custom' | 'friends';

const BUNDESLAND_OPTIONS = [
  { value: '', label: 'Alle Bundesländer' },
  { value: 'burgenland', label: 'Burgenland' },
  { value: 'kaernten', label: 'Kärnten' },
  { value: 'niederoesterreich', label: 'Niederösterreich' },
  { value: 'oberoesterreich', label: 'Oberösterreich' },
  { value: 'salzburg', label: 'Salzburg' },
  { value: 'steiermark', label: 'Steiermark' },
  { value: 'tirol', label: 'Tirol' },
  { value: 'vorarlberg', label: 'Vorarlberg' },
  { value: 'wien', label: 'Wien' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'Alle Kategorien' },
  { value: 'Musik', label: 'Musik' },
  { value: 'Nightlife', label: 'Nightlife' },
  { value: 'Wein & Kulinarik', label: 'Wein & Kulinarik' },
  { value: 'Kultur', label: 'Kultur' },
  { value: 'Märkte', label: 'Märkte' },
  { value: 'Sport', label: 'Sport' },
  { value: 'Familie', label: 'Familie' },
  { value: 'Natur', label: 'Natur' },
  { value: 'Feste & Brauchtum', label: 'Feste & Brauchtum' },
  { value: 'Bildung', label: 'Bildung' },
  { value: 'Gesundheit', label: 'Gesundheit' },
  { value: 'Religion', label: 'Religion' },
  { value: 'Sonstiges', label: 'Sonstiges' },
];

interface CustomFilters {
  category: string;
  bundesland: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Musik': 'bg-purple-500',
  'Nightlife': 'bg-pink-500',
  'Wein & Kulinarik': 'bg-amber-500',
  'Kultur': 'bg-blue-500',
  'Märkte': 'bg-orange-500',
  'Sport': 'bg-green-500',
  'Familie': 'bg-cyan-500',
  'Natur': 'bg-emerald-500',
  'Feste & Brauchtum': 'bg-red-500',
  'Bildung': 'bg-indigo-500',
  'Gesundheit': 'bg-teal-500',
  'Religion': 'bg-yellow-500',
  'Sonstiges': 'bg-gray-500',
};

const FRIEND_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-400', hex: '#3b82f6' },
  { bg: 'bg-green-500', text: 'text-green-400', hex: '#22c55e' },
  { bg: 'bg-purple-500', text: 'text-purple-400', hex: '#a855f7' },
  { bg: 'bg-orange-500', text: 'text-orange-400', hex: '#f97316' },
  { bg: 'bg-pink-500', text: 'text-pink-400', hex: '#ec4899' },
  { bg: 'bg-teal-500', text: 'text-teal-400', hex: '#14b8a6' },
  { bg: 'bg-rose-500', text: 'text-rose-400', hex: '#f43f5e' },
  { bg: 'bg-indigo-500', text: 'text-indigo-400', hex: '#6366f1' },
];

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

function formatMonthYear(year: number, month: number) {
  return new Date(year, month).toLocaleDateString('de-AT', { month: 'long', year: 'numeric' });
}

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatEventTime(dateStr: string): string | null {
  if (!dateStr || dateStr.length <= 10 || !dateStr.includes('T')) return null;
  const d = new Date(dateStr);
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
}

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('mine');
  const [events, setEvents] = useState<FriendEvent[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<FriendEvent | null>(null);

  // Custom filter state (persisted in localStorage)
  const [customFilters, setCustomFilters] = useState<CustomFilters>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('calendar_custom_filters');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return { category: '', bundesland: '' };
  });

  // Persist custom filters to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('calendar_custom_filters', JSON.stringify(customFilters));
    } catch { /* ignore */ }
  }, [customFilters]);

  // Friend calendar sharing state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [calendarShares, setCalendarShares] = useState<CalendarShare[]>([]);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<(CalendarShare & { requester?: Friend })[]>([]);
  const [requestingFriendId, setRequestingFriendId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  // Fetch friends and calendar shares when in friends mode
  const fetchFriendsAndShares = useCallback(async () => {
    if (!user) return;

    // Get accepted friendships
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const friendIds = (friendships || []).map((f: { requester_id: string; addressee_id: string }) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );

    if (friendIds.length > 0) {
      // Get friend profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', friendIds);

      setFriends((profiles as Friend[]) || []);
    } else {
      setFriends([]);
    }

    // Get calendar shares where I am the viewer (accepted)
    const { data: viewerShares } = await supabase
      .from('calendar_shares')
      .select('id, owner_id, viewer_id, status, color')
      .eq('viewer_id', user.id);

    setCalendarShares((viewerShares as CalendarShare[]) || []);

    // Get incoming requests (where someone wants to see MY calendar)
    const { data: incoming } = await supabase
      .from('calendar_shares')
      .select('id, owner_id, viewer_id, status, color')
      .eq('owner_id', user.id)
      .eq('status', 'pending');

    if (incoming && incoming.length > 0) {
      const requesterIds = incoming.map((r: CalendarShare) => r.viewer_id);
      const { data: requesterProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', requesterIds);

      const profileMap = new Map((requesterProfiles || []).map((p: Friend) => [p.id, p]));
      setIncomingRequests(incoming.map((r: CalendarShare) => ({
        ...r,
        requester: profileMap.get(r.viewer_id) as Friend | undefined,
      })));
    } else {
      setIncomingRequests([]);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (viewMode === 'friends' && user) {
      fetchFriendsAndShares();
    }
  }, [viewMode, user, fetchFriendsAndShares]);

  const fetchMyEvents = useCallback(async () => {
    if (!user) return;
    setLoadingEvents(true);

    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();

    // Use !inner join to only return saved_events where the event still exists
    const { data, error } = await supabase
      .from('saved_events')
      .select('id, event_id, events!inner(id, title, start_date, end_date, location_name, image_url, category, source_url, description)')
      .eq('user_id', user.id);

    if (error) {
      if (process.env.NODE_ENV === 'development') console.warn('fetchMyEvents error:', error.message);
      setEvents([]);
      setLoadingEvents(false);
      return;
    }

    if (data) {
      const evts = (data as unknown as SavedEventRow[])
        .map(r => r.events)
        .filter(Boolean)
        .filter(e => {
          const d = new Date(e.start_date);
          return d >= new Date(startOfMonth) && d <= new Date(endOfMonth);
        });
      setEvents(evts);
    } else {
      setEvents([]);
    }
    setLoadingEvents(false);
  }, [user, currentYear, currentMonth, supabase]);

  const fetchCustomEvents = useCallback(async () => {
    setLoadingEvents(true);

    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();

    // Only fetch if at least one filter is set
    if (!customFilters.category && !customFilters.bundesland) {
      setEvents([]);
      setLoadingEvents(false);
      return;
    }

    let query = supabase
      .from('events')
      .select('id, title, start_date, end_date, location_name, image_url, category, source_url, description')
      .gte('start_date', startOfMonth)
      .lte('start_date', endOfMonth)
      .order('start_date')
      .limit(500);

    if (customFilters.category) {
      query = query.eq('category', customFilters.category);
    }
    if (customFilters.bundesland) {
      query = query.eq('bundesland', customFilters.bundesland);
    }

    const { data } = await query;

    setEvents(data || []);
    setLoadingEvents(false);
  }, [currentYear, currentMonth, supabase, customFilters]);

  const fetchFriendsEvents = useCallback(async () => {
    if (!user) return;
    setLoadingEvents(true);

    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();

    // Only fetch events from selected friends who have shared their calendar with us
    const acceptedShares = calendarShares.filter(s => s.status === 'accepted');
    const sharedFriendIds = acceptedShares.map(s => s.owner_id);

    // Filter to only selected friends (if any are selected), intersecting with shared
    const friendIdsToFetch = selectedFriends.length > 0
      ? selectedFriends.filter(id => sharedFriendIds.includes(id))
      : sharedFriendIds;

    if (friendIdsToFetch.length === 0) {
      setEvents([]);
      setLoadingEvents(false);
      return;
    }

    const { data } = await supabase
      .from('saved_events')
      .select('id, event_id, user_id, events(id, title, start_date, end_date, location_name, image_url, category, source_url, description)')
      .in('user_id', friendIdsToFetch);

    if (data) {
      const evts = (data as unknown as (SavedEventRow & { user_id: string })[])
        .filter(r => r.events)
        .map(r => ({
          ...r.events,
          friend_id: r.user_id,
        }))
        .filter(e => {
          const d = new Date(e.start_date);
          return d >= new Date(startOfMonth) && d <= new Date(endOfMonth);
        });
      setEvents(evts);
    } else {
      setEvents([]);
    }
    setLoadingEvents(false);
  }, [user, currentYear, currentMonth, supabase, calendarShares, selectedFriends]);

  const fetchReminders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('event_reminders')
      .select('id, event_id, remind_at, type, sent')
      .eq('user_id', user.id);
    setReminders(data || []);
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;
    if (viewMode === 'mine') fetchMyEvents();
    else if (viewMode === 'custom') fetchCustomEvents();
    else if (viewMode === 'friends') fetchFriendsEvents();
    fetchReminders();
  }, [user, viewMode, currentYear, currentMonth, fetchMyEvents, fetchCustomEvents, fetchFriendsEvents, fetchReminders]);

  // Helper: get friend color
  const getFriendColor = useCallback((friendId: string) => {
    const share = calendarShares.find(s => s.owner_id === friendId && s.status === 'accepted');
    if (share?.color) {
      const match = FRIEND_COLORS.find(c => c.hex === share.color);
      if (match) return match;
    }
    // Fallback: assign by index
    const idx = friends.findIndex(f => f.id === friendId);
    return FRIEND_COLORS[idx >= 0 ? idx % FRIEND_COLORS.length : 0];
  }, [calendarShares, friends]);

  // Helper: get friend name
  const getFriendName = useCallback((friendId: string) => {
    const friend = friends.find(f => f.id === friendId);
    return friend ? `${friend.first_name} ${friend.last_name}` : '';
  }, [friends]);

  // Request calendar access from a friend
  const requestCalendarAccess = useCallback(async (friendId: string) => {
    if (!user) return;
    setRequestingFriendId(friendId);

    const colorIdx = friends.findIndex(f => f.id === friendId);
    const color = FRIEND_COLORS[colorIdx >= 0 ? colorIdx % FRIEND_COLORS.length : 0].hex;

    await supabase
      .from('calendar_shares')
      .insert({
        owner_id: friendId,
        viewer_id: user.id,
        status: 'pending',
        color,
      });

    await fetchFriendsAndShares();
    setRequestingFriendId(null);
  }, [user, friends, supabase, fetchFriendsAndShares]);

  // Accept/reject incoming request
  const handleIncomingRequest = useCallback(async (shareId: string, accept: boolean) => {
    if (accept) {
      await supabase
        .from('calendar_shares')
        .update({ status: 'accepted' })
        .eq('id', shareId);
    } else {
      await supabase
        .from('calendar_shares')
        .update({ status: 'rejected' })
        .eq('id', shareId);
    }
    await fetchFriendsAndShares();
  }, [supabase, fetchFriendsAndShares]);

  // Toggle friend selection
  const toggleFriendSelection = useCallback((friendId: string) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  }, []);

  // Build a map of day -> events
  const eventsByDay = useMemo(() => {
    const map: Record<number, FriendEvent[]> = {};
    for (const evt of events) {
      const d = new Date(evt.start_date);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(evt);
      }
    }
    return map;
  }, [events, currentYear, currentMonth]);

  const reminderEventIds = useMemo(() => new Set(reminders.map(r => r.event_id)), [reminders]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const todayDay = today.getFullYear() === currentYear && today.getMonth() === currentMonth ? today.getDate() : null;

  const goToPrev = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
    setSelectedDay(null);
  };

  const goToNext = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
    setSelectedDay(null);
  };

  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDay(today.getDate());
  };

  const selectedDayEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

  const viewModes: { key: ViewMode; label: string }[] = [
    { key: 'mine', label: 'Meine Events' },
    { key: 'custom', label: 'Custom' },
    { key: 'friends', label: 'Freunde' },
  ];

  // Get share status for a friend
  const getShareStatus = useCallback((friendId: string): 'none' | 'pending' | 'accepted' | 'rejected' => {
    const share = calendarShares.find(s => s.owner_id === friendId);
    if (!share) return 'none';
    return share.status as 'pending' | 'accepted' | 'rejected';
  }, [calendarShares]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white pb-24 gradient-mesh"
    >
{/* View Mode Toggle */}
      <div className="px-6 py-3 border-b border-white/10">
        <div className="max-w-3xl mx-auto flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
          {viewModes.map((v) => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === v.key ? 'bg-white text-black' : 'text-white/40 hover:text-white/60'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Filter Bar */}
      {viewMode === 'custom' && (
        <div className="px-6 py-3 border-b border-white/10">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={customFilters.category}
                onChange={(e) => setCustomFilters(prev => ({ ...prev, category: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 appearance-none cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-white/20"
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-[#111] text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={customFilters.bundesland}
                onChange={(e) => setCustomFilters(prev => ({ ...prev, bundesland: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 appearance-none cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-white/20"
              >
                {BUNDESLAND_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-[#111] text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
              {(customFilters.category || customFilters.bundesland) && (
                <button
                  onClick={() => setCustomFilters({ category: '', bundesland: '' })}
                  className="text-xs text-white/40 hover:text-white/60 transition-colors underline underline-offset-2"
                >
                  Filter zur&uuml;cksetzen
                </button>
              )}
            </div>
            {!customFilters.category && !customFilters.bundesland && (
              <p className="text-xs text-white/30 mt-2">W&auml;hle mindestens einen Filter um Events anzuzeigen.</p>
            )}
          </div>
        </div>
      )}

      {/* Incoming Calendar Requests Banner */}
      {incomingRequests.length > 0 && viewMode === 'friends' && (
        <div className="px-6 py-3 border-b border-white/10">
          <div className="max-w-3xl mx-auto space-y-2">
            {incomingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                    {req.requester?.avatar_url ? (
                      <img src={req.requester.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm text-white/80 truncate">
                    <span className="font-medium text-white">
                      {req.requester ? `${req.requester.first_name} ${req.requester.last_name}` : 'Jemand'}
                    </span>
                    {' '}m&ouml;chte deinen Kalender sehen
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleIncomingRequest(req.id, true)}
                    className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors"
                  >
                    Annehmen
                  </button>
                  <button
                    onClick={() => handleIncomingRequest(req.id, false)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors"
                  >
                    Ablehnen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friend Picker (only in friends mode) */}
      {viewMode === 'friends' && (
        <div className="px-6 py-3 border-b border-white/10">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setShowFriendPicker(!showFriendPicker)}
              className="flex items-center gap-2 text-sm text-white/60 hover:text-white/80 transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${showFriendPicker ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Freunde ausw&auml;hlen ({friends.length})
            </button>

            {showFriendPicker && (
              <div className="mt-3 space-y-1">
                {friends.length === 0 ? (
                  <p className="text-sm text-white/30 py-2">Noch keine Freunde hinzugef&uuml;gt.</p>
                ) : (
                  friends.map((friend) => {
                    const status = getShareStatus(friend.id);
                    const color = getFriendColor(friend.id);
                    const isSelected = selectedFriends.length === 0 || selectedFriends.includes(friend.id);

                    return (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Toggle checkbox */}
                          {status === 'accepted' && (
                            <button
                              onClick={() => toggleFriendSelection(friend.id)}
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? 'border-transparent'
                                  : 'border-white/20 bg-transparent'
                              }`}
                              style={isSelected ? { backgroundColor: color.hex, borderColor: color.hex } : {}}
                            >
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          )}

                          {/* Color dot */}
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: status === 'accepted' ? color.hex : 'rgba(255,255,255,0.1)' }}
                          />

                          {/* Avatar */}
                          <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden shrink-0">
                            {friend.avatar_url ? (
                              <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/40 text-xs font-medium">
                                {friend.first_name[0]}{friend.last_name[0]}
                              </div>
                            )}
                          </div>

                          {/* Name */}
                          <span className="text-sm text-white/80 truncate">
                            {friend.first_name} {friend.last_name}
                          </span>
                        </div>

                        {/* Status / Action */}
                        <div className="shrink-0">
                          {status === 'accepted' && (
                            <span className="text-xs text-green-400/60 px-2 py-1 rounded-lg bg-green-500/10">
                              Geteilt
                            </span>
                          )}
                          {status === 'pending' && (
                            <span className="text-xs text-amber-400/60 px-2 py-1 rounded-lg bg-amber-500/10">
                              Angefragt
                            </span>
                          )}
                          {status === 'rejected' && (
                            <span className="text-xs text-red-400/60 px-2 py-1 rounded-lg bg-red-500/10">
                              Abgelehnt
                            </span>
                          )}
                          {status === 'none' && (
                            <button
                              onClick={() => requestCalendarAccess(friend.id)}
                              disabled={requestingFriendId === friend.id}
                              className="text-xs text-white/50 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white/70 transition-colors disabled:opacity-50"
                            >
                              {requestingFriendId === friend.id ? 'Wird angefragt...' : 'Kalender anfragen'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={goToPrev} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold capitalize">{formatMonthYear(currentYear, currentMonth)}</h2>
            <button
              onClick={goToToday}
              className="text-xs px-2.5 py-1 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
            >
              Heute
            </button>
          </div>
          <button onClick={goToNext} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="mb-6">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs text-white/30 font-medium py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = eventsByDay[day] || [];
              const isToday = day === todayDay;
              const isSelected = day === selectedDay;
              const hasReminder = dayEvents.some(e => reminderEventIds.has(e.id));

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all relative ${
                    isSelected
                      ? 'bg-white text-black ring-2 ring-white'
                      : isToday
                      ? 'bg-white/10 text-white ring-1 ring-white/30'
                      : 'hover:bg-white/5 text-white/70'
                  }`}
                >
                  <span className={`text-sm font-medium ${isSelected ? 'text-black' : ''}`}>{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap justify-center max-w-[80%]">
                      {dayEvents.slice(0, 3).map((evt, idx) => {
                        // In friends mode, use friend color; otherwise use category color
                        const dotColor = viewMode === 'friends' && evt.friend_id
                          ? undefined
                          : undefined;
                        const dotStyle = viewMode === 'friends' && evt.friend_id
                          ? { backgroundColor: isSelected ? 'rgba(0,0,0,0.6)' : getFriendColor(evt.friend_id).hex }
                          : {};
                        const dotClass = viewMode === 'friends' && evt.friend_id
                          ? 'w-1.5 h-1.5 rounded-full'
                          : `w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-black/60' : (CATEGORY_COLORS[evt.category || ''] || 'bg-white/40')
                            }`;

                        return (
                          <div
                            key={idx}
                            className={dotClass}
                            style={dotStyle}
                          />
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className={`text-[8px] ${isSelected ? 'text-black/60' : 'text-white/40'}`}>+{dayEvents.length - 3}</span>
                      )}
                    </div>
                  )}
                  {hasReminder && (
                    <div className={`absolute top-1 right-1 w-2 h-2 ${isSelected ? 'text-black' : 'text-amber-400'}`}>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading indicator */}
        {loadingEvents && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Selected Day Panel */}
        {selectedDay !== null && (
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-sm font-semibold text-white/60 mb-4">
              {new Date(currentYear, currentMonth, selectedDay).toLocaleDateString('de-AT', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              <span className="ml-2 text-white/30">({selectedDayEvents.length} Events)</span>
            </h3>

            {selectedDayEvents.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-white/30 text-sm">
                  {viewMode === 'friends'
                    ? 'Keine Events von Freunden an diesem Tag'
                    : viewMode === 'custom' && !customFilters.category && !customFilters.bundesland
                    ? 'Setze Filter um Events zu sehen'
                    : 'Keine Events an diesem Tag'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((evt) => {
                  const time = formatEventTime(evt.start_date);
                  const hasReminder = reminderEventIds.has(evt.id);
                  const friendColor = viewMode === 'friends' && evt.friend_id
                    ? getFriendColor(evt.friend_id)
                    : null;
                  const friendName = viewMode === 'friends' && evt.friend_id
                    ? getFriendName(evt.friend_id)
                    : null;

                  return (
                    <button
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors text-left"
                      style={friendColor ? { borderLeftWidth: '3px', borderLeftColor: friendColor.hex } : {}}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-white/10">
                        {evt.image_url ? (
                          <img src={evt.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${CATEGORY_COLORS[evt.category || ''] || 'bg-white/10'}`}>
                            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{evt.title}</p>
                          {hasReminder && (
                            <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-white/30 truncate">
                          {friendName && (
                            <span style={{ color: friendColor?.hex }} className="font-medium">{friendName} &middot; </span>
                          )}
                          {time && <span className="text-white/50">{time} &middot; </span>}
                          {evt.location_name || 'Kein Ort'}
                        </p>
                        {evt.category && (
                          <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[evt.category] || 'bg-white/10'} text-white/80`}>
                            {evt.category}
                          </span>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="w-full max-w-md bg-[#111] border border-white/10 rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image */}
            {selectedEvent.image_url && (
              <div className="w-full h-48 overflow-hidden">
                <img src={selectedEvent.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6">
              {/* Friend badge in modal */}
              {viewMode === 'friends' && selectedEvent.friend_id && (
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: getFriendColor(selectedEvent.friend_id).hex }}
                  />
                  <span className="text-xs text-white/50">
                    Gespeichert von {getFriendName(selectedEvent.friend_id)}
                  </span>
                </div>
              )}
              {selectedEvent.category && (
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full mb-2 ${CATEGORY_COLORS[selectedEvent.category] || 'bg-white/10'} text-white/80`}>
                  {selectedEvent.category}
                </span>
              )}
              <h2 className="text-lg font-bold mb-3">{selectedEvent.title}</h2>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{formatEventDate(selectedEvent.start_date)}</span>
                  {formatEventTime(selectedEvent.start_date) && (
                    <span className="text-white/40">{formatEventTime(selectedEvent.start_date)}</span>
                  )}
                </div>
                {selectedEvent.location_name && (
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span>{selectedEvent.location_name}</span>
                  </div>
                )}
              </div>

              {selectedEvent.description && (
                <p className="text-sm text-white/40 line-clamp-3 mb-4">{selectedEvent.description}</p>
              )}

              <div className="flex gap-2">
                {selectedEvent.source_url && (
                  <a
                    href={selectedEvent.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-medium text-center hover:bg-white/90 transition-colors"
                  >
                    Zum Event
                  </a>
                )}
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 text-white/60 text-sm hover:bg-white/20 transition-colors"
                >
                  Schliessen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
