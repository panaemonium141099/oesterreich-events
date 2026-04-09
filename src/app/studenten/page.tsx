import type { Metadata } from 'next';
import { loadStudentIndex } from '@/lib/student-data';
import { StudentCityGrid } from '@/components/Landing/StudentCityGrid';
import { EventListCard } from '@/components/Events/EventListCard';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Events fur Studenten | LassTreffen.at',
  description:
    'Finde Events rund um deine Uni — Nightlife, gratis Events, Pub Quizzes und mehr in Wien, Graz, Innsbruck und Salzburg.',
  openGraph: {
    title: 'Events fur Studenten | LassTreffen.at',
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
