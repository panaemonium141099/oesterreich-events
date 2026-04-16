import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyName,
  qualifiesForDescriptionMatch,
  stripDiacritics,
  normalizeArtistName,
  buildExactMatchRegex,
  formatNotificationBody,
  isFalsePositiveMatch,
  groupArtistsByTier,
  type FollowedArtist,
  getMatchingCursor,
  updateMatchingCursor,
  resetMatchingCursor,
  fetchAllFollowedArtists,
  insertArtistEventMatches,
  createGroupedNotifications,
  runMatchingPipeline,
  type MatchResult,
} from '@/lib/artist-matching';

// ── Unit tests for pure functions ────────────────────────────────────────────

describe('classifyName', () => {
  it('should skip names shorter than 3 characters', () => {
    expect(classifyName('ab')).toBe('skip');
    expect(classifyName('a')).toBe('skip');
    expect(classifyName('')).toBe('skip');
  });

  it('should classify 3-char names as exact', () => {
    expect(classifyName('abc')).toBe('exact');
    expect(classifyName('SIA')).toBe('exact'); // before normalization
  });

  it('should classify 4-5 char names as exact (short-name protection)', () => {
    expect(classifyName('abcd')).toBe('exact');
    expect(classifyName('Falco')).toBe('exact');
    expect(classifyName('Dame')).toBe('exact');
    expect(classifyName('Zedd')).toBe('exact');
  });

  it('should classify 6+ char names as fuzzy', () => {
    expect(classifyName('Bilderbuch')).toBe('fuzzy');
    expect(classifyName('Pizzera')).toBe('fuzzy');
    expect(classifyName('ILLENIUM')).toBe('fuzzy');
  });

  it('should trim whitespace before measuring length', () => {
    expect(classifyName('  ab  ')).toBe('skip');
    expect(classifyName(' abc ')).toBe('exact');
    expect(classifyName(' abcd ')).toBe('exact');
    expect(classifyName(' abcdef ')).toBe('fuzzy');
  });
});

describe('qualifiesForDescriptionMatch', () => {
  it('should return false for names shorter than 6 characters', () => {
    expect(qualifiesForDescriptionMatch('abc')).toBe(false);
    expect(qualifiesForDescriptionMatch('abcde')).toBe(false);
  });

  it('should return true for names with 6+ characters', () => {
    expect(qualifiesForDescriptionMatch('abcdef')).toBe(true);
    expect(qualifiesForDescriptionMatch('Bilderbuch')).toBe(true);
  });
});

describe('stripDiacritics', () => {
  it('should strip German umlauts', () => {
    expect(stripDiacritics('Osterreich')).toBe('Osterreich'); // no umlaut
    expect(stripDiacritics('\u00D6sterreich')).toBe('Osterreich'); // O with umlaut
    expect(stripDiacritics('\u00FC')).toBe('u'); // u with umlaut
    expect(stripDiacritics('\u00E4')).toBe('a'); // a with umlaut
  });

  it('should strip accent marks', () => {
    expect(stripDiacritics('caf\u00E9')).toBe('cafe');
    expect(stripDiacritics('na\u00EFve')).toBe('naive');
  });

  it('should leave ASCII text unchanged', () => {
    expect(stripDiacritics('Hello World')).toBe('Hello World');
    expect(stripDiacritics('abc123')).toBe('abc123');
  });
});

describe('normalizeArtistName', () => {
  it('should lowercase and strip diacritics', () => {
    expect(normalizeArtistName('Falco')).toBe('falco');
    expect(normalizeArtistName('WANDA')).toBe('wanda');
    expect(normalizeArtistName('B\u00F6hse Onkelz')).toBe('bohse onkelz');
  });

  it('should trim whitespace', () => {
    expect(normalizeArtistName('  Falco  ')).toBe('falco');
  });
});

describe('buildExactMatchRegex', () => {
  it('should wrap name in word boundary markers', () => {
    expect(buildExactMatchRegex('sia')).toBe('\\msia\\M');
    expect(buildExactMatchRegex('aja')).toBe('\\maja\\M');
  });

  it('should escape regex special characters', () => {
    expect(buildExactMatchRegex('a.b')).toBe('\\ma\\.b\\M');
    expect(buildExactMatchRegex('a+b')).toBe('\\ma\\+b\\M');
  });
});

