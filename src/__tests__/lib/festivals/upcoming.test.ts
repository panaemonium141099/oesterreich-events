import { describe, it, expect } from 'vitest';
import {
  validateSeedEntry,
  toFestivalRow,
  toLineupRows,
  normalizeBundesland,
  selectFestivalBlogCandidates,
  festivalBlogKey,
  addDays,
  toBlogLineup,
  type UpcomingFestivalSeed,
} from '@/lib/festivals/upcoming';

const TODAY = '2026-10-26';

function seed(over: Partial<UpcomingFestivalSeed> = {}): UpcomingFestivalSeed {
  return {
    slug: 'nova-rock',
    name: 'Nova Rock Festival',
    website_url: 'https://www.novarock.at',
    ticket_url: 'https://www.oeticket.com/nova-rock',
    starts_at: '2027-06-10',
    ends_at: '2027-06-13',
    date_status: 'confirmed',
    city: 'Nickelsdorf',
    state: 'Burgenland',
    genres: 'P, E',
    price_text: 'Festivalpass ab 229 €',
    description: 'Das Nova Rock ist Österreichs größtes Rockfestival auf den Pannonia Fields in Nickelsdorf, seit 2005 jedes Jahr im Juni mit vier Bühnen.',
    image_url: 'https://www.novarock.at/sujet.jpg',
    lineup: [{ name: 'Linkin Park', billing: 'headliner' }],
    ...over,
  };
}

describe('validateSeedEntry', () => {
  it('akzeptiert einen vollständigen Eintrag', () => {
    expect(validateSeedEntry(seed(), TODAY)).toEqual([]);
  });

  it('akzeptiert Registry-Slugs mit Umlauten', () => {
    expect(validateSeedEntry(seed({ slug: 'seefestspiele-mörbisch' }), TODAY)).toEqual([]);
  });

  it('verwirft Großbuchstaben und Leerzeichen im Slug', () => {
    expect(validateSeedEntry(seed({ slug: 'Nova Rock' }), TODAY)).toContain('slug fehlt oder ist kein Kleinbuchstaben-kebab-case');
  });

  it('verwirft vergangene Ausgaben (Vorjahrestermin aus der Registry)', () => {
    const errors = validateSeedEntry(seed({ starts_at: '2026-06-11', ends_at: '2026-06-14' }), TODAY);
    expect(errors.some(e => e.startsWith('Ausgabe ist vorbei'))).toBe(true);
  });

  it('verwirft Termine weiter als 500 Tage voraus', () => {
    const errors = validateSeedEntry(seed({ starts_at: '2028-06-10', ends_at: '2028-06-13' }), TODAY);
    expect(errors.some(e => e.includes('500 Tage'))).toBe(true);
  });

  it('verlangt date_status unknown ohne Termin und umgekehrt', () => {
    expect(validateSeedEntry(seed({ starts_at: null, ends_at: null, date_status: 'confirmed' }), TODAY))
      .toContain('kein Termin, aber date_status nicht "unknown"');
    expect(validateSeedEntry(seed({ date_status: 'unknown' }), TODAY))
      .toContain('Termin gesetzt, aber date_status "unknown"');
    expect(validateSeedEntry(seed({ starts_at: null, ends_at: null, date_status: 'unknown' }), TODAY)).toEqual([]);
  });

  it('verwirft Gedankenstriche und zu kurze Beschreibungen', () => {
    expect(validateSeedEntry(seed({ description: 'Ein Festival – mit Strich und sonst nichts, aber lang genug, um die Mindestlänge locker zu erreichen.' }), TODAY))
      .toContain('description enthält Gedankenstriche');
    expect(validateSeedEntry(seed({ description: 'zu kurz' }), TODAY))
      .toContain('description kürzer als 80 Zeichen');
  });

  it('verwirft unbekannte Bundesländer und Genre-Codes', () => {
    expect(validateSeedEntry(seed({ state: 'Bayern' }), TODAY)).toContain('state "Bayern" ist kein Bundesland');
    expect(validateSeedEntry(seed({ genres: 'Rock' }), TODAY).some(e => e.includes('unbekannte Codes'))).toBe(true);
  });

  it('verwirft Lineup-Einträge ohne Namen', () => {
    const errors = validateSeedEntry(seed({ lineup: [{ name: '' }] }), TODAY);
    expect(errors.some(e => e.startsWith('lineup-Eintrag ohne brauchbaren Namen'))).toBe(true);
  });

  it('verwirft Ticket-/Bild-Links, die keine URL sind', () => {
    expect(validateSeedEntry(seed({ ticket_url: 'oeticket.com' }), TODAY)).toContain('ticket_url keine URL');
    expect(validateSeedEntry(seed({ image_url: '/sujet.jpg' }), TODAY)).toContain('image_url keine URL');
  });
});

