import { describe, it, expect } from 'vitest';
import { categorizeEvent, CATEGORIES } from '@/lib/categories';

describe('categorizeEvent', () => {
  describe('Feratel tag mapping (highest priority)', () => {
    it('maps "Musik" tag to Musik category', () => {
      expect(categorizeEvent('Some Event', '', ['Musik'])).toBe('Musik');
    });

    it('maps "Kulinarium" tag to Wein & Kulinarik', () => {
      expect(categorizeEvent('Some Event', '', ['Kulinarium'])).toBe('Wein & Kulinarik');
    });

    it('maps "Kinder- & Familienveranstaltungen" tag to Familie', () => {
      expect(categorizeEvent('Some Event', '', ['Kinder- & Familienveranstaltungen'])).toBe('Familie');
    });

    it('maps "Brauchtum & Feste" tag to Feste & Brauchtum', () => {
      expect(categorizeEvent('Some Event', '', ['Brauchtum & Feste'])).toBe('Feste & Brauchtum');
    });

    it('maps "AKTIV" tag to Sport', () => {
      expect(categorizeEvent('Some Event', '', ['AKTIV'])).toBe('Sport');
    });

    it('maps "Almsommer" tag to Natur', () => {
      expect(categorizeEvent('Some Event', '', ['Almsommer'])).toBe('Natur');
    });

    it('Feratel tag takes priority over title keywords', () => {
      // Title says "Konzert" (Musik), but Feratel tag says "Sport"
      expect(categorizeEvent('Konzert im Stadion', '', ['Sport'])).toBe('Sport');
    });
  });

  describe('title keyword matching (second priority)', () => {
    it('categorizes techno events as Nightlife', () => {
      expect(categorizeEvent('Techno Night at the Warehouse')).toBe('Nightlife');
    });

    it('categorizes rave events as Nightlife', () => {
      expect(categorizeEvent('Forest Rave 2026')).toBe('Nightlife');
    });

    it('categorizes concerts as Musik', () => {
      expect(categorizeEvent('Sommerkonzert am Rathaus')).toBe('Musik');
    });

    it('categorizes theater as Kultur', () => {
      expect(categorizeEvent('Theaterstück: Der Richter')).toBe('Kultur');
    });

    it('categorizes Wanderung as Sport when no higher-priority keywords match', () => {
      // Note: "nationalpark" triggers Natur which has higher priority than Sport
      expect(categorizeEvent('Geführte Wanderung im Wald')).toBe('Sport');
    });

    it('categorizes Weihnachtsmarkt as Märkte', () => {
      expect(categorizeEvent('Weihnachtsmarkt in Eisenstadt')).toBe('Märkte');
    });

    it('categorizes Weinverkostung as Wein & Kulinarik', () => {
      expect(categorizeEvent('Weinverkostung am Neusiedler See')).toBe('Wein & Kulinarik');
    });

    it('categorizes Kinderfest as Familie', () => {
      expect(categorizeEvent('Kinderfest im Park')).toBe('Familie');
    });

    it('categorizes Naturführung as Natur', () => {
      expect(categorizeEvent('Naturführung im Nationalpark')).toBe('Natur');
    });

    it('categorizes Dorffest as Feste & Brauchtum', () => {
      expect(categorizeEvent('Dorffest in Neckenmarkt')).toBe('Feste & Brauchtum');
    });

    it('categorizes Gottesdienst as Religion', () => {
      expect(categorizeEvent('Festgottesdienst in der Pfarrkirche')).toBe('Religion');
    });

    it('categorizes Gesundheitsvortrag as Gesundheit', () => {
      expect(categorizeEvent('Gesundheitsvortrag: Burnout-Prävention')).toBe('Gesundheit');
    });

    it('categorizes Vortrag as Bildung when no higher-priority keywords match', () => {
      // Note: "klimaschutz" triggers Natur which has higher priority than Bildung
      expect(categorizeEvent('Vortrag über Geschichte')).toBe('Bildung');
    });
  });

  describe('priority ordering', () => {
    it('Nightlife wins over Musik when both match title', () => {
      // "clubbing" = Nightlife, "musik" = Musik; Nightlife has higher priority
      expect(categorizeEvent('Clubbing Nacht mit Live Musik')).toBe('Nightlife');
    });

    it('Religion wins over Kultur for church events', () => {
      // "gottesdienst" = Religion, "kultur" present in desc
      expect(categorizeEvent('Festgottesdienst', 'kulturelle Veranstaltung')).toBe('Religion');
    });

    it('Familie wins over Kultur for children theater', () => {
      // "kindertheater" = Familie keyword
      expect(categorizeEvent('Kindertheater: Der kleine Prinz')).toBe('Familie');
    });
  });

  describe('tag keyword matching (third priority)', () => {
    it('matches category from tags when title has no match', () => {
      // Unknown tags (not Feratel) fall through to keyword matching
      expect(categorizeEvent('Veranstaltung', '', ['jazz abend'])).toBe('Musik');
    });
  });

  describe('description keyword matching (lowest priority)', () => {
    it('matches category from description when title and tags have no match', () => {
      expect(categorizeEvent('Veranstaltung', 'Ein großartiges Konzert im Freien')).toBe('Musik');
    });

    it('title match wins over description match', () => {
      // Title: "Wanderung" = Sport, Description: "Konzert" = Musik
      // Sport should win because title is checked first
      expect(categorizeEvent('Wanderung durch den Wald', 'mit Konzert am Abend')).toBe('Sport');
    });
  });

  describe('fallback to Sonstiges', () => {
    it('returns Sonstiges for completely unknown events', () => {
      expect(categorizeEvent('Irgendwas Unbekanntes')).toBe('Sonstiges');
    });

    it('returns Sonstiges for empty title', () => {
      expect(categorizeEvent('')).toBe('Sonstiges');
    });

    it('returns Sonstiges with no matching keywords anywhere', () => {
      expect(categorizeEvent('XYZ ABC', 'Lorem ipsum', ['tag1', 'tag2'])).toBe('Sonstiges');
    });
  });

  describe('CATEGORIES constant', () => {
    it('contains all 14 categories', () => {
      expect(CATEGORIES).toHaveLength(14);
    });

    it('includes Sonstiges as fallback', () => {
      expect(CATEGORIES).toContain('Sonstiges');
    });

    it('includes all main categories', () => {
      const expected = [
        'Musik', 'Kultur', 'Sport', 'Feste & Brauchtum', 'Märkte',
        'Wein & Kulinarik', 'Familie', 'Natur', 'Nightlife',
        'Bildung', 'Gesundheit', 'Religion', 'Wirtschaft', 'Sonstiges',
      ];
      for (const cat of expected) {
        expect(CATEGORIES).toContain(cat);
      }
    });
  });
});
