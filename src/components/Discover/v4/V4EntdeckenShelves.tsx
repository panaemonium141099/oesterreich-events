'use client';

/**
 * V4EntdeckenShelves: der kuratierte Einstieg auf /entdecken (Variante
 * „Regale", 2026-10-22, Vorbild Netflix/Airbnb).
 *
 *   Top-Picks (fünf Kacheln, eine groß) → „Heute Abend" → „Dieses
 *   Wochenende" → „Nach Region" (Bundesland-Kacheln) → drei Kategorie-
 *   Regale → „Gratis" → Kategorie-Chips.
 *
 * Datenquelle ist der Points-Snapshot der Liste (title=null); die
 * Auswahl rechnet shelves-select.ts, die Anzeige-Felder holt
 * useDetailHydration nur für die gezeigten Karten (24er-Chunks, Edge-
 * Cache wie in der Liste). Sichtbar nur ohne aktive Filter; „Alle
 * anzeigen" setzt den passenden Filter und blendet damit zur Liste um.
 */

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Event } from '@/types/events';
import { BUNDESLAENDER, bundeslandToId } from '@/lib/bundeslaender';
import { categoryLabel } from '@/lib/i18n/category-labels';
import { EVENT_TZ, viennaDayStart } from '@/lib/utils/event-time';
import { useDetailHydration } from '@/lib/v4/use-detail-hydration';
import { planShelves } from './shelves-select';
import { PICKS_GRID_CLASS, PickTile, RegionTile, Shelf, ShelfCard, ShelfChip } from './shelf-ui';

export type ShelfPreset = 'heute' | 'wochenende';

interface V4EntdeckenShelvesProps {
  events: Event[];
  loading: boolean;
  onPreset: (preset: ShelfPreset) => void;
  onCategory: (category: string) => void;
  onFree: () => void;
}

const PICKS = 5;

export function V4EntdeckenShelves({ events, loading, onPreset, onCategory, onFree }: V4EntdeckenShelvesProps) {
  const t = useTranslations('Discover');
  const tCat = useTranslations('Categories');
  const locale = useLocale();
  const fmt = locale === 'de' ? 'de-AT' : 'en-GB';

  const plan = useMemo(() => planShelves(events), [events]);

  // Eine Hydration für alle Regale, Picks zuerst (sie entscheiden das Layout).
  const union = useMemo(() => {
    const seen = new Set<string>();
    const out: Event[] = [];
    const push = (list: Event[]) => {
      for (const e of list) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        out.push(e);
      }
    };
    push(plan.picksPool);
    push(plan.tonight);
    push(plan.weekend);
    for (const c of plan.categories) push(c.events);
    push(plan.free);
    return out;
  }, [plan]);
  const hydrated = useDetailHydration(union);
  const byId = useMemo(() => new Map(hydrated.map((e) => [e.id, e])), [hydrated]);
  const h = (list: Event[]) => list.map((e) => byId.get(e.id) ?? e);

  // Top-Picks: die ersten fünf Kandidaten, die ein Bild haben. Solange die
  // Details fehlen, halten Platzhalter das Layout.
  const picksPool = h(plan.picksPool);
  const picks = picksPool.filter((e) => e.title != null && e.image_url).slice(0, PICKS);
  const picksPending = picksPool.some((e) => e.title == null) && picks.length < PICKS;
  const pickIds = new Set(picks.map((e) => e.id));
  const tonight = h(plan.tonight).filter((e) => !pickIds.has(e.id));

  const regionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      const id = bundeslandToId(e.bundesland);
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [events]);

  const dayLabel = (day: string) =>
    viennaDayStart(day).toLocaleDateString(fmt, { weekday: 'short', day: 'numeric', month: 'short', timeZone: EVENT_TZ });

  // Ohne Punkte gibt es nichts zu kuratieren; beim Laden zeigt die Liste
  // darunter ihre Skelette, leere Regale darüber wären nur Rauschen.
  if (events.length === 0) return null;

  return (
    <div className="mb-10">
      {/* Top-Picks */}
      {(picks.length > 0 || picksPending) && (
        <section aria-label={t('picksAria')} className={PICKS_GRID_CLASS}>
          {picks.map((e, i) => <PickTile key={e.id} ev={e} big={i === 0} />)}
          {picksPending && Array.from({ length: PICKS - picks.length }).map((_, i) => (
            <div
              key={`s${i}`}
              className={'rounded-2xl bg-[var(--v4-surface-elevated)] animate-pulse ' + (picks.length + i === 0 ? 'col-span-2 md:col-span-1 md:row-span-2' : '')}
            />
          ))}
        </section>
      )}

      <Shelf
        title={t('shelfTonight')}
        sub={t('nEvents', { count: plan.tonightCount.toLocaleString(fmt) })}
        onAll={() => onPreset('heute')}
        allLabel={t('showAll')}
      >
        {tonight.map((e) => <ShelfCard key={e.id} ev={e} />)}
      </Shelf>

      <Shelf
        title={t('shelfWeekend')}
        sub={plan.weekendFrom === plan.weekendTo ? dayLabel(plan.weekendFrom) : t('dayRange', { from: dayLabel(plan.weekendFrom), to: dayLabel(plan.weekendTo) })}
        onAll={() => onPreset('wochenende')}
        allLabel={t('showAll')}
      >
        {h(plan.weekend).map((e) => <ShelfCard key={e.id} ev={e} />)}
      </Shelf>

      <Shelf title={t('shelfRegion')}>
        {BUNDESLAENDER.filter((b) => b.id !== 'all').map((b) => (
          <RegionTile key={b.id} href={`/${b.id}`} name={b.name} image={`/images/regions/${b.id}.jpg`} count={regionCounts.get(b.id)} />
        ))}
      </Shelf>

      {plan.categories.map((c) => (
        <Shelf
          key={c.category}
          title={categoryLabel(tCat, c.category)}
          onAll={() => onCategory(c.category)}
          allLabel={t('showAll')}
        >
          {h(c.events).map((e) => <ShelfCard key={e.id} ev={e} />)}
        </Shelf>
      ))}

      {plan.free.length > 0 && (
        <Shelf title={t('shelfFree')} onAll={onFree} allLabel={t('showAll')}>
          {h(plan.free).map((e) => <ShelfCard key={e.id} ev={e} />)}
        </Shelf>
      )}

      {plan.categoryCounts.length > 0 && (
        <Shelf title={t('shelfCategories')}>
          {plan.categoryCounts.map((c) => (
            <ShelfChip key={c.category} label={categoryLabel(tCat, c.category)} count={c.count} onClick={() => onCategory(c.category)} />
          ))}
        </Shelf>
      )}
    </div>
  );
}
