import type { Metadata } from 'next';
import Script from 'next/script';
import { AuthProvider } from '@/lib/supabase/auth-context';
// AdSense removed in fn-15.4 (Third-Party Cleanup): the property is not
// approved for AdSense and Funding-Choices banner is no longer needed.
// The legacy custom CookieBanner at src/components/Legal/CookieBanner.tsx
// is also unused. Re-introducing either would require a fresh consent /
// CMP review.
import { AnimatedLayout } from '@/components/UI/AnimatedLayout';
import { NotificationToast } from '@/components/Notifications/NotificationToast';
import { NotificationsProvider } from '@/components/Notifications/NotificationsProvider';
import { SocialNav } from '@/components/Layout/SocialNav';
import { SavedEventsProvider } from '@/lib/saved-events-context';
import { Toaster } from 'sonner';
import { fraunces, geist, caveat } from '@/lib/fonts';
import './globals.css';

// GA4 Measurement-ID. Env-gated: when unset (dev / preview without env)
// no Google-Analytics scripts are emitted. fn-15.4 introduced the lazy
// next/script loading pattern; fn-15.6 will pin the inline `gtag('config')`
// init block under a hash-based CSP (no 'unsafe-inline'). The Script tag's
// `strategy="afterInteractive"` defers gtag.js loading until the page is
// interactive so it never blocks LCP/FCP.
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

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

/**
 * Root layout with parallel `@modal` slot for intercepting routes.
 *
 * The `modal` prop is bound by Next.js to whatever the `@modal/...`
 * folder resolves to for the current URL:
 *   - default URL (e.g. /map, /feed, /)            → app/@modal/default.tsx → null
 *   - /events/... reached via soft-nav from a sibling route
 *                                                  → app/@modal/(.)events/[...slug]/page.tsx → EventSheet
 *   - /events/... reached directly (refresh, hard nav, share)
 *                                                  → app/@modal/default.tsx → null,
 *                                                    children renders the full event page
 *
 * Effect: clicking "Details öffnen" on the map bubble opens the event
 * detail as a sheet *over* the map (map stays mounted — back button
 * just dismisses the sheet, all 13k events still loaded). Direct URL
 * access still serves the canonical full page.
 *
 * Constraint: SavedEventsProvider lifted to root so children + modal
 * share the same saved-events state. Saving from inside the sheet
 * updates the marker's saved-class on the underlying map immediately.
 */
export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="de" className={`${fraunces.variable} ${geist.variable} ${caveat.variable}`}>
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
        {GA_MEASUREMENT_ID && (
          <>
            {/*
              GA4 + Consent Mode v2 (Codex CLS-review fn-15.4 round 2):
              gtag.js is loaded via next/script "afterInteractive" so it
              never blocks first paint. Consent is defaulted to DENIED so
              no analytics/ads storage gets used until the user provides
              explicit opt-in via a future consent UI (or explicit
              gtag('consent', 'update', {...}) call). Datenschutz page
              describes this exactly.

              The init block stays inline so fn-15.6 can hash it under a
              hash-based CSP (no 'unsafe-inline' once that lands).
            */}
            <Script
              id="ga4-loader"
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script
              id="ga4-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  'ad_storage': 'denied',
  'ad_user_data': 'denied',
  'ad_personalization': 'denied',
  'analytics_storage': 'denied',
  'functionality_storage': 'denied',
  'personalization_storage': 'denied',
  'security_storage': 'granted'
});
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}', { 'anonymize_ip': true });`,
              }}
            />
          </>
        )}
      </head>
      <body className="antialiased">
        <AuthProvider>
          <NotificationsProvider>
            <SavedEventsProvider>
              <AnimatedLayout>
                {children}
              </AnimatedLayout>
              {modal}
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
            </SavedEventsProvider>
          </NotificationsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
