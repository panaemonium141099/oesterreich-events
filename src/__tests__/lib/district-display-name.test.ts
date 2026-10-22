import { describe, it, expect } from 'vitest';
import { districtDisplayName } from '@/lib/districtsAT';

describe('districtDisplayName', () => {
  it('nimmt die Schreibweise aus dem Register und lässt „(Stadt)" weg', () => {
    expect(districtDisplayName('graz (stadt)')).toBe('Graz');
    expect(districtDisplayName('sankt johann im pongau')).toBe('Sankt Johann im Pongau');
    expect(districtDisplayName('8. josefstadt')).toBe('8. Josefstadt');
    expect(districtDisplayName('krems (land)')).toBe('Krems (Land)');
  });
  it('schreibt unbekannte Werte wortweise groß, Füllwörter klein', () => {
    expect(districtDisplayName('neu am see')).toBe('Neu am See');
    expect(districtDisplayName('')).toBe('');
    expect(districtDisplayName(null)).toBe('');
  });
});
