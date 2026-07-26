/**
 * Karten-Block der Aktivitaets-Detailseite (fn-18 Task 3).
 *
 * Statisches Mapbox-Bild (gleiches Muster wie EventDetailV2/PlanCard) —
 * kein Mapbox-GL-Bundle fuer eine einzelne Pin-Ansicht. Ohne Token wird
 * nur der Routen-Link gerendert.
 */

import { getTranslations } from 'next-intl/server';

interface ActivityMapProps {
  name: string;
  lat: number;
  lng: number;
}

function buildStaticMapUrl(lat: number, lng: number, width = 1280, height = 480): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
  if (!token) return null;
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-l+ffffff(${lng},${lat})/${lng},${lat},13,0/${width}x${height}@2x?access_token=${token}`;
}

export async function ActivityMap({ name, lat, lng }: ActivityMapProps) {
  const t = await getTranslations('Activity');
  const mapUrl = buildStaticMapUrl(lat, lng);
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <section className="max-w-4xl mx-auto px-6 mt-10">
      <h2 className="text-lg font-semibold text-white mb-3">{t('map')}</h2>
      {mapUrl && (
        <div className="rounded-xl overflow-hidden border border-white/[0.06]">
          {/* eslint-disable-next-line @next/next/no-img-element -- statisches Mapbox-Bild, bewusst kein next/image-Proxy */}
          <img src={mapUrl} alt={`Karte: ${name}`} className="w-full h-56 md:h-72 object-cover" loading="lazy" />
        </div>
      )}
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 mt-3 text-sm text-white/60 hover:text-white transition-colors underline underline-offset-2"
      >
        {t('route')} ↗
      </a>
    </section>
  );
}
