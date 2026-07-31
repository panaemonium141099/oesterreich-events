/**
 * Konservatives Viator-Matching (fn-18 Task 5).
 *
 * Leitsatz der Task-Spec: KEIN Match ist besser als ein falscher. Die
 * Tests halten deshalb vor allem die ABLEHNUNGEN fest — jeder Fall, in
 * dem ein naiver Matcher danebengreifen wuerde.
 */
import { describe, it, expect } from 'vitest';
import {
  COMMERCIAL_TAGS,
  NAME_THRESHOLD,
  AMBIGUITY_MARGIN,
  buildSearchTerm,
  diceSimilarity,
  isMatchEligible,
  locationMatches,
  normalizeText,
  pickBestMatch,
  tokenize,
} from '@/lib/affiliate/match';

const activity = (over: Partial<Parameters<typeof pickBestMatch>[0]> = {}) => ({
  id: 'a1',
  name: 'Area 47 Wasser Areal',
  town: 'Ötztal-Bahnhof',
  tags: ['rafting'],
  visible: true,
  is_closed: false,
  ...over,
});

describe('normalizeText / tokenize', () => {
  it('faltet Umlaute und Diakritika', () => {
    expect(normalizeText('Ötztal-Bähnhof')).toBe('oetztal baehnhof');
    expect(normalizeText('Café Größl')).toBe('cafe groessl');
  });

  it('wirft Stopwords und Kurz-Token weg', () => {
    expect(tokenize('Die Rodelbahn am Berg GmbH')).toEqual(['rodelbahn', 'berg']);
  });
});

describe('diceSimilarity', () => {
  it('ist 1 bei identischen Namen', () => {
    expect(diceSimilarity('Rafting Imst', 'Rafting Imst')).toBe(1);
  });

  it('ist 0 ohne gemeinsame Token', () => {
    expect(diceSimilarity('Rodelbahn Wildkogel', 'Fiakerfahrt Wien')).toBe(0);
  });

  it('bestraft Zusatzworte nur milde', () => {
    expect(diceSimilarity('Rafting Imst', 'Rafting Imst Halbtagestour')).toBeGreaterThan(0.7);
  });
});

describe('isMatchEligible (Tag-Gate + Anzeige-Bedingung)', () => {
  it('akzeptiert nur kommerzielle Tags', () => {
    expect(isMatchEligible(activity({ tags: ['rafting'] }))).toBe(true);
    expect(isMatchEligible(activity({ tags: ['schwimmen'] }))).toBe(false);
    expect(isMatchEligible(activity({ tags: [] }))).toBe(false);
    expect(isMatchEligible(activity({ tags: null }))).toBe(false);
  });

  it('schliesst geschlossene und unsichtbare POIs aus', () => {
    expect(isMatchEligible(activity({ is_closed: true }))).toBe(false);
    expect(isMatchEligible(activity({ visible: false }))).toBe(false);
  });

  it('braucht einen Ort (ohne town gibt es kein Orts-Gate)', () => {
    expect(isMatchEligible(activity({ town: null }))).toBe(false);
  });

  it('die Tag-Liste bleibt klein und enthaelt keine Nicht-Taxonomie-Werte', () => {
    // Drift-Waechter: COMMERCIAL_TAGS ist eine bewusst kuratierte Teilmenge
    // der Activity-Taxonomie (src/lib/activities/taxonomy.ts).
    const taxonomyTags = new Set([
      'ausstellung', 'bergtour', 'bouldern', 'film', 'kajak', 'kanutour', 'kino',
      'klettern', 'langlauf', 'mountainbike', 'museumstour', 'radfahren', 'rafting',
      'reiten', 'sauna-special', 'schwimmen', 'segel-tour', 'ski', 'snowboard',
      'tennis', 'theater', 'thermen-special', 'wandern', 'wassersport', 'wellness-day',
    ]);
    for (const tag of COMMERCIAL_TAGS) expect(taxonomyTags.has(tag)).toBe(true);
    expect(COMMERCIAL_TAGS.length).toBeLessThanOrEqual(12);
  });
});

