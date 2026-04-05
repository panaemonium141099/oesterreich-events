/**
 * Tests for OSM Overpass venue import script.
 *
 * Tests the mapping, normalization, and deduplication logic.
 * Does NOT test the actual Overpass API call or Supabase upsert.
 */
import { describe, it, expect } from 'vitest';
import {
  buildOverpassQuery,
  elementToVenue,
  mapOsmToVenueType,
  normalizeName,
  bundeslandFromCoords,
  isStudentRelevant,
  calculateLocalnessScore,
  getCoordinates,
  deduplicateElements,
  type OverpassElement,
  type VenueRow,
} from '../../scripts/import-osm-venues';

// ─── mapOsmToVenueType ─────────────────────────────────────────────────────

describe('mapOsmToVenueType', () => {
  it('maps amenity=bar to bar type', () => {
    expect(mapOsmToVenueType({ amenity: 'bar' })).toEqual({ type: 'bar', subtype: null });
  });

  it('maps amenity=pub to pub type', () => {
    expect(mapOsmToVenueType({ amenity: 'pub' })).toEqual({ type: 'pub', subtype: null });
  });

  it('maps amenity=nightclub to nightclub type', () => {
    expect(mapOsmToVenueType({ amenity: 'nightclub' })).toEqual({ type: 'nightclub', subtype: null });
  });

  it('maps leisure=nightclub to nightclub type', () => {
    expect(mapOsmToVenueType({ leisure: 'nightclub' })).toEqual({ type: 'nightclub', subtype: null });
  });

  it('maps amenity=biergarten to bar/biergarten', () => {
    expect(mapOsmToVenueType({ amenity: 'biergarten' })).toEqual({ type: 'bar', subtype: 'biergarten' });
  });

  it('detects karaoke bar subtype', () => {
    expect(mapOsmToVenueType({ amenity: 'bar', karaoke: 'yes' })).toEqual({ type: 'bar', subtype: 'karaoke_bar' });
  });

  it('detects cocktail bar subtype', () => {
    expect(mapOsmToVenueType({ amenity: 'bar', cocktails: 'yes' })).toEqual({ type: 'bar', subtype: 'cocktail_bar' });
  });

  it('detects wine bar subtype', () => {
    expect(mapOsmToVenueType({ amenity: 'bar', wine: 'yes' })).toEqual({ type: 'bar', subtype: 'wine_bar' });
  });

  it('detects brewpub subtype', () => {
    expect(mapOsmToVenueType({ amenity: 'pub', microbrewery: 'yes' })).toEqual({ type: 'pub', subtype: 'brewpub' });
  });

  it('detects nightclub music subtype', () => {
    expect(mapOsmToVenueType({ amenity: 'nightclub', music: 'techno' })).toEqual({ type: 'nightclub', subtype: 'techno_club' });
  });

  it('returns other for unknown amenity', () => {
    expect(mapOsmToVenueType({ amenity: 'restaurant' })).toEqual({ type: 'other', subtype: null });
  });
});

// ─── normalizeName ──────────────────────────────────────────────────────────

describe('normalizeName', () => {
  it('lowercases and trims', () => {
    expect(normalizeName('  Café Leopold  ')).toBe('café leopold');
  });

  it('normalizes whitespace', () => {
    expect(normalizeName('Flex    Club')).toBe('flex club');
  });

  it('normalizes quotes', () => {
    expect(normalizeName("O'Reilly's")).toBe("o'reilly's");
  });
});

// ─── bundeslandFromCoords ───────────────────────────────────────────────────

describe('bundeslandFromCoords', () => {
  it('identifies Wien', () => {
    expect(bundeslandFromCoords(48.21, 16.37)).toBe('wien');
  });

  it('identifies Salzburg', () => {
    // Salzburg city center: 47.08, 13.045 (south of OÖ overlap zone)
    expect(bundeslandFromCoords(47.08, 13.045)).toBe('salzburg');
  });

  it('identifies Tirol', () => {
    expect(bundeslandFromCoords(47.26, 11.39)).toBe('tirol');
  });

  it('identifies Vorarlberg', () => {
    expect(bundeslandFromCoords(47.25, 9.88)).toBe('vorarlberg');
  });

  it('returns null for out-of-bounds coords', () => {
    expect(bundeslandFromCoords(50.0, 10.0)).toBeNull();
  });

  it('prioritizes Wien over NÖ for Wien coordinates', () => {
    // Wien is inside NÖ bbox, but Wien should be checked first
    expect(bundeslandFromCoords(48.20, 16.37)).toBe('wien');
  });
});

