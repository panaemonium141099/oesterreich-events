import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeDomain } from './domain';
import { isBlockedDomain } from './discover-cold';
import type { SearchProvider } from './search-provider';

export interface MentionRow {
  url: string;
  domain: string;
  kind: 'backlink' | 'mention';
  source: 'referrer' | 'search';
}

const OWN = 'lasstreffen.at';

/** External referrer domains in analytics_events = a link was clicked from there
 *  (-> a backlink, modulo ghost-referrer spam the user reviews). */
export async function findReferrerMentions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<MentionRow[]> {
  const { data } = await supabase
    .from('analytics_events').select('referrer')
    .not('referrer', 'is', null).limit(8000);

  const byDomain = new Map<string, string>(); // domain -> first url
  for (const r of (data ?? []) as Array<{ referrer: string | null }>) {
    if (!r.referrer) continue;
    if (r.referrer.includes('localhost') || r.referrer.includes('127.0.0.1')) continue;
    const d = normalizeDomain(r.referrer);
    if (!d || d === OWN || d.endsWith('.' + OWN) || isBlockedDomain(d) || d.includes('accounts.')) continue;
    if (!byDomain.has(d)) byDomain.set(d, r.referrer);
  }
  return [...byDomain.entries()].map(([domain, url]) => ({ url, domain, kind: 'backlink', source: 'referrer' }));
}

/** Pages that name lasstreffen.at, via the search provider. */
export async function findSearchMentions(provider: SearchProvider): Promise<MentionRow[]> {
  const results = await provider.search('"lasstreffen.at"');
  const byDomain = new Map<string, string>();
  for (const r of results) {
    const d = normalizeDomain(r.url);
    if (!d || d === OWN || d.endsWith('.' + OWN) || isBlockedDomain(d)) continue;
    if (!byDomain.has(d)) byDomain.set(d, r.url);
  }
  return [...byDomain.entries()].map(([domain, url]) => ({ url, domain, kind: 'mention', source: 'search' }));
}
