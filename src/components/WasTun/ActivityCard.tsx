/**
 * Aktivitäts-Karte im Format der Event-Poster (ShelfCard): quadratisches
 * Bild, Marke „Ausflugsziel" statt Datum, darunter Name und Ort. `grid`
 * füllt die Rasterzelle (.v4-poster-grid), sonst feste Breite fürs Regal.
 * Ohne Server-Importe, damit die Nachlade-Komponente sie mitbenutzt.
 */

import { Link as LocaleLink } from '@/i18n/navigation';
import { ActivityCardImage } from '@/components/Activities/ActivityCardImage';
import { activityTagLabel } from '@/lib/activities/tag-labels';
import type { WasTunActivity } from '@/lib/was-tun/content';

export interface ActivityCardLabels {
  /** Text im Bild-Platzhalter ohne Tag. */
  fallback: string;
  /** Präfix der Bild-Attribution („Bild:"). */
  credit: string;
}

export function ActivityCard({ activity, labels, grid = false }: {
  activity: WasTunActivity;
  labels: ActivityCardLabels;
  grid?: boolean;
}) {
  const tag = activity.tags?.[0] ? activityTagLabel(activity.tags[0]) : null;
  const meta = [tag, activity.town].filter(Boolean).join(' · ');

  return (
    <LocaleLink
      href={`/aktivitaet/${activity.slug}`}
      className={'press-haptic block ' + (grid ? 'min-w-0' : 'shrink-0 snap-start w-[212px]')}
    >
      <div className="relative rounded-xl overflow-hidden">
        <ActivityCardImage
          images={activity.images}
          alt=""
          fallbackLabel={tag ?? labels.fallback}
          creditPrefix={labels.credit}
          aspectClass="aspect-square"
        />
        <span className="absolute left-2 top-2 rounded-md bg-white text-[#0a0a0c] px-[7px] py-1 text-[11.5px] font-extrabold">
          Ausflugsziel
        </span>
      </div>
      <h3 className="mt-2.5 mb-0.5 text-[14px] font-bold tracking-[-0.01em] leading-[1.3] text-[var(--v4-ink)] line-clamp-2">
        {activity.name}
      </h3>
      {meta && <p className="m-0 text-[12.5px] text-[var(--v4-ink-50)] truncate">{meta}</p>}
    </LocaleLink>
  );
}
