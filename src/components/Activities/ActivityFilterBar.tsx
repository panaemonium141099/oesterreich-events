'use client';

/**
 * ActivityFilterBar — Filter-Modul der Uebersichtsseite /aktivitaeten
 * (ersetzt die drei Chip-Reihen Bundesland/Thema/Umgebung, 2026-09-15).
 *
 * Desktop (>= md): eine sticky Leiste unter dem Top-Nav mit Suchfeld,
 * Dropdown-Pills (Bundesland, Bezirk, Thema) und einem Indoor/Outdoor-
 * Segment. Dropdowns oeffnen als Popover direkt unter dem Pill, es ist
 * immer hoechstens eines offen; Klick ausserhalb und ESC schliessen.
 * Mobile (< md): Suchfeld + "Filter (n)"-Button, der ein Bottom-Sheet mit
 * denselben Bloecken oeffnet (Muster der Event-Filter). Darunter auf allen
 * Breiten: aktive Filter als entfernbare Pills + Trefferzahl.
 *
 * Bezirk setzt Bundesland voraus: der Bezirk-Pill ist ohne Bundesland
 * gedimmt und oeffnet stattdessen die Bundesland-Auswahl mit Hinweis;
 * angezeigt werden nur Bezirke mit Bestand (Facetten aus der View
 * poi_activity_bezirk_counts, 1 h gecacht), sonst die statische Liste.
 *
 * Reine Praesentation: der gesamte Filter-State liegt im Parent
 * (ActivitiesBrowser), Aenderungen gehen ueber `onChange` und greifen
 * sofort (Live-Filter, keine Draft-Kopie).
 *
 * Das Bottom-Sheet rendert per Portal in document.body: die Leiste hat
 * backdrop-filter, und ein backdrop-filter-Element wird zum Containing
 * Block fuer fixed-positionierte Nachfahren — das Sheet klebte sonst in
 * der Leiste statt am Viewport-Boden.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { CheckIcon, MapPinIcon, SearchIcon, SlidersIcon } from '@/components/UI/Icons';
import { activityTagLabel } from '@/lib/activities/tag-labels';
import type { ActivityBezirkCount } from '@/lib/activities/list-loaders';
import {
  ACTIVITY_FILTER_TAGS,
  EMPTY_ACTIVITY_FILTERS,
  countActiveFilters,
  normalizeActivitySearch,
  type ActivityListFilters,
  type ActivitySetting,
} from '@/lib/activities/list-query';
import { displayDistrictName, getDistrictsByBundesland } from '@/lib/districtsAT';

export interface BundeslandOption {
  id: string;
  name: string;
}

interface ActivityFilterBarProps {
  filters: ActivityListFilters;
  onChange: (next: ActivityListFilters) => void;
  bundeslaender: BundeslandOption[];
  /** Facetten (bundesland, bezirk, n); leer = Fallback auf statische Liste. */
  bezirkCounts: ActivityBezirkCount[];
  /** Trefferzahl der aktuellen Auswahl; null = unbekannt. */
  total: number | null;
  loading: boolean;
}

type PopoverId = 'bundesland' | 'bezirk' | 'thema';

interface BezirkOption {
  /** Kanonischer lowercase-Name (Filterwert). */
  value: string;
  label: string;
  /** null = keine Facetten verfuegbar. */
  count: number | null;
}

/** Freitext-Debounce: tippen ohne Request-Sturm, Enter feuert sofort. */
const SEARCH_DEBOUNCE_MS = 320;

