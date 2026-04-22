import type { Metadata } from 'next';
import Script from 'next/script';
import { AuthProvider } from '@/lib/supabase/auth-context';
// Custom CookieBanner removed — Google AdSense Privacy & messaging (Funding
// Choices) is active on this property and delivers a TCF 2.2-certified,
// Consent-Mode-v2-integrated banner automatically via the adsbygoogle.js
// script loaded below. The old custom banner only wrote localStorage and
// did not send Consent-Mode signals to Google, which would have blocked
// EU-traffic monetization. Keeping both would show two banners to EU
// users and create conflicting consent state.
// File kept at src/components/Legal/CookieBanner.tsx for reference/rollback.
import { AnimatedLayout } from '@/components/UI/AnimatedLayout';
import { NotificationToast } from '@/components/Notifications/NotificationToast';
import { SocialNav } from '@/components/Layout/SocialNav';
import { Toaster } from 'sonner';
import { fraunces, geist } from '@/lib/fonts';
import './globals.css';

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

const SITE_DESCRIPTION =
  'Finde Events in Wien, Graz, Linz, Salzburg & ganz Österreich — 40.000+ Konzerte, Festivals, Märkte, Partys auf interaktiver Karte. Mit Freunden planen, Lieblings-Artists folgen. Kostenlos.';

export const metadata: Metadata = {
  metadataBase: new URL('https://lasstreffen.at'),
  title: {
    default: 'LassTreffen.at — Events in Wien, Graz, Salzburg & ganz Österreich',
    template: '%s | LassTreffen.at',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'LassTreffen.at',
  keywords: [
    'Events Österreich',
    'Veranstaltungen Wien',
    'Konzerte Graz',
    'Festivals Salzburg',
    'Nightlife Linz',
    'Christkindlmarkt',
    'Events heute',
    'Events Wochenende',
  ],
  authors: [{ name: 'LassTreffen.at' }],
  creator: 'LassTreffen.at',
  publisher: 'LassTreffen.at',
  openGraph: {
    type: 'website',
    locale: 'de_AT',
    url: 'https://lasstreffen.at',
    siteName: 'LassTreffen.at',
    title: 'LassTreffen.at — Events in Wien, Graz, Salzburg & ganz Österreich',
    description: SITE_DESCRIPTION,
    images: [
      {
        url: 'https://lasstreffen.at/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'LassTreffen.at — Entdecke was los ist in Österreich',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LassTreffen.at — Events in Wien, Graz, Salzburg & ganz Österreich',
    description: SITE_DESCRIPTION,
    images: ['https://lasstreffen.at/opengraph-image'],
  },
  alternates: {
    canonical: 'https://lasstreffen.at',
    languages: {
      'de-AT': 'https://lasstreffen.at',
      'x-default': 'https://lasstreffen.at',
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  category: 'Events',
};

/**
 * Global structured-data: WebSite (with SearchAction for Google Sitelinks
 * Search Box) + Organization (with logo URL so Google can surface it in the
 * Knowledge Panel / SERP thumbnail). Specific pages still emit their own
 * additional schemas (Event, BlogPosting, etc.) on top of these.
 */
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://lasstreffen.at/#website',
  name: 'LassTreffen.at',
  alternateName: 'Lass Treffen',
  url: 'https://lasstreffen.at',
  description: SITE_DESCRIPTION,
  inLanguage: 'de-AT',
  publisher: { '@id': 'https://lasstreffen.at/#organization' },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://lasstreffen.at/map?search={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://lasstreffen.at/#organization',
  name: 'LassTreffen.at',
  alternateName: 'Lass Treffen',
  url: 'https://lasstreffen.at',
  logo: {
    '@type': 'ImageObject',
    url: 'https://lasstreffen.at/apple-icon',
    width: 180,
    height: 180,
  },
  image: 'https://lasstreffen.at/opengraph-image',
  description: SITE_DESCRIPTION,
  areaServed: {
    '@type': 'Country',
    name: 'Österreich',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={`${fraunces.variable} ${geist.variable}`}>
      <head>
        <Script
          id="ld-website"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <Script
          id="ld-organization"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
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
          <SocialNav />
          <NotificationToast />
          {/* <CookieBanner /> — see import comment above */}
        </AuthProvider>
      </body>
    </html>
  );
}
