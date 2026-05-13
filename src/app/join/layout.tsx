import { ModalShell } from '@/components/Layout/ModalShell';
import { fraunces, caveat } from '@/lib/fonts-planer';

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
 *
 * fn-15.8: /join renders the same `.planer-scope` editorial chrome
 * as /groups (Fraunces hero, etc.) — so it needs the same Planer
 * font CSS vars mounted on the route subtree. Caveat is included
 * for visual consistency in case a future invite-preview component
 * picks it up.
 */
export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} ${caveat.variable}`}>
      <ModalShell>{children}</ModalShell>
    </div>
  );
}
