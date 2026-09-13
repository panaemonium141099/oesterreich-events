/** fn-25 B3: Genauigkeits-Policy je Quelle. */
import { describe, it, expect } from 'vitest';
import { applySourceCoordsPolicy } from '@/lib/scrapers/source-coords-policy';
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
