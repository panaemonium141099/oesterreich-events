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

import { useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Event } from '@/types/events';
import { BUNDESLAENDER, bundeslandToId } from '@/lib/bundeslaender';
import { categoryLabel } from '@/lib/i18n/category-labels';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { districtDisplayName } from '@/lib/districtsAT';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { decodeEntities } from '@/lib/utils/decode-entities';
import { formatTime } from '@/lib/utils/date';
import { EVENT_TZ, addViennaDays, toViennaDate, viennaDayStart, viennaToday } from '@/lib/utils/event-time';
import { useDetailHydration } from '@/lib/v4/use-detail-hydration';
import { priceBadge } from '@/lib/v4/price-badge';
import { gradientFor } from './category-gradient';
import { planShelves } from './shelves-select';

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
        <section aria-label={t('picksAria')} className="grid gap-3 mb-2 grid-cols-2 [grid-template-rows:260px_160px] md:grid-cols-[2fr_1fr_1fr] md:[grid-template-rows:220px_220px]">
          {picks.map((e, i) => <PickTile key={e.id} ev={e} big={i === 0} fmt={fmt} />)}
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
        {tonight.map((e) => <ShelfCard key={e.id} ev={e} fmt={fmt} />)}
      </Shelf>

      <Shelf
        title={t('shelfWeekend')}
        sub={plan.weekendFrom === plan.weekendTo ? dayLabel(plan.weekendFrom) : t('dayRange', { from: dayLabel(plan.weekendFrom), to: dayLabel(plan.weekendTo) })}
        onAll={() => onPreset('wochenende')}
        allLabel={t('showAll')}
      >
        {h(plan.weekend).map((e) => <ShelfCard key={e.id} ev={e} fmt={fmt} />)}
      </Shelf>

      <Shelf title={t('shelfRegion')}>
        {BUNDESLAENDER.filter((b) => b.id !== 'all').map((b) => (
          <Link
            key={b.id}
            href={`/${b.id}`}
            className="press-haptic relative shrink-0 snap-start w-[150px] h-[96px] rounded-xl overflow-hidden bg-[var(--v4-surface-elevated)]"
          >
            <Image src={`/images/regions/${b.id}.jpg`} alt="" fill sizes="150px" className="object-cover opacity-75" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-[#050506]/85" />
            <b className="absolute left-3 bottom-2.5 text-[14px] font-extrabold tracking-[-0.01em] text-white">{b.name}</b>
            {regionCounts.has(b.id) && (
              <span className="absolute right-2.5 bottom-[11px] text-[11px] font-semibold text-white/70">
                {(regionCounts.get(b.id) ?? 0).toLocaleString(fmt)}
              </span>
            )}
          </Link>
        ))}
      </Shelf>

      {plan.categories.map((c) => (
        <Shelf
          key={c.category}
          title={categoryLabel(tCat, c.category)}
          onAll={() => onCategory(c.category)}
          allLabel={t('showAll')}
        >
          {h(c.events).map((e) => <ShelfCard key={e.id} ev={e} fmt={fmt} />)}
        </Shelf>
      ))}

      {plan.free.length > 0 && (
        <Shelf title={t('shelfFree')} onAll={onFree} allLabel={t('showAll')}>
          {h(plan.free).map((e) => <ShelfCard key={e.id} ev={e} fmt={fmt} />)}
        </Shelf>
      )}

      {plan.categoryCounts.length > 0 && (
        <Shelf title={t('shelfCategories')}>
          {plan.categoryCounts.map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() => onCategory(c.category)}
              className="press-haptic shrink-0 snap-start rounded-full bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-4)] px-4 py-2.5 text-[13px] font-semibold text-[var(--v4-ink)] transition-colors"
            >
              {categoryLabel(tCat, c.category)}
              <span className="ml-2 text-[var(--v4-ink-50)] font-medium">{c.count.toLocaleString(fmt)}</span>
            </button>
          ))}
        </Shelf>
      )}
    </div>
  );
}

/* ─── Regal mit horizontaler Spur ──────────────────────────────────────── */

function Shelf({ title, sub, onAll, allLabel, children }: {
  title: string;
  sub?: string;
  onAll?: () => void;
  allLabel?: string;
  children: ReactNode;
}) {
  const t = useTranslations('Discover');
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  return (
    <section className="mt-9">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="m-0 text-[21px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">{title}</h2>
        {sub && <span className="hidden md:inline text-[13.5px] text-[var(--v4-ink-50)]">{sub}</span>}
        {onAll && (
          <button type="button" onClick={onAll} className="press-haptic ml-auto text-[13px] font-bold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]">
            {allLabel}
          </button>
        )}
        <div className={'hidden md:flex gap-1 ' + (onAll ? '' : 'ml-auto')}>
          <button type="button" aria-label={t('scrollBack')} onClick={() => scroll(-1)} className="w-[30px] h-[30px] rounded-full border border-[var(--v4-hairline-3)] grid place-items-center text-[13px] text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]">‹</button>
          <button type="button" aria-label={t('scrollForward')} onClick={() => scroll(1)} className="w-[30px] h-[30px] rounded-full border border-[var(--v4-hairline-3)] grid place-items-center text-[13px] text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]">›</button>
        </div>
      </div>
      <div
        ref={track}
        className="flex gap-3.5 overflow-x-auto thin-scroll snap-x -mx-4 px-4 md:-mx-14 md:px-14 pb-1.5 [scroll-padding-left:16px] md:[scroll-padding-left:56px]"
      >
        {children}
      </div>
    </section>
  );
}

/* ─── Karten ───────────────────────────────────────────────────────────── */

