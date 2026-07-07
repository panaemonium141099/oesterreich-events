import { describe, it, expect } from 'vitest';
import {
  parseQuery,
  validateIntent,
  intentIsEmpty,
  rankCandidates,
  scoreCandidate,
  detectLocationRegex,
  type SearchIntent,
  type CandidateEvent,
} from '@/lib/search/smart-query';

// Fester "jetzt"-Anker: Mittwoch 2026-07-08 12:00 lokal
const NOW = new Date(2026, 6, 8, 12, 0, 0);

const emptyIntent: SearchIntent = {
  categories: [], tags: [], audiences: [], occasions: [], vibes: [],
  searchTerms: [], location: null,
};

describe('parseQuery', () => {
  it('erkennt "heute" als Tagesfenster', () => {
    const { filters } = parseQuery('Ich will heute abend saufen gehen', NOW);
    expect(filters.afterDate?.getDate()).toBe(8);
    expect(filters.beforeDate?.getDate()).toBe(8);
    expect(filters.keywordSignals).toContain('today');
  });

  it('erkennt "wochenende" als Sa–So-Fenster', () => {
    const { filters } = parseQuery('Techno-Party am Wochenende', NOW);
    // Mittwoch 8.7. → Samstag 11.7. bis Sonntag 12.7.
    expect(filters.afterDate?.getDay()).toBe(6);
    expect(filters.beforeDate?.getDay()).toBe(0);
    expect(filters.afterDate?.getDate()).toBe(11);
  });

  it('"wochenende" am Samstag = laufendes Wochenende (heute)', () => {
    const sat = new Date(2026, 6, 11, 14, 0, 0); // Samstag 11.7.
    const { filters } = parseQuery('party am wochenende', sat);
    expect(filters.afterDate?.getDate()).toBe(11);
    expect(filters.beforeDate?.getDate()).toBe(12);
  });

  it('"wochenende" am Sonntag = heutiger Sonntag, NICHT nächstes Wochenende', () => {
    const sun = new Date(2026, 6, 12, 14, 0, 0); // Sonntag 12.7.
    const { filters } = parseQuery('party am wochenende', sun);
    expect(filters.afterDate?.getDate()).toBe(12);
    expect(filters.beforeDate?.getDate()).toBe(12);
  });

  it('erkennt Preis-Signale (gratis schlägt günstig)', () => {
    expect(parseQuery('gratis konzert', NOW).filters.maxPriceTier).toBe('gratis');
    expect(parseQuery('billig fortgehen', NOW).filters.maxPriceTier).toBe('günstig');
  });

  it('strippt Datum/Preis/Füllwörter aus dem Intent-Text', () => {
    const { text } = parseQuery('Ich will heute gratis Jazz hören', NOW);
    expect(text.toLowerCase()).not.toContain('heute');
    expect(text.toLowerCase()).not.toContain('gratis');
    expect(text.toLowerCase()).toContain('jazz');
  });

  it('erkennt Stadt vor Bundesland (eisenstadt → districts + bundesland)', () => {
    const loc = detectLocationRegex('was geht in Eisenstadt');
    expect(loc).toEqual({ districts: ['eisenstadt'], bundesland: 'burgenland' });
  });

  it('Stadt matched Stadt + Umland (graz → graz (stadt) + graz-umgebung)', () => {
    const loc = detectLocationRegex('fortgehen in graz');
    expect(loc).toEqual({ districts: ['graz (stadt)', 'graz-umgebung'], bundesland: 'steiermark' });
  });

  it('Wien matched nur auf Bundesland-Ebene', () => {
    const loc = detectLocationRegex('konzerte in wien');
    expect(loc).toEqual({ districts: null, bundesland: 'wien' });
  });

  it('strippt erkannten Ort aus dem Intent-Text (sonst würgt die Wort-UND-Suche)', () => {
    const { text } = parseQuery('konzert in wien', NOW);
    expect(text).toBe('konzert');
  });

  it('reine Filter-Query ("heute in wien") → leerer Intent-Text, KEIN raw-Fallback', () => {
    const { text, filters } = parseQuery('heute in wien', NOW);
    expect(text).toBe('');
    expect(filters.location?.bundesland).toBe('wien');
    expect(filters.keywordSignals).toContain('today');
  });
});

