/** fn-25 B3: Genauigkeits-Policy je Quelle. */
import { describe, it, expect } from 'vitest';
import { applySourceCoordsPolicy, demotePlaceholderCoords } from '@/lib/scrapers/source-coords-policy';
import type { ScrapedEvent } from '@/types/events';

const ev = (over: Partial<ScrapedEvent>): ScrapedEvent => ({
  source_name: 'x', source_id: '1', source_url: null, title: 't', start_date: '2027-01-01T20:00:00+01:00', ...over,
});

describe('applySourceCoordsPolicy', () => {
  it('Club-/Museums-Koordinaten sind Venue-Koordinaten', () => {
    expect(applySourceCoordsPolicy(ev({ source_name: 'wien-clubs', latitude: 48.2, longitude: 16.3 })).coords_precision).toBe('venue');
    expect(applySourceCoordsPolicy(ev({ source_name: 'boudicca:posthof', latitude: 48.3, longitude: 14.3 })).coords_precision).toBe('venue');
  });
  it('Stadtkalender: Stadtmittelpunkt ist Gebietsangabe, Stadt wird Kontext', () => {
    const e = applySourceCoordsPolicy(ev({ source_name: 'falter', latitude: 48.2082, longitude: 16.3738 }));
    expect(e.coords_precision).toBe('municipality');
    expect(e.city).toBe('Wien');
  });
  it('Regionsmittelpunkte werden als solche markiert (der Schreibpfad verwirft sie als Position)', () => {
    expect(applySourceCoordsPolicy(ev({ source_name: 'tourismus-portale', latitude: 47.7, longitude: 13.6 })).coords_precision).toBe('region');
  });
  it('überschreibt keine Adapter-Angabe und erfindet ohne Koordinaten keine', () => {
    expect(applySourceCoordsPolicy(ev({ source_name: 'falter', latitude: 48.2, longitude: 16.3, coords_precision: 'venue' })).coords_precision).toBe('venue');
    expect(applySourceCoordsPolicy(ev({ source_name: 'wien-clubs' })).coords_precision).toBeUndefined();
    expect(applySourceCoordsPolicy(ev({ source_name: 'unbekannt', latitude: 48.2, longitude: 16.3 })).coords_precision).toBeUndefined();
  });
});

describe('demotePlaceholderCoords: Stadtmittelpunkt als „Venue-Koordinate" vieler Spielstätten', () => {
  const at = (id: string, venue: string, street: string, lat = 48.209, lng = 16.37): ScrapedEvent =>
    ev({ source_name: 'Eventim', source_id: id, location_name: venue, source_venue_id: `eventim:${venue}`, address: street, postal_code: '1010', latitude: lat, longitude: lng, coords_precision: 'venue' });

  it('drei Spielstätten mit drei Straßen auf einem Punkt → Gebietsangabe (municipality), Position bleibt', () => {
    const r = demotePlaceholderCoords([
      at('1', 'Akademietheater', 'Lisztstraße 1'), at('2', 'Stephansdom', 'Stephansplatz 3'), at('3', 'Künstlerhaus', 'Karlsplatz 5'), at('4', 'Akademietheater', 'Lisztstraße 1'),
      at('5', 'Posthof', 'Posthofstraße 43', 48.3119, 14.3117),
    ]);
    expect(r.demoted).toBe(4);
    expect(r.groups).toEqual([{ key: '48.20900,16.37000', venues: 3, streets: 3, stems: 3, events: 4 }]);
    expect(r.events.slice(0, 4).every(e => e.coords_precision === 'municipality' && e.latitude === 48.209)).toBe(true);
    expect(r.events[4].coords_precision).toBe('venue');
  });

  it('Säle desselben Hauses (gleiche Straße) bleiben Venue-Koordinaten', () => {
    const r = demotePlaceholderCoords([
      at('1', 'POSTHOF - Großer Saal', 'Posthofstraße 43', 48.3119, 14.3117), at('2', 'POSTHOF - Kleiner Saal', 'Posthofstraße 43', 48.3119, 14.3117),
      at('3', 'POSTHOF - FrischLuft-Bühne', 'Posthofstr. 43', 48.3119, 14.3117), at('4', 'Posthof Linz', 'Posthofstraße 43, Linz', 48.3119, 14.3117),
    ]);
    expect(r.demoted).toBe(0);
    expect(r.events.every(e => e.coords_precision === 'venue')).toBe(true);
  });

  it('ohne Adressen entscheidet der Namensstamm (Feratel): Ortsmittelpunkt für viele Orte → Gebietsangabe, Säle eines Schlosses bleiben', () => {
    const fer = (id: string, place: string, lat = 48.039, lng = 14.41913): ScrapedEvent =>
      ev({ source_name: 'feratel-deskline', source_id: id, location_name: place, city: 'Steyr', latitude: lat, longitude: lng, coords_precision: 'venue' });
    const steyr = demotePlaceholderCoords([fer('1', 'Altes Theater'), fer('2', 'Kirche Münichholz'), fer('3', 'Historische Schmiede'), fer('4', 'Altes Theater')]);
    expect(steyr.demoted).toBe(4);
    expect(steyr.groups[0]).toMatchObject({ venues: 3, streets: 0, stems: 3 });
    const schloss = demotePlaceholderCoords([
      fer('1', 'Schloss Esterházy', 47.84626, 16.51944), fer('2', 'Schloss Esterházy, Empiresaal', 47.84626, 16.51944), fer('3', 'Schloss Esterházy, Haydnsaal', 47.84626, 16.51944),
    ]);
    expect(schloss.demoted).toBe(0);
    const stadthalle = demotePlaceholderCoords([
      fer('1', 'Wiener Stadthalle', 48.2019, 16.3311), fer('2', 'Wiener Stadthalle Halle D', 48.2019, 16.3311), fer('3', 'Wiener Stadthalle - Halle F', 48.2019, 16.3311),
    ]);
    expect(stadthalle.demoted).toBe(0);
  });

  it('Koordinaten ohne Genauigkeitsanspruch werden nicht bewertet; unter drei Spielstätten nie', () => {
    const unknown = [at('1', 'A', 'X-Gasse 1'), at('2', 'B', 'Y-Gasse 2'), at('3', 'C', 'Z-Gasse 3')].map(e => ({ ...e, coords_precision: undefined }));
    expect(demotePlaceholderCoords(unknown).demoted).toBe(0);
    expect(demotePlaceholderCoords([at('1', 'A', 'X-Gasse 1'), at('2', 'B', 'Y-Gasse 2')]).demoted).toBe(0);
  });
});
