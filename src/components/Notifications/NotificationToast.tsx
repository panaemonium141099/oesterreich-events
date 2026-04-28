'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { navigateFromNotification } from '@/lib/utils/notification-nav';
import { useNotifications } from '@/components/Notifications/NotificationsProvider';

interface ToastNotification {
  id: string;
  title: string;
  body: string | null;
  action_url: string | null;
  from_user_id: string | null;
  created_at: string;
  fromInitial?: string;
  fromAvatar?: string | null;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Gerade eben';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return `vor ${Math.floor(hours / 24)} T.`;
}

/**
 * Pre-Refactor: eigener `supabase.channel('notification-toast')` mit
 * INSERT-Listener — fetchte das from_user-Profil pro Toast separat. Jetzt:
 * NotificationsProvider hält die shared Subscription, gibt uns via
 * `onNewNotification` Callback Bescheid. Das from_user-Profil ist im
 * Provider-Fetch schon mit drin (notifications joined mit profiles).
 */
export function NotificationToast() {
  const { user } = useAuth();
  const supabase = createClient();
  const router = useRouter();
  const { onNewNotification } = useNotifications();
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleClick = useCallback((toast: ToastNotification) => {
    dismissToast(toast.id);
    navigateFromNotification(toast.action_url || '/notifications', router);
  }, [dismissToast, router]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => dismissToast(t.id), 5000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  // Subscribe to new-notification events from the shared Provider channel.
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onNewNotification(async (n) => {
      let fromInitial = '?';
      let fromAvatar: string | null = null;

      // Provider's INSERT-Payload kommt direkt vom Realtime-Event (kein
      // join), also nochmal das Profil holen. Nur 1 Query pro neuer
      // Notification, nicht pro Subscriber.
      if (n.from_user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, avatar_url')
          .eq('id', n.from_user_id)
          .single();
        if (profile) {
          fromInitial = profile.first_name?.[0]?.toUpperCase() || '?';
          fromAvatar = profile.avatar_url;
        }
      }

      const toast: ToastNotification = {
        id: n.id,
        title: n.title,
        body: n.body,
        action_url: n.action_url,
        from_user_id: n.from_user_id,
        created_at: n.created_at,
        fromInitial,
        fromAvatar,
      };
      setToasts((prev) => [toast, ...prev].slice(0, 3));  // max 3 visible
    });

    return unsubscribe;
  }, [user, supabase, onNewNotification]);

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={() => handleClick(toast)}
            className="bg-[#1c1c1e] border border-white/[0.10] rounded-xl shadow-2xl px-4 py-3 max-w-sm flex items-start gap-3 text-left cursor-pointer hover:bg-white/[0.04] transition-colors"
          >
            {/* From user avatar/initial */}
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white/50 shrink-0 overflow-hidden">
              {toast.fromAvatar ? (
                <img
                  src={toast.fromAvatar}
                  alt=""
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{toast.fromInitial}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/90 truncate">{toast.title}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{timeAgo(toast.created_at)}</p>
            </div>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
