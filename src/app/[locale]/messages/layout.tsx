import { AppShell } from '@/components/Layout/AppShell';

/**
 * /messages — authenticated DM list + thread view. Mounts AppShell so
 * children get AuthProvider + NotificationsProvider + SavedEventsProvider
 * + bottom-nav + toast stack. fn-15.5 (Bundle-Architektur).
 */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
