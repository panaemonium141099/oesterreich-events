import Link from 'next/link';

const TYPE_LABELS: Record<string, string> = {
  bar: 'Bar',
  pub: 'Pub',
  nightclub: 'Nightclub',
  club: 'Club',
  cultural_center: 'Kulturzentrum',
  concert_hall: 'Konzerthaus',
  theater: 'Theater',
  museum: 'Museum',
  other: 'Venue',
};

interface SimilarVenue {
  id: string;
  name: string;
  type: string;
  city: string | null;
}

interface SimilarVenuesProps {
  venues: SimilarVenue[];
}

export function SimilarVenues({ venues }: SimilarVenuesProps) {
  if (venues.length === 0) return null;

  return (
    <section className="mt-10 pt-8 border-t border-white/10">
      <h2 className="text-lg font-semibold text-white mb-4">
        Ahnliche Venues
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {venues.map((venue) => (
          <Link
            key={venue.id}
            href={`/venues/${venue.id}`}
            className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
          >
            <p className="text-sm font-medium text-white truncate">
              {venue.name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-white/40">
                {TYPE_LABELS[venue.type] ?? 'Venue'}
              </span>
              {venue.city && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="text-[10px] text-white/40">
                    {venue.city}
                  </span>
                </>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
