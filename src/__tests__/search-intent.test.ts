import { describe, it, expect } from 'vitest';
import { resolveSearchIntent } from '../lib/search-intent';

describe('resolveSearchIntent', () => {
  // No gemeinden — district/bundesland resolution is independent.
  const G: never[] = [];

  it.each([
    ['st pölten', 'St. Pölten (Stadt)'],
    ['St. Pölten', 'St. Pölten (Stadt)'],
    ['Sankt Pölten', 'St. Pölten (Stadt)'],
    ['ST PÖLTEN', 'St. Pölten (Stadt)'],
    ['st. pölten', 'St. Pölten (Stadt)'],
    ['st veit an der glan', 'Sankt Veit an der Glan'],
    ['sankt veit an der glan', 'Sankt Veit an der Glan'],
    ['st johann im pongau', 'Sankt Johann im Pongau'],
    ['sankt johann im pongau', 'Sankt Johann im Pongau'],
  ])('"%s" resolves to district %s', (q, district) => {
    const r = resolveSearchIntent(q, G);
    expect(r.kind).toBe('district');
    if (r.kind === 'district') expect(r.district).toBe(district);
  });

  it('"salzburg" prefers Stadt-district over Bundesland', () => {
    const r = resolveSearchIntent('salzburg', G);
    expect(r.kind).toBe('district');
    if (r.kind === 'district') expect(r.district).toBe('Salzburg (Stadt)');
  });

  it('"wien" resolves to bundesland (Wien=Bundesland=Stadt, no conflict)', () => {
    const r = resolveSearchIntent('wien', G);
    expect(r.kind).toBe('bundesland');
    if (r.kind === 'bundesland') expect(r.bundeslandId).toBe('wien');
  });

  it('"graz" resolves to district Stadt (Bundesland Steiermark, not Graz)', () => {
    const r = resolveSearchIntent('graz', G);
    expect(r.kind).toBe('district');
    if (r.kind === 'district') expect(r.district).toBe('Graz (Stadt)');
  });

  it('"eisenstadt" → district Eisenstadt (no Stadt suffix in canonical)', () => {
    const r = resolveSearchIntent('eisenstadt', G);
    expect(r.kind).toBe('district');
    if (r.kind === 'district') expect(r.district).toBe('Eisenstadt');
  });

  it('unknown text falls back to ILIKE keyword search', () => {
    const r = resolveSearchIntent('georgikirtag', G);
    expect(r.kind).toBe('fallback');
    if (r.kind === 'fallback') expect(r.search).toBe('georgikirtag');
  });

  it('empty input → empty fallback', () => {
    const r = resolveSearchIntent('   ', G);
    expect(r.kind).toBe('fallback');
    if (r.kind === 'fallback') expect(r.search).toBe('');
  });
});
