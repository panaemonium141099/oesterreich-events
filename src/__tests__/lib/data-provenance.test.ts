import { describe, it, expect } from 'vitest';
import {
  DATA_SOURCES,
  getRequiredAttributions,
  getSourceAttribution,
  validateProvenanceCoverage,
} from '@/lib/data-provenance';

describe('data-provenance', () => {
  describe('DATA_SOURCES', () => {
    it('contains an entry for osm with ODbL license', () => {
      const osm = DATA_SOURCES.osm;
      expect(osm).toBeDefined();
      expect(osm.id).toBe('osm');
      expect(osm.license).toBe('ODbL-1.0');
      expect(osm.requiresAttribution).toBe(true);
      expect(osm.usageType).toBe('produced_work');
      expect(osm.copyrightUrl).toContain('openstreetmap.org');
    });

    it('contains entries for all registry sources', () => {
      const expectedSources = ['osm', 'oeh', 'esn', 'iaeste', 'aiesec', 'aegee', 'open_data', 'manual'];
      for (const source of expectedSources) {
        expect(DATA_SOURCES[source]).toBeDefined();
        expect(DATA_SOURCES[source].id).toBe(source);
      }
    });

    it('every source has required fields populated', () => {
      for (const [key, source] of Object.entries(DATA_SOURCES)) {
        expect(source.id).toBe(key);
        expect(source.name.length).toBeGreaterThan(0);
        expect(source.description.length).toBeGreaterThan(0);
        expect(source.license.length).toBeGreaterThan(0);
        expect(typeof source.requiresAttribution).toBe('boolean');
        expect(['produced_work', 'derivative_database']).toContain(source.usageType);
      }
    });

    it('sources requiring attribution have licenseUrl and copyrightUrl', () => {
      for (const source of Object.values(DATA_SOURCES)) {
        if (source.requiresAttribution) {
          expect(source.licenseUrl.length).toBeGreaterThan(0);
          expect(source.copyrightUrl.length).toBeGreaterThan(0);
          expect(source.attributionText.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('getRequiredAttributions', () => {
    it('returns only sources that require attribution', () => {
      const attributions = getRequiredAttributions();
      expect(attributions.length).toBeGreaterThan(0);
      for (const attr of attributions) {
        expect(attr.requiresAttribution).toBe(true);
      }
    });

    it('includes OSM in required attributions', () => {
      const attributions = getRequiredAttributions();
      const ids = attributions.map((a) => a.id);
      expect(ids).toContain('osm');
    });

    it('does not include manual entries', () => {
      const attributions = getRequiredAttributions();
      const ids = attributions.map((a) => a.id);
      expect(ids).not.toContain('manual');
    });
  });

  describe('getSourceAttribution', () => {
    it('returns attribution for known sources', () => {
      const osm = getSourceAttribution('osm');
      expect(osm).toBeDefined();
      expect(osm!.name).toBe('OpenStreetMap');
    });

    it('returns undefined for unknown sources', () => {
      const unknown = getSourceAttribution('nonexistent');
      expect(unknown).toBeUndefined();
    });
  });

  describe('validateProvenanceCoverage', () => {
    it('reports all registry sources as covered', () => {
      const registrySources = ['osm', 'open_data', 'oeh', 'esn', 'iaeste', 'aiesec', 'aegee', 'manual'];
      const result = validateProvenanceCoverage(registrySources);
      expect(result.missing).toHaveLength(0);
      expect(result.covered).toEqual(registrySources);
    });

    it('identifies missing sources', () => {
      const sources = ['osm', 'unknown_source'];
      const result = validateProvenanceCoverage(sources);
      expect(result.covered).toEqual(['osm']);
      expect(result.missing).toEqual(['unknown_source']);
    });
  });
});