export function ActivityFilterBar({
  filters,
  onChange,
  bundeslaender,
  bezirkCounts,
  total,
  loading,
}: ActivityFilterBarProps) {
  const t = useTranslations('Activities');
  const locale = useLocale();

  const [openPopover, setOpenPopover] = useState<PopoverId | null>(null);
  const [showBezirkHint, setShowBezirkHint] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── Ableitungen ─────────────────────────────────────────────────────────
  const activeCount = countActiveFilters(filters);
  const currentBundesland = bundeslaender.find((b) => b.id === filters.bundesland) ?? null;

  const bundeslandTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of bezirkCounts) map.set(row.bundesland, (map.get(row.bundesland) ?? 0) + row.n);
    return map;
  }, [bezirkCounts]);

  const bezirkOptions = useMemo<BezirkOption[]>(() => {
    if (!filters.bundesland) return [];
    const counts = new Map<string, number>();
    for (const row of bezirkCounts) {
      if (row.bundesland === filters.bundesland) counts.set(row.bezirk, row.n);
    }
    const hasFacets = bezirkCounts.length > 0;
    return getDistrictsByBundesland(filters.bundesland)
      .map((d) => ({
        value: d.name.toLowerCase(),
        label: displayDistrictName(d.name),
        count: hasFacets ? (counts.get(d.name.toLowerCase()) ?? 0) : null,
      }))
      // Mit Facetten nur Bezirke mit Bestand (gewaehlte bleiben sichtbar).
      .filter((o) => !hasFacets || (o.count ?? 0) > 0 || filters.bezirke.includes(o.value))
      .sort((a, b) => a.label.localeCompare(b.label, 'de'));
  }, [bezirkCounts, filters.bundesland, filters.bezirke]);

  const bezirkLabelByValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of bezirkOptions) map.set(o.value, o.label);
    return map;
  }, [bezirkOptions]);

  // ── Aenderungen ─────────────────────────────────────────────────────────
  const setBundesland = useCallback(
    (id: string | null) => {
      // Bundesland-Wechsel leert die Bezirke (sie gehoeren zum alten).
      onChange({ ...filters, bundesland: id, bezirke: [] });
      setShowBezirkHint(false);
    },
    [filters, onChange],
  );

  const toggleBezirk = useCallback(
    (value: string) => {
      const next = filters.bezirke.includes(value)
        ? filters.bezirke.filter((b) => b !== value)
        : [...filters.bezirke, value];
      onChange({ ...filters, bezirke: next });
    },
    [filters, onChange],
  );

  const setTag = useCallback(
    (tag: string | null) => onChange({ ...filters, tag }),
    [filters, onChange],
  );

  const setSetting = useCallback(
    (setting: ActivitySetting | null) => onChange({ ...filters, setting }),
    [filters, onChange],
  );

  const setSearch = useCallback(
    (q: string) => {
      const normalized = normalizeActivitySearch(q);
      if (normalized !== filters.q) onChange({ ...filters, q: normalized });
    },
    [filters, onChange],
  );

  const reset = useCallback(() => {
    onChange(EMPTY_ACTIVITY_FILTERS);
    setOpenPopover(null);
    setShowBezirkHint(false);
  }, [onChange]);

  /** Bezirk-Pill ohne Bundesland: statt tot zu sein, zur Bundesland-Wahl
   *  fuehren und dort erklaeren, warum. */
  const openBezirk = useCallback(() => {
    if (!filters.bundesland) {
      setShowBezirkHint(true);
      setOpenPopover((cur) => (cur === 'bundesland' ? null : 'bundesland'));
      return;
    }
    setShowBezirkHint(false);
    setOpenPopover((cur) => (cur === 'bezirk' ? null : 'bezirk'));
  }, [filters.bundesland]);

  const togglePopover = useCallback((id: PopoverId) => {
    setShowBezirkHint(false);
    setOpenPopover((cur) => (cur === id ? null : id));
  }, []);

  const closePopover = useCallback(() => {
    setOpenPopover(null);
    setShowBezirkHint(false);
  }, []);

  // ── Trefferzahl ─────────────────────────────────────────────────────────
  const countLabel = loading || total === null ? t('resultCountLoading') : t('resultCount', { count: total });

  // ── Aktive Pills ────────────────────────────────────────────────────────
  const activePills: Array<{ key: string; label: string; remove: () => void }> = [];
  if (filters.q) {
    activePills.push({
      key: 'q',
      label: t('searchPill', { q: filters.q }),
      remove: () => onChange({ ...filters, q: '' }),
    });
  }
  if (currentBundesland) {
    activePills.push({
      key: 'bl',
      label: currentBundesland.name,
      remove: () => setBundesland(null),
    });
  }
  for (const b of filters.bezirke) {
    activePills.push({
      key: `bz-${b}`,
      label: bezirkLabelByValue.get(b) ?? b,
      remove: () => toggleBezirk(b),
    });
  }
  if (filters.tag) {
    activePills.push({
      key: 'tag',
      label: activityTagLabel(filters.tag, locale),
      remove: () => setTag(null),
    });
  }
  if (filters.setting) {
    activePills.push({
      key: 'setting',
      label: filters.setting === 'indoor' ? t('settingIndoor') : t('settingOutdoor'),
      remove: () => setSetting(null),
    });
  }

  const bezirkPillLabel =
    filters.bezirke.length === 0
      ? filters.bundesland
        ? t('filterBezirkAll')
        : t('filterBezirk')
      : filters.bezirke.length === 1
        ? (bezirkLabelByValue.get(filters.bezirke[0]) ?? filters.bezirke[0])
        : t('filterBezirkSelected', { count: filters.bezirke.length });

  return (
    <section
      aria-label={t('filterTitle')}
      className="sticky top-16 z-20 -mx-4 md:-mx-14 px-4 md:px-14 py-3 mb-6 bg-black/85 backdrop-blur-md border-b border-white/[0.06]"
    >
      {/* ── Zeile 1: Suche + Controls ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={filters.q} onCommit={setSearch} />

        {/* Desktop-Controls */}
        <div className="hidden md:flex flex-wrap items-center gap-2">
          <FilterPill
            icon={<MapPinIcon size={15} />}
            label={currentBundesland ? currentBundesland.name : t('filterBundesland')}
            active={!!currentBundesland}
            open={openPopover === 'bundesland'}
            onToggle={() => togglePopover('bundesland')}
            onClose={closePopover}
            panelLabel={t('filterBundesland')}
          >
            {showBezirkHint && (
              <p className="px-3 pt-2 pb-2 text-[12.5px] leading-snug text-[var(--v4-match)]">
                {t('filterBezirkHint')}
              </p>
            )}
            <OptionRow
              selected={!filters.bundesland}
              onSelect={() => {
                setBundesland(null);
                closePopover();
              }}
              label={t('filterAllAustria')}
            />
            {bundeslaender.map((bl) => (
              <OptionRow
                key={bl.id}
                selected={filters.bundesland === bl.id}
                onSelect={() => {
                  setBundesland(bl.id);
                  closePopover();
                }}
                label={bl.name}
                count={bundeslandTotals.get(bl.id) ?? null}
              />
            ))}
          </FilterPill>

          <FilterPill
            label={bezirkPillLabel}
            active={filters.bezirke.length > 0}
            dimmed={!filters.bundesland}
            open={openPopover === 'bezirk'}
            onToggle={openBezirk}
            onClose={closePopover}
            panelLabel={t('filterBezirk')}
            multi
            header={
              currentBundesland ? (
                <div className="flex items-center justify-between gap-3 px-3 pt-2 pb-1.5">
                  <span className="min-w-0 truncate text-[11px] uppercase tracking-[0.14em] text-white/40">
                    {t('filterBezirkIn', { name: currentBundesland.name })}
                  </span>
                  {filters.bezirke.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onChange({ ...filters, bezirke: [] })}
                      className="shrink-0 whitespace-nowrap text-[12px] text-white/60 hover:text-white underline-offset-2 hover:underline"
                    >
                      {t('filterDeselectAll')}
                    </button>
                  )}
                </div>
              ) : null
            }
            footer={
              <div className="flex justify-end px-2 pt-1.5 pb-1">
                <button
                  type="button"
                  onClick={closePopover}
                  className="press-haptic h-8 px-3.5 rounded-full bg-white text-black text-[12.5px] font-semibold hover:bg-white/90 transition-colors"
                >
                  {t('filterDone')}
                </button>
              </div>
            }
          >
            {bezirkOptions.map((o) => (
              <OptionRow
                key={o.value}
                multi
                selected={filters.bezirke.includes(o.value)}
                onSelect={() => toggleBezirk(o.value)}
                label={o.label}
                count={o.count}
              />
            ))}
          </FilterPill>

          <FilterPill
            label={filters.tag ? activityTagLabel(filters.tag, locale) : t('filterTopic')}
            active={!!filters.tag}
            open={openPopover === 'thema'}
            onToggle={() => togglePopover('thema')}
            onClose={closePopover}
            panelLabel={t('filterTopic')}
          >
            <OptionRow
              selected={!filters.tag}
              onSelect={() => {
                setTag(null);
                closePopover();
              }}
              label={t('filterAllTopics')}
            />
            {ACTIVITY_FILTER_TAGS.map((tag) => (
              <OptionRow
                key={tag}
                selected={filters.tag === tag}
                onSelect={() => {
                  setTag(tag);
                  closePopover();
                }}
                label={activityTagLabel(tag, locale)}
              />
            ))}
          </FilterPill>

          <SettingSegment value={filters.setting} onChange={setSetting} />

          {activeCount > 0 && (
            <button
              type="button"
              onClick={reset}
              className="h-10 px-3 rounded-full text-[13px] text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              {t('filterReset')}
            </button>
          )}
        </div>

        {/* Mobile: Filter-Button */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          className={
            'md:hidden press-haptic inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full border text-[13px] font-medium transition-colors ' +
            (activeCount > 0
              ? 'bg-white text-black border-white'
              : 'bg-white/[0.04] text-white/85 border-white/10 hover:bg-white/[0.08]')
          }
        >
          <SlidersIcon size={15} />
          {t('filterButton')}
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-black text-white text-[11px] font-bold tabular-nums">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Zeile 2: aktive Pills + Trefferzahl ────────────────────────── */}
      <div className="mt-2.5 flex items-center justify-between gap-3 min-h-[28px]">
        <div className="flex flex-wrap items-center gap-1.5">
          {activePills.map((pill) => (
            <span
              key={pill.key}
              className="inline-flex items-center gap-0.5 h-7 pl-2.5 pr-1 rounded-full bg-white/[0.08] border border-white/10 text-[12px] text-white/85"
            >
              {pill.label}
              <button
                type="button"
                onClick={pill.remove}
                aria-label={t('removeFilter', { label: pill.label })}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white/50 hover:text-white hover:bg-white/15 transition-colors"
              >
                <CloseGlyph />
              </button>
            </span>
          ))}
          {activePills.length > 1 && (
            <button
              type="button"
              onClick={reset}
              className="md:hidden h-7 px-2 text-[12px] text-white/50 hover:text-white underline-offset-2 hover:underline"
            >
              {t('filterReset')}
            </button>
          )}
        </div>
        <p
          className={
            'shrink-0 text-[13px] tabular-nums transition-opacity ' +
            (loading ? 'text-white/40 animate-pulse' : 'text-white/60')
          }
          aria-live="polite"
        >
          {countLabel}
        </p>
      </div>

      {/* ── Mobile Bottom-Sheet ───────────────────────────────────────── */}
      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('filterTitle')}
        closeLabel={t('closeFilters')}
        resetLabel={t('filterReset')}
        onReset={reset}
        canReset={activeCount > 0}
        ctaLabel={
          loading || total === null
            ? t('filterShowResultsLoading')
            : t('filterShowResults', { count: total })
        }
      >
        <SheetBlock label={t('filterBundesland')}>
          <div className="flex flex-wrap gap-2">
            <SheetChip active={!filters.bundesland} onClick={() => setBundesland(null)}>
              {t('filterAllAustria')}
            </SheetChip>
            {bundeslaender.map((bl) => (
              <SheetChip
                key={bl.id}
                active={filters.bundesland === bl.id}
                onClick={() => setBundesland(filters.bundesland === bl.id ? null : bl.id)}
              >
                {bl.name}
              </SheetChip>
            ))}
          </div>
        </SheetBlock>

        <SheetBlock
          label={
            currentBundesland ? t('filterBezirkIn', { name: currentBundesland.name }) : t('filterBezirk')
          }
          action={
            filters.bezirke.length > 0 ? (
              <button
                type="button"
                onClick={() => onChange({ ...filters, bezirke: [] })}
                className="text-[12px] text-white/60 hover:text-white underline-offset-2 hover:underline"
              >
                {t('filterDeselectAll')}
              </button>
            ) : null
          }
        >
          {currentBundesland ? (
            <div className="flex flex-wrap gap-2">
              {bezirkOptions.map((o) => (
                <SheetChip
                  key={o.value}
                  active={filters.bezirke.includes(o.value)}
                  onClick={() => toggleBezirk(o.value)}
                  count={o.count}
                  multi
                >
                  {o.label}
                </SheetChip>
              ))}
            </div>
          ) : (
            <p className="text-[13px] leading-snug text-white/45">{t('filterBezirkHint')}</p>
          )}
        </SheetBlock>

        <SheetBlock label={t('filterTopic')}>
          <div className="flex flex-wrap gap-2">
            <SheetChip active={!filters.tag} onClick={() => setTag(null)}>
              {t('filterAllTopics')}
            </SheetChip>
            {ACTIVITY_FILTER_TAGS.map((tag) => (
              <SheetChip
                key={tag}
                active={filters.tag === tag}
                onClick={() => setTag(filters.tag === tag ? null : tag)}
              >
                {activityTagLabel(tag, locale)}
              </SheetChip>
            ))}
          </div>
        </SheetBlock>

        <SheetBlock label={t('filterSetting')}>
          <SettingSegment value={filters.setting} onChange={setSetting} grow />
        </SheetBlock>
      </FilterSheet>
    </section>
  );
}

