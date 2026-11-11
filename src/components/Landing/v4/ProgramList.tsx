/**
 * „Heute Abend" (fn-30.6, Mockup D `.prog`): Programmliste der Events des
 * heutigen Wiener Tags ab 17:00, nach Uhrzeit. Desktop zwei Spalten, je
 * Zeile Uhrzeit (tabular-nums), 46-px-Bild, Titel, Ort, Preis.
 *
 * Server-Komponente: die Zeilen entstehen hier (EventImage löst das Bild
 * serverseitig auf) und gehen fertig an die Client-Insel
 * `ProgramListIsland`, die abgelaufene Zeilen ausblendet und den Abschnitt
 * bei leer entfernt.
 */

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { EventImage } from '@/components/Events/EventImage';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { districtDisplayName } from '@/lib/districtsAT';
import { decodeEntities } from '@/lib/utils/decode-entities';
import { formatEventDate } from '@/lib/utils/event-time';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { priceBadge } from '@/lib/v4/price-badge';
import type { Event } from '@/types/events';
import { ProgramListIsland } from './ProgramListIsland';

const FREE = '\u0000free';

function ProgramRow({ ev }: { ev: Event }) {
  const t = useTranslations('Discover');
  const tMap = useTranslations('MapPage');
  const locale = useLocale();
  const intl = locale === 'de' ? 'de-AT' : 'en-GB';
  const { time } = formatEventDate(ev, intl);
  const badge = priceBadge(ev, { free: FREE, from: p => tMap('priceFrom', { price: p }) }, intl);
  const free = badge === FREE;
  const region = ev.district
    ? districtDisplayName(ev.district)
    : ev.bundesland
      ? bundeslandDisplayName(ev.bundesland, locale)
      : '';
  const place = [ev.location_name, region].filter(Boolean).join(' · ');

  return (
    <Link
      href={buildEventUrlV2(ev)}
      className="press-haptic grid grid-cols-[44px_46px_minmax(0,1fr)_auto] items-center gap-3 py-[9px]"
      data-track="landing_program_click"
      data-track-id={ev.id}
      data-testid="program-row"
    >
      <span className="text-[13px] font-bold tabular-nums text-[var(--v4-ink-70)]">{time}</span>
      <EventImage
        src={ev.image_url}
        category={ev.category}
        title={ev.title}
        bundesland={ev.bundesland}
        imageWidth={ev.image_width}
        sourceId={ev.source_id}
        alt=""
        wrapperClassName="relative h-[46px] w-[46px] shrink-0 overflow-hidden rounded-lg"
        sizes="46px"
      />
      <span className="min-w-0">
        <b className="block truncate text-[14px] font-bold tracking-[-0.01em] text-[var(--v4-ink)]">
          {decodeEntities(ev.title ?? '')}
        </b>
        <small className="block truncate text-[12px] text-[var(--v4-ink-50)]">{place}</small>
      </span>
      <span className={`whitespace-nowrap text-[12.5px] font-bold ${free ? 'text-[var(--v4-go)]' : 'text-[var(--v4-ink-70)]'}`}>
        {free ? t('chipFree') : badge ?? ''}
      </span>
    </Link>
  );
}

export function ProgramList({ events, today }: { events: Event[]; today: string }) {
  if (events.length === 0) return null;
  const items = events.map(ev => ({ id: ev.id, start: ev.start_date, node: <ProgramRow key={ev.id} ev={ev}/> }));
  return <ProgramListIsland today={today} items={items}/>;
}
