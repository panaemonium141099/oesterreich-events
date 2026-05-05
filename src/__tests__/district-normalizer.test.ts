import { describe, it, expect } from 'vitest';
import { normalizeDistrict } from '../lib/district-normalizer';

describe('normalizeDistrict — Stadt/Land PLZ disambiguation', () => {
  // Stadt-name + Stadt-PLZ → Stadt (alias map)
  it('graz + 8010 → graz (stadt)', () => {
    expect(normalizeDistrict('graz', 'steiermark', '8010')).toBe('graz (stadt)');
  });
  it('linz + 4020 → linz (stadt)', () => {
    expect(normalizeDistrict('linz', 'oberoesterreich', '4020')).toBe('linz (stadt)');
  });

  // Stadt-name + Land-PLZ → Land
  it('graz + 8045 (Andritz/Umgebung) → graz-umgebung', () => {
    expect(normalizeDistrict('graz', 'steiermark', '8045')).toBe('graz (stadt)');
    expect(normalizeDistrict('graz', 'steiermark', '8101')).toBe('graz-umgebung');
  });
  it('linz + 4060 → linz-land', () => {
    expect(normalizeDistrict('linz', 'oberoesterreich', '4060')).toBe('linz-land');
  });

  // Land-name + Stadt-PLZ → Stadt (the new reverse rule)
  it('graz-umgebung + 8010 → graz (stadt)', () => {
    expect(normalizeDistrict('graz-umgebung', 'steiermark', '8010')).toBe('graz (stadt)');
  });
  it('linz-land + 4020 → linz (stadt)', () => {
    expect(normalizeDistrict('linz-land', 'oberoesterreich', '4020')).toBe('linz (stadt)');
  });
  it('st. pölten (land) + 3100 → st. pölten (stadt)', () => {
    expect(normalizeDistrict('st. pölten (land)', 'niederoesterreich', '3100')).toBe('st. pölten (stadt)');
  });
  it('salzburg-umgebung + 5020 → salzburg (stadt)', () => {
    expect(normalizeDistrict('salzburg-umgebung', 'salzburg', '5020')).toBe('salzburg (stadt)');
  });
  it('wels-land + 4600 → wels (stadt)', () => {
    expect(normalizeDistrict('wels-land', 'oberoesterreich', '4600')).toBe('wels (stadt)');
  });

  // Land-name + Land-PLZ → unchanged
  it('graz-umgebung + 8101 → graz-umgebung', () => {
    expect(normalizeDistrict('graz-umgebung', 'steiermark', '8101')).toBe('graz-umgebung');
  });

  // Without PLZ → alias still applies (Stadt-default for bare city names)
  it('graz without PLZ → graz (stadt) (alias default)', () => {
    expect(normalizeDistrict('graz', 'steiermark', null)).toBe('graz (stadt)');
  });

  // Other regular aliases
  it('suedoststeiermark → südoststeiermark', () => {
    expect(normalizeDistrict('suedoststeiermark', 'steiermark', null)).toBe('südoststeiermark');
  });
});
