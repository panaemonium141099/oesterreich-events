import { describe, it, expect } from 'vitest';
import { districtFromPlz, districtsForPlz, districtFromGemeinde, districtForLocation, unreadablePlzDistricts, bundeslandForLocation } from '@/lib/plz-district';
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
    // Der Registry-Bezirk der Gemeinde Wien heißt „Wien" und ist kein
    // kanonischer Wert; die PLZ liefert den Gemeindebezirk.
    expect(districtFromPlz('1010', 'wien')).toBe('1. innere stadt');
  });
});

// Produktentscheidung 2026-10-07: Wiener Gemeindebezirke kommen aus der PLZ.
// Die RTR schreibt sie „Wien 14.,Penzing" (kanonisch „14. penzing"). Vorher
// hatten 7.949 künftige Wiener Events keinen Bezirk.
describe('Wiener Gemeindebezirke aus der PLZ', () => {
  it('eine Wiener PLZ mit genau einem Gemeindebezirk liefert ihn', () => {
    expect(districtFromPlz('1030', 'wien')).toBe('3. landstraße');
    expect(districtFromPlz('1150', 'wien')).toBe('15. rudolfsheim-fünfhaus');
    expect(districtFromPlz('1230')).toBe('23. liesing');
  });

  it('PLZ über zwei Gemeindebezirke oder über die Landesgrenze bleiben mehrdeutig', () => {
    expect(districtsForPlz('1170', 'wien').sort()).toEqual(['16. ottakring', '17. hernals']);
    expect(districtFromPlz('1170', 'wien')).toBeNull();
    expect(districtFromPlz('1190', 'wien')).toBeNull(); // Währing, Döbling, Tulln
  });

  it('der Gemeindebezirk der PLZ gilt vor dem Bezirk der Quelle', () => {
    // Wiener Stadthalle, Roland-Rainer-Platz 1, 1150 Wien: ganz-wien schrieb „1. innere stadt".
    const wien = { bezirk: 'Wien', bundesland: 'wien', plz: '1010' };
    expect(districtForLocation(wien, '1150', 'wien', 'innere-stadt')).toBe('15. rudolfsheim-fünfhaus');
  });

  it('die Amts-PLZ der Gemeinde Wien ist kein Beleg für den 1. Bezirk', () => {
    // uni-wien, mdw, akbild …: Ort „Wien" ohne Adresse; der Resolver übernimmt
    // die PLZ der Gemeinde (Provenienz 'registry'). 299 künftige Events.
    const wien = { bezirk: 'Wien', bundesland: 'wien', plz: '1010' };
    expect(districtForLocation(wien, '1010', 'wien', null, 'registry')).toBeNull();
    expect(districtForLocation(wien, '1010', 'wien', 'innere-stadt', 'registry')).toBe('1. innere stadt');
    // Peterskirche, Petersplatz, 1010: die PLZ steht in der Quelle.
    expect(districtForLocation(wien, '1010', 'wien', null, 'source')).toBe('1. innere stadt');
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

// Befund 2026-10-07: toCanonicalDistrict verwarf RTR-Schreibweisen wie
// „Graz(Stadt)", „Sankt Pölten(Land)" oder „Eisenstadt-Umgebung" unter einer
// NÖ-PLZ still. Die Kandidatenmenge war zu klein, und districtFromPlz hielt
// mehrdeutige PLZ für eindeutig (5071 Wals → salzburg-umgebung, 8051 →
// graz-umgebung, 3400 Klosterneuburg → tulln).
describe('RTR-Schreibweisen werden gelesen, nie still verworfen', () => {
  it('„Graz(Stadt)", „Salzburg(Stadt)", „Steyr(Stadt)": Stadt und Umland bleiben mehrdeutig', () => {
    for (const plz of ['8051', '8073', '8074']) {
      expect(districtsForPlz(plz, 'steiermark').sort()).toEqual(['graz (stadt)', 'graz-umgebung']);
      expect(districtFromPlz(plz, 'steiermark')).toBeNull();
    }
    for (const plz of ['5061', '5071']) {
      expect(districtsForPlz(plz, 'salzburg').sort()).toEqual(['salzburg (stadt)', 'salzburg-umgebung']);
      expect(districtFromPlz(plz, 'salzburg')).toBeNull();
    }
    expect(districtsForPlz('4451', 'oberoesterreich').sort()).toEqual(['steyr (stadt)', 'steyr-land']);
    expect(districtFromPlz('4451', 'oberoesterreich')).toBeNull();
  });

  it('„Sankt Pölten(Land)", „St. Pölten(Land)", „Wiener Neustadt(Land)" zählen als Kandidaten', () => {
    for (const plz of ['3400', '3443', '3451', '3004']) {
      expect(districtsForPlz(plz, 'niederoesterreich').sort()).toEqual(['st. pölten (land)', 'tulln']);
      expect(districtFromPlz(plz, 'niederoesterreich')).toBeNull();
    }
    expect(districtsForPlz('3385', 'niederoesterreich').sort()).toEqual(['st. pölten (land)', 'st. pölten (stadt)']);
    expect(districtFromPlz('3385', 'niederoesterreich')).toBeNull();
    expect(districtsForPlz('2602', 'niederoesterreich').sort()).toEqual(['baden', 'wiener neustadt (land)']);
    expect(districtFromPlz('2602', 'niederoesterreich')).toBeNull();
  });

  it('Bezirke jenseits der Landesgrenze werden in der Schreibweise ihres Bundeslands gelesen', () => {
    // 2443 Deutsch-Brodersdorf (NÖ) stellt auch in den Bezirk Eisenstadt-Umgebung zu.
    expect(districtsForPlz('2443', 'niederoesterreich').sort()).toEqual(['baden', 'eisenstadt']);
    expect(districtFromPlz('2443', 'niederoesterreich')).toBeNull();
    // 5163 Mattsee (Salzburg): RTR schreibt „Braunau" und „Braunau am Inn".
    expect(districtsForPlz('5163', 'salzburg').sort()).toEqual(['braunau am inn', 'salzburg-umgebung']);
    // 7202 Bad Sauerbrunn (Burgenland): auch „Wiener Neustadt(Land)".
    expect(districtsForPlz('7202', 'burgenland').sort()).toEqual(['mattersburg', 'wiener neustadt (land)']);
    expect(districtFromPlz('7202', 'burgenland')).toBeNull();
    // 2301 Groß-Enzersdorf stellt auch in den 22. Bezirk zu („Wien 22.,Donaustadt").
    expect(districtsForPlz('2301', 'niederoesterreich').sort()).toEqual(['22. donaustadt', 'gänserndorf']);
    expect(districtFromPlz('2301', 'niederoesterreich')).toBeNull();
  });

  it('auf mehrdeutiger PLZ entscheidet ein Regionsname der Quelle nicht zwischen Stadt und Land', () => {
    // meinbezirk-Event in Hölles, 2751: die Region „wiener-neustadt" umfasst Stadt und Land.
    expect(districtForLocation(null, '2751', 'niederoesterreich', 'wiener-neustadt')).toBeNull();
    // Seiersberg, 8054: Region „graz".
    expect(districtForLocation(null, '8054', 'steiermark', 'graz')).toBeNull();
  });

  it('ein unlesbarer Bezirksname macht die PLZ mehrdeutig', () => {
    // RTR führt für 8280 Fürstenfeld neben Hartberg-Fürstenfeld eine Zeile mit Bezirk „NULL".
    expect(districtsForPlz('8280', 'steiermark')).toEqual(['hartberg-fürstenfeld']);
    expect(districtFromPlz('8280', 'steiermark')).toBeNull();
    expect(districtFromPlz('8280')).toBeNull();
  });

  it('Wächter: jede Bezirksschreibweise wird gelesen, nur „NULL" der RTR ist unlesbar', () => {
    // Neue Schreibweisen nach einem Neubau von data/plz-at.json landen hier,
    // statt still aus der Kandidatenmenge zu fallen.
    expect([...new Set(unreadablePlzDistricts().map(u => u.bezirk))]).toEqual(['NULL']);
  });
});

describe('bundeslandForLocation: das Bundesland eines Events', () => {
  it('die Angabe der Quelle gilt, in kanonischer Schreibweise', () => {
    expect(bundeslandForLocation('Wien', null, null)).toBe('wien');
    expect(bundeslandForLocation('tirol', { bundesland: 'vorarlberg' }, '6960')).toBe('tirol');
  });

  it('ohne Angabe der Quelle das Bundesland der belegten Gemeinde (Prod 2026-10-07: 4.181 Events ohne Bundesland)', () => {
    expect(bundeslandForLocation(null, { bundesland: 'wien' }, '1150')).toBe('wien');
    expect(bundeslandForLocation(undefined, { bundesland: 'oberoesterreich' }, null)).toBe('oberoesterreich');
  });

  it('die Gemeinde geht der PLZ vor: 1300 Wien-Flughafen liegt in Schwechat (NÖ)', () => {
    expect(bundeslandForLocation(null, { bundesland: 'niederoesterreich' }, '1300')).toBe('niederoesterreich');
  });

  it('ohne Gemeinde die PLZ, wenn alle ihre Gemeinden im selben Bundesland liegen', () => {
    // 4240: Freistadt, Waldburg, Kefermarkt, Lasberg, Reichenthal
    expect(bundeslandForLocation(null, null, '4240')).toBe('oberoesterreich');
    // Schwechat ist die einzige Gemeinde der PLZ 1300, die RTR nennt das Wiener Postamt.
    expect(bundeslandForLocation(null, null, '1300')).toBe('niederoesterreich');
  });

  it('eine PLZ über die Landesgrenze bleibt offen, auch wenn die RTR ein Bundesland nennt', () => {
    // 8292 Neudau (Steiermark) stellt auch ins Burgenland zu.
    expect(bundeslandForLocation(null, null, '8292')).toBeNull();
    expect(bundeslandForLocation(null, null, '2413')).toBeNull();
  });

  it('PLZ ohne Gemeinde in der Stammdatei: Bundesland laut RTR', () => {
    expect(bundeslandForLocation(null, null, '2654')).toBe('niederoesterreich');
  });

  it('nichts belegt, nichts geraten', () => {
    expect(bundeslandForLocation(null, null, null)).toBeNull();
    expect(bundeslandForLocation(null, null, '0000')).toBeNull();
    expect(bundeslandForLocation('', null, '')).toBeNull();
  });
});
