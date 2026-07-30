import { describe, it, expect } from 'vitest';
import {
  OSM_KEY_PRIORITY,
  OSM_WHITELIST,
  classifyOsmTags,
  osmCategoryLabel,
  osmKeys,
  overpassClauseFor,
} from '@/lib/osm/poi-whitelist';

describe('OSM-Whitelist (fn-18.7)', () => {
  it('klassifiziert kuratierte Tags mit Kategorie, Label und Setting', () => {
    expect(classifyOsmTags({ name: 'Spielplatz Au', leisure: 'playground' })).toEqual({
      category: 'spielplatz',
      label: 'Spielplatz',
      setting: 'outdoor',
      matchedTag: 'leisure=playground',
    });
    expect(classifyOsmTags({ name: 'Landesmuseum', tourism: 'museum' })?.setting).toBe('indoor');
  });

  it('gibt null fuer nicht kuratierte Tags zurueck (Restaurants, Banken, Kirchen …)', () => {
    expect(classifyOsmTags({ name: 'Gasthaus Post', amenity: 'restaurant' })).toBeNull();
    expect(classifyOsmTags({ name: 'Pfarrkirche', building: 'church' })).toBeNull();
    expect(classifyOsmTags({ name: 'Wegkreuz', historic: 'wayside_shrine' })).toBeNull();
    expect(classifyOsmTags(undefined)).toBeNull();
  });

  it('loest Mehrfach-Tagging deterministisch ueber OSM_KEY_PRIORITY auf', () => {
    // attraction schlaegt tourism schlaegt leisure — unabhaengig von der
    // Reihenfolge der Keys im Objekt (Reimport muss stabil klassifizieren).
    const tags = {
      name: 'Sommerrodelbahn im Erlebnispark',
      leisure: 'park',
      tourism: 'attraction',
      attraction: 'summer_toboggan',
    };
    expect(classifyOsmTags(tags)?.category).toBe('sommerrodelbahn');
    expect(classifyOsmTags({ name: 'X', leisure: 'park', tourism: 'museum' })?.category).toBe('museum');
    expect(OSM_KEY_PRIORITY.indexOf('attraction')).toBeLessThan(OSM_KEY_PRIORITY.indexOf('tourism'));
  });

  it('generiert Overpass-Klauseln direkt aus der Whitelist (kein zweites Vokabular)', () => {
    const clause = overpassClauseFor('tourism');
    expect(clause.startsWith('nwr["name"]["tourism"~"^(')).toBe(true);
    for (const value of Object.keys(OSM_WHITELIST.tourism)) {
      expect(clause).toContain(value);
    }
    // Kein Wildcard-Match: die Klausel ist auf die Whitelist-Werte verankert.
    expect(clause.endsWith(')$"]')).toBe(true);
  });

  it('deckt jeden Whitelist-Key mit einer Klausel ab', () => {
    expect(osmKeys()).toEqual(OSM_KEY_PRIORITY);
    for (const key of osmKeys()) {
      expect(Object.keys(OSM_WHITELIST[key]).length).toBeGreaterThan(0);
      expect(overpassClauseFor(key)).toContain(`["${key}"~`);
    }
  });

  it('liefert deutsche Labels fuer Kategorien, sonst Prettifier', () => {
    expect(osmCategoryLabel('aussichtspunkt')).toBe('Aussichtspunkt');
    expect(osmCategoryLabel('burg-schloss')).toBe('Burg & Schloss');
    expect(osmCategoryLabel('unbekannte-kategorie')).toBe('Unbekannte Kategorie');
  });
});
