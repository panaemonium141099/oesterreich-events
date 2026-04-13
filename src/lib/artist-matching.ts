/**
 * Artist-Event Matching Engine
 *
 * Uses PostgreSQL pg_trgm word_similarity for fuzzy matching of followed artist
 * names against event titles and descriptions. Tiered strategy:
 *   - Names < 3 chars: skipped (too many false positives)
 *   - Names 3 chars: exact word boundary match on title (case-insensitive regex)
 *   - Names 4+ chars: pg_trgm word_similarity() on title with threshold >= 0.6
 *   - Secondary (names >= 6 chars): substring check on description
 *
 * Notification grouping: max 1 notification per (user, event) with all matched
 * artists listed in the body.
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.6
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FollowedArtist {
  id: string;
  user_id: string;
  artist_name: string;
  artist_name_normalized: string;
}

export interface MatchResult {
  user_id: string;
  event_id: string;
  event_title: string;
  artist_name: string;
  match_score: number;
  match_source: 'title' | 'description';
}

export interface MatchingCursorState {
  last_processed_at: string;
  last_success_at: string | null;
  events_processed: number;
  matches_found: number;
}

export interface MatchingStats {
  events_processed: number;
  matches_found: number;
  notifications_created: number;
  artists_checked: number;
  skipped_short_names: number;
}

// ── Name classification ──────────────────────────────────────────────────────

export type MatchTier = 'skip' | 'exact' | 'fuzzy';

/**
 * Classify an artist name into a matching tier based on its normalized length.
 */
export function classifyName(normalizedName: string): MatchTier {
  const len = normalizedName.trim().length;
  if (len < 3) return 'skip';
  // Short names (3-5 chars) use exact word boundary match to avoid false positives
  // e.g., "Dame" should NOT match "Damenturngruppe" or "Madame"
  if (len <= 5) return 'exact';
  return 'fuzzy';
}

/**
 * Check if an artist name qualifies for secondary description matching.
 * Only names >= 6 chars to avoid false positives in long text.
 */
export function qualifiesForDescriptionMatch(normalizedName: string): boolean {
  return normalizedName.trim().length >= 6;
}

/**
 * Strip diacritics from a string for normalized comparison.
 * e.g., "Osterreich" with umlaut -> "Osterreich"
 */
export function stripDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize an artist name: lowercase + strip diacritics.
 */
export function normalizeArtistName(name: string): string {
  return stripDiacritics(name.toLowerCase().trim());
}

// ── Matching queries ─────────────────────────────────────────────────────────

/**
 * Build the SQL for exact word boundary match (3-char names).
 * Uses PostgreSQL ~* operator with word boundaries.
 */
export function buildExactMatchRegex(normalizedName: string): string {
  // Escape regex special characters
  const escaped = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `\\m${escaped}\\M`;
}

/**
 * Format notification body listing all matched artist names.
 * Example: "Kuenstler X, Y und Z treten bei {event_title} auf!"
 */
export function formatNotificationBody(
  artistNames: string[],
  eventTitle: string
): string {
  if (artistNames.length === 0) return '';

  const uniqueNames = [...new Set(artistNames)];

  if (uniqueNames.length === 1) {
    return `${uniqueNames[0]} tritt bei ${eventTitle} auf!`;
  }

  const last = uniqueNames[uniqueNames.length - 1];
  const rest = uniqueNames.slice(0, -1);
  return `${rest.join(', ')} und ${last} treten bei ${eventTitle} auf!`;
}

// ── Core matching engine ─────────────────────────────────────────────────────

// Raised from 0.6 to 0.75 to reduce false positives
// (0.6 caused "ILLENIUM" → "Millenium", "Nu Aspect" → "Aspects")
const WORD_SIMILARITY_THRESHOLD = 0.75;
const BATCH_SIZE = 500;

/**
 * Fetch the current matching cursor state.
 */
