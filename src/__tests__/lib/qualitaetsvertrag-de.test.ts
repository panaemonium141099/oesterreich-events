/**
 * Qualitätsvertrag DE (fn-29.2): Freigabevertrag, Resolver und Schreibweg
 * gelten für deutsche Events nach denselben Regeln wie für österreichische.
 * Fälle aus dem Prod-Bestand vom 2026-10-28 (8.403 künftige DE-Zeilen von
 * Eventim und Eventfrog) und aus der DE-Vollerhebung.
 */
import { describe, expect, it } from 'vitest';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import { evaluateAdmission } from '@/lib/quality/admission';
import { municipalServiceKind } from '@/lib/category-classifier/municipal-service';
import { deLandToId } from '@/lib/gemeinden/laender-de';
import { plzRegionOfCountry, regionOfCountry } from '@/lib/location/ortsdaten';
import type { ScrapedEvent } from '@/types/events';

const base = {
  source_name: 'eventfrog',
  source_id: 'de-1',
  source_url: 'https://eventfrog.de/x',
  title: 'Konzert',
  start_date: '2027-03-01T18:00:00.000Z',
  country: 'DE',
} as ScrapedEvent;

type Row = {
  bundesland: string | null;
  district: string | null;
  postal_code: string | null;
  latitude: number | null;
  location_status: string;
  publish_status: string;
  location_resolution: { gemeinde: { name: string; bundesland: string; bezirk: string | null } | null; admission?: { decision: string; reasons: string[] } };
};
const rowOf = (e: Partial<ScrapedEvent>) => toSupabaseRow({ ...base, ...e } as ScrapedEvent, new Map(), new Map()).row as unknown as Row;
const opts = { regionOf: regionOfCountry, plzRegionOf: plzRegionOfCountry, now: new Date('2026-10-28T12:00:00Z') };

describe('Freigabevertrag DE', () => {
  it('DE-Event mit Koordinate in Wien: Quarantäne (Prod: „Wiener Stadthalle", Eventfrog, country DE)', () => {
    const v = evaluateAdmission({ title: 'Konzert', start_date: '2027-03-01T18:00:00Z', location_name: 'Wiener Stadthalle', country: 'DE', latitude: 48.2024, longitude: 16.3329 }, opts);
    expect(v.decision).toBe('quarantine');
    expect(v.reasons).toContain('coords_outside_declared_country');
  });

  it('Land-Gegenprobe per Polygon: Label falsch, PLZ stützt die Koordinate → Label korrigiert', () => {
    // Plaidt (56637) liegt in Rheinland-Pfalz, die Quelle behauptet Hessen.
    const v = evaluateAdmission(
      { title: 'Feuerwehrfest', start_date: '2027-07-11T12:00:00Z', location_name: 'Feuerwehr Plaidt', postal_code: '56637', bundesland: 'hessen', country: 'DE', latitude: 50.391, longitude: 7.391 },
      opts,
    );
    expect(v.decision).toBe('admit');
    expect(v.corrections).toContain('use_coordinate_region');
    expect(v.correctedBundesland).toBe('rheinland-pfalz');
  });

  it('Land-Gegenprobe: PLZ stützt das Label → Koordinate ist der Ausreißer', () => {
    // Gedern (63688, Hessen); Koordinate in Bayern.
    const v = evaluateAdmission(
      { title: 'Weihnachtsmarkt', start_date: '2026-12-12T15:00:00Z', location_name: 'Schlosshof', postal_code: '63688', bundesland: 'hessen', country: 'DE', latitude: 49.45, longitude: 11.08 },
      opts,
    );
    expect(v.corrections).toContain('drop_coordinates');
  });

  it('US-Adresse in einem DE-Event: Quarantäne', () => {
    const v = evaluateAdmission({ title: 'Meetup', start_date: '2027-03-01T18:00:00Z', location_name: 'Office', address: '233 S Wacker Dr, Chicago, IL', country: 'DE' }, opts);
    expect(v.reasons).toContain('foreign_place_signal');
  });

  it('Österreich unverändert: Koordinate in Deutschland bei AT-Event bleibt Quarantäne', () => {
    const v = evaluateAdmission({ title: 'Konzert', start_date: '2027-03-01T18:00:00Z', location_name: 'Halle', country: 'AT', latitude: 50.39, longitude: 7.39 }, opts);
    expect(v.reasons).toContain('coords_outside_declared_country');
  });
});

