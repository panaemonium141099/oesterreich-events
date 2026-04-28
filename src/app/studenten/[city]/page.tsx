import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  STUDENT_CITIES,
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
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidStudentCity(city)) return { title: 'Nicht gefunden' };

  const config = getStudentCityConfig(city)!;
  const data = await loadStudentPage(config, null);
  if (!data) return { title: 'Nicht gefunden' };

  return {
    title: data.metaTitle,
    description: data.metaDescription,
    openGraph: { title: data.metaTitle, description: data.metaDescription },
  };
}

export default async function StudentenCityPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  if (!isValidStudentCity(city)) notFound();

  const config = getStudentCityConfig(city)!;
  const data = await loadStudentPage(config, null);
  if (!data) notFound();

  return <LandingPageShell {...data} />;
}
