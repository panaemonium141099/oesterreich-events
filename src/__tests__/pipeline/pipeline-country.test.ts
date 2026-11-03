/**
 * AT und DE als getrennte Systeme (scrape-events.yml / scrape-events-de.yml):
 * Land des Laufs, Filter und welche Schritte in welchem Lauf laufen.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AT_ONLY_STEPS, forCountry, inRunCountry, pipelineCountry, pipelineWorkflowName, sourceCountry, stepRunsFor } from '@/lib/pipeline/pipeline-country';

describe('pipelineCountry', () => {
  it('liest --country vor PIPELINE_COUNTRY, ohne Angabe alle Länder', () => {
    expect(pipelineCountry(['--country', 'de'], {})).toBe('DE');
    expect(pipelineCountry([], { PIPELINE_COUNTRY: 'AT' })).toBe('AT');
    expect(pipelineCountry(['--country', 'DE'], { PIPELINE_COUNTRY: 'AT' })).toBe('DE');
    expect(pipelineCountry([], {})).toBeNull();
  });

  it('ein unbekanntes Land bricht ab, statt still alle Zeilen anzufassen', () => {
    expect(() => pipelineCountry(['--country', 'CH'], {})).toThrow(/CH/);
  });
});

describe('Filter je Land', () => {
  const calls: string[] = [];
  const q = {
    eq(c: string, v: string) { calls.push(`eq ${c} ${v}`); return q; },
    neq(c: string, v: string) { calls.push(`neq ${c} ${v}`); return q; },
  };

  it('DE nur DE, AT alles außer DE (auch CH), ohne Land kein Filter', () => {
    forCountry(q, 'DE');
    forCountry(q, 'AT');
    forCountry(q, null);
    expect(calls).toEqual(['eq country DE', 'neq country DE']);
    expect(inRunCountry('CH', 'AT')).toBe(true);
    expect(inRunCountry('CH', 'DE')).toBe(false);
    expect(inRunCountry('DE', 'DE')).toBe(true);
    expect(inRunCountry('DE', null)).toBe(true);
  });

  it('Quellen: DE-Adapter heißen de-…, Eventim und alle übrigen zählen zu AT', () => {
    expect(sourceCountry('de-ikiss')).toBe('DE');
    expect(sourceCountry('Eventim')).toBe('AT');
    expect(sourceCountry('gem2go')).toBe('AT');
  });
});

describe('Schritte je Lauf', () => {
  it('Website- und Datenbank-Schritte nur im AT-Lauf, die Landesschritte in beiden', () => {
    for (const step of AT_ONLY_STEPS) {
      expect(stepRunsFor(step, 'AT'), step).toBe(true);
      expect(stepRunsFor(step, 'DE'), step).toBe(false);
      expect(stepRunsFor(step, null), step).toBe(true);
    }
    for (const step of ['categorization_backfill', 'scoring', 'withdrawal', 'admission_recheck', 'dedup', 'dedup_audit', 'coverage']) {
      expect(stepRunsFor(step, 'DE'), step).toBe(true);
      expect(stepRunsFor(step, 'AT'), step).toBe(true);
    }
  });

  it('Alarm-Mail und Bericht tragen je System einen eigenen Namen', () => {
    expect(pipelineWorkflowName('AT')).toBe('scrape-pipeline');
    expect(pipelineWorkflowName(null)).toBe('scrape-pipeline');
    expect(pipelineWorkflowName('DE')).toBe('scrape-pipeline-de');
  });
});

describe('Wächter: jeder Landesschritt filtert sein Land', () => {
  // Ein Schritt, der im DE-Lauf ohne Filter läuft, fasst AT-Zeilen an (und umgekehrt).
  const scripts = ['calculate-scores', 'categorize-events', 'withdraw-stale-events', 'admission-recheck', 'dedup', 'dedup-audit', 'coverage-report'];
  it.each(scripts)('%s liest das Land des Laufs', (name) => {
    const src = readFileSync(join(process.cwd(), 'src/scripts', `${name}.ts`), 'utf8');
    expect(src).toMatch(/pipelineCountry\(/);
    expect(src).toMatch(/forCountry\(/);
  });
});
