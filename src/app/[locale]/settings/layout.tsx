import { AppShell } from '@/components/Layout/AppShell';

/**
 * /settings — user settings (auth-gated server-side at each leaf).
 * fn-15.5 (Bundle-Architektur).
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
