import { describe, it, expect } from 'vitest';
import { buildOebbScottyUrl, buildBookingUrl, deriveAccommodationCity } from '@/lib/plans/deep-links';

const event = {
  location_name: 'Wiener Stadthalle',
  address: 'Roland-Rainer-Platz 1',
  bundesland: 'wien',
  start_date: '2026-06-15T20:00:00.000Z',
};

describe('buildOebbScottyUrl', () => {
  it('builds an ÖBB Scotty URL with start, dest, date, time', () => {
    const url = buildOebbScottyUrl(event, 'Wien Hbf', '2026-06-15');
    const u = new URL(url);
    expect(u.hostname).toBe('fahrplan.oebb.at');
    expect(u.searchParams.get('S')).toBe('Wien Hbf');
    expect(u.searchParams.get('Z')).toContain('Wiener Stadthalle');
    expect(u.searchParams.get('date')).toBe('15.06.2026');
    expect(u.searchParams.get('time')).toMatch(/^\d{2}:\d{2}$/);
  });

  it('omits start param when from is null', () => {
    const url = buildOebbScottyUrl(event, null, '2026-06-15');
    const u = new URL(url);
    expect(u.searchParams.has('S')).toBe(false);
    expect(u.searchParams.has('Z')).toBe(true);
  });

  it('falls back to 18:00 when no event start_date', () => {
    const url = buildOebbScottyUrl({ ...event, start_date: '' }, null, '2026-06-15');
    expect(new URL(url).searchParams.get('time')).toBe('18:00');
  });
});

describe('buildBookingUrl', () => {
  it('builds a booking.com URL with ss, checkin, checkout', () => {
    const url = buildBookingUrl('Eisenstadt', '2026-06-15', 1);
    const u = new URL(url);
    expect(u.hostname).toBe('www.booking.com');
    expect(u.searchParams.get('ss')).toBe('Eisenstadt');
    expect(u.searchParams.get('checkin')).toBe('2026-06-15');
    expect(u.searchParams.get('checkout')).toBe('2026-06-16');
  });

  it('builds a city-less URL when city is null', () => {
    const url = buildBookingUrl(null, '2026-06-15', 1);
    const u = new URL(url);
    expect(u.searchParams.has('ss')).toBe(false);
    expect(u.searchParams.get('checkin')).toBe('2026-06-15');
  });

  it('respects nights param for checkout calculation', () => {
    const url = buildBookingUrl('Wien', '2026-06-15', 3);
    const u = new URL(url);
    expect(u.searchParams.get('checkout')).toBe('2026-06-18');
  });
});

describe('deriveAccommodationCity', () => {
  it('extracts last comma-segment from location_name', () => {
    expect(deriveAccommodationCity([{
      location_name: 'Schloss Esterhazy, Eisenstadt',
      bundesland: 'burgenland',
    }])).toBe('Eisenstadt');
  });

  it('falls back to bundesland when no location_name', () => {
    expect(deriveAccommodationCity([{
      location_name: null,
      bundesland: 'wien',
    }])).toBe('wien');
  });

  it('returns empty string for no events', () => {
    expect(deriveAccommodationCity([])).toBe('');
  });

  it('returns single location_name when no comma', () => {
    expect(deriveAccommodationCity([{
      location_name: 'Stadthalle',
      bundesland: 'wien',
    }])).toBe('Stadthalle');
  });
});
