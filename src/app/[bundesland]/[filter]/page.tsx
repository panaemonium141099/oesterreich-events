import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BUNDESLAENDER } from '@/lib/bundeslaender';
import {
  isValidBundesland,
  CATEGORY_SLUGS,
  getCategoryFromSlug,
  isTimeFilter,
} from '@/lib/landing-slugs';
import { loadBundeslandPage } from '@/lib/landing-data';
import { LandingPageShell } from '@/components/Landing/LandingPageShell';

export const revalidate = 3600;

export function generateStaticParams() {
  const bundeslaender = BUNDESLAENDER.filter((b) => b.id !== 'all');
  const params: { bundesland: string; filter: string }[] = [];

  for (const b of bundeslaender) {
    // Time filters
    params.push({ bundesland: b.id, filter: 'heute' });
    params.push({ bundesland: b.id, filter: 'wochenende' });
    // Category filters
    for (const [slug] of CATEGORY_SLUGS) {
      params.push({ bundesland: b.id, filter: slug });
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bundesland: string; filter: string }>;
}): Promise<Metadata> {
  const { bundesland, filter } = await params;
  if (!isValidBundesland(bundesland)) return { title: 'Nicht gefunden' };

  const category = getCategoryFromSlug(filter);
  const timeFilter = isTimeFilter(filter)
    ? (filter as 'heute' | 'wochenende')
    : null;

  if (!category && !timeFilter) return { title: 'Nicht gefunden' };

  const data = await loadBundeslandPage(bundesland, category, timeFilter);
  if (!data) return { title: 'Nicht gefunden' };

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

export default async function BundeslandFilterPage({
  params,
}: {
  params: Promise<{ bundesland: string; filter: string }>;
}) {
  const { bundesland, filter } = await params;
  if (!isValidBundesland(bundesland)) notFound();

  const category = getCategoryFromSlug(filter);
  const timeFilter = isTimeFilter(filter)
    ? (filter as 'heute' | 'wochenende')
    : null;

  if (!category && !timeFilter) notFound();

  const data = await loadBundeslandPage(bundesland, category, timeFilter);
  if (!data) notFound();

  return <LandingPageShell {...data} />;
}