describe('validateIntent (Whitelist-Guard)', () => {
  it('verwirft Werte außerhalb der Taxonomie', () => {
    const intent = validateIntent({
      categories: ['Musik', 'Erfundene Kategorie'],
      tags: ['jazz', 'nicht-existenter-tag'],
      audiences: ['studenten', 'aliens'],
      occasions: ['date-night'],
      vibes: ['entspannt'],
      searchTerms: ['Bilderbuch Konzert'],
      location: 'graz',
    });
    expect(intent.categories).toEqual(['Musik']);
    expect(intent.tags).toEqual(['jazz']);
    expect(intent.audiences).toEqual(['studenten']);
    expect(intent.occasions).toEqual(['date-night']);
    expect(intent.searchTerms).toEqual(['Bilderbuch Konzert']);
  });

  it('übersteht Müll-Input ohne Wurf', () => {
    expect(intentIsEmpty(validateIntent(null))).toBe(true);
    expect(intentIsEmpty(validateIntent('kaputt'))).toBe(true);
    expect(intentIsEmpty(validateIntent({ categories: 42, tags: {} }))).toBe(true);
  });

  it('sanitisiert searchTerms (Länge, Zeichen, Dedupe, max 6)', () => {
    const intent = validateIntent({
      searchTerms: ['a', 'ok term', 'ok term', '<script>alert(1)</script>', 'x'.repeat(100),
        't1', 't2', 't3', 't4', 't5'],
    });
    expect(intent.searchTerms).not.toContain('a');            // zu kurz
    expect(intent.searchTerms.filter(t => t === 'ok term')).toHaveLength(1);
    expect(intent.searchTerms.every(t => !t.includes('<'))).toBe(true);
    expect(intent.searchTerms.length).toBeLessThanOrEqual(6);
  });
});

describe('scoreCandidate / rankCandidates', () => {
  const intent: SearchIntent = {
    categories: ['Musik'],
    tags: ['jazz'],
    audiences: ['studenten'],
    occasions: [],
    vibes: [],
    searchTerms: ['jazz'],
    location: null,
  };

  const base: CandidateEvent = {
    id: 'a', category: null, tags: null, audience: null, vibe: null,
    occasion_tags: null, event_score: 0,
  };

  it('Kategorie+Text-Treffer schlägt reinen Score', () => {
    const full: CandidateEvent = { ...base, id: 'hit', category: 'Musik', tags: ['jazz'], _textHit: true };
    const scoreOnly: CandidateEvent = { ...base, id: 'meh', event_score: 100 };
    expect(scoreCandidate(full, intent)).toBeGreaterThan(0.7);
    expect(scoreCandidate(full, intent)).toBeGreaterThan(scoreCandidate(scoreOnly, intent));
  });

  it('dedupliziert per id und behält textHit', () => {
    const ranked = rankCandidates(
      [
        { ...base, id: 'x', category: 'Musik' },
        { ...base, id: 'x', category: 'Musik', _textHit: true },
        { ...base, id: 'y' },
      ],
      intent,
      10,
    );
    expect(ranked).toHaveLength(2);
    const x = ranked.find(r => r.id === 'x')!;
    expect(x._similarity).toBeGreaterThan(0.6); // Kategorie + Text
  });

  it('respektiert das Limit und sortiert absteigend', () => {
    const candidates: CandidateEvent[] = Array.from({ length: 30 }, (_, i) => ({
      ...base, id: `e${i}`, event_score: i * 3,
    }));
    const ranked = rankCandidates(candidates, emptyIntent, 5);
    expect(ranked).toHaveLength(5);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]._similarity).toBeGreaterThanOrEqual(ranked[i]._similarity);
    }
  });

  it('_similarity ist gedeckelt (<1)', () => {
    const maxed: CandidateEvent = {
      id: 'max', category: 'Musik', tags: ['jazz'], audience: ['studenten'],
      vibe: null, occasion_tags: null, event_score: 100, _textHit: true,
    };
    expect(scoreCandidate(maxed, intent)).toBeLessThan(1);
  });
});
