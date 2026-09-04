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
import { deOnlyAlternates } from '@/lib/seo/canonical';
import { LandingPageShell } from '@/components/Landing/LandingPageShell';

export const revalidate = 3600;

// On-demand ISR (same pattern as /events/[...slug]/page.tsx).
//
// Reverted from build-time static generation because Supabase outages
// turned every Vercel build into a flaky long-tail: each of the
// ~2.656 hub-page combinations queries Supabase, and a single 60s
// hang on any of them fails the entire build (we observed this on
// 2026-04-28 — `loadBundeslandPage` for /burgenland/musik/heute
// timed out 3× because Supabase was unreachable, and the build
// aborted).
//
// With dynamicParams + empty generateStaticParams, no page is
// pre-built. The first visitor to each combo triggers a runtime
// render that gets cached on the CDN for `revalidate` seconds.
// Trade-off: cold-start hit on the first visitor per (bundesland,
// category, timeFilter, hour) tuple. Acceptable — these hub pages
// have low traffic per individual combo, and ISR keeps subsequent
// hits fast.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bundesland: string; filter: string; subfilter: string }>;
}): Promise<Metadata> {
  const { bundesland, filter, subfilter } = await params;
  if (!isValidBundesland(bundesland)) return { title: 'Nicht gefunden' };

  const category = getCategoryFromSlug(filter);
  const timeFilter = isTimeFilter(subfilter)
    ? (subfilter as 'heute' | 'wochenende')
    : null;

  if (!category || !timeFilter) return { title: 'Nicht gefunden' };

  const data = await loadBundeslandPage(bundesland, category, timeFilter);
  if (!data) return { title: 'Nicht gefunden' };

  return {
    title: data.metaTitle,
    description: data.metaDescription,
    alternates: deOnlyAlternates(`/${bundesland}/${filter}/${subfilter}`),
    openGraph: { title: data.metaTitle, description: data.metaDescription },
    twitter: {
      card: 'summary',
      title: data.metaTitle,
      description: data.metaDescription,
    },
  };
}

export default async function BundeslandCategoryTimePage({
  params,
}: {
  params: Promise<{ bundesland: string; filter: string; subfilter: string }>;
}) {
  const { bundesland, filter, subfilter } = await params;
  if (!isValidBundesland(bundesland)) notFound();

  const category = getCategoryFromSlug(filter);
  const timeFilter = isTimeFilter(subfilter)
    ? (subfilter as 'heute' | 'wochenende')
    : null;

  if (!category || !timeFilter) notFound();

  const data = await loadBundeslandPage(bundesland, category, timeFilter);
  if (!data) notFound();

  return <LandingPageShell {...data} />;
}
