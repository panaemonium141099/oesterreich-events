/**
 * fn-25 B3: Gemeinde-Kalender liefern Kontext, keinen Veranstaltungsort.
 */
import { describe, it, expect } from 'vitest';
import { applyGemeindeContext, isRegionLabel } from '@/lib/scrapers/gemeinde-context';
import { resolveConservativeLocation } from '@/lib/location/conservative-resolution';
import type { ScrapedEvent } from '@/types/events';

const berg = { name: 'Berg', plz: '2413', lat: 48.1015, lng: 17.0384, bundesland: 'Niederösterreich', bezirk: 'Bruck an der Leitha' };
const base = (over: Partial<ScrapedEvent> = {}): ScrapedEvent => ({
  source_name: 'gemeinde-registry', source_id: 'x', source_url: 'https://www.berg.gv.at/x',
  title: 'Striezelspiel', start_date: '2027-11-05T18:00:00+01:00', ...over,
});

describe('applyGemeindeContext', () => {
  it('Gemeindename als Ersatz-Venue wird entfernt, Gemeinde wird Kontext, Mittelpunkt ist Gebietsangabe', () => {
    const e = applyGemeindeContext(base({ location_name: 'Berg', address: 'Hauptstraße 23' }), berg);
    expect(e.location_name).toBeUndefined();
    expect(e.city).toBe('Berg');
    expect(e.postal_code).toBe('2413');
    expect(e.latitude).toBe(berg.lat);
    expect(e.coords_precision).toBe('municipality');
    expect(e.bundesland).toBe('Niederösterreich');
  });

  it('ein echter Venue-Name bleibt; eigene Koordinaten gelten als Venue-Koordinaten', () => {
    const e = applyGemeindeContext(base({ location_name: 'Gemeindesaal', latitude: 48.1, longitude: 17.04 }), berg);
    expect(e.location_name).toBe('Gemeindesaal');
    expect(e.coords_precision).toBe('venue');
    expect(e.latitude).toBe(48.1);
  });

  it('nennt die Adresse eine andere PLZ, zählt die Adresse und nicht der Kalender', () => {
    const e = applyGemeindeContext(base({ location_name: 'Schloss Hof', address: 'Hainburger Straße 1, 2460 Bruck an der Leitha' }), berg);
    expect(e.postal_code).toBe('2460');
    expect(e.city).toBeUndefined();
    expect(e.latitude).toBeUndefined();
    expect(e.coords_precision).toBeUndefined();
  });

  it('Bundesland-Label ist kein Veranstaltungsort', () => {
    expect(isRegionLabel('Tirol')).toBe(true);
    expect(isRegionLabel('Tiroler Landestheater')).toBe(false);
    const e = applyGemeindeContext(base({ location_name: 'Niederösterreich' }), berg);
    expect(e.location_name).toBeUndefined();
  });

  it('Ende-zu-Ende: Marktgemeinde Berg (NÖ) landet nicht in Berg im Drautal', () => {
    const e = applyGemeindeContext(base({ location_name: 'Berg', address: 'Hauptstraße 23' }), berg);
    const d = resolveConservativeLocation(e, new Date('2026-09-13T12:00:00Z'));
    expect(d.status).toBe('municipality_only');
    expect(d.gemeinde?.name).toBe('Berg');
    expect(d.gemeinde?.bundesland).toBe('niederoesterreich');
    expect(d.location_name).toBe('Berg');
    expect(d.provenance.location_name).toBe('registry');
    expect(d.latitude).toBeCloseTo(48.1, 1);
    expect(d.longitude).toBeCloseTo(17.04, 1);
    expect(d.allowed.pin).toBe(false);
  });
});

describe('Adresse in fremder PLZ-Region ist Beiwerk der Seite (Linz/Schlachthausgasse 1030, Prod 2026-09-14)', () => {
  const linz = { name: 'Linz', plz: '4020', bundesland: 'oberoesterreich', bezirk: 'Linz (Stadt)', lat: 48.3064, lng: 14.2858 };
  it('Wiener Datenschutz-Adresse auf einer Linzer Kalenderseite fällt weg, Kalender-Kontext bleibt', () => {
    const e = applyGemeindeContext({ source_name: 'gemeinden-generic', source_id: '1', source_url: null, title: 'Orgelvesper', start_date: '2027-01-01T18:00:00+01:00', address: 'Schlachthausgasse 52/8', postal_code: '1030', city: 'Wien' }, linz);
    expect(e.address).toBeUndefined();
    expect(e.postal_code).toBe('4020');
    expect(e.city).toBe('Linz');
    expect(e.coords_precision).toBe('municipality');
  });
  it('Nachbargemeinde derselben Region bleibt als Angabe der Quelle', () => {
    const e = applyGemeindeContext({ source_name: 'gemeinden-generic', source_id: '2', source_url: null, title: 'Fest', start_date: '2027-01-01T18:00:00+01:00', address: 'Hauptplatz 1, 4050 Traun' }, linz);
    expect(e.postal_code).toBe('4050');
    expect(e.address).toBe('Hauptplatz 1, 4050 Traun');
  });
});