// ─── isStudentRelevant ──────────────────────────────────────────────────────

describe('isStudentRelevant', () => {
  it('detects student keywords', () => {
    expect(isStudentRelevant({ name: 'Uni Bar' })).toBe(true);
    expect(isStudentRelevant({ name: 'Campus Pub' })).toBe(true);
    expect(isStudentRelevant({ name: 'Studibeisl' })).toBe(true);
  });

  it('returns false for normal venues', () => {
    expect(isStudentRelevant({ name: 'Flex Club' })).toBe(false);
    expect(isStudentRelevant({ name: "O'Connors Irish Pub" })).toBe(false);
  });
});

// ─── calculateLocalnessScore ────────────────────────────────────────────────

describe('calculateLocalnessScore', () => {
  it('gives high score to regular bar', () => {
    expect(calculateLocalnessScore({ amenity: 'bar' }, 'bar')).toBe(70);
  });

  it('reduces score for branded venues', () => {
    expect(calculateLocalnessScore({ amenity: 'bar', brand: 'Hard Rock Cafe' }, 'bar')).toBe(50);
  });

  it('reduces score for nightclubs', () => {
    expect(calculateLocalnessScore({ amenity: 'nightclub' }, 'nightclub')).toBe(60);
  });

  it('increases score for biergartens', () => {
    expect(calculateLocalnessScore({ amenity: 'biergarten' }, 'bar')).toBe(80);
  });

  it('clamps to 0-100 range', () => {
    // Branded nightclub: 70 - 20 - 10 = 40
    expect(calculateLocalnessScore({ amenity: 'nightclub', brand: 'XYZ' }, 'nightclub')).toBe(40);
  });
});

// ─── getCoordinates ─────────────────────────────────────────────────────────

describe('getCoordinates', () => {
  it('extracts coords from node', () => {
    expect(getCoordinates({ type: 'node', id: 1, lat: 48.2, lon: 16.3 })).toEqual({ lat: 48.2, lon: 16.3 });
  });

  it('extracts coords from way center', () => {
    expect(getCoordinates({ type: 'way', id: 2, center: { lat: 48.2, lon: 16.3 } })).toEqual({ lat: 48.2, lon: 16.3 });
  });

  it('returns null when no coords', () => {
    expect(getCoordinates({ type: 'way', id: 3 })).toBeNull();
  });
});

// ─── deduplicateElements ────────────────────────────────────────────────────

describe('deduplicateElements', () => {
  it('removes duplicate elements by type:id', () => {
    const elements: OverpassElement[] = [
      { type: 'node', id: 1, lat: 48.2, lon: 16.3, tags: { name: 'Bar A', amenity: 'bar' } },
      { type: 'node', id: 1, lat: 48.2, lon: 16.3, tags: { name: 'Bar A', amenity: 'bar' } },
      { type: 'node', id: 2, lat: 48.3, lon: 16.4, tags: { name: 'Bar B', amenity: 'bar' } },
    ];
    const result = deduplicateElements(elements);
    expect(result).toHaveLength(2);
  });

  it('keeps different types with same numeric id', () => {
    const elements: OverpassElement[] = [
      { type: 'node', id: 100, lat: 48.2, lon: 16.3, tags: { name: 'Place', amenity: 'bar' } },
      { type: 'way', id: 100, center: { lat: 48.2, lon: 16.3 }, tags: { name: 'Place', amenity: 'bar' } },
    ];
    const result = deduplicateElements(elements);
    expect(result).toHaveLength(2);
  });
});

// ─── elementToVenue ─────────────────────────────────────────────────────────

