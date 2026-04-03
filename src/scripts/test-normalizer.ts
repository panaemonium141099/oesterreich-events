import { normalizeLocation } from '../lib/location-normalizer';

const tests: [string, string?, string?][] = [
  ['St. Georgen am Leithagebirge', undefined, 'Burgenland'],
  ['Sankt Georgen am Leithagebirge', undefined, 'Burgenland'],
  ['Trausdorf an der Wulka', undefined, 'Burgenland'],
  ['Trausdorf a.d. Wulka', undefined, 'Burgenland'],
  ['St. Pölten', undefined, 'Niederösterreich'],
  ['St.Pölten', undefined, 'Niederösterreich'],
  ['Waidhofen a.d. Ybbs', undefined, undefined],
  ['Bruck a.d. Leitha', undefined, undefined],
  ['Zell am See', undefined, 'Salzburg'],
  ['Innsbruck', undefined, undefined],
  ['Wien', undefined, undefined],
  ['Graz', undefined, undefined],
  ['Linz', undefined, undefined],
  ['Eisenstadt', undefined, undefined],
  ['Klagenfurt', undefined, undefined],
  ['Bregenz', undefined, undefined],
  ['Salzburg', undefined, undefined],
  // Edge cases
  ['Pfarrscheune Trausdorf', undefined, 'Burgenland'],
  ['Kulturzentrum Mattersburg', undefined, 'Burgenland'],
  ['Nonsense Location XYZ', undefined, undefined],
];

let passed = 0;
let failed = 0;

for (const [name, plz, bl] of tests) {
  const r = normalizeLocation(name, plz, bl);
  const status = r ? `✓ ${r.canonicalName} [${r.confidence}] ${r.latitude.toFixed(4)}/${r.longitude.toFixed(4)}` : '✗ NO MATCH';
  console.log(`${name.padEnd(40)} → ${status}`);
  if (r) passed++; else failed++;
}

console.log(`\n${passed} matched, ${failed} no match`);
