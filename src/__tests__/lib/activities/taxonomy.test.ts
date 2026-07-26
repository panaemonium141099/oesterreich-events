import { describe, it, expect } from 'vitest';
import {
  TOPIC_WHITELIST,
  EXCLUDED_TOPICS,
  mapTopics,
  normalizeTopicName,
  isImportableTopicResult,
} from '@/lib/activities/taxonomy';
import { TAG_SET } from '@/lib/category-classifier/enrichment-taxonomy';

describe('TOPIC_WHITELIST (Whitelist-Review)', () => {
  it('enthaelt mindestens 30 gemappte Topics (Task-1-Acceptance)', () => {
    expect(Object.keys(TOPIC_WHITELIST).length).toBeGreaterThanOrEqual(30);
  });

  it('jeder Tag ist ein bestehender TAGS-Wert aus enrichment-taxonomy', () => {
    for (const [topic, mapping] of Object.entries(TOPIC_WHITELIST)) {
      for (const tag of mapping.tags) {
        expect(TAG_SET.has(tag), `${topic} -> ${tag}`).toBe(true);
      }
    }
  });

  it('jeder Eintrag traegt ein gueltiges setting', () => {
    for (const mapping of Object.values(TOPIC_WHITELIST)) {
      expect(['indoor', 'outdoor', 'mixed']).toContain(mapping.setting);
    }
  });

  it('alle Keys sind bereits normalisiert (Lookup-Invariante)', () => {
    for (const key of Object.keys(TOPIC_WHITELIST)) {
      expect(normalizeTopicName(key)).toBe(key);
    }
  });

  it('Whitelist und Blockliste ueberschneiden sich nicht', () => {
    for (const key of Object.keys(TOPIC_WHITELIST)) {
      expect(EXCLUDED_TOPICS.has(key), key).toBe(false);
    }
  });

  it('Blocklisten-Keys sind ebenfalls normalisiert', () => {
    for (const key of EXCLUDED_TOPICS) {
      expect(normalizeTopicName(key)).toBe(key);
    }
  });
});

describe('normalizeTopicName', () => {
  it('lowercased, trimmt und kollabiert Whitespace', () => {
    expect(normalizeTopicName('  FREIBAD ')).toBe('freibad');
    expect(normalizeTopicName('Wanderbus ')).toBe('wanderbus');
    expect(normalizeTopicName('Stand  Up   Paddlen')).toBe('stand up paddlen');
  });

  it('behaelt Umlaute (echte Deskline-Namen)', () => {
    expect(normalizeTopicName('Bogen schießen')).toBe('bogen schießen');
    expect(normalizeTopicName('Schlösser/Burgen')).toBe('schlösser/burgen');
  });
});

