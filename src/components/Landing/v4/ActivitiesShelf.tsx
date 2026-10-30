'use client';

/**
 * Freizeit-Regal der Tagesausgabe (fn-30.6, Mockup D `.act`): acht
 * Indoor-Aktivitäten aus ganz Österreich (Auswahl in getLandingData), Foto
 * mit Bildnachweis über `ActivityCardImage`, Kategorie-Badge aus dem ersten
 * Tag. Der Titel folgt dem Wetter heute in Wien: ab 3 mm Regen „Bei Regen",
 * sonst „Ausflug unter Dach"; die Karten bleiben dieselben, damit nichts
 * springt. Keine Standort-Nähe mehr, die gibt es auf /aktivitaeten.
 */

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Shelf } from '@/components/Discover/v4/shelf-ui';
import { ActivityCardImage } from '@/components/Activities/ActivityCardImage';
import { activityTagLabel } from '@/lib/activities/tag-labels';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { loadTodayWeather, RAIN_MM } from '@/lib/landing/weekend-weather';
import type { LandingActivity } from '@/lib/v4/get-landing-data';

export const ACTIVITIES_HREF = '/aktivitaeten?setting=indoor';

export function ActivitiesShelf({ activities }: { activities: LandingActivity[] }) {
  const t = useTranslations('Landing.Activities');
  const locale = useLocale();
  const [rain, setRain] = useState(false);

  useEffect(() => {
    let alive = true;
    loadTodayWeather().then(w => { if (alive && w) setRain(w.precipMm >= RAIN_MM); });
    return () => { alive = false; };
  }, []);

  if (activities.length === 0) return null;

  return (
    <div data-testid="activities-shelf">
      <Shelf title={rain ? t('rainTitle') : t('title')} sub={t('sub')} allHref={ACTIVITIES_HREF} allLabel={t('all')}>
        {activities.map(a => {
          const tag = a.tags?.[0];
          const label = tag ? activityTagLabel(tag, locale) : t('cardFallback');
          const place = [a.town, a.bundesland ? bundeslandDisplayName(a.bundesland, locale) : null].filter(Boolean).join(' · ');
          return (
            <Link
              key={a.id}
              href={`/aktivitaet/${a.slug}`}
              className="press-haptic block w-[164px] shrink-0 snap-start md:w-[212px]"
              data-track="landing_activity_click"
              data-track-id={a.id}
            >
              <div className="relative overflow-hidden rounded-xl">
                <ActivityCardImage images={a.images} alt="" fallbackLabel={label} creditPrefix={t('imageCredit')} aspectClass="aspect-[4/3]"/>
                {tag && (
                  <span className="absolute left-2 top-2 rounded-md bg-white px-[7px] py-1 text-[11.5px] font-extrabold text-[#0a0a0c]">
                    {label}
                  </span>
                )}
              </div>
              <h3 className="mb-0.5 mt-2.5 line-clamp-2 text-[14px] font-bold leading-[1.3] tracking-[-0.01em] text-[var(--v4-ink)]">{a.name}</h3>
              <p className="m-0 truncate text-[12.5px] text-[var(--v4-ink-50)]">{place}</p>
            </Link>
          );
        })}
      </Shelf>
    </div>
  );
}