describe('formatNotificationBody', () => {
  it('should format single artist', () => {
    expect(formatNotificationBody(['Falco'], 'Rock me Amadeus Concert'))
      .toBe('Falco tritt bei Rock me Amadeus Concert auf!');
  });

  it('should format two artists', () => {
    expect(formatNotificationBody(['Falco', 'Wanda'], 'Austrian Music Night'))
      .toBe('Falco und Wanda treten bei Austrian Music Night auf!');
  });

  it('should format three or more artists', () => {
    expect(formatNotificationBody(['Falco', 'Wanda', 'Bilderbuch'], 'Festival'))
      .toBe('Falco, Wanda und Bilderbuch treten bei Festival auf!');
  });

  it('should deduplicate artist names', () => {
    expect(formatNotificationBody(['Falco', 'Falco'], 'Concert'))
      .toBe('Falco tritt bei Concert auf!');
  });

  it('should return empty string for empty array', () => {
    expect(formatNotificationBody([], 'Concert')).toBe('');
  });
});

// ── False positive detection tests ──────────────────────────────────────────

describe('isFalsePositiveMatch', () => {
  // ── SHOULD BE REJECTED (return true = false positive) ──

  describe('word-boundary check (short names ≤ 10 chars)', () => {
    it('rejects "Dame" in "Damenturngruppe"', () => {
      expect(isFalsePositiveMatch('Dame', 'Damenturngruppe Sportfest')).toBe(true);
    });

    it('rejects "Zedd" when fuzzy-matched to "Zederhaus"', () => {
      expect(isFalsePositiveMatch('Zedd', 'Wandern in Zederhaus')).toBe(true);
    });

    it('rejects "ILLENIUM" when not in title at all', () => {
      expect(isFalsePositiveMatch('ILLENIUM', 'Brass Fest: Thomas Gansch Blasmusik Supergroup')).toBe(true);
    });

    it('rejects "Stockmann" when not in title', () => {
      expect(isFalsePositiveMatch('Stockmann', 'Natur und Religion im einKLANG')).toBe(true);
    });
  });

  describe('reference patterns (bis zu, tribute, cover)', () => {
    it('rejects "bis zu [Artist]"', () => {
      expect(isFalsePositiveMatch('Coldplay', 'Musikkapelle Patsch: Von Sisi bis zu Coldplay')).toBe(true);
    });

    it('rejects "bis [Artist]"', () => {
      expect(isFalsePositiveMatch('ACDC', 'Die besten Hits von Queen bis ACDC')).toBe(true);
    });

    it('rejects "tribute to [Artist]"', () => {
      expect(isFalsePositiveMatch('Queen', 'Tribute to Queen - Die Show')).toBe(true);
    });

    it('rejects "hommage an [Artist]"', () => {
      expect(isFalsePositiveMatch('Mozart', 'Hommage an Mozart')).toBe(true);
    });

    it('rejects "cover von [Artist]"', () => {
      expect(isFalsePositiveMatch('Beatles', 'Covers von Beatles und Rolling Stones')).toBe(true);
    });

    it('rejects "hits von [Artist]"', () => {
      expect(isFalsePositiveMatch('Madonna', 'Die groessten Hits von Madonna')).toBe(true);
    });
  });

  describe('cover-band / brass-band prefix', () => {
    it('rejects "musikkapelle" title with artist far from start', () => {
      expect(isFalsePositiveMatch('Coldplay', 'Musikkapelle Patsch: Von Sisi bis zu Coldplay')).toBe(true);
    });

    it('rejects "blasmusik" title with artist far from start', () => {
      expect(isFalsePositiveMatch('Queen', 'Blasmusik Konzert: Von Falco bis Queen')).toBe(true);
    });
  });

  describe('headliner-position check', () => {
    it('rejects artist in tour name after separator', () => {
      expect(isFalsePositiveMatch('ILLENIUM', 'David Garrett - Millenium Symphony')).toBe(true);
    });

    it('rejects artist after " – " separator', () => {
      expect(isFalsePositiveMatch('Rain', 'Volksmusik Abend – Purple Rain Tribute')).toBe(true);
    });
  });

  // ── SHOULD BE KEPT (return false = legitimate match) ──

  describe('legitimate matches (should NOT be rejected)', () => {
    it('keeps exact headliner match', () => {
      expect(isFalsePositiveMatch('Dame', 'Dame - Der Weg ist das Ziel 2.0 - Live 2026')).toBe(false);
    });

    it('keeps "Pizzera und Jaus" fuzzy match to "Pizzera & Jaus"', () => {
      expect(isFalsePositiveMatch('Pizzera und Jaus', 'Pizzera & Jaus - Wien Live')).toBe(false);
    });

    it('keeps lineup match (festival derived event)', () => {
      expect(isFalsePositiveMatch('Bad Omens', 'Bad Omens at Nova Rock')).toBe(false);
    });

    it('keeps exact name in short title', () => {
      expect(isFalsePositiveMatch('Wanda', 'Wanda live in Wien')).toBe(false);
    });

    it('keeps artist as sole headliner before separator', () => {
      expect(isFalsePositiveMatch('Tream', 'Tream - Zur Weissbier-Probe Tour 2026')).toBe(false);
    });

    it('keeps VICKY when name is standalone in title', () => {
      expect(isFalsePositiveMatch('VICKY', 'Vicky live im WUK')).toBe(false);
    });

    it('keeps long name even without title match', () => {
      // Long names (>10 chars) bypass word-boundary check — description matches are trusted
      expect(isFalsePositiveMatch('Bring Me The Horizon', 'Nova Rock 2026')).toBe(false);
    });
  });
});

