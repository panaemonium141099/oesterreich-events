/**
 * Trusted source_name → Category map (R6).
 *
 * Keys are the actual runtime `source_name` strings emitted by scrapers and
 * stored in the Supabase `events.source_name` column — NOT scraper class names.
 * Run `npx tsx --env-file=.env.local src/scripts/classifier-audit.ts` to
 * validate which entries here correspond to real runtime values.
 *
 * Rules:
 *   - A source belongs here only if its entire feed is unambiguously one
 *     category in the app's 14-category taxonomy.
 *   - Regional aggregators (`burgenland.info`, `wien-info`, `tips.at`,
 *     `ticketmaster`, `feverup`, `oeticket`, `meinbezirk`, `falter`,
 *     `events.at`, `wien-ogd`, `wien-gv`, …) are explicitly NOT trusted.
 *   - Matching is exact, case-insensitive (normalized via `normalizeText`).
 *   - No substring-match. No organizer/venue substring. That was a cat-v1 bug.
 */

import type { Category } from '@/types/events';
import { normalizeText } from './normalization';

/**
 * Seed trusted map. Each key must also exist in the runtime source_name
 * registry the audit script produces; callers validate that at startup.
 */
const TRUSTED_SOURCE_SEED: Record<string, Category> = {
  // Nightlife — dedicated club aggregators
  'wien-clubs': 'Nightlife',
  'graz-clubs': 'Nightlife',
  'salzburg-clubs': 'Nightlife',
  'linz-clubs': 'Nightlife',
  'innsbruck-clubs': 'Nightlife',
  'kleinstadte-clubs': 'Nightlife',
  'partytimer': 'Nightlife',
  'ra.co/austria': 'Nightlife',
  'clubmap.at': 'Nightlife',
  'rockhouse': 'Nightlife',

  // Musik — concert halls
  'konzerthaus.at': 'Musik',
  'musikverein.at': 'Musik',
  'posthof': 'Musik', // posthof is a music venue too; demote to Kultur if audit shows mixed program

  // Kultur — theatres + major museums
  'bundestheater.at': 'Kultur',
  'theater.at': 'Kultur',
  'argekultur': 'Kultur',
  'basiskultur': 'Kultur',
  'khm.at': 'Kultur',
  'albertina.at': 'Kultur',
  'mumok.at': 'Kultur',
  'belvedere.at': 'Kultur',
  'leopoldmuseum.org': 'Kultur',
  'nhm-wien.ac.at': 'Kultur',
  'technischesmuseum.at': 'Kultur',

  // Märkte
  'bauernmarkt.at': 'Märkte',

  // Wein & Kulinarik
  'genussregion.at': 'Wein & Kulinarik',

  // Sport
  'laufen.at': 'Sport',
  'rad-net.at': 'Sport',
  'oefb.at': 'Sport',
  'oeav-events.at': 'Sport',
  'runnersfun.at': 'Sport',

  // Natur
  'naturfreunde.at': 'Natur',
  'alpenverein.at': 'Natur',

  // Familie
  'familiii.at': 'Familie',
  'familienurlaub.at': 'Familie',

  // Wirtschaft
  'wko.at': 'Wirtschaft',
  'messecenter.at': 'Wirtschaft',
  'messe-wels.at': 'Wirtschaft',
  'mcg.at': 'Wirtschaft',
};

/**
 * Freeze the map and pre-normalize keys so lookups don't have to normalize
 * twice. Exposed as a read-only Map so callers can iterate entries.
 */
const NORMALIZED_MAP: ReadonlyMap<string, Category> = new Map(
  Object.entries(TRUSTED_SOURCE_SEED).map(([k, v]) => [normalizeText(k), v]),
);

export function trustedSourceCategoryFor(sourceName: string | null | undefined): Category | null {
  if (!sourceName) return null;
  const n = normalizeText(sourceName);
  return NORMALIZED_MAP.get(n) ?? null;
}

export function isTrustedSource(sourceName: string | null | undefined): boolean {
  return trustedSourceCategoryFor(sourceName) !== null;
}

/** For tests/instrumentation. */
export function trustedSourceEntries(): Array<[string, Category]> {
  return Array.from(NORMALIZED_MAP.entries());
}

/**
 * Known multi-category aggregators — listed explicitly to make "not trusted"
 * auditable. Used only for reporting/tests; classification itself only checks
 * the positive trusted map above.
 */
export const MULTI_CATEGORY_AGGREGATORS: ReadonlySet<string> = new Set(
  [
    'burgenland.info',
    'burgenland.at',
    'wien.info',
    'wien-info',
    'wien-gv',
    'wien-ogd',
    'wien-ticket',
    'graztourismus',
    'kultur-graz',
    'tirol.at',
    'vorarlberg.travel',
    'events.at',
    'events.tt',
    'ticketmaster',
    'feverup',
    'oeticket',
    'meinbezirk',
    'tips.at',
    'falter',
    'veranstaltungskalender.net',
    'meetup.com',
    'ntry.at',
  ].map(s => normalizeText(s)),
);
