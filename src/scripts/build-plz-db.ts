/**
 * Baut `data/plz-at.json` aus der amtlichen PLZ-Tabelle der RTR
 * (https://data.rtr.at/api/v1/tables/plz.json, Lizenz CC BY 4.0, Quelle
 * Österreichische Post AG / RTR-GmbH).
 *
 * fn-25 C2: Die bisherige `PLZ_COORDINATES`-Tabelle kannte 273 der ~2.230
 * österreichischen PLZ; die Gemeinde-Registry eine PLZ je Gemeinde (1.719).
 * Dazwischen war „unbekannte PLZ" die Regel, und `districtFromPlz` löste
 * PLZ mit mehreren Bezirken per Häufigkeit und Alphabet auf.
 *
 * Die RTR-Tabelle liefert je PLZ alle Orte und politischen Bezirke als
 * MENGE (438 PLZ haben mehrere Bezirke). Genau so wird sie gespeichert;
 * aufgelöst wird Mehrdeutigkeit nur durch weitere Belege, nie hier.
 *
 * Aufruf: npx tsx src/scripts/build-plz-db.ts [--from <datei.json>]
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface RtrRow {
  plz: number;
  ort: string;
  bezirk: string;
  bundesland: string;
  gueltigab?: string | null;
  gueltigbis?: string | null;
  plztyp?: string;
  adressierbar?: string;
}

/** RTR-Kürzel → kanonische Bundesland-ID des Projekts. */
const RTR_BL: Record<string, string> = {
  W: 'wien',
  N: 'niederoesterreich',
  O: 'oberoesterreich',
  B: 'burgenland',
  K: 'kaernten',
  St: 'steiermark',
  Sa: 'salzburg',
  T: 'tirol',
  V: 'vorarlberg',
};

export interface PlzEntry {
  plz: string;
  /** Orte laut Post (mehrere möglich). */
  orte: string[];
  /** Politische Bezirke laut RTR, Rohschreibweise (mehrere möglich). */
  bezirke: string[];
  /** Kanonische Bundesland-IDs (in seltenen Fällen mehrere). */
  bundeslaender: string[];
}

async function load(fromFile?: string): Promise<RtrRow[]> {
  if (fromFile) return (JSON.parse(readFileSync(fromFile, 'utf8')) as { data: RtrRow[] }).data;
  const res = await fetch('https://data.rtr.at/api/v1/tables/plz.json');
  if (!res.ok) throw new Error(`RTR ${res.status}`);
  return ((await res.json()) as { data: RtrRow[] }).data;
}

async function main() {
  const fromIdx = process.argv.indexOf('--from');
  const rows = await load(fromIdx !== -1 ? process.argv[fromIdx + 1] : undefined);
  const byPlz = new Map<string, PlzEntry>();
  let skipped = 0;
  for (const r of rows) {
    if (r.gueltigbis) { skipped++; continue; }
    if (r.adressierbar && r.adressierbar !== 'Ja') { skipped++; continue; }
    const plz = String(r.plz).padStart(4, '0');
    if (!/^\d{4}$/.test(plz)) { skipped++; continue; }
    const bl = RTR_BL[r.bundesland];
    if (!bl) { skipped++; continue; }
    const e = byPlz.get(plz) ?? { plz, orte: [], bezirke: [], bundeslaender: [] };
    const ort = r.ort.trim();
    const bezirk = r.bezirk.trim();
    if (ort && !e.orte.includes(ort)) e.orte.push(ort);
    if (bezirk && !e.bezirke.includes(bezirk)) e.bezirke.push(bezirk);
    if (!e.bundeslaender.includes(bl)) e.bundeslaender.push(bl);
    byPlz.set(plz, e);
  }
  const entries = [...byPlz.values()].sort((a, b) => a.plz.localeCompare(b.plz));

  const failures: string[] = [];
  if (entries.length < 2000) failures.push(`nur ${entries.length} PLZ`);
  for (const [plz, bl] of [['1010', 'wien'], ['8020', 'steiermark'], ['4020', 'oberoesterreich'], ['5020', 'salzburg'], ['6020', 'tirol'], ['7000', 'burgenland'], ['9020', 'kaernten'], ['6900', 'vorarlberg'], ['3100', 'niederoesterreich']]) {
    const e = byPlz.get(plz);
    if (!e) failures.push(`PLZ fehlt: ${plz}`);
    else if (!e.bundeslaender.includes(bl)) failures.push(`${plz}: ${e.bundeslaender.join('/')} statt ${bl}`);
  }
  if (failures.length > 0) {
    console.error('Build abgebrochen:', failures.join('; '));
    process.exit(1);
  }

  const out = join(process.cwd(), 'data', 'plz-at.json');
  writeFileSync(out, JSON.stringify(entries));
  writeFileSync(
    join(process.cwd(), 'data', 'plz-at.meta.json'),
    JSON.stringify(
      {
        source: 'https://data.rtr.at/api/v1/tables/plz.json',
        license: 'CC BY 4.0 (RTR-GmbH / Österreichische Post AG)',
        fetched_at: new Date().toISOString(),
        rows_in: rows.length,
        rows_skipped: skipped,
        plz_count: entries.length,
        plz_with_multiple_bezirke: entries.filter(e => e.bezirke.length > 1).length,
        plz_with_multiple_bundeslaender: entries.filter(e => e.bundeslaender.length > 1).length,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Geschrieben: ${entries.length} PLZ (${skipped} Zeilen übersprungen), ${entries.filter(e => e.bezirke.length > 1).length} mit mehreren Bezirken`);
}

main().catch(e => { console.error(e); process.exit(1); });
