import type { Metadata } from 'next';
import { ModalShell } from '@/components/Layout/ModalShell';

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
 * marker actions (save, RSVP from popup).
 *
 * fn-15.5 round-10 (codex): previously wrapped in <AppShell hideSocialNav>,
 * which mounted NotificationsProvider (full Supabase realtime channel
 * subscription) on a public route that doesn't render any
 * notifications UI. The map's authenticated affordances need only
 * AuthProvider (profile pill, save buttons read user state) and
 * SavedEventsProvider (the saved-event ring on markers + popup save
 * button). <ModalShell> mounts exactly those two; no Notifications,
 * no SocialNav. Mapbox stays on /map (~480 KB chunk) by intent;
 * fn-15.5's bundle goal was to keep Mapbox out of /, not out of /map.
 */
export default function MapLayout({ children }: { children: React.ReactNode }) {
  return <ModalShell>{children}</ModalShell>;
}
