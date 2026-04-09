'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { FollowCityButton } from '@/components/Follow/FollowCityButton';
import { FollowVenueButton } from '@/components/Follow/FollowVenueButton';
import { ShareSheet } from '@/components/Share/ShareSheet';
import { toast } from 'sonner';

interface AfterSavePanelProps {
  visible: boolean;
  onDismiss: () => void;
  eventId: string;
  eventTitle: string;
  startDate: string;
  city?: string | null;
  bundesland?: string | null;
  venueId?: string | null;
  venueName?: string | null;
}

export function AfterSavePanel({
  visible,
  onDismiss,
  eventId,
  eventTitle,
  startDate,
  city,
  bundesland,
  venueId,
  venueName,
}: AfterSavePanelProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const [reminderSet, setReminderSet] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const handleSetReminder = useCallback(async () => {
    if (!user) return;
    if (reminderLoading || reminderSet) return;
    setReminderLoading(true);

    try {
      // Default reminder: 1 day before the event
      const eventDate = new Date(startDate);
      const reminderDate = new Date(eventDate);
      reminderDate.setDate(reminderDate.getDate() - 1);

      // Don't set reminder in the past
      if (reminderDate <= new Date()) {
        // If event is tomorrow or today, remind in 1 hour
        reminderDate.setTime(Date.now() + 60 * 60 * 1000);
      }

      await supabase.from('event_reminders').insert({
        user_id: user.id,
        event_id: eventId,
        remind_at: reminderDate.toISOString(),
      });

      setReminderSet(true);
      toast.success('Erinnerung gesetzt');
    } catch {
      toast.error('Fehler beim Setzen der Erinnerung');
    } finally {
      setReminderLoading(false);
    }
  }, [user, eventId, startDate, reminderLoading, reminderSet, supabase]);

  return (
    <>
    <ShareSheet
      isOpen={showShareSheet}
      onClose={() => setShowShareSheet(false)}
      shareData={{
        type: 'event',
        id: eventId,
        title: eventTitle,
        url: `/events/${eventId}`,
      }}
    />
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white/80">
                Event gespeichert
              </p>
              <button
                onClick={onDismiss}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Schliessen"
              >
                <svg
                  className="w-4 h-4 text-white/40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Reminder */}
              <button
                onClick={handleSetReminder}
                disabled={reminderLoading || reminderSet}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  reminderSet
                    ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {reminderSet ? 'Erinnert' : 'Erinnern'}
              </button>

              {/* Follow City */}
              {city && bundesland && (
                <FollowCityButton city={city} bundesland={bundesland} />
              )}

              {/* Follow Venue */}
              {venueId && venueName && (
                <FollowVenueButton venueId={venueId} venueName={venueName} />
              )}

              {/* Share */}
              <button
                onClick={() => setShowShareSheet(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80 transition-all duration-200"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                Teilen
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
