import { createClient } from '@supabase/supabase-js';
import { generateFingerprint } from '@/lib/dedup/fingerprint';
import { jaroWinkler } from '@/lib/dedup/jaro-winkler';
import type { NormalizedCandidate } from './types';

const FUZZY_THRESHOLD = 0.85;
const MERGE_AUTO = 0.90;
const MERGE_UNCERTAIN = 0.55;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export interface MatchCandidate {
  eventId: string;
  score: number;
  decision: 'merge' | 'uncertain' | 'new';
}

/**
 * For each candidate, find existing events that might be duplicates.
 * Uses fingerprint (exact) then fuzzy title + same-day matching.
 */
export async function findMatchCandidates(
  candidates: NormalizedCandidate[],
): Promise<Map<string, MatchCandidate>> {
  const supabase = getSupabaseAdmin();
  const results = new Map<string, MatchCandidate>();

  // Step 1: Fingerprint-based exact matching
  const fingerprints = new Map<string, string>();
  for (const c of candidates) {
    if (c.normalized_title && c.normalized_start_at) {
      const fp = generateFingerprint(c.normalized_title, c.normalized_start_at);
      if (fp) fingerprints.set(c.raw_event_id, fp);
    }
  }

  if (fingerprints.size > 0) {
    const fpValues = [...new Set(fingerprints.values())];
    // Batch in chunks of 100 to avoid URL length limits
    for (let i = 0; i < fpValues.length; i += 100) {
      const chunk = fpValues.slice(i, i + 100);
      const { data: fpMatches } = await supabase
        .from('events')
        .select('id, content_fingerprint')
        .in('content_fingerprint', chunk);

      const fpToEventId = new Map<string, string>();
      for (const match of fpMatches ?? []) {
        if (match.content_fingerprint) {
          fpToEventId.set(match.content_fingerprint, match.id);
        }
      }

      for (const [rawId, fp] of fingerprints) {
        const existingId = fpToEventId.get(fp);
        if (existingId) {
          results.set(rawId, { eventId: existingId, score: 1.0, decision: 'merge' });
        }
      }
    }
  }

  // Step 2: Fuzzy matching for non-fingerprint-matched candidates
  for (const c of candidates) {
    if (results.has(c.raw_event_id)) continue;
    if (!c.normalized_start_at || !c.normalized_title_compact) {
      results.set(c.raw_event_id, { eventId: '', score: 0, decision: 'new' });
      continue;
    }

    const dayStart = c.normalized_start_at.slice(0, 10);
    const { data: sameDayEvents } = await supabase
      .from('events')
      .select('id, title, location_name, latitude, longitude')
      .gte('start_date', `${dayStart}T00:00:00`)
      .lt('start_date', `${dayStart}T23:59:59`)
      .limit(200);

    let bestMatch: MatchCandidate = { eventId: '', score: 0, decision: 'new' };
    for (const existing of sameDayEvents ?? []) {
      const titleScore = jaroWinkler(
        c.normalized_title_compact,
        (existing.title ?? '').toLowerCase(),
      );

      if (titleScore > bestMatch.score) {
        const decision = titleScore >= MERGE_AUTO ? 'merge'
          : titleScore >= MERGE_UNCERTAIN ? 'uncertain'
          : 'new';
        bestMatch = { eventId: existing.id, score: titleScore, decision };
      }
    }
    results.set(c.raw_event_id, bestMatch);
  }

  return results;
}