describe('locationMatches (Orts-Gate)', () => {
  it('verlangt ALLE bedeutungstragenden Ortstoken im Produkt-Text', () => {
    expect(
      locationMatches('Neusiedl am See', { productCode: 'P', title: 'Segeltörn Neusiedl See', locationText: null }),
    ).toBe(true);
    expect(
      locationMatches('Neusiedl am See', { productCode: 'P', title: 'Segeltörn Neusiedl', locationText: null }),
    ).toBe(false);
  });

  it('akzeptiert den Ort auch aus dem Destination-Feld', () => {
    expect(
      locationMatches('Imst', { productCode: 'P', title: 'Rafting Tour', locationText: 'Imst, Tirol' }),
    ).toBe(true);
  });

  it('lehnt Produkte ohne Ortsbezug ab', () => {
    expect(locationMatches('Imst', { productCode: 'P', title: 'Rafting Tour', locationText: null })).toBe(false);
    expect(locationMatches(null, { productCode: 'P', title: 'Imst', locationText: null })).toBe(false);
  });
});

describe('pickBestMatch', () => {
  it('matcht bei hoher Namens- und Ortsuebereinstimmung', () => {
    const result = pickBestMatch(activity({ name: 'Rafting Imst', town: 'Imst' }), [
      { productCode: 'P1', title: 'Rafting Imst', locationText: 'Imst' },
      { productCode: 'P2', title: 'Fiakerfahrt Wien', locationText: 'Wien' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.candidate.productCode).toBe('P1');
      expect(result.decision.score).toBeGreaterThanOrEqual(NAME_THRESHOLD);
    }
  });

  it('lehnt unter der Namens-Schwelle ab', () => {
    const result = pickBestMatch(activity({ name: 'Rodelbahn Wildkogel', town: 'Neukirchen' }), [
      { productCode: 'P1', title: 'Wildkogel Skipass Neukirchen Tagesticket Erwachsene', locationText: 'Neukirchen' },
    ]);
    expect(result).toEqual({ ok: false, reason: 'below-threshold' });
  });

  it('lehnt ab, wenn der Name passt aber der Ort NICHT (haeufigster Fehlgriff)', () => {
    // Gleichnamiges Angebot in einer anderen Region — genau der Fall, in
    // dem ein reiner Namens-Matcher eine falsche Box baut.
    const result = pickBestMatch(activity({ name: 'Wildwasser Rafting', town: 'Imst' }), [
      { productCode: 'P1', title: 'Wildwasser Rafting', locationText: 'Salzburg' },
    ]);
    expect(result).toEqual({ ok: false, reason: 'location-mismatch' });
  });

  it('lehnt mehrdeutige Treffer ab (Ambiguitaets-Guard)', () => {
    const result = pickBestMatch(activity({ name: 'Rafting Imst', town: 'Imst' }), [
      { productCode: 'P1', title: 'Rafting Imst', locationText: 'Imst' },
      { productCode: 'P2', title: 'Rafting Imst', locationText: 'Imst' },
    ]);
    expect(result).toEqual({ ok: false, reason: 'ambiguous' });
  });

  it('lehnt ohne kommerziellen Tag ab, auch bei perfektem Namen', () => {
    const result = pickBestMatch(activity({ name: 'Rafting Imst', town: 'Imst', tags: ['schwimmen'] }), [
      { productCode: 'P1', title: 'Rafting Imst', locationText: 'Imst' },
    ]);
    expect(result).toEqual({ ok: false, reason: 'no-commercial-tag' });
  });

  it('lehnt geschlossene POIs ab (keine Buchungs-Box fuer Geschlossenes)', () => {
    const result = pickBestMatch(activity({ name: 'Rafting Imst', town: 'Imst', is_closed: true }), [
      { productCode: 'P1', title: 'Rafting Imst', locationText: 'Imst' },
    ]);
    expect(result).toEqual({ ok: false, reason: 'not-displayable' });
  });

  it('lehnt ohne Kandidaten ab', () => {
    const result = pickBestMatch(activity({ name: 'Rafting Imst', town: 'Imst' }), []);
    expect(result).toEqual({ ok: false, reason: 'no-candidates' });
  });

  it('haelt die dokumentierten Schwellen ein', () => {
    expect(NAME_THRESHOLD).toBe(0.72);
    expect(AMBIGUITY_MARGIN).toBe(0.08);
  });
});

describe('buildSearchTerm', () => {
  it('kombiniert Name und Ort', () => {
    expect(buildSearchTerm(activity({ name: 'Rafting', town: 'Imst' }))).toBe('Rafting Imst');
  });
});
