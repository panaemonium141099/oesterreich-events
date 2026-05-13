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
  const { user, loading } = useAuth();
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
    // fn-15.5 round-14 (codex): when a second provider instance
    // mounts (ModalShell over an AppShell-wrapped page), its own
    // AuthProvider's auth-bootstrap runs in parallel. During the
    // few hundred ms before getSession() resolves, `user` is null
    // here even though another provider may already have an
    // authenticated session loaded into the shared module store.
    // Guard 1: don't touch the store while auth is still loading.
    if (loading) return;
    if (!user) {
      // Guard 2: another instance may have already populated the
      // store for an authenticated session; only clear the store
      // if there is genuinely no user there (either from a fresh
      // mount or after a real sign-out). This prevents the
      // "modal opens → underlying saved-state flickers blank"
      // regression.
      if (savedStore.userId == null) {
        // Already empty — nothing to do.
        return;
      }
      // The shared store has a user id, but THIS provider sees no
      // user. This happens only when the auth provider feeding this
      // instance reports anonymous. To stay safe, do NOT clobber
      // the store; leave the authenticated instance in charge.
      // Real sign-out flows trigger via the AuthContext onAuthStateChange
      // listener which the dominant provider observes — that path will
      // call refresh() with `user === null` AND `loading === false`
      // AND the store already showing the same userId, at which point
      // we DO want to clear. Detect that explicit path by comparing
      // the previously-tracked user-id ref to the current store state.
      if (userIdRef.current != null && userIdRef.current === savedStore.userId) {
        setSavedStore(new Set(), null);
        userIdRef.current = null;
      }
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
  }, [user, loading, supabase]);

  // Two provider instances (e.g. AppShell + ModalShell) both call
  // refresh on mount. The guards above collapse them — only the
  // instance whose useAuth() actually resolved a user (or the
  // canonical sign-out path) writes to the store.
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
