import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LassTreffen.at — Entdecke was los ist in Österreich',
    short_name: 'LassTreffen',
    description: 'Über 40.000 Veranstaltungen in ganz Österreich auf einer interaktiven Karte.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f6f2',
    theme_color: '#111827',
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
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
