/**
 * /aktivitaeten — Uebersichtsseite des Freizeit-Bestands (fn-18 Task 8).
 *
 * Statischer ISR-Einstieg analog /aktivitaet/[slug]: `revalidate = 3600`,
 * `setRequestLocale` (sonst faellt getTranslations auf Request-Header
 * zurueck und die Route kippt auf dynamic), KEINE searchParams und kein
 * cookies()/auth im RSC-Pfad. Die erste Karten-Seite kommt aus dem
 * gecachten Server-Loader; Filter und "Mehr laden" laufen client-seitig
 * ueber /api/activities (ActivitiesBrowser).
 *
 * E13: /en/aktivitaeten rendert denselben DE-Content und kanonisiert auf
 * die DE-URL — kein hreflang-Paar, in der Sitemap steht nur die DE-URL.
 */

import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { BUNDESLAENDER } from '@/lib/bundeslaender';
import { activityListCanonicalUrl } from '@/lib/activities/indexability';
import { loadActivityListPageCached } from '@/lib/activities/list-loaders';
import { ACTIVITY_LIST_PAGE_SIZE } from '@/lib/activities/list-query';
import { ActivitiesBrowser } from '@/components/Activities/ActivitiesBrowser';
import { NearbyActivitiesRail } from '@/components/Activities/NearbyActivitiesRail';
import { HubSmartCTA } from '@/components/Hub/HubSmartCTA';

export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const TITLE = 'Freizeitaktivitäten & Ausflugsziele in Österreich';
const DESCRIPTION =
  'Wandern, Baden, Museen, Bergtouren und mehr: Freizeitaktivitäten und ' +
  'Ausflugsziele in ganz Österreich — mit Öffnungszeiten, Karte und Infos.';

export function generateMetadata(): Metadata {
  const canonical = activityListCanonicalUrl();
  return {
    title: { absolute: `${TITLE} | LassTreffen.at` },
    description: DESCRIPTION,
    // E13: canonical IMMER auf DE, bewusst KEIN languages/hreflang-Paar.
    alternates: { canonical },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      type: 'website',
      url: canonical,
    },
  };
}

/** Echte Bundeslaender fuer die Filter-Chips (ohne die beiden
 *  Karten-Pseudo-Regionen 'all' und 'at-de-ch'). */
const BUNDESLAND_OPTIONS = BUNDESLAENDER.filter(
  (b) => b.id !== 'all' && b.id !== 'at-de-ch',
).map((b) => ({ id: b.id, name: b.name }));

export default async function ActivitiesOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  setRequestLocale(hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale);

  const [page, t] = await Promise.all([
    loadActivityListPageCached(ACTIVITY_LIST_PAGE_SIZE),
    getTranslations('Activities'),
  ]);

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 pt-10">
        <h1 className="text-[26px] md:text-[34px] font-bold tracking-[-0.02em] leading-tight mb-3">
          {t('pageTitle')}
        </h1>
        <p className="text-sm md:text-[15px] text-white/55 max-w-2xl mb-5">{t('pageIntro')}</p>

        {/* fn-19: Smart-Suche-Einstieg — die Regen-Query ist der beste
            Showcase des deterministischen Indoor-Filters. */}
        <div className="mb-8">
          <HubSmartCTA
            surface="aktivitaeten"
            query="Was tun bei Regen?"
            label="Frag die KI: Was tun bei Regen?"
          />
        </div>

        {/* Standort-Highlights (fn-19) — client-only, ISR-neutral */}
        <NearbyActivitiesRail />

        <ActivitiesBrowser
          initialItems={page.items}
          initialCursor={page.nextCursor}
          bundeslaender={BUNDESLAND_OPTIONS}
        />
      </div>
    </div>
  );
}
