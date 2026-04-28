import type { Metadata } from 'next';
import { loadStudentIndex } from '@/lib/student-data';
import { StudentCityGrid } from '@/components/Landing/StudentCityGrid';
import { EventListCard } from '@/components/Events/EventListCard';

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

export const metadata: Metadata = {
  // Layout template appends " | LassTreffen.at" — no manual suffix here.
  title: 'Events für Studenten',
  description:
    'Finde Events rund um deine Uni — Nightlife, gratis Events, Pub Quizzes und mehr in Wien, Graz, Innsbruck und Salzburg.',
  openGraph: {
    title: 'Events für Studenten | LassTreffen.at',
    description:
      'Finde Events rund um deine Uni — Nightlife, gratis Events und mehr.',
  },
};

export default async function StudentenIndexPage() {
  const { cities, todayEvents } = await loadStudentIndex();

  return (
    <main className="min-h-screen bg-surface text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Events fur Studenten
          </h1>
          <p className="text-sm text-white/50">
            Finde Events rund um deine Uni — Nightlife, gratis Events und mehr.
          </p>
        </div>

        {/* City Grid */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">
            Wahle deine Stadt
          </h2>
          <StudentCityGrid cities={cities} />
        </section>

        {/* Today's student events */}
        {todayEvents.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              Heute fur Studenten
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
