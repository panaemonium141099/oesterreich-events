'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileDropdown } from '@/components/Layout/ProfileDropdown';
import { NotificationBell } from '@/components/Notifications/NotificationBell';
import { DesktopPushToggle } from '@/components/Notifications/DesktopPushToggle';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { trackEvent } from '@/lib/analytics';
import { navigateFromNotification } from '@/lib/utils/notification-nav';

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  event_id: string | null;
  group_id: string | null;
  from_user_id: string | null;
  action_url: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
  from_user: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Gerade eben';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} T.`;
  return new Date(dateStr).toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
}

function groupByDate(notifications: NotificationRow[]): { label: string; items: NotificationRow[] }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; items: NotificationRow[] }[] = [];
  const todayItems: NotificationRow[] = [];
  const yesterdayItems: NotificationRow[] = [];
  const olderItems: NotificationRow[] = [];

  for (const n of notifications) {
    const d = new Date(n.created_at);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) {
      todayItems.push(n);
    } else if (d.getTime() === yesterday.getTime()) {
      yesterdayItems.push(n);
    } else {
      olderItems.push(n);
    }
  }

  if (todayItems.length > 0) groups.push({ label: 'Heute', items: todayItems });
  if (yesterdayItems.length > 0) groups.push({ label: 'Gestern', items: yesterdayItems });
  if (olderItems.length > 0) groups.push({ label: 'Altere', items: olderItems });

  return groups;
}

export function NotificationsPageClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  useEffect(() => { trackEvent('page_view', { path: '/notifications' }); }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    const { data } = await supabase
      .from('notifications')
      .select('*, from_user:profiles!notifications_from_user_id_fkey(first_name, last_name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setNotifications((data as NotificationRow[]) || []);
    setLoadingData(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime: refresh on INSERT
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { fetchNotifications(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, supabase, fetchNotifications]);

  const markAllRead = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    await supabase
      .from('notifications')
      .update({ read: true, read_at: now })
      .eq('user_id', user.id)
      .eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true, read_at: now })));
  };

  const markOneRead = async (notification: NotificationRow) => {
    if (!notification.read) {
      const now = new Date().toISOString();
      await supabase
        .from('notifications')
        .update({ read: true, read_at: now })
        .eq('id', notification.id);
      setNotifications((prev) =>
        prev.map((n) => n.id === notification.id ? { ...n, read: true, read_at: now } : n)
      );
    }
    if (notification.action_url) {
      // Use the legacy-aware navigator — UUID-form event URLs need a
      // hard nav so the server-side 308 lands cleanly. See
      // src/lib/utils/notification-nav.ts for the rationale.
      navigateFromNotification(notification.action_url, router);
    }
  };

  if (loading || !user) {
    return (
      <div className="bg-surface-elevated min-h-screen text-white">
        <header className="sticky top-0 z-30 bg-surface-elevated/80 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="h-5 w-40 rounded bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
            <div className="h-9 w-9 rounded-lg bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl animate-pulse motion-reduce:animate-none" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="w-10 h-10 rounded-full bg-white/[0.06] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/[0.06] rounded w-3/4" />
                <div className="h-3 bg-white/[0.04] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasUnread = notifications.some((n) => !n.read);
  const groups = groupByDate(notifications);

  return (
    <div className="bg-surface-elevated min-h-screen text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface-elevated/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">Benachrichtigungen</h1>
          <div className="flex items-center gap-3">
            <NotificationBell className="w-9 h-9 rounded-lg hover:bg-white/[0.06]" />
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4">
        {/* Desktop-push toggle — lives above the list so users discover it */}
        <div className="mb-5">
          <DesktopPushToggle />
        </div>

        {/* Mark all read button */}
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="mb-4 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Alle als gelesen markieren
          </button>
        )}

        {/* Loading state */}
        {loadingData && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-start gap-3 p-3 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/[0.06] rounded w-3/4" />
                  <div className="h-3 bg-white/[0.06] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loadingData && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-12 h-12 text-white/20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="text-white/40 text-sm">Keine Benachrichtigungen</p>
          </div>
        )}

        {/* Notification groups */}
        {!loadingData && groups.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2 px-1">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markOneRead(n)}
                  className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-colors ${
                    n.read
                      ? 'hover:bg-white/[0.03]'
                      : 'bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  {/* Unread indicator */}
                  <div className="flex items-center pt-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-blue-500'}`} />
                  </div>
                  {/* From user avatar */}
                  <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center text-sm font-semibold text-white/60 shrink-0 overflow-hidden">
                    {n.from_user?.avatar_url ? (
                      <img
                        src={n.from_user.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span>
                        {n.from_user?.first_name?.[0]?.toUpperCase() || '?'}
                      </span>
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${n.read ? 'text-white/70' : 'text-white font-semibold'} truncate`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-white/40 truncate mt-0.5">{n.body}</p>
                    )}
                    <p className="text-[11px] text-white/30 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </main>
</div>
  );
}
