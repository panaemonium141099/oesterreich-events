/**
 * Supabase Edge Function: match-artists
 *
 * Runs the artist-event matching pipeline incrementally using matching_cursor.
 * Called as:
 *   1. Post-scrape hook (HTTP POST from scrape.ts)
 *   2. pg_cron fallback every 5 minutes
 *   3. Manual invocation via npm run match-artists
 *
 * Uses service_role key for full database access.
 * Matching logic: pg_trgm word_similarity on event titles + substring on descriptions.
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.7
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ── Types ────────────────────────────────────────────────────────────────────

interface FollowedArtist {
  id: string;
  user_id: string;
  artist_name: string;
  artist_name_normalized: string;
}

interface MatchResult {
  user_id: string;
  event_id: string;
  event_title: string;
  artist_name: string;
  match_score: number;
  match_source: "title" | "description";
}

interface MatchingStats {
  events_processed: number;
  matches_found: number;
  notifications_created: number;
  reminders_scheduled: number;
  artists_checked: number;
  skipped_short_names: number;
  duration_ms: number;
}

interface NotificationPrefs {
  user_id: string;
  artist_alerts_enabled: boolean;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_sms: boolean;
  phone_number: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const WORD_SIMILARITY_THRESHOLD = 0.6;
const BATCH_SIZE = 500;
const DEFAULT_CURSOR = "1970-01-01T00:00:00Z";

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeArtistName(name: string): string {
  return stripDiacritics(name.toLowerCase().trim());
}

function classifyName(normalizedName: string): "skip" | "exact" | "fuzzy" {
  const len = normalizedName.trim().length;
  if (len < 3) return "skip";
  if (len === 3) return "exact";
  return "fuzzy";
}

function buildExactMatchRegex(normalizedName: string): string {
  const escaped = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `\\m${escaped}\\M`;
}

function formatNotificationBody(
  artistNames: string[],
  eventTitle: string
): string {
  if (artistNames.length === 0) return "";
  const uniqueNames = [...new Set(artistNames)];
  if (uniqueNames.length === 1) {
    return `${uniqueNames[0]} tritt bei ${eventTitle} auf!`;
  }
  const last = uniqueNames[uniqueNames.length - 1];
  const rest = uniqueNames.slice(0, -1);
  return `${rest.join(", ")} und ${last} treten bei ${eventTitle} auf!`;
}

// ── Core matching functions ──────────────────────────────────────────────────

type SupabaseClient = ReturnType<typeof createClient>;

async function getMatchingCursor(
  supabase: SupabaseClient
): Promise<string> {
  const { data, error } = await supabase
    .from("matching_cursor")
    .select("last_processed_at")
    .eq("id", "artist_matching")
    .single();

  if (error || !data) {
    // Safe default: process last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return oneDayAgo;
  }

  return data.last_processed_at || DEFAULT_CURSOR;
}

async function updateMatchingCursor(
  supabase: SupabaseClient,
  eventsProcessed: number,
  matchesFound: number
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("matching_cursor").upsert({
    id: "artist_matching",
    last_processed_at: now,
    last_success_at: now,
    events_processed: eventsProcessed,
    matches_found: matchesFound,
    updated_at: now,
  });

  if (error) {
    console.error("Failed to update matching cursor:", error);
    throw error;
  }
}

async function fetchAllFollowedArtists(
  supabase: SupabaseClient
): Promise<FollowedArtist[]> {
  const artists: FollowedArtist[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("followed_artists")
      .select("id, user_id, artist_name, artist_name_normalized")
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      console.error("Error fetching followed artists:", error);
      throw error;
    }

    if (!data || data.length === 0) break;
    artists.push(...data);
    if (data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  return artists;
}

function groupArtistsByTier(artists: FollowedArtist[]): {
  exact: Map<string, FollowedArtist[]>;
  fuzzy: Map<string, FollowedArtist[]>;
  skipped: string[];
} {
  const exact = new Map<string, FollowedArtist[]>();
  const fuzzy = new Map<string, FollowedArtist[]>();
  const skipped: string[] = [];

  for (const artist of artists) {
    const normalized = normalizeArtistName(artist.artist_name);
    const tier = classifyName(normalized);

    switch (tier) {
      case "skip":
        skipped.push(artist.artist_name);
        break;
      case "exact": {
        const list = exact.get(normalized) || [];
        list.push(artist);
        exact.set(normalized, list);
        break;
      }
      case "fuzzy": {
        const list = fuzzy.get(normalized) || [];
        list.push(artist);
        fuzzy.set(normalized, list);
        break;
      }
    }
  }

  return { exact, fuzzy, skipped };
}

async function matchExactNames(
  supabase: SupabaseClient,
  names: string[],
  sinceTimestamp: string
): Promise<
  Array<{
    event_id: string;
    event_title: string;
    matched_name: string;
    score: number;
  }>
> {
  if (names.length === 0) return [];

  const results: Array<{
    event_id: string;
    event_title: string;
    matched_name: string;
    score: number;
  }> = [];

  for (const name of names) {
    const regex = buildExactMatchRegex(name);
    const { data, error } = await supabase.rpc("match_exact_artist_title", {
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
          score: 1.0,
        });
      }
    }
  }

  return results;
}

async function matchFuzzyNames(
  supabase: SupabaseClient,
  names: string[],
  sinceTimestamp: string
): Promise<
  Array<{
    event_id: string;
    event_title: string;
    matched_name: string;
    score: number;
  }>
> {
  if (names.length === 0) return [];

  const { data, error } = await supabase.rpc("match_fuzzy_artist_titles", {
    p_artist_names: names,
    p_threshold: WORD_SIMILARITY_THRESHOLD,
    p_since: sinceTimestamp,
  });

  if (error) {
    console.error("Fuzzy match error:", error);
    throw error;
  }

  if (!data) return [];

  return data.map(
    (row: {
      event_id: string;
      event_title: string;
      artist_name: string;
      similarity: number;
    }) => ({
      event_id: row.event_id,
      event_title: row.event_title,
      matched_name: row.artist_name,
      score: row.similarity,
    })
  );
}

async function matchDescriptionNames(
  supabase: SupabaseClient,
  names: string[],
  sinceTimestamp: string,
  excludeEventIds: Set<string>
): Promise<
  Array<{
    event_id: string;
    event_title: string;
    matched_name: string;
    score: number;
  }>
> {
  if (names.length === 0) return [];

  const qualifiedNames = names.filter((n) => n.trim().length >= 6);
  if (qualifiedNames.length === 0) return [];

  const { data, error } = await supabase.rpc("match_artist_descriptions", {
    p_artist_names: qualifiedNames,
    p_since: sinceTimestamp,
  });

  if (error) {
    console.error("Description match error:", error);
    return [];
  }

  if (!data) return [];

  return data
    .filter((row: { event_id: string }) => !excludeEventIds.has(row.event_id))
    .map(
      (row: {
        event_id: string;
        event_title: string;
        artist_name: string;
      }) => ({
        event_id: row.event_id,
        event_title: row.event_title,
        matched_name: row.artist_name,
        score: 0.5,
      })
    );
}

async function insertArtistEventMatches(
  supabase: SupabaseClient,
  matches: MatchResult[]
): Promise<number> {
  if (matches.length === 0) return 0;

  let inserted = 0;

  for (let i = 0; i < matches.length; i += BATCH_SIZE) {
    const batch = matches.slice(i, i + BATCH_SIZE).map((m) => ({
      user_id: m.user_id,
      event_id: m.event_id,
      artist_name: m.artist_name,
      match_score: m.match_score,
      match_source: m.match_source,
    }));

    const { error, count } = await supabase
      .from("artist_event_notifications")
      .upsert(batch, {
        onConflict: "user_id,event_id,artist_name",
        ignoreDuplicates: true,
        count: "exact",
      });

    if (error) {
      console.error("Error inserting artist event matches:", error);
    } else {
      inserted += count ?? batch.length;
    }
  }

  return inserted;
}

async function fetchNotificationPreferences(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, NotificationPrefs>> {
  const prefsMap = new Map<string, NotificationPrefs>();
  if (userIds.length === 0) return prefsMap;

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .in("user_id", userIds);

  if (error) {
    console.error("Error fetching notification preferences:", error);
    return prefsMap;
  }

  if (data) {
    for (const pref of data) {
      prefsMap.set(pref.user_id, pref);
    }
  }

  return prefsMap;
}

async function createGroupedNotifications(
  supabase: SupabaseClient,
  matches: MatchResult[],
  prefsMap: Map<string, NotificationPrefs>
): Promise<{
  inApp: number;
  emailStubs: number;
  smsStubs: number;
}> {
  const result = { inApp: 0, emailStubs: 0, smsStubs: 0 };
  if (matches.length === 0) return result;

  // Group by user_id + event_id
  const groups = new Map<
    string,
    {
      user_id: string;
      event_id: string;
      event_title: string;
      artists: string[];
    }
  >();

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

  // Insert in-app notifications
  const groupValues = Array.from(groups.values());
  for (let i = 0; i < groupValues.length; i += BATCH_SIZE) {
    const batch = groupValues.slice(i, i + BATCH_SIZE);

    // Filter by notification preferences: only notify users with alerts enabled
    const filteredBatch = batch.filter((g) => {
      const prefs = prefsMap.get(g.user_id);
      // Default: alerts enabled, in-app enabled
      if (!prefs) return true;
      return prefs.artist_alerts_enabled && prefs.channel_in_app;
    });

    if (filteredBatch.length === 0) continue;

    const notifications = filteredBatch.map((g) => ({
      user_id: g.user_id,
      type: "spotify_match",
      title: "Artist Match!",
      body: formatNotificationBody(g.artists, g.event_title),
      event_id: g.event_id,
      action_url: `/events/${g.event_id}`,
      read: false,
    }));

    const { error, count } = await supabase
      .from("notifications")
      .upsert(notifications, {
        onConflict: "user_id,event_id",
        ignoreDuplicates: true,
        count: "exact",
      });

    if (error) {
      // Fallback to individual inserts (partial unique index may not work with upsert)
      for (const notification of notifications) {
        const { error: insertError } = await supabase
          .from("notifications")
          .insert(notification);

        if (insertError && !insertError.code?.includes("23505")) {
          console.error("Error creating notification:", insertError);
        } else if (!insertError) {
          result.inApp++;
        }
      }
    } else {
      result.inApp += count ?? filteredBatch.length;
    }

    // Check for email/SMS preferences (stubs for tasks .8/.9)
    for (const g of batch) {
      const prefs = prefsMap.get(g.user_id);
      if (!prefs) continue;

      if (prefs.channel_email && prefs.artist_alerts_enabled) {
        // STUB: Email notification -- implemented in task .8
        console.log(
          `[STUB] Would send email to user ${g.user_id} about ${g.artists.join(", ")} at ${g.event_title}`
        );
        result.emailStubs++;
      }

      if (
        prefs.channel_sms &&
        prefs.phone_number &&
        prefs.artist_alerts_enabled
      ) {
        // STUB: SMS notification -- implemented in task .9
        console.log(
          `[STUB] Would send SMS to ${prefs.phone_number} about ${g.artists.join(", ")} at ${g.event_title}`
        );
        result.smsStubs++;
      }
    }
  }

  return result;
}

// ── Reminder scheduling ─────────────────────────────────────────────────────

/**
 * Schedule 7d and 1d reminders for matched events.
 * Only creates reminders for future events where the interval is still applicable.
 * Uses ON CONFLICT to skip duplicates (unique on user_id, event_id, reminder_type).
 */
