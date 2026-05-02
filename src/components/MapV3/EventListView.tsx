'use client';

/**
 * EventListView — Variante A · Liste view for /map.
 *
 * Light-mode grouped list ("Heute / Morgen / Wochenende / Diese Woche /
 * Später"), 2-column on desktop, 1-column on mobile, with sort tabs
 * (Datum · Distanz · Score). Replaces the old dark Sidebar list.
 *
 * Renders the SAME `Event[]` set the map shows so toggling between
 * Karte/Liste is instant — no refetch, just a reflow.
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { T } from './tokens';
import type { Event } from '@/types/events';
import { formatTime } from '@/lib/utils/date';
import { distanceKm } from '@/lib/geolocation';

export type ListSortMode = 'date' | 'distance' | 'score';

interface EventListViewProps {
  events: Event[];
  loading: boolean;
  onSelectEvent: (e: Event) => void;
  /** User location for distance sort + km display. Null when not granted. */
  userLocation?: { lat: number; lng: number } | null;
  /** Total count from the API (may exceed loaded). Shown in the headline. */
  totalCount?: number | null;
  /** Subtitle shown next to "Liste" — e.g. "Heute · Burgenland". */
  scopeLabel?: string;
}

const PAGE_SIZE = 30;

export function EventListView({
  events,
  loading,
  onSelectEvent,
  userLocation,
  totalCount,
  scopeLabel,
}: EventListViewProps) {
  const [sort, setSort] = useState<ListSortMode>(userLocation ? 'distance' : 'date');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [events.length, sort]);

  // Intersection-observer based infinite scroll — no fixed pagination,
  // matches the existing EventList's behavior.
  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, events.length));
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(loader);
    return () => obs.disconnect();
  }, [events.length]);

  const sorted = useMemo(() => {
    const list = [...events];
    if (sort === 'distance' && userLocation) {
      const withD = list.map((e) => ({
        e,
        d:
          e.latitude != null && e.longitude != null
            ? distanceKm(userLocation.lat, userLocation.lng, e.latitude, e.longitude)
            : Number.POSITIVE_INFINITY,
      }));
      withD.sort((a, b) => a.d - b.d);
      return withD.map((x) => x.e);
    }
    if (sort === 'score') {
      list.sort((a, b) => (b.event_score ?? 0) - (a.event_score ?? 0));
      return list;
    }
    list.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    return list;
  }, [events, sort, userLocation]);

  const visible = sorted.slice(0, visibleCount);
  const grouped = useMemo(() => groupEvents(visible), [visible]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: T.bg,
        overflowY: 'auto',
        // Reserve room above the floating ViewToggle (mobile bottom-center)
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
      }}
      className="thin-scroll"
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px 16px' }}>
        {/* Headline + sort tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            paddingBottom: 16,
            borderBottom: `1px solid ${T.border}`,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.16em',
                color: T.ink60,
                marginBottom: 4,
              }}
            >
              Listenansicht
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: T.ink,
                margin: 0,
              }}
              className="md:!text-[26px]"
            >
              {totalCount != null && totalCount > visible.length
                ? `${totalCount.toLocaleString('de-AT')} Events`
                : `${events.length.toLocaleString('de-AT')} Events`}
              {scopeLabel ? ` · ${scopeLabel}` : ''}
            </h1>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {([
              { k: 'date', l: 'Datum' },
              ...(userLocation ? ([{ k: 'distance', l: 'Distanz' }] as const) : []),
              { k: 'score', l: 'Top' },
            ] as { k: ListSortMode; l: string }[]).map((o) => {
              const active = sort === o.k;
              return (
                <button
                  key={o.k}
                  onClick={() => setSort(o.k)}
                  className="press-haptic"
                  style={{
                    padding: '7px 14px',
                    borderRadius: 9999,
                    background: active ? T.ink : '#fff',
                    color: active ? '#fff' : T.ink70,
                    border: active ? '1px solid transparent' : `1px solid ${T.border}`,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: active ? 'none' : T.shadow,
                  }}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading skeletons — only on first load, otherwise keep stale */}
        {loading && events.length === 0 && (
          <div style={{ paddingTop: 22 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && events.length === 0 && (
          <div style={{ padding: '60px 0', textAlign: 'center', color: T.ink50 }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: T.ink70, marginBottom: 8 }}>
              Keine Events gefunden
            </p>
            <p style={{ fontSize: 13 }}>Versuche, die Filter zu lockern oder einen anderen Zeitraum zu wählen.</p>
          </div>
        )}

        {/* Groups */}
        <div style={{ paddingTop: 22 }}>
          {grouped.map((g) => (
            <section key={g.label} style={{ marginBottom: 28 }}>
              <header
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <h2
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: T.ink,
                    margin: 0,
                  }}
                >
                  {g.label}
                </h2>
                {g.sub && (
                  <span style={{ fontSize: 12.5, color: T.ink60, fontWeight: 500 }}>· {g.sub}</span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: T.ink50 }}>
                  {g.events.length} Event{g.events.length === 1 ? '' : 's'}
                </span>
              </header>
              <div
                style={{
                  display: 'grid',
                  gap: 14,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))',
                }}
              >
                {g.events.map((ev) => (
                  <BigRow
                    key={ev.id}
                    ev={ev}
                    userLocation={userLocation}
                    onClick={() => onSelectEvent(ev)}
                  />
                ))}
              </div>
            </section>
          ))}

          {visibleCount < sorted.length && (
            <div ref={loaderRef} style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: T.ink50 }}>
              {visible.length} von {sorted.length} angezeigt — scrolle für mehr
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Card ─────────────────────────────────────────────────────────────── */

