/**
 * Abdeckung der Amts- und VG-Kalender (fn-29.17): wie viele Gemeinden der
 * Stufe V (kein eigener Kalender, Ausweichweg über Amt/VG) haben im letzten
 * Prüfstand-Lauf `de-amt-vg` mindestens einen Termin. Ein Termin zählt für
 * die Gemeinde, die der Resolver ihm gibt (nach der Etiketten-Regel nur die,
 * die der Termin selbst nennt oder deren Adresse er trägt).
 *
 * Aufruf (nach `npm run pruefstand:de -- --adapter de-amt-vg`):
 *   npx tsx src/scripts/amt-vg-abdeckung.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gemeindeDeByAgs } from '../lib/gemeinden/de';
import { normalizeGemeindeName } from '../lib/location/gemeinde-name';
import { isPublished } from '../lib/pruefstand/metrics';
import { loadRegistryDe } from '../lib/registry-de/load';

interface Row {
  source_name?: string;
  publish_status?: string | null;
  location_resolution?: { gemeinde?: { name: string; plz: string } | null } | null;
}

const rows = JSON.parse(readFileSync(join(process.cwd(), '.pruefstand', 'de-amt-vg', 'rows.json'), 'utf8')) as Row[];
const v = loadRegistryDe().filter(e => e.stufe === 'V' && e.fallback?.kind === 'verband');

// Gemeinde des Resolvers → AGS über Name und PLZ der Stammdaten.
const key = (name: string, plz: string) => `${normalizeGemeindeName(name)}|${plz}`;
const agsByKey = new Map<string, string>();
for (const e of v) {
  const g = gemeindeDeByAgs(e.ags);
  if (!g) continue;
  for (const p of g.plzAll) agsByKey.set(key(g.name, p), e.ags);
}

const any = new Map<string, number>();
const visible = new Map<string, number>();
for (const r of rows) {
  const g = r.location_resolution?.gemeinde;
  const ags = g ? agsByKey.get(key(g.name, g.plz)) : undefined;
  if (!ags) continue;
  any.set(ags, (any.get(ags) ?? 0) + 1);
  if (isPublished(r)) visible.set(ags, (visible.get(ags) ?? 0) + 1);
}

const byIntegration = new Map<string, { n: number; any: number; visible: number }>();
for (const e of v) {
  const k = e.fallback?.kind === 'verband' ? e.fallback.integration : '';
  const s = byIntegration.get(k) ?? { n: 0, any: 0, visible: 0 };
  s.n++;
  if (any.has(e.ags)) s.any++;
  if (visible.has(e.ags)) s.visible++;
  byIntegration.set(k, s);
}

console.log(`Zeilen ${rows.length}, Stufe V ${v.length}`);
console.log(`mit mindestens einem Termin: ${any.size}, davon sichtbar: ${visible.size}`);
console.log('| Integration des Amts | Gemeinden | mit Termin | sichtbar |\n|---|---|---|---|');
for (const [k, s] of [...byIntegration].sort((a, b) => b[1].n - a[1].n)) console.log(`| ${k} | ${s.n} | ${s.any} | ${s.visible} |`);
