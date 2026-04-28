import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
  LANDING_CITIES,
  getCityConfig,
  getCityRedirect,
  getCategoryFromSlug,
  isTimeFilter,
  CATEGORY_SLUGS,
} from '@/lib/landing-slugs';
import { loadStadtPage } from '@/lib/landing-data';
import { LandingPageShell } from '@/components/Landing/LandingPageShell';

export const revalidate = 3600;

// On-demand ISR — see [bundesland]/[filter]/[subfilter]/page.tsx
// for the rationale.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; filter: string; subfilter: string }>;
}): Promise<Metadata> {
  const { city, filter, subfilter } = await params;
  if (getCityRedirect(city)) return { title: 'Weiterleitung' };

  const config = getCityConfig(city);
  if (!config) return { title: 'Nicht gefunden' };

  const category = getCategoryFromSlug(filter);
  const timeFilter = isTimeFilter(subfilter)
    ? (subfilter as 'heute' | 'wochenende')
    : null;
  if (!category || !timeFilter) return { title: 'Nicht gefunden' };

  const data = await loadStadtPage(config, category, timeFilter);
  return {
    title: data.metaTitle,
    description: data.metaDescription,
    openGraph: { title: data.metaTitle, description: data.metaDescription },
    twitter: {
      card: 'summary',
      title: data.metaTitle,
      description: data.metaDescription,
    },
  };
}

export default async function StadtCategoryTimePage({
  params,
}: {
  params: Promise<{ city: string; filter: string; subfilter: string }>;
}) {
  const { city, filter, subfilter } = await params;

  const redirectBase = getCityRedirect(city);
  if (redirectBase) redirect(`${redirectBase}/${filter}/${subfilter}`);

  const config = getCityConfig(city);
  if (!config) notFound();

  const category = getCategoryFromSlug(filter);
  const timeFilter = isTimeFilter(subfilter)
    ? (subfilter as 'heute' | 'wochenende')
    : null;
  if (!category || !timeFilter) notFound();

  const data = await loadStadtPage(config, category, timeFilter);
  return <LandingPageShell {...data} />;
}
