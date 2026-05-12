import { AppShell } from '@/components/Layout/AppShell';

/**
 * /friends (a.k.a. "Freunde" — German term for the same route) — the
 * spec lists `src/app/freunde/layout.tsx` but the actual route folder
 * in this codebase is `friends/`. Same intent: authenticated-only,
 * needs the social shell. fn-15.5 (Bundle-Architektur).
 */
export default function FriendsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
