import { describe, it, expect } from 'vitest';
import { deriveTicketMeta } from '@/lib/v4/ticket-meta';
import type { Event } from '@/types/events';

function event(over: Partial<Event> = {}): Event {
  return {
    id: 'e1',
    source_id: null,
    source_name: null,
    source_url: null,
    title: 't',
    description: null,
    start_date: '2026-06-01',
    end_date: null,
    location_name: null,
    address: null,
    postal_code: null,
    bundesland: null,
    district: null,
    latitude: null,
    longitude: null,
    category: null,
    price_text: null,
    price_min: null,
    price_max: null,
    image_url: null,
    organizer: null,
    tags: null,
    ticket_url: null,
    created_at: '',
    updated_at: '',
    ...over,
  };
}

describe('deriveTicketMeta', () => {
  it('macht aus price_min den kurzen Ab-Preis', () => {
    expect(deriveTicketMeta(event({ price_min: 12 })).priceFrom).toBe('€ 12');
  });

  it('lässt priceFrom leer, wenn nur ein Preistext vorliegt', () => {
    // Der frühere Rückfall auf price_text schob ganze Sätze in die
    // 28px-Preiszeile der TicketBox. Beobachtet an einem Inserat mit
    // "Abendkassa regulär: EUR 12 - Early Bird / ..." (120 Zeichen).
    const meta = deriveTicketMeta(
      event({ price_text: 'Abendkassa regulär: EUR 12 - Early Bird / Vorverkauf: EUR 9' }),
    );
    expect(meta.priceFrom).toBeUndefined();
  });

  it('reicht den Preistext für die Abendkassen-Box weiter', () => {
    const meta = deriveTicketMeta(event({ price_text: 'Abendkassa EUR 12' }));
    expect(meta.priceAtDoor).toBe('Abendkassa EUR 12');
  });

  it('übernimmt den Anbieternamen aus source_name', () => {
    expect(deriveTicketMeta(event({ source_name: 'The Loft' })).provider).toBe('The Loft');
  });

  it('lässt alles leer, wenn nichts bekannt ist', () => {
    expect(deriveTicketMeta(event())).toEqual({
      provider: undefined,
      priceFrom: undefined,
      priceAtDoor: undefined,
    });
  });
});
