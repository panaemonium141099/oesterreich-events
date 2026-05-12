'use client';

/**
 * ModalShell — fn-15.5 (round-2 codex fix):
 *
 * The root layout's `@modal` parallel slot lives at the top of the
 * React tree as a sibling of `children`. Next.js does NOT pipe the
 * active authenticated layout's providers (AppShell with
 * AuthProvider/SavedEventsProvider/NotificationsProvider) into the
 * modal slot — that's the whole point of parallel slots being
 * independent.
 *
 * Without a separate wrapper, opening an intercepted event sheet from
 * /feed (or any other authenticated route) would render the modal's
 * EventDetailV2 subtree with the anon `useAuth()` fallback: no user,
 * no profile, no saved-events set. That breaks Save, RSVP, share-to-
 * friend and every other auth-aware action inside the sheet.
 *
 * ModalShell mounts JUST the providers the modal actually needs:
 *   AuthProvider     — useAuth() inside EventDetailV2 et al.
 *   SavedEventsProvider — Save button + saved-state ring
 * It deliberately does NOT mount NotificationsProvider or SocialNav.
 * The modal doesn't need realtime notifications (the parent route's
 * AppShell already has a NotificationsProvider running), and the
 * bottom-nav would clash with the modal's own chrome.
 *
 * Anonymous routes (landing, blog, gemeinde, etc.) never reach an
 * intercepting `(.)events/[...slug]` route — direct nav to /events/...
 * resolves through `app/events/[...slug]/page.tsx` (the full SEO
 * page), not the modal slot. So ModalShell never mounts on those
 * routes, preserving fn-15.5's bundle goal of no Supabase client in
 * the landing chunk.
 */

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/supabase/auth-context';
import { SavedEventsProvider } from '@/lib/saved-events-context';

interface ModalShellProps {
  children: ReactNode;
}

export function ModalShell({ children }: ModalShellProps) {
  return (
    <AuthProvider>
      <SavedEventsProvider>
        {children}
      </SavedEventsProvider>
    </AuthProvider>
  );
}
