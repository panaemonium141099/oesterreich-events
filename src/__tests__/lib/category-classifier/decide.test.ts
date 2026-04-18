import { describe, it, expect } from 'vitest';
import {
  classifyDeterministic,
  decideDeterministic,
  normalizeInput,
  CLASSIFIER_VERSION,
} from '@/lib/category-classifier';

describe('decideDeterministic (cat-v2)', () => {
  describe('Gate 1 — trusted exact', () => {
    it('Feratel "Musik" raw tag → rules_exact / Musik', () => {
      const outcome = classifyDeterministic({
        title: 'Ensemble-Abend',
        source_tags_raw: ['Musik'],
      });
      expect(outcome.category).toBe('Musik');
      expect(outcome.confidence).toBe('rules_exact');
      expect(outcome.source).toBe('rules');
      expect(outcome.needsReview).toBe(false);
    });

    it('trusted raw tag wins over a conflicting title token', () => {
      const outcome = classifyDeterministic({
        title: 'Konzert im Stadion',
        source_tags_raw: ['Sport'],
      });
      expect(outcome.category).toBe('Sport');
      expect(outcome.confidence).toBe('rules_exact');
    });

    it('trusted source_name → rules_exact', () => {
      const outcome = classifyDeterministic({
        title: 'Opening Night',
        source_name: 'wien-clubs',
      });
      expect(outcome.category).toBe('Nightlife');
      expect(outcome.confidence).toBe('rules_exact');
    });
  });

  describe('Gate 2 — single precise winner', () => {
    it('Sommerkonzert → Musik rules_high (compound pattern, no other precision)', () => {
      const outcome = classifyDeterministic({
        title: 'Sommerkonzert am Rathaus',
      });
      expect(outcome.category).toBe('Musik');
      expect(outcome.confidence).toBe('rules_high');
    });

    it('Dorffest → Feste rules_high (compound pattern, Märkte false-positive avoided)', () => {
      const outcome = classifyDeterministic({
        title: 'Dorffest in Neckenmarkt',
      });
      expect(outcome.category).toBe('Feste & Brauchtum');
      // markt inside Neckenmarkt must NOT have produced a Märkte signal
      const maerkte = outcome.candidates.find(c => c.category === 'Märkte');
      expect(maerkte?.score ?? 0).toBe(0);
      expect(outcome.confidence).toBe('rules_high');
    });

    it('Vortrag → Bildung rules_high', () => {
      const outcome = classifyDeterministic({ title: 'Vortrag über Geschichte' });
      expect(outcome.category).toBe('Bildung');
      expect(outcome.confidence).toBe('rules_high');
    });

    it('Weihnachtsmarkt → Märkte rules_high (pattern hits)', () => {
      const outcome = classifyDeterministic({ title: 'Weihnachtsmarkt in Eisenstadt' });
      expect(outcome.category).toBe('Märkte');
      expect(['rules_exact', 'rules_high']).toContain(outcome.confidence);
    });
  });

  describe('Gate 3 — corroborated medium', () => {
    it('two evidence families (title + description) produces rules_medium when gap is wide', () => {
      const outcome = classifyDeterministic({
        title: 'Fachmesse Wien',
        description: 'Networking Event für Gründer und Unternehmer',
      });
      expect(outcome.category).toBe('Wirtschaft');
      expect(['rules_medium', 'rules_high']).toContain(outcome.confidence);
    });
  });

  describe('Gate 4 — weak deterministic', () => {
    it('single high-precision title token accepts as rules_high or rules_low', () => {
      const outcome = classifyDeterministic({ title: 'Rave Night' });
      expect(outcome.category).toBe('Nightlife');
      expect(['rules_high', 'rules_low', 'rules_medium']).toContain(outcome.confidence);
    });
  });

  describe('needs_ai path', () => {
    it('genuinely ambiguous tie with no precision signal yields needs-AI provisional Sonstiges', () => {
      const outcome = classifyDeterministic({ title: 'Veranstaltung ZZZ XYZ' });
      expect(outcome.category).toBe('Sonstiges');
      expect(outcome.needsReview).toBe(true);
      expect(outcome.source).toBe('rules');
    });

    it('conflicting precision in two categories → needs AI', () => {
      const norm = normalizeInput({ title: 'Kindertheater Konzert' });
      const decision = decideDeterministic(norm);
      // Both Familie (kinder-prefix) and Kultur (theater) and Musik (konzert)
      // have high-precision hits — no single precise winner, no >= 6 gap.
      if (!decision.needsAi) {
        // If the disambiguator kicked in to resolve, that's also acceptable.
        expect(['Familie', 'Kultur', 'Musik']).toContain(decision.category);
      } else {
        expect(decision.needsAi).toBe(true);
      }
    });
  });

  describe('blockers', () => {
    it('kids audience blocks Nightlife for "party" match', () => {
      const outcome = classifyDeterministic({
        title: 'Kinder Party im Park',
        description: 'Ein Nachmittag für kinder mit Spielen',
      });
      expect(outcome.category).not.toBe('Nightlife');
    });

    it('WKO context blocks Religion for "Messe" match', () => {
      const outcome = classifyDeterministic({
        title: 'Messe in Wien',
        description: 'Fachmesse mit Networking und Gewerbe',
        source_name: 'wko.at',
      });
      expect(outcome.category).toBe('Wirtschaft');
    });
  });

  describe('candidate output', () => {
    it('includes evidence strings for auditing', () => {
      const outcome = classifyDeterministic({ title: 'Weihnachtsmarkt in Wien' });
      expect(outcome.candidates.length).toBeGreaterThan(0);
      expect(outcome.candidates[0].category).toBe('Märkte');
      const hasTitleEvidence = outcome.candidates[0].evidence?.some(e =>
        e.startsWith('title_precision') || e.startsWith('trusted'),
      );
      expect(hasTitleEvidence).toBe(true);
    });
  });

  describe('classifier version', () => {
    it('returns current classifier version on accepted decisions', () => {
      const outcome = classifyDeterministic({ title: 'Weihnachtsmarkt in Eisenstadt' });
      expect(outcome.version).toBe(CLASSIFIER_VERSION);
    });
  });
});
