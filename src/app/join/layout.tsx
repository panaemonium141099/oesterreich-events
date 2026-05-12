import { ModalShell } from '@/components/Layout/ModalShell';

/**
 * /join/[code] — invite-redemption flow.
 *
 * fn-15.5 round-10 (codex): the page only consumes useAuth() — to
 * decide whether to bounce to /auth/login or let an already-signed-
 * in user accept the invite. It does NOT use notifications,
 * saved-events, or the social-nav. Previously wrapped in the full
 * <AppShell> (round-2 fix added auth context); that pulled the
 * NotificationsProvider realtime channel + Supabase notifications
 * subscription into a public entry route for no reason.
 *
 * <ModalShell> is the right size: AuthProvider + SavedEventsProvider
 * only. SavedEventsProvider is harmless overhead when unused (its
 * `if (!user)` guard short-circuits the fetch) and reuses the
 * module-singleton store across the rest of the app. No
 * NotificationsProvider, no SocialNav.
 */
export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return <ModalShell>{children}</ModalShell>;
}
