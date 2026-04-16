'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';

interface SavedEventsContextValue {
  savedIds: Set<string>;
  isSaved: (eventId: string) => boolean;
  refresh: () => Promise<void>;
  toggleSaved: (eventId: string) => Promise<'saved' | 'removed' | 'noop'>;
  /** Marks an id as saved in the local set without a round-trip — useful when
   *  another component (EventDetail) already persisted the change and just
   *  needs the UI to sync. */
  markSaved: (eventId: string, saved: boolean) => void;
}

const NOOP_CONTEXT: SavedEventsContextValue = {
  savedIds: new Set(),
  isSaved: () => false,
  refresh: async () => {},
  toggleSaved: async () => 'noop',
  markSaved: () => {},
};

const SavedEventsContext = createContext<SavedEventsContextValue>(NOOP_CONTEXT);

export function SavedEventsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const userIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setSavedIds(new Set());
      userIdRef.current = null;
      return;
    }
    const { data, error } = await supabase
      .from('saved_events')
      .select('event_id')
      .eq('user_id', user.id);
    if (error) return;
    const next = new Set<string>(
      (data ?? []).map((r: { event_id: string }) => r.event_id)
    );
    setSavedIds(next);
    userIdRef.current = user.id;
  }, [user, supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isSaved = useCallback((eventId: string) => savedIds.has(eventId), [savedIds]);

  const markSaved = useCallback((eventId: string, saved: boolean) => {
    setSavedIds(prev => {
      if (saved && prev.has(eventId)) return prev;
      if (!saved && !prev.has(eventId)) return prev;
      const next = new Set(prev);
      if (saved) next.add(eventId);
      else next.delete(eventId);
      return next;
    });
  }, []);

  const toggleSaved = useCallback(
    async (eventId: string): Promise<'saved' | 'removed' | 'noop'> => {
      if (!user) return 'noop';
      const currentlySaved = savedIds.has(eventId);
      // Optimistic update
      markSaved(eventId, !currentlySaved);
      try {
        if (currentlySaved) {
          const { error } = await supabase
            .from('saved_events')
            .delete()
            .eq('user_id', user.id)
            .eq('event_id', eventId);
          if (error) throw error;
          return 'removed';
        }
        const { error } = await supabase
          .from('saved_events')
          .insert({ user_id: user.id, event_id: eventId });
        if (error) throw error;
        return 'saved';
      } catch {
        // Rollback optimistic update
        markSaved(eventId, currentlySaved);
        return 'noop';
      }
    },
    [user, supabase, savedIds, markSaved],
  );

  const value = useMemo<SavedEventsContextValue>(
    () => ({ savedIds, isSaved, refresh, toggleSaved, markSaved }),
    [savedIds, isSaved, refresh, toggleSaved, markSaved],
  );

  return <SavedEventsContext.Provider value={value}>{children}</SavedEventsContext.Provider>;
}

export function useSavedEvents(): SavedEventsContextValue {
  return useContext(SavedEventsContext);
}
