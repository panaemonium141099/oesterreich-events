/**
 * "Events in der Naehe" auf der Aktivitaets-Detailseite (fn-18 Task 4) —
 * der Inhalt des Task-3-Slot-Contracts (ActivityExtrasSlot).
 *
 * Max. 3 kommende Events (NUR future) im 10-km-Umkreis, geladen ueber
 * den EINEN unstable_cache-Loader loadNearbyFutureEventsCached. Die
 * Aktivitaetsseite laeuft als ISR (revalidate=3600) und setzt
 * setRequestLocale — getTranslations ist hier sicher.
 */

import { getTranslations } from 'next-intl/server';
import { Link as LocaleLink } from '@/i18n/navigation';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { formatDateLong, formatTime } from '@/lib/utils/date';
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
      <ul className="space-y-2">
        {shown.map((e) => (
          <li key={e.id}>
            <LocaleLink
              href={buildEventUrlV2(e)}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 hover:border-white/25 transition-colors"
            >
              <span className="text-xs text-white/50 whitespace-nowrap">
                {formatDateLong(e.start_date)}
                {formatTime(e.start_date) && ` · ${formatTime(e.start_date)}`}
              </span>
              <span className="font-medium text-white/90 leading-snug">{e.title}</span>
              <span className="text-xs text-white/50">
                {e.location_name ?? e.address ?? ''}
                {` · ${e._distance_km.toFixed(1)} km`}
              </span>
            </LocaleLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
