import { describe, it, expect } from 'vitest';
import { districtFromPlz, districtsForPlz, districtFromGemeinde, districtForLocation } from '@/lib/plz-district';
import { bundeslandOfDistrict } from '@/lib/district-normalizer';
import { allPlzReferenceEntries } from '@/lib/location/plz-reference';
import { ALL_GEMEINDEN } from '@/lib/gemeinden/data';
import { bundeslandToId } from '@/lib/bundeslaender';
import { DISTRICTS_BY_BUNDESLAND } from '@/lib/districtsAT';

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

// Befund 2026-10-07: 523 Wiener Events mit PLZ 1140/1190/1210 standen in
// den Bezirken Tulln bzw. Korneuburg. Die RTR-Zeile „1140, Wien, Tulln, W"
// sagt: die Wiener PLZ 1140 stellt auch nach Klosterneuburg (Bezirk Tulln)
// zu. Die Spalte bundesland beschreibt die PLZ, nicht den Bezirk.
describe('PLZ-Bezirk liegt im Bundesland des Events', () => {
  it('Wiener PLZ mit Zustellgebiet in Niederösterreich liefern keinen NÖ-Bezirk', () => {
    expect(districtFromPlz('1140', 'wien')).toBeNull();
    expect(districtFromPlz('1190', 'wien')).toBeNull();
    expect(districtFromPlz('1210', 'wien')).toBeNull();
    expect(districtFromPlz('1300', 'wien')).toBeNull(); // Flughafen, Bezirk Bruck an der Leitha
    expect(districtFromPlz('1140')).toBeNull();
  });

  it('Sargfabrik, Goldschlagstraße 169, 1140 Wien steht nicht im Bezirk Tulln', () => {
    const wien = { bezirk: 'Wien', bundesland: 'wien', plz: '1010' };
    expect(districtForLocation(wien, '1140', 'wien', null)).toBeNull();
    // Ohne PLZ-Bezirk greift wie bisher der Bezirk der Quelle.
    expect(districtForLocation(wien, '1140', 'wien', 'penzing')).toBe('14. penzing');
  });

  it('Bezirke jenseits der Landesgrenze halten die PLZ mehrdeutig', () => {
    // 2413: Berg (NÖ, Bruck an der Leitha) und Edelstal (Burgenland, Neusiedl am See)
    expect(districtFromPlz('2413', 'niederoesterreich')).toBeNull();
    // 7421 Tauchen-Schaueregg ist eine steirische PLZ, die nur nach Neunkirchen (NÖ) zustellt.
    expect(districtFromPlz('7421', 'steiermark')).toBeNull();
  });

  it('Wächter: kein PLZ-Bezirk liegt außerhalb des angefragten Bundeslands', () => {
    const plzs = new Set([...allPlzReferenceEntries().map(e => e.plz), ...ALL_GEMEINDEN.map(g => g.plz)]);
    const landsOf = (plz: string) => new Set([
      ...(allPlzReferenceEntries().find(e => e.plz === plz)?.bundeslaender ?? []),
      ...ALL_GEMEINDEN.filter(g => g.plz === plz).map(g => bundeslandToId(g.bundesland)),
    ]);
    const wrong: string[] = [];
    for (const plz of plzs) {
      for (const bl of Object.keys(DISTRICTS_BY_BUNDESLAND)) {
        const d = districtFromPlz(plz, bl);
        if (d && bundeslandOfDistrict(d) !== bl) wrong.push(`${plz}/${bl} → ${d}`);
      }
      const d = districtFromPlz(plz);
      if (d && !landsOf(plz).has(bundeslandOfDistrict(d) ?? '')) wrong.push(`${plz}/ohne Land → ${d}`);
    }
    expect(wrong).toEqual([]);
  });
});
