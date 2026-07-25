/**
 * Fakten-Block der Aktivitaets-Detailseite (fn-18 Task 3): Saison-/
 * Oeffnungszeiten (nur normalisiertes opening_times-Feld, E8),
 * Preis-Hinweis, Online-Buchbarkeit, Indoor/Outdoor, Gemeinde-Link und
 * Quellen-Attribution (Pflicht, analog Event-Detail).
 *
 * Server-Komponente — Labels kommen via getTranslations('Activity');
 * die Seite setzt setRequestLocale, damit der ISR-Pass statisch bleibt.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { NormalizedOpeningWindow } from '@/lib/activities/opening';
import type { PublicActivity } from '@/lib/activities/public-types';
import { WEEKDAY_BITS } from '@/lib/activities/opening';

const WEEKDAY_LABELS: ReadonlyArray<{ bit: number; label: string }> = [
  { bit: WEEKDAY_BITS.mo, label: 'Mo' },
  { bit: WEEKDAY_BITS.di, label: 'Di' },
  { bit: WEEKDAY_BITS.mi, label: 'Mi' },
  { bit: WEEKDAY_BITS.do, label: 'Do' },
  { bit: WEEKDAY_BITS.fr, label: 'Fr' },
  { bit: WEEKDAY_BITS.sa, label: 'Sa' },
  { bit: WEEKDAY_BITS.so, label: 'So' },
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function formatWeekdays(mask: number | null, allDaysLabel: string): string {
  if (mask == null) return allDaysLabel;
  const labels = WEEKDAY_LABELS.filter((w) => (mask & w.bit) !== 0).map((w) => w.label);
  return labels.length > 0 ? labels.join(', ') : allDaysLabel;
}

function formatWindow(w: NormalizedOpeningWindow, allDaysLabel: string, openEndLabel: string) {
  const season =
    w.from === w.to ? formatDate(w.from) : `${formatDate(w.from)} – ${formatDate(w.to)}`;
  const time =
    w.timeFrom === '00:00' && w.timeTo === '00:00'
      ? openEndLabel
      : `${w.timeFrom}–${w.timeTo}`;
  return { season, days: formatWeekdays(w.weekdays, allDaysLabel), time };
}

interface ActivityFactsProps {
  activity: PublicActivity;
  /** Anzeige-Name der Gemeinde (aus der Registry), null wenn unbekannt. */
  gemeindeName: string | null;
}

export async function ActivityFacts({ activity, gemeindeName }: ActivityFactsProps) {
  const t = await getTranslations('Activity');

  const windows = activity.opening_times ?? [];
  const settingLabel =
    activity.setting === 'indoor'
      ? t('settingIndoor')
      : activity.setting === 'outdoor'
        ? t('settingOutdoor')
        : activity.setting === 'mixed'
          ? t('settingMixed')
          : null;

  return (
    <section className="max-w-4xl mx-auto px-6 mt-10 grid gap-8 md:grid-cols-[2fr_1fr]">
      <div className="space-y-8 min-w-0">
        {/* Beschreibung */}
        {(activity.description || activity.description_short) && (
          <div>
            <p className="text-white/70 leading-relaxed whitespace-pre-line">
              {activity.description ?? activity.description_short}
            </p>
          </div>
        )}

        {/* Oeffnungszeiten / Saison */}
        {windows.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">{t('openingTimes')}</h2>
            <ul className="space-y-2">
              {windows.map((w, i) => {
                const f = formatWindow(w, t('allDays'), t('openEnd'));
                return (
                  <li
                    key={`${w.from}-${w.to}-${w.timeFrom}-${w.timeTo}-${w.weekdays ?? 'all'}-${i}`}
                    className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-white/60 bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-2.5"
                  >
                    <span className="text-white/80">{f.season}</span>
                    <span>{f.days}</span>
                    <span className="text-white/80">{f.time}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        {/* Kurzfakten */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4 space-y-3 text-sm">
          {activity.price_hint && (
            <div>
              <div className="text-white/40 text-xs mb-0.5">{t('price')}</div>
              <div className="text-white/80">{activity.price_hint}</div>
            </div>
          )}
          {settingLabel && (
            <div>
              <div className="text-white/40 text-xs mb-0.5">{t('setting')}</div>
              <div className="text-white/80">{settingLabel}</div>
            </div>
          )}
          {activity.online_bookable && (
            <div className="text-emerald-400">{t('onlineBookable')}</div>
          )}
          {activity.gemeinde_slug && gemeindeName && (
            <div>
              <div className="text-white/40 text-xs mb-0.5">{t('region')}</div>
              <Link
                href={`/gemeinde/${activity.gemeinde_slug}`}
                className="text-white/80 underline underline-offset-2 hover:text-white transition-colors"
              >
                {gemeindeName}
              </Link>
            </div>
          )}
        </div>

        {/* Quellen-Attribution (Pflicht) */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4 text-xs text-white/40 leading-relaxed">
          {t('source')}:{' '}
          <a
            href="https://www.feratel.at/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white transition-colors underline underline-offset-2"
          >
            Feratel Deskline
          </a>
          {' · '}
          <Link href="/quellen" className="hover:text-white/60 transition-colors underline underline-offset-2">
            {t('allSources')}
          </Link>
        </div>
      </aside>
    </section>
  );
}
