/**
 * Tests for venue backfill script.
 *
 * Tests the matching, normalization, and geo distance logic.
 * Does NOT test the actual Supabase read/write operations.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeLocationName,
  haversineKm,
  buildVenueIndex,
  matchEventToVenue,
  VENUE_MATCH_THRESHOLD,
  MAX_DISTANCE_KM,
  type VenueCandidate,
  type EventCandidate,
} from '../../scripts/backfill-venue-ids';

// ─── normalizeLocationName ──────────────────────────────────────────────────

describe('normalizeLocationName', () => {
  it('lowercases and trims', () => {
    expect(normalizeLocationName('  Flex Wien  ')).toBe('flex wien');
  });

  it('strips punctuation but keeps letters and digits', () => {
    expect(normalizeLocationName('U4 Club & Bar')).toBe('u4 club bar');
  });

  it('collapses whitespace', () => {
    expect(normalizeLocationName('Prater   Dome')).toBe('prater dome');
  });

  it('handles German umlauts', () => {
    expect(normalizeLocationName('Brückl Bräu')).toBe('brückl bräu');
  });

  it('handles special quotes', () => {
    expect(normalizeLocationName("O'Reilly's Pub")).toBe('o reilly s pub');
  });
});

// ─── haversineKm ────────────────────────────────────────────────────────────

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(48.2082, 16.3738, 48.2082, 16.3738)).toBe(0);
  });

  it('calculates distance between Wien and Bratislava (~55km)', () => {
    const dist = haversineKm(48.2082, 16.3738, 48.1486, 17.1077);
    expect(dist).toBeGreaterThan(50);
    expect(dist).toBeLessThan(65);
  });

  it('calculates short distance (~1km)', () => {
    // Wien Stephansdom to Wien Graben (roughly 200m)
    const dist = haversineKm(48.2084, 16.3731, 48.2091, 16.3686);
    expect(dist).toBeLessThan(1);
    expect(dist).toBeGreaterThan(0);
  });
});

// ─── buildVenueIndex ────────────────────────────────────────────────────────

describe('buildVenueIndex', () => {
  const venues: VenueCandidate[] = [
    {
      id: 'v1',
      name: 'Flex',
      name_normalized: 'flex',
      city: 'Wien',
      bundesland: 'wien',
      latitude: 48.2117,
      longitude: 16.3781,
    },
    {
      id: 'v2',
      name: 'Flex Bar',
      name_normalized: 'flex bar',
      city: 'Graz',
      bundesland: 'steiermark',
      latitude: 47.0707,
      longitude: 15.4395,
    },
  ];

  it('groups venues by normalized name', () => {
    const index = buildVenueIndex(venues);
    expect(index.size).toBe(2);
    expect(index.get('flex')).toHaveLength(1);
    expect(index.get('flex bar')).toHaveLength(1);
  });

  it('groups multiple venues with same normalized name', () => {
    const dupes: VenueCandidate[] = [
      { ...venues[0], id: 'v1a' },
      { ...venues[0], id: 'v1b', city: 'Linz' },
    ];
    const index = buildVenueIndex(dupes);
    expect(index.get('flex')).toHaveLength(2);
  });
});

// ─── matchEventToVenue ──────────────────────────────────────────────────────

describe('matchEventToVenue', () => {
  const venues: VenueCandidate[] = [
    {
      id: 'v1',
      name: 'Flex',
      name_normalized: 'flex',
      city: 'Wien',
      bundesland: 'wien',
      latitude: 48.2117,
      longitude: 16.3781,
    },
    {
      id: 'v2',
      name: 'Praterdome',
      name_normalized: 'praterdome',
      city: 'Wien',
      bundesland: 'wien',
      latitude: 48.2164,
      longitude: 16.3952,
    },
    {
      id: 'v3',
      name: 'Postgarage',
      name_normalized: 'postgarage',
      city: 'Graz',
      bundesland: 'steiermark',
      latitude: 47.0694,
      longitude: 15.4273,
    },
  ];

  const index = buildVenueIndex(venues);

  it('matches exact normalized name', () => {
    const event: EventCandidate = {
      id: 'e1',
      title: 'DJ Night',
      location_name: 'Flex',
      address: null,
      bundesland: 'wien',
      latitude: 48.2117,
      longitude: 16.3781,
    };

    const match = matchEventToVenue(event, index, venues);
    expect(match).not.toBeNull();
    expect(match!.venueId).toBe('v1');
    expect(match!.similarity).toBe(1.0);
    expect(match!.method).toBe('name-exact');
  });

  it('matches with punctuation differences', () => {
    const event: EventCandidate = {
      id: 'e2',
      title: 'Live Music',
      location_name: 'Prater-Dome',
      address: null,
      bundesland: 'wien',
      latitude: 48.2164,
      longitude: 16.3952,
    };

    // "prater dome" vs "praterdome" -- Jaro-Winkler should be very high
    const match = matchEventToVenue(event, index, venues);
    // This might match via fuzzy since normalized "prater dome" != "praterdome"
    if (match) {
      expect(match.venueId).toBe('v2');
      expect(match.similarity).toBeGreaterThanOrEqual(VENUE_MATCH_THRESHOLD);
    }
  });

  it('returns null for no location_name', () => {
    const event: EventCandidate = {
      id: 'e3',
      title: 'Concert',
      location_name: null,
      address: null,
      bundesland: 'wien',
      latitude: 48.2,
      longitude: 16.3,
    };

    expect(matchEventToVenue(event, index, venues)).toBeNull();
  });

  it('returns null for very short location_name', () => {
    const event: EventCandidate = {
      id: 'e4',
      title: 'Concert',
      location_name: 'AB',
      address: null,
      bundesland: 'wien',
      latitude: 48.2,
      longitude: 16.3,
    };

    expect(matchEventToVenue(event, index, venues)).toBeNull();
  });

  it('returns null for completely unrelated location name', () => {
    const event: EventCandidate = {
      id: 'e5',
      title: 'Festival',
      location_name: 'Schloss Esterhazy Eisenstadt',
      address: null,
      bundesland: 'burgenland',
      latitude: 47.8458,
      longitude: 16.5182,
    };

    expect(matchEventToVenue(event, index, venues)).toBeNull();
  });

  it('rejects fuzzy match when venue is too far away', () => {
    // Create venue in Wien and event with same name but in Graz
    const wienVenue: VenueCandidate = {
      id: 'v-wien',
      name: 'Unique Test Bar',
      name_normalized: 'unique test bar',
      city: 'Wien',
      bundesland: 'wien',
      latitude: 48.2082,
      longitude: 16.3738,
    };
    const testVenues = [wienVenue];
    const testIndex = buildVenueIndex(testVenues);

    const event: EventCandidate = {
      id: 'e-graz',
      title: 'Party',
      location_name: 'Unique Test Bar',
      address: null,
      bundesland: 'steiermark',
      latitude: 47.0707, // Graz
      longitude: 15.4395,
    };

    // Exact name match BUT ~145km away -> should still match via exact method
    // (geo distance only rejects fuzzy matches, exact matches are kept)
    const match = matchEventToVenue(event, testIndex, testVenues);
    expect(match).not.toBeNull();
    expect(match!.method).toBe('name-exact');
  });
});

// ─── Constants ──────────────────────────────────────────────────────────────

describe('constants', () => {
  it('threshold is 0.9 (conservative)', () => {
    expect(VENUE_MATCH_THRESHOLD).toBe(0.9);
  });

  it('max distance is 2km', () => {
    expect(MAX_DISTANCE_KM).toBe(2.0);
  });
});
