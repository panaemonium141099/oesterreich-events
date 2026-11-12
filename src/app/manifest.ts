import type { MetadataRoute } from 'next';
import { getSite } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${getSite().brand} — Entdecke was los ist in ${getSite().countryName.de}`,
    short_name: 'LassTreffen',
    description: 'Über 85.000 Veranstaltungen & Ausflugsziele in ganz Österreich auf einer interaktiven Karte.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f6f2',
    theme_color: '#111827',
    icons: [
      {
        src: '/icon',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
