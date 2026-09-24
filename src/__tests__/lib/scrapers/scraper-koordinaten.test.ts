import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Feste Koordinaten im Scraper-Code sind Ortsdaten außerhalb der Stammdatei.
// Befund 2026-09-24: 66 Venue-Koordinaten lagen 0,4 bis 7,5 km daneben, das
// Pappelstadion (Mattersburg) stand mit Linzer Koordinate unter
// Oberösterreich. Jede Koordinate muss deshalb in
// data/stammdaten/scraper-koordinaten.json stehen: gegen OSM geprüft, als
// Gebietsangabe gekennzeichnet oder ausdrücklich als ungeprüft mit Grund.

const ROOT = process.cwd();
const registry = JSON.parse(readFileSync(join(ROOT, 'data', 'stammdaten', 'scraper-koordinaten.json'), 'utf8')) as {
  koordinaten: Array<{ datei: string; lat: number; lng: number; status: 'osm' | 'gebiet' | 'ungeprueft'; quelle: string }>;
};

function scan(): Array<{ datei: string; line: number; lat: number; lng: number }> {
  const out: Array<{ datei: string; line: number; lat: number; lng: number }> = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!f.endsWith('.ts')) continue;
      const datei = relative(ROOT, p).split(sep).join('/');
      const lines = readFileSync(p, 'utf8').split('\n');
      lines.forEach((l, i) => {
        const re = /\b(?:lat|latitude)\s*:\s*(4[6-9]\.\d+)\s*,\s*(?:lng|lon|longitude)\s*:\s*(\d{1,2}\.\d+)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(l))) out.push({ datei, line: i + 1, lat: +m[1], lng: +m[2] });
        const m1 = l.match(/\b(?:lat|latitude)\s*:\s*(4[6-9]\.\d+)\s*,?\s*$/);
        const m2 = m1 && (lines[i + 1] ?? '').match(/\b(?:lng|lon|longitude)\s*:\s*(\d{1,2}\.\d+)/);
        if (m1 && m2) out.push({ datei, line: i + 1, lat: +m1[1], lng: +m2[1] });
      });
    }
  };
  walk(join(ROOT, 'src', 'lib', 'scrapers'));
  walk(join(ROOT, 'src', 'lib', 'eventim'));
  return out;
}

describe('Feste Koordinaten im Scraper-Code', () => {
  const imCode = scan();
  const key = (x: { datei: string; lat: number; lng: number }) => `${x.datei}|${x.lat}|${x.lng}`;

  it('jede Koordinate ist geprüft, als Gebiet gekennzeichnet oder mit Grund als ungeprüft eingetragen', () => {
    const bekannt = new Set(registry.koordinaten.map(key));
    const fehlend = imCode.filter(x => !bekannt.has(key(x))).map(x => `${x.datei}:${x.line} (${x.lat}, ${x.lng})`);
    expect(fehlend).toEqual([]);
  });

  it('die Liste enthält keine Koordinaten, die es im Code nicht mehr gibt', () => {
    const vorhanden = new Set(imCode.map(key));
    expect(registry.koordinaten.filter(x => !vorhanden.has(key(x))).map(key)).toEqual([]);
  });

  it('Gebietsangaben sind im Code als municipality gekennzeichnet', () => {
    const dateien = [...new Set(registry.koordinaten.filter(x => x.status === 'gebiet').map(x => x.datei))];
    const ohne = dateien.filter(d => !readFileSync(join(ROOT, d), 'utf8').includes("coords_precision: 'municipality'"));
    expect(ohne).toEqual([]);
  });

  it('ungeprüfte Koordinaten nennen einen Grund', () => {
    expect(registry.koordinaten.filter(x => x.status === 'ungeprueft' && !x.quelle.trim())).toEqual([]);
  });
});
