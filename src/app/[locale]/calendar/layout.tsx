import { AppShell } from '@/components/Layout/AppShell';

/**
 * /calendar — personal event calendar (auth-gated server-side).
 * fn-15.5 (Bundle-Architektur).
 */
export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
