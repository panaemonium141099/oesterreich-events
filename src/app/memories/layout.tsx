import { AppShell } from '@/components/Layout/AppShell';

/**
 * /memories — user-curated event memories (auth-gated server-side).
 * fn-15.5 (Bundle-Architektur).
 */
export default function MemoriesLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
