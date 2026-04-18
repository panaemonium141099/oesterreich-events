import { describe, it, expect } from 'vitest';
import { cleanDescriptionForSignals } from '@/lib/category-classifier';

describe('cleanDescriptionForSignals (R7)', () => {
  it('strips URLs', () => {
    const out = cleanDescriptionForSignals('Konzert am See https://example.at/tickets');
    expect(out.toLowerCase()).not.toContain('http');
  });

  it('strips email addresses', () => {
    const out = cleanDescriptionForSignals('Anmeldung: info@example.at');
    expect(out).not.toContain('@');
  });

  it('strips Austrian phone numbers', () => {
    const out = cleanDescriptionForSignals('Tel: +43 1 234 5678 oder 0664/1234567');
    expect(out).not.toMatch(/\+43/);
  });

  it('strips common SEO/ticket boilerplate phrases', () => {
    const out = cleanDescriptionForSignals(
      'Ein schönes Konzert. Weitere Infos und Tickets ab 25 Euro auf der Webseite.',
    );
    expect(out.toLowerCase()).not.toContain('weitere infos');
    expect(out.toLowerCase()).not.toContain('tickets ab');
  });

  it('truncates long inputs to 500 chars', () => {
    const long = 'a'.repeat(2000);
    expect(cleanDescriptionForSignals(long).length).toBeLessThanOrEqual(500);
  });

  it('returns empty string for null/undefined/empty input', () => {
    expect(cleanDescriptionForSignals(null)).toBe('');
    expect(cleanDescriptionForSignals(undefined)).toBe('');
    expect(cleanDescriptionForSignals('')).toBe('');
  });

  it('is stable across repeated calls', () => {
    const input = 'Ein Konzert mit vielen Infos. Tickets ab 10 Euro.';
    expect(cleanDescriptionForSignals(input)).toBe(cleanDescriptionForSignals(input));
  });
});
