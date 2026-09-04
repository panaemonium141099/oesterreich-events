import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isValidBundesland } from '@/lib/landing-slugs';
import { loadBundeslandPage } from '@/lib/landing-data';
import { bilingualAlternates } from '@/lib/seo/canonical';
import { LandingPageShell } from '@/components/Landing/LandingPageShell';
import { HubSearchCTA } from '@/components/Hub/HubSearchCTA';
import { HubSmartCTA } from '@/components/Hub/HubSmartCTA';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { routing, type AppLocale } from '@/i18n/routing';

export const revalidate = 3600;

// On-demand ISR — build-time pre-render disabled to avoid Supabase
// outages aborting the entire deploy. See sibling page.tsx files
// (e.g. [bundesland]/[filter]/[subfilter]/page.tsx) for the same
// pattern + rationale.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

function resolveLocale(raw: string): AppLocale {
  return hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; bundesland: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, bundesland } = await params;
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'HubLanding' });
  if (!isValidBundesland(bundesland)) return { title: t('notFound') };

  const data = await loadBundeslandPage(bundesland, null, null, locale);
  if (!data) return { title: t('notFound') };

  return {
    title: data.metaTitle,
    description: data.metaDescription,
    // Seite ist real zweisprachig (Copy + Metadata), deshalb kanonisiert
    // jede Sprachvariante auf sich selbst und verweist per hreflang auf
    // die andere — nicht mehr deOnlyAlternates wie vor der Übersetzung.
    alternates: bilingualAlternates(`/${bundesland}`, locale),
    openGraph: { title: data.metaTitle, description: data.metaDescription },
    twitter: {
      card: 'summary',
      title: data.metaTitle,
      description: data.metaDescription,
    },
  };
}

export default async function BundeslandPage({
  params,
}: {
  params: Promise<{ locale: string; bundesland: string }>;
}) {
  const { locale: rawLocale, bundesland } = await params;
  const locale = resolveLocale(rawLocale);
  // fn-17: setRequestLocale VOR jeder Übersetzung/i18n-Link, sonst kippt
  // next-intl die Route in dynamisches Rendering (Muster: [locale]/page.tsx).
  setRequestLocale(locale);
  if (!isValidBundesland(bundesland)) notFound();

  const data = await loadBundeslandPage(bundesland, null, null, locale);
  if (!data) notFound();

  const t = await getTranslations({ locale, namespace: 'HubLanding' });
  const blName = bundeslandDisplayName(bundesland, locale);
  return (
    <LandingPageShell
      {...data}
      searchCta={
        <div className="flex flex-wrap items-center gap-3">
          <HubSearchCTA
            scope={{ bundesland }}
            label={t('searchCta', { name: blName })}
          />
          <HubSmartCTA
            surface="bundesland-hub"
            query={t('smartCta', { name: blName })}
          />
        </div>
      }
    />
  );
}
