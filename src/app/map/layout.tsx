import type { Metadata } from 'next';

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

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
