// Regression tests for FeratelScraper.cleanTitle().
//
// Bug 2026-05-22: the day-abbreviation regex used an OPTIONAL period.
// That stripped "Fr" from "Fronleichnam" (-> "onleichnam"), "Sa" from
// "Salzburg", "Mi" from "Mittwoch", etc. The period is now mandatory.
//
// cleanTitle is private — access via subclass that exposes it.
import { describe, it, expect } from 'vitest';
import { FeratelScraper } from '@/lib/scrapers/FeratelScraper';

class TestScraper extends FeratelScraper {
  public clean(s: string): string {
    return (this as unknown as { cleanTitle(s: string): string }).cleanTitle(s);
  }
}

const s = new TestScraper();

describe('FeratelScraper.cleanTitle', () => {
  describe('preserves words starting with a day-abbreviation', () => {
    const cases: Array<[string, string]> = [
      ['Fronleichnam & Tag der Blasmusik', 'Fronleichnam & Tag der Blasmusik'],
      ['Frühschoppen am Marktplatz', 'Frühschoppen am Marktplatz'],
      ['Mittwochsmesse', 'Mittwochsmesse'],
      ['Mondscheinwanderung', 'Mondscheinwanderung'],
      ['Dorffest Abtenau', 'Dorffest Abtenau'],
      ['Salzburger Festspiele', 'Salzburger Festspiele'],
      ['Sommerkonzert', 'Sommerkonzert'],
      ['Didgeridoo-Workshop', 'Didgeridoo-Workshop'],
    ];
    for (const [input, expected] of cases) {
      it('keeps "' + input + '" intact', () => {
        expect(s.clean(input)).toBe(expected);
      });
    }
  });

  describe('still strips real day abbreviations with mandatory period', () => {
    it('strips Mi.19:00-Uhr prefix', () => {
      expect(s.clean('Mi.19:00-UhrKonzert in der Pfarrkirche')).toBe('Konzert in der Pfarrkirche');
    });
    it('strips Fr. with following text', () => {
      expect(s.clean('Fr. Sommerfest am Marktplatz')).toBe('Sommerfest am Marktplatz');
    });
    it('strips Fr.19:00-Uhr prefix (no space)', () => {
      expect(s.clean('Fr.19:00-UhrSommerfest am Marktplatz')).toBe('Sommerfest am Marktplatz');
    });
    it('strips Sa. prefix with following space', () => {
      expect(s.clean('Sa. Wanderung am See')).toBe('Wanderung am See');
    });
    it('strips after a leading date', () => {
      expect(s.clean('8.4.2026Mi.16:00-18:00UhrKids Soul mit Sofie')).toBe('Kids Soul mit Sofie');
    });
  });
});
