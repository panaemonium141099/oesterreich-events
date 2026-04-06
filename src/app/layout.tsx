import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/supabase/auth-context';
import { CookieBanner } from '@/components/Legal/CookieBanner';
import { AnimatedLayout } from '@/components/UI/AnimatedLayout';
import { NotificationToast } from '@/components/Notifications/NotificationToast';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://lasstreffen.at'),
  title: {
    default: 'LassTreffen.at — Entdecke was los ist in Österreich',
    template: '%s | LassTreffen.at',
  },
  description: 'Über 40.000 Veranstaltungen in ganz Österreich auf einer interaktiven Karte. Konzerte, Raves, Märkte, Kultur, Sport und mehr.',
  openGraph: {
    type: 'website',
    locale: 'de_AT',
    url: 'https://lasstreffen.at',
    siteName: 'LassTreffen.at',
    title: 'LassTreffen.at — Entdecke was los ist in Österreich',
    description: 'Über 40.000 Veranstaltungen in ganz Österreich auf einer interaktiven Karte. Konzerte, Raves, Märkte, Kultur, Sport und mehr.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LassTreffen.at — Entdecke was los ist in Österreich',
    description: 'Über 40.000 Veranstaltungen in ganz Österreich auf einer interaktiven Karte. Konzerte, Raves, Märkte, Kultur, Sport und mehr.',
  },
  alternates: {
    languages: {
      'de-AT': 'https://lasstreffen.at',
      'x-default': 'https://lasstreffen.at',
    },
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="antialiased">
        <AuthProvider>
          <AnimatedLayout>
            {children}
          </AnimatedLayout>
          <NotificationToast />
          <CookieBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
