import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  isValidStudentCity,
  getStudentCityConfig,
} from '@/lib/landing-slugs';
import { loadStudentPage } from '@/lib/student-data';
import { bilingualAlternates } from '@/lib/seo/canonical';
import { LandingPageShell } from '@/components/Landing/LandingPageShell';
import { routing, type AppLocale } from '@/i18n/routing';

export const revalidate = 3600;

// On-demand ISR — see [bundesland]/[filter]/[subfilter]/page.tsx
// for the rationale.
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
  params: Promise<{ locale: string; city: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, city } = await params;
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'HubStudents' });
  if (!isValidStudentCity(city)) return { title: t('notFound') };

  const config = getStudentCityConfig(city)!;
  const data = await loadStudentPage(config, null, locale);
  if (!data) return { title: t('notFound') };

  return {
    title: data.metaTitle,
    description: data.metaDescription,
    alternates: bilingualAlternates(`/studenten/${city}`, locale),
    openGraph: { title: data.metaTitle, description: data.metaDescription },
  };
}

export default async function StudentenCityPage({
  params,
}: {
  params: Promise<{ locale: string; city: string }>;
}) {
  const { locale: rawLocale, city } = await params;
  const locale = resolveLocale(rawLocale);
  setRequestLocale(locale);
  if (!isValidStudentCity(city)) notFound();

  const config = getStudentCityConfig(city)!;
  const data = await loadStudentPage(config, null, locale);
  if (!data) notFound();

  return <LandingPageShell {...data} />;
}
