import { describe, it, expect } from 'vitest';
import { districtFromPlz, districtsForPlz, districtFromGemeinde } from '@/lib/plz-district';

describe('districtFromPlz', () => {
  it('mappt Eisenstadt-PLZ auf den kanonischen Bezirk (der Kern-Fix)', () => {
    // 'eisenstadt' ist der kanonische Wert des district-normalizers
    // ('eisenstadt (stadt)' und 'eisenstadt-umgebung' werden dorthin gefaltet).
    expect(districtFromPlz('7000')).toBe('eisenstadt');
    expect(districtFromPlz('7000', 'burgenland')).toBe('eisenstadt');
  });

  it('mappt Graz-Stadt-PLZ auf "graz (stadt)"', () => {
    expect(districtFromPlz('8010', 'steiermark')).toBe('graz (stadt)');
  });

  it('Bundesland-Mismatch → null (Schutz gegen falsch erfasste PLZ)', () => {
    expect(districtFromPlz('7000', 'tirol')).toBeNull();
  });

  it('unbekannte/leere PLZ → null', () => {
    expect(districtFromPlz('0000')).toBeNull();
    expect(districtFromPlz('')).toBeNull();
    expect(districtFromPlz(null)).toBeNull();
    expect(districtFromPlz(undefined)).toBeNull();
  });

  it('liefert für Mattersburg den suffixlosen Bezirk', () => {
    expect(districtFromPlz('7210', 'burgenland')).toBe('mattersburg');
  });

  it('Statutarstadt-PLZ-Blöcke greifen auch jenseits der Registry-PLZ', () => {
    expect(districtFromPlz('8020', 'steiermark')).toBe('graz (stadt)');
    expect(districtFromPlz('6020', 'tirol')).toBe('innsbruck (stadt)');
  });

  it('liefert NUR kanonische Werte — nie Passthrough-Wildwuchs', () => {
    // Wien ist bewusst Bundesland-only ('wien' ist kein kanonischer Bezirk)
    expect(districtFromPlz('1010', 'wien')).toBeNull();
  });
});

describe('fn-25 C2: Bezirke als Menge, kein Mehrheits-/Alphabetentscheid', () => {
  it('PLZ mit mehreren Bezirken bleibt ohne weiteren Beleg unaufgelöst', () => {
    // 2413: Berg (Bruck an der Leitha) und laut RTR auch Neusiedl am See
    expect(districtsForPlz('2413', 'niederoesterreich').sort()).toEqual(['bruck an der leitha', 'neusiedl am see']);
    expect(districtFromPlz('2413', 'niederoesterreich')).toBeNull();
  });

  it('eine belegte Gemeinde liefert ihren Bezirk', () => {
    expect(districtFromGemeinde('Bruck an der Leitha', 'niederoesterreich', '2413')).toBe('bruck an der leitha');
    expect(districtFromGemeinde('Imst', 'tirol', '6474')).toBe('imst');
    expect(districtFromGemeinde(null, 'tirol', '6474')).toBeNull();
  });

  it('amtliche PLZ außerhalb der Registry sind bekannt (Wels 4600 → Wels (Stadt))', () => {
    expect(districtFromPlz('4600', 'oberoesterreich')).toBe('wels (stadt)');
    expect(districtFromPlz('6474', 'tirol')).toBe('imst');
  });
});
