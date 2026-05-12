import { AppShell } from '@/components/Layout/AppShell';

/**
 * /feed — authenticated social activity stream. Mounts AppShell so
 * children get AuthProvider + NotificationsProvider + SavedEventsProvider
 * + bottom-nav + toast stack. fn-15.5 (Bundle-Architektur) moved these
 * out of root-layout so anonymous routes don't pay the supabase-client +
 * realtime-channel cost.
 */
export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
