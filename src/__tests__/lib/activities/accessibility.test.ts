import { describe, it, expect } from 'vitest';
import {
  ACCESSIBILITY_FEATURES,
  accessibilityFeatureLabel,
  detectAccessibilityFeatures,
  detectAccessibilityFromText,
  detectAccessibilityFromThemes,
  buildDesklineAccessibility,
  isAccessibilityFeature,
  suppressSharedTextEvidence,
} from '@/lib/activities/accessibility';

describe('detectAccessibilityFromThemes', () => {
  it('erkennt die Deskline-holidayThemes "Barrierefrei" und "Rollstuhlgängig"', () => {
    expect(detectAccessibilityFromThemes(['Sommer', 'Barrierefrei'])).toEqual(['Barrierefrei']);
    expect(detectAccessibilityFromThemes(['Rollstuhlgängig', 'Familie'])).toEqual(['Rollstuhlgängig']);
    expect(detectAccessibilityFromThemes(['Sommer', 'Winter'])).toEqual([]);
  });
});

describe('detectAccessibilityFromText', () => {
  it('positive Formulierungen', () => {
    expect(detectAccessibilityFromText('Das Museum ist barrierefrei zugänglich.')).toBe(true);
    expect(detectAccessibilityFromText('Rollstuhlgerechter Zugang und Behindertenparkplatz')).toBe(true);
    expect(detectAccessibilityFromText('Der Weg ist rollstuhltauglich und stufenlos.')).toBe(true);
    expect(detectAccessibilityFromText('Barrierefreier Seezugang mit Badelift')).toBe(true);
  });

  it('Verneinung schlägt den Treffer', () => {
    expect(detectAccessibilityFromText('Das Gebäude ist nicht barrierefrei.')).toBe(false);
    expect(detectAccessibilityFromText('Leider kein barrierefreier Zugang möglich')).toBe(false);
    expect(detectAccessibilityFromText('Keine Barrierefreiheit')).toBe(false);
    expect(detectAccessibilityFromText('nicht rollstuhlgerecht')).toBe(false);
  });

  it('gemischter Text: eine positive Aussage genügt, wenn nicht alles verneint ist', () => {
    expect(
      detectAccessibilityFromText('Erdgeschoss barrierefrei, der Turm ist nicht barrierefrei.'),
    ).toBe(true);
  });

  it('ohne Signal false', () => {
    expect(detectAccessibilityFromText('Schöner Wanderweg durch den Wald.')).toBe(false);
    expect(detectAccessibilityFromText('')).toBe(false);
    expect(detectAccessibilityFromText(null)).toBe(false);
  });
});

describe('detectAccessibilityFeatures', () => {
  it('leitet Merkmale aus dem Text ab', () => {
    const f = detectAccessibilityFeatures(
      'Rollstuhlgerecht, Behindertenparkplatz und barrierefreies WC vorhanden. Führungen in Gebärdensprache, Tastmodelle für blinde Gäste, Leihrollstuhl an der Kassa, Aufzug in alle Stockwerke. Assistenzhunde willkommen. Texte in Leichter Sprache.',
    );
    expect(f).toEqual([
      'rollstuhl',
      'parkplatz',
      'wc',
      'lift',
      'leihrollstuhl',
      'blind',
      'gehoerlos',
      'leichte-sprache',
      'assistenzhund',
    ]);
  });

  it('Badelift und Schwimmrollstuhl sind Wasser-Merkmale', () => {
    expect(detectAccessibilityFeatures('Einstiegsrampe, Badelift und Schwimmrollstuhl')).toEqual([
      'rollstuhl',
      'badelift',
    ]);
  });

  it('jedes Merkmal hat ein Label in beiden Sprachen', () => {
    for (const feature of ACCESSIBILITY_FEATURES) {
      expect(accessibilityFeatureLabel(feature, 'de')).not.toBe('');
      expect(accessibilityFeatureLabel(feature, 'en')).not.toBe('');
      expect(isAccessibilityFeature(feature)).toBe(true);
    }
    expect(isAccessibilityFeature('wlan')).toBe(false);
  });
});

describe('buildDesklineAccessibility', () => {
  it('Thema schlägt Text: basis deskline-theme', () => {
    expect(
      buildDesklineAccessibility(['Barrierefrei', 'Sommer'], ['Schöner Ort. Rollstuhlgerechtes WC.']),
    ).toEqual({ basis: 'deskline-theme', themes: ['Barrierefrei'], features: ['rollstuhl', 'wc'] });
  });

  it('nur Text: basis deskline-text', () => {
    expect(buildDesklineAccessibility([], ['Der Zugang ist barrierefrei.'])).toEqual({
      basis: 'deskline-text',
      themes: [],
      features: [],
    });
  });

  it('ohne Signal oder nur Verneinung null', () => {
    expect(buildDesklineAccessibility([], ['Nicht barrierefrei.'])).toBeNull();
    expect(buildDesklineAccessibility(['Sommer'], [])).toBeNull();
  });
});

describe('suppressSharedTextEvidence', () => {
  const boiler =
    'Waldhausen liegt in einer reizvollen Hügellandschaft. Der Badesee, rollstuhltaugliche Wanderwege und Kulturangebote machen den Urlaub unvergesslich.';
  const text = { basis: 'deskline-text' as const, themes: [], features: [] };
  const rows = [
    { name: 'A', description: boiler, description_short: null, accessibility: text },
    { name: 'B', description: boiler, description_short: null, accessibility: text },
    { name: 'C', description: boiler, description_short: 'Das Museum selbst ist barrierefrei.', accessibility: text },
    { name: 'D', description: boiler, description_short: null, accessibility: { basis: 'deskline-theme' as const, themes: ['Barrierefrei'], features: [] } },
    { name: 'E', description: 'Eigener Text: rollstuhlgerechter Eingang.', description_short: null, accessibility: { ...text, features: ['rollstuhl' as const] } },
  ];

  it('nimmt Text-Befunde zurück, die nur aus einem geteilten Ortstext stammen', () => {
    const out = suppressSharedTextEvidence(rows);
    expect(out.map((r) => r.accessibility?.basis ?? null)).toEqual([
      null,
      null,
      'deskline-text', // C hat zusätzlich einen eigenen Satz
      'deskline-theme', // Themen-Befunde bleiben immer
      'deskline-text', // E teilt nichts
    ]);
  });

  it('unter der Schwelle bleibt alles', () => {
    const out = suppressSharedTextEvidence(rows.slice(0, 2));
    expect(out.every((r) => r.accessibility !== null)).toBe(true);
  });
});
