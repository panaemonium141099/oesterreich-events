import type { Metadata } from 'next';
import Script from 'next/script';
// fn-15.5 (Bundle-Architektur):
//   - AuthProvider moved out of root → now per-route in authenticated
//     layouts (feed, profile, saved, friends, messages, admin, groups/[id])
//     via the shared <AppShell> wrapper. Anonymous routes (landing, blog,
//     gemeinde …) no longer pull @supabase/supabase-js into their bundle.
//   - NotificationsProvider, NotificationToast and SocialNav follow the
//     same pattern — they are authenticated-only social-app chrome.
//   - SavedEventsProvider moves into <AppShell> alongside AuthProvider
//     since it depends on useAuth(). Saved-events UI on anonymous routes
//     (landing carousel, blog) reads the no-op fallback context, which
//     short-circuits to a noop on save-attempt (current behavior was
//     "do nothing if !user" anyway).
//   - AnimatedLayout removed entirely. Page transitions migrate to the
//     CSS View Transition API with a Firefox-instant-cut fallback,
//     orchestrated globally in this layout.
//   - <Toaster /> stays in root: sonner is ~5 KB, has no auth dependency,
//     and the AfterSavePanel / share-sheet show toasts on landing too.
// AdSense was removed in fn-15.4; CookieBanner is also unused.
import { Toaster } from 'sonner';
import { fraunces, geist, caveat } from '@/lib/fonts';
import './globals.css';

// GA4 deferred until a real consent banner exists (Codex fn-15.4 round 3).
// `NEXT_PUBLIC_GA_MEASUREMENT_ID` is still defined in .env.example so the
// future consent-gated wrapper can pick it up, but no Script tag mounts
// here. See the comment block below the JSON-LD scripts for context.

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
        {/*
          GA4 deferred (Codex CLS-review fn-15.4 round 3):
          The datenschutz page says GA4 is loaded "ausschließlich nach
          ausdrücklicher Einwilligung". Even GA4 Consent Mode v2 with
          default-denied still loads gtag.js and pings GA-server with
          cookieless data — that's "advanced consent mode" and contradicts
          the legal copy. Until a real consent banner exists that gates
          the Script tags themselves, GA4 stays OFF.

          Vercel Analytics (cookieless by design, no consent required)
          continues to provide pageview metrics in the meantime.

          When a consent UI lands: add the Script tags inside a
          ConsentGate component that mounts only after user opt-in. Track
          re-enabling GA4 as a follow-up task.
        */}
      </head>
      <body className="antialiased">
        {/*
          fn-15.5: page-transition wrapper now uses the CSS
          `view-transition-name` API instead of motion-lib's
          AnimatePresence. Browsers that don't implement the spec
          (Firefox as of 2026-05) skip the transition entirely and
          jump-cut between routes — that's the documented graceful
          fallback. No JS feature-detect or polyfill needed; the
          `view-transition-name` style is simply ignored.
        */}
        <main className="route-root" style={{ viewTransitionName: 'route-root' }}>
          {children}
        </main>
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
        {/* <CookieBanner /> — see import comment above */}
      </body>
    </html>
  );
}
