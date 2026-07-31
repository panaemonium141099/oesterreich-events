import { describe, it, expect } from 'vitest';
import {
  parseQuery,
  validateIntent,
  intentIsEmpty,
  rankCandidates,
  scoreCandidate,
  detectLocationRegex,
  detectActivityIntent,
  detectGemeindeInQuery,
  extractActivitySearchTerm,
  rankActivityCandidates,
  emptySearchIntent,
  isBundeslandId,
  BUNDESLAND_IDS,
  BUNDESLAENDER_KEYS,
  type SearchIntent,
  type CandidateEvent,
  type ActivityCandidate,
} from '@/lib/search/smart-query';

// Fester "jetzt"-Anker: Mittwoch 2026-07-08 12:00 lokal
const NOW = new Date(2026, 6, 8, 12, 0, 0);

const emptyIntent: SearchIntent = {
  categories: [], tags: [], audiences: [], occasions: [], vibes: [],
  searchTerms: [], location: null, contentTypes: ['event'],
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

  it('erkennt Wochentag "samstag" als Tagesfenster (nächstes Vorkommen)', () => {
    // Mittwoch 8.7. → Samstag 11.7.
    const { filters, text } = parseQuery('konzert am samstag', NOW);
    expect(filters.afterDate?.getDate()).toBe(11);
    expect(filters.afterDate?.getDay()).toBe(6);
    expect(filters.beforeDate?.getDate()).toBe(11);
    expect(filters.keywordSignals).toContain('weekday:samstag');
    expect(text.toLowerCase()).not.toContain('samstag');
  });

  it('"freitagabend" matcht den Wochentag mit Suffix', () => {
    // Mittwoch 8.7. → Freitag 10.7.
    const { filters } = parseQuery('was geht freitagabend', NOW);
    expect(filters.afterDate?.getDate()).toBe(10);
    expect(filters.keywordSignals).toContain('weekday:freitag');
  });

  it('Wochentag = heute → heutiges Fenster', () => {
    // NOW ist Mittwoch 8.7.
    const { filters } = parseQuery('was geht am mittwoch', NOW);
    expect(filters.afterDate?.getDate()).toBe(8);
    expect(filters.beforeDate?.getDate()).toBe(8);
  });

  it('"heute"/"wochenende" gewinnen vor Wochentag', () => {
    expect(parseQuery('heute samstag party', NOW).filters.keywordSignals).toContain('today');
    expect(parseQuery('am wochenende samstag party', NOW).filters.keywordSignals).toContain('weekend');
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
    contentTypes: ['event'],
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

// ════════════════════════════════════════════════════════════════════
// fn-18.6 — Aktivitäts-Pfad
// ════════════════════════════════════════════════════════════════════

describe('Bundesland-SoT (fn-18.6)', () => {
  it('kennt alle 9 kanonischen IDs', () => {
    expect(BUNDESLAND_IDS).toHaveLength(9);
    for (const id of ['burgenland', 'kaernten', 'niederoesterreich', 'oberoesterreich',
                      'salzburg', 'steiermark', 'tirol', 'vorarlberg', 'wien']) {
      expect(BUNDESLAND_IDS).toContain(id);
      expect(isBundeslandId(id)).toBe(true);
      expect(BUNDESLAENDER_KEYS[id]).toBe(id);
    }
    expect(isBundeslandId('bayern')).toBe(false);
    expect(isBundeslandId(null)).toBe(false);
  });

  it('REGRESSION: Städte gewinnen weiterhin gegen die erweiterte Bundesland-Map', () => {
    // salzburg/wien stehen jetzt AUCH in BUNDESLAENDER_KEYS — detectLocationRegex
    // prüft CITIES zuerst, das Event-Verhalten muss identisch bleiben.
    expect(detectLocationRegex('konzert in salzburg')?.districts)
      .toEqual(['salzburg (stadt)', 'salzburg-umgebung']);
    expect(detectLocationRegex('konzert in wien')).toEqual({ districts: null, bundesland: 'wien' });
    expect(detectLocationRegex('konzert im burgenland'))
      .toEqual({ districts: null, bundesland: 'burgenland' });
  });
});

describe('validateIntent — contentTypes-Normalisierung (fn-18.6)', () => {
  it('Feld fehlt → ["event"]', () => {
    expect(validateIntent({ categories: ['Musik'] }).contentTypes).toEqual(['event']);
  });

  it('leeres Array → ["event"]', () => {
    expect(validateIntent({ contentTypes: [] }).contentTypes).toEqual(['event']);
  });

  it('nur unbekannte Werte → ["event"]', () => {
    expect(validateIntent({ contentTypes: ['poi', 'venue', 42] }).contentTypes).toEqual(['event']);
  });

  it('übernimmt gültige Werte, dedupliziert', () => {
    expect(validateIntent({ contentTypes: ['activity'] }).contentTypes).toEqual(['activity']);
    expect(validateIntent({ contentTypes: ['activity', 'activity', 'event'] }).contentTypes)
      .toEqual(['activity', 'event']);
  });

  it('Müll-Input bleibt auf dem Default', () => {
    expect(validateIntent(null).contentTypes).toEqual(['event']);
    expect(validateIntent('kaputt').contentTypes).toEqual(['event']);
  });
});

describe('intentIsEmpty — contentTypes als Signal (fn-18.6)', () => {
  it('leerer Default-Intent ist leer', () => {
    expect(intentIsEmpty(emptySearchIntent())).toBe(true);
  });

  it('contentTypes=["activity"] ohne Facetten zählt als Signal', () => {
    const i = emptySearchIntent();
    i.contentTypes = ['activity'];
    expect(intentIsEmpty(i)).toBe(false);
  });

  it('contentTypes=["event","activity"] zählt als Signal', () => {
    const i = emptySearchIntent();
    i.contentTypes = ['event', 'activity'];
    expect(intentIsEmpty(i)).toBe(false);
  });
});

describe('detectGemeindeInQuery (fn-18.6)', () => {
  it('erkennt Registry-Gemeinden und strippt sie aus dem Suchtext', () => {
    const g = detectGemeindeInQuery('mountaincart dorfgastein');
    expect(g?.name).toBe('Dorfgastein');
    expect(g?.restText).toBe('mountaincart');
    expect(g?.bundesland).toBe('salzburg');
    expect(g?.radiusKm).toBe(15);
  });

  it('funktioniert unabhängig von der Wortstellung', () => {
    const g = detectGemeindeInQuery('lutzmannsburg rutschen');
    expect(g?.name).toBe('Lutzmannsburg');
    expect(g?.restText).toBe('rutschen');
    expect(g?.bundesland).toBe('burgenland');
  });

  it('Kontextwort wird mit gestrippt (Regel i)', () => {
    const g = detectGemeindeInQuery('was tun bei regen in graz');
    expect(g?.name).toBe('Graz');
    expect(g?.restText).toBe('was tun bei regen');
  });

  it('Mehr-Token-Gemeindenamen matchen (Regel ii)', () => {
    expect(detectGemeindeInQuery('rodeln in zell am see')?.name).toBe('Zell am See');
  });

  it('Tippfehler und Nicht-Orte liefern null', () => {
    expect(detectGemeindeInQuery('mountaincart dorfgastien')).toBeNull();
    expect(detectGemeindeInQuery('wo kann ich mountaincart fahren')).toBeNull();
    expect(detectGemeindeInQuery('')).toBeNull();
  });

  it('NEGATIV: kollisionsträchtige Alltagswort-Gemeinden erzeugen KEINEN Filter', () => {
    // Alle folgenden Tokens SIND Gemeindenamen (see, berg, sonntag, malta,
    // baden) — als Einzel-Token dürfen sie nie matchen, auch nicht hinter
    // einem Kontextwort.
    expect(detectGemeindeInQuery('im sommer am see baden')).toBeNull();
    expect(detectGemeindeInQuery('wandern am berg mit kindern')).toBeNull();
    expect(detectGemeindeInQuery('was tun am sonntag')).toBeNull();
    expect(detectGemeindeInQuery('urlaub in malta')).toBeNull();
    expect(detectGemeindeInQuery('bei regen was unternehmen')).toBeNull();
  });
});

describe('detectActivityIntent (No-AI-Klassifikator, fn-18.6)', () => {
  it('POI-Frage + starker POI-Begriff → activity-only', () => {
    const s = detectActivityIntent('wo kann ich mountaincart fahren');
    expect(s.isActivity).toBe(true);
    expect(s.activityOnly).toBe(true);
    expect(s.indoor).toBe(false);
  });

  it('Regen-Query → activity-only + indoor', () => {
    const s = detectActivityIntent('was tun bei Regen in Graz');
    expect(s.isActivity).toBe(true);
    expect(s.activityOnly).toBe(true);
    expect(s.indoor).toBe(true);
  });

  it('POI-Begriff ohne Frageform reicht ("mountaincart dorfgastein")', () => {
    expect(detectActivityIntent('mountaincart dorfgastein').activityOnly).toBe(true);
  });

  it('reine Event-Query bleibt unangetastet', () => {
    const s = detectActivityIntent('konzerte wien heute');
    expect(s.isActivity).toBe(false);
    expect(s.activityOnly).toBe(false);
    expect(s.indoor).toBe(false);
  });

  it('explizites Event-Wort blockt activity-only', () => {
    const s = detectActivityIntent('konzert im hallenbad');
    expect(s.isActivity).toBe(true);
    expect(s.activityOnly).toBe(false);
  });
});

describe('extractActivitySearchTerm (fn-18.6)', () => {
  it('nimmt den spezifischsten Begriff aus dem Rest-Text', () => {
    expect(extractActivitySearchTerm('wo kann ich mountaincart fahren')).toBe('mountaincart');
  });

  it('nutzt LLM-searchTerms, wenn sie im Query vorkommen (Auswahl-Leistung)', () => {
    expect(
      extractActivitySearchTerm('wo gibt es einen hochseilgarten', ['Hochseilgarten']),
    ).toBe('Hochseilgarten');
  });

  it('ignoriert paraphrasierte LLM-Begriffe, die NICHT im Query stehen', () => {
    // Regression: Gemini machte aus "mountaincart" das Oberbegriff-Vokabular
    // "Bergtour"/"Mountain" — die trgm-Namenssuche landete dadurch auf
    // "Active Mountains" statt auf den Mountaincart-Bahnen (Prod-Befund).
    expect(
      extractActivitySearchTerm('wo kann ich mountaincart fahren', ['Bergtour', 'Mountain']),
    ).toBe('mountaincart');
    expect(extractActivitySearchTerm('rutschen', ['Hochseilgarten'])).toBe('rutschen');
  });

  it('liefert null wenn nur Frage-/Wetterwörter übrig sind (q=NULL-Zweig)', () => {
    expect(extractActivitySearchTerm('was tun bei regen')).toBeNull();
    expect(extractActivitySearchTerm('')).toBeNull();
  });
});

describe('rankActivityCandidates (fn-18.6)', () => {
  const baseRow: ActivityCandidate = {
    id: 'a1', slug: 'a-1', name: 'Alpha', description: null, description_short: null,
    tags: [], setting: null, lat: 47, lng: 13, town: null, gemeinde_slug: null,
    bundesland: 'salzburg', images: null, price_hint: null, online_bookable: false,
    name_similarity: 0, tag_hits: 0, distance_km: null,
  };

  it('name-trgm schlägt reine Tag-Treffer', () => {
    const ranked = rankActivityCandidates(
      [
        { ...baseRow, id: 'tags', name: 'Zeta', tag_hits: 3 },
        { ...baseRow, id: 'trgm', name: 'Alpha', name_similarity: 0.9 },
      ],
      emptySearchIntent(), 'alpha', 10,
    );
    expect(ranked[0].id).toBe('trgm');
  });

  it('Description-Treffer ist Sekundär-Signal auf der Shortlist', () => {
    const [withDesc, without] = rankActivityCandidates(
      [
        { ...baseRow, id: 'desc', name: 'Alpha', description: 'Der schönste Klettersteig' },
        { ...baseRow, id: 'plain', name: 'Alpha' },
      ],
      emptySearchIntent(), 'klettersteig', 10,
    );
    expect(withDesc.id).toBe('desc');
    expect(withDesc._similarity).toBeGreaterThan(without._similarity);
  });

  it('nähere POIs gewinnen bei sonst gleichem Score', () => {
    const ranked = rankActivityCandidates(
      [
        { ...baseRow, id: 'far', name: 'Alpha', distance_km: 14 },
        { ...baseRow, id: 'near', name: 'Beta', distance_km: 1 },
      ],
      emptySearchIntent(), null, 10, 15,
    );
    expect(ranked[0].id).toBe('near');
  });

  it('dedupliziert per id und cappt', () => {
    const ranked = rankActivityCandidates(
      [baseRow, { ...baseRow, name: 'Alpha Duplikat' }, { ...baseRow, id: 'a2', name: 'Beta' }],
      emptySearchIntent(), null, 1,
    );
    expect(ranked).toHaveLength(1);
  });
});
