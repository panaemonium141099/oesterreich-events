import type { Metadata } from 'next';
import { bilingualAlternates } from '@/lib/seo/canonical';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { V4FestivalCard } from '@/components/Events/v4';
import { loadUpcomingFestivals } from '@/lib/festivals/public';
import { routing, type AppLocale } from '@/i18n/routing';

function resolveLocale(raw: string): AppLocale {
  return hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'FestivalsPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: bilingualAlternates('/festivals', locale),
  };
}

export default async function FestivalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'FestivalsPage' });
  const festivals = await loadUpcomingFestivals();

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-10 md:py-14">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
          {t('eyebrow')}
        </p>
        <h1 className="text-[32px] md:text-[44px] font-bold leading-tight tracking-[-0.03em] text-[var(--v4-ink)]">
          {t('title')}
        </h1>
        <p className="mt-3 text-[14px] md:text-[15.5px] text-[var(--v4-ink-70)] max-w-[640px]">
          {festivals.length === 0
            ? t('empty')
            : t('count', { count: festivals.length })}
        </p>
      </section>

      {festivals.length > 0 && (
        <section className="max-w-[1180px] mx-auto px-4 md:px-14 pb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {festivals.map(f => (
              <V4FestivalCard key={f.id} festival={f}/>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
