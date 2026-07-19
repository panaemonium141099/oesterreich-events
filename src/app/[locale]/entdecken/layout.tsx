import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { routing, type AppLocale } from '@/i18n/routing';
import { localeAlternates } from '@/lib/i18n-seo';
// fn-15.6: /entdecken uses the same MapV3 FilterDrawer as /map. That drawer's
// chip-group grid layout (`.mv3-chip-group`) lives in map-scope.css. Without
// importing it here, the chips fell back to `display: block` and stacked
// vertically — golden sample is /map where chips render as a 4-col grid.
import '../map-scope.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = hasLocale(routing.locales, rawLocale)
    ? rawLocale
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'MetaDiscover' });
  const alternates = localeAlternates('/entdecken', locale);

  return {
    title: t('title'),
    description: t('description'),
    alternates,
    openGraph: {
      title: t('ogTitle'),
      description: t('ogDescription'),
      type: 'website',
      url: alternates.canonical,
    },
  };
}

export default function EntdeckenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
