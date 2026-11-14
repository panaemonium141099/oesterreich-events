/**
 * Baut `src/lib/utils/plz-ort-slugs-de.generated.ts`: der Ort im
 * Event-URL-Präfix `/events/{plz}-{ort}/…` für lasstreffen.de (fn-31.10).
 *
 * Wie in Österreich hängt die URL allein an der PLZ, nie an Adresse oder
 * Ortsnamen der Zeile. Eine deutsche PLZ deckt aber oft mehrere Orte und
 * Ortsteile. Der Ort der URL ist deshalb die GEMEINDE der PLZ:
 *   1. die einzige Gemeinde, die die PLZ führt, sonst
 *   2. die Gemeinde, deren Amt unter dieser PLZ sitzt, sonst
 *   3. die mit den meisten Einwohnern (bei Gleichstand der kleinere AGS).
 * Großkunden-PLZ und PLZ ohne Gemeinde bekommen keinen Eintrag.
 *
 * Gemessen am 14.11.2026 über 218.340 DE-Events mit Gemeindeschlüssel
 * (PLZ der Gemeinde aus der Ortsentscheidung): der Ort der URL ist bei
 * 93,64 % die Gemeinde des Events. Mit „größte Gemeinde zuerst“ statt
 * Regel 2 wären es 91,68 %. Bei 47.945 dieser Events teilen sich mehrere
 * Gemeinden die PLZ; dort kann der Ort der URL der Nachbarort sein.
 *
 * Quellen: data/plz-de.json (GeoNames CC BY 4.0 + Amts-PLZ) und
 * data/gemeinden-de.json (Destatis, dl-de/by-2-0).
 *
 * Aufruf: npm run build:plz-slugs:de (nach build:stammdaten:de)
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { slugifyPlace } from '../lib/utils/slugify';
import { allPlzReferenceDeEntries } from '../lib/location/plz-reference-de';
import { gemeindeDeByAgs, type GemeindeDe } from '../lib/gemeinden/de';

/** Die Gemeinde, die für eine PLZ in der URL steht; null ohne belegte Gemeinde. */
export function urlGemeindeForPlz(plz: string, ags: string[]): GemeindeDe | null {
  const gemeinden = ags.map(a => gemeindeDeByAgs(a)).filter((g): g is GemeindeDe => g !== null);
  if (gemeinden.length === 0) return null;
  if (gemeinden.length === 1) return gemeinden[0];
  const amt = gemeinden.filter(g => g.plz === plz);
  const pool = amt.length > 0 ? amt : gemeinden;
  return [...pool].sort((a, b) => b.einwohner - a.einwohner || a.ags.localeCompare(b.ags))[0];
}

function main() {
  const bySlug = new Map<string, string[]>();
  let plzCount = 0;
  for (const e of allPlzReferenceDeEntries().sort((a, b) => a.plz.localeCompare(b.plz))) {
    if (!/^\d{5}$/.test(e.plz) || e.grosskunde) continue;
    const g = urlGemeindeForPlz(e.plz, e.gemeinden);
    const slug = g ? slugifyPlace(g.name) : '';
    if (!slug) continue;
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), e.plz]);
    plzCount++;
  }
  const data = [...bySlug].map(([slug, plzs]) => `${slug}:${plzs.join(',')}`).join(';');
  const out = `// GENERIERT von src/scripts/build-plz-ort-slugs-de.ts aus data/plz-de.json und
// data/gemeinden-de.json (GeoNames CC BY 4.0, Destatis dl-de/by-2-0). Nicht von Hand ändern.
// Format: "ort-slug:plz,plz;ort-slug:plz"
export const PLZ_ORT_SLUGS_DE = ${JSON.stringify(data)};
`;
  writeFileSync(join(process.cwd(), 'src', 'lib', 'utils', 'plz-ort-slugs-de.generated.ts'), out);
  console.log(`${bySlug.size} Orte, ${plzCount} PLZ, ${data.length} Zeichen`);
}

if ((process.argv[1] ?? '').split('\\').join('/').endsWith('src/scripts/build-plz-ort-slugs-de.ts')) main();
