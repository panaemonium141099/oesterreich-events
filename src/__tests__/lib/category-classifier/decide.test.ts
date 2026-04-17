import { describe, it, expect } from 'vitest';
import {
  classifyDeterministic,
  decideDeterministic,
  normalizeInput,
  CLASSIFIER_VERSION,
  extractSignals,
  aggregate,
} from '@/lib/category-classifier';

describe('decideDeterministic', () => {
  describe('deterministic accept — trusted raw tag (condition #1)', () => {
    it('maps Feratel "Musik" tag to rules_high / Musik', () => {
      const outcome = classifyDeterministic({
        title: 'Sommerfest mit Band',
        source_tags_raw: ['Musik'],
      });
      expect(outcome.category).toBe('Musik');
      expect(outcome.confidence).toBe('rules_high');
      expect(outcome.source).toBe('rules');
      expect(outcome.needsReview).toBe(false);
    });

    it('trusted raw tag wins over a conflicting title token', () => {
      const outcome = classifyDeterministic({
        title: 'Konzert im Stadion',
        source_tags_raw: ['Sport'],
      });
      expect(outcome.category).toBe('Sport');
      expect(outcome.confidence).toBe('rules_high');
    });
  });

  describe('deterministic accept — score + gap (condition #2)', () => {
    it('accepts rules_medium for Weihnachtsmarkt (strong phrase + token)', () => {
      const outcome = classifyDeterministic({
        title: 'Weihnachtsmarkt in Eisenstadt',
      });
      expect(outcome.category).toBe('Märkte');
      expect(outcome.confidence).toBe('rules_medium');
      expect(outcome.needsReview).toBe(false);
    });

    it('accepts rules_medium when Musik has strong phrase and title token', () => {
      const outcome = classifyDeterministic({
        title: 'Sommernachtskonzert der Wiener Philharmoniker',
      });
      expect(outcome.category).toBe('Musik');
      expect(outcome.confidence).toBe('rules_medium');
    });
  });

  describe('hard cases — deterministic returns needs-AI', () => {
    it('single ambiguous title token yields needs-AI', () => {
      const norm = normalizeInput({ title: 'Forest Rave 2026' });
      const decision = decideDeterministic(norm);
      expect(decision.needsAi).toBe(true);
    });

    it('Sonstiges fallback yields needs-AI with provisional Sonstiges', () => {
      const outcome = classifyDeterministic({ title: 'Irgendein Event' });
      expect(outcome.category).toBe('Sonstiges');
      expect(outcome.needsReview).toBe(true);
      expect(outcome.source).toBe('rules');
    });

    it('tie without strong phrase → needs-AI', () => {
      const norm = normalizeInput({ title: 'Kindertheater und Konzert' });
      const decision = decideDeterministic(norm);
      expect(decision.needsAi).toBe(true);
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
        source_name: 'wko',
      });
      expect(outcome.category).toBe('Wirtschaft');
    });
  });

  describe('source priors', () => {
    it('wien-clubs source produces trusted exact Nightlife', () => {
      const outcome = classifyDeterministic({
        title: 'Opening Night',
        source_name: 'wien-clubs',
      });
      expect(outcome.category).toBe('Nightlife');
      expect(outcome.confidence).toBe('rules_high');
    });

    it('pfarre organizer prior nudges to Religion', () => {
      // Title has a single liturgical token; source prior breaks the low-score
      // tie in favour of Religion. "Orgelkonzert" intentionally absent because
      // our taxonomy classifies concert-style liturgical music as Musik.
      const outcome = classifyDeterministic({
        title: 'Sonntagsmesse mit Predigt',
        organizer: 'Pfarre St. Stefan',
      });
      expect(outcome.category).toBe('Religion');
    });
  });

  describe('candidate output', () => {
    it('includes evidence strings for auditing', () => {
      const outcome = classifyDeterministic({
        title: 'Weihnachtsmarkt in Wien',
      });
      expect(outcome.candidates.length).toBeGreaterThan(0);
      expect(outcome.candidates[0].category).toBe('Märkte');
      expect(outcome.candidates[0].evidence?.some(e => e.startsWith('title_token'))).toBe(true);
    });
  });

  describe('signal extraction sanity', () => {
    it('tokenises German compounds via substring match', () => {
      const norm = normalizeInput({ title: 'Kindertheater für alle' });
      const scores = aggregate(extractSignals(norm));
      const familie = scores.find(s => s.category === 'Familie');
      expect(familie?.score ?? 0).toBeGreaterThan(0);
    });
  });

  describe('classifier version', () => {
    it('returns current classifier version on accepted decisions', () => {
      const outcome = classifyDeterministic({
        title: 'Weihnachtsmarkt in Eisenstadt',
      });
      expect(outcome.version).toBe(CLASSIFIER_VERSION);
    });
  });
});
