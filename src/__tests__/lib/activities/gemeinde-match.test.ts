import { describe, it, expect } from 'vitest';
import { matchGemeinde } from '@/lib/activities/gemeinde-match';

describe('matchGemeinde (nearest-Haversine gegen ALL_GEMEINDEN)', () => {
  it('Mountaincart am Erlebnisberg Fulseck -> Dorfgastein (echte Deskline-Koordinaten)', () => {
    // Live-Koordinaten aus /gastein/de/infrastructures (2026-07-24).
    const match = matchGemeinde(47.2446301479087, 13.109825458197);
    expect(match).not.toBeNull();
    expect(match!.gemeindeSlug).toBe('5632-dorfgastein');
    expect(match!.gemeinde.name).toBe('Dorfgastein');
    // Kanonische lowercase-ID via bundeslandToId — nie der Registry-Rohwert.
    expect(match!.bundesland).toBe('salzburg');
    expect(match!.distanceKm).toBeLessThan(1);
  });

  it('Strandbad Podersdorf -> Podersdorf am See (Burgenland)', () => {
    const match = matchGemeinde(47.852, 16.847);
    expect(match!.gemeindeSlug).toBe('7141-podersdorf-am-see');
    expect(match!.bundesland).toBe('burgenland');
    expect(match!.distanceKm).toBeLessThan(2);
  });

  it('Wien Zentrum -> 1010-wien', () => {
    const match = matchGemeinde(48.2082, 16.3738);
    expect(match!.gemeindeSlug).toBe('1010-wien');
    expect(match!.bundesland).toBe('wien');
  });

  it('nicht-finite Koordinaten -> null (Ingest ueberspringt POIs ohne Koordinaten)', () => {
    expect(matchGemeinde(Number.NaN, 16.5)).toBeNull();
    expect(matchGemeinde(47.8, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('ist deterministisch (gleicher Punkt -> gleiche Gemeinde)', () => {
    const a = matchGemeinde(47.2446301479087, 13.109825458197);
    const b = matchGemeinde(47.2446301479087, 13.109825458197);
    expect(a!.gemeindeSlug).toBe(b!.gemeindeSlug);
    expect(a!.distanceKm).toBe(b!.distanceKm);
  });
});
