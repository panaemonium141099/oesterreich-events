import { describe, it, expect } from 'vitest';
import {
  dedupeOsmRows,
  normalizeWebsite,
  poiCoordinates,
  transformOsmPoi,
  type OsmPoiRow,
} from '@/lib/osm/poi-transform';

const SEEN = '2026-07-27T10:00:00.000Z';

describe('transformOsmPoi (fn-18.7)', () => {
  it('baut eine vollstaendige Row aus einem Node (alle NOT-NULL-Spalten gefuellt)', () => {
    const result = transformOsmPoi(
      {
        type: 'node',
        id: 12345,
        lat: 48.2082,
        lon: 16.3738,
        tags: { name: 'Stadtpark', leisure: 'park', website: 'https://wien.gv.at/park' },
      },
      SEEN,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row).toMatchObject({
      osm_type: 'node',
      osm_id: 12345,
      name: 'Stadtpark',
      category: 'park',
      osm_tag: 'leisure=park',
      setting: 'outdoor',
      website: 'https://wien.gv.at/park',
      gemeinde_slug: '1010-wien',
      bundesland: 'wien',
      last_seen_at: SEEN,
    });
    // NOT-NULL-Spalten der Migration duerfen nie fehlen (Upsert-Lehre fn-18.2).
    for (const col of ['osm_type', 'osm_id', 'name', 'category', 'osm_tag', 'lat', 'lng', 'bundesland', 'last_seen_at'] as const) {
      expect(result.row[col]).not.toBeUndefined();
      expect(result.row[col]).not.toBeNull();
    }
  });

  it('nimmt bei Ways/Relations die center-Koordinaten', () => {
    const result = transformOsmPoi(
      {
        type: 'way',
        id: 999,
        center: { lat: 47.852, lon: 16.847 },
        tags: { name: 'Strandbad', leisure: 'swimming_area' },
      },
      SEEN,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.lat).toBeCloseTo(47.852, 3);
    expect(result.row.lng).toBeCloseTo(16.847, 3);
    expect(result.row.gemeinde_slug).toBe('7141-podersdorf-am-see');
    expect(result.row.bundesland).toBe('burgenland');
  });

  it('bevorzugt addr:city als town, faellt sonst auf die Registry-Gemeinde zurueck', () => {
    const withCity = transformOsmPoi(
      { type: 'node', id: 1, lat: 48.2082, lon: 16.3738, tags: { name: 'A', leisure: 'park', 'addr:city': 'Wien' } },
      SEEN,
    );
    const withoutCity = transformOsmPoi(
      { type: 'node', id: 2, lat: 48.2082, lon: 16.3738, tags: { name: 'B', leisure: 'park' } },
      SEEN,
    );
    expect(withCity.ok && withCity.row.town).toBe('Wien');
    expect(withoutCity.ok && withoutCity.row.town).toBe('Wien');
  });

  it('ueberspringt namenlose, nicht kuratierte, koordinatenlose und nicht-oesterreichische Objekte', () => {
    expect(transformOsmPoi({ type: 'node', id: 1, lat: 48.2, lon: 16.3, tags: { leisure: 'park' } }, SEEN)).toEqual({
      ok: false,
      reason: 'no-name',
    });
    expect(
      transformOsmPoi({ type: 'node', id: 2, lat: 48.2, lon: 16.3, tags: { name: 'Bank', amenity: 'bank' } }, SEEN),
    ).toEqual({ ok: false, reason: 'not-whitelisted' });
    expect(transformOsmPoi({ type: 'way', id: 3, tags: { name: 'X', leisure: 'park' } }, SEEN)).toEqual({
      ok: false,
      reason: 'no-coords',
    });
    // Muenchen liegt in den Overpass-BBox-Laengengraden, aber nicht in AT.
    expect(
      transformOsmPoi({ type: 'node', id: 4, lat: 48.1372, lon: 11.5756, tags: { name: 'Englischer Garten', leisure: 'park' } }, SEEN),
    ).toEqual({ ok: false, reason: 'no-gemeinde-match' });
  });

  it('normalisiert Websites und verwirft Muell', () => {
    expect(normalizeWebsite('https://example.at/')).toBe('https://example.at/');
    expect(normalizeWebsite('  http://example.at  ')).toBe('http://example.at/');
    expect(normalizeWebsite('www.example.at')).toBeNull();
    expect(normalizeWebsite('javascript:alert(1)')).toBeNull();
    expect(normalizeWebsite(undefined)).toBeNull();
    expect(normalizeWebsite('   ')).toBeNull();
  });

  it('liest Koordinaten aus lat/lon oder center', () => {
    expect(poiCoordinates({ type: 'node', id: 1, lat: 47, lon: 16 })).toEqual({ lat: 47, lng: 16 });
    expect(poiCoordinates({ type: 'relation', id: 1, center: { lat: 47, lon: 16 } })).toEqual({ lat: 47, lng: 16 });
    expect(poiCoordinates({ type: 'way', id: 1 })).toBeNull();
  });

  it('dedupliziert nur INNERHALB des OSM-Bestands (Schluessel = OSM-Identitaet)', () => {
    const base: OsmPoiRow = {
      osm_type: 'node', osm_id: 7, name: 'Aussicht', category: 'aussichtspunkt',
      osm_tag: 'tourism=viewpoint', setting: 'outdoor', website: null,
      lat: 47, lng: 16, gemeinde_slug: 'x', bundesland: 'burgenland', town: null,
      last_seen_at: SEEN,
    };
    // Gleiche ID aus zwei ueberlappenden Regions-BBoxen + eine andere ID.
    const out = dedupeOsmRows([base, { ...base, name: 'Aussicht (2)' }, { ...base, osm_id: 8 }]);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe('Aussicht (2)'); // letzter Treffer gewinnt
    // Way mit derselben numerischen ID ist ein ANDERES Objekt.
    expect(dedupeOsmRows([base, { ...base, osm_type: 'way' }])).toHaveLength(2);
  });
});
