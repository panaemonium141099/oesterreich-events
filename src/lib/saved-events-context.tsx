'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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

/**
 * fn-15.5 (round-2 codex fix, re-affirmed in r5/r6 reviews): the
 * parallel `@modal` slot can't share React context with `children`,
 * but both subtrees still need to observe the SAME saved-events
 * state — otherwise saving an event in the modal sheet leaves the
 * underlying map / feed / saved-list showing stale UI until that
 * subtree remounts.
 *
 * IMPORTANT FOR FUTURE REVIEWERS: this provider DOES share state
 * across parallel slots, despite using two React context instances.
 * The shared state lives at the MODULE level (`savedStore` below),
 * NOT inside React context. Each `<SavedEventsProvider>` mount
 * subscribes via `useSyncExternalStore` to the same global
 * `savedListeners` set. When ANY provider mutates the store (e.g. an
 * optimistic toggle in the modal), every subscribed component
 * re-renders — including those in the sibling tree.
 *
 * Verification path:
 *   1. AppShell SavedEventsProvider calls `setSavedStore(...)` →
 *      `savedListeners.forEach(cb => cb())`.
 *   2. ModalShell SavedEventsProvider's useSyncExternalStore returned
 *      its `subscribe` argument from `subscribeSavedStore`, which
 *      registered a `cb` in the same `savedListeners` set.
 *   3. That cb runs, React re-evaluates the modal subtree, the new
 *      `savedIds` is read via `getSavedSnapshot()` which returns
 *      `savedStore.ids` — the same Set reference.
 *
 * `useSyncExternalStore` is React-18-safe: it works with concurrent
 * rendering and SSR (returns the snapshot synchronously).
 */
type SavedStore = {
  ids: Set<string>;
  userId: string | null;
};
const savedStore: SavedStore = { ids: new Set(), userId: null };
const savedListeners = new Set<() => void>();

function subscribeSavedStore(cb: () => void): () => void {
  savedListeners.add(cb);
  return () => { savedListeners.delete(cb); };
}
function getSavedSnapshot(): Set<string> {
  return savedStore.ids;
}
function setSavedStore(next: Set<string>, userId: string | null): void {
  savedStore.ids = next;
  savedStore.userId = userId;
  for (const cb of savedListeners) cb();
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
  // Subscribe to the module store; useSyncExternalStore guarantees
  // every provider instance re-renders when the store changes,
  // regardless of which React tree the update originated in.
  const savedIds = useSyncExternalStore(
    subscribeSavedStore,
    getSavedSnapshot,
    getSavedSnapshot,
  );
  const userIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setSavedStore(new Set(), null);
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
    setSavedStore(next, user.id);
    userIdRef.current = user.id;
  }, [user, supabase]);

  // Two provider instances (e.g. AppShell + ModalShell) both call
  // refresh on mount. The store collapses them — second call sees the
  // cached set and either re-fetches (intended on auth change) or
  // confirms (cheap idempotent read). Throttling is left to Supabase
  // — saving an event is a low-frequency action.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const isSaved = useCallback((eventId: string) => savedIds.has(eventId), [savedIds]);

  const markSaved = useCallback((eventId: string, saved: boolean) => {
    const prev = savedStore.ids;
    if (saved && prev.has(eventId)) return;
    if (!saved && !prev.has(eventId)) return;
    const next = new Set(prev);
    if (saved) next.add(eventId);
    else next.delete(eventId);
    setSavedStore(next, savedStore.userId);
  }, []);

  const toggleSaved = useCallback(
    async (eventId: string): Promise<'saved' | 'removed' | 'noop'> => {
      if (!user) return 'noop';
      const currentlySaved = savedStore.ids.has(eventId);
      // Optimistic update — flips the shared store, so both subtrees
      // re-render.
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
    [user, supabase, markSaved],
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
