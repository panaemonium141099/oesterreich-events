/**
 * Baut die deutschen Ortsstammdaten (fn-29.1), das Gegenstück zu
 * build-gemeinden-master.ts und build-plz-db.ts für Österreich:
 *
 *   data/gemeinden-de.json              je Gemeinde AGS, ARS, Name, Land, Kreis,
 *                                       Verband, PLZ des Gemeindeamts, alle PLZ,
 *                                       Mittelpunkt, Einwohner
 *   data/plz-de.json                    je PLZ die MENGE der Orte, Gemeinden
 *                                       (AGS), Kreise und Länder
 *   data/stammdaten-de/laender-de.geojson  Länderflächen (WGS84) für die
 *                                       Gegenprobe des Freigabevertrags
 *   data/stammdaten-de/meta.json        Quellen, Lizenzen, Stände, Prüfsummen
 *
 * Quellen (Rohdateien unter data/stammdaten-de/quellen/, nicht im Repo):
 *   Destatis Gemeindeverzeichnis-Auszug (Gebietsstand 30.09.2026), dl-de/by-2-0
 *   GeoNames Postleitzahlen DE, CC BY 4.0
 *   BKG VG250 (Verwaltungsgebiete 1:250 000, Ebenen), dl-de/by-2-0; Grenzen in
 *   UTM vereinfacht (Douglas-Peucker, 25 m), dann nach WGS84 umgerechnet
 *
 * Wie in Österreich wird nichts aufgelöst: Eine PLZ führt alle Orte und alle
 * Gemeinden als Menge. Einer Gemeinde wird eine PLZ nur zugeordnet, wenn
 * Destatis sie als PLZ des Gemeindeamts führt oder GeoNames den
 * Gemeindenamen unter dieser PLZ im selben Kreis nennt. Nähe zählt nicht.
 *
 * Aufruf: npx tsx src/scripts/build-stammdaten-de.ts [--fetch]
 *   --fetch  lädt die Rohdateien neu (sonst die vorhandenen in quellen/)
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { normalizeGemeindeName } from '../lib/location/gemeinde-name';
import { DE_LAENDER } from '../lib/gemeinden/laender-de';

const ROOT = process.cwd();
const DIR = join(ROOT, 'data', 'stammdaten-de');
const RAW = join(DIR, 'quellen');

const SOURCES = {
  destatis: {
    url: 'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/AuszugGV3QAktuell.xlsx?__blob=publicationFile',
    file: 'destatis-gv-auszug.xlsx',
    license: 'Datenlizenz Deutschland Namensnennung 2.0 (dl-de/by-2-0), © Statistisches Bundesamt (Destatis)',
  },
  geonames: {
    url: 'https://download.geonames.org/export/zip/DE.zip',
    file: 'geonames-plz-de.zip',
    license: 'CC BY 4.0, GeoNames (www.geonames.org)',
  },
  bkg: {
    url: 'https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_1231/aktuell/vg250_12-31.utm32s.gpkg.ebenen.zip',
    file: 'bkg-vg250.gpkg.zip',
    license: '© BKG (2026) dl-de/by-2-0, Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf',
  },
} as const;

// ── ZIP lesen (XLSX ist ein ZIP), ohne Abhängigkeit ─────────────────────────
function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('kein ZIP');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const data = buf.subarray(local + 30 + lNameLen + lExtraLen, local + 30 + lNameLen + lExtraLen + csize);
    out.set(name, method === 0 ? Buffer.from(data) : inflateRawSync(data));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function xmlUnescape(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/** Zeilen eines Arbeitsblatts als Spaltenbuchstabe → Wert. */
