'use client';

/**
 * V4ActivityResultCard — Ergebniskarte für einen Freizeit-POI im Block
 * "Passende Aktivitäten" der Smart-Suche (fn-18.6).
 *
 * Bewusst visuell abgegrenzt von den Event-Karten (Typ-Badge
 * "Aktivität" + Indoor/Outdoor-Hinweis, kein Datum), weil POIs dauerhaft
 * existieren und kein Termin dranhängt. Datenshape: ActivitySearchMatch
 * (Subset von PublicActivity, src/lib/activities/public-types.ts) — kein
 * eigener Aktivitäts-Typ.
 */

import Link from 'next/link';
import type { ActivitySearchMatch } from '@/lib/activities/public-types';
import { activityTagLabel } from '@/lib/activities/tag-labels';

const SETTING_LABEL: Record<'indoor' | 'outdoor' | 'mixed', string> = {
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  mixed: 'Indoor & Outdoor',
};

function firstImageUrl(images: ActivitySearchMatch['images']): string | null {
  if (!Array.isArray(images)) return null;
  for (const img of images) {
    const url = img?.urls?.[0];
    if (typeof url === 'string' && url.length > 0) return url;
  }
  return null;
}

export function V4ActivityResultCard({ activity }: { activity: ActivitySearchMatch }) {
  const image = firstImageUrl(activity.images);
  const place = [activity.town, activity.bundesland].filter(Boolean).join(' · ');
  const tagLabels = activity.tags.slice(0, 2).map(activityTagLabel);

  return (
    <Link
      href={`/aktivitaet/${activity.slug}`}
      data-track="smart_result_click"
      data-track-id={activity.id}
      data-track-provider="activity"
      className="press-haptic flex flex-col rounded-2xl overflow-hidden border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] hover:border-[var(--v4-hairline-3)] transition-colors"
    >
      <div
        className="w-full aspect-[16/9] relative overflow-hidden"
        style={image ? undefined : { background: 'linear-gradient(135deg, #22c55e, #15803d)' }}
      >
        {image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy"/>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-[0.12em] font-bold text-white/90 text-center px-3 leading-tight">
            Freizeit
          </span>
        )}
        <span className="absolute top-2 left-2 px-2 py-1 rounded-full text-[9.5px] uppercase tracking-[0.16em] font-bold bg-[rgba(10,10,12,0.72)] text-white">
          Aktivität
        </span>
      </div>
      <div className="p-4 flex flex-col gap-2">
        <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">
          {activity.setting ? SETTING_LABEL[activity.setting] : 'Ganzjährig'}
          {activity.distance_km !== null && ` · ${activity.distance_km.toFixed(0)} km`}
        </p>
        <h3 className="text-[15px] font-semibold leading-tight text-[var(--v4-ink)] line-clamp-2">
          {activity.name}
        </h3>
        {place && <p className="text-[12.5px] text-[var(--v4-ink-70)] line-clamp-1">{place}</p>}
        {activity.description_short && (
          <p className="text-[12px] text-[var(--v4-ink-50)] line-clamp-2">{activity.description_short}</p>
        )}
        {tagLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tagLabels.map(t => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full text-[10.5px] text-[var(--v4-ink-70)] border border-[var(--v4-hairline-2)]"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <p className="text-[10.5px] text-[var(--v4-ink-30)] mt-auto">
          Relevanz {(activity._similarity * 100).toFixed(0)}%
        </p>
      </div>
    </Link>
  );
}
