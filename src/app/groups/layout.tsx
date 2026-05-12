import { AppShell } from '@/components/Layout/AppShell';

/**
 * /groups (list) — Planer group list (auth-gated server-side at the
 * page level). Detail route /groups/[id] has its own layout that
 * hides the bottom-nav since the plan detail has its own chrome.
 * fn-15.5 (Bundle-Architektur).
 */
export default function GroupsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
