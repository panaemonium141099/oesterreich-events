import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  isValidBundesland,
  getCategoryFromSlug,
  isTimeFilter,
} from '@/lib/landing-slugs';
import { loadBundeslandPage } from '@/lib/landing-data';
import { bilingualAlternates } from '@/lib/seo/canonical';
import { LandingPageShell } from '@/components/Landing/LandingPageShell';
import { routing, type AppLocale } from '@/i18n/routing';

export const revalidate = 3600;

// On-demand ISR — see [bundesland]/[filter]/[subfilter]/page.tsx for
// the rationale.
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
  params: Promise<{ locale: string; bundesland: string; filter: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, bundesland, filter } = await params;
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'HubLanding' });
  if (!isValidBundesland(bundesland)) return { title: t('notFound') };

  const category = getCategoryFromSlug(filter);
  const timeFilter = isTimeFilter(filter)
    ? (filter as 'heute' | 'wochenende')
    : null;

  if (!category && !timeFilter) return { title: t('notFound') };

  const data = await loadBundeslandPage(bundesland, category, timeFilter, locale);
  if (!data) return { title: t('notFound') };

  return {
    title: data.metaTitle,
    description: data.metaDescription,
    alternates: bilingualAlternates(`/${bundesland}/${filter}`, locale),
    openGraph: { title: data.metaTitle, description: data.metaDescription },
    twitter: {
      card: 'summary',
      title: data.metaTitle,
      description: data.metaDescription,
    },
  };
}

export default async function BundeslandFilterPage({
  params,
}: {
  params: Promise<{ locale: string; bundesland: string; filter: string }>;
}) {
  const { locale: rawLocale, bundesland, filter } = await params;
  const locale = resolveLocale(rawLocale);
  setRequestLocale(locale);
  if (!isValidBundesland(bundesland)) notFound();

  const category = getCategoryFromSlug(filter);
  const timeFilter = isTimeFilter(filter)
    ? (filter as 'heute' | 'wochenende')
    : null;

  if (!category && !timeFilter) notFound();

  const data = await loadBundeslandPage(bundesland, category, timeFilter, locale);
  if (!data) notFound();

  return <LandingPageShell {...data} />;
}
