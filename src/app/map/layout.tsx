import type { Metadata } from 'next';
import { AppShell } from '@/components/Layout/AppShell';

export const metadata: Metadata = {
  title: 'Event-Karte Österreich — Alle Veranstaltungen auf einer Karte',
  description:
    'Interaktive Karte mit über 40.000 Events in Österreich. Finde Konzerte, Festivals, Märkte, Sport und Kultur in deiner Nähe — filterbar nach Kategorie, Region und Datum.',
  alternates: {
    canonical: 'https://lasstreffen.at/map',
    languages: {
      'de-AT': 'https://lasstreffen.at/map',
      'x-default': 'https://lasstreffen.at/map',
    },
  },
  openGraph: {
    title: 'Event-Karte Österreich — Alle Veranstaltungen auf einer Karte',
    description:
      'Interaktive Karte mit über 40.000 Events in Österreich. Konzerte, Festivals, Märkte und mehr.',
    type: 'website',
    url: 'https://lasstreffen.at/map',
  },
};

/**
 * /map is the legacy map page; like /entdecken it has auth-aware UI
 * (save-events, profile-pill) even though anonymous browsing is
 * supported. Wraps in AppShell so logged-in users get the same
 * AuthProvider + SavedEvents + bottom-nav experience as elsewhere.
 * The bundle hit lives here (Mapbox + AuthProvider) not on `/`. The
 * landing's "Karte zeigen" button now points at /entdecken instead
 * of /map to keep Mapbox out of the landing prefetch chain.
 * fn-15.5 (Bundle-Architektur).
 */
export default function MapLayout({ children }: { children: React.ReactNode }) {
  return <AppShell hideSocialNav>{children}</AppShell>;
}
