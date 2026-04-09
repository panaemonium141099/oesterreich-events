import Link from 'next/link';
import type { StudentCity } from '@/lib/landing-slugs';

interface StudentCityGridProps {
  cities: { city: StudentCity; eventCount: number }[];
}

const CITY_IMAGES: Record<string, string> = {
  wien: 'https://images.unsplash.com/photo-1578400889704-bbd63485d516?w=400&q=75&auto=format&fit=crop',
  graz: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=75&auto=format&fit=crop',
  innsbruck: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=75&auto=format&fit=crop',
  salzburg: 'https://images.unsplash.com/photo-1759765098596-0c1bef505555?w=400&q=75&auto=format&fit=crop',
};

export function StudentCityGrid({ cities }: StudentCityGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cities.map(({ city, eventCount }) => (
        <Link
          key={city.slug}
          href={`/studenten/${city.slug}`}
          className="group relative overflow-hidden rounded-2xl aspect-[4/3]"
        >
          {/* Background */}
          <div
            className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
            style={{
              backgroundImage: `url(${CITY_IMAGES[city.slug] ?? ''})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/5 group-hover:from-black/80 transition-all duration-300" />

          {/* Text */}
          <div className="absolute inset-x-0 bottom-0 p-4 text-left">
            <p className="text-white font-extrabold text-base leading-tight">
              {city.name}
            </p>
            <p className="text-white/50 text-xs mt-0.5 tabular-nums">
              {eventCount > 0
                ? `${eventCount} Events`
                : 'Events'}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
