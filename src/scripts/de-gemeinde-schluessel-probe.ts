/**
 * Probe für fn-31.6/7: Wie viele deutsche Events lassen sich aus der
 * gespeicherten Ortsentscheidung (Name, PLZ, Land, Kreis der Gemeinde)
 * eindeutig einer AGS zuordnen, ohne Resolver-Lauf und ohne Netz?
 *
 * Eingabe ist ein CSV aus Prod (name,plz,land,kreis,n), gruppiert über
 * `location_resolution.gemeinde` der kommenden, sichtbaren DE-Events:
 *
 *   npx tsx src/scripts/de-gemeinde-schluessel-probe.ts <csv>
 *
 * Nur lesend, nur lokal. Die Regel hier ist die Vorlage für `regionKeys`.
 */
import { readFileSync } from 'node:fs';
import { loadGemeindenDe, type GemeindeDe } from '@/lib/gemeinden/de';

const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      const out: string[] = [];
      let cur = '';
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quoted) {
          if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (c === '"') quoted = false;
          else cur += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') { out.push(cur); cur = ''; }
        else cur += c;
      }
      out.push(cur);
      return out;
    });
}

const file = process.argv[2];
if (!file) throw new Error('CSV fehlt');

const byLandName = new Map<string, GemeindeDe[]>();
for (const g of loadGemeindenDe()) {
  const k = `${g.land}|${norm(g.name)}`;
  byLandName.set(k, [...(byLandName.get(k) ?? []), g]);
}

const tally = new Map<string, { gruppen: number; events: number }>();
const add = (key: string, n: number) => {
  const t = tally.get(key) ?? { gruppen: 0, events: 0 };
  t.gruppen++;
  t.events += n;
  tally.set(key, t);
};
const offen: string[] = [];

for (const [name, plz, land, kreis, nRaw] of parseCsv(readFileSync(file, 'utf8')).slice(1)) {
  const n = Number(nRaw);
  if (!name) { add('ohne Gemeinde', n); continue; }
  const hits = byLandName.get(`${land}|${norm(name)}`) ?? [];
  if (hits.length === 0) { add('Name im Land unbekannt', n); offen.push(`${name} | ${plz} | ${land} | ${kreis} | ${n}`); continue; }
  if (hits.length === 1) { add('eindeutig über Name und Land', n); continue; }
  const byKreis = hits.filter(g => norm(g.kreis) === norm(kreis ?? ''));
  if (byKreis.length === 1) { add('eindeutig über Kreis', n); continue; }
  const pool = byKreis.length > 1 ? byKreis : hits;
  const byPlz = pool.filter(g => g.plz === plz || g.plzAll.includes(plz));
  if (byPlz.length === 1) { add('eindeutig über PLZ', n); continue; }
  add('mehrdeutig', n);
  offen.push(`${name} | ${plz} | ${land} | ${kreis} | ${n} | ${hits.length} Kandidaten`);
}

const total = [...tally.values()].reduce((s, t) => s + t.events, 0);
for (const [key, t] of [...tally.entries()].sort((a, b) => b[1].events - a[1].events)) {
  console.log(`${key}: ${t.events} Events (${((t.events / total) * 100).toFixed(2)} %), ${t.gruppen} Gruppen`);
}
console.log(`gesamt: ${total} Events`);
if (offen.length) console.log(`\nnicht zugeordnet (erste 15 von ${offen.length}):\n${offen.slice(0, 15).join('\n')}`);
