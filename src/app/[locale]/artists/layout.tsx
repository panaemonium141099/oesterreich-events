import { AppShell } from '@/components/Layout/AppShell';

/**
 * /artists — followed-artists management (auth-gated server-side).
 * Mounts AppShell so the client tree has AuthProvider et al. — see
 * fn-15.5 (Bundle-Architektur) notes in src/components/Layout/AppShell.
 */
export default function ArtistsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
