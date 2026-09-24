import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/db/fetch-all';
import { normalizeDomain } from './domain';
import type { ProspectCandidate } from './types';

const BATCH = 2000;

/**
 * Warm prospects = orgs/venues with a website whose FUTURE published events
 * we already list. Source columns: events.organizer_url, venues.website.
 * Returns NEW candidates only (not already prospects, not suppressed, not own).
 */
export async function discoverWarmProspects(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  limit = 200,
): Promise<ProspectCandidate[]> {
  const today = new Date().toISOString().slice(0, 10);

  // 1. Organizer websites from upcoming published events.
  const evRows = await fetchAllRows<unknown>((from, to) => supabase
    .from('events')
    .select('id, organizer, organizer_url, bundesland')
    .not('organizer_url', 'is', null)
    .eq('publish_status', 'published')
    .gte('start_date', today)
    .order('id')
    .range(from, to), { maxRows: BATCH, label: 'warm: events' });

  // 2. Venue websites.
  const venueRows = await fetchAllRows<unknown>((from, to) => supabase
    .from('venues')
    .select('id, name, website')
    .not('website', 'is', null)
    .order('id')
    .range(from, to), { maxRows: BATCH, label: 'warm: venues' });

  // Aggregate by normalized domain.
  const byDomain = new Map<string, ProspectCandidate>();
  for (const e of (evRows ?? []) as Array<{ id: string; organizer: string | null; organizer_url: string | null; bundesland: string | null }>) {
    const d = normalizeDomain(e.organizer_url);
    if (!d) continue;
    const c = byDomain.get(d) ?? {
      domain: d, kind: 'warm' as const, orgName: e.organizer ?? null,
      website: e.organizer_url, bundesland: e.bundesland ?? null,
      sourceEventIds: [], discoveredVia: 'warm:organizer_url',
    };
    if (c.sourceEventIds.length < 20) c.sourceEventIds.push(e.id);
    byDomain.set(d, c);
  }
  for (const v of (venueRows ?? []) as Array<{ id: string; name: string | null; website: string | null }>) {
    const d = normalizeDomain(v.website);
    if (!d || byDomain.has(d)) continue;
    byDomain.set(d, {
      domain: d, kind: 'warm', orgName: v.name ?? null, website: v.website,
      bundesland: null, sourceEventIds: [], discoveredVia: 'warm:venue_website',
    });
  }

  // Exclude existing prospects + suppression.
  const domains = [...byDomain.keys()];
  if (domains.length === 0) return [];
  // `.in()` steht im Query-String: in Stücken zu höchstens 200 abfragen.
  const blocked = new Set<string>();
  for (let i = 0; i < domains.length; i += 200) {
    const chunk = domains.slice(i, i + 200);
    const [{ data: existing }, { data: suppressed }] = await Promise.all([
      supabase.from('outreach_prospects').select('domain').in('domain', chunk),
      supabase.from('outreach_suppression').select('domain').in('domain', chunk),
    ]);
    for (const r of [...(existing ?? []), ...(suppressed ?? [])] as Array<{ domain: string }>) blocked.add(r.domain);
  }
  return [...byDomain.values()].filter((c) => !blocked.has(c.domain)).slice(0, limit);
}
