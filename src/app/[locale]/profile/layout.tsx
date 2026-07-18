import { AppShell } from '@/components/Layout/AppShell';

/**
 * /profile — authenticated profile page. Mounts AppShell so children
 * get AuthProvider + NotificationsProvider + SavedEventsProvider
 * + bottom-nav + toast stack. fn-15.5 (Bundle-Architektur).
 */
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
