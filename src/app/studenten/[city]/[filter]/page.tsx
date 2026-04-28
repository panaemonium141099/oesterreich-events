import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  STUDENT_CITIES,
  STUDENT_FILTERS,
  isValidStudentCity,
  getStudentCityConfig,
} from '@/lib/landing-slugs';
import { loadStudentPage } from '@/lib/student-data';
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
  params: Promise<{ city: string; filter: string }>;
}): Promise<Metadata> {
  const { city, filter } = await params;
  if (!isValidStudentCity(city)) return { title: 'Nicht gefunden' };
  if (!STUDENT_FILTERS.has(filter)) return { title: 'Nicht gefunden' };

  const config = getStudentCityConfig(city)!;
  const data = await loadStudentPage(config, filter);
  if (!data) return { title: 'Nicht gefunden' };

  return {
    title: data.metaTitle,
    description: data.metaDescription,
    openGraph: { title: data.metaTitle, description: data.metaDescription },
  };
}

export default async function StudentenFilterPage({
  params,
}: {
  params: Promise<{ city: string; filter: string }>;
}) {
  const { city, filter } = await params;
  if (!isValidStudentCity(city)) notFound();
  if (!STUDENT_FILTERS.has(filter)) notFound();

  const config = getStudentCityConfig(city)!;
  const data = await loadStudentPage(config, filter);
  if (!data) notFound();

  return <LandingPageShell {...data} />;
}
