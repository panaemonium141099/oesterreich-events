'use client';

/**
 * AppShell — authenticated-route provider wrapper.
 *
 * fn-15.5 (Bundle-Architektur): the root layout no longer mounts
 * AuthProvider / NotificationsProvider / SocialNav / NotificationToast
 * — those are authenticated-only concerns and would pull
 * @supabase/supabase-js + the notifications realtime channel into the
 * landing-page bundle for no reason. Public routes (landing, blog,
 * gemeinde, datenschutz, etc.) ship without them.
 *
 * Authenticated route layouts (`src/app/feed/layout.tsx`,
 * `/profile/layout.tsx`, `/saved/layout.tsx`, `/friends/layout.tsx`,
 * `/messages/layout.tsx`, `/admin/layout.tsx`, `/groups/[id]/layout.tsx`)
 * wrap their children in this component to opt in to the full social
 * shell: auth context, saved-events cache, notifications realtime
 * channel, bottom-nav, and toast stack.
 *
 * Order matters:
 *   AuthProvider  → owns user/profile/session
 *   NotificationsProvider → reads `useAuth()` for the user id
 *   SavedEventsProvider   → reads `useAuth()` for the user id
 *   {children}            → consume any of the above
 *   SocialNav             → bottom-nav with unread badges (uses auth)
 *   NotificationToast     → realtime toast (uses auth + notifications)
 */

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/supabase/auth-context';
import { NotificationsProvider } from '@/components/Notifications/NotificationsProvider';
import { NotificationToast } from '@/components/Notifications/NotificationToast';
import { SavedEventsProvider } from '@/lib/saved-events-context';
import { SocialNav } from '@/components/Layout/SocialNav';

interface AppShellProps {
  children: ReactNode;
  /**
   * Hide the bottom social-nav (e.g. on routes that have their own
   * fixed bottom UI like the map). Defaults to false.
   */
  hideSocialNav?: boolean;
}

export function AppShell({ children, hideSocialNav = false }: AppShellProps) {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <SavedEventsProvider>
          {children}
          {!hideSocialNav && <SocialNav />}
          <NotificationToast />
        </SavedEventsProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}