function BigRow({
  ev,
  userLocation,
  onClick,
}: {
  ev: Event;
  userLocation?: { lat: number; lng: number } | null;
  onClick: () => void;
}) {
  const time = formatTime(ev.start_date);
  const cat = ev.category || 'Sonstiges';
  const km =
    userLocation && ev.latitude != null && ev.longitude != null
      ? Math.round(distanceKm(userLocation.lat, userLocation.lng, ev.latitude, ev.longitude) * 10) / 10
      : null;
  const dateLabel = formatDateLabel(ev.start_date);

  return (
    <button
      onClick={onClick}
      className="press-haptic"
      style={{
        display: 'flex',
        gap: 14,
        padding: 12,
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${T.border}`,
        boxShadow: T.shadow,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          width: 132,
          height: 132,
          borderRadius: 10,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          background: T.panel,
        }}
      >
        {ev.image_url ? (
          <Image
            src={ev.image_url}
            alt=""
            fill
            sizes="132px"
            unoptimized
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.ink40, fontSize: 11, fontWeight: 600 }}>
            {cat.toUpperCase()}
          </div>
        )}
        <span
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            padding: '4px 8px',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.95)',
            fontSize: 10,
            fontWeight: 700,
            color: T.ink,
            letterSpacing: '0.04em',
            boxShadow: '0 2px 6px rgba(0,0,0,0.10)',
          }}
        >
          {dateLabel.toUpperCase()}
        </span>
        {time && (
          <span
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              padding: '4px 8px',
              borderRadius: 6,
              background: 'rgba(0,0,0,0.65)',
              fontSize: 10.5,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.04em',
            }}
          >
            {time}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 0', gap: 6 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
            <CategoryChip cat={cat} />
            {ev.location_name && (
              <span style={{ fontSize: 11.5, color: T.ink60, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                · {ev.location_name}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: '-0.018em',
              color: T.ink,
              marginBottom: 6,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {ev.title}
          </div>
          {km != null && (
            <div style={{ fontSize: 12, color: T.ink60, fontWeight: 500 }}>
              {km.toLocaleString('de-AT')} km · ca. {Math.round(km * 1.4)} Min
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: T.ink50, fontWeight: 500 }}>
            {ev.bundesland || ''}
            {ev.district ? ` · ${ev.district}` : ''}
          </span>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: T.ink,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '-0.005em',
            }}
          >
            Öffnen
          </span>
        </div>
      </div>
    </button>
  );
}

function CategoryChip({ cat }: { cat: string }) {
  return (
    <span
      style={{
        padding: '4px 9px',
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 9999,
        background: T.panel,
        border: `1px solid ${T.border}`,
        color: T.ink70,
        whiteSpace: 'nowrap',
      }}
    >
      {cat}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        padding: 12,
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${T.border}`,
        marginBottom: 14,
      }}
    >
      <div style={{ width: 132, height: 132, borderRadius: 10, background: T.panel, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
        <div style={{ height: 14, background: T.panel, borderRadius: 4, width: '40%' }} />
        <div style={{ height: 18, background: T.panel, borderRadius: 4, width: '85%' }} />
        <div style={{ height: 14, background: T.panel, borderRadius: 4, width: '60%' }} />
        <div style={{ height: 12, background: T.panel, borderRadius: 4, width: '30%', marginTop: 'auto' }} />
      </div>
    </div>
  );
}

/* ─── Grouping helpers ─────────────────────────────────────────────────── */

interface Group {
  label: string;
  sub?: string;
  events: Event[];
}

function groupEvents(events: Event[]): Group[] {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);
  // End-of-week (Sunday)
  const dow = today.getDay();
  const daysToSun = dow === 0 ? 0 : 7 - dow;
  const endOfWeek = addDays(today, daysToSun);
  const dayAfterWeek = addDays(endOfWeek, 1);

  const buckets: Record<string, Event[]> = {
    heute: [],
    morgen: [],
    wochenende: [],
    woche: [],
    spaeter: [],
  };

  for (const e of events) {
    const d = startOfDay(new Date(e.start_date));
    const t = d.getTime();
    if (t < today.getTime()) {
      // already started — show in "Heute" if same day, else skip up to "Später"
      if (sameDay(d, today)) buckets.heute.push(e);
      else buckets.spaeter.push(e);
    } else if (sameDay(d, today)) {
      buckets.heute.push(e);
    } else if (sameDay(d, tomorrow)) {
      buckets.morgen.push(e);
    } else if (t >= dayAfter.getTime() && t <= endOfWeek.getTime() && (d.getDay() === 6 || d.getDay() === 0)) {
      buckets.wochenende.push(e);
    } else if (t >= dayAfter.getTime() && t < dayAfterWeek.getTime()) {
      buckets.woche.push(e);
    } else {
      buckets.spaeter.push(e);
    }
  }

  const groups: Group[] = [];
  if (buckets.heute.length) groups.push({ label: 'Heute', sub: fmtShortDate(today), events: buckets.heute });
  if (buckets.morgen.length) groups.push({ label: 'Morgen', sub: fmtShortDate(tomorrow), events: buckets.morgen });
  if (buckets.wochenende.length) groups.push({ label: 'Wochenende', events: buckets.wochenende });
  if (buckets.woche.length) groups.push({ label: 'Diese Woche', events: buckets.woche });
  if (buckets.spaeter.length) groups.push({ label: 'Später', events: buckets.spaeter });
  return groups;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtShortDate(d: Date): string {
  return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
}

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const today = startOfDay(new Date());
    if (sameDay(startOfDay(d), today)) return 'Heute';
    if (sameDay(startOfDay(d), addDays(today, 1))) return 'Morgen';
    return d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return dateStr.slice(0, 10);
  }
}
