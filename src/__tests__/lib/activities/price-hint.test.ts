import { describe, it, expect } from 'vitest';
import { extractPriceHint } from '@/lib/activities/price-hint';

describe('extractPriceHint — Treffer', () => {
  it('€ vor dem Betrag', () => {
    expect(extractPriceHint('Eintritt € 12')).toBe('€ 12');
    expect(extractPriceHint('Eintritt: € 12,50 pro Person')).toBe('€ 12,50');
  });

  it('€ nach dem Betrag', () => {
    expect(extractPriceHint('Tageskarte 9,90 € inkl. Sauna')).toBe('€ 9,90');
    expect(extractPriceHint('Kosten: 12€')).toBe('€ 12');
  });

  it('EUR / Euro als Marker', () => {
    expect(extractPriceHint('Preis: EUR 7')).toBe('€ 7');
    expect(extractPriceHint('Verleih um 5 Euro pro Stunde')).toBe('€ 5');
  });

  it('ab/von-Signal -> "ab €"-Prefix', () => {
    expect(extractPriceHint('Karten ab € 9,90 erhältlich')).toBe('ab € 9,90');
    expect(extractPriceHint('Führung von ca. € 8')).toBe('ab € 8');
  });

  it('mehrere Betraege -> kleinster mit "ab"', () => {
    expect(extractPriceHint('Erwachsene € 15, Kinder € 8')).toBe('ab € 8');
  });

  it('Satzpunkt nach dem Betrag ist ok', () => {
    expect(extractPriceHint('Der Eintritt kostet € 12.')).toBe('€ 12');
  });

  it('Tausender-Punkt wird deutsch geparst', () => {
    expect(extractPriceHint('Saisonkarte € 1.200')).toBe('€ 1200');
  });
});

describe('extractPriceHint — Anti-Patterns', () => {
  it('Jahreszahlen ohne Waehrung matchen nie ("ab 2018")', () => {
    expect(extractPriceHint('Geöffnet ab 2018 täglich')).toBeNull();
    expect(extractPriceHint('seit 1990 in Familienbesitz')).toBeNull();
  });

  it('Jahreszahl trotz €-Marker wird verworfen', () => {
    expect(extractPriceHint('Jubiläum € 2018')).toBeNull();
  });

  it('Hausnummern matchen nie', () => {
    expect(extractPriceHint('Hauptstraße 12, 7100 Neusiedl am See')).toBeNull();
  });

  it('kW-Angaben matchen nie', () => {
    expect(extractPriceHint('Ladeleistung 22 kW')).toBeNull();
    expect(extractPriceHint('Tarif € 0,45/kWh')).toBeNull();
  });

  it('Betrag als Teil laengerer Zahlen matcht nicht (Telefonnummern)', () => {
    expect(extractPriceHint('Tel. 0664 1234567 € siehe Aushang')).toBeNull();
  });

  it('unplausibel hohe Betraege werden verworfen', () => {
    expect(extractPriceHint('Umbau um € 950000')).toBeNull();
  });

  it('leer/null/ohne Preis -> null', () => {
    expect(extractPriceHint(null)).toBeNull();
    expect(extractPriceHint(undefined)).toBeNull();
    expect(extractPriceHint('')).toBeNull();
    expect(extractPriceHint('Schöner Rundwanderweg mit Aussicht')).toBeNull();
  });

  it('Euro als Wortbestandteil matcht nicht (Eurotherme)', () => {
    expect(extractPriceHint('Die Eurotherme 4 Sterne')).toBeNull();
  });
});
