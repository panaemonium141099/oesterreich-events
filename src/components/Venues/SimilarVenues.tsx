import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/** Bekannte Venue-Typen → Message-Key unter VenuePage.types.* */
const KNOWN_TYPES = new Set([
  'bar', 'pub', 'nightclub', 'club', 'cultural_center',
  'concert_hall', 'theater', 'museum', 'other',
]);

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
  const t = useTranslations('VenuePage');
  if (venues.length === 0) return null;

  return (
    <section className="mt-10 pt-8 border-t border-white/10">
      <h2 className="text-lg font-semibold text-white mb-4">
        {t('similarVenues')}
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
                {t(`types.${KNOWN_TYPES.has(venue.type) ? venue.type : 'other'}`)}
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
