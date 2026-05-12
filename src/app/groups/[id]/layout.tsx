/**
 * /groups/[id] — authenticated plan detail.
 *
 * fn-15.5 fix (round 2 — codex review): the parent `/groups/layout.tsx`
 * already mounts <AppShell>, and the App Router composes layouts top-
 * down, so wrapping again here would create a double provider tree
 * (two AuthContext/Notifications/SavedEvents listeners + two
 * NotificationToast portals fighting for the same realtime channel).
 *
 * The detail page does want the bottom social-nav hidden — its
 * planer-style chrome has its own bottom CTA — so we set
 * `body.has-modal-open` via CSS via the planer-scope (see globals.css
 * line `body.has-modal-open [data-social-nav] { display: none }`)?
 *
 * Simpler approach used here: hide the bottom-nav via CSS only on this
 * route. The parent layout's <SocialNav> stays mounted (so chat/feed
 * counters keep ticking) but is hidden via the route-scoped class.
 */
export default function GroupDetailLayout({ children }: { children: React.ReactNode }) {
  return <div className="hide-social-nav">{children}</div>;
}
