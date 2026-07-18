import { AppShell } from '@/components/Layout/AppShell';

/**
 * /spotify-matches — Spotify-imported artist matches list (auth-gated
 * server-side). fn-15.5 (Bundle-Architektur).
 */
export default function SpotifyMatchesLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