describe('Schreibweg DE', () => {
  it('PLZ und Gemeinde aus den DE-Stammdaten; Spalten bundesland/district bleiben leer (CHECK/FK nur AT)', () => {
    const row = rowOf({ location_name: 'Feuerwehr Plaidt', address: 'Hauptstraße 1, 56637 Plaidt', bundesland: 'Rheinland-Pfalz' });
    expect(row.postal_code).toBe('56637');
    expect(row.location_resolution.gemeinde).toMatchObject({ name: 'Plaidt', bundesland: 'rheinland-pfalz', bezirk: 'Mayen-Koblenz' });
    expect(row.bundesland).toBeNull();
    expect(row.district).toBeNull();
    expect(row.location_status).toBe('municipality_only');
    expect(row.latitude).not.toBeNull();
  });

  it('kein österreichisches Bundesland an einer DE-Zeile (Prod: 3 DE-Zeilen mit „niederoesterreich")', () => {
    expect(rowOf({ location_name: 'Riegler', bundesland: 'Niederösterreich' }).bundesland).toBeNull();
  });

  it('Koordinate in Wien bei DE-Event: keine Position, nicht öffentlich', () => {
    const row = rowOf({ location_name: 'Wiener Stadthalle', city: 'Wien', latitude: 48.2024, longitude: 16.3329, coords_precision: 'venue' });
    expect(row.latitude).toBeNull();
    expect(row.publish_status).not.toBe('published');
  });

  it('Gemeinde-Dienst aus einem DE-Kalender: Quarantäne', () => {
    const row = rowOf({ title: 'Gelber Sack Abfuhr', location_name: 'Plaidt', postal_code: '56637' });
    expect(row.location_resolution.admission?.reasons).toContain('municipal_service');
    expect(row.publish_status).not.toBe('published');
  });

  it('Österreich unverändert: Bundesland und Bezirk aus der Gemeinde', () => {
    const row = rowOf({ country: 'AT', location_name: 'Wiener Stadthalle', address: 'Roland-Rainer-Platz 1, 1150 Wien' });
    expect(row.bundesland).toBe('wien');
  });
});

describe('Gemeinde-Dienste DE', () => {
  // Echte Titel aus DE-Kalendern (Cross7 Obermarchtal/Amtzell/Hüttlingen/Meitingen/
  // Trendelburg, NOLIS Bruchhausen-Vilsen, Abruf 2026-10-28) und deutsche
  // Entsprechungen bestehender AT-Begriffe.
  it.each([
    ['Altpapiersammlung der Vereine', 'waste'],
    ['Biomüll', 'waste'],
    ['Gelber Sack Abfuhr', 'waste'],
    ['Restmülltonne', 'waste'],
    ['Papiersammlung GH/LH', 'waste'],
    ['Restabfall', 'waste'],
    ['Abfuhr Restabfall', 'waste'],
    ['Blaue Tonne', 'waste'],
    ['Leerung Blaue Tonne', 'waste'],
    ['Schadstoffmobil', 'waste'],
    ['Problemabfallsammlung', 'waste'],
    ['Weihnachtsbaumabholung', 'waste'],
    ['Abholung der Weihnachtsbäume', 'waste'],
    ['Häckselplatz geöffnet', 'waste'],
    ['Bürgersprechstunde', 'consultation'],
  ])('%s → %s', (title, kind) => {
    expect(municipalServiceKind(title)).toBe(kind);
  });

  it.each(['Grünkohl für Holland', 'Kirmes Schletzenhausen', 'Weihnachtsmarkt', 'Blaue Stunde im Museum', 'Christbaumverkauf der Feuerwehr'])('kein Gemeinde-Dienst: %s', title => {
    expect(municipalServiceKind(title)).toBeNull();
  });
});

describe('Land-IDs DE', () => {
  it.each([
    ['Bayern', 'bayern'], ['NRW', 'nordrhein-westfalen'], ['Baden-Württemberg', 'baden-wuerttemberg'],
    ['Baden-Wuerttemberg', 'baden-wuerttemberg'], ['thüringen', 'thueringen'], ['ST', 'sachsen-anhalt'], ['Wien', null],
  ])('%s → %s', (raw, id) => {
    expect(deLandToId(raw)).toBe(id);
  });
});

describe('Bestand DE ohne Rohwerte', () => {
  it('Anzeige-PLZ einer Altzeile außerhalb AT belegt keine Gemeinde (Prod: Eventim „Haus im Ennstal", PLZ 38118)', async () => {
    const { inputFromStoredRow } = await import('@/lib/location/re-resolve');
    const input = inputFromStoredRow({
      id: 'x', title: 'Hardline', location_name: 'Haus im Ennstal', postal_code: '38118', country: 'DE',
      address: null, bundesland: null, district: null, latitude: null, longitude: null,
    } as unknown as Parameters<typeof inputFromStoredRow>[0]);
    expect(input.postal_code).toBeNull();
    const at = inputFromStoredRow({
      id: 'y', title: 'Konzert', location_name: 'Stadthalle', postal_code: '1150', country: 'AT',
      address: null, bundesland: null, district: null, latitude: null, longitude: null,
    } as unknown as Parameters<typeof inputFromStoredRow>[0]);
    expect(at.postal_code).toBe('1150');
  });
});
