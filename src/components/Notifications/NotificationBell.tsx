'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { useNotifications } from '@/components/Notifications/NotificationsProvider';

interface NotificationBellProps {
  className?: string;
}

/**
 * Pre-Refactor: hatte einen eigenen `supabase.channel('notification-bell')`
 * Subscription mit user-id Filter. Drei Komponenten (Bell, Toast,
 * NotificationsPage) hatten alle ihren eigenen Channel = 3× WAL-Decode pro
 * Notification-Event pro eingeloggtem User. Jetzt: lesen aus dem
 * NotificationsProvider Context, der EINE shared Subscription pro User hält.
 */
export function NotificationBell({ className }: NotificationBellProps) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  // Tab-title badge — prefix "(N) " while there are unread notifications, restore on cleanup.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const stripBadge = (t: string) => t.replace(/^\(\d+\)\s+/, '');
    const base = stripBadge(document.title);
    const newTitle = unreadCount > 0
      ? `(${unreadCount > 99 ? '99+' : unreadCount}) ${base}`
      : base;
    if (document.title !== newTitle) document.title = newTitle;
    return () => {
      if (typeof document !== 'undefined') {
        document.title = stripBadge(document.title);
      }
    };
  }, [unreadCount]);

  if (!user) return null;

  return (
    <Link
      href="/notifications"
      aria-label="Benachrichtigungen"
      className={`relative flex items-center justify-center ${className || ''}`}
    >
      <svg
        className="w-5 h-5 text-slate-400 hover:text-slate-600 transition-colors"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
