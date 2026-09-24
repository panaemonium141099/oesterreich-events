/**
 * Baut `data/gemeinden-at.json`, die EINZIGE Gemeinde-Stammdatei der Seite.
 *
 * Quellen (Statistik Austria, CC BY 4.0, Gebietsstand laut Dateikopf):
 *   data/stammdaten/gemliste_knz.csv  Gemeindekennziffer, Name, PLZ des
 *                                     Gemeindeamts, weitere Postleitzahlen
 *   data/stammdaten/polbezirke.csv    politische Bezirke je Kennziffer
 * Aktualisieren: beide CSV von statistik.at/verzeichnis/reglisten/ laden,
 * dann `npx tsx src/scripts/build-gemeinden-master.ts`.
 *
 * Dazu je Gemeindekennziffer:
 *   data/stammdaten/gemeinde-mittelpunkte.json  Ortsmittelpunkt
 *   data/stammdaten/gemeinde-legacy-slugs.json  frühere Hub-Slugs (308)
 * Eine Gemeinde ohne Mittelpunkt bricht den Build ab.
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const BL_BY_DIGIT: Record<string, string> = {
  '1': 'burgenland', '2': 'kaernten', '3': 'niederoesterreich', '4': 'oberoesterreich',
  '5': 'salzburg', '6': 'steiermark', '7': 'tirol', '8': 'vorarlberg', '9': 'wien',
};

export interface GemeindeMasterEntry {
  gkz: string;
  name: string;
  /** PLZ des Gemeindeamts. */
  plz: string;
  /** Alle PLZ, die (auch) diese Gemeinde bedienen, inkl. `plz`. */
  plzAll: string[];
  bezirk: string;
  bundesland: string;
  lat: number;
  lng: number;
  /** Statutarstadt laut Statistik Austria (Status „SR"). */
  statutarstadt: boolean;
  /** Frühere Hub-Slugs aus der Registry, die heute anders lauten (308). */
  legacySlugs?: string[];
}

function hubSlug(plz: string, name: string): string {
  return `${plz}-${name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

function csvRows(file: string): string[][] {
  return readFileSync(join(ROOT, 'data', 'stammdaten', file), 'utf8')
    .split(/\r?\n/)
    .map(l => l.split(';'))
    .filter(r => /^\d+$/.test(r[0] ?? ''));
}

// „Krems(Land)" → „Krems (Land)": Schreibweise, die district-normalizer und
// die Tabelle district_canonical erwarten.
const bezirkByCode = new Map(csvRows('polbezirke.csv').map(r => [r[2], r[3].trim().replace(/\s*\(/, ' (')]));

const mittelpunkte = JSON.parse(readFileSync(join(ROOT, 'data', 'stammdaten', 'gemeinde-mittelpunkte.json'), 'utf8')) as Record<string, { lat: number; lng: number }>;
const legacy = JSON.parse(readFileSync(join(ROOT, 'data', 'stammdaten', 'gemeinde-legacy-slugs.json'), 'utf8')) as Record<string, string[]>;

let withoutCoords = 0;

// Wien steht je Bezirk in einer eigenen Zeile (gleiche Kennziffer 90001,
// eigene Amts-PLZ): zu einer Gemeinde mit allen PLZ zusammenfassen.
const grouped = new Map<string, string[]>();
for (const r of csvRows('gemliste_knz.csv')) {
  const prev = grouped.get(r[0]);
  if (!prev) grouped.set(r[0], [...r]);
  else prev[5] = [prev[5] ?? '', r[4], r[5] ?? ''].join(' ');
}

const out: GemeindeMasterEntry[] = [...grouped.values()].map(r => {
  const [gkz, rawName, , status, plzAmt, weitere] = r;
  const name = rawName.trim();
  const bundesland = BL_BY_DIGIT[gkz[0]];
  // Wien ist eine Gemeinde mit 23 Bezirken; die Kennziffern 901–923 stehen
  // in polbezirke, die Gemeinde selbst in 90001.
  const bezirk = bundesland === 'wien' ? 'Wien' : (bezirkByCode.get(gkz.slice(0, 3)) ?? '');
  const plzAll = [...new Set([plzAmt.trim(), ...(weitere ?? '').split(/\s+/)].filter(p => /^\d{4}$/.test(p)))];
  const c = mittelpunkte[gkz] && (mittelpunkte[gkz].lat !== 0 || mittelpunkte[gkz].lng !== 0) ? mittelpunkte[gkz] : null;
  if (!c) withoutCoords++;
  const current = hubSlug(plzAmt.trim(), name);
  const legacySlugs = (legacy[gkz] ?? []).filter(s => s !== current);
  return {
    gkz, name, plz: plzAmt.trim(), plzAll, bezirk, bundesland, lat: c?.lat ?? 0, lng: c?.lng ?? 0,
    statutarstadt: (status ?? '').trim() === 'SR',
    ...(legacySlugs.length ? { legacySlugs } : {}),
  };
});

writeFileSync(join(ROOT, 'data', 'gemeinden-at.json'), JSON.stringify(out));

// Kompakte Browser-Fassung für die Ortssuche der Karte (MapTopBar) und den
// Lifecycle-Mail-Standort. Wird hier erzeugt, nie von Hand gepflegt.
const BL_LABEL: Record<string, string> = {
  burgenland: 'Burgenland', kaernten: 'Kärnten', niederoesterreich: 'Niederösterreich',
  oberoesterreich: 'Oberösterreich', salzburg: 'Salzburg', steiermark: 'Steiermark',
  tirol: 'Tirol', vorarlberg: 'Vorarlberg', wien: 'Wien',
};
writeFileSync(
  join(ROOT, 'public', 'gemeinden.json'),
  JSON.stringify(out.map(g => ({ n: g.name, b: BL_LABEL[g.bundesland], i: g.bundesland, p: g.plz, lat: g.lat, lng: g.lng }))),
);
if (withoutCoords > 0) {
  console.error(`${withoutCoords} Gemeinden ohne Mittelpunkt: data/stammdaten/gemeinde-mittelpunkte.json ergänzen`);
  process.exit(1);
}
console.log(`${out.length} Gemeinden`);
