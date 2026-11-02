import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildPreviewEvent } from '@/lib/inserate/preview';
import { buildEventRow, type ApprovableSubmission } from '@/lib/inserate/approve';
import { extractEdits } from '@/lib/inserate/review-input';

const NOW = new Date('2026-06-01T12:00:00Z');

function submission(overrides: Partial<ApprovableSubmission> = {}): ApprovableSubmission {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    title: 'A Masque for the Multiverse',
    description: 'Performance von laborgras & CONTINUUM.',
    category: 'Kultur & Bühne',
    start_date: '2026-11-11T18:00:00.000Z',
    end_date: '2026-11-11T20:00:00.000Z',
    is_all_day: false,
    location_name: 'Kulturbühne AMBACH',
    address: 'Am Bach 10',
    postal_code: '6840',
    city: 'Götzis',
    bundesland: 'vorarlberg',
    price_text: '30 Euro | ermäßigt 15 Euro',
    ticket_url: 'https://ambach.jetticket.net/webshop/webticket/bestseatselect?eventId=1',
    image_url: 'https://ambach.at/app/uploads/masque.jpg',
    event_url: 'https://ambach.at/veranstaltungen/a-masque-for-the-multiverse/',
    organizer: 'Marcelo Vilela',
    submitter_type: 'person',
    company: null,
    contact_name: 'Marcelo Vilela',
    ...overrides,
  };
}

describe('buildPreviewEvent', () => {
  // Der Resolver stempelt `location_resolution.resolved_at` mit der Uhr;
  // für den Feldvergleich steht sie still.
  beforeAll(() => vi.useFakeTimers({ now: NOW }));
  afterAll(() => vi.useRealTimers());

  it('zeigt genau die Zeile, die die Freigabe anlegen würde', () => {
    // Vorschau und veröffentlichtes Event dürfen nie auseinanderlaufen:
    // dieselben Eingaben, dieselben Felder.
    const opts = { now: NOW, latitude: 47.33, longitude: 9.63, coords_precision: 'address' as const };
    const row = buildEventRow(submission(), opts);
    const preview = buildPreviewEvent(submission(), opts);
    for (const [key, value] of Object.entries(row)) {
      expect(preview[key as keyof typeof preview]).toEqual(value);
    }
  });

  it('trägt die Einreichungs-ID als Event-ID und ergänzt die Zeitstempel', () => {
    const preview = buildPreviewEvent(submission(), { now: NOW });
    expect(preview.id).toBe('11111111-2222-3333-4444-555555555555');
    expect(preview.created_at).toBe(NOW.toISOString());
    expect(preview.updated_at).toBe(NOW.toISOString());
  });

  it('reicht den Preistext unverändert an die Detailseite durch', () => {
    const preview = buildPreviewEvent(submission(), { now: NOW });
    expect(preview.price_text).toBe('30 Euro | ermäßigt 15 Euro');
    expect(preview.price_min).toBeUndefined();
  });
});

describe('extractEdits', () => {
  it('übernimmt nur die erlaubten Schlüssel und mappt sie auf Spalten', () => {
    const edits = extractEdits({
      title: '  Neuer Titel ',
      priceText: '30 Euro | ermäßigt 15 Euro',
      ticketUrl: 'https://tickets.example/x',
      status: 'approved',
      start_date: '2030-01-01',
    });
    expect(edits).toEqual({
      title: 'Neuer Titel',
      price_text: '30 Euro | ermäßigt 15 Euro',
      ticket_url: 'https://tickets.example/x',
    });
  });

  it('erhält Absätze in der Beschreibung', () => {
    const edits = extractEdits({ description: 'Zeile 1\n\nZeile 2' });
    expect(edits.description).toBe('Zeile 1\n\nZeile 2');
  });

  it('liefert bei fehlendem oder ungültigem Body nichts', () => {
    expect(extractEdits(undefined)).toEqual({});
    expect(extractEdits('x')).toEqual({});
  });
});
