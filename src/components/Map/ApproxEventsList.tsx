'use client';

/**
 * Liste hinter einem Sammelmarker „Position ungefähr" (fn-25 C5).
 *
 * Events ohne belegte Position bekommen keinen Event-Pin und ihr
 * Sammelmarker löst sich beim Zoomen nie auf (alle Punkte liegen auf dem
 * Gemeinde-/PLZ-Mittelpunkt). Damit sie auf der Karte trotzdem erreichbar
 * sind, zeigt der Klick auf den Marker diese Liste im Popup.
 *
 * Eingang sind die Punkte aus dem Karten-Snapshot (title=null) in fertiger
 * Reihenfolge; Titel/Bild/Ort kommen seitenweise über useDetailHydration
 * (gleicher Weg wie die Liste auf /entdecken).
 */
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Event } from '@/types/events';
import { getEventImage, getCategoryFallbackImage } from '@/lib/categoryImages';
import { formatTime } from '@/lib/utils/date';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { decodeEntities } from '@/lib/utils/decode-entities';
import { useDetailHydration } from '@/lib/v4/use-detail-hydration';
import { orderLoadedPages } from '@/lib/v4/approx-list';

/** = Chunk-Größe von useDetailHydration: eine Seite, ein Request. */
const PAGE = 24;

function dateLabel(iso: string, fmt: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(fmt, {
    weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Vienna',
  });
}

interface ApproxEventsListProps {
  /** Events des Sammelmarkers, bereits sortiert (siehe sortApproxEvents). */
  events: Event[];
  onClose: () => void;
}

export function ApproxEventsList({ events, onClose }: ApproxEventsListProps) {
  const t = useTranslations('MapPage');
  const locale = useLocale();
  const fmt = locale === 'de' ? 'de-AT' : 'en-GB';
  const [shown, setShown] = useState(PAGE);

  const visibleRaw = useMemo(() => events.slice(0, shown), [events, shown]);
  const hydrated = useDetailHydration(visibleRaw);
  const visible = useMemo(() => orderLoadedPages(hydrated, PAGE), [hydrated]);
  const hasMore = shown < events.length;
  const showMore = () => setShown((s) => Math.min(s + PAGE, events.length));

  const count = events.length.toLocaleString(fmt);
  const title = t(events.length === 1 ? 'nEventsOne' : 'nEventsMany', { count });

  return (
    <div
      role="dialog"
      aria-label={title}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      className="w-[min(320px,calc(100vw-48px))] overflow-hidden rounded-[18px] border border-white/10 bg-[#141416] text-white shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="flex items-start gap-3 border-b border-white/10 px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-tight">{title}</div>
          <p className="mt-1 text-[12px] leading-snug text-white/60">{t('approxHint')}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('approxClose')}
          className="-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <ul
        className="m-0 max-h-[min(320px,45vh)] list-none overflow-y-auto overscroll-contain p-1.5"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (hasMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 80) showMore();
        }}
      >
        {visible.map((ev) => (
          <li key={ev.id}>
            <ApproxRow ev={ev} fmt={fmt} />
          </li>
        ))}
        {hasMore && (
          <li>
            <button
              type="button"
              onClick={showMore}
              className="mt-1 w-full cursor-pointer rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              {t('approxMore')}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function ApproxRow({ ev, fmt }: { ev: Event; fmt: string }) {
  const [imgFailed, setImgFailed] = useState(false);

  // Punkt noch ohne Anzeige-Felder → Platzhalter, bis der Chunk da ist.
  if (ev.title == null) {
    return (
      <div className="flex items-center gap-3 p-2" aria-hidden="true">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-lg bg-white/10 motion-reduce:animate-none" />
        <div className="flex-1">
          <div className="h-3 w-4/5 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
          <div className="mt-2 h-2.5 w-3/5 animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  const time = formatTime(ev.start_date, fmt);
  const meta = [
    `${dateLabel(ev.start_date, fmt)}${time ? `, ${time}` : ''}`,
    ev.location_name ? decodeEntities(ev.location_name) : '',
  ].filter(Boolean).join(' · ');
  const src = imgFailed
    ? getCategoryFallbackImage(ev.category, ev.title, ev.bundesland)
    : getEventImage(ev.image_url, ev.category, ev.title, ev.bundesland);

  const body = (
    <>
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setImgFailed(true)}
        className="h-11 w-11 shrink-0 rounded-lg bg-white/10 object-cover"
      />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13px] font-semibold leading-snug">{decodeEntities(ev.title)}</span>
        <span className="mt-0.5 block truncate text-[11.5px] text-white/60">{meta}</span>
      </span>
    </>
  );

  // Ohne Slug (zwischenzeitlich depubliziert) gibt es keine Detailseite.
  if (!ev.slug) {
    return <div className="flex items-center gap-3 rounded-xl p-2 opacity-60">{body}</div>;
  }
  return (
    <Link
      href={buildEventUrlV2(ev)}
      className="flex items-center gap-3 rounded-xl p-2 text-white no-underline transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none"
    >
      {body}
    </Link>
  );
}
