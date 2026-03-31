'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Event } from '@/types/events';
import { getEventImage, getCategoryFallbackImage } from '@/lib/categoryImages';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { downloadICS, getGoogleCalendarUrl } from '@/lib/calendar/ics';
import { CheckIcon, CalendarIcon } from '../UI/Icons';
import confetti from 'canvas-confetti';
import { trackEvent } from '@/lib/analytics';

interface EventDetailProps {
  event: Event;
  onClose: () => void;
  eveningMode?: boolean;
}

function formatDateTime(dateStr: string): string {
  try {
    // For date-only strings (YYYY-MM-DD), parse as local to avoid UTC timezone shift
    const dateOnly = dateStr.length === 10 && !dateStr.includes('T');
    const date = dateOnly ? new Date(dateStr + 'T12:00:00') : new Date(dateStr);
    return date.toLocaleDateString('de-AT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr: string): string | null {
  try {
    // If date string has no time component (just YYYY-MM-DD), don't show time
    if (!dateStr || dateStr.length <= 10 || !dateStr.includes('T')) return null;
    const date = new Date(dateStr);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    // Hide 00:00 and 01:00 — these indicate no real time was set
    // (01:00 appears due to UTC+1 CET timezone offset for midnight dates)
    if (hours === 0 && minutes === 0) return null;
    if (hours === 1 && minutes === 0) return null;
    return date.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

const REMINDER_OPTIONS = [
  { label: '1 Stunde vorher', hours: 1 },
  { label: '1 Tag vorher', hours: 24 },
  { label: '1 Woche vorher', hours: 168 },
];

export function EventDetail({ event, onClose, eveningMode }: EventDetailProps) {
  const startTime = formatTime(event.start_date);
  const endTime = event.end_date ? formatTime(event.end_date) : null;
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);
  const [showReminderMenu, setShowReminderMenu] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [activeReminder, setActiveReminder] = useState<{ id: string; remind_at: string } | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);
  const [customReminderDate, setCustomReminderDate] = useState('');
  const [showCustomReminder, setShowCustomReminder] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const calendarMenuRef = useRef<HTMLDivElement>(null);
  const reminderMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisible(true);
    trackEvent('event_click', { event_id: event.id, event_title: event.title, source: event.source_name });
    // Check if event is saved
    if (user && event.id) {
      supabase
        .from('saved_events')
        .select('id')
        .eq('user_id', user.id)
        .eq('event_id', event.id)
        .maybeSingle()
        .then(({ data }: { data: unknown }) => setIsSaved(!!data));

      // Check for active reminder
      supabase
        .from('event_reminders')
        .select('id, remind_at')
        .eq('user_id', user.id)
        .eq('event_id', event.id)
        .maybeSingle()
        .then(({ data }: { data: { id: string; remind_at: string } | null }) => {
          if (data) setActiveReminder(data);
        });
    }
  }, [event.id, user]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (calendarMenuRef.current && !calendarMenuRef.current.contains(e.target as Node)) {
        setShowCalendarMenu(false);
      }
      if (reminderMenuRef.current && !reminderMenuRef.current.contains(e.target as Node)) {
        setShowReminderMenu(false);
        setShowCustomReminder(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 300);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(event.source_url || window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToggle = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setSavingEvent(true);
    if (isSaved) {
      await supabase.from('saved_events').delete().eq('user_id', user.id).eq('event_id', event.id);
      // Also remove reminder
      if (activeReminder) {
        await supabase.from('event_reminders').delete().eq('id', activeReminder.id);
        setActiveReminder(null);
      }
      setIsSaved(false);
    } else {
      await supabase.from('saved_events').insert({ user_id: user.id, event_id: event.id });
      setIsSaved(true);
      trackEvent('event_save', { event_id: event.id });
      // Konfetti!
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.7, x: 0.5 },
        colors: ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'],
        zIndex: 9999,
      });
      // Auto-create 1 week reminder
      const eventDate = new Date(event.start_date);
      const remindAt = new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (remindAt > new Date()) {
        const { data } = await supabase
          .from('event_reminders')
          .insert({ user_id: user.id, event_id: event.id, remind_at: remindAt.toISOString(), type: 'auto' })
          .select('id, remind_at')
          .single();
        if (data) setActiveReminder(data);
      }
    }
    setSavingEvent(false);
  };

  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showFriendShareSearch, setShowFriendShareSearch] = useState(false);
  const [friendShareQuery, setFriendShareQuery] = useState('');
  const [friendResults, setFriendResults] = useState<Array<{id: string; first_name: string; last_name: string}>>([]);
  const [sharedToFriend, setSharedToFriend] = useState('');
  const shareMenuRef = useRef<HTMLDivElement>(null);

  const handleShareLink = () => {
    navigator.clipboard.writeText(event.source_url || window.location.href);
    setCopied(true);
    setShowShareMenu(false);
    setTimeout(() => setCopied(false), 2000);
    trackEvent('event_share', { event_id: event.id, method: 'link' });
  };

  const handleShareToFriend = async (friendId: string, friendName: string) => {
    if (!user) return;
    await supabase.from('direct_messages').insert({
      sender_id: user.id,
      receiver_id: friendId,
      content: `Schau dir das an: ${event.title}`,
      message_type: 'event_share',
      event_id: event.id,
    });
    setSharedToFriend(friendName);
    setShowFriendShareSearch(false);
    setShowShareMenu(false);
    setTimeout(() => setSharedToFriend(''), 3000);
    trackEvent('event_share', { event_id: event.id, method: 'chat' });
  };

  const searchFriends = async (q: string) => {
    if (!user || q.length < 1) { setFriendResults([]); return; }
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const friendIds = (friendships || []).map((f: { requester_id: string; addressee_id: string }) => f.requester_id === user.id ? f.addressee_id : f.requester_id);
    if (friendIds.length === 0) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', friendIds)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    setFriendResults(data || []);
  };

  const handleDownloadICS = () => {
    downloadICS({
      title: event.title,
      description: event.description,
      start_date: event.start_date,
      end_date: event.end_date,
      location_name: event.location_name,
      address: event.address,
      source_url: event.source_url,
    });
    setShowCalendarMenu(false);
  };

  const handleGoogleCalendar = () => {
    const url = getGoogleCalendarUrl({
      title: event.title,
      description: event.description,
      start_date: event.start_date,
      end_date: event.end_date,
      location_name: event.location_name,
      address: event.address,
      source_url: event.source_url,
    });
    window.open(url, '_blank');
    setShowCalendarMenu(false);
  };

  const handleSetReminder = async (hoursBeforeEvent: number) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setSavingReminder(true);
    trackEvent('event_reminder', { event_id: event.id, type: `${hoursBeforeEvent}h` });
    const eventDate = new Date(event.start_date);
    const remindAt = new Date(eventDate.getTime() - hoursBeforeEvent * 60 * 60 * 1000);
    const remindAtIso = remindAt.toISOString();

    // Optimistically set the reminder state immediately so the button turns amber
    const previousReminder = activeReminder;
    const optimisticId = activeReminder?.id || 'local-' + Date.now();
    setActiveReminder({ id: optimisticId, remind_at: remindAtIso });

    try {
      if (previousReminder && !previousReminder.id.startsWith('local-')) {
        await supabase
          .from('event_reminders')
          .update({ remind_at: remindAtIso, sent: false })
          .eq('id', previousReminder.id);
        setActiveReminder({ id: previousReminder.id, remind_at: remindAtIso });
      } else {
        // Delete any existing local-only reminder row that might exist
        if (previousReminder && previousReminder.id.startsWith('local-')) {
          // Try upsert approach - delete old then insert new
        }
        const { data, error } = await supabase
          .from('event_reminders')
          .insert({
            user_id: user.id,
            event_id: event.id,
            remind_at: remindAtIso,
            type: 'push',
          })
          .select('id, remind_at')
          .single();
        if (data) {
          setActiveReminder(data);
        } else if (error) {
          if (process.env.NODE_ENV === 'development') console.warn('Reminder save failed:', error.message);
          // Keep the optimistic state so button stays amber
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.warn('Reminder save error:', err);
      // Keep the optimistic state so button stays amber
    }
    setSavingReminder(false);
    setShowReminderMenu(false);
  };

  // Track which reminder label was selected for display
  const activeReminderLabel = activeReminder ? (() => {
    const diffMs = new Date(event.start_date).getTime() - new Date(activeReminder.remind_at).getTime();
    const diffH = Math.round(diffMs / 3600000);
    const match = REMINDER_OPTIONS.find(o => Math.abs(o.hours - diffH) < 2);
    return match?.label || (diffH > 24 ? Math.round(diffH/24) + ' Tage vorher' : diffH + 'h vorher');
  })() : null;

  const handleSetCustomReminder = async () => {
    if (!user || !customReminderDate) return;
    setSavingReminder(true);
    const remindAt = new Date(customReminderDate);

    if (activeReminder) {
      await supabase
        .from('event_reminders')
        .update({ remind_at: remindAt.toISOString(), sent: false })
        .eq('id', activeReminder.id);
      setActiveReminder({ id: activeReminder.id, remind_at: remindAt.toISOString() });
    } else {
      const { data } = await supabase
        .from('event_reminders')
        .insert({
          user_id: user.id,
          event_id: event.id,
          remind_at: remindAt.toISOString(),
          type: 'push',
        })
        .select('id, remind_at')
        .single();
      if (data) setActiveReminder(data);
    }
    setSavingReminder(false);
    setShowReminderMenu(false);
    setShowCustomReminder(false);
  };

  const handleDeleteReminder = async () => {
    if (!activeReminder) return;
    setSavingReminder(true);
    await supabase.from('event_reminders').delete().eq('id', activeReminder.id);
    setActiveReminder(null);
    setSavingReminder(false);
    setShowReminderMenu(false);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`absolute inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`relative rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto detail-scrollbar ${
        eveningMode ? 'bg-gray-800' : 'bg-white'
      } ${visible ? 'animate-slide-up' : 'animate-slide-down'}`}>
        {/* Close Button */}
        <button
          onClick={handleClose}
          aria-label="Details schließen"
          className="absolute top-6 right-6 z-10 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-white hover:rotate-90 transition-all duration-200"
        >
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Hero Image */}
        <div className="w-full h-64 overflow-hidden rounded-t-2xl relative">
          <img
            src={getEventImage(event.image_url, event.category)}
            alt={event.title || ''}
            className="w-full h-full object-cover animate-ken-burns"
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.dataset.fallback) {
                img.dataset.fallback = '1';
                img.src = getCategoryFallbackImage(event.category);
              }
            }}
          />
          <div className={`absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t ${eveningMode ? 'from-gray-800' : 'from-white'} to-transparent`} />
        </div>
        {/* Content */}
        <div className="p-6">
          {/* Category Badge */}
          {event.category && (
            <span className={`inline-block text-xs font-medium px-3 py-1 rounded-full mb-3 ${
              eveningMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-blue-100 text-blue-700'
            }`}>
              {event.category}
            </span>
          )}

          <h2 className={`text-xl font-bold mb-4 ${eveningMode ? 'text-gray-100' : 'text-slate-800'}`}>{event.title}</h2>

          {/* Info Grid */}
          <div className="space-y-3 mb-5">
            {/* Date & Time */}
            <div className={`flex items-start gap-3 ${eveningMode ? 'bg-white/5 rounded-xl p-3 border border-white/10' : 'bg-slate-50/80 rounded-xl p-3 border border-slate-100'}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${eveningMode ? 'bg-indigo-900/40' : 'bg-blue-50'}`}>
                <svg className={`w-5 h-5 ${eveningMode ? 'text-indigo-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm font-medium ${eveningMode ? 'text-gray-200' : 'text-slate-700'}`}>
                  {formatDateTime(event.start_date)}
                </p>
                {startTime && (
                  <p className={`text-xs ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
                    {startTime}{endTime ? ` - ${endTime}` : ''}
                  </p>
                )}
                {event.end_date && event.end_date.split('T')[0] !== event.start_date.split('T')[0] && (
                  <p className={`text-xs ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
                    bis {formatDateTime(event.end_date)}
                  </p>
                )}
              </div>
            </div>

            {/* Location */}
            {event.location_name && (
              <div className={`flex items-start gap-3 ${eveningMode ? 'bg-white/5 rounded-xl p-3 border border-white/10' : 'bg-slate-50/80 rounded-xl p-3 border border-slate-100'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${eveningMode ? 'bg-green-900/40' : 'bg-green-50'}`}>
                  <svg className={`w-5 h-5 ${eveningMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-sm font-medium ${eveningMode ? 'text-gray-200' : 'text-slate-700'}`}>{event.location_name}</p>
                  {event.address && (
                    <p className={`text-xs ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>{event.address}</p>
                  )}
                  {event.district && (
                    <p className={`text-xs ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`}>Bezirk {event.district}</p>
                  )}
                </div>
              </div>
            )}

            {/* Price */}
            {event.price_text && (
              <div className={`flex items-start gap-3 ${eveningMode ? 'bg-white/5 rounded-xl p-3 border border-white/10' : 'bg-slate-50/80 rounded-xl p-3 border border-slate-100'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${eveningMode ? 'bg-amber-900/40' : 'bg-amber-50'}`}>
                  <svg className={`w-5 h-5 ${eveningMode ? 'text-amber-400' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-sm font-medium ${eveningMode ? 'text-gray-200' : 'text-slate-700'}`}>{event.price_text}</p>
                </div>
              </div>
            )}

            {/* Organizer */}
            {event.organizer && (
              <div className={`flex items-start gap-3 ${eveningMode ? 'bg-white/5 rounded-xl p-3 border border-white/10' : 'bg-slate-50/80 rounded-xl p-3 border border-slate-100'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${eveningMode ? 'bg-purple-900/40' : 'bg-purple-50'}`}>
                  <svg className={`w-5 h-5 ${eveningMode ? 'text-purple-400' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-sm font-medium ${eveningMode ? 'text-gray-200' : 'text-slate-700'}`}>{event.organizer}</p>
                  <p className={`text-xs ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`}>Veranstalter</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="mb-5">
              <h3 className={`text-sm font-semibold mb-2 ${eveningMode ? 'text-gray-300' : 'text-slate-700'}`}>Beschreibung</h3>
              <p className={`text-sm leading-relaxed whitespace-pre-line line-clamp-6 ${eveningMode ? 'text-gray-400' : 'text-slate-600'}`}>
                {event.description}
              </p>
            </div>
          )}

          {/* Source info */}
          <div className={`flex items-center gap-2 text-xs mb-4 ${eveningMode ? 'text-gray-600' : 'text-slate-400'}`}>
            <span>Quelle: {event.source_name}</span>
          </div>

          {/* Action Buttons — Clean Flow: Merken → Erinnern + Teilen */}
          <div className="flex gap-3">
            {/* Zum Event */}
            <a
              href={event.source_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('link_click', { url: event.source_url, event_id: event.id, event_title: event.title, type: 'source' })}
              className={`flex-1 text-white text-sm font-medium rounded-xl py-3 px-4 text-center transition-colors flex items-center justify-center gap-2 ${
                eveningMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Zum Event
            </a>

            {/* Merken / Erinnern — transforming button */}
            {!isSaved ? (
              <button
                onClick={handleSaveToggle}
                disabled={savingEvent}
                className={`px-5 py-3 text-sm font-medium rounded-xl transition-all duration-500 flex items-center gap-2 ${
                  eveningMode ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                } ${savingEvent ? 'animate-pulse' : ''}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Merken
              </button>
            ) : (
              <div className="relative" ref={reminderMenuRef}>
                <button
                  onClick={() => setShowReminderMenu(!showReminderMenu)}
                  className={`px-4 py-3 text-sm font-medium rounded-xl transition-all duration-500 flex items-center gap-2 ${
                    activeReminder
                      ? eveningMode
                        ? 'bg-amber-900/40 text-amber-300 border border-amber-600/40'
                        : 'bg-amber-100 text-amber-700 border border-amber-300'
                      : justSaved
                        ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 animate-pulse'
                        : eveningMode
                          ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  } animate-fade-in`}
                >
                  <svg className="w-4 h-4" fill={activeReminder ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {activeReminder ? activeReminderLabel : justSaved ? 'Gemerkt' : 'Erinnern'}
                </button>

                {showReminderMenu && (
                  <div className={`absolute right-0 bottom-full mb-1 w-64 rounded-xl shadow-xl z-50 overflow-hidden ${
                    eveningMode ? 'bg-gray-700 border border-white/10' : 'bg-white border border-slate-200'
                  }`}>
                    {activeReminder && (
                      <div className={`px-4 py-2 text-xs border-b ${
                        eveningMode ? 'bg-amber-900/20 text-amber-400 border-white/10' : 'bg-amber-50 text-amber-700 border-slate-100'
                      }`}>
                        <CheckIcon size={14} className="inline-block mr-1 -mt-0.5" />{new Date(activeReminder.remind_at).toLocaleString('de-AT', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    )}
                    {REMINDER_OPTIONS.map((opt) => (
                      <button
                        key={opt.hours}
                        onClick={() => handleSetReminder(opt.hours)}
                        disabled={savingReminder}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors disabled:opacity-50 ${
                          eveningMode ? 'text-gray-200 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <div className={`border-t ${eveningMode ? 'border-white/10' : 'border-slate-100'}`}>
                      <button
                        onClick={handleDownloadICS}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                          eveningMode ? 'text-gray-200 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <CalendarIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> .ics Download
                      </button>
                    </div>
                    {activeReminder && (
                      <button
                        onClick={handleDeleteReminder}
                        className={`w-full px-4 py-2.5 text-sm text-left transition-colors border-t ${
                          eveningMode ? 'text-red-400 hover:bg-red-900/20 border-white/10' : 'text-red-500 hover:bg-red-50 border-slate-100'
                        }`}
                      >
                        Erinnerung entfernen
                      </button>
                    )}
                    <button
                      onClick={handleSaveToggle}
                      className={`w-full px-4 py-2.5 text-sm text-left transition-colors border-t ${
                        eveningMode ? 'text-red-400 hover:bg-red-900/20 border-white/10' : 'text-red-500 hover:bg-red-50 border-slate-100'
                      }`}
                    >
                      Event entmerken
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Teilen — Link kopieren oder an Freund schicken */}
            <div className="relative" ref={shareMenuRef}>
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className={`px-4 py-3 text-sm font-medium rounded-xl transition-colors flex items-center gap-2 ${
                  copied || sharedToFriend
                    ? 'text-green-600 bg-green-50'
                    : eveningMode ? 'text-gray-300 bg-gray-700 hover:bg-gray-600' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                }`}
              >
                {copied ? <><CheckIcon size={14} className="inline-block mr-1 -mt-0.5" />Kopiert</> : sharedToFriend ? <><CheckIcon size={14} className="inline-block mr-1 -mt-0.5" />An {sharedToFriend}</> : 'Teilen'}
              </button>

              {showShareMenu && (
                <div className={`absolute right-0 bottom-full mb-1 w-64 rounded-xl shadow-xl z-50 overflow-hidden ${
                  eveningMode ? 'bg-gray-700 border border-white/10' : 'bg-white border border-slate-200'
                }`}>
                  <button
                    onClick={handleShareLink}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                      eveningMode ? 'text-gray-200 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Link kopieren
                  </button>
                  {/* Im Feed teilen */}
                  <button
                    onClick={async () => {
                      if (!user) { router.push('/auth/login'); return; }
                      const supabase = createClient();
                      await supabase.from('activities').insert({
                        user_id: user.id,
                        type: 'post',
                        content: `Schaut euch das an: ${event.title}`,
                        event_id: event.id,
                      });
                      setSharedToFriend('Feed');
                      setShowShareMenu(false);
                      setTimeout(() => setSharedToFriend(''), 2000);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                      eveningMode ? 'text-gray-200 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16" />
                      <circle cx="5" cy="19" r="1" fill="currentColor" stroke="none" />
                    </svg>
                    Im Feed teilen
                  </button>

                  {!showFriendShareSearch ? (
                    <button
                      onClick={() => setShowFriendShareSearch(true)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                        eveningMode ? 'text-gray-200 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      An Freund senden
                    </button>
                  ) : (
                    <div className="px-3 py-2 space-y-2">
                      <input
                        type="text"
                        placeholder="Freund suchen..."
                        value={friendShareQuery}
                        onChange={(e) => { setFriendShareQuery(e.target.value); searchFriends(e.target.value); }}
                        className={`w-full px-3 py-2 rounded-lg text-sm ${
                          eveningMode ? 'bg-white/5 border border-white/10 text-white placeholder:text-white/30' : 'bg-slate-50 border border-slate-200 text-slate-700'
                        }`}
                        autoFocus
                      />
                      {friendResults.map(f => (
                        <button
                          key={f.id}
                          onClick={() => handleShareToFriend(f.id, f.first_name)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                            eveningMode ? 'text-gray-200 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                            {f.first_name[0]}
                          </div>
                          {f.first_name} {f.last_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
