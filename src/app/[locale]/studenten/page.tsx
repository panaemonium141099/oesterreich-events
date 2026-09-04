import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { loadStudentIndex } from '@/lib/student-data';
import { bilingualAlternates } from '@/lib/seo/canonical';
import { StudentCityGrid } from '@/components/Landing/StudentCityGrid';
import { EventListCard } from '@/components/Events/EventListCard';
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
    <main className="min-h-screen bg-surface text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {t('h1')}
          </h1>
          <p className="text-sm text-white/50">
            {t('intro')}
          </p>
        </div>

        {/* City Grid */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">
            {t('chooseCity')}
          </h2>
          <StudentCityGrid cities={cities} />
        </section>

        {/* Today's student events */}
        {todayEvents.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              {t('todayForStudents')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {todayEvents.map((event) => (
                <EventListCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
