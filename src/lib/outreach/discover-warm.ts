import type { SupabaseClient } from '@supabase/supabase-js';
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
  const { data: evRows } = await supabase
    .from('events')
    .select('id, organizer, organizer_url, bundesland')
    .not('organizer_url', 'is', null)
    .eq('publish_status', 'published')
    .gte('start_date', today)
    .limit(BATCH);

  // 2. Venue websites.
  const { data: venueRows } = await supabase
    .from('venues')
    .select('id, name, website')
    .not('website', 'is', null)
    .limit(BATCH);

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
  const [{ data: existing }, { data: suppressed }] = await Promise.all([
    supabase.from('outreach_prospects').select('domain').in('domain', domains),
    supabase.from('outreach_suppression').select('domain').in('domain', domains),
  ]);
  const blocked = new Set<string>([
    ...((existing ?? []) as Array<{ domain: string }>).map((r) => r.domain),
    ...((suppressed ?? []) as Array<{ domain: string }>).map((r) => r.domain),
  ]);
  return [...byDomain.values()].filter((c) => !blocked.has(c.domain)).slice(0, limit);
}
