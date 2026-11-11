/**
 * Saison-Karte der Bühne (fn-30.5, Mockup D `.sea`). Zeigt, was gerade
 * Saison hat: erst die im Admin gepinnten Events (/admin/boost, Tabelle
 * landing_features, `kind = 'editorial'`), dann die stündlich rotierende
 * Auswahl aus getLandingData(). Sechs Picks, die Liste füllt die Karte
 * (space-evenly), Titel und Zeile mit Ellipsis (min-width 0), das
 * „Tipp"-Badge nur für editorial-Pins (`featured`). Die Wetterzeile kommt
 * client-seitig dazu (SeasonWeather), der Rest ist statisches HTML.
 */

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Link as LocaleLink } from '@/i18n/navigation';
import { EventImage } from '@/components/Events/EventImage';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { formatEventDate } from '@/lib/utils/event-time';
import type { LandingSeason } from '@/lib/v4/get-landing-data';
import { SeasonWeather } from './SeasonWeather';

export function SeasonCard({ season, className }: { season: LandingSeason; className?: string }) {
  const t = useTranslations('Landing.Season');
  const locale = useLocale();
  const intl = locale === 'de' ? 'de-AT' : 'en-GB';

  return (
    <aside
      className={`flex min-h-0 flex-col rounded-[18px] border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] px-3.5 pb-3 pt-4 ${className ?? ''}`}
      data-testid="season-card"
    >
      <div className="flex flex-col gap-1">
        <p className="m-0 text-[11.5px] font-bold text-[var(--v4-match)]">
          {t(`${season.seasonId}.kicker`)}
        </p>
        <h2 className="m-0 text-[19px] font-extrabold leading-[1.15] tracking-[-0.025em] text-[var(--v4-ink)]">
          {t(`${season.seasonId}.title`)}
        </h2>
        <SeasonWeather/>
      </div>

      {season.picks.length > 0 && (
        <ul className="mt-1.5 flex min-h-0 flex-1 flex-col justify-evenly">
          {season.picks.map(ev => {
            const { date, time } = formatEventDate(ev, intl, { weekday: 'short', day: 'numeric', month: 'short' });
            const meta = [time ? `${date} · ${time}` : date, ev.location_name].filter(Boolean).join(' · ');
            return (
              <li key={ev.id} className="min-w-0">
                <Link
                  href={buildEventUrlV2(ev)}
                  className="press-haptic -mx-1.5 grid grid-cols-[46px_minmax(0,1fr)] items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 transition-colors hover:bg-[var(--v4-hairline-1)]"
                  data-track={ev.featured ? 'landing_season_featured' : 'landing_season_pick'}
                  data-track-id={ev.id}
                >
                  <div className="relative h-[46px] w-[46px] flex-shrink-0 overflow-hidden rounded-[9px] bg-[var(--v4-surface)]">
                    <EventImage
                      src={ev.image_url}
                      category={ev.category}
                      title={ev.title}
                      bundesland={ev.bundesland}
                      imageWidth={ev.image_width}
                      alt={ev.title}
                      wrapperClassName="absolute inset-0"
                      sizes="46px"
                    />
                  </div>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-bold leading-[1.25] text-[var(--v4-ink)]" data-testid="season-pick-title">
                      {ev.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-[var(--v4-ink-50)]">
                      {ev.featured && (
                        <em className="mr-1.5 not-italic font-bold text-[var(--v4-match)]" data-testid="season-featured">
                          {t('featured')}
                        </em>
                      )}
                      {meta}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <LocaleLink
        href={`/entdecken?saison=${season.seasonId}`}
        className="inline-flex items-center gap-1 pt-2.5 text-[13px] font-bold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]"
        data-track="landing_season_more"
      >
        {t(`${season.seasonId}.more`)}
        <span aria-hidden="true">›</span>
      </LocaleLink>
    </aside>
  );
}
