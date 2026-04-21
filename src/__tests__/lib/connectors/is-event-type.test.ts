/**
 * Unit tests for `isEventType` — the single source of truth for "does
 * this JSON-LD @type value represent a Schema.org Event".
 *
 * Background: 33 scrapers previously had narrow checks like
 *   if (item['@type'] !== 'Event') continue;
 * which silently dropped every MusicEvent, TheaterEvent, ComedyEvent,
 * Festival, etc. Austrian ticket vendors (oeticket, eventim,
 * ticketmaster) emit MusicEvent, club scrapers scrape MusicEvent,
 * theater scrapers scrape TheaterEvent — the bug made them all invisible.
 *
 * These tests lock in the new behaviour so it can't regress.
 */

import { describe, it, expect } from 'vitest';
import { isEventType, EVENT_TYPES } from '../../../lib/connectors/json-ld-connector';

describe('isEventType', () => {
  describe('bare string @type', () => {
    it('accepts plain "Event"', () => {
      expect(isEventType('Event')).toBe(true);
    });

    it('accepts "MusicEvent" (oeticket, eventim, ticketmaster)', () => {
      expect(isEventType('MusicEvent')).toBe(true);
    });

    it('accepts "TheaterEvent" (theater venues)', () => {
      expect(isEventType('TheaterEvent')).toBe(true);
    });

    it('accepts "ComedyEvent" (kabarett)', () => {
      expect(isEventType('ComedyEvent')).toBe(true);
    });

    it('accepts "Festival" (festival scrapers)', () => {
      expect(isEventType('Festival')).toBe(true);
    });

    it('accepts "SportsEvent" (bergfex, sport scrapers)', () => {
      expect(isEventType('SportsEvent')).toBe(true);
    });

    it('accepts "ScreeningEvent" (cinema)', () => {
      expect(isEventType('ScreeningEvent')).toBe(true);
    });

    it('accepts "ExhibitionEvent" (museums, galleries)', () => {
      expect(isEventType('ExhibitionEvent')).toBe(true);
    });

    it('accepts "BusinessEvent" (meetup, networking)', () => {
      expect(isEventType('BusinessEvent')).toBe(true);
    });

    it('accepts "EducationEvent" (workshops, lectures)', () => {
      expect(isEventType('EducationEvent')).toBe(true);
    });

    it('accepts "FoodEvent" (kulinarik, verkostungen)', () => {
      expect(isEventType('FoodEvent')).toBe(true);
    });

    it('accepts "LiteraryEvent" (lesungen)', () => {
      expect(isEventType('LiteraryEvent')).toBe(true);
    });

    it('accepts "ChildrensEvent" (kinder-events)', () => {
      expect(isEventType('ChildrensEvent')).toBe(true);
    });
  });

  describe('array @type', () => {
    it('accepts ["Event"]', () => {
      expect(isEventType(['Event'])).toBe(true);
    });

    it('accepts ["MusicEvent"]', () => {
      expect(isEventType(['MusicEvent'])).toBe(true);
    });

    it('accepts ["MusicEvent", "SocialEvent"] (multi-type)', () => {
      expect(isEventType(['MusicEvent', 'SocialEvent'])).toBe(true);
    });

    it('accepts ["Thing", "Event"] (Event present anywhere)', () => {
      expect(isEventType(['Thing', 'Event'])).toBe(true);
    });

    it('accepts ["Festival", "MusicEvent"] (both valid)', () => {
      expect(isEventType(['Festival', 'MusicEvent'])).toBe(true);
    });

    it('rejects ["Product", "Offer"] (neither is Event)', () => {
      expect(isEventType(['Product', 'Offer'])).toBe(false);
    });
  });

  describe('rejections', () => {
    it('rejects null', () => expect(isEventType(null)).toBe(false));
    it('rejects undefined', () => expect(isEventType(undefined)).toBe(false));
    it('rejects empty string', () => expect(isEventType('')).toBe(false));
    it('rejects empty array', () => expect(isEventType([])).toBe(false));
    it('rejects "Product"', () => expect(isEventType('Product')).toBe(false));
    it('rejects "Article"', () => expect(isEventType('Article')).toBe(false));
    it('rejects "WebPage"', () => expect(isEventType('WebPage')).toBe(false));
    it('rejects "LocalBusiness"', () => expect(isEventType('LocalBusiness')).toBe(false));
    it('rejects numbers', () => expect(isEventType(42 as unknown)).toBe(false));
    it('rejects objects', () => expect(isEventType({ event: true } as unknown)).toBe(false));
  });

  describe('case sensitivity', () => {
    it('is case-sensitive: "event" (lowercase) does NOT match', () => {
      expect(isEventType('event')).toBe(false);
    });
    it('is case-sensitive: "EVENT" (uppercase) does NOT match', () => {
      expect(isEventType('EVENT')).toBe(false);
    });
  });

  describe('EVENT_TYPES coverage', () => {
    it('exports a non-empty set', () => {
      expect(EVENT_TYPES.size).toBeGreaterThan(10);
    });

    it('every member of EVENT_TYPES is accepted', () => {
      for (const t of EVENT_TYPES) {
        expect(isEventType(t)).toBe(true);
      }
    });

    it('includes the critical Austrian-relevant subtypes', () => {
      const critical = [
        'Event', 'MusicEvent', 'TheaterEvent', 'ComedyEvent',
        'Festival', 'SportsEvent', 'ScreeningEvent', 'ExhibitionEvent',
        'BusinessEvent', 'EducationEvent', 'FoodEvent', 'LiteraryEvent',
        'ChildrensEvent', 'DanceEvent', 'SocialEvent', 'VisualArtsEvent',
      ];
      for (const t of critical) expect(EVENT_TYPES.has(t)).toBe(true);
    });
  });
});