// ── Suche ──────────────────────────────────────────────────────────────────

function SearchField({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const t = useTranslations('Activities');
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Externe Aenderung (Pill entfernt, Reset, URL-Hydration) -> Feld folgt.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const schedule = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(next), SEARCH_DEBOUNCE_MS);
  };

  const commitNow = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    onCommit(next);
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        commitNow(draft);
      }}
      className="flex items-center gap-2 h-10 pl-3.5 pr-1.5 rounded-full border border-white/10 bg-white/[0.04] focus-within:border-white/30 focus-within:bg-white/[0.06] transition-colors flex-1 min-w-[200px] md:max-w-[380px]"
    >
      <SearchIcon size={15} className="shrink-0 text-white/45" />
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          schedule(e.target.value);
        }}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[16px] md:text-[13.5px] text-white placeholder-white/40 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft('');
            commitNow('');
            inputRef.current?.focus();
          }}
          aria-label={t('searchClear')}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <CloseGlyph />
        </button>
      )}
    </form>
  );
}

// ── Dropdown-Pill mit Popover ──────────────────────────────────────────────

function FilterPill({
  icon,
  label,
  active,
  dimmed = false,
  open,
  onToggle,
  onClose,
  panelLabel,
  multi = false,
  header,
  footer,
  children,
}: {
  icon?: ReactNode;
  label: string;
  active: boolean;
  dimmed?: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  panelLabel: string;
  multi?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Klick ausserhalb + ESC schliessen; Fokus zurueck auf den Trigger.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={
          'press-haptic inline-flex items-center gap-1.5 h-10 pl-3.5 pr-3 rounded-full border text-[13px] font-medium whitespace-nowrap transition-colors ' +
          (active
            ? 'bg-white text-black border-white hover:bg-white/90'
            : dimmed
              ? 'bg-transparent text-white/40 border-white/10 border-dashed hover:text-white/60 hover:border-white/20'
              : 'bg-white/[0.04] text-white/85 border-white/10 hover:bg-white/[0.08] hover:border-white/20') +
          (open && !active ? ' border-white/30 bg-white/[0.08] text-white' : '')
        }
      >
        {icon && <span className={active ? 'text-black/70' : 'text-white/50'}>{icon}</span>}
        <span className="max-w-[180px] truncate">{label}</span>
        <ChevronGlyph open={open} />
      </button>

      {open && (
        <div
          id={panelId}
          role="listbox"
          aria-label={panelLabel}
          aria-multiselectable={multi || undefined}
          className={
            'animate-pop-in absolute left-0 top-[calc(100%+8px)] z-40 rounded-2xl border border-white/10 bg-[#141416] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.75)] p-1.5 ' +
            (multi ? 'w-[320px]' : 'w-[280px]')
          }
        >
          {header}
          <div className="max-h-[min(56vh,400px)] overflow-y-auto overscroll-contain pr-0.5">
            {children}
          </div>
          {footer}
        </div>
      )}
    </div>
  );
}

