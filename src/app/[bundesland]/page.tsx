import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BUNDESLAENDER } from '@/lib/bundeslaender';
import { isValidBundesland } from '@/lib/landing-slugs';
import { loadBundeslandPage } from '@/lib/landing-data';
import { LandingPageShell } from '@/components/Landing/LandingPageShell';

export const revalidate = 3600;

export function generateStaticParams() {
  return BUNDESLAENDER.filter((b) => b.id !== 'all').map((b) => ({
    bundesland: b.id,
  }));
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

  return <LandingPageShell {...data} />;
}