describe('groupArtistsByTier', () => {
  const makeArtist = (name: string, userId: string = 'user-1'): FollowedArtist => ({
    id: `id-${name}`,
    user_id: userId,
    artist_name: name,
    artist_name_normalized: name.toLowerCase(),
  });

  it('should group artists by name length tiers', () => {
    const artists = [
      makeArtist('DJ'), // 2 chars -> skip
      makeArtist('SIA'), // 3 chars -> exact
      makeArtist('Wanda'), // 5 chars -> exact (≤5 = exact)
      makeArtist('Bilderbuch'), // 10 chars -> fuzzy
    ];

    const result = groupArtistsByTier(artists);

    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toBe('DJ');
    expect(result.exact.size).toBe(2);
    expect(result.exact.has('sia')).toBe(true);
    expect(result.exact.has('wanda')).toBe(true);
    expect(result.fuzzy.size).toBe(1);
    expect(result.fuzzy.has('bilderbuch')).toBe(true);
  });

  it('should group multiple users following the same artist', () => {
    const artists = [
      makeArtist('Wanda', 'user-1'),
      makeArtist('Wanda', 'user-2'),
    ];

    const result = groupArtistsByTier(artists);

    // 'Wanda' = 5 chars → exact tier (≤5)
    expect(result.exact.get('wanda')).toHaveLength(2);
  });

  it('should normalize names with diacritics', () => {
    const artists = [makeArtist('B\u00F6hse Onkelz')];
    const result = groupArtistsByTier(artists);

    expect(result.fuzzy.has('bohse onkelz')).toBe(true);
  });
});

// ── Integration tests with mocked Supabase ──────────────────────────────────

function createMockSupabase() {
  const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockFrom = vi.fn();

  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    range: vi.fn().mockResolvedValue({ data: [], error: null }),
  };

  const fromChain = {
    select: vi.fn().mockReturnValue(selectChain),
    upsert: vi.fn().mockResolvedValue({ error: null, count: 0 }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };

  mockFrom.mockReturnValue(fromChain);

  return {
    rpc: mockRpc,
    from: mockFrom,
    _fromChain: fromChain,
    _selectChain: selectChain,
  };
}

describe('getMatchingCursor', () => {
  it('should return default cursor when no data found', async () => {
    const supabase = createMockSupabase();
    const cursor = await getMatchingCursor(supabase as any);

    expect(cursor.last_processed_at).toBe('1970-01-01T00:00:00Z');
    expect(cursor.events_processed).toBe(0);
    expect(cursor.matches_found).toBe(0);
  });

  it('should return cursor data when found', async () => {
    const supabase = createMockSupabase();
    supabase._selectChain.single.mockResolvedValue({
      data: {
        last_processed_at: '2026-04-06T10:00:00Z',
        last_success_at: '2026-04-06T10:00:00Z',
        events_processed: 100,
        matches_found: 5,
      },
      error: null,
    });

    const cursor = await getMatchingCursor(supabase as any);

    expect(cursor.last_processed_at).toBe('2026-04-06T10:00:00Z');
    expect(cursor.events_processed).toBe(100);
  });
});

describe('fetchAllFollowedArtists', () => {
  it('should fetch all followed artists in batches', async () => {
    const supabase = createMockSupabase();
    const artists = [
      { id: '1', user_id: 'u1', artist_name: 'Falco', artist_name_normalized: 'falco' },
      { id: '2', user_id: 'u1', artist_name: 'Wanda', artist_name_normalized: 'wanda' },
    ];

    supabase._selectChain.range.mockResolvedValue({ data: artists, error: null });

    const result = await fetchAllFollowedArtists(supabase as any);

    expect(result).toHaveLength(2);
    expect(result[0].artist_name).toBe('Falco');
  });

  it('should throw on error', async () => {
    const supabase = createMockSupabase();
    supabase._selectChain.range.mockResolvedValue({
      data: null,
      error: { message: 'Connection error' },
    });

    await expect(fetchAllFollowedArtists(supabase as any)).rejects.toThrow();
  });
});

