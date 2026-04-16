'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Event, EventFilters } from '@/types/events';
import { CategoryFilter } from '../Filters/CategoryFilter';
import { DistrictFilter } from '../Filters/DistrictFilter';
import { DateRangeFilter } from '../Filters/DateRangeFilter';
import { BUNDESLAENDER, type Bundesland } from '@/lib/bundeslaender';
import { trackEvent } from '@/lib/analytics';

interface FilterPanelProps {
  filters: EventFilters;
  onFiltersChange: (f: EventFilters) => void;
  bundesland: Bundesland;
  onBundeslandChange: (bl: Bundesland) => void;
  events: Event[];
  eveningMode?: boolean;
  /** Render extras for the fullscreen overlay (wider columns, search input, etc.) */
  expanded?: boolean;
}

export function FilterPanel({
  filters,
  onFiltersChange,
  bundesland,
  onBundeslandChange,
  events,
  eveningMode,
  expanded = false,
}: FilterPanelProps) {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (!e.tags) continue;
      for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([tag, count]) => ({ tag, count }));
  }, [events]);

  const activeTags = new Set(filters.tags ?? []);

  const toggleTag = (tag: string) => {
    const next = new Set(activeTags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    trackEvent('filter_change', { filter_type: 'tag', value: tag });
    onFiltersChange({
      ...filters,
      tags: next.size > 0 ? Array.from(next) : undefined,
      category: next.size > 0 ? undefined : filters.category,
    });
  };

  const setPrice = (min?: number, max?: number) => {
    onFiltersChange({
      ...filters,
      priceMin: min,
      priceMax: max,
    });
  };

  const toggleEvening = () => {
    trackEvent('filter_change', { filter_type: 'eveningOnly', value: (!filters.eveningOnly).toString() });
    onFiltersChange({ ...filters, eveningOnly: !filters.eveningOnly });
  };

  const clearAll = () => {
    const defaultDateTo = new Date();
    defaultDateTo.setMonth(defaultDateTo.getMonth() + 6);
    onFiltersChange({ dateTo: defaultDateTo.toISOString().slice(0, 10) });
  };

  const activeCount = [
    filters.category,
    filters.district,
    filters.dateFrom,
    filters.search,
    filters.priceMin !== undefined,
    filters.priceMax !== undefined,
    filters.eveningOnly,
    filters.tags && filters.tags.length > 0,
  ].filter(Boolean).length;

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
      transition={enter}
      className={`flex flex-col h-full overflow-y-auto custom-scrollbar border-r ${
        eveningMode
          ? 'bg-gray-900/40 border-gray-700/40'
          : 'bg-slate-50/60 border-slate-200/70'
      }`}
    >
      <div className={`px-4 pt-3 pb-2 flex items-center justify-between border-b ${
        eveningMode ? 'border-gray-700/40' : 'border-slate-200/70'
      }`}>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${
            eveningMode ? 'text-gray-300' : 'text-slate-600'
          }`}>
            Filter
          </p>
          <p className={`text-[10px] mt-0.5 ${
            eveningMode ? 'text-gray-500' : 'text-slate-400'
          }`}>
            {activeCount > 0 ? `${activeCount} aktiv` : 'Keine Filter aktiv'}
          </p>
        </div>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className={`text-[11px] font-medium px-2 py-1 rounded-md transition-colors ${
              eveningMode
                ? 'text-amber-400 hover:bg-amber-900/20'
                : 'text-blue-600 hover:bg-blue-50'
            }`}
          >
            Zurücksetzen
          </button>
        )}
      </div>

      <div className="flex-1 px-4 py-3 space-y-4">
        <Section title="Kategorie" eveningMode={eveningMode}>
          <CategoryFilter
            value={filters.category}
            onChange={(category) => {
              if (category) trackEvent('filter_change', { filter_type: 'category', value: category });
              onFiltersChange({ ...filters, category, tags: undefined });
            }}
            eveningMode={eveningMode}
          />
        </Section>

        <Section title="Bundesland" eveningMode={eveningMode}>
          <select
            value={bundesland.id}
            onChange={(e) => {
              const next = BUNDESLAENDER.find(b => b.id === e.target.value);
              if (next) {
                trackEvent('filter_change', { filter_type: 'bundesland', value: next.name });
                onBundeslandChange(next);
              }
            }}
            style={eveningMode ? { colorScheme: 'dark' } : undefined}
            className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 appearance-none cursor-pointer transition-all duration-200 ${
              eveningMode
                ? bundesland.id !== 'all'
                  ? 'border-amber-500/30 bg-amber-900/10 text-amber-200 focus:ring-amber-500/50'
                  : 'border-gray-700 bg-gray-800/50 text-gray-300 focus:ring-gray-600'
                : bundesland.id !== 'all'
                  ? 'border-slate-800 bg-slate-800 text-white focus:ring-slate-600'
                  : 'border-slate-200 bg-white text-slate-600 focus:ring-slate-400'
            }`}
          >
            {BUNDESLAENDER.map(bl => (
              <option key={bl.id} value={bl.id}>{bl.name}</option>
            ))}
          </select>
        </Section>

        <Section title="Bezirk" eveningMode={eveningMode}>
          <DistrictFilter
            value={filters.district}
            onChange={(district) => {
              if (district) trackEvent('filter_change', { filter_type: 'district', value: district });
              onFiltersChange({ ...filters, district });
            }}
            bundeslandId={bundesland.id}
            eveningMode={eveningMode}
          />
          {bundesland.id === 'all' && (
            <p className={`text-[10px] mt-1 ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`}>
              Bundesland wählen, um Bezirke zu filtern
            </p>
          )}
        </Section>

        <Section title="Datum" eveningMode={eveningMode}>
          <DateRangeFilter
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onChange={(dateFrom, dateTo) => {
              if (dateFrom) trackEvent('filter_change', { filter_type: 'date', value: `${dateFrom}-${dateTo}` });
              onFiltersChange({ ...filters, dateFrom, dateTo });
            }}
            eveningMode={eveningMode}
          />
        </Section>

        <Section title="Preis (€)" eveningMode={eveningMode}>
          <div className="flex items-center gap-2">
            <NumberInput
              value={filters.priceMin}
              placeholder="Min"
              onChange={(v) => setPrice(v, filters.priceMax)}
              eveningMode={eveningMode}
            />
            <span className={`text-xs ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`}>–</span>
            <NumberInput
              value={filters.priceMax}
              placeholder="Max"
              onChange={(v) => setPrice(filters.priceMin, v)}
              eveningMode={eveningMode}
            />
          </div>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {[
              { label: 'Gratis', min: 0, max: 0 },
              { label: '< 10 €', min: undefined, max: 10 },
              { label: '< 25 €', min: undefined, max: 25 },
              { label: '< 50 €', min: undefined, max: 50 },
            ].map((p) => {
              const active = filters.priceMin === p.min && filters.priceMax === p.max;
              return (
                <button
                  key={p.label}
                  onClick={() => setPrice(active ? undefined : p.min, active ? undefined : p.max)}
                  className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                    active
                      ? eveningMode
                        ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/30'
                        : 'bg-slate-800 text-white'
                      : eveningMode
                        ? 'bg-gray-800/60 text-gray-400 hover:text-gray-200'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Nachts" eveningMode={eveningMode}>
          <label className={`flex items-center gap-2 cursor-pointer text-sm ${
            eveningMode ? 'text-gray-300' : 'text-slate-700'
          }`}>
            <input
              type="checkbox"
              checked={!!filters.eveningOnly}
              onChange={toggleEvening}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Nur Abend-Events (ab 18 Uhr)</span>
          </label>
        </Section>

        {topTags.length > 0 && (
          <Section title="Tags" eveningMode={eveningMode}>
            <div className="flex flex-wrap gap-1.5">
              {topTags.map(({ tag, count }) => {
                const active = activeTags.has(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-[11px] px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                      active
                        ? eveningMode
                          ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/30'
                          : 'bg-blue-600 text-white'
                        : eveningMode
                          ? 'bg-gray-800/60 text-gray-400 hover:text-gray-200 ring-1 ring-gray-700/50'
                          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{tag}</span>
                    <span className={`text-[9px] opacity-70 ${active ? '' : eveningMode ? 'text-gray-500' : 'text-slate-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </motion.div>
  );
}

function Section({
  title,
  eveningMode,
  children,
}: {
  title: string;
  eveningMode?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${
        eveningMode ? 'text-gray-500' : 'text-slate-500'
      }`}>
        {title}
      </p>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  placeholder,
  onChange,
  eveningMode,
}: {
  value: number | undefined;
  placeholder: string;
  onChange: (v: number | undefined) => void;
  eveningMode?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? undefined : Math.max(0, Number(v)));
      }}
      className={`w-full text-sm px-2.5 py-1.5 rounded-md border transition-colors focus:outline-none focus:ring-2 ${
        eveningMode
          ? 'bg-gray-800/50 border-gray-700 text-gray-200 placeholder-gray-500 focus:ring-amber-400/30 focus:border-amber-400/40'
          : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400 focus:ring-blue-500/30 focus:border-blue-400'
      }`}
    />
  );
}
