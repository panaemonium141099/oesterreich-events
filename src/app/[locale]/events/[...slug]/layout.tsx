import { ModalShell } from '@/components/Layout/ModalShell';

/**
 * /events/[...slug] — canonical event detail page (direct nav).
 *
 * fn-15.5 round-9 (codex): EventDetailV2 and its sub-components
 * (EventDetailActions, AfterSavePanel, etc.) call useAuth() and
 * useSavedEvents(). Without a provider in the route tree they hit
 * the anon-fallback and silently no-op Save / RSVP / share-to-friend
 * for logged-in users who reach this URL directly (share-link click,
 * bookmark, refresh on /events/...).
 *
 * The intercepted-modal copy at app/@modal/(.)events/[...slug] is
 * already wrapped in <ModalShell>. Same wrapper is right for the
 * direct route: anonymous browsers can still view the page (server
 * page handles SEO), and logged-in users get the auth-aware actions
 * back without dragging the full social chrome (NotificationsProvider
 * + SocialNav) into a route designed to be search-engine-friendly.
 *
 * <ModalShell> mounts AuthProvider + SavedEventsProvider only. The
 * SavedEvents store is module-singleton (see saved-events-context.tsx
 * header), so this route's saved-state stays in sync with any
 * AppShell-wrapped underlay that opened the modal.
 */
export default function EventDetailLayout({ children }: { children: React.ReactNode }) {
  return <ModalShell>{children}</ModalShell>;
}
