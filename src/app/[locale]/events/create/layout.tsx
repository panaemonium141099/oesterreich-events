import { AppShell } from '@/components/Layout/AppShell';

/**
 * /events/create — user-submitted event form (auth-gated server-side).
 * Sibling /events/[...slug] is a public SEO route and intentionally
 * stays without AppShell — anonymous visitors can browse event
 * details. fn-15.5 (Bundle-Architektur).
 */
export default function EventsCreateLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