export async function getMatchingCursor(
  supabase: SupabaseClient
): Promise<MatchingCursorState> {
  const { data, error } = await supabase
    .from('matching_cursor')
    .select('*')
    .eq('id', 'artist_matching')
    .single();

  if (error || !data) {
    // Return default cursor if not found
    return {
      last_processed_at: '1970-01-01T00:00:00Z',
      last_success_at: null,
      events_processed: 0,
      matches_found: 0,
    };
  }

  return {
    last_processed_at: data.last_processed_at,
    last_success_at: data.last_success_at,
    events_processed: data.events_processed,
    matches_found: data.matches_found,
  };
}

/**
 * Update the matching cursor after a successful run.
 */
export async function updateMatchingCursor(
  supabase: SupabaseClient,
  eventsProcessed: number,
  matchesFound: number
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('matching_cursor')
    .upsert({
      id: 'artist_matching',
      last_processed_at: now,
      last_success_at: now,
      events_processed: eventsProcessed,
      matches_found: matchesFound,
      updated_at: now,
    });

  if (error) {
    console.error('Failed to update matching cursor:', error);
    throw error;
  }
}

/**
 * Reset the matching cursor to re-process all events.
 */
export async function resetMatchingCursor(
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from('matching_cursor')
    .upsert({
      id: 'artist_matching',
      last_processed_at: '1970-01-01T00:00:00Z',
      last_success_at: null,
      events_processed: 0,
      matches_found: 0,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Failed to reset matching cursor:', error);
    throw error;
  }
}

/**
 * Fetch all followed artists grouped by user.
 * Returns a flat array of all followed artists.
 */
export async function fetchAllFollowedArtists(
  supabase: SupabaseClient
): Promise<FollowedArtist[]> {
  const artists: FollowedArtist[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('followed_artists')
      .select('id, user_id, artist_name, artist_name_normalized')
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      console.error('Error fetching followed artists:', error);
      throw error;
    }

    if (!data || data.length === 0) break;
    artists.push(...data);
    if (data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  return artists;
}

/**
 * Group artists by their matching tier, deduplicating normalized names.
 * Returns unique normalized names per tier with their associated user mappings.
 */
export function groupArtistsByTier(artists: FollowedArtist[]): {
  exact: Map<string, FollowedArtist[]>;  // 3-char names
  fuzzy: Map<string, FollowedArtist[]>;  // 4+ char names
  skipped: string[];                      // < 3 char names
} {
  const exact = new Map<string, FollowedArtist[]>();
  const fuzzy = new Map<string, FollowedArtist[]>();
  const skipped: string[] = [];

  for (const artist of artists) {
    const normalized = normalizeArtistName(artist.artist_name);
    const tier = classifyName(normalized);

    switch (tier) {
      case 'skip':
        skipped.push(artist.artist_name);
        break;
      case 'exact': {
        const list = exact.get(normalized) || [];
        list.push(artist);
        exact.set(normalized, list);
        break;
      }
      case 'fuzzy': {
        const list = fuzzy.get(normalized) || [];
        list.push(artist);
        fuzzy.set(normalized, list);
        break;
      }
    }
  }

  return { exact, fuzzy, skipped };
}

/**
 * Run exact word-boundary matching for 3-char artist names against event titles.
 * Uses PostgreSQL ~* (case-insensitive regex) with \m...\M word boundaries.
 */
export async function matchExactNames(
  supabase: SupabaseClient,
  names: string[],
  sinceTimestamp: string
): Promise<Array<{ event_id: string; event_title: string; matched_name: string; score: number }>> {
  if (names.length === 0) return [];

  const results: Array<{ event_id: string; event_title: string; matched_name: string; score: number }> = [];

  // Process each 3-char name individually (few of them expected)
  for (const name of names) {
    const regex = buildExactMatchRegex(name);
    const { data, error } = await supabase.rpc('match_exact_artist_title', {
      p_regex: regex,
      p_since: sinceTimestamp,
    });

    if (error) {
      console.error(`Exact match error for "${name}":`, error);
      continue;
    }

    if (data) {
      for (const row of data) {
        results.push({
          event_id: row.event_id,
          event_title: row.event_title,
          matched_name: name,
          score: 1.0, // Exact match
        });
      }
    }
  }

  return results;
}

/**
 * Run pg_trgm word_similarity matching for 4+ char artist names against event titles.
 * Uses a single efficient query with the GIN index.
 */
export async function matchFuzzyNames(
  supabase: SupabaseClient,
  names: string[],
  sinceTimestamp: string
): Promise<Array<{ event_id: string; event_title: string; matched_name: string; score: number }>> {
  if (names.length === 0) return [];

  const { data, error } = await supabase.rpc('match_fuzzy_artist_titles', {
    p_artist_names: names,
    p_threshold: WORD_SIMILARITY_THRESHOLD,
    p_since: sinceTimestamp,
  });

  if (error) {
    console.error('Fuzzy match error:', error);
    throw error;
  }

  if (!data) return [];

  return data.map((row: { event_id: string; event_title: string; artist_name: string; similarity: number }) => ({
    event_id: row.event_id,
    event_title: row.event_title,
    matched_name: row.artist_name,
    score: row.similarity,
  }));
}

/**
 * Run secondary description matching for 6+ char artist names.
 * Uses POSITION(lower(name) IN lower(description)) for cheap substring check.
 */
export async function matchDescriptionNames(
  supabase: SupabaseClient,
  names: string[],
  sinceTimestamp: string,
  excludeEventIds: Set<string>
): Promise<Array<{ event_id: string; event_title: string; matched_name: string; score: number }>> {
  if (names.length === 0) return [];

  // Filter to only 6+ char names
  const qualifiedNames = names.filter(n => qualifiesForDescriptionMatch(n));
  if (qualifiedNames.length === 0) return [];

  const { data, error } = await supabase.rpc('match_artist_descriptions', {
    p_artist_names: qualifiedNames,
    p_since: sinceTimestamp,
  });

  if (error) {
    console.error('Description match error:', error);
    // Non-fatal: description matching is secondary
    return [];
  }

  if (!data) return [];

  // Exclude events already matched by title
  return data
    .filter((row: { event_id: string }) => !excludeEventIds.has(row.event_id))
    .map((row: { event_id: string; event_title: string; artist_name: string }) => ({
      event_id: row.event_id,
      event_title: row.event_title,
      matched_name: row.artist_name,
      score: 0.5, // Lower score for description matches
    }));
}

/**
 * Insert artist-event match records with ON CONFLICT DO NOTHING for dedup.
 */
export async function insertArtistEventMatches(
  supabase: SupabaseClient,
  matches: MatchResult[]
): Promise<number> {
  if (matches.length === 0) return 0;

  let inserted = 0;

  // Process in batches to avoid payload limits
  for (let i = 0; i < matches.length; i += BATCH_SIZE) {
    const batch = matches.slice(i, i + BATCH_SIZE).map(m => ({
      user_id: m.user_id,
      event_id: m.event_id,
      artist_name: m.artist_name,
      match_score: m.match_score,
      match_source: m.match_source,
    }));

    const { error, count } = await supabase
      .from('artist_event_notifications')
      .upsert(batch, {
        onConflict: 'user_id,event_id,artist_name',
        ignoreDuplicates: true,
        count: 'exact',
      });

    if (error) {
      console.error('Error inserting artist event matches:', error);
      // Continue with next batch
    } else {
      inserted += count ?? batch.length;
    }
  }

  return inserted;
}

/**
 * Group matches by (user_id, event_id) and create one notification per group.
 * The notification body lists all matched artist names.
 * Uses ON CONFLICT DO NOTHING via the unique partial index.
 */
export async function createGroupedNotifications(
  supabase: SupabaseClient,
  matches: MatchResult[]
): Promise<number> {
  if (matches.length === 0) return 0;

  // Group by user_id + event_id
  const groups = new Map<string, { user_id: string; event_id: string; event_title: string; artists: string[] }>();

  for (const match of matches) {
    const key = `${match.user_id}:${match.event_id}`;
    const group = groups.get(key);
    if (group) {
      if (!group.artists.includes(match.artist_name)) {
        group.artists.push(match.artist_name);
      }
    } else {
      groups.set(key, {
        user_id: match.user_id,
        event_id: match.event_id,
        event_title: match.event_title,
        artists: [match.artist_name],
      });
    }
  }

  let created = 0;

  // Insert notifications in batches
  const groupValues = Array.from(groups.values());
  for (let i = 0; i < groupValues.length; i += BATCH_SIZE) {
    const batch = groupValues.slice(i, i + BATCH_SIZE).map(g => ({
      user_id: g.user_id,
      type: 'spotify_match',
      title: 'Artist Match!',
      body: formatNotificationBody(g.artists, g.event_title),
      event_id: g.event_id,
      action_url: `/events/${g.event_id}`,
      read: false,
    }));

    // Use upsert with the partial unique index -- duplicates are ignored
    const { error, count } = await supabase
      .from('notifications')
      .upsert(batch, {
        onConflict: 'user_id,event_id',
        ignoreDuplicates: true,
        count: 'exact',
      });

    if (error) {
      // The unique partial index only applies WHERE type = 'spotify_match'.
      // Supabase upsert may not support partial index onConflict directly,
      // so we fall back to individual inserts with error suppression.
      for (const notification of batch) {
        const { error: insertError } = await supabase
          .from('notifications')
          .insert(notification);

        // 23505 = unique_violation — expected for duplicates
        if (insertError && !insertError.code?.includes('23505')) {
          console.error('Error creating notification:', insertError);
        } else if (!insertError) {
          created++;
        }
      }
    } else {
      created += count ?? batch.length;
    }
  }

  return created;
}

/**
 * Run the full artist-event matching pipeline.
 *
 * 1. Fetch matching cursor
 * 2. Fetch all followed artists
 * 3. Group by tier (skip/exact/fuzzy)
 * 4. Run title matching (exact for 3-char, fuzzy for 4+)
 * 5. Run secondary description matching (6+ chars, events not already matched)
 * 6. Insert artist_event_notifications (per-artist dedup)
 * 7. Create grouped notifications (per user+event dedup)
 * 8. Update cursor
 */
export async function runMatchingPipeline(
  supabase: SupabaseClient,
  options: { dryRun?: boolean; resetCursor?: boolean } = {}
): Promise<MatchingStats> {
  const stats: MatchingStats = {
    events_processed: 0,
    matches_found: 0,
    notifications_created: 0,
    artists_checked: 0,
    skipped_short_names: 0,
  };

  // Step 0: Optionally reset cursor
  if (options.resetCursor) {
    console.log('Resetting matching cursor...');
    if (!options.dryRun) {
      await resetMatchingCursor(supabase);
    }
  }

  // Step 1: Fetch cursor
  const cursor = await getMatchingCursor(supabase);
  console.log(`Matching cursor: last_processed_at = ${cursor.last_processed_at}`);

  // Step 2: Fetch all followed artists
  const allArtists = await fetchAllFollowedArtists(supabase);
  stats.artists_checked = allArtists.length;
  console.log(`Found ${allArtists.length} followed artists across all users`);

  if (allArtists.length === 0) {
    console.log('No followed artists found. Nothing to match.');
    return stats;
  }

  // Step 3: Group by tier
  const { exact, fuzzy, skipped } = groupArtistsByTier(allArtists);
  stats.skipped_short_names = skipped.length;
  console.log(`Tiers: ${exact.size} exact (3-char), ${fuzzy.size} fuzzy (4+), ${skipped.length} skipped (<3)`);

  if (skipped.length > 0) {
    console.log(`  Skipped names: ${skipped.join(', ')}`);
  }

  // Step 4a: Exact matching (3-char names)
  const exactNames = Array.from(exact.keys());
  const exactMatches = await matchExactNames(supabase, exactNames, cursor.last_processed_at);
  console.log(`Exact matches (title): ${exactMatches.length}`);

  // Step 4b: Fuzzy matching (4+ char names)
  const fuzzyNames = Array.from(fuzzy.keys());
  const fuzzyMatches = await matchFuzzyNames(supabase, fuzzyNames, cursor.last_processed_at);
  console.log(`Fuzzy matches (title): ${fuzzyMatches.length}`);

  // Collect all title-matched event IDs for description exclusion
  const titleMatchedEventIds = new Set<string>();
  for (const m of [...exactMatches, ...fuzzyMatches]) {
    titleMatchedEventIds.add(m.event_id);
  }

  // Step 5: Secondary description matching (6+ chars, excluding title matches)
  const allNames = [...exactNames, ...fuzzyNames];
  const descriptionMatches = await matchDescriptionNames(
    supabase,
    allNames,
    cursor.last_processed_at,
    titleMatchedEventIds
  );
  console.log(`Description matches (secondary): ${descriptionMatches.length}`);

  // Step 6: Build full match results with user mappings
  const allMatches: MatchResult[] = [];

  // Map exact matches to users
  for (const match of exactMatches) {
    const artists = exact.get(match.matched_name) || [];
    for (const artist of artists) {
      allMatches.push({
        user_id: artist.user_id,
        event_id: match.event_id,
        event_title: match.event_title,
        artist_name: artist.artist_name,
        match_score: match.score,
        match_source: 'title',
      });
    }
  }

  // Map fuzzy matches to users
  for (const match of fuzzyMatches) {
    const artists = fuzzy.get(match.matched_name) || [];
    for (const artist of artists) {
      allMatches.push({
        user_id: artist.user_id,
        event_id: match.event_id,
        event_title: match.event_title,
        artist_name: artist.artist_name,
        match_score: match.score,
        match_source: 'title',
      });
    }
  }

  // Map description matches to users (check both exact and fuzzy maps)
  for (const match of descriptionMatches) {
    const exactArtists = exact.get(match.matched_name) || [];
    const fuzzyArtists = fuzzy.get(match.matched_name) || [];
    const artists = [...exactArtists, ...fuzzyArtists];
    for (const artist of artists) {
      allMatches.push({
        user_id: artist.user_id,
        event_id: match.event_id,
        event_title: match.event_title,
        artist_name: artist.artist_name,
        match_score: match.score,
        match_source: 'description',
      });
    }
  }

  stats.matches_found = allMatches.length;
  console.log(`Total matches: ${allMatches.length}`);

  if (options.dryRun) {
    console.log('\n[DRY RUN] Would insert the following matches:');
    for (const m of allMatches.slice(0, 20)) {
      console.log(`  ${m.artist_name} -> "${m.event_title}" (${m.match_source}, score: ${m.match_score.toFixed(2)})`);
    }
    if (allMatches.length > 20) {
      console.log(`  ... and ${allMatches.length - 20} more`);
    }
    return stats;
  }

  // Step 7: Insert per-artist match records
  if (allMatches.length > 0) {
    const inserted = await insertArtistEventMatches(supabase, allMatches);
    console.log(`Inserted ${inserted} artist_event_notification records`);

    // Step 8: Create grouped notifications
    const notificationsCreated = await createGroupedNotifications(supabase, allMatches);
    stats.notifications_created = notificationsCreated;
    console.log(`Created ${notificationsCreated} grouped notifications`);
  }

  // Step 9: Count events processed (query the count of future events since cursor)
  const { count: eventsCount } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .gte('start_date', new Date().toISOString())
    .gt('updated_at', cursor.last_processed_at);

  stats.events_processed = eventsCount ?? 0;

  // Step 10: Update cursor
  await updateMatchingCursor(supabase, stats.events_processed, stats.matches_found);
  console.log('Matching cursor updated');

  return stats;
}
