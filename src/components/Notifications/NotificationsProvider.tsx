'use client';

/**
 * NotificationsProvider — eine Realtime-Subscription pro User, geteilt
 * zwischen NotificationBell, NotificationToast und NotificationsPageClient.
 *
 * Pre-Refactor: Jede der 3 Komponenten hat einen eigenen
 * `supabase.channel('notification-*')` mit gleichem `user_id=eq.${user.id}`
 * Filter angelegt → 3× WAL-Decode pro Notification-Insert pro eingeloggtem
 * User. In pg_stat_statements waren die Realtime-Queries (`realtime.list_changes`)
 * zusammen 85.8% der gesamten DB-Zeit.
 *
 * Nach diesem Provider:
 *   1 channel pro User, Provider speichert die Notifications-Liste in
 *   React-State, alle 3 Komponenten lesen den State via Context.
 *
 * Toast-spezifische Logic (5s autodismiss, max 3 visible, from-user
 * profile fetch) bleibt in NotificationToast — Provider liefert nur
 * den Datafluss.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';

export interface NotificationRow {
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

export interface NotificationsContextValue {
  notifications: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markOneRead: (notification: NotificationRow) => Promise<void>;
  /**
   * Subscribe to "new notification" events. Returns an unsubscribe fn.
   * Used by NotificationToast to render new-arrival toasts.
   */
  onNewNotification: (cb: (n: NotificationRow) => void) => () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    // Fail-safe: outside provider scope, return a no-op shape so
    // components don't crash. This happens during SSR or if the
    // provider is missing — e.g. before the user logs in.
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      refresh: async () => {},
      markAllRead: async () => {},
      markOneRead: async () => {},
      onNewNotification: () => () => {},
    };
  }
  return ctx;
}

interface ProviderProps {
  children: ReactNode;
}

export function NotificationsProvider({ children }: ProviderProps) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  // Subscriber set für onNewNotification (Toast nutzt das)
  const subscribersRef = useRef<Set<(n: NotificationRow) => void>>(new Set());

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*, from_user:profiles!notifications_from_user_id_fkey(first_name, last_name, avatar_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications((data as NotificationRow[]) ?? []);
    } catch {
      // Network blip — leave existing state, will retry on next event
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    await supabase
      .from('notifications')
      .update({ read: true, read_at: now })
      .eq('user_id', user.id)
      .eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true, read_at: now })));
  }, [user, supabase]);

  const markOneRead = useCallback(async (notification: NotificationRow) => {
    if (notification.read) return;
    const now = new Date().toISOString();
    await supabase
      .from('notifications')
      .update({ read: true, read_at: now })
      .eq('id', notification.id);
    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? { ...n, read: true, read_at: now } : n),
    );
  }, [supabase]);

  const onNewNotification = useCallback((cb: (n: NotificationRow) => void) => {
    subscribersRef.current.add(cb);
    return () => { subscribersRef.current.delete(cb); };
  }, []);

  // Initial fetch + 30s polling fallback (in case the channel disconnects)
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [user, refresh]);

  // EINE Realtime-Subscription pro User — geteilt durch alle Konsumenten
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          // Refetch the full list (so the new row gets the from_user join
          // resolved). Then notify subscribers (Toast) about the new row.
          refresh().then(() => {
            const newRow = payload.new as unknown as NotificationRow;
            for (const cb of subscribersRef.current) {
              try { cb(newRow); } catch { /* swallow */ }
            }
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => { refresh(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase, refresh]);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications],
  );

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      loading,
      refresh,
      markAllRead,
      markOneRead,
      onNewNotification,
    }),
    [notifications, unreadCount, loading, refresh, markAllRead, markOneRead, onNewNotification],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}
