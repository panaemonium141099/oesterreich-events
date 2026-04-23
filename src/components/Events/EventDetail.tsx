'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Event } from '@/types/events';
import { EventImage } from './EventImage';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { downloadICS, getGoogleCalendarUrl } from '@/lib/calendar/ics';
import { CheckIcon, CalendarIcon } from '../UI/Icons';
import { TagChip } from '../UI/TagChip';
import confetti from 'canvas-confetti';
import { trackEvent } from '@/lib/analytics';
import { formatDateLong, formatTime } from '@/lib/utils/date';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

interface EventDetailProps {
  event: Event;
  onClose: () => void;
  eveningMode?: boolean;
  onTagClick?: (tag: string) => void;
}

// formatDateLong provides the long weekday+month format used in detail views
// formatTime handles midnight/1am business rule for hiding no-time-set values

const REMINDER_OPTIONS = [
  { label: '1 Stunde vorher', hours: 1 },
  { label: '1 Tag vorher', hours: 24 },
  { label: '1 Woche vorher', hours: 168 },
];

export function EventDetail({ event, onClose, eveningMode, onTagClick }: EventDetailProps) {
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
    const shareUrl = `${window.location.origin}${buildEventUrlV2(event)}`;
    navigator.clipboard.writeText(shareUrl);
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
    const shareUrl = `${window.location.origin}${buildEventUrlV2(event)}`;
    navigator.clipboard.writeText(shareUrl);
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
          <EventImage
            src={event.image_url}
            category={event.category}
            title={event.title}
            alt={event.title || ''}
            className="animate-ken-burns w-full h-full absolute inset-0"
            wrapperClassName="w-full h-full"
            loading="eager"
            fetchPriority="high"
          />
          <div className={`absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t ${eveningMode ? 'from-gray-800' : 'from-white'} to-transparent`} />
        </div>
        {/* Content */}
        <div className="p-6">
          {/* Tags */}
          {event.tags && event.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {event.tags.map((tag) => (
                <TagChip
                  key={tag}
                  tag={tag}
                  eveningMode={eveningMode}
                  size="md"
                  onClick={onTagClick ? () => onTagClick(tag) : undefined}
                />
              ))}
            </div>
          ) : event.category ? (
            <div className="mb-3">
              <TagChip
                tag={event.category}
                eveningMode={eveningMode}
                size="md"
                onClick={onTagClick ? () => onTagClick(event.category!) : undefined}
              />
            </div>
          ) : null}

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
                  {formatDateLong(event.start_date)}
                </p>
                {startTime && (
                  <p className={`text-xs ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
                    {startTime}{endTime ? ` - ${endTime}` : ''}
                  </p>
                )}
                {event.end_date && event.end_date.split('T')[0] !== event.start_date.split('T')[0] && (
                  <p className={`text-xs ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
                    bis {formatDateLong(event.end_date)}
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

          {/* Description — prefer the AI-cleaned `suggested_description`
              when the scraper left literal HTML tags (<p>, <br>) in the
              raw `description`; otherwise fall back to the raw one with
              HTML stripped so we never show <p>...</p> to the user. */}
          {(() => {
            const raw = event.description ?? '';
            const hasHtml = /<\/?[a-z][^>]*>/i.test(raw);
            const chosen = hasHtml && event.suggested_description
              ? event.suggested_description
              : raw.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
            if (!chosen) return null;
            return (
              <div className="mb-5">
                <h3 className={`text-sm font-semibold mb-2 ${eveningMode ? 'text-gray-300' : 'text-slate-700'}`}>Beschreibung</h3>
                {/* Preview only — 3 lines. Full text lives on the
                    /events/{plz-ort}/{date}/{slug} detail page the CTA
                    at the bottom of this panel navigates to. */}
                <p className={`text-sm leading-relaxed whitespace-pre-line line-clamp-3 ${eveningMode ? 'text-gray-400' : 'text-slate-600'}`}>
                  {chosen}
                </p>
              </div>
            );
          })()}

          {/* Enrichment — tags, flags, audience/vibe/occasion/setting,
              price tier + price flags. Populated by enrich-openai.ts
              (schema v2, see docs/TAXONOMY.md §3). All optional; if no
              enrichment fields exist we render nothing here. */}
          {(event.tags?.length || event.audience?.length || event.vibe?.length
            || event.occasion_tags?.length || event.setting?.length
            || event.price_flags?.length
            || event.is_student_friendly || event.is_family_friendly
            || (event.price_tier && event.price_tier !== 'unbekannt')) && (
            <div className="mb-5 space-y-3">
              {/* Top row — flags + price chip + price-flag chips (NEU v3) */}
              {(event.is_student_friendly || event.is_family_friendly
                || (event.price_tier && event.price_tier !== 'unbekannt')
                || event.price_flags?.length) && (
                <div className="flex flex-wrap gap-1.5">
                  {event.is_student_friendly && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${eveningMode ? 'bg-cyan-900/40 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>
                      🎓 Studentisch
                    </span>
                  )}
                  {event.is_family_friendly && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${eveningMode ? 'bg-pink-900/40 text-pink-300' : 'bg-pink-100 text-pink-700'}`}>
                      👨‍👩‍👧 Familienfreundlich
                    </span>
                  )}
                  {event.price_tier && event.price_tier !== 'unbekannt' && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      event.price_tier === 'gratis'
                        ? (eveningMode ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-700')
                        : event.price_tier === 'günstig'
                        ? (eveningMode ? 'bg-lime-900/40 text-lime-300' : 'bg-lime-100 text-lime-700')
                        : event.price_tier === 'mittel'
                        ? (eveningMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700')
                        : (eveningMode ? 'bg-rose-900/40 text-rose-300' : 'bg-rose-100 text-rose-700')
                    }`}>
                      {event.price_tier === 'gratis' ? 'Gratis'
                        : event.price_tier === 'günstig' ? '💶 Günstig'
                        : event.price_tier === 'mittel' ? '💶 Mittel'
                        : '💶 Premium'}
                    </span>
                  )}
                  {event.duration_type && event.duration_type !== 'kurz' && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${eveningMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                      {event.duration_type === 'abend' ? 'Abend'
                        : event.duration_type === 'ganztag' ? 'Ganztag'
                        : event.duration_type === 'mehrtägig' ? 'Mehrtägig'
                        : event.duration_type === 'dauerausstellung' ? 'Dauerausstellung'
                        : event.duration_type === 'nacht-bis-morgen' ? 'Nacht → Morgen'
                        : event.duration_type}
                    </span>
                  )}
                  {/* Price flags — v3 additions (happy-hour, studentenrabatt, …) */}
                  {event.price_flags?.map(pf => (
                    <span key={`pf-${pf}`} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      pf === 'happy-hour' || pf === 'getraenke-special'
                        ? (eveningMode ? 'bg-orange-900/40 text-orange-300' : 'bg-orange-100 text-orange-700')
                        : pf === 'studentenrabatt' || pf === 'damenrabatt'
                        ? (eveningMode ? 'bg-cyan-900/40 text-cyan-300' : 'bg-cyan-100 text-cyan-700')
                        : pf === 'freier-eintritt'
                        ? (eveningMode ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-700')
                        : pf === 'barrierefrei' || pf === 'kinderwagengeeignet'
                        ? (eveningMode ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-100 text-indigo-700')
                        : (eveningMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')
                    }`}>
                      {pf === 'happy-hour' ? '🍹 Happy Hour'
                        : pf === 'freier-eintritt' ? '🎟 Frei'
                        : pf === 'studentenrabatt' ? '🎓 Studentenrabatt'
                        : pf === 'damenrabatt' ? '💃 Damen-Rabatt'
                        : pf === 'getraenke-special' ? '🍻 Drink-Special'
                        : pf === 'mit-anmeldung' ? 'Mit Anmeldung'
                        : pf === 'ohne-anmeldung' ? 'Ohne Anmeldung'
                        : pf === 'barrierefrei' ? '♿ Barrierefrei'
                        : pf === 'kinderwagengeeignet' ? '🚼 Kinderwagen-OK'
                        : pf === 'fuer-anfaenger' ? 'Für Anfänger'
                        : pf === 'unter-20-euro' ? 'Unter 20€'
                        : pf}
                    </span>
                  ))}
                </div>
              )}

              {/* Occasion-Tags — v3 additions. "Wofür ist das Event gut?" */}
              {event.occasion_tags && event.occasion_tags.length > 0 && (
                <div>
                  <h4 className={`text-[10px] uppercase tracking-wider mb-1.5 font-medium ${eveningMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Wofür gut
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {event.occasion_tags.slice(0, 4).map(o => (
                      <span key={`occ-${o}`} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        eveningMode
                          ? 'bg-violet-900/30 text-violet-300 border border-violet-800/40'
                          : 'bg-violet-50 text-violet-700 border border-violet-200'
                      }`}>
                        {o === 'ausgehen' ? '🌃 Ausgehen'
                          : o === 'saufen-gehen' ? '🍻 Saufen gehen'
                          : o === 'date-night' ? '💕 Date Night'
                          : o === 'afterwork' ? '🕕 Afterwork'
                          : o === 'wochenendplan' ? 'Wochenendplan'
                          : o === 'teamevent' ? 'Teamevent'
                          : o === 'spontan' ? 'Spontan'
                          : o === 'tagesausflug' ? '🚗 Tagesausflug'
                          : o === 'regentag' ? '🌧 Regentag'
                          : o === 'geburtstagsidee' ? '🎂 Geburtstag'
                          : o === 'erstes-date' ? 'Erstes Date'
                          : o === 'fuer-den-abend' ? 'Für den Abend'
                          : o === 'kennenlernen' ? 'Kennenlernen'
                          : o === 'networking-anlass' ? 'Networking'
                          : o === 'feierabend' ? 'Feierabend'
                          : o === 'kurzfristig-heute' ? 'Kurzfristig heute'
                          : o}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags — the content/genre row (multi-dim labels from AI) */}
              {event.tags && event.tags.length > 0 && (
                <div>
                  <h4 className={`text-[10px] uppercase tracking-wider mb-1.5 font-medium ${eveningMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {event.tags.slice(0, 8).map(t => (
                      <TagChip key={t} tag={t} onClick={onTagClick ? () => onTagClick(t) : undefined} eveningMode={eveningMode} size="sm" />
                    ))}
                  </div>
                </div>
              )}

              {/* Audience + Vibe + Setting — softer inline chips, all in
                  one row to avoid visual heaviness */}
              {((event.audience?.length ?? 0) + (event.vibe?.length ?? 0) + (event.setting?.length ?? 0)) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {event.audience?.slice(0, 3).map(a => (
                    <span key={`aud-${a}`} className={`text-[10px] px-2 py-0.5 rounded-full ${eveningMode ? 'bg-slate-800/60 text-slate-400 border border-slate-700' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                      {a}
                    </span>
                  ))}
                  {event.vibe?.slice(0, 2).map(v => (
                    <span key={`vib-${v}`} className={`text-[10px] px-2 py-0.5 rounded-full ${eveningMode ? 'bg-purple-900/30 text-purple-300 border border-purple-800/40' : 'bg-purple-50 text-purple-600 border border-purple-200'}`}>
                      {v}
                    </span>
                  ))}
                  {event.setting?.slice(0, 2).map(s => (
                    <span key={`set-${s}`} className={`text-[10px] px-2 py-0.5 rounded-full ${eveningMode ? 'bg-teal-900/30 text-teal-300 border border-teal-800/40' : 'bg-teal-50 text-teal-600 border border-teal-200'}`}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Source info */}
          <div className={`flex items-center gap-2 text-xs mb-4 ${eveningMode ? 'text-gray-600' : 'text-slate-400'}`}>
            <span>Quelle: {event.source_name}</span>
          </div>

          {/* Action Buttons — primary CTA always navigates to our own
              detail page (/events/{plz-ort}/{date}/{slug}). From there the
              user finds the "Zur Quelle" / ticket link. This preview panel
              is explicitly a PREVIEW — full content + external links live
              on the detail page to keep the UX consistent regardless of
              whether the user came from a map pin, sidebar item, saved
              list, etc. */}
          <div className="flex gap-3">
            <a
              href={buildEventUrlV2(event)}
              onClick={() => trackEvent('link_click', { event_id: event.id, event_title: event.title, type: 'detail' })}
              className={`flex-1 text-white text-sm font-medium rounded-xl py-3 px-4 text-center transition-colors flex items-center justify-center gap-2 ${
                eveningMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Zur Event-Seite
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>

            {/* Merken / Erinnern — transforming button */}
            {!isSaved ? (
              <button
                onClick={handleSaveToggle}
                disabled={savingEvent}
                className={`px-5 py-3 text-sm font-medium rounded-xl transition-all duration-500 flex items-center gap-2 active:animate-save-pulse motion-reduce:transform-none ${
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
                  } ${justSaved ? 'animate-heart-pop' : 'animate-fade-in'}`}
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
                className={`px-4 py-3 text-sm font-medium rounded-xl transition-colors flex items-center gap-2 active:animate-share-ripple motion-reduce:transform-none ${
                  copied || sharedToFriend
                    ? 'text-green-600 bg-green-50 animate-heart-pop'
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
