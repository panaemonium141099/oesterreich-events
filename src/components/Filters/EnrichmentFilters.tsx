'use client';

/**
 * Quick-filter chips for the Claude-enrichment attributes.
 *
 * These surface the most-useful wizard-y filters at the top of the Map UI:
 *   - Studentfreundlich  (one-click boolean)
 *   - Familienfreundlich (one-click boolean)
 *   - Preis-Stufe         (gratis / günstig / mittel / premium)
 *
 * Deeper dimensions (audience / vibe / setting / tags) live behind the
 * wizard flow that's planned for Phase 2 — not exposed as direct chips
 * because the full 180-tag vocabulary would overwhelm the filter bar.
 *
 * Only renders filters that have data (post-enrichment). Before the first
 * enrichment run, these are no-ops on the API side but still visible so
 * users notice the feature.
 */

import type { EventFilters } from '@/types/events';
import { trackEvent } from '@/lib/analytics';

type PriceTier = NonNullable<EventFilters['priceTier']>;

interface Props {
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  eveningMode?: boolean;
}

const PRICE_TIER_LABELS: Record<PriceTier, string> = {
  gratis: 'Gratis',
  'günstig': 'Günstig',
  mittel: 'Mittel',
  premium: 'Premium',
  unbekannt: 'Preis offen',
};

const PRICE_TIER_ORDER: PriceTier[] = ['gratis', 'günstig', 'mittel', 'premium'];

export function EnrichmentFilters({ filters, onFiltersChange, eveningMode }: Props) {
  const toggleStudent = () => {
    const next = !filters.studentFriendly;
    trackEvent('filter_change', { filter_type: 'student_friendly', value: next ? 'on' : 'off' });
    onFiltersChange({ ...filters, studentFriendly: next || undefined });
  };

  const toggleFamily = () => {
    const next = !filters.familyFriendly;
    trackEvent('filter_change', { filter_type: 'family_friendly', value: next ? 'on' : 'off' });
    onFiltersChange({ ...filters, familyFriendly: next || undefined });
  };

  const setPriceTier = (tier: PriceTier | null) => {
    trackEvent('filter_change', { filter_type: 'price_tier', value: tier ?? 'off' });
    onFiltersChange({ ...filters, priceTier: tier ?? undefined });
  };

  const chipBase = 'text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 cursor-pointer min-h-[44px] transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap';

  const activeClass = eveningMode
    ? 'border-amber-500/30 bg-amber-900/10 text-amber-200 focus:ring-amber-500/50'
    : 'border-slate-800 bg-slate-800 text-white focus:ring-slate-600';

  const inactiveClass = eveningMode
    ? 'border-gray-700 bg-gray-800/50 text-gray-300 focus:ring-gray-600 hover:bg-gray-700/50'
    : 'border-slate-200 bg-white text-slate-600 focus:ring-slate-400 hover:bg-slate-50';

  return (
    <>
      {/* Familienfreundlich */}
      <button
        onClick={toggleFamily}
        className={`${chipBase} ${filters.familyFriendly ? activeClass : inactiveClass}`}
        title="Nur Events, die ausdrücklich für Familien geeignet sind"
        aria-pressed={!!filters.familyFriendly}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        Familie
      </button>

      {/* Studentfreundlich */}
      <button
        onClick={toggleStudent}
        className={`${chipBase} ${filters.studentFriendly ? activeClass : inactiveClass}`}
        title="Nur Events für/an Unis oder mit Studenten-Ermäßigung"
        aria-pressed={!!filters.studentFriendly}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
        Studenten
      </button>

      {/* Preis-Stufen als Chip-Row — compact */}
      <div className="flex items-center gap-1.5">
        {PRICE_TIER_ORDER.map((tier) => {
          const active = filters.priceTier === tier;
          return (
            <button
              key={tier}
              onClick={() => setPriceTier(active ? null : tier)}
              className={`text-xs border rounded-lg px-2.5 py-2 min-h-[44px] transition-all duration-200 ${active ? activeClass : inactiveClass}`}
              title={`Preis-Kategorie: ${PRICE_TIER_LABELS[tier]}`}
              aria-pressed={active}
            >
              {PRICE_TIER_LABELS[tier]}
            </button>
          );
        })}
      </div>
    </>
  );
}