async function scheduleReminders(
  supabase: SupabaseClient,
  matches: MatchResult[],
  prefsMap: Map<string, NotificationPrefs & { reminder_7d?: boolean; reminder_1d?: boolean }>
): Promise<number> {
  if (matches.length === 0) return 0;

  // Group by user_id + event_id to get unique (user, event) pairs
  const uniquePairs = new Map<
    string,
    { user_id: string; event_id: string; artist_name: string }
  >();

  for (const match of matches) {
    const key = `${match.user_id}:${match.event_id}`;
    if (!uniquePairs.has(key)) {
      uniquePairs.set(key, {
        user_id: match.user_id,
        event_id: match.event_id,
        artist_name: match.artist_name,
      });
    }
  }

  // Fetch event start dates for all matched events
  const eventIds = [...new Set(Array.from(uniquePairs.values()).map((p) => p.event_id))];
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, start_date, ticket_url, title")
    .in("id", eventIds);

  if (eventsError || !events) {
    console.error("Error fetching events for reminders:", eventsError);
    return 0;
  }

  const eventMap = new Map<string, { start_date: string; ticket_url: string | null; title: string }>();
  for (const e of events) {
    eventMap.set(e.id, { start_date: e.start_date, ticket_url: e.ticket_url, title: e.title });
  }

  const now = new Date();
  const reminders: Array<{
    user_id: string;
    event_id: string;
    artist_name: string;
    reminder_type: string;
    scheduled_for: string;
    sent: boolean;
  }> = [];

  for (const pair of uniquePairs.values()) {
    const event = eventMap.get(pair.event_id);
    if (!event || !event.start_date) continue;

    const startDate = new Date(event.start_date);
    const msUntilEvent = startDate.getTime() - now.getTime();
    const daysUntilEvent = msUntilEvent / (1000 * 60 * 60 * 24);

    // Check user preferences for reminder toggles
    const prefs = prefsMap.get(pair.user_id);
    const reminder7dEnabled = prefs?.reminder_7d ?? true;
    const reminder1dEnabled = prefs?.reminder_1d ?? true;

    // Schedule 7d reminder if event is > 7 days away and user has it enabled
    if (daysUntilEvent > 7 && reminder7dEnabled) {
      const scheduledFor = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      reminders.push({
        user_id: pair.user_id,
        event_id: pair.event_id,
        artist_name: pair.artist_name,
        reminder_type: "7d_before",
        scheduled_for: scheduledFor.toISOString(),
        sent: false,
      });
    }

    // Schedule 1d reminder if event is > 1 day away and user has it enabled
    if (daysUntilEvent > 1 && reminder1dEnabled) {
      const scheduledFor = new Date(startDate.getTime() - 1 * 24 * 60 * 60 * 1000);
      reminders.push({
        user_id: pair.user_id,
        event_id: pair.event_id,
        artist_name: pair.artist_name,
        reminder_type: "1d_before",
        scheduled_for: scheduledFor.toISOString(),
        sent: false,
      });
    }
  }

  if (reminders.length === 0) return 0;

  let totalInserted = 0;
  for (let i = 0; i < reminders.length; i += BATCH_SIZE) {
    const batch = reminders.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from("event_reminders")
      .upsert(batch, {
        onConflict: "user_id,event_id,reminder_type",
        ignoreDuplicates: true,
        count: "exact",
      });

    if (error) {
      console.error("Error inserting reminders:", error);
    } else {
      totalInserted += count ?? batch.length;
    }
  }

  return totalInserted;
}

