import { describe, it, expect } from 'vitest';
import { dedupe, type RelatedRow } from '@/components/Events/v4/V4RelatedEvents';

/** Testdaten-Fabrik — nur die für die Dedupe relevanten Felder variieren. */
function row(over: Partial<RelatedRow>): RelatedRow {
  return {
    id: Math.random().toString(36).slice(2),
    slug: null,
    title: 'Event',
    start_date: '2026-07-09T17:00:00+00:00',
    location_name: null,
    postal_code: null,
    address: null,
    bundesland: 'wien',
    category: 'Musik',
    image_url: null,
    ...over,
  };
}

describe('V4RelatedEvents dedupe — Fälle vom 2026-07-08-Screenshot (Vivaldi-Detailseite)', () => {
  it('entfernt identische Titel zum selben Zeitpunkt trotz unterschiedlicher Bild-URLs (Nina-Chuba-Fall)', () => {
    const rows = [
      row({ id: 'a', title: 'Nina Chuba', image_url: 'https://cdn/x1.jpg', location_name: 'Wiener Stadthalle - Halle D' }),
      row({ id: 'b', title: 'Nina Chuba', image_url: 'https://cdn/x2.jpg', location_name: 'Wiener Stadthalle Halle D' }),
    ];
    const out = dedupe(rows);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Nina Chuba');
  });

  it('entfernt Titel-mit-Venue-Suffix zum selben Zeitpunkt (Kleine-Nachtmusik-Fall)', () => {
    const rows = [
      row({ id: 'a', title: 'Eine kleine Nachtmusik', image_url: 'https://cdn/a.jpg' }),
      row({ id: 'b', title: 'Eine kleine Nachtmusik - Kapuzinerkirche', image_url: 'https://cdn/b.jpg' }),
    ];
    expect(dedupe(rows)).toHaveLength(1);
  });

  it('behält beim Merge den Datensatz MIT Bild', () => {
    const rows = [
      row({ id: 'ohne-bild', title: 'Nina Chuba', image_url: null }),
      row({ id: 'mit-bild', title: 'Nina Chuba', image_url: 'https://cdn/x.jpg' }),
    ];
    const out = dedupe(rows);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('mit-bild');
  });

  it('gleicher Titel an VERSCHIEDENEN Zeitpunkten mit verschiedenen Bildern bleibt erhalten (echte Serie)', () => {
    const rows = [
      row({ id: 'a', title: 'Vivaldi: Die vier Jahreszeiten', start_date: '2026-07-11T18:15:00+00:00', image_url: 'https://cdn/1.jpg' }),
      row({ id: 'b', title: 'Vivaldi: Die vier Jahreszeiten', start_date: '2026-07-18T18:15:00+00:00', image_url: 'https://cdn/2.jpg' }),
    ];
    expect(dedupe(rows)).toHaveLength(2);
  });

  it('Recurring-Event (gleicher Titel + gleiches Bild an N Tagen) wird auf einen Slot reduziert', () => {
    const rows = [
      row({ id: 'a', title: 'Heuriger am Berg', start_date: '2026-07-10T16:00:00+00:00', image_url: 'https://cdn/h.jpg' }),
      row({ id: 'b', title: 'Heuriger am Berg', start_date: '2026-07-11T16:00:00+00:00', image_url: 'https://cdn/h.jpg' }),
      row({ id: 'c', title: 'Heuriger am Berg', start_date: '2026-07-12T16:00:00+00:00', image_url: 'https://cdn/h.jpg' }),
    ];
    expect(dedupe(rows)).toHaveLength(1);
  });

  it('kurze Titel-Präfixe erzeugen KEINE False-Positives ("Fest" vs "Festival der Tiere")', () => {
    const rows = [
      row({ id: 'a', title: 'Fest', image_url: 'https://cdn/a.jpg' }),
      row({ id: 'b', title: 'Festival der Tiere', image_url: 'https://cdn/b.jpg' }),
    ];
    expect(dedupe(rows)).toHaveLength(2);
  });

  it('unterschiedliche Events zum selben Zeitpunkt bleiben erhalten', () => {
    const rows = [
      row({ id: 'a', title: 'Harry Mack//sold out!!', image_url: 'https://cdn/a.jpg' }),
      row({ id: 'b', title: 'Imperial Gala Concert', image_url: 'https://cdn/b.jpg' }),
    ];
    expect(dedupe(rows)).toHaveLength(2);
  });
});