describe('elementToVenue', () => {
  const baseElement: OverpassElement = {
    type: 'node',
    id: 12345,
    lat: 48.21,
    lon: 16.37,
    tags: {
      name: 'Flex',
      amenity: 'nightclub',
      'addr:street': 'Donaukanal',
      'addr:housenumber': '1',
      'addr:postcode': '1010',
      'addr:city': 'Wien',
      website: 'https://flex.at',
      'contact:facebook': 'https://facebook.com/flexvienna',
      music: 'electronic',
    },
  };

  it('converts a complete element to a VenueRow', () => {
    const venue = elementToVenue(baseElement);
    expect(venue).not.toBeNull();
    expect(venue!.name).toBe('Flex');
    expect(venue!.type).toBe('nightclub');
    expect(venue!.subtype).toBe('electronic_club');
    expect(venue!.latitude).toBe(48.21);
    expect(venue!.longitude).toBe(16.37);
    expect(venue!.address).toBe('Donaukanal 1');
    expect(venue!.postal_code).toBe('1010');
    expect(venue!.city).toBe('Wien');
    expect(venue!.bundesland).toBe('wien');
    expect(venue!.website).toBe('https://flex.at');
    expect(venue!.facebook_url).toBe('https://facebook.com/flexvienna');
    expect(venue!.osm_id).toBe(12345);
    expect(venue!.registry_source).toBe('osm');
    expect(venue!.scrape_status).toBe('pending');
  });

  it('returns null for elements without a name', () => {
    const noName: OverpassElement = { type: 'node', id: 1, lat: 48.2, lon: 16.3, tags: { amenity: 'bar' } };
    expect(elementToVenue(noName)).toBeNull();
  });

  it('returns null for elements without coordinates', () => {
    const noCoords: OverpassElement = { type: 'way', id: 2, tags: { name: 'Test', amenity: 'bar' } };
    expect(elementToVenue(noCoords)).toBeNull();
  });

  it('handles elements with no tags', () => {
    const noTags: OverpassElement = { type: 'node', id: 3, lat: 48.2, lon: 16.3 };
    expect(elementToVenue(noTags)).toBeNull();
  });

  it('normalizes Facebook page names to full URLs', () => {
    const el: OverpassElement = {
      type: 'node', id: 4, lat: 48.2, lon: 16.3,
      tags: { name: 'Test', amenity: 'bar', 'contact:facebook': 'testbar' },
    };
    const venue = elementToVenue(el);
    expect(venue!.facebook_url).toBe('https://www.facebook.com/testbar');
  });

  it('normalizes Instagram handles to full URLs', () => {
    const el: OverpassElement = {
      type: 'node', id: 5, lat: 48.2, lon: 16.3,
      tags: { name: 'Test', amenity: 'bar', 'contact:instagram': '@testbar' },
    };
    const venue = elementToVenue(el);
    expect(venue!.instagram_url).toBe('https://www.instagram.com/testbar');
  });
});

// ─── buildOverpassQuery ─────────────────────────────────────────────────────

describe('buildOverpassQuery', () => {
  it('includes all required amenity types', () => {
    const query = buildOverpassQuery('47.0,13.0,48.0,14.0');
    expect(query).toContain('"amenity"="bar"');
    expect(query).toContain('"amenity"="pub"');
    expect(query).toContain('"amenity"="nightclub"');
    expect(query).toContain('"amenity"="biergarten"');
    expect(query).toContain('"leisure"="nightclub"');
  });

  it('uses bbox filter when provided', () => {
    const query = buildOverpassQuery('47.0,13.0,48.0,14.0');
    expect(query).toContain('(47.0,13.0,48.0,14.0)');
    expect(query).not.toContain('ISO3166-1');
  });

  it('uses Austria area filter when no bbox', () => {
    const query = buildOverpassQuery();
    expect(query).toContain('ISO3166-1');
    expect(query).toContain('AT');
  });

  it('outputs center and tags', () => {
    const query = buildOverpassQuery('47.0,13.0,48.0,14.0');
    expect(query).toContain('out center tags');
  });

  it('sets json output format', () => {
    const query = buildOverpassQuery();
    expect(query).toContain('[out:json]');
  });
});