describe('insertArtistEventMatches', () => {
  it('should return 0 for empty matches', async () => {
    const supabase = createMockSupabase();
    const result = await insertArtistEventMatches(supabase as any, []);
    expect(result).toBe(0);
  });

  it('should upsert matches with dedup', async () => {
    const supabase = createMockSupabase();
    supabase._fromChain.upsert.mockResolvedValue({ error: null, count: 2 });

    const matches: MatchResult[] = [
      { user_id: 'u1', event_id: 'e1', event_title: 'Concert', artist_name: 'Falco', match_score: 0.8, match_source: 'title' },
      { user_id: 'u1', event_id: 'e2', event_title: 'Show', artist_name: 'Wanda', match_score: 0.7, match_source: 'title' },
    ];

    const result = await insertArtistEventMatches(supabase as any, matches);
    expect(result).toBe(2);
    expect(supabase.from).toHaveBeenCalledWith('artist_event_notifications');
  });
});

describe('createGroupedNotifications', () => {
  it('should group matches by user+event', async () => {
    const supabase = createMockSupabase();
    supabase._fromChain.upsert.mockResolvedValue({ error: null, count: 1 });

    const matches: MatchResult[] = [
      { user_id: 'u1', event_id: 'e1', event_title: 'Festival', artist_name: 'Falco', match_score: 0.8, match_source: 'title' },
      { user_id: 'u1', event_id: 'e1', event_title: 'Festival', artist_name: 'Wanda', match_score: 0.7, match_source: 'title' },
    ];

    await createGroupedNotifications(supabase as any, matches);

    // Should create just 1 notification for the user+event group
    expect(supabase.from).toHaveBeenCalledWith('notifications');
    const upsertCall = supabase._fromChain.upsert.mock.calls[0];
    expect(upsertCall[0]).toHaveLength(1);
    expect(upsertCall[0][0].body).toContain('Falco');
    expect(upsertCall[0][0].body).toContain('Wanda');
  });

  it('should return 0 for empty matches', async () => {
    const supabase = createMockSupabase();
    const result = await createGroupedNotifications(supabase as any, []);
    expect(result).toBe(0);
  });
});

describe('runMatchingPipeline', () => {
  it('should return early stats when no followed artists', async () => {
    const supabase = createMockSupabase();

    // cursor query returns default
    supabase._selectChain.single.mockResolvedValue({ data: null, error: null });
    // followed_artists query returns empty
    supabase._selectChain.range.mockResolvedValue({ data: [], error: null });

    const stats = await runMatchingPipeline(supabase as any);

    expect(stats.artists_checked).toBe(0);
    expect(stats.matches_found).toBe(0);
  });

  it('should run in dry-run mode without writing', async () => {
    const supabase = createMockSupabase();

    // cursor
    supabase._selectChain.single.mockResolvedValue({ data: null, error: null });
    // followed_artists
    supabase._selectChain.range.mockResolvedValue({
      data: [
        { id: '1', user_id: 'u1', artist_name: 'Bilderbuch', artist_name_normalized: 'bilderbuch' },
      ],
      error: null,
    });
    // RPC calls return no matches
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    const stats = await runMatchingPipeline(supabase as any, { dryRun: true });

    expect(stats.artists_checked).toBe(1);
    // Should NOT call upsert on artist_event_notifications in dry run
    expect(supabase._fromChain.upsert).not.toHaveBeenCalled();
  });
});

// ── Dedup and cursor management ──────────────────────────────────────────────

describe('cursor management', () => {
  it('updateMatchingCursor should upsert with current timestamp', async () => {
    const supabase = createMockSupabase();
    supabase._fromChain.upsert.mockResolvedValue({ error: null });

    await updateMatchingCursor(supabase as any, 100, 5);

    expect(supabase.from).toHaveBeenCalledWith('matching_cursor');
    const upsertCall = supabase._fromChain.upsert.mock.calls[0][0];
    expect(upsertCall.id).toBe('artist_matching');
    expect(upsertCall.events_processed).toBe(100);
    expect(upsertCall.matches_found).toBe(5);
  });

  it('resetMatchingCursor should set timestamp to epoch', async () => {
    const supabase = createMockSupabase();
    supabase._fromChain.upsert.mockResolvedValue({ error: null });

    await resetMatchingCursor(supabase as any);

    const upsertCall = supabase._fromChain.upsert.mock.calls[0][0];
    expect(upsertCall.last_processed_at).toBe('1970-01-01T00:00:00Z');
    expect(upsertCall.events_processed).toBe(0);
  });

  it('updateMatchingCursor should throw on error', async () => {
    const supabase = createMockSupabase();
    supabase._fromChain.upsert.mockResolvedValue({
      error: { message: 'DB error' },
    });

    await expect(updateMatchingCursor(supabase as any, 0, 0)).rejects.toThrow();
  });
});