function readXlsxSheet(buf: Buffer, sheetFile: string): Record<string, string>[] {
  const z = unzip(buf);
  const shared = [...(z.get('xl/sharedStrings.xml')?.toString('utf8') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => xmlUnescape([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
  const xml = z.get(sheetFile)?.toString('utf8');
  if (!xml) throw new Error(`${sheetFile} fehlt`);
  const rows: Record<string, string>[] = [];
  for (const r of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: Record<string, string> = {};
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? '')?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[3] ?? '')?.[1];
      if (v === undefined) continue;
      row[c[1]] = /t="s"/.test(c[2]) ? shared[Number(v)] : xmlUnescape(v);
    }
    rows.push(row);
  }
  return rows;
}

// ── UTM Zone 32N (ETRS89, EPSG:25832) → WGS84, Krüger-Reihen ──────────────
function utm32ToWgs84(e: number, n: number): [number, number] {
  const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996, lon0 = 9 * Math.PI / 180;
  const nn = f / (2 - f);
  const A = a / (1 + nn) * (1 + nn * nn / 4 + nn ** 4 / 64);
  const beta = [
    nn / 2 - 2 * nn * nn / 3 + 37 * nn ** 3 / 96,
    nn * nn / 48 + nn ** 3 / 15,
    17 * nn ** 3 / 480,
  ];
  const delta = [
    2 * nn - 2 * nn * nn / 3 - 2 * nn ** 3,
    7 * nn * nn / 3 - 8 * nn ** 3 / 5,
    56 * nn ** 3 / 15,
  ];
  const xi = n / (k0 * A);
  const eta = (e - 500000) / (k0 * A);
  let xi1 = xi, eta1 = eta;
  for (let j = 1; j <= 3; j++) {
    xi1 -= beta[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    eta1 -= beta[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const chi = Math.asin(Math.sin(xi1) / Math.cosh(eta1));
  let phi = chi;
  for (let j = 1; j <= 3; j++) phi += delta[j - 1] * Math.sin(2 * j * chi);
  const lon = lon0 + Math.atan(Math.sinh(eta1) / Math.cos(xi1));
  return [Number((lon * 180 / Math.PI).toFixed(5)), Number((phi * 180 / Math.PI).toFixed(5))];
}

/** Douglas-Peucker in Metern (UTM), Ring bleibt geschlossen. */
function simplify(ring: number[][], tol: number): number[][] {
  if (ring.length <= 4) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = ring[a], [bx, by] = ring[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    let max = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = ring[i];
      const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  const out = ring.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : ring;
}

/** GeoPackage-Geometrie (GP-Header + WKB, UTM 32N) → vereinfachte GeoJSON-Ringe in WGS84. */
function gpkgToPolygons(blob: Uint8Array, tolMeters = 25): number[][][][] {
  const b = Buffer.from(blob);
  const flags = b[3];
  const envLen = [0, 32, 48, 48, 64][(flags >> 1) & 7];
  let p = 8 + envLen;
  const polys: number[][][][] = [];
  const readGeom = (): void => {
    const le = b[p] === 1; p += 1;
    const u32 = (): number => { const v = le ? b.readUInt32LE(p) : b.readUInt32BE(p); p += 4; return v; };
    const f64 = (): number => { const v = le ? b.readDoubleLE(p) : b.readDoubleBE(p); p += 8; return v; };
    const type = u32() % 1000;
    if (type === 6) { const n = u32(); for (let i = 0; i < n; i++) readGeom(); return; }
    if (type !== 3) throw new Error(`Geometrietyp ${type} unerwartet`);
    const rings: number[][][] = [];
    const nr = u32();
    for (let r = 0; r < nr; r++) {
      const np = u32();
      const ring: number[][] = [];
      for (let i = 0; i < np; i++) ring.push([f64(), f64()]);
      rings.push(simplify(ring, tolMeters).map(([x, y]) => utm32ToWgs84(x, y)));
    }
    polys.push(rings);
  };
  readGeom();
  return polys;
}

// ── Namensabgleich ─────────────────────────────────────────────────────────
/** „Neustadt a.d.Aisch, St" → „Neustadt a.d.Aisch" (Zusatz nach dem Komma ist der Status). */
function displayName(amtlich: string): string {
  return amtlich.split(',')[0].trim();
}
/** Vergleichsschlüssel: ausgeschriebene Präpositionen, normalisiert. */
function nameKey(name: string): string {
  const s = name
    .replace(/\ba\.\s?d\.\s?/gi, 'an der ')
    .replace(/\bi\.\s?d\.\s?/gi, 'in der ')
    .replace(/\bb\.\s?/gi, 'bei ')
    .replace(/\bi\.\s?/gi, 'im ')
    .replace(/\bv\.\s?d\.\s?/gi, 'vor der ');
  return normalizeGemeindeName(s);
}
/** Stamm vor einem Zusatz („Neustadt an der Aisch" → „neustadt"). */
function stemKey(name: string): string {
  return nameKey(name).split(/ (?:an|am|in|im|bei|ob|unter|vor|auf|ueber|zu) /)[0].replace(/ /g, '');
}
const LEGAL_FORM = /\b(GmbH|mbH|AG|KG|KGaA|OHG|e\.\s?V\.|SE|eG|GbR|UG)\b/;

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

async function fetchRaw(): Promise<void> {
  mkdirSync(RAW, { recursive: true });
  for (const s of Object.values(SOURCES)) {
    const res = await fetch(s.url, { headers: { 'User-Agent': 'lasstreffen-stammdaten/1.0' } });
    if (!res.ok) throw new Error(`${s.url}: ${res.status}`);
    writeFileSync(join(RAW, s.file), Buffer.from(await res.arrayBuffer()));
    console.log(`geladen ${s.file}`);
  }
}

interface GemeindeDe {
  ags: string;
  ars: string;
  name: string;
  nameAmtlich: string;
  land: string;
  kreisKey: string;
  kreis: string;
  verbandKey: string | null;
  verband: string | null;
  plz: string;
  plzAll: string[];
  lat: number;
  lng: number;
  einwohner: number;
}

interface PlzDe {
  plz: string;
  orte: string[];
  gemeinden: string[];
  kreise: string[];
  laender: string[];
  /** Nur Firmen-/Großkundeneinträge, kein Ort. */
  grosskunde?: true;
}

async function main(): Promise<void> {
  if (process.argv.includes('--fetch')) await fetchRaw();
  const raw = Object.fromEntries(Object.entries(SOURCES).map(([k, s]) => {
    const path = join(RAW, s.file);
    if (!existsSync(path)) throw new Error(`${path} fehlt, Aufruf mit --fetch`);
    return [k, readFileSync(path)];
  })) as Record<keyof typeof SOURCES, Buffer>;

  // ── Destatis: Satzart 40 Kreis, 50 Verband, 60 Gemeinde (ohne 66 gemeindefreies Gebiet) ──
  const z = unzip(raw.destatis);
  const wb = z.get('xl/workbook.xml')!.toString('utf8');
  const sheetIdx = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"/g)].findIndex(m => m[1].startsWith('Onlineprodukt'));
  const rows = readXlsxSheet(raw.destatis, `xl/worksheets/sheet${sheetIdx + 1}.xml`);
  const landByCode = new Map(DE_LAENDER.map(l => [l.code, l.id]));
  const kreise = new Map<string, string>();
  const verbaende = new Map<string, { typ: string; name: string }>();
  const gemeinden: GemeindeDe[] = [];
  let stand = '';
  for (const r of rows) {
    if (!stand && /am (\d\d\.\d\d\.\d{4})/.test(r.A ?? '')) stand = /am (\d\d\.\d\d\.\d{4})/.exec(r.A)![1];
    const sa = r.A, tk = r.B;
    const l = r.C ?? '', rb = r.D ?? '', kr = r.E ?? '', vb = r.F ?? '', g = r.G ?? '';
    if (sa === '40') kreise.set(l + rb + kr, r.H);
    if (sa === '50') verbaende.set(l + rb + kr + vb, { typ: tk, name: r.H });
    if (sa !== '60' || tk === '66') continue;
    const land = landByCode.get(l);
    if (!land) throw new Error(`Landesschlüssel ${l} unbekannt`);
    const v = verbaende.get(l + rb + kr + vb);
    const lng = Number(String(r.O ?? '').replace(',', '.'));
    const lat = Number(String(r.P ?? '').replace(',', '.'));
    if (!lat || !lng) throw new Error(`${r.H}: kein Mittelpunkt`);
    gemeinden.push({
      ags: l + rb + kr + g,
      ars: l + rb + kr + vb + g,
      name: displayName(r.H),
      nameAmtlich: r.H,
      land,
      kreisKey: l + rb + kr,
      kreis: kreise.get(l + rb + kr) ?? '',
      verbandKey: v && v.typ !== '50' ? l + rb + kr + vb : null,
      verband: v && v.typ !== '50' ? v.name : null,
      plz: String(r.N ?? '').trim(),
      plzAll: [],
      lat, lng,
      einwohner: Number(r.J ?? 0),
    });
  }

  // ── GeoNames: PLZ → Orte, Kreise; Gemeinde nur über Namen im selben Kreis ──
  const gn = unzip(raw.geonames).get('DE.txt')!.toString('utf8').split(/\r?\n/).filter(Boolean).map(l => l.split('\t'));
  const byKreisKey = new Map<string, Map<string, GemeindeDe[]>>();
  const byKreisStem = new Map<string, Map<string, GemeindeDe[]>>();
  for (const g of gemeinden) {
    for (const [m, key] of [[byKreisKey, nameKey(g.name)], [byKreisStem, stemKey(g.name)]] as const) {
      const inner = m.get(g.kreisKey) ?? new Map<string, GemeindeDe[]>();
      inner.set(key, [...(inner.get(key) ?? []), g]);
      m.set(g.kreisKey, inner);
    }
  }
  const plz = new Map<string, { orte: Set<string>; gemeinden: Set<string>; kreise: Set<string>; laender: Set<string>; firmen: number; rows: number }>();
  const entry = (p: string) => {
    let e = plz.get(p);
    if (!e) { e = { orte: new Set(), gemeinden: new Set(), kreise: new Set(), laender: new Set(), firmen: 0, rows: 0 }; plz.set(p, e); }
    return e;
  };
  let matchedExact = 0, matchedStem = 0;
  for (const r of gn) {
    const [, p, place, , , , , , kreisKey] = r;
    if (!/^\d{5}$/.test(p) || !/^\d{5}$/.test(kreisKey ?? '')) continue;
    const e = entry(p);
    e.rows++;
    e.kreise.add(kreisKey);
    const land = landByCode.get(kreisKey.slice(0, 2));
    if (land) e.laender.add(land);
    if (LEGAL_FORM.test(place)) { e.firmen++; continue; }
    e.orte.add(place);
    let hits = byKreisKey.get(kreisKey)?.get(nameKey(place)) ?? [];
    if (hits.length === 1) matchedExact++;
    else if (hits.length === 0) {
      hits = byKreisStem.get(kreisKey)?.get(stemKey(place)) ?? [];
      if (hits.length === 1) matchedStem++;
    }
    if (hits.length === 1) e.gemeinden.add(hits[0].ags);
  }
  // PLZ des Gemeindeamts laut Destatis gilt immer.
  for (const g of gemeinden) {
    if (!/^\d{5}$/.test(g.plz)) continue;
    const e = entry(g.plz);
    e.gemeinden.add(g.ags);
    e.kreise.add(g.kreisKey);
    e.laender.add(g.land);
  }
  const plzByAgs = new Map<string, Set<string>>();
  for (const [p, e] of plz) for (const a of e.gemeinden) plzByAgs.set(a, (plzByAgs.get(a) ?? new Set()).add(p));
  for (const g of gemeinden) g.plzAll = [...(plzByAgs.get(g.ags) ?? [])].sort();

  const plzOut: PlzDe[] = [...plz.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([p, e]) => ({
    plz: p,
    orte: [...e.orte].sort(),
    gemeinden: [...e.gemeinden].sort(),
    kreise: [...e.kreise].sort(),
    laender: [...e.laender].sort(),
    ...(e.orte.size === 0 && e.firmen > 0 ? { grosskunde: true as const } : {}),
  }));

  // ── BKG VG250: Länderflächen (GF 4 = Landfläche; Bodensee und Küstengewässer
  //    gehören zu keinem Land, ein Mittelpunkt dort fällt in die Toleranz der Gegenprobe) ──
  const { DatabaseSync } = await import('node:sqlite');
  const gpkgZip = unzip(raw.bkg);
  const gpkgName = [...gpkgZip.keys()].find(k => k.endsWith('.gpkg'))!;
  const tmp = join(RAW, 'vg250.gpkg');
  writeFileSync(tmp, gpkgZip.get(gpkgName)!);
  const db = new DatabaseSync(tmp, { readOnly: true });
  const gfs = db.prepare('SELECT GF, count(*) n FROM vg250_lan GROUP BY GF').all();
  console.log('vg250_lan GF:', JSON.stringify(gfs));
  const byLand = new Map<string, number[][][][]>();
  const featuresRaw = (db.prepare('SELECT ARS, GEN, GF, geom FROM vg250_lan WHERE GF = 4 ORDER BY ARS').all() as { ARS: string; GEN: string; GF: number; geom: Uint8Array }[]);
  for (const r of featuresRaw) byLand.set(r.ARS, [...(byLand.get(r.ARS) ?? []), ...gpkgToPolygons(r.geom)]);
  const features = [...byLand.entries()].map(([ars, coordinates]) => ({
    type: 'Feature',
    properties: { land: landByCode.get(ars), ars, name: DE_LAENDER.find(l => l.code === ars)!.name },
    geometry: { type: 'MultiPolygon', coordinates },
  }));
  db.close();
  const bkgStand = gpkgZip.get('dokumentation/aktualitaet.txt')?.toString('utf8').trim() ?? '';

  writeFileSync(join(ROOT, 'data', 'gemeinden-de.json'), JSON.stringify(gemeinden));
  writeFileSync(join(ROOT, 'data', 'plz-de.json'), JSON.stringify(plzOut));
  writeFileSync(join(DIR, 'laender-de.geojson'), JSON.stringify({ type: 'FeatureCollection', features }));
  const meta = {
    built_at: new Date().toISOString(),
    sources: {
      destatis: { url: SOURCES.destatis.url, license: SOURCES.destatis.license, gebietsstand: stand, sha256: sha256(raw.destatis) },
      geonames: { url: SOURCES.geonames.url, license: SOURCES.geonames.license, sha256: sha256(raw.geonames) },
      bkg: { url: SOURCES.bkg.url, license: SOURCES.bkg.license, stand: bkgStand, sha256: sha256(raw.bkg) },
    },
    counts: {
      gemeinden: gemeinden.length,
      plz: plzOut.length,
      plz_grosskunde: plzOut.filter(p => p.grosskunde).length,
      plz_ohne_gemeinde: plzOut.filter(p => !p.grosskunde && p.gemeinden.length === 0).length,
      plz_mehrere_gemeinden: plzOut.filter(p => p.gemeinden.length > 1).length,
      plz_mehrere_laender: plzOut.filter(p => p.laender.length > 1).length,
      geonames_orte_exakt: matchedExact,
      geonames_orte_stamm: matchedStem,
      laender_flaechen: features.length,
    },
  };
  writeFileSync(join(DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log(JSON.stringify(meta.counts));
}

main().catch(e => { console.error(e); process.exit(1); });
