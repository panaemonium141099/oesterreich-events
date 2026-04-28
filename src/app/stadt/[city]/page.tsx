import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
  LANDING_CITIES,
  getCityConfig,
  getCityRedirect,
} from '@/lib/landing-slugs';
import { loadStadtPage } from '@/lib/landing-data';
import { LandingPageShell } from '@/components/Landing/LandingPageShell';

export const revalidate = 3600;

// On-demand ISR — see [bundesland]/[filter]/[subfilter]/page.tsx
// for the rationale (Supabase outages must not abort the build).
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;

  // Wien redirect — don't generate metadata
  if (getCityRedirect(city)) return { title: 'Weiterleitung' };

  const config = getCityConfig(city);
  if (!config) return { title: 'Nicht gefunden' };

  const data = await loadStadtPage(config, null, null);
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

export default async function StadtPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;

  // 301 redirect for Wien → /wien (Bundesland = Stadt)
  const redirectTarget = getCityRedirect(city);
  if (redirectTarget) redirect(redirectTarget);

  const config = getCityConfig(city);
  if (!config) notFound();

  const data = await loadStadtPage(config, null, null);
  return <LandingPageShell {...data} />;
}
