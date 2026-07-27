'use client';

/**
 * Client-Liste der Uebersichtsseite /aktivitaeten (fn-18 Task 8).
 *
 * Die Seite selbst ist eine statische ISR-Route: sie rendert die erste
 * Seite serverseitig (loadActivityListPageCached) und uebergibt sie hier
 * als Prop. Filter- und Nachlade-Interaktion laufen ausschliesslich
 * client-seitig ueber /api/activities — es gibt bewusst KEINE
 * searchParams/Router-Navigation, die die Route auf dynamic kippen
 * wuerde.
 *
 * Karten-Optik = Gemeinde-Hub-Sektion (Task 4): ActivityCardImage mit
 * onError-Fallback und sichtbarem Bild-Credit; Snippet-Cards, die
 * Quellen-Attribution lebt auf der Detailseite.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link as LocaleLink } from '@/i18n/navigation';
import { activityTagLabel } from '@/lib/activities/tag-labels';
import { ActivityCardImage } from './ActivityCardImage';
import type { ActivityListItem } from '@/lib/activities/list-loaders';
import {
  ACTIVITY_FILTER_TAGS,
  ACTIVITY_LIST_PAGE_SIZE,
  EMPTY_ACTIVITY_FILTERS,
  buildActivitiesQuery,
  hasActiveFilter,
  type ActivityListFilters,
  type ActivitySetting,
} from '@/lib/activities/list-query';

export interface BundeslandOption {
  id: string;
  name: string;
}

interface ActivitiesBrowserProps {
  /** Serverseitig gerenderte erste Seite (ungefiltert). */
  initialItems: ActivityListItem[];
  initialCursor: string | null;
  bundeslaender: BundeslandOption[];
}

interface ApiResponse {
  activities?: ActivityListItem[];
  nextCursor?: string | null;
}

export function ActivitiesBrowser({
  initialItems,
  initialCursor,
  bundeslaender,
}: ActivitiesBrowserProps) {
  const t = useTranslations('Activities');

  const [filters, setFilters] = useState<ActivityListFilters>(EMPTY_ACTIVITY_FILTERS);
  const [items, setItems] = useState<ActivityListItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * Race-Guard: schnelles Chip-Klicken feuert mehrere Fetches; nur die
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
          })}`,
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as ApiResponse;
        if (requestId !== requestRef.current) return;
        const page = json.activities ?? [];
        setItems((prev) => (nextCursor ? [...prev, ...page] : page));
        setCursor(json.nextCursor ?? null);
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
      if (!hasActiveFilter(nextFilters)) {
        // Ungefilterter Zustand == serverseitig gerenderte Seite 1:
        // kein Fetch noetig (und die laufende Antwort darf nicht mehr
        // schreiben -> requestRef hochzaehlen).
        requestRef.current++;
        setItems(initialItems);
        setCursor(initialCursor);
        setLoading(false);
        setFailed(false);
        return;
      }
      void fetchPage(nextFilters, null);
    },
    [fetchPage, initialCursor, initialItems],
  );

  // Nach einem Client-Navigations-Rueckweg auf die Seite koennen sich die
  // ISR-Props geaendert haben — ungefilterte Ansicht nachziehen.
  useEffect(() => {
    if (!hasActiveFilter(filters)) {
      setItems(initialItems);
      setCursor(initialCursor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur auf neue Server-Props reagieren
  }, [initialItems, initialCursor]);

  const settingOptions: Array<{ value: ActivitySetting; label: string }> = [
    { value: 'indoor', label: t('settingIndoor') },
    { value: 'outdoor', label: t('settingOutdoor') },
  ];

  return (
    <div>
      <div className="flex flex-col gap-3 mb-8">
        <FilterRow label={t('filterBundesland')}>
          <Chip
            active={filters.bundesland === null}
            onClick={() => applyFilters({ ...filters, bundesland: null })}
          >
            {t('filterAll')}
          </Chip>
          {bundeslaender.map((bl) => (
            <Chip
              key={bl.id}
              active={filters.bundesland === bl.id}
              onClick={() =>
                applyFilters({
                  ...filters,
                  bundesland: filters.bundesland === bl.id ? null : bl.id,
                })
              }
            >
              {bl.name}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label={t('filterTopic')}>
          <Chip
            active={filters.tag === null}
            onClick={() => applyFilters({ ...filters, tag: null })}
          >
            {t('filterAll')}
          </Chip>
          {ACTIVITY_FILTER_TAGS.map((tag) => (
            <Chip
              key={tag}
              active={filters.tag === tag}
              onClick={() =>
                applyFilters({ ...filters, tag: filters.tag === tag ? null : tag })
              }
            >
              {activityTagLabel(tag)}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label={t('filterSetting')}>
          <Chip
            active={filters.setting === null}
            onClick={() => applyFilters({ ...filters, setting: null })}
          >
            {t('filterAll')}
          </Chip>
          {settingOptions.map((opt) => (
            <Chip
              key={opt.value}
              active={filters.setting === opt.value}
              onClick={() =>
                applyFilters({
                  ...filters,
                  setting: filters.setting === opt.value ? null : opt.value,
                })
              }
            >
              {opt.label}
            </Chip>
          ))}
        </FilterRow>
      </div>

      {failed && (
        <p className="mb-6 text-sm text-red-300" role="alert">
          {t('loadError')}
        </p>
      )}

      {items.length === 0 && !loading ? (
        <p className="text-sm text-white/50 py-10">{t('empty')}</p>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="activities-grid"
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
                fallbackLabel={a.tags?.[0] ? activityTagLabel(a.tags[0]) : t('cardFallback')}
                creditPrefix={t('imageCredit')}
                aspectClass="aspect-[4/3]"
              />
              <div className="p-3">
                <div className="font-semibold leading-snug line-clamp-2 mb-1">{a.name}</div>
                {a.town && <div className="text-xs text-white/50">{a.town}</div>}
                {a.price_hint && (
                  <div className="text-xs text-white/40 mt-1 line-clamp-1">{a.price_hint}</div>
                )}
              </div>
            </LocaleLink>
          ))}
        </div>
      )}

      <div className="flex justify-center mt-8">
        {cursor && (
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

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-[0.14em] text-white/35 w-full sm:w-24 shrink-0">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'px-3 py-1 rounded-full border text-xs transition-colors ' +
        (active
          ? 'bg-white/15 border-white/30 text-white'
          : 'bg-white/5 border-white/10 text-white/60 hover:text-white/90')
      }
    >
      {children}
    </button>
  );
}

