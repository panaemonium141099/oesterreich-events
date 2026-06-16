import { describe, it, expect } from 'vitest';
import { bundeslandFromPolygon } from '@/lib/eventim/bundesland-from-geo';

// Coordinates are well inside each state (capitals) so low-res boundaries are safe.
describe('bundeslandFromPolygon', () => {
  it('Wien center → wien', () => {
    expect(bundeslandFromPolygon(48.2082, 16.3738)).toBe('wien');
  });
  it('Innsbruck → tirol', () => {
    expect(bundeslandFromPolygon(47.2692, 11.4041)).toBe('tirol');
  });
  it('Salzburg city → salzburg', () => {
    expect(bundeslandFromPolygon(47.8095, 13.055)).toBe('salzburg');
  });
  it('Graz → steiermark', () => {
    expect(bundeslandFromPolygon(47.0707, 15.4395)).toBe('steiermark');
  });
  it('Eisenstadt → burgenland', () => {
    expect(bundeslandFromPolygon(47.8457, 16.5239)).toBe('burgenland');
  });
  it('Klagenfurt → kaernten', () => {
    expect(bundeslandFromPolygon(46.6247, 14.3055)).toBe('kaernten');
  });
  it('outside Austria (Munich) → null', () => {
    expect(bundeslandFromPolygon(48.1351, 11.582)).toBeNull();
  });
});
