/** fn-25 C5: Ausspielung nach Wissensstand. */
import { describe, it, expect } from 'vitest';
import { locationOutputs } from '@/lib/location/gating';
import { buildJsonLd } from '@/lib/seo/event-jsonld';
import type { Event } from '@/types/events';

const at = { latitude: 48.2, longitude: 16.37 };

describe('locationOutputs (Schalter an)', () => {
  const on = { enforce: true };
  it('belegte Position: Pin, Route, Distanz', () => {
    expect(locationOutputs({ ...at, location_status: 'venue_confirmed', location_resolution: { allowed: { pin: true, route: true, distance: true, municipality_page: true } } }, on))
      .toEqual({ pin: true, route: true, distance: true, municipality_page: true, approximate: false });
  });
  it('Gemeinde-Mittelpunkt: nur Gemeindeseite, kein Pin, keine Distanz', () => {
    const o = locationOutputs({ ...at, location_status: 'municipality_only', location_resolution: { allowed: { pin: false, route: false, distance: false, municipality_page: true } } }, on);
    expect(o).toEqual({ pin: false, route: false, distance: false, municipality_page: true, approximate: true });
  });
  it('Konflikt: nichts', () => {
    expect(locationOutputs({ location_status: 'conflict', location_resolution: { allowed: { pin: false, route: false, distance: false, municipality_page: false } } }, on).municipality_page).toBe(false);
  });
  it('Altzeile ohne Entscheidung: ungefähr, außer manual/json-ld-venue', () => {
    expect(locationOutputs({ ...at, geocoding_confidence: 'scraper' }, on).pin).toBe(false);
    expect(locationOutputs({ ...at, geocoding_confidence: 'exact' }, on).pin).toBe(false);
    expect(locationOutputs({ ...at, geocoding_confidence: 'manual' }, on)).toMatchObject({ pin: true, route: true, distance: true });
  });
  it('Straßen-Genauigkeit: Pin ja, Route nein', () => {
    const o = locationOutputs({ ...at, location_status: 'address_confirmed', location_resolution: { allowed: { pin: true, route: false, distance: true, municipality_page: true } } }, on);
    expect(o.pin).toBe(true);
    expect(o.route).toBe(false);
  });
});

describe('locationOutputs (Schalter aus, Übergang)', () => {
  it('Pin/Distanz wie bisher bei Koordinate, Route weiterhin nur mit Beleg, Kennzeichnung bleibt', () => {
    const o = locationOutputs({ ...at, location_status: 'municipality_only', location_resolution: { allowed: { pin: false, route: false, distance: false, municipality_page: true } } }, { enforce: false });
    expect(o).toEqual({ pin: true, route: false, distance: true, municipality_page: true, approximate: true });
  });
});

describe('JSON-LD geo folgt dem Gating', () => {
  const base = {
    id: '00000000-0000-0000-0000-000000000001', title: 'Test', description: 'x', start_date: '2027-05-01T18:00:00Z', end_date: null,
    location_name: 'Gemeindesaal', address: null, postal_code: '7000', bundesland: 'burgenland', district: null,
    latitude: 47.85, longitude: 16.52, category: 'Musik', price_text: null, price_min: null, price_max: null,
    image_url: null, organizer: null, tags: null, source_id: 'x', source_name: 'test', source_url: null, slug: 'test',
  } as unknown as Event;

  it('ohne Schalter: geo wie bisher', () => {
    const prev = process.env.NEXT_PUBLIC_LOCATION_GATING;
    delete process.env.NEXT_PUBLIC_LOCATION_GATING;
    const ld = JSON.parse(buildJsonLd(base)) as { location: { geo?: unknown } };
    expect(ld.location.geo).toBeDefined();
    if (prev !== undefined) process.env.NEXT_PUBLIC_LOCATION_GATING = prev;
  });

  it('mit Schalter: Gemeinde-Mittelpunkt liefert keine GeoCoordinates, Adresse bleibt', () => {
    const prev = process.env.NEXT_PUBLIC_LOCATION_GATING;
    process.env.NEXT_PUBLIC_LOCATION_GATING = '1';
    const ev = { ...base, location_status: 'municipality_only', location_resolution: { allowed: { pin: false, route: false, distance: false, municipality_page: true } } } as unknown as Event;
    const ld = JSON.parse(buildJsonLd(ev)) as { location: { geo?: unknown; address?: unknown } };
    expect(ld.location.geo).toBeUndefined();
    expect(ld.location.address).toBeDefined();
    if (prev === undefined) delete process.env.NEXT_PUBLIC_LOCATION_GATING; else process.env.NEXT_PUBLIC_LOCATION_GATING = prev;
  });
});
