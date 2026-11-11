import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { loadStudentIndex } from '@/lib/student-data';
import { bilingualAlternates } from '@/lib/seo/canonical';
import { StudentCityGrid } from '@/components/Landing/StudentCityGrid';
import { Shelf, ShelfCard } from '@/components/Discover/v4/shelf-ui';
import { routing, type AppLocale } from '@/i18n/routing';

export const revalidate = 3600;
// On-demand ISR (no build-time pre-render). Empty generateStaticParams
// + dynamicParams=true is the same pattern used by every other
// Supabase-querying hub page in the app — see the comment in
// /[bundesland]/[filter]/[subfilter]/page.tsx for the rationale.
// Combined with the per-role statement_timeout set by
// migrations/20260428193000_set_statement_timeouts.sql, the build
// is now fully immune to Supabase outages: even if the page DOES
// render at build time, Postgres aborts any single query at 8s
// rather than letting it consume the 60s static-page budget.
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
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'HubStudents' });

  return {
    // Layout template appends " | LassTreffen.at" — no manual suffix here.
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: bilingualAlternates('/studenten', locale),
    openGraph: {
      title: t('ogTitle'),
      description: t('ogDescription'),
    },
  };
}

export default async function StudentenIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'HubStudents' });
  // Build-Resilienz (2026-08-26): haengt Supabase, rendert die Seite mit
  // leeren Zaehlern statt den Deploy zu killen (60s-Static-Kill im
  // I/O-Sturm, siehe Vercel-Log 20:21). Revalidate (1 h) fuellt nach.
  const { cities, todayEvents } = await Promise.race([
    loadStudentIndex(),
    new Promise<Awaited<ReturnType<typeof loadStudentIndex>>>(resolve =>
      setTimeout(() => resolve({ cities: [], todayEvents: [] } as unknown as Awaited<ReturnType<typeof loadStudentIndex>>), 15_000),
    ),
  ]).catch(() => ({ cities: [], todayEvents: [] } as unknown as Awaited<ReturnType<typeof loadStudentIndex>>));

  return (
    <main className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 pt-7 md:pt-9 pb-20">
        {/* Header */}
        <header className="mb-8">
          <h1 className="m-0 text-[34px] md:text-[40px] font-extrabold tracking-[-0.035em] leading-[1.05] text-[var(--v4-ink)]">
            {t('h1')}
          </h1>
          <p className="mt-2 mb-0 max-w-2xl text-[14px] text-[var(--v4-ink-50)]">
            {t('intro')}
          </p>
        </header>

        {/* City Grid */}
        <section className="mb-4">
          <h2 className="m-0 mb-3 text-[21px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">
            {t('chooseCity')}
          </h2>
          <StudentCityGrid cities={cities} />
        </section>

        {/* Today's student events */}
        {todayEvents.length > 0 && (
          <Shelf title={t('todayForStudents')}>
            {todayEvents.map((event) => (
              <ShelfCard key={event.id} ev={event} />
            ))}
          </Shelf>
        )}
      </div>
    </main>
  );
}
