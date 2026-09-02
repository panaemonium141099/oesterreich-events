import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { routing, type AppLocale } from '@/i18n/routing';
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
import { RouteTransitions } from '@/components/Layout/RouteTransitions';
// fn-15.10 (Service Worker): mount a client-side registrar in the root
// layout so /sw.js is registered once per session on every route. The
// registrar also renders <UpdateBanner /> which surfaces the "Update
// verfügbar" hybrid-banner UX when a new SW is installed and waiting.
// Registration is no-op in dev (NODE_ENV !== 'production') so HMR isn't
// shadowed by stale runtime caches.
import { ServiceWorkerProvider } from '@/components/Layout/ServiceWorkerProvider';
import { PageviewTracker } from '@/components/Analytics/PageviewTracker';
import { ClickTracker } from '@/components/Analytics/ClickTracker';
// fn-15.8: only Geist mounts at the root. The editorial serif and the
// handwriting face moved to `@/lib/fonts-planer` and are imported by
// per-route layouts that actually render the .planer-scope chrome
// (/groups, /groups/[id], /join). The landing now downloads ~28 KB of
// fonts instead of ~266 KB. All three faces are self-hosted from
// /public/fonts/, Latin-1 subset.
import { geist } from '@/lib/fonts';
import './globals.css';
// fn-15.6: inline above-the-fold critical CSS in the layout `<head>`
// so the landing-hero paints before the render-blocking globals.css
// chunk parses. The `<style data-critical-css>` marker is what the
// postbuild verify hook (`scripts/verify-csp-hash.mjs`) looks for to
// confirm the inline bytes match the SHA-256 hash baked into the CSP.
// CRITICAL_CSS is the SINGLE source of truth — never inline a CSS
// string directly into this file; the hash would drift.
import { CRITICAL_CSS } from '@/lib/critical-css';
import { V4TopNav, V4TabBar } from '@/components/Layout/v4';

// GA4 deferred until a real consent banner exists (Codex fn-15.4 round 3).
// `NEXT_PUBLIC_GA_MEASUREMENT_ID` is still defined in .env.example so the
// future consent-gated wrapper can pick it up, but no Script tag mounts
// here. See the comment block below the JSON-LD scripts for context.

