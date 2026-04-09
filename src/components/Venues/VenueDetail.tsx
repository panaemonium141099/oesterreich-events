import { FollowVenueButton } from '@/components/Follow/FollowVenueButton';

const TYPE_LABELS: Record<string, string> = {
  bar: 'Bar',
  pub: 'Pub',
  nightclub: 'Nightclub',
  club: 'Club',
  vereinslokal: 'Vereinslokal',
  university: 'Universitat',
  student_org: 'Studentenorganisation',
  cultural_center: 'Kulturzentrum',
  concert_hall: 'Konzerthaus',
  theater: 'Theater',
  museum: 'Museum',
  other: 'Venue',
};

interface VenueDetailProps {
  venue: {
    id: string;
    name: string;
    type: string;
    city: string | null;
    bundesland: string | null;
    address: string | null;
    postal_code: string | null;
    website: string | null;
    facebook_url: string | null;
    instagram_url: string | null;
  };
  totalEvents: number;
}

export function VenueDetail({ venue, totalEvents }: VenueDetailProps) {
  const typeLabel = TYPE_LABELS[venue.type] ?? 'Venue';

  return (
    <div className="space-y-4">
      {/* Type badge */}
      <span className="inline-block bg-indigo-600/30 text-indigo-300 text-xs font-medium px-3 py-1 rounded-full border border-indigo-500/30">
        {typeLabel}
      </span>

      {/* Name + Follow */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">
          {venue.name}
        </h1>
        <FollowVenueButton venueId={venue.id} venueName={venue.name} />
      </div>

      {/* Event count */}
      <p className="text-sm text-white/50">
        {totalEvents} kommende Veranstaltung{totalEvents !== 1 ? 'en' : ''}
      </p>

      {/* Info */}
      <div className="flex flex-col gap-1.5 text-sm text-gray-300">
        {(venue.city || venue.address) && (
          <div className="flex items-center gap-2">
            <span className="text-white/40">&#128205;</span>
            <span>
              {venue.address && `${venue.address}, `}
              {venue.postal_code && `${venue.postal_code} `}
              {venue.city}
            </span>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-3">
        {venue.website && (
          <a
            href={venue.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Website
          </a>
        )}
        {venue.facebook_url && (
          <a
            href={venue.facebook_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            Facebook
          </a>
        )}
        {venue.instagram_url && (
          <a
            href={venue.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            Instagram
          </a>
        )}
      </div>
    </div>
  );
}
