/**
 * /artists als Plakatwand (2026-11, Mockup B in docs/design/kuenstler-redesign).
 *
 * Statische ISR-Shell wie die Startseite: kein cookies(), kein auth im
 * RSC-Pfad, das Verzeichnis kommt über den cookie-freien Anon-Client
 * (get-artists-directory.ts) und ist für alle Besucher gleich. Bis
 * 2026-11 war die Seite login-pflichtig (requireUserOrRedirect) und
 * damit für Gäste und Google leer; jetzt zeigt sie, wer in Österreich
 * spielt, und Folgen ist die Handlung darauf (Client-Insel ArtistsWall,
 * personalisiert nur mit sb-Cookie).
 */

import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArtistsWall } from '@/components/Artists/v4';
import { getArtistsDirectory } from '@/lib/artists/get-artists-directory';
import { bilingualAlternates } from '@/lib/seo/canonical';
import { routing } from '@/i18n/routing';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'Artists' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: bilingualAlternates('/artists', locale),
  };
}

export default async function ArtistsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  setRequestLocale(locale);

  const directory = await getArtistsDirectory();

  return (
    <main className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <ArtistsWall artists={directory.artists} today={directory.today} />
    </main>
  );
}