// ── Main pipeline ────────────────────────────────────────────────────────────

async function runMatchingPipeline(
  supabase: SupabaseClient
): Promise<MatchingStats> {
  const startTime = Date.now();
  const stats: MatchingStats = {
    events_processed: 0,
    matches_found: 0,
    notifications_created: 0,
    reminders_scheduled: 0,
    artists_checked: 0,
    skipped_short_names: 0,
    duration_ms: 0,
  };

  // Step 1: Fetch cursor
  const lastProcessedAt = await getMatchingCursor(supabase);
  console.log(`Matching cursor: last_processed_at = ${lastProcessedAt}`);

  // Step 2: Fetch all followed artists
  const allArtists = await fetchAllFollowedArtists(supabase);
  stats.artists_checked = allArtists.length;
  console.log(
    `Found ${allArtists.length} followed artists across all users`
  );

  if (allArtists.length === 0) {
    console.log("No followed artists found. Nothing to match.");
    stats.duration_ms = Date.now() - startTime;
    return stats;
  }

  // Step 3: Group by tier
  const { exact, fuzzy, skipped } = groupArtistsByTier(allArtists);
  stats.skipped_short_names = skipped.length;
  console.log(
    `Tiers: ${exact.size} exact (3-char), ${fuzzy.size} fuzzy (4+), ${skipped.length} skipped (<3)`
  );

  // Step 4a: Exact matching (3-char names)
  const exactNames = Array.from(exact.keys());
  const exactMatches = await matchExactNames(
    supabase,
    exactNames,
    lastProcessedAt
  );
  console.log(`Exact matches (title): ${exactMatches.length}`);

  // Step 4b: Fuzzy matching (4+ char names)
  const fuzzyNames = Array.from(fuzzy.keys());
  const fuzzyMatches = await matchFuzzyNames(
    supabase,
    fuzzyNames,
    lastProcessedAt
  );
  console.log(`Fuzzy matches (title): ${fuzzyMatches.length}`);

  // Collect all title-matched event IDs
  const titleMatchedEventIds = new Set<string>();
  for (const m of [...exactMatches, ...fuzzyMatches]) {
    titleMatchedEventIds.add(m.event_id);
  }

  // Step 5: Secondary description matching
  const allNames = [...exactNames, ...fuzzyNames];
  const descriptionMatches = await matchDescriptionNames(
    supabase,
    allNames,
    lastProcessedAt,
    titleMatchedEventIds
  );
  console.log(`Description matches (secondary): ${descriptionMatches.length}`);

  // Step 6: Build full match results with user mappings
  const allMatches: MatchResult[] = [];

  for (const match of exactMatches) {
    const artists = exact.get(match.matched_name) || [];
    for (const artist of artists) {
      allMatches.push({
        user_id: artist.user_id,
        event_id: match.event_id,
        event_title: match.event_title,
        artist_name: artist.artist_name,
        match_score: match.score,
        match_source: "title",
      });
    }
  }

  for (const match of fuzzyMatches) {
    const artists = fuzzy.get(match.matched_name) || [];
    for (const artist of artists) {
      allMatches.push({
        user_id: artist.user_id,
        event_id: match.event_id,
        event_title: match.event_title,
        artist_name: artist.artist_name,
        match_score: match.score,
        match_source: "title",
      });
    }
  }

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
        match_source: "description",
      });
    }
  }

  stats.matches_found = allMatches.length;
  console.log(`Total matches: ${allMatches.length}`);

  if (allMatches.length > 0) {
    // Step 7: Insert per-artist match records
    const inserted = await insertArtistEventMatches(supabase, allMatches);
    console.log(`Inserted ${inserted} artist_event_notification records`);

    // Step 8: Fetch notification preferences for all relevant users
    const uniqueUserIds = [
      ...new Set(allMatches.map((m) => m.user_id)),
    ];
    const prefsMap = await fetchNotificationPreferences(
      supabase,
      uniqueUserIds
    );

    // Step 9: Create grouped notifications with channel routing
    const notifResult = await createGroupedNotifications(
      supabase,
      allMatches,
      prefsMap
    );
    stats.notifications_created = notifResult.inApp;
    console.log(
      `Created ${notifResult.inApp} in-app notifications, ${notifResult.emailStubs} email stubs, ${notifResult.smsStubs} SMS stubs`
    );

    // Step 9b: Schedule 7d and 1d reminders for matched events
    const remindersScheduled = await scheduleReminders(
      supabase,
      allMatches,
      prefsMap
    );
    stats.reminders_scheduled = remindersScheduled;
    console.log(`Scheduled ${remindersScheduled} event reminders (7d/1d)`);
  }

  // Step 10: Count events processed
  const { count: eventsCount } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .gte("start_date", new Date().toISOString())
    .gt("updated_at", lastProcessedAt);

  stats.events_processed = eventsCount ?? 0;

  // Step 11: Update cursor on success
  await updateMatchingCursor(supabase, stats.events_processed, stats.matches_found);
  console.log("Matching cursor updated");

  stats.duration_ms = Date.now() - startTime;
  return stats;
}

// ── HTTP Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate authorization
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Create service role client for full access
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    console.log("=== Artist-Event Matching Pipeline (Edge Function) ===");
    const stats = await runMatchingPipeline(supabase);

    console.log("=== Pipeline Complete ===");
    console.log(`  Artists checked: ${stats.artists_checked}`);
    console.log(`  Skipped short names: ${stats.skipped_short_names}`);
    console.log(`  Events processed: ${stats.events_processed}`);
    console.log(`  Matches found: ${stats.matches_found}`);
    console.log(`  Notifications created: ${stats.notifications_created}`);
    console.log(`  Reminders scheduled: ${stats.reminders_scheduled}`);
    console.log(`  Duration: ${stats.duration_ms}ms`);

    return new Response(JSON.stringify({ success: true, stats }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Matching pipeline failed:", message);

    // Do NOT update cursor on failure (idempotent replay)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
