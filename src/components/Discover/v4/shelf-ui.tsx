'use client';

/**
 * Bausteine der Regale (Variante „Regale", 2026-10-22): Regal mit
 * Querscroll-Spur, Poster-Karte und Top-Pick-Kachel. Geteilt von
 * /entdecken (V4EntdeckenShelves) und den SEO-Hubs (HubShelves,
 * HubEventGrid), damit beide gleich aussehen.
 *
 * Client-Komponenten wegen Scroll-Knöpfen und Bild-Fallback; sie rendern
 * trotzdem im Server-HTML, die Links bleiben für Google sichtbar.
 */

import { useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Event } from '@/types/events';
import { categoryLabel } from '@/lib/i18n/category-labels';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { districtDisplayName } from '@/lib/districtsAT';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { decodeEntities } from '@/lib/utils/decode-entities';
import { formatTime } from '@/lib/utils/date';
import { EVENT_TZ, addViennaDays, toViennaDate, viennaToday } from '@/lib/utils/event-time';
import { priceBadge } from '@/lib/v4/price-badge';
import { gradientFor } from './category-gradient';

/* ─── Regal mit horizontaler Spur ──────────────────────────────────────── */

/**
 * „Alle anzeigen" ist entweder ein Knopf (onAll, /entdecken setzt einen
 * Filter) oder ein echter Link (allHref, SEO-Hubs verlinken ihre
 * Unterseiten).
 */
export function Shelf({ title, sub, onAll, allHref, allLabel, children }: {
  title: string;
  sub?: string;
  onAll?: () => void;
  allHref?: string;
  allLabel?: string;
  children: ReactNode;
}) {
  const t = useTranslations('Discover');
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  const hasAll = !!(onAll || allHref);
  const allClass = 'press-haptic ml-auto text-[13px] font-bold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]';
  return (
    <section className="mt-9">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="m-0 text-[21px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">{title}</h2>
        {sub && <span className="hidden md:inline text-[13.5px] text-[var(--v4-ink-50)]">{sub}</span>}
        {allHref ? (
          <Link href={allHref} className={allClass}>{allLabel ?? t('showAll')}</Link>
        ) : onAll ? (
          <button type="button" onClick={onAll} className={allClass}>{allLabel ?? t('showAll')}</button>
        ) : null}
        <div className={'hidden md:flex gap-1 ' + (hasAll ? '' : 'ml-auto')}>
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

/** Bundesland- oder Ortskachel mit Bild und Zähler für das Regal „Nach Region". */
export function RegionTile({ href, name, image, count }: {
  href: string;
  name: string;
  image: string;
  count?: number;
}) {
  const locale = useLocale();
  const fmt = locale === 'de' ? 'de-AT' : 'en-GB';
  return (
    <Link
      href={href}
      className="press-haptic relative shrink-0 snap-start w-[150px] h-[96px] rounded-xl overflow-hidden bg-[var(--v4-surface-elevated)]"
    >
      <Image src={image} alt="" fill sizes="150px" className="object-cover opacity-75" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-[#050506]/85" />
      <b className="absolute left-3 bottom-2.5 text-[14px] font-extrabold tracking-[-0.01em] text-white">{name}</b>
      {count != null && (
        // Oben rechts: unten kollidierte die Zahl mit langen Namen („Niederösterreich").
        <span className="absolute right-2.5 top-2 text-[11px] font-semibold text-white/80">
          {count.toLocaleString(fmt)}
        </span>
      )}
    </Link>
  );
}

/** Kategorie- oder Themen-Chip am Ende der Regale. */
export function ShelfChip({ label, count, href, onClick }: {
  label: string;
  count?: number;
  href?: string;
  onClick?: () => void;
}) {
  const locale = useLocale();
  const fmt = locale === 'de' ? 'de-AT' : 'en-GB';
  const className = 'press-haptic shrink-0 snap-start rounded-full bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-4)] px-4 py-2.5 text-[13px] font-semibold text-[var(--v4-ink)] transition-colors';
  const body = (
    <>
      {label}
      {count != null && <span className="ml-2 text-[var(--v4-ink-50)] font-medium">{count.toLocaleString(fmt)}</span>}
    </>
  );
  return href
    ? <Link href={href} className={className}>{body}</Link>
    : <button type="button" onClick={onClick} className={className}>{body}</button>;
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

/**
 * Poster-Karte: quadratisches Bild mit Datum/Uhrzeit oben links und Preis
 * unten rechts, darunter Titel und Ort. `grid` füllt die Rasterzelle
 * (.v4-poster-grid), sonst feste Breite für die Regal-Spur.
 */
export function ShelfCard({ ev, grid = false }: { ev: Event; grid?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);
  const tCat = useTranslations('Categories');
  const locale = useLocale();
  const fmt = locale === 'de' ? 'de-AT' : 'en-GB';
  const { title, time, day, price, place } = useCardFields(ev, fmt);
  const showImage = !!ev.image_url && !imgFailed;
  const [g1, g2] = gradientFor(ev.category);
  const pending = title == null;

  return (
    <Link
      href={pending ? '#' : buildEventUrlV2(ev)}
      aria-disabled={pending || undefined}
      className={'press-haptic block ' + (grid ? 'min-w-0' : 'shrink-0 snap-start w-[212px]')}
    >
      <div
        className="relative aspect-square rounded-xl overflow-hidden"
        style={{ background: showImage ? 'var(--v4-surface-inset)' : `linear-gradient(135deg, ${g1}, ${g2})` }}
      >
        {showImage ? (
          <Image
            src={ev.image_url!}
            alt=""
            fill
            sizes={grid ? '(max-width: 720px) 50vw, 220px' : '212px'}
            unoptimized
            onError={() => setImgFailed(true)}
            className="object-cover"
          />
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

export function PickTile({ ev, big }: { ev: Event; big: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);
  const t = useTranslations('Discover');
  const tMap = useTranslations('MapPage');
  const locale = useLocale();
  const fmt = locale === 'de' ? 'de-AT' : 'en-GB';
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
        {/* „Heute"/„Morgen" hängt an der Uhr: ISR-HTML und Browser können
            um Mitternacht verschiedene Tage sehen. */}
        <p suppressHydrationWarning className="mt-1.5 mb-0 text-[13px] text-white/70 truncate">{meta}</p>
      </div>
    </Link>
  );
}

/** Raster der Top-Picks: eine große Kachel, vier kleine. */
export const PICKS_GRID_CLASS = 'grid gap-3 mb-2 grid-cols-2 [grid-template-rows:260px_160px] md:grid-cols-[2fr_1fr_1fr] md:[grid-template-rows:220px_220px]';

function formatRelativeDay(dateStr: string, fmt: string, todayLabel: string, tomorrowLabel: string): string {
  const d = new Date(dateStr);
  const day = toViennaDate(d);
  const today = viennaToday();
  if (day === today) return todayLabel;
  if (day === addViennaDays(today, 1)) return tomorrowLabel;
  return d.toLocaleDateString(fmt, { weekday: 'short', day: 'numeric', month: 'short', timeZone: EVENT_TZ });
}
