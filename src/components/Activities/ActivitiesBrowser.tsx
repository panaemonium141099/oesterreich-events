'use client';

/**
 * Client-Liste der Uebersichtsseite /aktivitaeten (fn-18 Task 8,
 * Filter-Modul 2026-09-15).
 *
 * Die Seite selbst ist eine statische ISR-Route: sie rendert die erste
 * Seite serverseitig (loadActivityListPageCached) und uebergibt sie hier
 * als Prop. Filter- und Nachlade-Interaktion laufen ausschliesslich
 * client-seitig ueber /api/activities — es gibt bewusst KEINE
 * searchParams/Router-Navigation, die die Route auf dynamic kippen
 * wuerde. Die Filter werden stattdessen per history.replaceState in die
 * Seiten-URL gespiegelt (teilbare Links) und beim Mount aus
 * window.location.search gelesen.
 *
 * Filter-UI: ActivityFilterBar (Bundesland -> Bezirke (mehrfach), Thema,
 * Indoor/Outdoor, Freitext). Der State liegt hier, die Bar ist reine
 * Praesentation. Jeder Filterwechsel holt Seite 1 MIT Trefferzahl
 * (`count=1`), "Mehr laden" ohne (die Zahl steht schon).
 *
 * Karten-Optik = Gemeinde-Hub-Sektion (Task 4): ActivityCardImage mit
 * onError-Fallback und sichtbarem Bild-Credit; Snippet-Cards, die
 * Quellen-Attribution lebt auf der Detailseite.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link as LocaleLink } from '@/i18n/navigation';
import { activityTagLabel } from '@/lib/activities/tag-labels';
import { ActivityCardImage } from './ActivityCardImage';
import { AccessibilityIcon } from '@/components/UI/Icons';
import { ActivityFilterBar, type BundeslandOption } from './ActivityFilterBar';
import type { ActivityBezirkCount, ActivityListItem } from '@/lib/activities/list-loaders';
import {
  ACTIVITY_LIST_PAGE_SIZE,
  EMPTY_ACTIVITY_FILTERS,
  buildActivitiesQuery,
  filtersFromPageSearch,
  filtersToPageSearch,
  hasActiveFilter,
  type ActivityListFilters,
} from '@/lib/activities/list-query';

export type { BundeslandOption };

interface ActivitiesBrowserProps {
  /** Serverseitig gerenderte erste Seite (ungefiltert). */
  initialItems: ActivityListItem[];
  initialCursor: string | null;
  /** Gesamtzahl sichtbarer POIs (Seite-1-Count); null = unbekannt. */
  initialTotal: number | null;
  bundeslaender: BundeslandOption[];
  /** Bezirks-Facetten fuer die Filter-Auswahl (ISR, 1 h). */
  bezirkCounts: ActivityBezirkCount[];
}

interface ApiResponse {
  activities?: ActivityListItem[];
  nextCursor?: string | null;
  total?: number | null;
}