describe('normalizeBundesland', () => {
  it('normiert ASCII- und englische Schreibweisen auf die Anzeigeform', () => {
    expect(normalizeBundesland('Niederoesterreich')).toBe('Niederösterreich');
    expect(normalizeBundesland('NÖ')).toBe('Niederösterreich');
    expect(normalizeBundesland('Kaernten')).toBe('Kärnten');
    expect(normalizeBundesland('Styria')).toBe('Steiermark');
    expect(normalizeBundesland('Bayern')).toBeNull();
    expect(normalizeBundesland(null)).toBeNull();
  });
});

describe('toFestivalRow', () => {
  it('bildet die Upsert-Zeile mit normiertem Bundesland und Genres', () => {
    const row = toFestivalRow(seed({ state: 'Burgenland', genres: 'P,E' }), '2026-10-26T10:00:00Z');
    expect(row).toMatchObject({
      slug: 'nova-rock',
      canonical_name: 'Nova Rock Festival',
      starts_at: '2027-06-10',
      ends_at: '2027-06-13',
      date_status: 'confirmed',
      state: 'Burgenland',
      genres: 'P, E',
      ticket_url: 'https://www.oeticket.com/nova-rock',
      seed_updated_at: '2026-10-26T10:00:00Z',
    });
  });

  it('setzt unbekannte Termine auf null und expected bleibt expected', () => {
    expect(toFestivalRow(seed({ starts_at: null, ends_at: null, date_status: 'unknown' }), 'x')).toMatchObject({
      starts_at: null, ends_at: null, date_status: 'confirmed',
    });
    expect(toFestivalRow(seed({ date_status: 'expected' }), 'x').date_status).toBe('expected');
  });

  it('macht aus Leerstrings null', () => {
    const row = toFestivalRow(seed({ price_text: '  ', city: '' }), 'x');
    expect(row.price_text).toBeNull();
    expect(row.city).toBeNull();
  });
});

