'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';

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

export function NotificationToast() {
  const { user } = useAuth();
  const supabase = createClient();
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleClick = useCallback((toast: ToastNotification) => {
    dismissToast(toast.id);
    router.push(toast.action_url || '/notifications');
  }, [dismissToast, router]);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => dismissToast(t.id), 5000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notification-toast')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        async (payload: { new: Record<string, unknown> }) => {
          const n = payload.new as unknown as ToastNotification;
          let fromInitial = '?';
          let fromAvatar: string | null = null;

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

          setToasts((prev) => {
            const next = [{ ...n, fromInitial, fromAvatar }, ...prev];
            // Max 3 visible
            return next.slice(0, 3);
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase]);

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
            className="bg-[#1a1a1c] border border-white/[0.08] rounded-xl shadow-2xl px-4 py-3 max-w-sm flex items-start gap-3 text-left cursor-pointer hover:bg-white/[0.04] transition-colors"
          >
            {/* From user avatar/initial */}
            <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-xs font-semibold text-white/60 shrink-0 overflow-hidden">
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
              <p className="text-sm font-medium text-white truncate">{toast.title}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{timeAgo(toast.created_at)}</p>
            </div>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
