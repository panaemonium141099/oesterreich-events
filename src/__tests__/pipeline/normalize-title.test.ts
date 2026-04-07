import { describe, it, expect } from 'vitest';
import {
  normalizeTitle,
  normalizeTitleCompact,
} from '@/lib/pipeline/normalize-title';

describe('normalizeTitle', () => {
  it('lowercases and trims', () => {
    expect(normalizeTitle('  TECHNO FRIDAY  ')).toBe('techno friday');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeTitle('techno   friday   night')).toBe(
      'techno friday night'
    );
  });

  it('normalizes unicode NFC', () => {
    expect(normalizeTitle('M\u00FCnchen')).toBe('münchen');
  });

  it('removes emojis', () => {
    expect(normalizeTitle('Party 🎉 Night 🔥')).toBe('party night');
  });

  it('removes decorative separators', () => {
    expect(
      normalizeTitle('TECHNO FRIDAY | FLEX VIENNA | Official Event')
    ).toBe('techno friday flex vienna official event');
    expect(normalizeTitle('Event — Special >>> Edition')).toBe(
      'event special edition'
    );
  });

  it('preserves hyphens in compound words', () => {
    expect(normalizeTitle('Open-Air Festival')).toBe('open-air festival');
  });

  it('handles empty string', () => {
    expect(normalizeTitle('')).toBe('');
  });
});

describe('normalizeTitleCompact', () => {
  it('removes parenthetical content', () => {
    expect(normalizeTitleCompact('Techno Night (Official Event)')).toBe(
      'techno night'
    );
    expect(normalizeTitleCompact('Rave [LIVE]')).toBe('rave');
  });

  it('removes weekday names (German)', () => {
    expect(normalizeTitleCompact('Montag Clubnight')).toBe('clubnight');
    expect(normalizeTitleCompact('Freitag Special')).toBe('special');
  });

  it('removes weekday names (English)', () => {
    expect(normalizeTitleCompact('Friday Night Fever')).toBe('night fever');
  });

  it('removes date fragments', () => {
    expect(normalizeTitleCompact('Festival 14. Juni')).toBe('festival');
    expect(normalizeTitleCompact('Party 14.06.')).toBe('party');
    expect(normalizeTitleCompact('Event 14.06.2026')).toBe('event');
  });

  it('removes marketing words', () => {
    expect(normalizeTitleCompact('DJ Set Live Special')).toBe('dj set');
  });

  it('handles complex real-world title', () => {
    expect(
      normalizeTitleCompact('TECHNO FRIDAY | FLEX VIENNA | Official Event')
    ).toBe('techno friday flex vienna');
  });
});
