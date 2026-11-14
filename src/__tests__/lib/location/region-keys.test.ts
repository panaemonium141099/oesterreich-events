/**
 * Regionsschlüssel (fn-31.6): Land, Kreis bzw. Bezirk und Gemeinde aus der
 * Gemeinde der Ortsentscheidung. Echte Fälle aus Prod (14.11.2026) gegen die
 * amtlichen Stammdateien.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { regionKeys } from '@/lib/location/region-keys';
import { gemeindeDeByAgs } from '@/lib/gemeinden/de';
import { loadGemeindenMaster } from '@/lib/gemeinden/data';

const g = (name: string, plz: string, bundesland: string, bezirk: string | null) => ({ name, plz, bundesland, bezirk });

describe('Deutschland', () => {
  it('eindeutiger Name im Land', () => {
    expect(regionKeys('DE', g('Aach', '78267', 'baden-wuerttemberg', 'Konstanz'))).toEqual({
      region_id: 'baden-wuerttemberg', kreis_key: '08335', gemeinde_key: '08335001',
    });
    expect(regionKeys('DE', g('Aachen', '52058', 'nordrhein-westfalen', 'Städteregion Aachen'))).toEqual({
      region_id: 'nordrhein-westfalen', kreis_key: '05334', gemeinde_key: '05334002',
    });
  });

  it('gleichnamige Gemeinden im Land: der Kreis entscheidet (vier „Hausen“ in Bayern)', () => {
    expect(regionKeys('DE', g('Hausen', '93345', 'bayern', 'Kelheim')).gemeinde_key).toBe('09273125');
    expect(regionKeys('DE', g('Hausen', '91353', 'bayern', 'Forchheim')).gemeinde_key).toBe('09474134');
  });

  it('ohne Kreis entscheidet die PLZ', () => {
    expect(regionKeys('DE', g('Hausen', '97647', 'bayern', null))).toEqual({
      region_id: 'bayern', kreis_key: '09673', gemeinde_key: '09673129',
    });
  });

  it('bleibt es mehrdeutig, ist die Gemeinde NULL, nie geraten', () => {
    // Kein Kreis, keine passende PLZ: vier Kandidaten in vier Kreisen.
    expect(regionKeys('DE', g('Hausen', '00000', 'bayern', null))).toEqual({
      region_id: 'bayern', kreis_key: null, gemeinde_key: null,
    });
    // Garding Stadt und Kirchspiel Garding: gleicher Name, Kreis und PLZ.
    expect(regionKeys('DE', g('Garding', '25836', 'schleswig-holstein', 'Nordfriesland'))).toEqual({
      region_id: 'schleswig-holstein', kreis_key: '01054', gemeinde_key: null,
    });
  });

  it('Land in der Schreibweise der Quelle', () => {
    expect(regionKeys('DE', g('Aach', '78267', 'Baden-Württemberg', 'Konstanz')).region_id).toBe('baden-wuerttemberg');
  });

  it('jeder gelieferte Schlüssel steht in der Stammdatei, der Kreis ist der Anfang der AGS', () => {
    const k = regionKeys('DE', g('Aachen', '52058', 'nordrhein-westfalen', null));
    expect(gemeindeDeByAgs(k.gemeinde_key!)?.name).toBe('Aachen');
    expect(k.gemeinde_key!.startsWith(k.kreis_key!)).toBe(true);
  });
});

describe('Österreich', () => {
  it('Kennziffer, Bezirk als ihre ersten drei Stellen, Bundesland-ID', () => {
    expect(regionKeys('AT', g('Eisenstadt', '7000', 'burgenland', 'Eisenstadt'))).toEqual({
      region_id: 'burgenland', kreis_key: '101', gemeinde_key: '10101',
    });
    expect(regionKeys('AT', g('Wien', '1010', 'wien', null))).toEqual({
      region_id: 'wien', kreis_key: '900', gemeinde_key: '90001',
    });
    expect(regionKeys('AT', g('Irdning-Donnersbachtal', '8952', 'Steiermark', 'Liezen'))).toEqual({
      region_id: 'steiermark', kreis_key: '612', gemeinde_key: '61257',
    });
  });

  it('unbekannte Gemeinde: nur das Land', () => {
    expect(regionKeys('AT', g('Gibtsnicht', '9999', 'tirol', null))).toEqual({
      region_id: 'tirol', kreis_key: null, gemeinde_key: null,
    });
  });

  it('der Schlüssel steht in der Stammdatei', () => {
    const gkz = regionKeys('AT', g('Eisenstadt', '7000', 'burgenland', null)).gemeinde_key;
    expect(loadGemeindenMaster().some(m => m.gkz === gkz)).toBe(true);
  });
});

describe('ohne Grundlage', () => {
  const NONE = { region_id: null, kreis_key: null, gemeinde_key: null };

  it('keine Gemeinde, leeres Land oder ein Land ohne Stammdaten: alle drei NULL', () => {
    expect(regionKeys('DE', null)).toEqual(NONE);
    expect(regionKeys('AT', undefined)).toEqual(NONE);
    expect(regionKeys('DE', g('Aach', '78267', '', null))).toEqual(NONE);
    expect(regionKeys('CH', g('Zürich', '8001', 'zuerich', null))).toEqual(NONE);
    expect(regionKeys(null, g('Wien', '1010', 'wien', null))).toEqual(NONE);
  });

  it('ein deutsches Land ist nie ein österreichisches und umgekehrt', () => {
    expect(regionKeys('AT', g('Aach', '78267', 'baden-wuerttemberg', null))).toEqual(NONE);
    expect(regionKeys('DE', g('Wien', '1010', 'wien', null))).toEqual(NONE);
  });
});

describe('jeder Schreiber der Ortsentscheidung schreibt auch die Schlüssel', () => {
  it('wer location_resolution schreibt, ruft regionKeys', () => {
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) { if (e.name !== '__tests__') walk(p, out); }
        else if (/\.ts$/.test(e.name)) out.push(p);
      }
      return out;
    };
    // Ein Schreiber setzt die Entscheidung als Ganzes: `location_resolution: { ...decision` bzw. `decision as`.
    const WRITE = /location_resolution:\s*(\{\s*\.\.\.(decision|\(parent)|decision as|locationResolution,)/;
    const ohne = walk('src/lib')
      .filter(f => WRITE.test(readFileSync(f, 'utf8')))
      .filter(f => !/regionKeys\(/.test(readFileSync(f, 'utf8')));
    expect(ohne).toEqual([]);
  });
});
