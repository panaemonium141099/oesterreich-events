/**
 * MapV3 (Variante A · Airbnb-clean) design tokens.
 *
 * Lifted verbatim from the Claude-Design mockup (`map-v3a.jsx`) so the
 * /map page matches the chosen direction pixel-perfectly. Light surface,
 * near-black ink, hairline borders, soft shadows — Airbnb-style.
 *
 * Stays separate from the global dark App-scope tokens because the user
 * picked a light-mode rebrand for the discovery surface specifically.
 */
export const T = {
  bg: '#ffffff',
  surface: '#ffffff',
  panel: '#f7f7f8',
  border: '#e6e7eb',
  borderHover: '#d4d6dc',
  ink: '#111114',
  ink70: 'rgba(17,17,20,0.70)',
  ink60: 'rgba(17,17,20,0.55)',
  ink50: 'rgba(17,17,20,0.45)',
  ink40: 'rgba(17,17,20,0.30)',
  shadow: '0 6px 20px rgba(17,17,20,0.08), 0 2px 6px rgba(17,17,20,0.04)',
  shadowL: '0 14px 36px rgba(17,17,20,0.14), 0 4px 12px rgba(17,17,20,0.06)',
  // Semantic accents — RSVP/today survive the light rebrand
  rsvpGoingBg: '#e6f4ec',
  rsvpGoingFg: '#0c7a47',
  rsvpMaybeBg: '#fff4e0',
  rsvpMaybeFg: '#9a6b00',
  rsvpInvitedBg: '#eef0f3',
  rsvpInvitedFg: '#383b42',
  todayDot: '#0c7a47',
} as const;

export const PRICE_TIERS: { id: 'gratis' | 'günstig' | 'mittel' | 'premium'; label: string }[] = [
  { id: 'gratis', label: 'Gratis' },
  { id: 'günstig', label: 'Günstig' },
  { id: 'mittel', label: 'Mittel' },
  { id: 'premium', label: 'Premium' },
];

/**
 * Quick-date presets for the "Wann" filter block. Mapped to dateFrom/dateTo
 * by helpers/applyDatePreset so the same chip selection works regardless of
 * which timezone the client sits in.
 */
export type DatePresetId = 'jetzt' | 'heute' | 'morgen' | 'wochenende' | 'woche' | 'custom';

export const DATE_PRESETS: { id: DatePresetId; label: string }[] = [
  { id: 'jetzt', label: 'Jetzt' },
  { id: 'heute', label: 'Heute' },
  { id: 'morgen', label: 'Morgen' },
  { id: 'wochenende', label: 'Wochenende' },
  { id: 'woche', label: 'Diese Woche' },
  { id: 'custom', label: 'Datum wählen' },
];

/**
 * Active count of meaningful filters. Used by the topbar Filter-button
 * badge so the user sees at a glance how many filters narrow the result.
 *
 * Counts mutually-exclusive groups as 1 (e.g. category XOR tags). dateTo
 * alone (the implicit 6-month horizon) does NOT count — only dateFrom or
 * an explicit dateTo override.
 */
import type { EventFilters } from '@/types/events';

export function countActiveFilters(f: EventFilters, defaultDateTo?: string): number {
  let n = 0;
  if (f.search) n++;
  if (f.dateFrom) n++;
  if (f.dateTo && f.dateTo !== defaultDateTo) n++;
  if (f.category || (f.tags && f.tags.length > 0)) n++;
  if (f.district) n++;
  if (f.bundesland && f.bundesland !== 'all') n++;
  if (f.studentFriendly) n++;
  if (f.familyFriendly) n++;
  if (f.priceTier) n++;
  if (f.priceMin != null || f.priceMax != null) n++;
  if (f.audience && f.audience.length > 0) n++;
  if (f.vibe && f.vibe.length > 0) n++;
  if (f.setting && f.setting.length > 0) n++;
  if (f.language) n++;
  return n;
}
