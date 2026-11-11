/**
 * Regale der Tagesausgabe (fn-30.6): „Dieses Wochenende", „Dorffeste" und
 * „Nach Region" mit den Bausteinen von /entdecken (`Shelf`, `ShelfCard`, `RegionTile`),
 * damit Startseite und Entdecken-Seite gleich aussehen. Server-Komponenten;
 * die Regal-Bausteine sind Client-Komponenten und rendern im Server-HTML.
 */

import { useLocale, useTranslations } from 'next-intl';
import { RegionTile, Shelf, ShelfCard } from '@/components/Discover/v4/shelf-ui';
import { BUNDESLAENDER } from '@/lib/bundeslaender';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { shortViennaDay } from '@/lib/landing/day-labels';
import { DORFFESTE_DAYS, DORFFESTE_HREF } from '@/lib/landing/dorffeste';
import type { Event } from '@/types/events';

/** Link auf die Liste eines Tagesbereichs. */
export function rangeHref(range: { from: string; to: string }): string {
  return `/entdecken?von=${range.from}&bis=${range.to}`;
}

export function WeekendShelf({ events, range }: { events: Event[]; range: { from: string; to: string } }) {
  const t = useTranslations('Landing.Shelves');
  const locale = useLocale();
  if (events.length === 0) return null;
  const sub = range.from === range.to
    ? shortViennaDay(range.from, locale)
    : t('range', { from: shortViennaDay(range.from, locale), to: shortViennaDay(range.to, locale) });
  return (
    <div data-testid="weekend-shelf">
      <Shelf title={t('weekend')} sub={sub} allHref={rangeHref(range)} allLabel={t('showAll')}>
        {events.map(ev => <ShelfCard key={ev.id} ev={ev}/>)}
      </Shelf>
    </div>
  );
}

/** Dorffeste der nächsten 30 Tage; Liste über /entdecken?thema=dorffeste. */
export function DorffesteShelf({ events }: { events: Event[] }) {
  const t = useTranslations('Landing.Shelves');
  if (events.length === 0) return null;
  return (
    <div data-testid="dorffeste-shelf">
      <Shelf title={t('dorffeste')} sub={t('dorffesteSub', { days: DORFFESTE_DAYS })} allHref={DORFFESTE_HREF} allLabel={t('showAll')}>
        {events.map(ev => <ShelfCard key={ev.id} ev={ev}/>)}
      </Shelf>
    </div>
  );
}

export function RegionShelf() {
  const t = useTranslations('Landing.Shelves');
  const locale = useLocale();
  return (
    <div data-testid="region-shelf">
      <Shelf title={t('region')}>
        {BUNDESLAENDER.filter(b => b.id !== 'all').map(b => (
          <RegionTile
            key={b.id}
            href={`/${b.id}`}
            name={bundeslandDisplayName(b.id, locale)}
            image={`/images/regions/${b.id}.jpg`}
          />
        ))}
      </Shelf>
    </div>
  );
}
