'use client';

/**
 * AppShell — authenticated-route provider wrapper.
 *
 * fn-15.5 (Bundle-Architektur): the root layout no longer mounts
 * AuthProvider / NotificationsProvider / NotificationToast — those are
 * authenticated-only concerns and would pull @supabase/supabase-js +
 * the notifications realtime channel into the landing-page bundle for
 * no reason. Public routes (landing, blog, gemeinde, datenschutz, etc.)
 * ship without them.
 *
 * v4-Phase-1: SocialNav (bottom-tab-bar) wurde aus diesem Shell raus-
 * gezogen — die globale V4TabBar im Root-Layout ersetzt sie. Die
 * `hideSocialNav`-Prop bleibt als No-Op erhalten damit bestehende
 * Aufrufer (`/map/layout.tsx` etc.) nicht angefasst werden müssen
 * (minimal-scope-Regel). Cleanup der Prop in einer späteren Aufräum-
 * Phase.
 *
 * Authenticated route layouts wrap their children in this component to
 * opt in to: auth context, saved-events cache, notifications realtime
 * channel, and toast stack.
 *
 * Order matters:
 *   AuthProvider  → owns user/profile/session
 *   NotificationsProvider → reads `useAuth()` for the user id
 *   SavedEventsProvider   → reads `useAuth()` for the user id
 *   {children}            → consume any of the above
 *   NotificationToast     → realtime toast (uses auth + notifications)
 */

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/supabase/auth-context';
import { NotificationsProvider } from '@/components/Notifications/NotificationsProvider';
import { NotificationToast } from '@/components/Notifications/NotificationToast';
import { SavedEventsProvider } from '@/lib/saved-events-context';

interface AppShellProps {
  children: ReactNode;
  /**
   * @deprecated v4-Phase-1: SocialNav wird nicht mehr von AppShell
   * gemountet (globale V4TabBar im Root-Layout). Prop ist No-Op und
   * wird in einer späteren Aufräum-Phase entfernt.
   */
  hideSocialNav?: boolean;
}

export function AppShell({ children, hideSocialNav: _hideSocialNav = false }: AppShellProps) {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <SavedEventsProvider>
          {children}
          <NotificationToast />
        </SavedEventsProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}
