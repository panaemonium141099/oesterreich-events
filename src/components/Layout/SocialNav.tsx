'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';

// fn-15.5: motion-lib AnimatePresence + spring slide-in replaced
// with CSS `data-sheet-state` + `data-overlay-state` swap (globals.css).
// EXIT_DURATION_MS keeps the DOM mounted long enough for the slide-out
// to play before unmount, mirroring AnimatePresence's keep-alive
// behavior.
const MORE_SHEET_EXIT_MS = 320;

/** Main bottom-nav items. `unreadKey` routes the badge to the right
 *  live-count state (chat vs. notifications). Without it the notification
 *  bell had no mobile access point — the desktop header bell isn't
 *  rendered on small screens, so new follow-invites, event alerts, artist
 *  matches etc. stayed invisible to phone users until they opened the
 *  "More" sheet (not obvious). Adding the 4th item keeps the nav bar at
 *  5 slots total (44 px each ≈ 230 px wide, fits every viewport). */
// Layout: 5 main slots + More. Home is centred at index 2, Notifications
// sit immediately to its right per user feedback ("Home in der Mitte und
// daneben die Benachrichtigungen"). Map / Feed flank the left, Chat sits
// at the far right.
const MAIN_ITEMS: Array<{
  href: string;
  label: string;
  icon: string;
  extraPath?: string;
  /** Which live-count state to read for the unread badge. Omit for
   *  items that don't show a count. */
  unreadKey?: 'messages' | 'notifications';
}> = [
  { href: '/map', label: 'Karte', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { href: '/feed', label: 'Feed', icon: 'M4 11a9 9 0 019 9M4 4a16 16 0 0116 16', extraPath: 'M5 19a1 1 0 100-2 1 1 0 000 2z' },
  { href: '/?home', label: 'Startseite', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z' },
  { href: '/notifications', label: 'Benachrichtigungen', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', unreadKey: 'notifications' },
  { href: '/messages', label: 'Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', unreadKey: 'messages' },
];

const MORE_ITEMS = [
  { href: '/profile', label: 'Profil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { href: '/artists', label: 'Kuenstler', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
  { href: '/calendar', label: 'Kalender', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/blog', label: 'Blog', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
  // Home moved into MAIN_ITEMS at the centre; entry kept out of MORE
  // to avoid duplicate "Startseite" links.
  { href: '/saved', label: 'Gespeicherte Events', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { href: '/friends', label: 'Freunde', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  // Renamed from "Gruppen" → "Planen": route stays (/groups), but label + icon
  // now match what users actually DO there — plan an outing, create a group
  // event, build a shared wishlist. Clipboard-with-check icon reads as
  // "planning" cross-culturally and doesn't visually overlap /calendar.
  { href: '/groups', label: 'Planen', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
];

const MORE_HREFS = MORE_ITEMS.map((i) => i.href);

export function SocialNav() {
  const pathname = usePathname();
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  // Keeps the More-sheet DOM node mounted through its exit animation.
  const [sheetMounted, setSheetMounted] = useState(false);
  useEffect(() => {
    if (moreOpen) {
      setSheetMounted(true);
      return;
    }
    if (!sheetMounted) return;
    const t = window.setTimeout(() => setSheetMounted(false), MORE_SHEET_EXIT_MS);
    return () => window.clearTimeout(t);
  }, [moreOpen, sheetMounted]);
  const { user } = useAuth();
  const supabase = createClient();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const fetchUnreadMessages = useCallback(async () => {
    if (!user) return;
    try {
      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('read', false);
      setUnreadMessages(count || 0);
    } catch { /* ignore */ }
  }, [user, supabase]);

  const fetchUnreadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      // `notifications` table uses `read_at IS NULL` to mark unread (same
      // pattern NotificationBell uses on desktop). Covers all notification
      // types: group invites, friend requests, artist matches, reminders.
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      setUnreadNotifications(count || 0);
    } catch { /* ignore */ }
  }, [user, supabase]);

  useEffect(() => {
    fetchUnreadMessages();
    fetchUnreadNotifications();
    // 30 s fallback poll in case Realtime drops a frame (PWA background
    // tabs, flaky connections). Realtime below still handles the fast path.
    const interval = setInterval(() => {
      fetchUnreadMessages();
      fetchUnreadNotifications();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnreadMessages, fetchUnreadNotifications]);

  // Realtime subscription — both direct_messages and notifications land
  // on the same channel for a single WebSocket rather than two.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('social-nav-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${user.id}` },
        () => { fetchUnreadMessages(); },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${user.id}` },
        () => { fetchUnreadMessages(); },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { fetchUnreadNotifications(); },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { fetchUnreadNotifications(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase, fetchUnreadMessages, fetchUnreadNotifications]);

  // Close More sheet when navigating
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const isMoreActive = MORE_HREFS.some(
    (href) => href === '/?home' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
  );

  // Only render for logged-in users
  if (!user) return null;

  const moreState = moreOpen ? 'open' : 'closed';

  return (
    <>
      {/* Overlay */}
      {sheetMounted && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setMoreOpen(false)}
          data-social-nav
          data-overlay-state={moreState}
        />
      )}

      {/* More bottom sheet */}
      {sheetMounted && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/[0.06] rounded-t-2xl px-4 pt-4 pb-24"
          data-social-nav
          data-sheet-state={moreState}
        >
            {/* Drag handle */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MORE_ITEMS.map((item) => {
                const isActive = item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-colors ${
                      isActive
                        ? 'bg-white/[0.10] text-white/90'
                        : 'text-white/50 hover:bg-white/[0.04] hover:text-white/70'
                    }`}
                  >
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                    <span className="text-[11px] font-medium leading-tight text-center">{item.label}</span>
                  </Link>
                );
              })}
            </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 mb-4 z-50 flex items-center gap-1 px-2 py-2 bg-[#1c1c1e]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-2xl"
        data-social-nav
      >
        {MAIN_ITEMS.map((item) => {
          // The Home item routes to /?home (forces landing render even
          // for logged-in users); active state matches the bare landing
          // path because Next strips query strings from pathname.
          const isActive = item.href === '/?home'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(item.href + '/');
          // Route the badge to the right live-count state. `unreadKey` is
          // set on items that carry a live count (chat, notifications),
          // undefined on the ones that don't (map, feed).
          const unreadCount = item.unreadKey === 'notifications'
            ? unreadNotifications
            : item.unreadKey === 'messages'
            ? unreadMessages
            : 0;
          const showBadge = unreadCount > 0;
          return (
            <div key={item.href} className="relative">
              <Link
                href={item.href}
                onMouseEnter={() => setTooltip(item.label)}
                onMouseLeave={() => setTooltip(null)}
                aria-label={item.label}
                className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200 active:scale-[0.92] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none ${
                  isActive
                    ? 'bg-white/[0.10] text-white/90'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
                }`}
              >
                <svg className="w-5 h-5 shrink-0" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 1 : 1.5} d={item.icon} />
                  {'extraPath' in item && item.extraPath && (
                    <path d={item.extraPath} fill="currentColor" stroke="none" />
                  )}
                </svg>
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
                )}
                {/* Unread badge */}
                {showBadge && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-[#1c1c1e]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              {/* Tooltip */}
              {tooltip === item.label && (
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] font-medium text-white/90 bg-[#1c1c1e] shadow-lg border border-white/[0.10] backdrop-blur-sm rounded-md whitespace-nowrap pointer-events-none animate-fade-in motion-reduce:animate-none">
                  {item.label}
                </span>
              )}
            </div>
          );
        })}

        {/* More button */}
        <div className="relative">
          <button
            onClick={() => setMoreOpen((o) => !o)}
            onMouseEnter={() => setTooltip('Mehr')}
            onMouseLeave={() => setTooltip(null)}
            aria-label="Mehr"
            className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200 active:scale-[0.92] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none ${
              isMoreActive || moreOpen
                ? 'bg-white/[0.10] text-white/90'
                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
            }`}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h.01M12 12h.01M19 12h.01" />
            </svg>
            {(isMoreActive && !moreOpen) && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
            )}
          </button>
          {/* Tooltip */}
          {tooltip === 'Mehr' && !moreOpen && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] font-medium text-white/90 bg-[#1c1c1e] shadow-lg border border-white/[0.10] backdrop-blur-sm rounded-md whitespace-nowrap pointer-events-none animate-fade-in motion-reduce:animate-none">
              Mehr
            </span>
          )}
        </div>
      </nav>
    </>
  );
}
