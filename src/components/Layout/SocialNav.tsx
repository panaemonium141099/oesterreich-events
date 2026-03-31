'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';

const NAV_ITEMS = [
  { href: '/map', label: 'Karte', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { href: '/feed', label: 'Feed', icon: 'M4 11a9 9 0 019 9M4 4a16 16 0 0116 16', extraPath: 'M5 19a1 1 0 100-2 1 1 0 000 2z' },
  { href: '/groups', label: 'Planen', icon: 'M12 4v16m8-8H4' },
  { href: '/messages', label: 'Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', hasUnread: true },
  { href: '/profile', label: 'Profil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

export function SocialNav() {
  const pathname = usePathname();
  const [tooltip, setTooltip] = useState<string | null>(null);
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

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 mb-4 z-50 flex items-center gap-1 px-2 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
      {NAV_ITEMS.map((item) => {
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
    </nav>
  );
}
