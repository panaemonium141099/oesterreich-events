/**
 * Regionsname im Suchtext: „Steiermark" im Suchfeld muss dieselbe Menge
 * liefern wie der Bundesland-Filter (2026-11-18: Suche 250, Filter 9.317).
 */
import { describe, it, expect } from 'vitest';
import { splitRegionFromSearch } from '@/lib/search/region-in-search';

describe('splitRegionFromSearch', () => {
  it('ein Bundesland allein wird zum Regionsfilter ohne Suchtext', () => {
    expect(splitRegionFromSearch('Steiermark')).toEqual({ regionId: 'steiermark', rest: '' });
    expect(splitRegionFromSearch('  steiermark ')).toEqual({ regionId: 'steiermark', rest: '' });
    expect(splitRegionFromSearch('WIEN')).toEqual({ regionId: 'wien', rest: '' });
  });

  it('Umlaute und ausgeschriebene Schreibweise meinen dasselbe Bundesland', () => {
    expect(splitRegionFromSearch('Kärnten').regionId).toBe('kaernten');
    expect(splitRegionFromSearch('kaernten').regionId).toBe('kaernten');
    expect(splitRegionFromSearch('Niederösterreich').regionId).toBe('niederoesterreich');
    expect(splitRegionFromSearch('oberoesterreich').regionId).toBe('oberoesterreich');
  });

  it('Region plus Begriff: der Begriff bleibt Suchtext, Füllwörter fallen weg', () => {
    expect(splitRegionFromSearch('konzert steiermark')).toEqual({ regionId: 'steiermark', rest: 'konzert' });
    expect(splitRegionFromSearch('Konzerte in der Steiermark')).toEqual({ regionId: 'steiermark', rest: 'Konzerte' });
    expect(splitRegionFromSearch('Flohmarkt im Burgenland')).toEqual({ regionId: 'burgenland', rest: 'Flohmarkt' });
  });

  it('ohne Regionsnamen bleibt die Suche unverändert', () => {
    expect(splitRegionFromSearch('konzert')).toEqual({ regionId: null, rest: 'konzert' });
    expect(splitRegionFromSearch('jazz in graz')).toEqual({ regionId: null, rest: 'jazz in graz' });
    expect(splitRegionFromSearch('')).toEqual({ regionId: null, rest: '' });
  });

  it('Abkürzungen und Wortteile lösen keinen Filter aus', () => {
    // „t" und „w" sind Scraper-Kürzel für Tirol und Wien, kein Suchwort.
    expect(splitRegionFromSearch('t').regionId).toBeNull();
    expect(splitRegionFromSearch('w').regionId).toBeNull();
    expect(splitRegionFromSearch('wiener schnitzel').regionId).toBeNull();
    expect(splitRegionFromSearch('tiroler abend').regionId).toBeNull();
    expect(splitRegionFromSearch('salzburger festspiele').regionId).toBeNull();
  });
});
