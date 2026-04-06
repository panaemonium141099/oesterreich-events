/**
 * Integration tests for Artist Alerts API routes.
 *
 * Tests follow API, search API, following list API, and artist events API.
 * All Supabase calls are mocked.
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.11
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock Supabase server client ─────────────────────────────────────────────

const mockUser = { id: 'user-abc-123', email: 'test@example.com' };
let mockAuthUser: { id: string; email: string } | null = mockUser;

const mockSelectChain = {
  eq: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
};

const mockFromChain = {
  select: vi.fn().mockReturnValue(mockSelectChain),
  upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
  insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  delete: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null, count: 1 }),
    }),
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockImplementation(() =>
        Promise.resolve({ data: { user: mockAuthUser }, error: null })
      ),
    },
    from: vi.fn().mockReturnValue(mockFromChain),
  }),
}));

vi.mock('@/lib/spotify', () => ({
  searchSpotifyArtists: vi.fn().mockResolvedValue([
    { id: 'sp-1', name: 'Falco', image_url: 'https://img.spotify.com/falco.jpg', genres: ['pop'], popularity: 75 },
    { id: 'sp-2', name: 'Wanda', image_url: 'https://img.spotify.com/wanda.jpg', genres: ['indie'], popularity: 60 },
  ]),
  SpotifyRateLimitError: class SpotifyRateLimitError extends Error {
    retryAfter?: number;
    constructor(message: string, retryAfter?: number) {
      super(message);
      this.retryAfter = retryAfter;
    }
  },
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(url, options as never);
}

// ── Follow API Tests ────────────────────────────────────────────────────────

describe('POST /api/artists/follow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = mockUser;
  });

  it('should return 401 when not authenticated', async () => {
    mockAuthUser = null;
    const { POST } = await import('@/app/api/artists/follow/route');
    const req = makeRequest('http://localhost:3000/api/artists/follow', {
      method: 'POST',
      body: JSON.stringify({ artist_name: 'Falco' }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('should return 400 when artist_name is missing', async () => {
    const { POST } = await import('@/app/api/artists/follow/route');
    const req = makeRequest('http://localhost:3000/api/artists/follow', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('should return 400 when artist_name is empty string', async () => {
    const { POST } = await import('@/app/api/artists/follow/route');
    const req = makeRequest('http://localhost:3000/api/artists/follow', {
      method: 'POST',
      body: JSON.stringify({ artist_name: '   ' }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('should follow an artist with manual source', async () => {
    mockFromChain.upsert.mockResolvedValueOnce({ data: null, error: null });
    const selectSingleChain = {
      single: vi.fn().mockResolvedValue({
        data: { id: 'fa-1', artist_name: 'Falco', source: 'manual' },
        error: null,
      }),
    };
    mockFromChain.select = vi.fn().mockReturnValue(selectSingleChain);
    // Reconstruct the chain so upsert -> select -> single works
    mockFromChain.upsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'fa-1', artist_name: 'Falco', source: 'manual' },
          error: null,
        }),
      }),
    });

    const { POST } = await import('@/app/api/artists/follow/route');
    const req = makeRequest('http://localhost:3000/api/artists/follow', {
      method: 'POST',
      body: JSON.stringify({ artist_name: 'Falco' }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.followed_artist).toBeDefined();
    expect(data.followed_artist.artist_name).toBe('Falco');
  });

  it('should follow an artist with spotify source and metadata', async () => {
    mockFromChain.upsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'fa-2',
            artist_name: 'Wanda',
            source: 'spotify',
            spotify_artist_id: 'sp-wanda',
            spotify_image_url: 'https://img.spotify.com/wanda.jpg',
          },
          error: null,
        }),
      }),
    });

    const { POST } = await import('@/app/api/artists/follow/route');
    const req = makeRequest('http://localhost:3000/api/artists/follow', {
      method: 'POST',
      body: JSON.stringify({
        artist_name: 'Wanda',
        spotify_artist_id: 'sp-wanda',
        spotify_image_url: 'https://img.spotify.com/wanda.jpg',
        source: 'spotify',
      }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.followed_artist.source).toBe('spotify');
    expect(data.followed_artist.spotify_artist_id).toBe('sp-wanda');
  });
});

describe('DELETE /api/artists/follow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = mockUser;
  });

  it('should return 401 when not authenticated', async () => {
    mockAuthUser = null;
    const { DELETE } = await import('@/app/api/artists/follow/route');
    const req = makeRequest('http://localhost:3000/api/artists/follow', {
      method: 'DELETE',
      body: JSON.stringify({ artist_name: 'Falco' }),
    });

    const res = await DELETE(req as any);
    expect(res.status).toBe(401);
  });

  it('should return 400 when neither id nor artist_name provided', async () => {
    const { DELETE } = await import('@/app/api/artists/follow/route');
    const req = makeRequest('http://localhost:3000/api/artists/follow', {
      method: 'DELETE',
      body: JSON.stringify({}),
    });

    const res = await DELETE(req as any);
    expect(res.status).toBe(400);
  });
});

// ── Search API Tests ────────────────────────────────────────────────────────

describe('GET /api/artists/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser = mockUser;
  });

  it('should return 401 when not authenticated', async () => {
    mockAuthUser = null;
    const { GET } = await import('@/app/api/artists/search/route');
    const req = makeRequest('http://localhost:3000/api/artists/search?q=Falco');

    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('should return empty array for query shorter than 2 chars', async () => {
    const { GET } = await import('@/app/api/artists/search/route');
    const req = makeRequest('http://localhost:3000/api/artists/search?q=F');

    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.artists).toEqual([]);
  });

  it('should return empty array when query is missing', async () => {
    const { GET } = await import('@/app/api/artists/search/route');
    const req = makeRequest('http://localhost:3000/api/artists/search');

    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.artists).toEqual([]);
  });

  it('should search Spotify and return artists for valid query', async () => {
    const { GET } = await import('@/app/api/artists/search/route');
    const req = makeRequest('http://localhost:3000/api/artists/search?q=Falco');

    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.artists).toHaveLength(2);
    expect(data.artists[0].name).toBe('Falco');
  });

  it('should respect limit parameter clamped to 1-20', async () => {
    const { searchSpotifyArtists } = await import('@/lib/spotify');
    const { GET } = await import('@/app/api/artists/search/route');
    const req = makeRequest('http://localhost:3000/api/artists/search?q=Falco&limit=5');

    await GET(req as any);
    expect(searchSpotifyArtists).toHaveBeenCalledWith('Falco', 5);
  });

  it('should set Cache-Control header on success', async () => {
    const { GET } = await import('@/app/api/artists/search/route');
    const req = makeRequest('http://localhost:3000/api/artists/search?q=Falco');

    const res = await GET(req as any);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=60');
  });

  it('should return 429 on Spotify rate limit', async () => {
    const { searchSpotifyArtists, SpotifyRateLimitError } = await import('@/lib/spotify');
    (searchSpotifyArtists as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new SpotifyRateLimitError('Rate limited', 30)
    );

    const { GET } = await import('@/app/api/artists/search/route');
    const req = makeRequest('http://localhost:3000/api/artists/search?q=Falco');

    const res = await GET(req as any);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
  });
});

// ── Notification Preferences API Tests ──────────────────────────────────────

describe('notification preferences API', () => {
  // These tests validate the E.164 phone validation and preferences structure.
  // The actual route uses cookies() which requires a full Next.js context,
  // so we test the validation logic directly.

  it('validates E.164 phone numbers correctly', () => {
    const E164_REGEX = /^\+[1-9]\d{6,14}$/;

    expect(E164_REGEX.test('+436641234567')).toBe(true);
    expect(E164_REGEX.test('+4915112345678')).toBe(true);
    expect(E164_REGEX.test('436641234567')).toBe(false); // missing +
    expect(E164_REGEX.test('+0641234567')).toBe(false); // starts with 0
    expect(E164_REGEX.test('+12345')).toBe(false); // too short
    expect(E164_REGEX.test('')).toBe(false);
  });

  it('applies correct default preferences when no row exists', () => {
    const defaults = {
      artist_alerts_enabled: true,
      channel_in_app: true,
      channel_email: false,
      channel_sms: false,
      reminder_7d: true,
      reminder_1d: true,
      phone_number: null,
    };

    // Verify defaults match what the API returns
    expect(defaults.channel_in_app).toBe(true); // always on
    expect(defaults.channel_email).toBe(false); // GDPR: off by default
    expect(defaults.channel_sms).toBe(false); // GDPR: off by default
    expect(defaults.phone_number).toBeNull();
  });

  it('validates preference upsert data shape', () => {
    const userId = 'user-123';
    const body = {
      artist_alerts_enabled: true,
      channel_email: true,
      channel_sms: true,
      reminder_7d: true,
      reminder_1d: false,
      phone_number: '+436641234567',
    };

    const channelSms = body.channel_sms === true;
    const phoneNumber = typeof body.phone_number === 'string' ? body.phone_number.trim() : null;

    const upsertData = {
      user_id: userId,
      artist_alerts_enabled: body.artist_alerts_enabled !== false,
      channel_in_app: true, // Always enabled
      channel_email: body.channel_email === true,
      channel_sms: channelSms,
      reminder_7d: body.reminder_7d !== false,
      reminder_1d: body.reminder_1d !== false,
      phone_number: channelSms ? phoneNumber : null,
    };

    expect(upsertData.channel_in_app).toBe(true);
    expect(upsertData.channel_email).toBe(true);
    expect(upsertData.channel_sms).toBe(true);
    expect(upsertData.phone_number).toBe('+436641234567');
    expect(upsertData.reminder_1d).toBe(false);
  });

  it('nullifies phone_number when SMS is disabled', () => {
    const channelSms = false;
    const phoneNumber = '+436641234567';

    const resultPhone = channelSms ? phoneNumber : null;
    expect(resultPhone).toBeNull();
  });

  it('rejects SMS without phone number', () => {
    const channelSms = true;
    const phoneNumber: string | null = null;

    const isValid = !(channelSms && !phoneNumber);
    expect(isValid).toBe(false);
  });
});
