import { describe, it, expect } from 'vitest';
import { BoudiccaEventsScraper } from '../BoudiccaEventsScraper';
import type { ScrapedEvent } from '@/types/events';

// Rohdatensatz 1:1 aus https://search.boudicca.events/queryEntries
// (Abruf 2026-09-17, Eintrag des Henry-Flohmarkts, Rotes Kreuz Hollabrunn).
const HENRY_RAW: Record<string, string> = {
  url: 'https://www.flohmarkt.at/flohmaerkte/niederoesterreich/veranstaltung/henry-flohmarkt-2020-hollabrunn-aspersdorferstrasse',
  'sources:format=list':
    'https://www.flohmarkt.at/flohmaerkte/niederoesterreich/veranstaltung/henry-flohmarkt-2020-hollabrunn-aspersdorferstrasse',
  description:
    'Mittwoch 02. September 2026\nHENRY FLOHMARKT  \t\t\t\t\n\t in 2020 Hollabrunn\nAspersdorferstraße 34, 10-17 Uhr\nKontakt:\nRotes Kreuz Hollabrunn 059144-57004\nEmail:\nhenryladen.hl@n.roteskreuz.at\nDieser Markt findet noch an folgenden Tagen statt:\n\n\t\t\t\t\t\n\t\t\t\t\tMittwoch 02. September 2026\nMittwoch 09. September 2026\n\n\t\t\t\t\t Mittwoch 16. September 2026\n\n\t\t\t\t\t Mittwoch 23. September 2026\n\n\t\t\t\t\t Mittwoch 30. September 2026\n\n\t\t\t\t\t Mittwoch 07. Oktober 2026\n\n\t\t\t\t\t Mittwoch 14. Oktober 2026\n\n\t\t\t\t\t \t\t\t\t \neventuell weitere Termine wurden vom Veranstalter noch nicht gemeldet!\n',
  category: 'OTHER',
  'location.city': 'Hollabrunn',
  'location.address': 'Aspersdorferstraße 34',
  pictureUrl: 'https://www.flohmarkt.at/pics/logo/logo_neu.jpg',
  pictureCopyright: 'flohmarkt.at',
  'tags:format=list': 'Flea market,Thrifting,Second Hand',
  collectorName: 'flohmarkt',
  name: 'HENRY FLOHMARKT in 2020 Hollabrunn',
  'startDate:format=date': '2026-09-02T08:00:00Z',
  'boudicca.id:format=uuid': 'f04f6bcc-7c46-5d47-af43-ad7e77e9fe17',
};

function mapEntry(raw: Record<string, string>): ScrapedEvent[] {
  const scraper = new BoudiccaEventsScraper() as unknown as {
    mapEntry(kv: Record<string, string>): ScrapedEvent[];
  };
  return scraper.mapEntry(raw);
}

describe('BoudiccaEventsScraper.mapEntry — flohmarkt.at', () => {
  it('löst die Terminliste in ein Event pro Tag mit stabiler Kennung auf', () => {
    const events = mapEntry(HENRY_RAW);
    expect(events.map(e => e.source_id)).toEqual([
      'flohmarkt:henry-flohmarkt-2020-hollabrunn-aspersdorferstrasse:2026-09-02',
      'flohmarkt:henry-flohmarkt-2020-hollabrunn-aspersdorferstrasse:2026-09-09',
      'flohmarkt:henry-flohmarkt-2020-hollabrunn-aspersdorferstrasse:2026-09-16',
      'flohmarkt:henry-flohmarkt-2020-hollabrunn-aspersdorferstrasse:2026-09-23',
      'flohmarkt:henry-flohmarkt-2020-hollabrunn-aspersdorferstrasse:2026-09-30',
      'flohmarkt:henry-flohmarkt-2020-hollabrunn-aspersdorferstrasse:2026-10-07',
      'flohmarkt:henry-flohmarkt-2020-hollabrunn-aspersdorferstrasse:2026-10-14',
    ]);
    for (const e of events) {
      expect(e.source_name).toBe('boudicca:flohmarkt');
      expect(e.title).toBe('HENRY FLOHMARKT in 2020 Hollabrunn');
      expect(e.address).toBe('Aspersdorferstraße 34');
      expect(e.city).toBe('Hollabrunn');
    }
  });

  it('Beginn und Ende sind Wiener Wandzeit aus "10-17 Uhr"', () => {
    const [first, , , , , , last] = mapEntry(HENRY_RAW);
    expect(first.start_date).toBe('2026-09-02T10:00:00');
    expect(first.end_date).toBe('2026-09-02T17:00:00');
    expect(last.start_date).toBe('2026-10-14T10:00:00');
    expect(last.end_date).toBe('2026-10-14T17:00:00');
  });

  it('die Beschreibung trägt weder Datums-Kopfzeile noch Terminliste', () => {
    const [event] = mapEntry(HENRY_RAW);
    expect(event.description).toBe(
      'HENRY FLOHMARKT\nin 2020 Hollabrunn\nAspersdorferstraße 34, 10-17 Uhr\nKontakt:\nRotes Kreuz Hollabrunn 059144-57004\nEmail:\nhenryladen.hl@n.roteskreuz.at',
    );
    expect(event.description).not.toContain('14. Oktober');
  });

  it('andere Collectors bleiben ein Event unter der Boudicca-UUID', () => {
    const events = mapEntry({
      ...HENRY_RAW,
      collectorName: 'arenawien',
      name: 'Irgendein Konzert',
      description: 'Dieser Markt findet noch an folgenden Tagen statt:\nSamstag 10. Oktober 2026',
    });
    expect(events).toHaveLength(1);
    expect(events[0].source_id).toBe('f04f6bcc-7c46-5d47-af43-ad7e77e9fe17');
    expect(events[0].start_date).toBe('2026-09-02T08:00:00Z');
    expect(events[0].description).toContain('10. Oktober');
  });

  it('Pflichtfelder fehlen → kein Event', () => {
    const { name: _dropped, ...withoutName } = HENRY_RAW;
    void _dropped;
    expect(mapEntry(withoutName)).toEqual([]);
  });
});
