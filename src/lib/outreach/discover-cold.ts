import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeDomain } from './domain';
import type { SearchProvider, SearchResult } from './search-provider';
import type { ProspectCandidate } from './types';

/** Domains we never want as outreach prospects (search/social/big aggregators). */
export const COLD_BLOCKLIST = [
  'google.', 'bing.', 'duckduckgo.', 'yahoo.', 'ecosia.',
  'facebook.', 'instagram.', 'youtube.', 'tiktok.', 'twitter.', 'x.com', 'linkedin.', 'pinterest.',
  'wikipedia.', 'wikivoyage.', 'tripadvisor.', 'yelp.', 'booking.com', 'amazon.',
  'eventbrite.', 'meetup.com', 'lasstreffen.at', 'vercel.app',
];

export function isBlockedDomain(domain: string): boolean {
  return COLD_BLOCKLIST.some((b) => domain.includes(b));
}

/** Normalized, deduped, non-blocked, not-already-known domains from results. */
export function extractColdDomains(results: SearchResult[], blocked: Set<string>): string[] {
  const out = new Set<string>();
  for (const r of results) {
    const d = normalizeDomain(r.url);
    if (!d || isBlockedDomain(d) || blocked.has(d)) continue;
    out.add(d);
  }
  return [...out];
}

export function buildColdQueries(places: string[]): string[] {
  return places.flatMap((p) => [
    `Veranstaltungskalender ${p}`,
    `Events ${p}`,
    `was ist los in ${p}`,
  ]);
}

/** Run cold queries through the provider, collect NEW domains as cold prospects. */
export async function discoverColdProspects(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  provider: SearchProvider,
  queries: string[],
  limit = 50,
): Promise<ProspectCandidate[]> {
  const [{ data: existing }, { data: suppressed }] = await Promise.all([
    supabase.from('outreach_prospects').select('domain'),
    supabase.from('outreach_suppression').select('domain'),
  ]);
  const blocked = new Set<string>([
    ...((existing ?? []) as Array<{ domain: string }>).map((r) => r.domain),
    ...((suppressed ?? []) as Array<{ domain: string }>).map((r) => r.domain),
  ]);

  const found = new Map<string, ProspectCandidate>();
  for (const q of queries) {
    if (found.size >= limit) break;
    const results = await provider.search(q);
    for (const d of extractColdDomains(results, blocked)) {
      if (found.has(d)) continue;
      found.set(d, {
        domain: d, kind: 'cold', orgName: null, website: `https://${d}`,
        bundesland: null, sourceEventIds: [], discoveredVia: `cold:cse:${q}`.slice(0, 80),
      });
      blocked.add(d);
    }
  }
  return [...found.values()].slice(0, limit);
}
