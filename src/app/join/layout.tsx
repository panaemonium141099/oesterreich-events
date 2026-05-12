import { AppShell } from '@/components/Layout/AppShell';

/**
 * /join/[code] — invite-redemption flow. Uses useAuth() to detect
 * already-signed-in users (skips the auth bounce) and to call signIn
 * after the user accepts. Needs the full AppShell so that auth context
 * is populated; without it the page reads the anon-fallback shape and
 * always redirects to /auth/login even for users with a valid session.
 *
 * fn-15.5 round-2 fix (codex review). The page does not need the
 * floating bottom social-nav (PlanerShell has its own chrome), so we
 * pass `hideSocialNav`.
 */
export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return <AppShell hideSocialNav>{children}</AppShell>;
}
