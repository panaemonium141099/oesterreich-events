import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findGemeindeDe, gemeindeDeByAgs, loadGemeindenDe } from '@/lib/gemeinden/de';
import { DE_LAENDER, deLandByKey } from '@/lib/gemeinden/laender-de';
import { deLandFromPolygon } from '@/lib/location/land-de-from-geo';
import { allPlzReferenceDeEntries, landForPlzDe, plzReferenceDe } from '@/lib/location/plz-reference-de';
import { bundeslandFromPolygon } from '@/lib/eventim/bundesland-from-geo';

// fn-29.1: Deutsche Ortsstammdaten im Ein-System. Eine Stammdatei je Land
// (Gemeinden, PLZ, Landflächen), gebaut aus Destatis, GeoNames und BKG
// (src/scripts/build-stammdaten-de.ts). Diese Tests halten die Verträge fest,
// auf die Resolver und Freigabevertrag für DE bauen.

const gemeinden = loadGemeindenDe();
const plz = allPlzReferenceDeEntries();
const LAND_IDS = new Set(DE_LAENDER.map(l => l.id));
const meta = JSON.parse(readFileSync(join(process.cwd(), 'data', 'stammdaten-de', 'meta.json'), 'utf8'));

describe('DE-Stammdaten: Gemeinden', () => {
  it('alle Gemeinden laut Destatis-Gebietsstand, Schlüssel eindeutig', () => {
    expect(gemeinden.length).toBe(meta.counts.gemeinden);
    expect(gemeinden.length).toBeGreaterThan(10_000);
    expect(new Set(gemeinden.map(g => g.ags)).size).toBe(gemeinden.length);
    expect(new Set(gemeinden.map(g => g.ars)).size).toBe(gemeinden.length);
  });

  it('Schlüssel, Land und Kreis passen zusammen', () => {
    const bad = gemeinden.filter(g =>
      !/^\d{8}$/.test(g.ags) || !/^\d{12}$/.test(g.ars) ||
      deLandByKey(g.ags)?.id !== g.land || !g.ags.startsWith(g.kreisKey) || !g.ars.startsWith(g.kreisKey) || !g.kreis,
    );
    expect(bad.map(g => g.nameAmtlich)).toEqual([]);
  });

  it('Verband nur mit Schlüssel und Namen, Schlüssel ist Präfix des ARS', () => {
    const bad = gemeinden.filter(g => (g.verbandKey === null) !== (g.verband === null) || (g.verbandKey && !g.ars.startsWith(g.verbandKey)));
    expect(bad.map(g => g.nameAmtlich)).toEqual([]);
  });

  it('jeder Mittelpunkt liegt in der Landfläche des eigenen Landes (keine Platzhalter)', () => {
    const bad = gemeinden.filter(g => deLandFromPolygon(g.lat, g.lng) !== g.land);
    expect(bad.map(g => `${g.name} (${g.land})`)).toEqual([]);
  });

  it('jede Gemeinde hat ihre Amts-PLZ in plzAll, alle PLZ fünfstellig', () => {
    const bad = gemeinden.filter(g => !/^\d{5}$/.test(g.plz) || !g.plzAll.includes(g.plz) || g.plzAll.some(p => !/^\d{5}$/.test(p)));
    expect(bad.map(g => g.nameAmtlich)).toEqual([]);
  });

  it('Suche über Schlüssel, sonst nur eindeutige Namen im Land', () => {
    expect(gemeindeDeByAgs('07137088')?.name).toBe('Plaidt');
    expect(findGemeindeDe({ name: 'Gedern', land: 'hessen' })?.ags).toBe('06440009');
    // Mehrdeutig in Bayern: kein Raten.
    const hausen = gemeinden.filter(g => g.land === 'bayern' && g.name === 'Hausen');
    expect(hausen.length).toBeGreaterThan(1);
    expect(findGemeindeDe({ name: 'Hausen', land: 'bayern' })).toBeNull();
  });
});

describe('DE-Stammdaten: PLZ', () => {
  const byAgs = new Map(gemeinden.map(g => [g.ags, g]));

  it('PLZ fünfstellig, eindeutig, Länder und Gemeinden bekannt', () => {
    expect(new Set(plz.map(p => p.plz)).size).toBe(plz.length);
    const bad = plz.filter(p => !/^\d{5}$/.test(p.plz) || p.laender.some(l => !LAND_IDS.has(l)) || p.gemeinden.some(a => !byAgs.has(a)));
    expect(bad.map(p => p.plz)).toEqual([]);
  });

  it('PLZ und Gemeinde verweisen gegenseitig aufeinander', () => {
    const bad: string[] = [];
    for (const p of plz) for (const a of p.gemeinden) if (!byAgs.get(a)!.plzAll.includes(p.plz)) bad.push(`${p.plz}→${a}`);
    for (const g of gemeinden) for (const p of g.plzAll) if (!plzReferenceDe(p)?.gemeinden.includes(g.ags)) bad.push(`${g.ags}→${p}`);
    expect(bad).toEqual([]);
  });

  it('Großkunden-PLZ belegen keinen Ort und kein Land', () => {
    const gk = plz.filter(p => p.grosskunde);
    expect(gk.length).toBeGreaterThan(0);
    expect(gk.filter(p => p.orte.length > 0).map(p => p.plz)).toEqual([]);
    for (const p of gk.slice(0, 50)) expect(landForPlzDe(p.plz)).toBeNull();
  });

  it('PLZ über eine Landesgrenze bleibt mehrdeutig', () => {
    // 07919 (Kirschkau in Thüringen, Mühltroff in Sachsen) laut GeoNames
    const e = plzReferenceDe('07919');
    expect(e?.laender).toEqual(['sachsen', 'thueringen']);
    expect(landForPlzDe('07919')).toBeNull();
    expect(landForPlzDe('56637')).toBe('rheinland-pfalz');
  });
});

describe('DE-Stammdaten: Landflächen', () => {
  it('16 Länder, Punkte außerhalb Deutschlands ohne Land', () => {
    const geo = JSON.parse(readFileSync(join(process.cwd(), 'data', 'stammdaten-de', 'laender-de.geojson'), 'utf8'));
    expect(geo.features.map((f: { properties: { land: string } }) => f.properties.land).sort()).toEqual([...LAND_IDS].sort());
    expect(deLandFromPolygon(48.2082, 16.3738)).toBeNull(); // Wien
    expect(deLandFromPolygon(47.0707, 15.4395)).toBeNull(); // Graz
    expect(deLandFromPolygon(52.52, 13.405)).toBe('berlin');
  });

  it('deutsche und österreichische Flächen überschneiden sich nicht an Gemeindemittelpunkten', () => {
    const bad = gemeinden.filter(g => bundeslandFromPolygon(g.lat, g.lng) !== null);
    expect(bad.map(g => g.name)).toEqual([]);
  });

  it('Quellen und Lizenzen sind dokumentiert', () => {
    for (const s of ['destatis', 'geonames', 'bkg']) {
      expect(meta.sources[s].license).toBeTruthy();
      expect(meta.sources[s].sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
