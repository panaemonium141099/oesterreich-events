'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';

const MAIN_ITEMS = [
  { href: '/map', label: 'Karte', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { href: '/feed', label: 'Feed', icon: 'M4 11a9 9 0 019 9M4 4a16 16 0 0116 16', extraPath: 'M5 19a1 1 0 100-2 1 1 0 000 2z' },
  { href: '/messages', label: 'Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', hasUnread: true },
];

const MORE_ITEMS = [
  { href: '/profile', label: 'Profil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { href: '/artists', label: 'Kuenstler', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
  { href: '/calendar', label: 'Kalender', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/blog', label: 'Blog', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
  { href: '/', label: 'Startseite', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z' },
  { href: '/saved', label: 'Gespeicherte Events', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { href: '/friends', label: 'Freunde', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { href: '/groups', label: 'Gruppen', icon: 'M17 20h5v-2a3 3 0 00-3-3h-1m-5 5v-2a3 3 0 00-3-3H7a3 3 0 00-3 3v2m8-10a3 3 0 110-6 3 3 0 010 6zm8 0a3 3 0 110-6 3 3 0 010 6zM7 10a3 3 0 110-6 3 3 0 010 6z' },
];

const MORE_HREFS = MORE_ITEMS.map((i) => i.href);

export function SocialNav() {
  const pathname = usePathname();
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const { user } = useAuth();
  const supabase = createClient();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    try {
      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    } catch {
      // ignore
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('social-nav-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${user.id}` },
        () => { fetchUnread(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${user.id}` },
        () => { fetchUnread(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase, fetchUnread]);

  // Close More sheet when navigating
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const isMoreActive = MORE_HREFS.some(
    (href) => href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
  );

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            key="more-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* More bottom sheet */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            key="more-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1a1c]/95 backdrop-blur-xl border border-white/[0.08] rounded-t-2xl px-4 pt-4 pb-24"
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
                        ? 'bg-white/10 text-white'
                        : 'text-white/60 hover:bg-white/[0.06] hover:text-white/90'
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 mb-4 z-50 flex items-center gap-1 px-2 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
        {MAIN_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const showBadge = 'hasUnread' in item && item.hasUnread && unreadCount > 0;
          return (
            <div key={item.href} className="relative">
              <Link
                href={item.href}
                onMouseEnter={() => setTooltip(item.label)}
                onMouseLeave={() => setTooltip(null)}
                aria-label={item.label}
                className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200 active:scale-[0.92] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
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
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-black/40">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              {/* Tooltip */}
              {tooltip === item.label && (
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] font-medium text-white bg-black/80 backdrop-blur-sm rounded-md whitespace-nowrap pointer-events-none animate-fade-in motion-reduce:animate-none">
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
                ? 'bg-white/15 text-white'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
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
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] font-medium text-white bg-black/80 backdrop-blur-sm rounded-md whitespace-nowrap pointer-events-none animate-fade-in motion-reduce:animate-none">
              Mehr
            </span>
          )}
        </div>
      </nav>
    </>
  );
}
