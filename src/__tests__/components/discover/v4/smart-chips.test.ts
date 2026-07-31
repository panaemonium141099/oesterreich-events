import { describe, it, expect } from 'vitest';
import { buildUnderstoodChips } from '@/components/Discover/v4/smart-chips';

describe('buildUnderstoodChips', () => {
  it('leere/fehlende parsed → keine Chips', () => {
    expect(buildUnderstoodChips(undefined)).toEqual([]);
    expect(buildUnderstoodChips({})).toEqual([]);
    expect(buildUnderstoodChips({ signals: ['intent:ai'] })).toEqual([]);
  });

  it('Datum-Signale werden gemappt (nur eines)', () => {
    const chips = buildUnderstoodChips({ signals: ['today'] });
    expect(chips).toEqual([{ key: 'date:today', label: 'Heute' }]);
    expect(buildUnderstoodChips({ signals: ['weekend'] })[0].label).toBe('Wochenende');
  });

  it('Preis-Tier wird gemappt', () => {
    const chips = buildUnderstoodChips({ signals: [], max_price_tier: 'gratis' });
    expect(chips).toEqual([{ key: 'price', label: 'Gratis' }]);
  });

  it('Ort: Gemeinde-Signal gewinnt vor Bezirk und Bundesland', () => {
    const chips = buildUnderstoodChips({
      signals: ['location:gemeinde:7000-eisenstadt'],
      location_district: 'graz (stadt)',
      location_bundesland: 'steiermark',
    });
    expect(chips).toEqual([{ key: 'ort', label: 'Eisenstadt' }]);
  });

  it('Ort: Bezirk wird bereinigt ("graz (stadt)" → "Graz")', () => {
    const chips = buildUnderstoodChips({ signals: [], location_district: 'graz (stadt)' });
    expect(chips).toEqual([{ key: 'ort', label: 'Graz' }]);
  });

  it('Ort: Bundesland als Fallback, kapitalisiert', () => {
    const chips = buildUnderstoodChips({ signals: [], location_bundesland: 'burgenland' });
    expect(chips).toEqual([{ key: 'ort', label: 'Burgenland' }]);
  });

  it('Indoor-Signal und Aktivitäts-contentTypes erzeugen Chips', () => {
    const chips = buildUnderstoodChips({
      signals: ['setting:indoor'],
      content_types: ['activity'],
    });
    expect(chips).toEqual([
      { key: 'setting', label: 'Indoor' },
      { key: 'content', label: 'Ausflugsziele' },
    ]);
  });

  it('event+activity → kombiniertes Label', () => {
    const chips = buildUnderstoodChips({ content_types: ['event', 'activity'] });
    expect(chips).toEqual([{ key: 'content', label: 'Events + Ausflugsziele' }]);
  });

  it('reine Event-Suche (Default) erzeugt KEINEN content-Chip', () => {
    expect(buildUnderstoodChips({ content_types: ['event'] })).toEqual([]);
  });

  it('Kategorien aus Signalen, max 2', () => {
    const chips = buildUnderstoodChips({
      signals: ['category:Musik', 'category:Nightlife & Party', 'category:Familie & Kinder'],
    });
    expect(chips.map(c => c.label)).toEqual(['Musik', 'Nightlife & Party']);
  });

  it('cappt auf 6 Chips gesamt', () => {
    const chips = buildUnderstoodChips({
      signals: ['today', 'setting:indoor', 'category:Musik', 'category:Sport & Bewegung'],
      max_price_tier: 'gratis',
      location_bundesland: 'wien',
      content_types: ['event', 'activity'],
    });
    expect(chips.length).toBe(6);
  });
});
