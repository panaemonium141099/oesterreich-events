import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BUNDESLAENDER } from '@/lib/bundeslaender';
import { isValidBundesland, getBundeslandName } from '@/lib/landing-slugs';
import { loadBundeslandPage } from '@/lib/landing-data';
import { LandingPageShell } from '@/components/Landing/LandingPageShell';
import { HubSearchCTA } from '@/components/Hub/HubSearchCTA';

export const revalidate = 3600;

// On-demand ISR — build-time pre-render disabled to avoid Supabase
// outages aborting the entire deploy. See sibling page.tsx files
// (e.g. [bundesland]/[filter]/[subfilter]/page.tsx) for the same
// pattern + rationale.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bundesland: string }>;
}): Promise<Metadata> {
  const { bundesland } = await params;
  if (!isValidBundesland(bundesland)) return { title: 'Nicht gefunden' };

  const data = await loadBundeslandPage(bundesland, null, null);
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

export default async function BundeslandPage({
  params,
}: {
  params: Promise<{ bundesland: string }>;
}) {
  const { bundesland } = await params;
  if (!isValidBundesland(bundesland)) notFound();

  const data = await loadBundeslandPage(bundesland, null, null);
  if (!data) notFound();

  const blName = getBundeslandName(bundesland) ?? bundesland;
  return (
    <LandingPageShell
      {...data}
      searchCta={
        <HubSearchCTA
          scope={{ bundesland }}
          label={`Alle Veranstaltungen in ${blName} durchsuchen`}
        />
      }
    />
  );
}
