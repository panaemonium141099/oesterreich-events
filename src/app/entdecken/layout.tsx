import type { Metadata } from 'next';
// fn-15.6: /entdecken uses the same MapV3 FilterDrawer as /map. That drawer's
// chip-group grid layout (`.mv3-chip-group`) lives in map-scope.css. Without
// importing it here, the chips fell back to `display: block` and stacked
// vertically — golden sample is /map where chips render as a 4-col grid.
import '../map-scope.css';

export const metadata: Metadata = {
  title: 'Events entdecken — Konzerte, Festivals & mehr in Österreich',
  description:
    'Durchsuche tausende Veranstaltungen in ganz Österreich. Filter nach Datum, Region, Kategorie und Vibe — finde dein nächstes Event.',
  alternates: {
    canonical: 'https://lasstreffen.at/entdecken',
    languages: {
      'de-AT': 'https://lasstreffen.at/entdecken',
      'x-default': 'https://lasstreffen.at/entdecken',
    },
  },
  openGraph: {
    title: 'Events entdecken in Österreich',
    description:
      'Konzerte, Festivals, Märkte und mehr. Filterbar nach Region und Kategorie.',
    type: 'website',
    url: 'https://lasstreffen.at/entdecken',
  },
};

export default function EntdeckenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
