/**
 * Baut `data/geonames-at.json` aus dem GeoNames-Dump `data/AT.txt`
 * (aus https://download.geonames.org/export/dump/AT.zip).
 *
 * fn-25 C1 (2026-09-13): Neuaufbau nach dem Befund, dass die alte Datei
 * 59 % der Einträge dem falschen Bundesland zuordnete (ADMIN1 04/06 und
 * 05/07 vertauscht: Graz stand unter „Oberösterreich", Linz unter
 * „Steiermark", Innsbruck unter „Salzburg", Salzburg unter „Tirol"), und
 * dass ungefilterte Alternativnamen („Kirche" für Hirschegg, „Platz" für
 * Galtür, „Fritz" für Riegler) den Namensabgleich vergifteten.
 *
 * Regeln:
 *  - ADMIN1 nach GeoNames: 01 Burgenland, 02 Kärnten, 03 Niederösterreich,
 *    04 Oberösterreich, 05 Salzburg, 06 Steiermark, 07 Tirol,
 *    08 Vorarlberg, 09 Wien.
 *  - Nur Siedlungen (Feature-Klasse P) und Verwaltungseinheiten (ADM1–ADM4).
 *    Keine Gebäude, Höfe, Hütten, Kirchen, Theater (Klasse S): ein
 *    Ortsverzeichnis enthält Orte, keine Venues.
 *  - Alternativnamen nur, wenn sie Schreib-/Transliterationsvarianten des
 *    Namens sind (gleich nach Entfernen von Diakritika, ä→ae, ß→ss usw.).
 *    Fremdsprachige Exonyme („Vienna") werden zusätzlich für die
 *    Landeshauptstädte erlaubt.
 *  - Originaler ADMIN1-Code, geonameid und Datenstand bleiben erhalten
 *    (`data/geonames-at.meta.json`).
 *  - Prüfungen brechen den Build ab: alle neun Länder vorhanden, bekannte
 *    Städte im richtigen Land, Polygon-Gegenprobe (Bundesland-Polygone)
 *    mit < 1 % Abweichung.
 *
 * Aufruf: npx tsx src/scripts/build-geonames-db.ts [--dump data/AT.txt]
 */
import { readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { bundeslandFromPolygon } from '../lib/eventim/bundesland-from-geo';
import { bundeslandToId } from '../lib/bundeslaender';

const ADMIN1_MAP: Record<string, string> = {
  '01': 'Burgenland',
  '02': 'Kärnten',
  '03': 'Niederösterreich',
  '04': 'Oberösterreich',
  '05': 'Salzburg',
  '06': 'Steiermark',
  '07': 'Tirol',
  '08': 'Vorarlberg',
  '09': 'Wien',
};

const KEEP_ADMIN = new Set(['ADM1', 'ADM2', 'ADM3', 'ADM4']);

/** GeoNames führt die Bundeshauptstadt englisch als „Vienna" (PPLC); wir
 *  brauchen den deutschen Namen als Primärnamen. */
const NAME_OVERRIDES: Record<string, string> = { Vienna: 'Wien' };

/** Exonyme der Landeshauptstädte, die als Alternativnamen sinnvoll sind. */
const CAPITAL_EXONYMS: Record<string, string[]> = {
  Wien: ['Vienna', 'Vienne', 'Bécs', 'Vídeň', 'Dunaj'],
  Graz: ['Gradec'],
  Klagenfurt: ['Celovec', 'Klagenfurt am Wörthersee', 'Klagenfurt am Woerthersee'],
  Bregenz: [],
  Innsbruck: [],
  Salzburg: [],
  Linz: [],
  Eisenstadt: ['Kismarton', 'Železno'],
  'Sankt Pölten': ['St. Pölten', 'St. Poelten', 'Sankt Poelten'],
};

export interface GeoEntry {
  name: string;
  ascii: string;
  alt: string[];
  lat: number;
  lng: number;
  bundesland: string;
  pop: number;
  type: string;
  /** Originaler GeoNames-ADMIN1-Code (01–09). */
  admin1: string;
  /** geonameid, für Rückverfolgbarkeit. */
  id: number;
}

/** Vergleichsform: klein, Diakritika weg, Umlaute/ß zu ASCII-Varianten. */
export function foldName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\bst\.\s*/g, 'sankt ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Ist `alt` nur eine Schreibvariante von `name`? */
export function isSpellingVariant(name: string, alt: string): boolean {
  const a = foldName(name);
  const b = foldName(alt);
  if (!a || !b) return false;
  if (a === b) return true;
  // Varianten ohne geografischen Zusatz: "Sankt Pölten" ↔ "St. Pölten" ist
  // oben abgedeckt; "Klagenfurt" ↔ "Klagenfurt am Wörthersee" NICHT — der
  // Zusatz gehört zum Namen, die Kurzform kommt über den Basisnamen-Index.
  return false;
}

function main() {
  const dumpArg = process.argv.indexOf('--dump');
  const inputPath = dumpArg !== -1 ? process.argv[dumpArg + 1] : join(process.cwd(), 'data', 'AT.txt');
  const outputPath = join(process.cwd(), 'data', 'geonames-at.json');
  const metaPath = join(process.cwd(), 'data', 'geonames-at.meta.json');
  if (!existsSync(inputPath)) {
    console.error(`Dump nicht gefunden: ${inputPath}. Laden: https://download.geonames.org/export/dump/AT.zip → entpacken nach data/AT.txt`);
    process.exit(1);
  }

  const content = readFileSync(inputPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());

  const entries: GeoEntry[] = [];
  let skipped = 0;
  let droppedAlt = 0;
  let keptAlt = 0;
  let newestModified = '';

  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 19) continue;
    const featureClass = cols[6];
    const featureCode = cols[7];
    const isPlace = featureClass === 'P';
    const isAdmin = featureClass === 'A' && KEEP_ADMIN.has(featureCode);
    if (!isPlace && !isAdmin) {
      skipped++;
      continue;
    }
    const admin1 = cols[10];
    const bundesland = ADMIN1_MAP[admin1] || '';
    if (!bundesland) {
      skipped++;
      continue;
    }
    const originalName = cols[1];
    const name = NAME_OVERRIDES[originalName] ?? originalName;
    const rawAlts = cols[3] ? cols[3].split(',').map(n => n.trim()).filter(n => n.length > 1) : [];
    if (name !== originalName) rawAlts.unshift(originalName);
    const exonyms = CAPITAL_EXONYMS[name] ?? [];
    const alt: string[] = [];
    for (const a of rawAlts) {
      if (a === name) continue;
      if (isSpellingVariant(name, a) || exonyms.includes(a)) {
        if (!alt.includes(a)) alt.push(a);
        keptAlt++;
      } else {
        droppedAlt++;
      }
    }
    if (cols[18] && cols[18] > newestModified) newestModified = cols[18].trim();

    entries.push({
      name,
      ascii: name === originalName ? cols[2] : name,
      alt: alt.slice(0, 8),
      lat: parseFloat(cols[4]),
      lng: parseFloat(cols[5]),
      bundesland,
      pop: parseInt(cols[14]) || 0,
      type: featureCode,
      admin1,
      id: parseInt(cols[0], 10),
    });
  }

  entries.sort((a, b) => b.pop - a.pop);

  // ── Prüfungen ────────────────────────────────────────────────────────
  const failures: string[] = [];
  const byBL: Record<string, number> = {};
  for (const e of entries) byBL[e.bundesland] = (byBL[e.bundesland] || 0) + 1;
  for (const bl of Object.values(ADMIN1_MAP)) {
    if (!byBL[bl]) failures.push(`Bundesland ohne Einträge: ${bl}`);
  }

  const expectCity: Array<[string, string]> = [
    ['Graz', 'Steiermark'], ['Linz', 'Oberösterreich'], ['Innsbruck', 'Tirol'], ['Salzburg', 'Salzburg'],
    ['Klagenfurt am Wörthersee', 'Kärnten'], ['Bregenz', 'Vorarlberg'], ['Eisenstadt', 'Burgenland'],
    ['Sankt Pölten', 'Niederösterreich'], ['Wien', 'Wien'], ['Haus im Ennstal', 'Steiermark'],
    ['Hof bei Salzburg', 'Salzburg'], ['Kitzbühel', 'Tirol'], ['Wels', 'Oberösterreich'],
  ];
  for (const [city, bl] of expectCity) {
    const hit = entries.find(e => e.name === city && e.type.startsWith('PPL'));
    if (!hit) failures.push(`Stadt fehlt: ${city}`);
    else if (hit.bundesland !== bl) failures.push(`${city}: ${hit.bundesland} statt ${bl}`);
  }

  // Polygon-Gegenprobe über alle Siedlungen mit Einwohnern (schnell genug,
  // ~10k Punkte); Grenzpunkte ohne Treffer werden nicht gezählt.
  let checked = 0;
  let mismatched = 0;
  const mismatchSamples: string[] = [];
  for (const e of entries) {
    if (!e.type.startsWith('PPL') || e.pop < 200) continue;
    let poly: string | null = null;
    try { poly = bundeslandFromPolygon(e.lat, e.lng); } catch { poly = null; }
    if (!poly) continue;
    checked++;
    if (poly !== bundeslandToId(e.bundesland)) {
      mismatched++;
      if (mismatchSamples.length < 8) mismatchSamples.push(`${e.name} (${e.bundesland} vs Polygon ${poly})`);
    }
  }
  const mismatchRate = checked > 0 ? mismatched / checked : 0;
  if (mismatchRate > 0.01) failures.push(`Polygon-Gegenprobe: ${(mismatchRate * 100).toFixed(2)} % Abweichung (${mismatched}/${checked}): ${mismatchSamples.join('; ')}`);

  if (failures.length > 0) {
    console.error('Build abgebrochen, Prüfungen fehlgeschlagen:');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }

  writeFileSync(outputPath, JSON.stringify(entries));
  const meta = {
    source: 'https://download.geonames.org/export/dump/AT.zip',
    dump_file: inputPath.replace(process.cwd(), '.').split(String.fromCharCode(92)).join('/'),
    dump_mtime: statSync(inputPath).mtime.toISOString(),
    dump_newest_modification_date: newestModified,
    built_at: new Date().toISOString(),
    entries: entries.length,
    by_bundesland: byBL,
    admin1_map: ADMIN1_MAP,
    feature_filter: 'P (alle Siedlungen) + A/ADM1-4',
    alt_names: { kept: keptAlt, dropped: droppedAlt, rule: 'nur Schreib-/Transliterationsvarianten + Exonyme der Landeshauptstädte' },
    checks: { known_cities: expectCity.length, polygon_checked: checked, polygon_mismatched: mismatched },
  };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');

  console.log(`Geschrieben: ${entries.length} Einträge (${skipped} verworfen), Alt-Namen ${keptAlt} behalten / ${droppedAlt} verworfen`);
  console.log(`Polygon-Gegenprobe: ${mismatched}/${checked} Abweichungen`);
  console.log('Nach Bundesland:');
  Object.entries(byBL).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

main();