// Deutsche Keywords bleiben hardcoded — sie zielen auf den DE-Suchmarkt.
// EN bekommt eigene Keywords; alles andere Textliche kommt aus messages/.
const KEYWORDS: Record<AppLocale, string[]> = {
  de: [
    'Events Österreich',
    'Veranstaltungen Wien',
    'Konzerte Graz',
    'Festivals Salzburg',
    'Nightlife Linz',
    'Christkindlmarkt',
    'Events heute',
    'Events Wochenende',
  ],
  en: [
    'events Austria',
    'events Vienna',
    'concerts Graz',
    'festivals Salzburg',
    'nightlife Linz',
    'Christmas market Vienna',
    'events today',
    'things to do Austria',
  ],
};

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = hasLocale(routing.locales, rawLocale)
    ? rawLocale
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'Meta' });

  const siteTitle = t('title');
  const siteDescription = t('description');
  // fn-17: DE bleibt unpräfixiert (Rankings/QR-Links), EN unter /en.
  const canonical = locale === 'de' ? 'https://lasstreffen.at' : 'https://lasstreffen.at/en';

  return {
    metadataBase: new URL('https://lasstreffen.at'),
    title: {
      default: siteTitle,
      template: '%s | LassTreffen.at',
    },
    description: siteDescription,
    applicationName: 'LassTreffen.at',
    keywords: KEYWORDS[locale],
    authors: [{ name: 'LassTreffen.at' }],
    creator: 'LassTreffen.at',
    publisher: 'LassTreffen.at',
    openGraph: {
      type: 'website',
      locale: locale === 'de' ? 'de_AT' : 'en_US',
      url: canonical,
      siteName: 'LassTreffen.at',
      title: siteTitle,
      description: siteDescription,
      images: [
        {
          url: 'https://lasstreffen.at/opengraph-image',
          width: 1200,
          height: 630,
          alt: t('ogAlt'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: siteTitle,
      description: siteDescription,
      images: ['https://lasstreffen.at/opengraph-image'],
    },
    alternates: {
      canonical,
      languages: {
        'de-AT': 'https://lasstreffen.at',
        en: 'https://lasstreffen.at/en',
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
    verification: {
      // Impact (Affiliate-Netzwerk, u.a. für booking.com Partner-Programm).
      // Verification per Meta-Tag im <head> — Impact crawlt die Homepage.
      other: {
        'impact-site-verification': '9e250221-1b52-4d60-8442-a2e68cfd1fcb',
      },
    },
  };
}

/**
 * Global structured-data: WebSite (with SearchAction for Google Sitelinks
 * Search Box) + Organization (with logo URL so Google can surface it in the
 * Knowledge Panel / SERP thumbnail). Specific pages still emit their own
 * additional schemas (Event, BlogPosting, etc.) on top of these.
 */
function buildWebsiteJsonLd(locale: AppLocale, siteDescription: string) {
  const base = locale === 'de' ? 'https://lasstreffen.at' : 'https://lasstreffen.at/en';
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    name: 'LassTreffen.at',
    alternateName: 'Lass Treffen',
    url: base,
    description: siteDescription,
    inLanguage: locale === 'de' ? 'de-AT' : 'en',
    publisher: { '@id': 'https://lasstreffen.at/#organization' },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${base}/map?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

function buildOrganizationJsonLd(siteDescription: string) {
  return {
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
    description: siteDescription,
    areaServed: {
      '@type': 'Country',
      name: 'Österreich',
    },
  };
}

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
export default async function RootLayout({
  children,
  modal,
  params,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // fn-17: [locale] matcht als Root-Dynamiksegment JEDEN ersten Pfadteil.
  // Ungültige Locales können hier nur direkt ankommen, wenn die Middleware
  // umgangen wird — die rewritet /wien → /de/wien, bevor Routing greift.
  const { locale: rawLocale } = await params;
  if (!hasLocale(routing.locales, rawLocale)) {
    notFound();
  }
  const locale: AppLocale = rawLocale;
  // Statisches Rendering (ISR-Landing!) trotz [locale]-Param ermöglichen
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Meta' });
  const messages = await getMessages({ locale });
  const websiteJsonLd = buildWebsiteJsonLd(locale, t('description'));
  const organizationJsonLd = buildOrganizationJsonLd(t('description'));

  return (
    <html lang={locale === 'de' ? 'de' : 'en'} className={geist.variable}>
      <head>
        {/*
          fn-15.6: critical CSS inlined first so the browser can paint
          the above-the-fold hero (gradient mesh background, body
          reset, headline fade-in, search-bar focus reset) before the
          render-blocking globals.css chunk parses. ~3 KB raw, hashed
          into the CSP `style-src 'sha256-…'` directive via
          scripts/compute-csp-hash.mjs (prebuild) and verified against
          the rendered HTML in scripts/verify-csp-hash.mjs (postbuild).
          The `data-critical-css` attribute is the marker the verify
          script scans for — DO NOT change it without updating that
          script too.
        */}
        <style
          data-critical-css
          dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }}
        />
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
        {/*
          Google AdSense (2026-09-02). Laedt NUR bei
          NEXT_PUBLIC_ADS_ENABLED=true — der Schalter wird erst umgelegt,
          wenn im AdSense-Konto die DSGVO-Meldung (Googles zertifizierte
          CMP) veroeffentlicht ist. Diese CMP zeigt das Einwilligungs-
          Banner und haelt Anzeigen sowie Werbe-Cookies bis zur Zustimmung
          zurueck; damit bleibt die Zusage in der Datenschutzerklaerung
          (Abschnitt 5) eingehalten. strategy="lazyOnload", damit die
          Kernmetriken der Seite unberuehrt bleiben.
        */}
        {process.env.NEXT_PUBLIC_ADS_ENABLED === 'true' &&
          process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID && (
            <Script
              id="adsense"
              strategy="lazyOnload"
              async
              crossOrigin="anonymous"
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}`}
            />
          )}
      </head>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
        {/*
          fn-15.5 round-2: page-transitions now use the CSS View
          Transition API. <RouteTransitions /> (client component) calls
          `document.startViewTransition()` on internal link clicks —
          that's the trigger that the CSS `::view-transition-*` pseudo-
          elements need to animate same-document navigations. Browsers
          without `startViewTransition` (Firefox) fall back to instant
          cuts, which the spec explicitly allows.
        */}
        <RouteTransitions />
        <V4TopNav />
        {/* fn-15.5 round-4 (codex): wrapper is a <div>, not <main>,
            because several child pages already render their own
            <main> landmark (src/app/page.tsx, src/app/join/[code]/
            page.tsx, src/app/groups/GroupsPageClient.tsx, …). Nested
            <main> elements are invalid HTML and break assistive-tech
            landmark navigation. The view-transition needs a stable
            DOM node for `view-transition-name`, but the tag doesn't
            matter — <div> works just as well. */}
        <div className="route-root" style={{ viewTransitionName: 'route-root' }}>
          {children}
        </div>
        <V4TabBar />
        {modal}
        {/*
          fn-15.10: Service Worker registration + update banner. The
          provider is a Client Component so mounting it here costs ~0
          on RSC routes (only its 'use client' boundary ships JS). It
          renders <UpdateBanner /> as a child — null on first load, a
          toast when the SW has a new version waiting.
        */}
        <ServiceWorkerProvider />
        {/* Globaler Page-View-Tracker — erfasst JEDEN Pfadwechsel (auch die
            SEO-Seiten: /entdecken, /gemeinde, /thema, /blog, Event-Details).
            Ersetzt die früheren Einzelaufrufe auf nur 5 Seiten. */}
        <PageviewTracker />
        {/* Globaler Klick-Tracker — macht alle data-track-Marker scharf
            (ticket_click, cta_*, plan_* …); Basis fürs Affiliate-Reporting. */}
        <ClickTracker />
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