describe('mapTopics', () => {
  it('mappt reale Mountaincart-Topics (Deskline gastein, live 2026-07-24)', () => {
    const result = mapTopics([
      'Kartsport/Kartbahn',
      'Bergbahn/Seilbahn',
      'Ausflugsziel für Familien/Kinder',
      'GasteinCard Broschüre',
      'Kart fahren',
    ]);
    // Topic-Namenslisten sind dedupliziert + sortiert (reihenfolge-stabil).
    expect(result.matchedTopics).toEqual([
      'Bergbahn/Seilbahn',
      'Kart fahren',
      'Kartsport/Kartbahn',
    ]);
    // Kartbahn (mixed) + Bergbahn (outdoor) -> Konflikt -> mixed
    expect(result.setting).toBe('mixed');
    expect(result.unmappedTopics).toEqual([
      'Ausflugsziel für Familien/Kinder',
      'GasteinCard Broschüre',
    ]);
    expect(result.excludedTopics).toEqual([]);
    expect(isImportableTopicResult(result)).toBe(true);
  });

  it('alle Topics indoor -> indoor', () => {
    const result = mapTopics(['Museum', 'Galerie']);
    expect(result.setting).toBe('indoor');
    expect(result.tags).toEqual(['ausstellung', 'museumstour']);
  });

  it('alle Topics outdoor -> outdoor', () => {
    const result = mapTopics(['Freibad', 'Badesee/Baggersee']);
    expect(result.setting).toBe('outdoor');
    expect(result.tags).toEqual(['schwimmen']);
  });

  it('indoor+outdoor-Konflikt -> mixed', () => {
    expect(mapTopics(['Hallenbad', 'Freibad']).setting).toBe('mixed');
  });

  it('ein mixed-Topic reicht fuer mixed', () => {
    expect(mapTopics(['Freibad', 'Erlebnisbad']).setting).toBe('mixed');
  });

  it('keine gemappten Topics -> setting null + skip', () => {
    const result = mapTopics(['GasteinCard Broschüre', 'Hochkönigcam']);
    expect(result.setting).toBeNull();
    expect(result.tags).toEqual([]);
    expect(result.matchedTopics).toEqual([]);
    expect(result.unmappedTopics).toEqual(['GasteinCard Broschüre', 'Hochkönigcam']);
    expect(isImportableTopicResult(result)).toBe(false);
  });

  it('Blocklisten-Topic verhindert Import trotz Whitelist-Treffer (Sportshop-Falle)', () => {
    const result = mapTopics(['Ski fahren', 'Sportgeschäft']);
    expect(result.matchedTopics).toEqual(['Ski fahren']);
    expect(result.excludedTopics).toEqual(['Sportgeschäft']);
    expect(isImportableTopicResult(result)).toBe(false);
  });

  it('Gastro wird nicht importiert (Restaurant/Buschenschank)', () => {
    for (const topic of ['Restaurant', 'Buschenschank/Heuriger', 'Geschäfte/Shops', 'E-Bike Ladestation']) {
      const result = mapTopics([topic]);
      expect(result.matchedTopics, topic).toEqual([]);
      expect(result.excludedTopics, topic).toEqual([topic]);
      expect(isImportableTopicResult(result)).toBe(false);
    }
  });

  it('Ergebnis ist reihenfolge- und duplikat-unabhaengig (auch die Topic-Listen)', () => {
    const a = mapTopics(['Museum', 'Kino', 'Freibad', 'Restaurant', 'Hochkönigcam']);
    const b = mapTopics(['Hochkönigcam', 'Freibad', 'Restaurant', 'Museum', 'Kino', 'Museum', ' museum ']);
    expect(a).toEqual(b);
    expect(a.tags).toEqual([...a.tags].sort());
    expect(a.matchedTopics).toEqual(['Freibad', 'Kino', 'Museum']);
    expect(a.excludedTopics).toEqual(['Restaurant']);
    expect(a.unmappedTopics).toEqual(['Hochkönigcam']);
  });

  it('dedupliziert Tags ueber mehrere Topics', () => {
    const result = mapTopics(['Wandern', 'Wanderweg/-e', 'Themenwanderung']);
    expect(result.tags).toEqual(['wandern']);
  });

  it('Lookup ist robust gegen Case/Whitespace-Varianten', () => {
    const result = mapTopics(['  FREIBAD ', 'stand uppaddling']);
    expect(result.matchedTopics).toHaveLength(2);
    expect(result.setting).toBe('outdoor');
  });

  it('Spelling-Wahl ist reihenfolge-unabhaengig bei Case/Whitespace-Varianten', () => {
    const a = mapTopics([' museum ', 'Museum']);
    const b = mapTopics(['Museum', ' museum ']);
    expect(a).toEqual(b);
    expect(a.matchedTopics).toEqual(['Museum']); // codepoint-kleinste Anzeigeform
  });

  it('crasht nicht bei Nicht-String-Topics (Fremddaten-Payload)', () => {
    const result = mapTopics([null, undefined, 42, {}, ['Freibad'], 'Freibad', '']);
    expect(result.matchedTopics).toEqual(['Freibad']);
    expect(result.setting).toBe('outdoor');
    expect(result.unmappedTopics).toEqual([]);
    expect(result.excludedTopics).toEqual([]);
  });

  it('crasht nicht bei Nicht-Array-Payloads (null/Objekt/Skalar -> leeres Ergebnis)', () => {
    for (const bad of [null, undefined, 'Freibad', 42, { topics: ['Freibad'] }]) {
      const result = mapTopics(bad);
      expect(result.matchedTopics).toEqual([]);
      expect(result.excludedTopics).toEqual([]);
      expect(result.unmappedTopics).toEqual([]);
      expect(result.tags).toEqual([]);
      expect(result.setting).toBeNull();
      expect(isImportableTopicResult(result)).toBe(false);
    }
  });
});