/** „Do 22. Okt." (de) bzw. „Thu 22 Oct" (en) für das Karten-Badge. */
function shortDay(d: Date, fmt: string): string {
  const parts = new Intl.DateTimeFormat(fmt, { weekday: 'short', day: 'numeric', month: 'short', timeZone: EVENT_TZ }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = get('weekday').replace(/\.$/, '');
  const month = get('month');
  return fmt.startsWith('de') ? `${weekday} ${get('day')}. ${month}` : `${weekday} ${get('day')} ${month}`;
}

function useCardFields(ev: Event, fmt: string) {
  const t = useTranslations('Discover');
  const tMap = useTranslations('MapPage');
  const locale = useLocale();
  const title = ev.title != null ? decodeEntities(ev.title) : null;
  const time = ev.title != null ? formatTime(ev.start_date) : null;
  const day = shortDay(new Date(ev.start_date), fmt);
  const price = ev.title != null
    ? priceBadge(ev, { free: t('chipFree'), from: (p) => tMap('priceFrom', { price: p }) }, fmt)
    : null;
  const region = ev.district
    ? districtDisplayName(ev.district)
    : ev.bundesland
      ? bundeslandDisplayName(ev.bundesland, locale)
      : '';
  const place = [ev.location_name, region].filter(Boolean).join(' · ');
  return { title, time, day, price, place };
}

function ShelfCard({ ev, fmt }: { ev: Event; fmt: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const tCat = useTranslations('Categories');
  const { title, time, day, price, place } = useCardFields(ev, fmt);
  const showImage = !!ev.image_url && !imgFailed;
  const [g1, g2] = gradientFor(ev.category);
  const pending = title == null;

  return (
    <Link
      href={pending ? '#' : buildEventUrlV2(ev)}
      aria-disabled={pending || undefined}
      className="press-haptic shrink-0 snap-start w-[212px] block"
    >
      <div
        className="relative aspect-square rounded-xl overflow-hidden"
        style={{ background: showImage ? 'var(--v4-surface-inset)' : `linear-gradient(135deg, ${g1}, ${g2})` }}
      >
        {showImage ? (
          <Image src={ev.image_url!} alt="" fill sizes="212px" unoptimized onError={() => setImgFailed(true)} className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-white/95 leading-tight">
            {pending ? '' : categoryLabel(tCat, ev.category || 'Sonstiges')}
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-white text-[#0a0a0c] px-[7px] py-1 text-[11.5px] font-extrabold">
          {day}{time ? ` · ${time}` : ''}
        </span>
        {price && (
          <span className="absolute right-2 bottom-2 rounded-md bg-[#0a0a0c]/80 backdrop-blur px-[7px] py-1 text-[11.5px] font-bold text-white">
            {price}
          </span>
        )}
      </div>
      {pending ? (
        <div className="mt-2.5 space-y-1.5 animate-pulse">
          <div className="h-[14px] w-4/5 rounded bg-[var(--v4-surface-elevated)]" />
          <div className="h-[12px] w-3/5 rounded bg-[var(--v4-surface-elevated)]" />
        </div>
      ) : (
        <>
          <h3 className="mt-2.5 mb-0.5 text-[14px] font-bold tracking-[-0.01em] leading-[1.3] text-[var(--v4-ink)] line-clamp-2">{title}</h3>
          <p className="m-0 text-[12.5px] text-[var(--v4-ink-50)] truncate">{place}</p>
        </>
      )}
    </Link>
  );
}

function PickTile({ ev, big, fmt }: { ev: Event; big: boolean; fmt: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const t = useTranslations('Discover');
  const tMap = useTranslations('MapPage');
  const { title, time, price, place } = useCardFields(ev, fmt);
  const [g1, g2] = gradientFor(ev.category);
  const dayLabel = formatRelativeDay(ev.start_date, fmt, tMap('groupHeute'), tMap('groupMorgen'));
  const meta = [`${dayLabel}${time ? ` ${time}` : ''}`, place, price].filter(Boolean).join(' · ');
  return (
    <Link
      href={buildEventUrlV2(ev)}
      className={'press-haptic relative rounded-2xl overflow-hidden block ' + (big ? 'col-span-2 md:col-span-1 md:row-span-2' : '')}
      style={{ background: imgFailed ? `linear-gradient(135deg, ${g1}, ${g2})` : 'var(--v4-surface-elevated)' }}
    >
      {!imgFailed && (
        <Image src={ev.image_url!} alt="" fill sizes={big ? '(max-width: 768px) 100vw, 560px' : '(max-width: 768px) 50vw, 270px'} unoptimized onError={() => setImgFailed(true)} className="object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050506]/95" />
      <div className="absolute left-[18px] right-[18px] bottom-4">
        {big && <span className="inline-block rounded-md bg-[var(--v4-match)] text-[#0a0a0c] px-2 py-1 text-[11.5px] font-bold mb-2">{t('topPick')}</span>}
        <h3 className={'m-0 font-extrabold tracking-[-0.02em] leading-[1.2] text-white ' + (big ? 'text-[22px] md:text-[28px]' : 'text-[16px] md:text-[17px]')}>{title}</h3>
        <p className="mt-1.5 mb-0 text-[13px] text-white/70 truncate">{meta}</p>
      </div>
    </Link>
  );
}

function formatRelativeDay(dateStr: string, fmt: string, todayLabel: string, tomorrowLabel: string): string {
  const d = new Date(dateStr);
  const day = toViennaDate(d);
  const today = viennaToday();
  if (day === today) return todayLabel;
  if (day === addViennaDays(today, 1)) return tomorrowLabel;
  return d.toLocaleDateString(fmt, { weekday: 'short', day: 'numeric', month: 'short', timeZone: EVENT_TZ });
}
