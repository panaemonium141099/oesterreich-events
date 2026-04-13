/**
 * Tests for artist name normalization module.
 *
 * Covers: performance modifiers, featured artist stripping, collaborative
 * booking splitting, diacritics removal, ampersand band exceptions,
 * Austrian-specific names, and edge cases.
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.3
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeArtistName,
  splitCollaborativeBooking,
} from '../../lib/lineup/normalize';

// ── normalizeArtistName ────────────────────────────────────────────────────────

describe('normalizeArtistName', () => {
  // Basic normalization
  it('trims whitespace', () => {
    expect(normalizeArtistName('  Bilderbuch  ')).toBe('bilderbuch');
  });

  it('lowercases', () => {
    expect(normalizeArtistName('WANDA')).toBe('wanda');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeArtistName('The   Rolling   Stones')).toBe('the rolling stones');
  });

  // Diacritics
  it('strips diacritics from German umlauts', () => {
    expect(normalizeArtistName('Seiler & Speer')).toBe('seiler & speer');
  });

  it('strips diacritics from accented characters', () => {
    expect(normalizeArtistName('Motley Crue')).toBe('motley crue');
    expect(normalizeArtistName('Beyonce')).toBe('beyonce');
  });

  it('strips combined diacritics (umlaut + accent)', () => {
    // o-umlaut (U+00F6) -> o after NFD stripping
    expect(normalizeArtistName('\u00D6sterreich Band')).toBe('osterreich band');
  });

  // Performance modifiers
  it('strips (DJ Set)', () => {
    expect(normalizeArtistName('Boris Brejcha (DJ Set)')).toBe('boris brejcha');
  });

  it('strips (Live)', () => {
    expect(normalizeArtistName('Moderat (Live)')).toBe('moderat');
  });

  it('strips (Live Set)', () => {
    expect(normalizeArtistName('ANNA (Live Set)')).toBe('anna');
  });

  it('strips (Acoustic)', () => {
    expect(normalizeArtistName('Ed Sheeran (Acoustic)')).toBe('ed sheeran');
  });

  it('strips (Hybrid Set)', () => {
    expect(normalizeArtistName('Amelie Lens (Hybrid Set)')).toBe('amelie lens');
  });

  it('strips [DJ Set] with brackets', () => {
    expect(normalizeArtistName('Diplo [DJ Set]')).toBe('diplo');
  });

  it('strips (Closing Set)', () => {
    expect(normalizeArtistName('Carl Cox (Closing Set)')).toBe('carl cox');
  });

  it('strips (Vinyl Set)', () => {
    expect(normalizeArtistName('DJ Harvey (Vinyl Set)')).toBe('dj harvey');
  });

  it('strips (AV Set)', () => {
    expect(normalizeArtistName('Amon Tobin (A/V Set)')).toBe('amon tobin');
  });

  it('strips (Hosted by ...)', () => {
    expect(normalizeArtistName('Bassface Sascha (Hosted by MC Bam Bam)')).toBe('bassface sascha');
  });

  // Featured artist stripping
  it('strips (feat. X)', () => {
    expect(normalizeArtistName('Major Lazer (feat. MO)')).toBe('major lazer');
  });

  it('strips [ft. X]', () => {
    expect(normalizeArtistName('Gorillaz [ft. De La Soul]')).toBe('gorillaz');
  });

  it('strips bare featuring suffix', () => {
    expect(normalizeArtistName('Drake feat. Rihanna')).toBe('drake');
  });

  it('strips bare ft. suffix', () => {
    expect(normalizeArtistName('Eminem ft. Nate Dogg')).toBe('eminem');
  });

  it('strips "featuring" (full word)', () => {
    expect(normalizeArtistName('Cardi B featuring Megan Thee Stallion')).toBe('cardi b');
  });

  // Austrian-specific artists
  it('normalizes Bilderbuch', () => {
    expect(normalizeArtistName('Bilderbuch')).toBe('bilderbuch');
  });

  it('normalizes Wanda', () => {
    expect(normalizeArtistName('Wanda')).toBe('wanda');
  });

  it('normalizes STS', () => {
    expect(normalizeArtistName('STS')).toBe('sts');
  });

  it('normalizes Seiler & Speer with diacritics', () => {
    // The "&" stays in normalize (splitting is a separate function)
    expect(normalizeArtistName('Seiler & Speer')).toBe('seiler & speer');
  });

  it('normalizes Pizzera & Jaus', () => {
    expect(normalizeArtistName('Pizzera & Jaus')).toBe('pizzera & jaus');
  });

  it('normalizes Folkshilfe', () => {
    expect(normalizeArtistName('Folkshilfe')).toBe('folkshilfe');
  });

  // Edge cases
  it('returns empty string for empty input', () => {
    expect(normalizeArtistName('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeArtistName('   ')).toBe('');
  });

  it('handles single character', () => {
    expect(normalizeArtistName('A')).toBe('a');
  });

  it('handles name with only modifier', () => {
    // Edge case: if someone just has "(DJ Set)" as the full entry
    expect(normalizeArtistName('(DJ Set)')).toBe('');
  });

  it('handles multiple modifiers', () => {
    expect(normalizeArtistName('Amelie Lens (Live) (Acoustic)')).toBe('amelie lens');
  });
});

// ── splitCollaborativeBooking ──────────────────────────────────────────────────

describe('splitCollaborativeBooking', () => {
  // b2b splits
  it('splits b2b', () => {
    expect(splitCollaborativeBooking('Adam Beyer b2b Cirez D')).toEqual([
      'adam beyer',
      'cirez d',
    ]);
  });

  it('splits B2B (case-insensitive)', () => {
    expect(splitCollaborativeBooking('Pan-Pot B2B Stephan Bodzin')).toEqual([
      'pan-pot',
      'stephan bodzin',
    ]);
  });

  it('splits b2b with modifiers', () => {
    expect(splitCollaborativeBooking('Amelie Lens b2b Farrago (DJ Set)')).toEqual([
      'amelie lens',
      'farrago',
    ]);
  });

  // vs. splits
  it('splits vs.', () => {
    expect(splitCollaborativeBooking('Galantis vs. Hook N Sling')).toEqual([
      'galantis',
      'hook n sling',
    ]);
  });

  it('splits vs (without dot)', () => {
    expect(splitCollaborativeBooking('DJ A vs DJ B')).toEqual(['dj a', 'dj b']);
  });

  // x collaboration splits
  it('splits x collaboration', () => {
    expect(splitCollaborativeBooking('RL Grime x Baauer')).toEqual([
      'rl grime',
      'baauer',
    ]);
  });

  it('does not split short names on x', () => {
    // "Dax J" should NOT be split (the J is too short)
    const result = splitCollaborativeBooking('Dax J');
    // "Dax" + "J" -- J is length 1, so no split
    expect(result).toEqual(['dax j']);
  });

  // presents splits
  it('splits "presents"', () => {
    expect(splitCollaborativeBooking('Dimitri Vegas presents Smash The House')).toEqual([
      'dimitri vegas',
      'smash the house',
    ]);
  });

  it('splits "present" (singular)', () => {
    expect(splitCollaborativeBooking('Krewella present Rainman')).toEqual([
      'krewella',
      'rainman',
    ]);
  });

  // & splits
  it('splits on & for non-known bands', () => {
    expect(splitCollaborativeBooking('DJ Alpha & DJ Beta')).toEqual([
      'dj alpha',
      'dj beta',
    ]);
  });

  // "und" splits (Austrian)
  it('splits on "und" (Austrian equivalent of &)', () => {
    expect(splitCollaborativeBooking('Hans und Franz')).toEqual([
      'hans',
      'franz',
    ]);
  });

  // Known ampersand band exceptions
  it('does NOT split Above & Beyond', () => {
    expect(splitCollaborativeBooking('Above & Beyond')).toEqual([
      'above & beyond',
    ]);
  });

  it('does NOT split Seiler & Speer', () => {
    expect(splitCollaborativeBooking('Seiler & Speer')).toEqual([
      'seiler & speer',
    ]);
  });

  it('does NOT split Pizzera & Jaus', () => {
    expect(splitCollaborativeBooking('Pizzera & Jaus')).toEqual([
      'pizzera & jaus',
    ]);
  });

  it('does NOT split Mumford & Sons', () => {
    expect(splitCollaborativeBooking('Mumford & Sons')).toEqual([
      'mumford & sons',
    ]);
  });

  it('does NOT split Simon & Garfunkel', () => {
    expect(splitCollaborativeBooking('Simon & Garfunkel')).toEqual([
      'simon & garfunkel',
    ]);
  });

  it('does NOT split Earth, Wind & Fire', () => {
    expect(splitCollaborativeBooking('Earth, Wind & Fire')).toEqual([
      'earth, wind & fire',
    ]);
  });

  it('does NOT split Tegan & Sara', () => {
    expect(splitCollaborativeBooking('Tegan & Sara')).toEqual([
      'tegan & sara',
    ]);
  });

  it('does NOT split Aly & Fila', () => {
    expect(splitCollaborativeBooking('Aly & Fila')).toEqual(['aly & fila']);
  });

  // Featured stripping before split
  it('strips feat. before splitting b2b', () => {
    expect(
      splitCollaborativeBooking('Artist A (feat. Someone) b2b Artist B')
    ).toEqual(['artist a', 'artist b']);
  });

  // Edge cases
  it('returns empty array for empty string', () => {
    expect(splitCollaborativeBooking('')).toEqual([]);
  });

  it('returns empty array for whitespace-only', () => {
    expect(splitCollaborativeBooking('   ')).toEqual([]);
  });

  it('returns single-element array for non-collaborative name', () => {
    expect(splitCollaborativeBooking('Bilderbuch')).toEqual(['bilderbuch']);
  });

  it('normalizes each split result individually', () => {
    const result = splitCollaborativeBooking('DJ Alpha (Live) b2b DJ Beta (DJ Set)');
    expect(result).toEqual(['dj alpha', 'dj beta']);
  });

  // Combined: modifiers + collab + diacritics
  it('handles complex combined case', () => {
    const result = splitCollaborativeBooking(
      'B\u00F6ris Brejcha (DJ Set) b2b Amelie L\u00E9ns (Live)'
    );
    expect(result).toEqual(['boris brejcha', 'amelie lens']);
  });
});
