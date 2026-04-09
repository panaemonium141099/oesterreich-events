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

export function generateStaticParams() {
  return STUDENT_CITIES.map((c) => ({ city: c.slug }));
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
