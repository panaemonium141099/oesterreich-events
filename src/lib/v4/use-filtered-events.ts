'use client';

/**
 * useFilteredEvents — 1:1 extract aus /map/page.tsx Phase 4.1
 *
 * Enthält die komplette Daten-Pipeline aus MapPageInner:
 *   - State: filters, bundeslandIds, allEvents, loading, backgroundLoading, apiTotalCount
 *   - buildParams (Callback)
 *   - fetchEventsProgressive (Callback + AbortController + generation guard)
 *   - useEffect-Trigger für fetchEventsProgressive
 *   - Memos: bundeslandEvents, dedupedEvents, finalEvents, categoryCounts,
 *     totalMatchCount, scopeLabel
 *   - Computed: bundesland (primary)
 *
 * Map-spezifischer State (selectedEvent, hoveredEventId, userLocation,
 * dynamicFlyTo, hasUrlContext, filterOpen, view, mapChips) bleibt auf der
 * jeweiligen Page — dieser Hook kennt ihn nicht.
 *
 * Verhalten unverändert; nur Container.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Event, EventFilters } from '@/types/events';
import { readCache, writeCache } from '@/components/MapV3/eventsCache';
import { BUNDESLAENDER, bundeslandToId, type Bundesland } from '@/lib/bundeslaender';
import { displayDistrictName } from '@/lib/districtsAT';
import { fetchMapPointEvents, pointsEligible } from '@/lib/v4/map-points';

export interface UseFilteredEventsOptions {
  /**
   * fn-16: Points-Modus für /map — wenn die Filter es erlauben
   * (pointsEligible), kommt der komplette AT-Bestand als EIN kompakter
   * Snapshot statt der ~30 limit=3000-Batches. Die Punkte haben KEINE
   * title/image-Felder (Popup lädt lazy via /api/events/[id]) — deshalb
   * darf NUR die Karte das aktivieren, nie die Liste (/entdecken).
   */
  mapPoints?: boolean;
  /**
   * fn-16 (Liste): Nach dem ersten Batch NICHT im Hintergrund alle
   * weiteren Cursor-Batches durchladen (die Cursor-URLs sind nie im
   * Edge-Cache vorgewärmt → je 10–13 s Micro-DB-Zeit), sondern erst
   * auf loadMore() — der Konsument triggert das per
   * IntersectionObserver am Listenende.
   */
  lazyBatches?: boolean;
}

// ── Public contract ───────────────────────────────────────────────────────

export interface UseFilteredEventsReturn {
  // ── State ────────────────────────────────────────────────────────────
  filters: EventFilters;
  setFilters: React.Dispatch<React.SetStateAction<EventFilters>>;
  bundeslandIds: string[];
  setBundeslandIds: React.Dispatch<React.SetStateAction<string[]>>;

  // ── Data ─────────────────────────────────────────────────────────────
  allEvents: Event[];           // pre-filter (from API)
  finalEvents: Event[];          // post-filter (final list shown)
  loading: boolean;
  backgroundLoading: boolean;

  // ── Counts ───────────────────────────────────────────────────────────
  apiTotalCount: number | null;  // server-reported total for current bundesland+filters
  totalMatchCount: number | null; // displayed count (null = trust apiTotalCount when no client narrower)
  categoryCounts: Record<string, number>;

  // ── Lazy-Batches (nur mit options.lazyBatches, sonst inert) ─────────
  loadMore: () => void;
  hasMoreBatches: boolean;
  loadingMore: boolean;

  // ── Context ──────────────────────────────────────────────────────────
  scopeLabel: string;              // "Heute · Burgenland"
  bundesland: Bundesland;          // current bundesland object (primary)
}

// ── Hook ─────────────────────────────────────────────────────────────────

/**
 * @param initialBundeslandIds  Initial bundesland selection, e.g. ['burgenland'] or ['all'].
 *                              Defaults to ['all'] (whole Austria).
 * @param initialFilters        Initial filter values, e.g. from URL params parsed on the
 *                              calling page. The hook does NOT call useSearchParams itself —
 *                              it stays page-agnostic.
 */
