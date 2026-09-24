/**
 * Baut `src/lib/utils/plz-ort-slugs.generated.ts` aus `data/plz-at.json`
 * (amtliche RTR/Post-Tabelle, ein Ort je PLZ).
 *
 * Der Ort im Event-URL-Präfix `/events/{plz}-{ort}/…` kommt seit 2026-09-24
 * aus dieser Tabelle statt aus Adresse/Ortsname. Vorher zeigten 53 % der
 * künftigen Events mit belegter Gemeinde die Landeshauptstadt oder einen
 * Venue-Namen (Mariazell → 8630-graz, Burgtheater → 1010-burgtheater), und
 * jede Korrektur am Ortsnamen erzeugte eine neue URL samt 308.
 *
 * Die Tabelle wird auch in Client-Komponenten gebraucht (Karten, Cards),
 * deshalb als kompakter String statt readFileSync.
 *
 * Aufruf: npx tsx src/scripts/build-plz-ort-slugs.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { slugifyPlace } from '../lib/utils/slugify';

interface PlzEntry {
  plz: string;
  orte: string[];
}

const entries = JSON.parse(readFileSync(join(process.cwd(), 'data', 'plz-at.json'), 'utf8')) as PlzEntry[];

const bySlug = new Map<string, string[]>();
for (const e of [...entries].sort((a, b) => a.plz.localeCompare(b.plz))) {
  if (!/^\d{4}$/.test(e.plz) || e.orte.length === 0) continue;
  // Mehrere Orte kommen in der RTR-Tabelle derzeit nicht vor; falls doch,
  // gewinnt der alphabetisch erste, damit die URL deterministisch bleibt.
  const slug = slugifyPlace([...e.orte].sort()[0]);
  if (!slug) continue;
  const list = bySlug.get(slug) ?? [];
  list.push(e.plz);
  bySlug.set(slug, list);
}

const data = [...bySlug].map(([slug, plzs]) => `${slug}:${plzs.join(',')}`).join(';');
const out = `// GENERIERT von src/scripts/build-plz-ort-slugs.ts aus data/plz-at.json
// (Quelle: RTR-GmbH / Österreichische Post AG, CC BY 4.0). Nicht von Hand ändern.
// Format: "ort-slug:plz,plz;ort-slug:plz"
export const PLZ_ORT_SLUGS = ${JSON.stringify(data)};
`;
writeFileSync(join(process.cwd(), 'src', 'lib', 'utils', 'plz-ort-slugs.generated.ts'), out);
console.log(`${bySlug.size} Orte, ${entries.length} PLZ, ${data.length} Zeichen`);
