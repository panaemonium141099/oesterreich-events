/**
 * Saison-Karte im Landing-Hero (ersetzt 2026-09-24 die drei
 * Anleitungs-Karten). Zeigt, was gerade Saison hat: erst die im Admin
 * gepinnten Events (/admin/boost, Tabelle landing_features), dann die
 * stündlich rotierende Auswahl aus getLandingData(). Die Wetterzeile
 * kommt client-seitig dazu (SeasonWeather), der Rest ist statisches HTML.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Link as LocaleLink } from '@/i18n/navigation';
import { EventImage } from '@/components/Events/EventImage';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { formatEventDate } from '@/lib/utils/event-time';
import type { LandingSeason } from '@/lib/v4/get-landing-data';
import { SeasonWeather } from './SeasonWeather';

function shortDate(iso: string): string {
  return formatEventDate({ start_date: iso }, 'de-AT', {
    weekday: 'short', day: 'numeric', month: 'short',
  }).label;
}

export function SeasonCard({ season }: { season: LandingSeason }) {
  const t = useTranslations('Landing.Season');

  return (
    <div
      className="rounded-3xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] p-4 md:p-5"
      data-testid="season-card"
    >
      <div className="mb-3.5 flex flex-col gap-1.5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)]">
          {t(`${season.seasonId}.kicker`)}
        </p>
        <h2 className="text-[20px] md:text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--v4-ink)]">
          {t(`${season.seasonId}.title`)}
        </h2>
        <SeasonWeather/>
      </div>

      {season.picks.length > 0 && (
        <ul className="flex flex-col gap-2">
          {season.picks.map(ev => (
            <li key={ev.id}>
              <Link
                href={buildEventUrlV2(ev)}
                className="press-haptic flex items-center gap-3 rounded-2xl p-2 -mx-2 hover:bg-[var(--v4-hairline-1)] transition-colors"
                data-track={ev.featured ? 'landing_season_featured' : 'landing_season_pick'}
                data-track-id={ev.id}
              >
                <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-[var(--v4-surface)] flex-shrink-0">
                  <EventImage
                    src={ev.image_url}
                    category={ev.category}
                    title={ev.title}
                    bundesland={ev.bundesland}
                    imageWidth={ev.image_width}
                    alt={ev.title}
                    wrapperClassName="absolute inset-0"
                    sizes="56px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--v4-ink-50)]">
                    {shortDate(ev.start_date)}
                    {ev.featured && (
                      <span className="ml-2 rounded-full bg-[rgba(245,185,66,0.14)] px-1.5 py-0.5 text-[9.5px] tracking-[0.12em] text-[var(--v4-match)]">
                        {t('featured')}
                      </span>
                    )}
                  </p>
                  <h3 className="text-[14px] font-semibold leading-snug text-[var(--v4-ink)] line-clamp-1">
                    {ev.title}
                  </h3>
                  {ev.location_name && (
                    <p className="text-[12px] text-[var(--v4-ink-70)] line-clamp-1">{ev.location_name}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <LocaleLink
        href={`/entdecken?search=${encodeURIComponent(season.moreQuery)}`}
        className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]"
        data-track="landing_season_more"
      >
        {t(`${season.seasonId}.more`)}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
      </LocaleLink>
    </div>
  );
}