export function useFilteredEvents(
  initialBundeslandIds: string[] = ['all'],
  initialFilters: Partial<EventFilters> = {},
  options: UseFilteredEventsOptions = {},
): UseFilteredEventsReturn {
  const { mapPoints = false, lazyBatches = false } = options;
  // Multi-bundesland selection. Source of truth — `primaryBundesland` is
  // the derived single value used for map bbox / flyTo / scope label.
  // ['all'] = no filter; ['wien','steiermark'] = both; etc.
  const [bundeslandIds, setBundeslandIds] = useState<string[]>(initialBundeslandIds);
  const primaryBundesland = useMemo(
    () => BUNDESLAENDER.find((b) => b.id === bundeslandIds[0]) ?? BUNDESLAENDER[0],
    [bundeslandIds],
  );

  // No default dateTo — load EVERYTHING. The progressive batch loader
  // pages through cursor-based pagination so a few extra months of
  // events won't slow the first paint, and users were missing winter
  // events that fell outside the old 6-month horizon.
  const [filters, setFilters] = useState<EventFilters>({ ...initialFilters });

  // Single-state shim for child components taking a `Bundesland` prop. When the
  // "nur Österreich" toggle is OFF and no specific state is picked, use the
  // AT+DE+CH pseudo-region so the map mask + view expand to all three countries.
  const bundesland = useMemo(() => {
    if (filters.atOnly === false && (bundeslandIds[0] ?? 'all') === 'all') {
      return BUNDESLAENDER.find((b) => b.id === 'at-de-ch') ?? primaryBundesland;
    }
    return primaryBundesland;
  }, [filters.atOnly, bundeslandIds, primaryBundesland]);

  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [apiTotalCount, setApiTotalCount] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Lazy-Batches-Zustand (fn-16 Liste): Cursor + Akkumulator überleben
  // zwischen loadMore()-Aufrufen; Filterwechsel setzt alles zurück.
  const [hasMoreBatches, setHasMoreBatches] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const lazyRef = useRef<{
    cursor: string;
    seen: Set<string>;
    acc: Event[];
    filtersWithBl: EventFilters;
    controller: AbortController;
  } | null>(null);

  // ── Data fetch (progressive batches, same shape as the old page) ───────
  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    // Multi-bundesland: send `bundeslands` (comma-separated) when the user
    // picked >1 region; otherwise the single `bundesland` param so the
    // server can short-circuit and use its idx_events_bundesland_start_date
    // single-eq path.
    const concrete = bundeslandIds.filter((b) => b !== 'all');
    if (concrete.length > 1) params.set('bundeslands', concrete.join(','));
    else params.set('bundesland', concrete[0] ?? 'all');
    // Country scope — default Austria; toggle off includes DE/CH (all sources).
    if (filters.atOnly === false) params.set('countries', 'AT,DE,CH');
    // Slim payload — list + markers only need ~17 fields.
    params.set('slim', 'true');
    if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
    else if (filters.categories && filters.categories.length > 0) params.set('categories', filters.categories.join(','));
    else if (filters.category) params.set('category', filters.category);
    if (filters.districts && filters.districts.length > 0) params.set('districts', filters.districts.join(','));
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.priceMin !== undefined) params.set('priceMin', String(filters.priceMin));
    if (filters.priceMax !== undefined) params.set('priceMax', String(filters.priceMax));
    if (filters.search) params.set('search', filters.search);
    if (filters.bbox) params.set('bbox', filters.bbox.join(','));
    if (filters.placeName) params.set('placeName', filters.placeName);
    if (filters.placePostalCode) params.set('placePostalCode', filters.placePostalCode);
    if (filters.eveningOnly) params.set('eveningOnly', 'true');
    if (filters.sourceName) params.set('sourceName', filters.sourceName);
    if (filters.studentFriendly) params.set('studentFriendly', 'true');
    if (filters.familyFriendly) params.set('familyFriendly', 'true');
    if (filters.priceTiers && filters.priceTiers.length > 0) params.set('priceTiers', filters.priceTiers.join(','));
    else if (filters.priceTier) params.set('priceTier', filters.priceTier);
    // Sort signal — keyword search benefits from sort=relevance so the
    // best title/location matches surface first instead of by date.
    if (filters.sort) params.set('sort', filters.sort);
    return params;
  }, [filters, bundeslandIds]);

  const fetchEventsProgressive = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Filter-/Scope-Wechsel invalidiert eine laufende Lazy-Pagination.
    lazyRef.current = null;
    setHasMoreBatches(false);

    // Sync the parent-state bundesland selection into filters for cache+API
    // parity. Single concrete pick → use legacy `bundesland`; multi → use
    // `bundeslands`. Empty / 'all' → no filter (the cache key handles both).
    const concrete = bundeslandIds.filter((b) => b !== 'all');
    const filtersWithBl: EventFilters = {
      ...filters,
      ...(concrete.length === 1 ? { bundesland: concrete[0] } : {}),
      ...(concrete.length > 1 ? { bundeslands: concrete } : {}),
    };
    const cachedRaw = readCache(filtersWithBl);
    const cached = cachedRaw && cachedRaw.events.length > 0 ? cachedRaw : null;

    // Hard reset on cache miss — the previous "stale-while-revalidate"
    // approach left allEvents from the OLD bundesland in state, which
    // when combined with an aborted-mid-flight new fetch could leave
    // the page on "Keine Events gefunden" indefinitely. Clear instead
    // so the skeleton renders cleanly until the new fetch resolves.
    if (cached) {
      setAllEvents(cached.events as unknown as Event[]);
      setApiTotalCount(cached.total);
      setLoading(false);
    } else {
      setLoading(true);
      setAllEvents([]);
      setApiTotalCount(null);
    }

    // Expose state to the console for live debugging when "0 Events"
    // shows up unexpectedly. Type window.__lasstreffenDebug in console.
    if (typeof window !== 'undefined') {
      (window as unknown as { __lasstreffenDebug?: unknown }).__lasstreffenDebug = {
        bundeslandIds,
        primaryBundesland: bundesland.id,
        filters,
        filtersWithBl,
        cacheHit: !!cached,
        controllerId: controller,
      };
    }

    // fn-16 Points-Modus (nur Karte): ein kompakter Snapshot deckt den
    // kompletten AT-Bestand ab — Bundesland/District/Kategorie/Datum/
    // Tier/Flags filtern die Memos unten client-seitig, Filterwechsel
    // kostet daher KEINEN Netzwerk-Roundtrip (Modul-Cache 15 min).
    // Fehler/leerer Snapshot → weiter unten regulärer Batch-Pfad.
    if (mapPoints && pointsEligible(filters)) {
      const points = await fetchMapPointEvents();
      if (controller.signal.aborted || abortRef.current !== controller) return;
      if (points && points.length > 0) {
        setAllEvents(points);
        setApiTotalCount(points.length);
        setLoading(false);
        return;
      }
    }

    // MUSS mit warm-cache cron's limit param matchen — sonst hat das UI
    // einen anderen Edge-Cache-Key als der gewärmte Cache und jeder
    // Request triggert eine Cold-Path-DB-Query. 3000 deckt alle aktuell
    // gemessenen (bundesland × category) Counts ab; größere Kombis
    // paginieren via cursor in den Background-Batches unten weiter.
    const BATCH_SIZE = 3000;
    let acc: Event[] = [];
    let finalTotal: number | null = null;

    try {
      const firstParams = buildParams();
      firstParams.set('limit', String(BATCH_SIZE));
      // Default cache mode → Browser/CDN dürfen die Server-Edge-Cache-Header
      // (s-maxage=60, stale-while-revalidate=300) respektieren. AbortController
      // + Generation-Guard unten verhindern stale-state-overwrites; der Cache
      // ist nur eine Liefer-Optimierung, kein Konsistenz-Mechanismus.
      const firstRes = await fetch(`/api/events?${firstParams.toString()}`, {
        signal: controller.signal,
      });
      // Generation guard: if the user changed filters during the await,
      // abortRef now points at a NEW controller. This response is stale
      // — bail before touching state so we don't overwrite the new
      // fetch's results with old-bundesland events.
      if (controller.signal.aborted || abortRef.current !== controller) return;
      if (!firstRes.ok) throw new Error(`HTTP ${firstRes.status}`);
      const firstData = await firstRes.json();
      if (controller.signal.aborted || abortRef.current !== controller) return;
      const firstEvents: Event[] = firstData.events || [];

      setAllEvents(firstEvents);
      if (typeof firstData.total === 'number') {
        setApiTotalCount(firstData.total);
        finalTotal = firstData.total;
      }
      setLoading(false);

      // Write cache after the very first batch too — that way a quick
      // navigate-away-and-back hits the cache for the first 10k events
      // instead of restarting the 30s+ batch loop. The background loop
      // below will overwrite with the full set when it completes.
      writeCache(filtersWithBl, firstEvents, finalTotal);

      if (!firstData.hasMore && firstEvents.length < BATCH_SIZE) {
        return;
      }

      // fn-16 Lazy-Modus (Liste): NICHT alle Batches durchladen — Cursor
      // merken, loadMore() holt den nächsten erst am Listenende. Die
      // Hintergrund-Vollschleife unten bleibt der Pfad für Konsumenten
      // ohne lazyBatches.
      if (lazyBatches) {
        const cursor0: string | null = firstData.nextCursor || null;
        if (cursor0) {
          lazyRef.current = {
            cursor: cursor0,
            seen: new Set(firstEvents.map((e) => e.id)),
            acc: [...firstEvents],
            filtersWithBl,
            controller,
          };
          setHasMoreBatches(true);
        }
        return;
      }

      setBackgroundLoading(true);

      const seen = new Set(firstEvents.map((e) => e.id));
      acc = [...firstEvents];
      let cursor: string | null = firstData.nextCursor || null;

      while (cursor) {
        if (controller.signal.aborted || abortRef.current !== controller) break;

        const params = buildParams();
        params.set('limit', String(BATCH_SIZE));
        params.set('cursor', cursor);

        const res = await fetch(`/api/events?${params.toString()}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted || abortRef.current !== controller) break;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (controller.signal.aborted || abortRef.current !== controller) break;

        const batch: Event[] = data.events || [];
        if (batch.length === 0) break;

        const unique = batch.filter((e) => !seen.has(e.id));
        for (const e of unique) seen.add(e.id);
        acc = [...acc, ...unique];
        setAllEvents(acc);

        cursor = data.nextCursor || null;
        if (batch.length < BATCH_SIZE) break;
      }

      // Persist the full freshly-loaded set so the next navigation hits
      // the cache instead of waiting on the network.
      writeCache(filtersWithBl, acc, finalTotal);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        if (process.env.NODE_ENV === 'development') console.error('Fehler beim Laden der Events:', err);
      }
    } finally {
      setLoading(false);
      setBackgroundLoading(false);
    }
  }, [buildParams, filters, bundeslandIds, bundesland.id, mapPoints, lazyBatches]);

  useEffect(() => {
    fetchEventsProgressive();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchEventsProgressive]);

  // fn-16 Lazy-Modus: EINEN weiteren Batch holen (IntersectionObserver am
  // Listenende triggert das). Generation-Guard wie im Haupt-Fetch — nach
  // Filterwechsel zeigt abortRef auf einen neuen Controller und der
  // Aufruf verpufft.
  const loadMore = useCallback(async () => {
    const ctx = lazyRef.current;
    if (!ctx || loadingMore) return;
    if (ctx.controller.signal.aborted || abortRef.current !== ctx.controller) return;
    setLoadingMore(true);
    try {
      const params = buildParams();
      params.set('limit', '3000'); // = BATCH_SIZE des Erst-Fetches (Edge-Cache-Key-Parität)
      params.set('cursor', ctx.cursor);
      const res = await fetch(`/api/events?${params.toString()}`, { signal: ctx.controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (ctx.controller.signal.aborted || abortRef.current !== ctx.controller) return;
      const batch: Event[] = data.events || [];
      const unique = batch.filter((e) => !ctx.seen.has(e.id));
      for (const e of unique) ctx.seen.add(e.id);
      ctx.acc = [...ctx.acc, ...unique];
      setAllEvents(ctx.acc);
      writeCache(ctx.filtersWithBl, ctx.acc, null);
      const next: string | null = data.nextCursor || null;
      if (!next || batch.length === 0) {
        lazyRef.current = null;
        setHasMoreBatches(false);
      } else {
        ctx.cursor = next;
      }
    } catch {
      // Abbruch/Netzfehler — Sentinel triggert bei Bedarf erneut.
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, loadingMore]);

  // ── Client-side filtering pipeline ────────────────────────────────────
  const bundeslandEvents = useMemo(() => {
    const concrete = bundeslandIds.filter((b) => b !== 'all');
    if (concrete.length === 0) return allEvents;
    const targets = new Set(concrete);
    return allEvents.filter((e) => {
      const id = bundeslandToId(e.bundesland);
      return id != null && targets.has(id);
    });
  }, [allEvents, bundeslandIds]);

  const dedupedEvents = useMemo(() => {
    const seen = new Set<string>();
    return bundeslandEvents.filter((e) => {
      // Points-Modus: Punkte haben KEINEN Titel — der Key wäre '::datum'
      // und würde alle Events eines Tages zu einem kollabieren. Punkte
      // sind serverseitig schon eindeutig (MV, ein Row pro Event).
      if (!e.title) return true;
      const key = `${e.title.trim().toLowerCase()}::${(e.start_date || '').split('T')[0]}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [bundeslandEvents]);

  const finalEvents = useMemo(() => {
    let out = dedupedEvents;
    // Multi-district takes precedence; fall back to legacy single field.
    const districtList = filters.districts && filters.districts.length > 0
      ? filters.districts
      : filters.district ? [filters.district] : null;
    if (districtList) {
      const targets = new Set(districtList.map((d) => d.toLowerCase()));
      out = out.filter((e) => targets.has((e.district ?? '').toLowerCase()));
    }
    // Multi-category client-side filter (server already filtered, but
    // belt-and-suspenders for cache hits where the request shape differs).
    const catList = filters.categories && filters.categories.length > 0
      ? filters.categories
      : filters.category ? [filters.category] : null;
    if (catList) {
      const targets = new Set(catList);
      out = out.filter((e) => e.category != null && targets.has(e.category));
    }
    // Multi-priceTier client-side
    const ptList = filters.priceTiers && filters.priceTiers.length > 0
      ? filters.priceTiers
      : filters.priceTier ? [filters.priceTier] : null;
    if (ptList) {
      const targets = new Set<string>(ptList);
      out = out.filter((e) => {
        // Slim payload (CachedEvent) doesn't include price_tier — keep
        // the row when missing instead of dropping. Server-side filter
        // is the authoritative one for this field.
        const pt = (e as { price_tier?: string }).price_tier;
        return pt == null || targets.has(pt);
      });
    }
    // fn-16: Datum + Student/Family client-seitig. Im Batch-Modus hat der
    // Server das schon gefiltert (belt-and-suspenders, gleiche Semantik:
    // Tagesvergleich auf YYYY-MM-DD); im Points-Modus ist DAS der Filter.
    // Felder, die der Payload nicht kennt (undefined), lassen die Zeile
    // durch — Muster wie bei price_tier oben.
    if (filters.dateFrom) {
      const from = filters.dateFrom.slice(0, 10);
      out = out.filter((e) => !e.start_date || e.start_date.slice(0, 10) >= from);
    }
    if (filters.dateTo) {
      const to = filters.dateTo.slice(0, 10);
      out = out.filter((e) => !e.start_date || e.start_date.slice(0, 10) <= to);
    }
    if (filters.studentFriendly) {
      out = out.filter((e) => {
        const v = (e as { is_student_friendly?: boolean }).is_student_friendly;
        return v == null || v === true;
      });
    }
    if (filters.familyFriendly) {
      out = out.filter((e) => {
        const v = (e as { is_family_friendly?: boolean }).is_family_friendly;
        return v == null || v === true;
      });
    }
    return out;
  }, [dedupedEvents, filters.district, filters.districts, filters.category, filters.categories, filters.priceTier, filters.priceTiers, filters.dateFrom, filters.dateTo, filters.studentFriendly, filters.familyFriendly]);

  // Category counts for the FilterDrawer — fed off the post-deduplication,
  // pre-category-filter set so each chip shows its own contribution.
  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of dedupedEvents) {
      const c = e.category;
      if (c) m[c] = (m[c] || 0) + 1;
    }
    return m;
  }, [dedupedEvents]);

  // Trust the API count only when neither client-side narrower (district
  // multi or single, category multi) is active.
  const hasClientNarrower =
    !!filters.district ||
    (filters.districts && filters.districts.length > 0) ||
    (filters.categories && filters.categories.length > 0);
  const totalMatchCount =
    bundeslandIds.includes('all') && !hasClientNarrower ? apiTotalCount : null;

  // Scope label priority — show the most specific dimension the user
  // narrowed by, falling back outward:
  //   1. Free-text search → quote the term ("kirtag")
  //   2. District(s) selection → "Graz (Stadt)" / "2 Bezirke"
  //   3. Bundesland(s) selection → "Wien" / "2 Regionen"
  //   4. default → "Österreich"
  // Without (1) the headline of a kirtag-search read "Niederösterreich"
  // because of a stale scope — confusing.
  const scopeLabel = useMemo(() => {
    if (filters.search && filters.search.trim()) return `„${filters.search.trim()}"`;
    const districtList = filters.districts && filters.districts.length > 0
      ? filters.districts
      : filters.district ? [filters.district] : [];
    if (districtList.length === 1) return displayDistrictName(districtList[0]);
    if (districtList.length > 1) return `${districtList.length} Bezirke`;
    const concrete = bundeslandIds.filter((b) => b !== 'all');
    if (concrete.length === 0) return 'Österreich';
    if (concrete.length === 1) {
      return BUNDESLAENDER.find((b) => b.id === concrete[0])?.name ?? concrete[0];
    }
    return `${concrete.length} Regionen`;
  }, [bundeslandIds, filters.search, filters.districts, filters.district]);

  return {
    filters,
    setFilters,
    bundeslandIds,
    setBundeslandIds,
    allEvents,
    finalEvents,
    loading,
    backgroundLoading,
    apiTotalCount,
    totalMatchCount,
    categoryCounts,
    scopeLabel,
    bundesland,
    loadMore,
    hasMoreBatches,
    loadingMore,
  };
}