export function ActivitiesBrowser({
  initialItems,
  initialCursor,
  initialTotal,
  bundeslaender,
  bezirkCounts,
}: ActivitiesBrowserProps) {
  const t = useTranslations('Activities');
  const locale = useLocale();

  const [filters, setFilters] = useState<ActivityListFilters>(EMPTY_ACTIVITY_FILTERS);
  const [items, setItems] = useState<ActivityListItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [total, setTotal] = useState<number | null>(initialTotal);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * Race-Guard: schnelles Klicken/Tippen feuert mehrere Fetches; nur die
   * Antwort des zuletzt gestarteten Requests darf den State schreiben.
   */
  const requestRef = useRef(0);

  const fetchPage = useCallback(
    async (nextFilters: ActivityListFilters, nextCursor: string | null) => {
      const requestId = ++requestRef.current;
      setLoading(true);
      setFailed(false);
      try {
        const res = await fetch(
          `/api/activities${buildActivitiesQuery(nextFilters, {
            cursor: nextCursor,
            limit: ACTIVITY_LIST_PAGE_SIZE,
            // Trefferzahl nur fuer Seite 1 — beim Nachladen steht sie schon.
            count: nextCursor === null,
          })}`,
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as ApiResponse;
        if (requestId !== requestRef.current) return;
        const page = json.activities ?? [];
        setItems((prev) => (nextCursor ? [...prev, ...page] : page));
        setCursor(json.nextCursor ?? null);
        if (nextCursor === null) setTotal(typeof json.total === 'number' ? json.total : null);
      } catch {
        if (requestId !== requestRef.current) return;
        setFailed(true);
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    },
    [],
  );

  const applyFilters = useCallback(
    (nextFilters: ActivityListFilters) => {
      setFilters(nextFilters);
      // URL spiegeln (ohne Router: die Route bleibt statisch, kein
      // RSC-Roundtrip). replaceState statt pushState, damit "Zurueck"
      // die Seite verlaesst statt jeden Chip-Klick rueckwaerts zu gehen.
      if (typeof window !== 'undefined') {
        const search = filtersToPageSearch(nextFilters);
        const next = `${window.location.pathname}${search}${window.location.hash}`;
        if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
          window.history.replaceState(window.history.state, '', next);
        }
      }
      if (!hasActiveFilter(nextFilters)) {
        // Ungefilterter Zustand == serverseitig gerenderte Seite 1:
        // kein Fetch noetig (und die laufende Antwort darf nicht mehr
        // schreiben -> requestRef hochzaehlen).
        requestRef.current++;
        setItems(initialItems);
        setCursor(initialCursor);
        setTotal(initialTotal);
        setLoading(false);
        setFailed(false);
        return;
      }
      void fetchPage(nextFilters, null);
    },
    [fetchPage, initialCursor, initialItems, initialTotal],
  );

  // Beim Mount: Filter aus der URL uebernehmen (teilbarer Link, Reload).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromUrl = filtersFromPageSearch(window.location.search);
    if (hasActiveFilter(fromUrl)) {
      setFilters(fromUrl);
      void fetchPage(fromUrl, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur einmal beim Mount
  }, []);

  // Nach einem Client-Navigations-Rueckweg auf die Seite koennen sich die
  // ISR-Props geaendert haben — ungefilterte Ansicht nachziehen.
  useEffect(() => {
    if (!hasActiveFilter(filters)) {
      setItems(initialItems);
      setCursor(initialCursor);
      setTotal(initialTotal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur auf neue Server-Props reagieren
  }, [initialItems, initialCursor, initialTotal]);

  const showEmpty = items.length === 0 && !loading && !failed;

  return (
    <div>
      <ActivityFilterBar
        filters={filters}
        onChange={applyFilters}
        bundeslaender={bundeslaender}
        bezirkCounts={bezirkCounts}
        total={total}
        loading={loading}
      />

      {failed && (
        <p className="mb-6 text-sm text-red-300" role="alert">
          {t('loadError')}
        </p>
      )}

      {showEmpty ? (
        <div className="py-16 text-center">
          <p className="text-[17px] font-semibold text-white/90">{t('emptyTitle')}</p>
          <p className="mt-1.5 text-sm text-white/50 max-w-md mx-auto">{t('emptyHint')}</p>
          {hasActiveFilter(filters) && (
            <button
              type="button"
              onClick={() => applyFilters(EMPTY_ACTIVITY_FILTERS)}
              className="press-haptic mt-5 h-10 px-5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              {t('filterReset')}
            </button>
          )}
        </div>
      ) : (
        <div
          className={
            'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity ' +
            (loading && items.length > 0 ? 'opacity-60' : '')
          }
          data-testid="activities-grid"
          aria-busy={loading || undefined}
        >
          {items.map((a) => (
            <LocaleLink
              key={a.id}
              href={`/aktivitaet/${a.slug}`}
              className="press-haptic rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/25 transition-colors block"
            >
              {/* Karten-Bild-Regeln 1:1 aus Task 4 (onError-Fallback +
                  sichtbares Bild-Credit). */}
              <ActivityCardImage
                images={a.images}
                alt={a.name}
                fallbackLabel={a.tags?.[0] ? activityTagLabel(a.tags[0], locale) : t('cardFallback')}
                creditPrefix={t('imageCredit')}
                aspectClass="aspect-[4/3]"
              />
              <div className="p-3">
                <div className="font-semibold leading-snug line-clamp-2 mb-1">{a.name}</div>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  {a.town && <span>{a.town}</span>}
                  {a.accessible && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-sky-400/15 text-sky-200 px-2 py-0.5 text-[11px] font-medium"
                      title={t('accessibleBadge')}
                    >
                      <AccessibilityIcon size={12} />
                      {t('accessibleBadge')}
                    </span>
                  )}
                </div>
                {a.price_hint && (
                  <div className="text-xs text-white/40 mt-1 line-clamp-1">{a.price_hint}</div>
                )}
              </div>
            </LocaleLink>
          ))}
        </div>
      )}

      <div className="flex justify-center mt-8">
        {cursor && !showEmpty && (
          <button
            type="button"
            onClick={() => void fetchPage(filters, cursor)}
            disabled={loading}
            className="press-haptic px-5 py-2.5 rounded-full bg-white/10 border border-white/15 text-sm font-semibold hover:bg-white/15 disabled:opacity-50 transition-colors"
          >
            {loading ? t('loading') : t('loadMore')}
          </button>
        )}
      </div>
    </div>
  );
}
