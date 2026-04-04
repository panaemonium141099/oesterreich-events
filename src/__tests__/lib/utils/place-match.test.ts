import { describe, it, expect } from 'vitest';
import { matchPlaceName, normalizePlaceName, tokenize } from '../../../lib/utils/place-match';

describe('normalizePlaceName', () => {
  it('lowercases and collapses umlauts', () => {
    expect(normalizePlaceName('Mörbisch')).toBe('morbisch');
    expect(normalizePlaceName('Güssing')).toBe('gussing');
    expect(normalizePlaceName('Straße')).toBe('strasse');
  });

  it('strips periods', () => {
    expect(normalizePlaceName('St. Margarethen')).toBe('st margarethen');
  });

  it('normalizes Sankt to st', () => {
    expect(normalizePlaceName('Sankt Pölten')).toBe('st polten');
  });

  it('trims whitespace', () => {
    expect(normalizePlaceName('  Rust  ')).toBe('rust');
  });
});

describe('tokenize', () => {
  it('splits on whitespace and punctuation', () => {
    expect(tokenize('Mörbisch am See')).toEqual(['morbisch', 'am', 'see']);
  });

  it('handles commas and hyphens', () => {
    expect(tokenize('Wiener Neustadt, NÖ')).toEqual(['wiener', 'neustadt', 'no']);
  });

  it('handles St. prefix', () => {
    expect(tokenize('St. Margarethen im Burgenland')).toEqual(['st', 'margarethen', 'im', 'burgenland']);
  });
});

describe('matchPlaceName', () => {
  // TRUE: correct matches
  it('matches exact single-word place name', () => {
    expect(matchPlaceName('Rust', 'rust')).toBe(true);
  });

  it('matches place name within longer text', () => {
    expect(matchPlaceName('Konzert in Rust am See', 'rust')).toBe(true);
  });

  it('matches Mörbisch in "Mörbisch am See"', () => {
    expect(matchPlaceName('Mörbisch am See', 'mörbisch')).toBe(true);
  });

  it('matches "moerbisch" variant (already normalized key)', () => {
    expect(matchPlaceName('Moerbisch am See', 'mörbisch')).toBe(true);
  });

  it('matches "St. Margarethen" as consecutive multi-word name', () => {
    expect(matchPlaceName('Event in St. Margarethen im Burgenland', 'st. margarethen')).toBe(true);
  });

  it('matches "hall in tirol" as consecutive tokens', () => {
    expect(matchPlaceName('Konzert in Hall in Tirol', 'hall in tirol')).toBe(true);
  });

  it('matches "zell am see"', () => {
    expect(matchPlaceName('Hotel Zell am See Kaprun', 'zell am see')).toBe(true);
  });

  it('matches "bad gastein"', () => {
    expect(matchPlaceName('Wellness Bad Gastein', 'bad gastein')).toBe(true);
  });

  // FALSE: substring false positives that must NOT match
  it('does NOT match "Rust" in "frustrated"', () => {
    expect(matchPlaceName('I am frustrated', 'rust')).toBe(false);
  });

  it('does NOT match "Rust" in "rustic"', () => {
    expect(matchPlaceName('A rustic cabin', 'rust')).toBe(false);
  });

  it('does NOT match "Hall" in "Hallein"', () => {
    expect(matchPlaceName('Event in Hallein', 'hall')).toBe(false);
  });

  it('does NOT match "Hall" in "Halle"', () => {
    expect(matchPlaceName('Stadthalle Wien', 'hall')).toBe(false);
  });

  it('does NOT match "Ried" in "Friedberg"', () => {
    expect(matchPlaceName('Event in Friedberg', 'ried')).toBe(false);
  });

  it('does NOT match "Enns" in "Jennersdorf"', () => {
    expect(matchPlaceName('Event in Jennersdorf', 'enns')).toBe(false);
  });

  it('does NOT match "Hard" in "Hartberg"', () => {
    expect(matchPlaceName('Event in Hartberg', 'hard')).toBe(false);
  });

  it('does NOT match "Lech" in "Schlechtwetter"', () => {
    expect(matchPlaceName('Schlechtwetter Programm', 'lech')).toBe(false);
  });

  // Sankt/St. equivalence
  it('matches "Sankt Pölten" against "st. pölten" key', () => {
    expect(matchPlaceName('Event in Sankt Pölten', 'st. pölten')).toBe(true);
  });

  it('matches "St. Pölten" against "st. pölten" key', () => {
    expect(matchPlaceName('Event in St. Pölten', 'st. pölten')).toBe(true);
  });

  it('matches "Sankt Anton" against "st. anton" key', () => {
    expect(matchPlaceName('Ski in Sankt Anton am Arlberg', 'st. anton')).toBe(true);
  });

  // Edge cases
  it('handles empty query', () => {
    expect(matchPlaceName('', 'rust')).toBe(false);
  });

  it('handles empty place name', () => {
    expect(matchPlaceName('Rust', '')).toBe(false);
  });
});
