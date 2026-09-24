import { describe, expect, it } from 'vitest';
import { LEXICON, NEGATIVE_BLOCKERS, DISAMBIGUATOR_PAIRS } from '@/lib/category-classifier/rules';
import { PRIMARY_CATEGORY_SET } from '@/lib/category-classifier/enrichment-taxonomy';
import { CATEGORIES } from '@/lib/category-classifier/taxonomy';
import { trustedSourceEntries } from '@/lib/category-classifier/source-registry';

// Befund 2026-09-24: Seit der Taxonomie v3 (April) schlug der Classifier mit
// v3-Namen in einem nach Altnamen geordneten Regelwerk nach und fand für 10
// von 12 Kategorien nichts; die KI-Anreicherung verdeckte das bis Juli.
// 39 % aller Events landeten in „Sonstiges". Diese Tests verbieten, dass
// Classifier-Bausteine andere als v3-Kategorien verwenden.

const isV3 = (c: string) => PRIMARY_CATEGORY_SET.has(c as never);

describe('Classifier spricht nur Taxonomie v3', () => {
  it('CATEGORIES sind genau die v3-Hauptkategorien', () => {
    expect(CATEGORIES.filter(c => !isV3(c))).toEqual([]);
  });

  it('jede Kategorie außer Community & Freizeit hat ein Stichwort-Regelwerk', () => {
    const ohne = CATEGORIES.filter(c => c !== 'Community & Freizeit' && !LEXICON[c]);
    expect(ohne).toEqual([]);
    expect(Object.keys(LEXICON).filter(k => !isV3(k))).toEqual([]);
  });

  it('Negativ-Regeln und Paar-Unterscheidungen nutzen v3-Namen', () => {
    expect(NEGATIVE_BLOCKERS.map(b => b.target).filter(t => !isV3(t))).toEqual([]);
    expect(DISAMBIGUATOR_PAIRS.flatMap(p => p.pair).filter(t => !isV3(t))).toEqual([]);
  });

  it('Quellen-Zuordnung nutzt v3-Namen', () => {
    const werte = trustedSourceEntries().map(([, c]) => c as string);
    expect(werte.length).toBeGreaterThan(0);
    expect([...new Set(werte.filter(w => !isV3(w)))]).toEqual([]);
  });
});
