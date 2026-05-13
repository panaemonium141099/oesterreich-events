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
 * /map — anonymously browsable map of all events with auth-aware
 * marker actions (save, RSVP from popup) plus a top-bar notification
 * bell.
 *
 * fn-15.5 round-13 (codex): the top-bar bell uses NotificationBell
 * which calls useNotifications() — so /map DOES need
 * NotificationsProvider after all. Reverted to <AppShell hideSocialNav>:
 * full provider stack + bell unread badge work, just no floating
 * bottom-nav (the map's own UI is bottom-heavy already). Mapbox
 * stays on /map (~480 KB chunk) by intent; fn-15.5's bundle goal was
 * to keep Mapbox out of `/`, not out of /map.
 */
export default function MapLayout({ children }: { children: React.ReactNode }) {
  return <AppShell hideSocialNav>{children}</AppShell>;
}
