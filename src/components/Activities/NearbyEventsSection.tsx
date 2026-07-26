/**
 * "Events in der Naehe" auf der Aktivitaets-Detailseite (fn-18 Task 4) —
 * der Inhalt des Task-3-Slot-Contracts (ActivityExtrasSlot).
 *
 * Max. 3 kommende Events (NUR future) im 10-km-Umkreis, geladen ueber
 * den EINEN unstable_cache-Loader loadNearbyFutureEventsCached. Die
 * Aktivitaetsseite laeuft als ISR (revalidate=3600) und setzt
 * setRequestLocale — getTranslations ist hier sicher.
 *
 * Optik (User-Feedback): normale Event-Karten MIT Bild wie auf der
 * Event-Detailseite (V4RelatedEvents-Muster) — resolvePrimaryEventImage
 * liefert bei fehlendem Bild den Kategorie-Fallback, daher plain <img>
 * ohne onError-Zweig (gleich wie das Event-Grid der Gemeinde-Hub-Seite).
 */

import { getTranslations } from 'next-intl/server';
import { Link as LocaleLink } from '@/i18n/navigation';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { formatDateLong, formatTime } from '@/lib/utils/date';
import { resolvePrimaryEventImage } from '@/lib/event-images';
import { loadNearbyFutureEventsCached } from '@/lib/activities/nearby-loaders';

const LIMIT = 3;
const RADIUS_KM = 10;

export async function NearbyEventsSection({ lat, lng }: { lat: number; lng: number }) {
  const [events, t] = await Promise.all([
    loadNearbyFutureEventsCached(lat, lng, RADIUS_KM),
    getTranslations('Activity'),
  ]);
  const shown = events.slice(0, LIMIT);
  if (shown.length === 0) return null;

  return (
    <section className="max-w-4xl mx-auto px-6 mt-10">
      <h2 className="text-lg font-semibold text-white mb-1">{t('nearbyEventsTitle')}</h2>
      <p className="text-sm text-white/40 mb-4">{t('nearbyEventsHint')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((e) => (
          <LocaleLink
            key={e.id}
            href={buildEventUrlV2(e)}
            className="rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06] hover:border-white/25 transition-colors block"
          >
            <div className="relative w-full aspect-[16/9] bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element -- Event-Bild-Domains sind nicht im next/image-Allowlist; Resolver liefert immer eine URL (Kategorie-Fallback) */}
              <img
                src={resolvePrimaryEventImage({ imageUrl: e.image_url, category: e.category, title: e.title })}
                alt={e.title}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <div className="p-3">
              <div className="text-xs text-white/50 mb-1">
                {formatDateLong(e.start_date)}
                {formatTime(e.start_date) && ` · ${formatTime(e.start_date)}`}
              </div>
              <div className="font-semibold text-white/90 leading-snug line-clamp-2 mb-1">
                {e.title}
              </div>
              <div className="text-xs text-white/50">
                {e.location_name ?? e.address ?? ''}
                {(e.location_name || e.address) && ' · '}
                {e._distance_km.toFixed(1)} km
              </div>
            </div>
          </LocaleLink>
        ))}
      </div>
    </section>
  );
}