describe('toLineupRows', () => {
  it('dedupliziert über den normalisierten Namen und mappt Billing', () => {
    const rows = toLineupRows([
      { name: 'Linkin Park', billing: 'headliner', day: 'Fr 11.06.' },
      { name: 'LINKIN  PARK', billing: 'support' },
      { name: 'Bilderbuch', billing: 'Co-Headliner' },
      { name: '   ' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ artist_name_raw: 'Linkin Park', artist_name_normalized: 'linkin park', billing: 'headliner', day_label: 'Fr 11.06.', source_type: 'manual' });
    expect(rows[1]).toMatchObject({ artist_name_raw: 'Bilderbuch', billing: 'unknown', day_label: null });
  });

  it('normalisiert Akzente für den Key, behält den Rohnamen', () => {
    const [row] = toLineupRows([{ name: 'Beyoncé' }]);
    expect(row.artist_name_normalized).toBe('beyonce');
    expect(row.artist_name_raw).toBe('Beyoncé');
  });
});

describe('selectFestivalBlogCandidates', () => {
  const base = { image_url: 'https://x/y.jpg', date_status: 'confirmed' as const };
  it('nimmt nur Festivals im 5-Monats-Fenster mit Bild und bestätigtem Termin', () => {
    const inWindow = addDays(TODAY, 150);
    const picked = selectFestivalBlogCandidates([
      { slug: 'a', starts_at: inWindow, ...base },
      { slug: 'too-soon', starts_at: addDays(TODAY, 100), ...base },
      { slug: 'too-late', starts_at: addDays(TODAY, 200), ...base },
      { slug: 'no-image', starts_at: inWindow, ...base, image_url: null },
      { slug: 'expected', starts_at: inWindow, ...base, date_status: 'expected' },
      { slug: 'tba', starts_at: null, ...base },
    ], TODAY, new Set());
    expect(picked.map(p => p.slug)).toEqual(['a']);
  });

  it('überspringt bereits geschriebene Ausgaben, nicht aber die nächste Ausgabe desselben Festivals', () => {
    const covered = new Set([festivalBlogKey({ slug: 'a', starts_at: addDays(TODAY, 150) })]);
    const picked = selectFestivalBlogCandidates([
      { slug: 'a', starts_at: addDays(TODAY, 150), ...base },
      { slug: 'b', starts_at: addDays(TODAY, 140), ...base },
    ], TODAY, covered);
    expect(picked.map(p => p.slug)).toEqual(['b']);
  });

  it('sortiert nach frühestem Start, damit nichts aus dem Fenster fällt', () => {
    const picked = selectFestivalBlogCandidates([
      { slug: 'late', starts_at: addDays(TODAY, 151), ...base },
      { slug: 'early', starts_at: addDays(TODAY, 139), ...base },
    ], TODAY, new Set());
    expect(picked.map(p => p.slug)).toEqual(['early', 'late']);
  });

  it('Fenstergrenzen sind inklusiv (138 und 152 Tage)', () => {
    const picked = selectFestivalBlogCandidates([
      { slug: 'lo', starts_at: addDays(TODAY, 138), ...base },
      { slug: 'hi', starts_at: addDays(TODAY, 152), ...base },
      { slug: 'out', starts_at: addDays(TODAY, 153), ...base },
    ], TODAY, new Set());
    expect(picked.map(p => p.slug)).toEqual(['lo', 'hi']);
  });
});

describe('toBlogLineup', () => {
  it('gibt jedem Act eine Rolle, damit die Blogseite keinen verschluckt', () => {
    const { lineup, highlightsOnly } = toBlogLineup([
      { name: 'Evanescence', billing: 'unknown' },
      { name: 'Die Ärzte', billing: 'headliner' },
      { name: 'Slash', billing: null },
    ]);
    expect(highlightsOnly).toBe(false);
    expect(lineup).toEqual([
      { name: 'Die Ärzte', role: 'headliner' },
      { name: 'Evanescence', role: 'support' },
      { name: 'Slash', role: 'support' },
    ]);
  });

  it('markiert ohne Headliner-Billing die ersten Programmpunkte als Höhepunkte', () => {
    const acts = Array.from({ length: 9 }, (_, i) => ({ name: `Act ${i}`, billing: 'unknown' }));
    const { lineup, highlightsOnly } = toBlogLineup(acts, { highlights: 3 });
    expect(highlightsOnly).toBe(true);
    expect(lineup.filter(a => a.role === 'headliner').map(a => a.name)).toEqual(['Act 0', 'Act 1', 'Act 2']);
    expect(lineup).toHaveLength(9);
  });

  it('dedupliziert, behält Tag und Bühne, kappt bei max', () => {
    const { lineup } = toBlogLineup([
      { name: 'A', billing: 'headliner', day: 'Fr', stage: 'Blue' },
      { name: 'a', billing: 'support' },
      { name: 'B', billing: 'support' },
      { name: 'C', billing: 'support' },
    ], { max: 2 });
    expect(lineup).toEqual([{ name: 'A', role: 'headliner', day: 'Fr', stage: 'Blue' }, { name: 'B', role: 'support' }]);
  });

  it('leeres Lineup bleibt leer und ist kein Highlight-Fall', () => {
    expect(toBlogLineup([])).toEqual({ lineup: [], highlightsOnly: false });
  });
});

describe('addDays', () => {
  it('rechnet über Monats- und Jahresgrenzen in UTC', () => {
    expect(addDays('2026-10-26', 152)).toBe('2027-03-27');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
