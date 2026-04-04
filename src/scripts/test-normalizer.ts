import { normalizeLocation, extractPlaceFromText, normalizeEventLocation } from '../lib/location-normalizer';

console.log('=== Testing specific problem cases ===\n');

const r1 = normalizeLocation('Landsee', undefined, 'Burgenland');
console.log('Landsee direct:', JSON.stringify(r1));

const r2 = extractPlaceFromText('Ostereiersuche auf der Burgruine Landsee', undefined, 'Burgenland');
console.log('Title extract:', JSON.stringify(r2));

const r3 = normalizeEventLocation({
  title: 'Ostereiersuche auf der Burgruine Landsee',
  location_name: 'Burgruine',
  bundesland: 'Burgenland',
});
console.log('Full Landsee event:', JSON.stringify(r3));

const r4 = normalizeEventLocation({
  title: 'Oggauer Weinglück',
  location_name: 'Oggauer Weinbauern, Oggau am Neusiedler See',
  bundesland: 'Burgenland',
});
console.log('Oggau event:', JSON.stringify(r4));

const r5 = normalizeLocation('Oggau am Neusiedler See', undefined, 'Burgenland');
console.log('Oggau direct:', JSON.stringify(r5));
