import { AppShell } from '@/components/Layout/AppShell';

/**
 * /groups/[id] — authenticated plan detail (private group / Planer).
 * The spec calls out "only for private groups, public OK ohne", but
 * /groups/[id]/page.tsx already server-gates with requireUserOrRedirect,
 * so every reachable [id] is authenticated. Mounts AppShell.
 *
 * /groups (the list) is intentionally NOT given a layout — it lives
 * one directory up and goes through the public route. fn-15.5
 * (Bundle-Architektur).
 */
export default function GroupDetailLayout({ children }: { children: React.ReactNode }) {
  return <AppShell hideSocialNav>{children}</AppShell>;
}
