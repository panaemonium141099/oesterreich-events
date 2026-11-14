/**
 * Regionen der Seite (fn-31): lasstreffen.at neun Bundesländer wie bisher,
 * lasstreffen.de die 16 Länder aus den amtlichen Grenzen.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { REGIONS_DE } from '@/lib/regions-de.generated';
import { DE_LAENDER } from '@/lib/gemeinden/laender-de';
import { BUNDESLAENDER, bundeslandToId } from '@/lib/bundeslaender';
import { boundsOf, zoomFor } from '@/scripts/build-regions-de';
import { SITE_REGIONS, SITE_REGION_LIST, SITE_OVERVIEW, isSiteRegion, siteRegionImage } from '@/lib/site/regions';
import { REGION_COLUMN } from '@/lib/site/region-filter';
import { getSite } from '@/lib/site';

describe('deutsche Regionen (erzeugt)', () => {
  const laender = REGIONS_DE.filter(r => r.id !== 'all');

  it('genau die 16 Länder der Stammdaten, Gesamtansicht zuerst', () => {
    expect(REGIONS_DE[0].id).toBe('all');
    expect(REGIONS_DE[0].name).toBe('Ganz Deutschland');
    expect(laender.map(r => r.id).sort()).toEqual(DE_LAENDER.map(l => l.id).sort());
    expect(laender.map(r => r.name).sort()).toEqual(DE_LAENDER.map(l => l.name).sort());
  });

  it('keine ID kollidiert mit einem österreichischen Bundesland', () => {
    const at = new Set(BUNDESLAENDER.map(b => b.id).filter(id => id !== 'all'));
    expect(laender.filter(r => at.has(r.id))).toEqual([]);
    expect(laender.filter(r => bundeslandToId(r.id) !== null)).toEqual([]);
  });

  it('Ausschnitt und Zoom passen zur Quelle (BKG VG250)', () => {
    const src = JSON.parse(readFileSync('data/stammdaten-de/laender-de.geojson', 'utf8'));
    for (const f of src.features) {
      const r = laender.find(x => x.id === f.properties.land)!;
      const b = boundsOf(f);
      expect([r.id, r.bounds]).toEqual([r.id, b]);
      expect(r.zoom).toBe(zoomFor(b));
      // Mittelpunkt liegt im Ausschnitt.
      expect(r.center[0]).toBeGreaterThan(b[0]);
      expect(r.center[0]).toBeLessThan(b[2]);
      expect(r.center[1]).toBeGreaterThan(b[1]);
      expect(r.center[1]).toBeLessThan(b[3]);
    }
  });

  it('jede Grenzdatei liegt unter public/ und ist EIN Feature, wie die Karte es liest', () => {
    // EventMap.updateBundeslandOverlay liest `geojson.geometry`: eine
    // FeatureCollection hätte keinen Umriss und keine Maske ergeben.
    for (const r of REGIONS_DE) {
      expect([r.id, existsSync(`public${r.geojsonFile}`)]).toEqual([r.id, true]);
      const g = JSON.parse(readFileSync(`public${r.geojsonFile}`, 'utf8'));
      expect([r.id, g.type, ['Polygon', 'MultiPolygon'].includes(g.geometry?.type)]).toEqual([r.id, 'Feature', true]);
    }
  });

  it('die Gesamtansicht hat den Umriss des ganzen Landes', () => {
    expect(REGIONS_DE[0].geojsonFile).toBe('/deutschland.geojson');
    const g = JSON.parse(readFileSync('public/deutschland.geojson', 'utf8'));
    const rings = g.geometry.type === 'MultiPolygon' ? g.geometry.coordinates.map((p: number[][][]) => p[0]) : [g.geometry.coordinates[0]];
    const all = rings.flat() as number[][];
    const [w, s, e, n] = REGIONS_DE[0].bounds!;
    // Der Umriss füllt den Ausschnitt des Landes (auf 0,05 Grad genau).
    expect(Math.min(...all.map(c => c[0]))).toBeCloseTo(w, 1);
    expect(Math.max(...all.map(c => c[0]))).toBeCloseTo(e, 1);
    expect(Math.min(...all.map(c => c[1]))).toBeCloseTo(s, 1);
    expect(Math.max(...all.map(c => c[1]))).toBeCloseTo(n, 1);
  });

  it('Deutschland liegt, wo Deutschland liegt', () => {
    const [w, s, e, n] = REGIONS_DE[0].bounds!;
    expect(w).toBeGreaterThan(5.5);
    expect(e).toBeLessThan(15.5);
    expect(s).toBeGreaterThan(47);
    expect(n).toBeLessThan(55.5);
  });
});

describe('Regionen dieser Seite', () => {
  const site = getSite();

  it('lasstreffen.at: die neun Bundesländer über bundesland; lasstreffen.de: 16 Länder über region_id', () => {
    if (site.country === 'AT') {
      expect(SITE_REGIONS).toBe(BUNDESLAENDER);
      expect(SITE_REGION_LIST).toHaveLength(9);
      expect(REGION_COLUMN).toBe('bundesland');
      expect(isSiteRegion('wien')).toBe(true);
      expect(isSiteRegion('bayern')).toBe(false);
      expect(siteRegionImage('wien')).toBe('/images/regions/wien.jpg');
    } else {
      expect(SITE_REGIONS).toBe(REGIONS_DE);
      expect(SITE_REGION_LIST).toHaveLength(16);
      expect(REGION_COLUMN).toBe('region_id');
      expect(isSiteRegion('bayern')).toBe(true);
      expect(isSiteRegion('wien')).toBe(false);
      expect(siteRegionImage('bayern')).toBe(null);
    }
  });

  it('die Gesamtansicht ist nie eine Regionsseite', () => {
    expect(isSiteRegion('all')).toBe(false);
    expect(SITE_OVERVIEW.id).toBe('all');
  });
});
