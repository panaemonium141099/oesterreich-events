import { ModalShell } from '@/components/Layout/ModalShell';

/**
 * /groups/[id] — authenticated plan detail.
 *
 * fn-15.5 round-12 (codex): the parent `/groups/layout.tsx` is now a
 * pass-through and `/groups/page.tsx` mounts AppShell only for the
 * list route. The detail route gets its own minimal shell here.
 * GroupDetailPageClient uses useAuth() + useSavedEvents() but does
 * NOT need the social-nav (PlanerShell has its own chrome) or
 * NotificationsProvider (notifications are scoped to other routes;
 * the realtime chat channel inside the plan is opened directly by
 * the page).
 *
 * Inline <style> previously hid the parent AppShell's SocialNav from
 * this route. With AppShell removed from the parent, no nav is
 * rendered on this route at all — the style hack is gone too.
 */
export default function GroupDetailLayout({ children }: { children: React.ReactNode }) {
  return <ModalShell>{children}</ModalShell>;
}
