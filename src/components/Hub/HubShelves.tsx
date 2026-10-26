/**
 * HubShelves: die Regale von /entdecken auf den SEO-Hubs (Bundesland,
 * Gemeinde, Stadt, Thema, Studenten; 2026-10-26).
 *
 *   Top-Picks → „Heute Abend" → „Dieses Wochenende" → [Seiten-Regal, z. B.
 *   „Nach Region"] → Kategorie-Regale → „Gratis" → Kategorie-Chips.
 *
 * Server-Komponente: die Auswahl rechnet planShelves auf den Events, die
 * die Seite ohnehin geladen hat, die Karten kommen als fertiges HTML aus
 * dem ISR-Cache. „Alle anzeigen" ist ein echter Link auf die passende
 * Unterseite, damit die Regale auch interne Links für Google sind.
 * Ein Regal mit weniger als MIN_SHELF Karten entfällt, Top-Picks nur mit
 * fünf Bildern; kleine Gemeinden zeigen dann nur das Raster darunter.
 */

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Event } from '@/types/events';
import { categoryLabel } from '@/lib/i18n/category-labels';
import { EVENT_TZ, toViennaDate, viennaDayStart, viennaToday } from '@/lib/utils/event-time';
import { planShelves } from '@/components/Discover/v4/shelves-select';
import { PICKS_GRID_CLASS, PickTile, Shelf, ShelfCard, ShelfChip } from '@/components/Discover/v4/shelf-ui';

export const MIN_SHELF = 3;
const PICKS = 5;

export interface HubShelfLinks {
  tonight?: string;
  weekend?: string;
  free?: string;
  /** Ziel für „Alle anzeigen" eines Kategorie-Regals und der Chips. */
  category?: (category: string) => string | undefined;
}

export interface HubShelvesProps {
  /** Kandidaten aller Regale (Zukunft, mit Anzeige-Feldern). */
  events: Event[];
  links?: HubShelfLinks;
  /** Regale, die auf dieser Seite nichts Neues zeigen (z. B. „Heute Abend" auf /wien/heute). */
  hide?: Partial<Record<'picks' | 'tonight' | 'weekend' | 'categories' | 'free' | 'chips', boolean>>;
  /** Seiteneigenes Regal nach dem Wochenende, z. B. Bundesland-Kacheln. */
  extra?: ReactNode;
  /** Bezugstag (Wien) für Tests; sonst heute. */
  today?: string;
}

export function HubShelves({ events, links = {}, hide = {}, extra, today = viennaToday() }: HubShelvesProps) {
  const t = useTranslations('Discover');
  const tCat = useTranslations('Categories');
  const locale = useLocale();
  const fmt = locale === 'de' ? 'de-AT' : 'en-GB';
  const plan = planShelves(events, today);

  // Top-Picks: zuerst heute/morgen, dann der Rest nach Score, nur mit Bild.
  const picks: Event[] = [];
  if (!hide.picks) {
    const seen = new Set<string>();
    const byScore = [...events].sort((a, b) => (b.event_score ?? 0) - (a.event_score ?? 0));
    for (const e of [...plan.picksPool, ...byScore]) {
      if (picks.length === PICKS) break;
      if (seen.has(e.id) || !e.image_url || !e.start_date) continue;
      if (toViennaDate(new Date(e.start_date)) < today) continue;
      seen.add(e.id);
      picks.push(e);
    }
  }
  const showPicks = picks.length === PICKS;
  const pickIds = new Set(showPicks ? picks.map((e) => e.id) : []);
  const tonight = plan.tonight.filter((e) => !pickIds.has(e.id));

  const dayLabel = (day: string) =>
    viennaDayStart(day).toLocaleDateString(fmt, { weekday: 'short', day: 'numeric', month: 'short', timeZone: EVENT_TZ });
  const cards = (list: Event[]) => list.map((e) => <ShelfCard key={e.id} ev={e} />);
  // Ohne Zähler: der Pool ist gekappt, seine Zahlen wären nicht der Bestand.
  const chips = plan.categoryCounts.filter((c) => links.category?.(c.category));

  return (
    <div className="mb-10">
      {showPicks && (
        <section aria-label={t('picksAria')} className={PICKS_GRID_CLASS}>
          {picks.map((e, i) => <PickTile key={e.id} ev={e} big={i === 0} />)}
        </section>
      )}

      {!hide.tonight && tonight.length >= MIN_SHELF && (
        <Shelf title={t('shelfTonight')} allHref={links.tonight}>
          {cards(tonight)}
        </Shelf>
      )}

      {!hide.weekend && plan.weekend.length >= MIN_SHELF && (
        <Shelf
          title={t('shelfWeekend')}
          sub={plan.weekendFrom === plan.weekendTo ? dayLabel(plan.weekendFrom) : t('dayRange', { from: dayLabel(plan.weekendFrom), to: dayLabel(plan.weekendTo) })}
          allHref={links.weekend}
        >
          {cards(plan.weekend)}
        </Shelf>
      )}

      {extra}

      {!hide.categories && plan.categories
        .filter((c) => c.events.length >= MIN_SHELF)
        .map((c) => (
          <Shelf key={c.category} title={categoryLabel(tCat, c.category)} allHref={links.category?.(c.category)}>
            {cards(c.events)}
          </Shelf>
        ))}

      {!hide.free && plan.free.length >= MIN_SHELF && (
        <Shelf title={t('shelfFree')} allHref={links.free}>
          {cards(plan.free)}
        </Shelf>
      )}

      {!hide.chips && chips.length > 1 && (
        <Shelf title={t('shelfCategories')}>
          {chips.map((c) => (
            <ShelfChip key={c.category} label={categoryLabel(tCat, c.category)} href={links.category?.(c.category)} />
          ))}
        </Shelf>
      )}
    </div>
  );
}
