import { AppShell } from '@/components/Layout/AppShell';

/**
 * /saved — authenticated saved-events list. Mounts AppShell so children
 * get AuthProvider + NotificationsProvider + SavedEventsProvider
 * + bottom-nav + toast stack. fn-15.5 (Bundle-Architektur).
 */
export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
