import type { Category } from '@/types/events';

/**
 * Canonical categories used across the UI.
 * Every event category must normalize to one of these.
 */
export type CanonicalCategory =
  | 'Musik'
  | 'Nightlife'
  | 'Wein & Kulinarik'
  | 'Kultur'
  | 'Märkte'
  | 'Sport'
  | 'Familie'
  | 'Natur'
  | 'Feste & Brauchtum'
  | 'Bildung'
  | 'Gesundheit'
  | 'Religion'
  | 'Wirtschaft'
  | 'Sonstiges';

export interface CategoryMeta {
  label: string;
  /** Light-mode badge Tailwind classes */
  badgeLight: string;
  /** Dark-mode badge Tailwind classes */
  badgeDark: string;
  /** CSS hex color for borders/indicators */
  borderColor: string;
  /** RGB triplet string for glow effects (e.g. "168,85,247") */
  glowRgb: string;
  /** Slug used in /images/categories/{slug}-{1..5}.jpg */
  fallbackSlug: string;
}

const META: Record<CanonicalCategory, CategoryMeta> = {
  'Musik': {
    label: 'Musik',
    badgeLight: 'bg-purple-100 text-purple-700',
    badgeDark: 'bg-purple-900/50 text-purple-300',
    borderColor: '#a855f7',
    glowRgb: '168,85,247',
    fallbackSlug: 'musik',
  },
  'Nightlife': {
    label: 'Nightlife',
    badgeLight: 'bg-violet-100 text-violet-700',
    badgeDark: 'bg-violet-900/50 text-violet-300',
    borderColor: '#8b5cf6',
    glowRgb: '139,92,246',
    fallbackSlug: 'rave',
  },
  'Wein & Kulinarik': {
    label: 'Wein & Kulinarik',
    badgeLight: 'bg-rose-100 text-rose-700',
    badgeDark: 'bg-rose-900/50 text-rose-300',
    borderColor: '#f43f5e',
    glowRgb: '244,63,94',
    fallbackSlug: 'wein',
  },
  'Kultur': {
    label: 'Kultur',
    badgeLight: 'bg-amber-100 text-amber-700',
    badgeDark: 'bg-amber-900/50 text-amber-300',
    borderColor: '#f59e0b',
    glowRgb: '245,158,11',
    fallbackSlug: 'kultur',
  },
  'Märkte': {
    label: 'Märkte',
    badgeLight: 'bg-green-100 text-green-700',
    badgeDark: 'bg-green-900/50 text-green-300',
    borderColor: '#22c55e',
    glowRgb: '34,197,94',
    fallbackSlug: 'maerkte',
  },
  'Sport': {
    label: 'Sport',
    badgeLight: 'bg-blue-100 text-blue-700',
    badgeDark: 'bg-blue-900/50 text-blue-300',
    borderColor: '#3b82f6',
    glowRgb: '59,130,246',
    fallbackSlug: 'sport',
  },
  'Familie': {
    label: 'Familie',
    badgeLight: 'bg-pink-100 text-pink-700',
    badgeDark: 'bg-pink-900/50 text-pink-300',
    borderColor: '#ec4899',
    glowRgb: '236,72,153',
    fallbackSlug: 'familie',
  },
  'Natur': {
    label: 'Natur',
    badgeLight: 'bg-emerald-100 text-emerald-700',
    badgeDark: 'bg-emerald-900/50 text-emerald-300',
    borderColor: '#10b981',
    glowRgb: '16,185,129',
    fallbackSlug: 'natur',
  },
  'Feste & Brauchtum': {
    label: 'Feste & Brauchtum',
    badgeLight: 'bg-red-100 text-red-700',
    badgeDark: 'bg-red-900/50 text-red-300',
    borderColor: '#ef4444',
    glowRgb: '239,68,68',
    fallbackSlug: 'default',
  },
  'Bildung': {
    label: 'Bildung',
    badgeLight: 'bg-indigo-100 text-indigo-700',
    badgeDark: 'bg-indigo-900/50 text-indigo-300',
    borderColor: '#6366f1',
    glowRgb: '99,102,241',
    fallbackSlug: 'default',
  },
  'Gesundheit': {
    label: 'Gesundheit',
    badgeLight: 'bg-teal-100 text-teal-700',
    badgeDark: 'bg-teal-900/50 text-teal-300',
    borderColor: '#14b8a6',
    glowRgb: '20,184,166',
    fallbackSlug: 'default',
  },
  'Religion': {
    label: 'Religion',
    badgeLight: 'bg-yellow-100 text-yellow-700',
    badgeDark: 'bg-yellow-900/50 text-yellow-300',
    borderColor: '#eab308',
    glowRgb: '234,179,8',
    fallbackSlug: 'default',
  },
  'Wirtschaft': {
    label: 'Wirtschaft',
    badgeLight: 'bg-slate-100 text-slate-700',
    badgeDark: 'bg-slate-700 text-slate-300',
    borderColor: '#64748b',
    glowRgb: '100,116,139',
    fallbackSlug: 'wirtschaft',
  },
  'Sonstiges': {
    label: 'Sonstiges',
    badgeLight: 'bg-slate-100 text-slate-700',
    badgeDark: 'bg-gray-700 text-gray-300',
    borderColor: '#94a3b8',
    glowRgb: '148,163,184',
    fallbackSlug: 'default',
  },
};

/**
 * Alias map: maps legacy / alternate spellings to canonical category.
 * Covers known drift: Rave->Nightlife, Maerkte/Markte/Märkte->Märkte.
 */
const ALIASES: Record<string, CanonicalCategory> = {
  'Rave': 'Nightlife',
  'Maerkte': 'Märkte',
  'Markte': 'Märkte',
  // 'Märkte' is already canonical — no alias needed
};

/**
 * Normalize any category string to its canonical form.
 * Unknown values fall back to 'Sonstiges'.
 */
export function normalizeEventCategory(input: string | null | undefined): CanonicalCategory {
  if (!input) return 'Sonstiges';
  const trimmed = input.trim();
  // Check alias first
  if (trimmed in ALIASES) return ALIASES[trimmed];
  // Check if it's already a canonical category
  if (trimmed in META) return trimmed as CanonicalCategory;
  return 'Sonstiges';
}

/**
 * Get full metadata for a category (normalizes input automatically).
 */
export function getCategoryMeta(input: string | null | undefined): CategoryMeta {
  return META[normalizeEventCategory(input)];
}

/**
 * Get badge classes for a given category, respecting light/dark mode.
 * Convenience wrapper for the most common UI use case.
 */
export function getCategoryBadgeClass(input: string | null | undefined, dark?: boolean): string {
  const meta = getCategoryMeta(input);
  return dark ? meta.badgeDark : meta.badgeLight;
}

/**
 * All canonical categories for iteration.
 */
export const ALL_CATEGORIES = Object.keys(META) as CanonicalCategory[];

/**
 * Exported for testing / advanced use cases only.
 */
export { META as CATEGORY_META_MAP, ALIASES as CATEGORY_ALIASES };
