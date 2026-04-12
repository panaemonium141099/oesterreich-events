import type { Metadata } from 'next';
import Script from 'next/script';
import { AuthProvider } from '@/lib/supabase/auth-context';
import { CookieBanner } from '@/components/Legal/CookieBanner';
import { AnimatedLayout } from '@/components/UI/AnimatedLayout';
import { NotificationToast } from '@/components/Notifications/NotificationToast';
import { Toaster } from 'sonner';
import './globals.css';

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

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
      <head>
        {ADSENSE_CLIENT_ID && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="antialiased">
        <AuthProvider>
          <AnimatedLayout>
            {children}
          </AnimatedLayout>
          <Toaster
            theme="dark"
            position="bottom-center"
            toastOptions={{
              style: {
                background: '#141416',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                color: '#f1f5f9',
              },
            }}
          />
          <NotificationToast />
          <CookieBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
