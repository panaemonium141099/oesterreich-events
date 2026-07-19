import { AppShell } from '@/components/Layout/AppShell';

/**
 * /notifications — in-app notification center (auth-gated server-side).
 * fn-15.5 (Bundle-Architektur).
 */
export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