function OptionRow({
  selected,
  onSelect,
  label,
  count = null,
  multi = false,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  count?: number | null;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={
        'flex w-full items-center gap-3 px-3 py-2 rounded-xl text-left text-[13.5px] transition-colors ' +
        (selected ? 'bg-white/[0.09] text-white' : 'text-white/80 hover:bg-white/[0.06] hover:text-white')
      }
    >
      {multi ? (
        <span
          aria-hidden="true"
          className={
            'inline-flex items-center justify-center w-4 h-4 rounded-[5px] border shrink-0 transition-colors ' +
            (selected ? 'bg-white border-white text-black' : 'border-white/30')
          }
        >
          {selected && <CheckIcon size={11} strokeWidth={3} />}
        </span>
      ) : (
        <span aria-hidden="true" className="inline-flex w-4 h-4 items-center justify-center shrink-0">
          {selected && <CheckIcon size={14} strokeWidth={2.5} />}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {count !== null && (
        <span className="text-[12px] tabular-nums text-white/40 shrink-0">{count}</span>
      )}
    </button>
  );
}

// ── Indoor/Outdoor-Segment ─────────────────────────────────────────────────

function SettingSegment({
  value,
  onChange,
  grow = false,
}: {
  value: ActivitySetting | null;
  onChange: (v: ActivitySetting | null) => void;
  grow?: boolean;
}) {
  const t = useTranslations('Activities');
  const options: Array<{ value: ActivitySetting | null; label: string }> = [
    { value: null, label: t('filterAll') },
    { value: 'indoor', label: t('settingIndoor') },
    { value: 'outdoor', label: t('settingOutdoor') },
  ];
  return (
    <div
      role="group"
      aria-label={t('filterSetting')}
      className={
        'inline-flex h-10 p-1 rounded-full border border-white/10 bg-white/[0.04] ' + (grow ? 'w-full' : '')
      }
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={
              'press-haptic h-8 px-3.5 rounded-full text-[13px] font-medium transition-colors ' +
              (grow ? 'flex-1 ' : '') +
              (active ? 'bg-white text-black' : 'text-white/65 hover:text-white')
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Mobile Bottom-Sheet ───────────────────────────────────────────────────

function FilterSheet({
  open,
  onClose,
  title,
  closeLabel,
  resetLabel,
  onReset,
  canReset,
  ctaLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  resetLabel: string;
  onReset: () => void;
  canReset: boolean;
  ctaLabel: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  useEffect(() => setMounted(true), []);

  // Body-Scroll sperren + ESC schliessen, solange das Sheet offen ist.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="md:hidden">
      <div
        data-overlay-state="open"
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[60] bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-sheet-state="open"
        className="fixed inset-x-0 bottom-0 z-[61] flex max-h-[88vh] flex-col rounded-t-[28px] border-t border-white/10 bg-[#141416] shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/20" />
          <h2 id={titleId} className="pt-2 text-[16px] font-semibold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="mt-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <CloseGlyph size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onReset}
            disabled={!canReset}
            className="h-11 px-3 rounded-full text-[14px] text-white/70 hover:text-white disabled:opacity-40 disabled:hover:text-white/70"
          >
            {resetLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="press-haptic h-11 flex-1 max-w-[260px] rounded-full bg-white text-black text-[14px] font-semibold hover:bg-white/90 transition-colors"
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SheetBlock({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="pt-4 first:pt-1">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.14em] text-white/40">{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function SheetChip({
  active,
  onClick,
  count = null,
  multi = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number | null;
  multi?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        'press-haptic inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-[13px] transition-colors ' +
        (active
          ? 'bg-white text-black border-white'
          : 'bg-white/[0.04] text-white/80 border-white/10 hover:bg-white/[0.08]')
      }
    >
      {multi && active && <CheckIcon size={12} strokeWidth={3} />}
      {children}
      {count !== null && (
        <span className={'text-[11.5px] tabular-nums ' + (active ? 'text-black/50' : 'text-white/40')}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Glyphen ────────────────────────────────────────────────────────────────

function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={'shrink-0 opacity-70 transition-transform duration-200 ' + (open ? 'rotate-180' : '')}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CloseGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
