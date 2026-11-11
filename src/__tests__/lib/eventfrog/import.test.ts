import { describe, expect, it } from 'vitest';
import { eventfrogWorkflowName, withoutImages } from '@/lib/eventfrog/import';
import type { ScrapedEvent } from '@/types/events';

describe('eventfrogWorkflowName', () => {
  it('gibt dem DE-Lauf einen eigenen Bericht', () => {
    expect(eventfrogWorkflowName(['DE'])).toBe('import-eventfrog-de');
    expect(eventfrogWorkflowName(['AT'])).toBe('import-eventfrog');
    expect(eventfrogWorkflowName(['AT', 'DE'])).toBe('import-eventfrog');
  });
});

describe('withoutImages', () => {
  it('nimmt Bild, Maße und Nachweis weg, damit kein Hotlink in die DB geht', () => {
    const events = [{
      source_name: 'Eventfrog', source_id: '1', title: 'Jazz Night', start_date: '2026-11-20T20:00:00+01:00',
      image_url: 'https://res.eventfrog.net/jazz-ABC.webp?_=1', image_width: 800, image_height: 600, image_credit: 'Foto: X',
    }] as ScrapedEvent[];
    withoutImages(events);
    expect(events[0]).toMatchObject({ title: 'Jazz Night', image_url: undefined, image_width: undefined, image_height: undefined, image_credit: undefined });
  });
});
