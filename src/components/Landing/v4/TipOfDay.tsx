/**
 * Tipp des Tages (fn-30.5, Mockup D `.tip`): genau ein Event, zwei Zeilen
 * hoch, Bild als LCP-Element mit `preload`.
 *
 * Kennzeichnung: bei `kind = 'sponsored'` steht „Anzeige" (§ 26 MedienG,
 * § 6 ECG) neben dem Label und der Sponsorname oben rechts; zweite Zeile
 * dann der Sponsorname, sonst der Veranstaltungsort, nie die Quelle. Der
 * Knopf führt zur Detailseite (die TicketBox dort trägt den Affiliate-
 * Link). Ohne Buchung (`auto`) wirbt eine kleine Zeile unten rechts für den
 * Boost-Platz (/fuer-firmen); sie steht neben dem Event-Link, nicht darin
 * (keine verschachtelten Links).
 */

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Link as LocaleLink } from '@/i18n/navigation';
import { EventImage } from '@/components/Events/EventImage';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { formatEventDate } from '@/lib/utils/event-time';
import { priceBadge } from '@/lib/v4/price-badge';
import type { LandingTip } from '@/lib/v4/landing-picks';
import type { Event } from '@/types/events';

type Translate = (key: string, values?: Record<string, string | number>) => string;

const FREE = '\u0000free';
const FROM = '\u0000from:';

/** Knopftext: „Tickets ab 29 €", „Tickets 29 €", „Eintritt frei", sonst „Zum Event". */
export function tipCtaLabel(event: Event, t: Translate, fmt = 'de-AT'): string {
  const badge = priceBadge(event, { free: FREE, from: p => FROM + p }, fmt);
  if (!badge) return t('toEvent');
  if (badge === FREE) return t('free');
  if (badge.startsWith(FROM)) return t('ticketsFrom', { price: badge.slice(FROM.length) });
  return t('tickets', { price: badge });
}

export function TipOfDay({ tip, className }: { tip: LandingTip; className?: string }) {
  const t = useTranslations('Landing.Tip');
  const locale = useLocale();
  const intl = locale === 'de' ? 'de-AT' : 'en-GB';
  const ev = tip.event;
  const sponsored = tip.kind === 'sponsored';
  const when = formatEventDate(ev, intl, { weekday: 'short', day: 'numeric', month: 'short' }).label;
  const place = (sponsored ? tip.sponsorName : null) ?? ev.location_name ?? null;
  const showBook = !sponsored;

  return (
    <article
      className={`relative overflow-hidden rounded-[18px] bg-[var(--v4-surface-elevated)] ${className ?? ''}`}
      data-testid="tip-of-day"
    >
      <Link
        href={buildEventUrlV2(ev)}
        className="press-haptic absolute inset-0 block"
        data-track="landing_tip_click"
        data-track-id={ev.id}
        data-track-kind={tip.kind}
      >
        <EventImage
          src={ev.image_url}
          category={ev.category}
          title={ev.title}
          bundesland={ev.bundesland}
          imageWidth={ev.image_width}
          sourceId={ev.source_id}
          alt=""
          wrapperClassName="absolute inset-0"
          sizes="(max-width: 1023px) 100vw, 480px"
          loading="eager"
          fetchPriority="high"
          preload
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05)_30%,rgba(5,5,6,0.96)_100%)]"
          aria-hidden="true"
        />

        <div className="absolute left-4 top-3.5 flex items-center gap-1.5">
          <b className="rounded-md bg-[var(--v4-ticket)] px-2 py-1 text-[11.5px] font-extrabold text-[#0a0a0c]">
            {t('label')}
          </b>
          {sponsored && (
            <span className="rounded-md bg-[rgba(10,10,12,0.55)] px-2 py-1 text-[11px] text-white/75 backdrop-blur-[6px]">
              {t('ad')}
            </span>
          )}
        </div>
        {sponsored && tip.sponsorName && (
          <span className="absolute right-4 top-3.5 max-w-[45%] truncate text-[11.5px] text-white/70">
            {tip.sponsorName}
          </span>
        )}

        <div className={`absolute left-5 right-5 ${showBook ? 'bottom-[44px]' : 'bottom-[18px]'}`}>
          <h2 className="m-0 line-clamp-3 text-[26px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white md:text-[34px]">
            {ev.title}
          </h2>
          <p className="mt-2 line-clamp-1 text-[14px] text-white/80">
            {place ? `${when} · ${place}` : when}
          </p>
          <div className="mt-3.5 flex items-center gap-3.5">
            <span className="whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-[13.5px] font-bold text-[#0a0a0c]">
              {tipCtaLabel(ev, t, intl)}
            </span>
          </div>
        </div>
      </Link>

      {showBook && (
        <LocaleLink
          href="/fuer-firmen"
          className="absolute bottom-3.5 right-5 max-w-[calc(100%-40px)] truncate text-[11.5px] text-white/70 hover:text-white"
          data-track="landing_tip_book"
        >
          {t('bookHint')}{' '}
          <span className="font-bold underline underline-offset-2">{t('book')}</span>
        </LocaleLink>
      )}
    </article>
  );
}
