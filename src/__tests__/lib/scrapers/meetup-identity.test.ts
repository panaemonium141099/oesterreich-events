/**
 * MeetupScraper: Identität + Ortsherkunft.
 *
 * Deckt die zwei Fehler ab, die im Prod-Bestand am 2026-09-06 dazu
 * führten, dass ALLE 19 künftigen meetup.com-Events US-Veranstaltungen
 * waren, veröffentlicht mit bundesland='kaernten':
 *   - source_id aus dem Titel (Kollision gleichnamiger Termine)
 *   - Suchstadt als Bundesland-Fallback
 */
import { describe, it, expect } from 'vitest';
import { meetupEventIdFromUrl } from '@/lib/scrapers/MeetupScraper';

describe('meetupEventIdFromUrl', () => {
  it('liest die echte Event-ID aus der Meetup-URL', () => {
    expect(meetupEventIdFromUrl('https://www.meetup.com/f4f-la/events/316182612/')).toBe(
      'f4f-la-316182612',
    );
    expect(meetupEventIdFromUrl('https://meetup.com/chicago-data-night/events/316270154')).toBe(
      'chicago-data-night-316270154',
    );
  });

  it('trennt zwei Termine derselben Reihe', () => {
    // Vorher kollidierten beide auf `meetup-english-practice-meet-friends`,
    // der zweite überschrieb den ersten beim Einsammeln.
    const a = meetupEventIdFromUrl('https://www.meetup.com/f4f-la/events/316182612/');
    const b = meetupEventIdFromUrl('https://www.meetup.com/f4f-la/events/316182613/');
    expect(a).not.toBe(b);
  });

  it('gibt null zurück, wenn keine ID ableitbar ist', () => {
    expect(meetupEventIdFromUrl('https://www.meetup.com/find/?location=Wien')).toBeNull();
    expect(meetupEventIdFromUrl('')).toBeNull();
    expect(meetupEventIdFromUrl(null)).toBeNull();
  });
});
