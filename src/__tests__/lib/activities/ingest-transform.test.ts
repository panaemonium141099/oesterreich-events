import { describe, it, expect } from 'vitest';
import {
  transformInfrastructure,
  buildInsertRow,
  buildUpdateRow,
  stripGesperrtPrefix,
  cleanDesklineText,
  cleanActivityName,
  IDENTITY_COLUMNS,
  INSERT_ONLY_COLUMNS,
  UPDATE_BUSINESS_COLUMNS,
  SIGHTING_COLUMNS,
  type TransformedActivity,
} from '@/lib/activities/ingest-transform';
import type { DesklineInfrastructure } from '@/lib/activities/deskline-client';

/** Valide Basis-Infrastruktur: Strandbad in Podersdorf (Burgenland). */
function rawPoi(overrides: Partial<DesklineInfrastructure> = {}): DesklineInfrastructure {
  return {
    id: 'abc-123',
    name: 'Strandbad Podersdorf',
    type: 1,
    onlineBookable: true,
    openStatus: 2,
    openingTimes: [
      { dateFrom: '2026-05-01T00:00:00', dateTo: '2026-09-30T00:00:00', timeFrom: '09:00', timeTo: '19:00', weekdays: 127 },
    ],
    topics: [{ id: 't1', name: 'Strandbad' }],
    location: { town: 'Podersdorf am See', coordinate: { lat: 47.852, long: 16.847 } },
    images: [
      { copyright: 'TVB Podersdorf', license: 'CC BY', author: 'M. Muster', urls: ['//resc.deskline.net/images/BGL/1/x/10/bild.jpg'] },
    ],
    plainDescriptions: [
      { description: 'Kurzer Teaser&nbsp;am See.', type: 41 },
      { description: 'Langtext mit <br /> Umbruch und &amp; Entity.', type: 42 },
      { description: 'Eintritt: Erwachsene € 5,50 / Kinder € 3', type: 43 },
    ],
    guestCards: [{ id: 'gc1', name: 'Neusiedler See Card', type: 1, webLink: null }],
    ...overrides,
  };
}

function transformOk(overrides: Partial<DesklineInfrastructure> = {}): TransformedActivity {
  const outcome = transformInfrastructure(rawPoi(overrides), 'burgenland', 'Burgenland');
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) throw new Error('unreachable');
  return outcome.activity;
}

describe('transformInfrastructure — Happy Path', () => {
  it('liefert eine vollstaendige Business-Row', () => {
    const a = transformOk();
    expect(a.source).toBe('deskline');
    expect(a.source_region).toBe('burgenland');
    expect(a.source_id).toBe('abc-123');
    expect(a.name).toBe('Strandbad Podersdorf');
    expect(a.is_closed).toBe(false);
    expect(a.tags).toContain('schwimmen');
    expect(a.setting).toBe('outdoor');
    expect(a.online_bookable).toBe(true);
    expect(a.open_status).toBe(2);
    expect(a.slug).toMatch(/^strandbad-podersdorf-[0-9a-f]{12}$/);
    expect(a.shortid).toMatch(/^[0-9a-f]{12}$/);
    expect(a.slug.endsWith(a.shortid)).toBe(true);
    expect(a.content_fingerprint).toMatch(/^[0-9a-f]{40}$/);
    expect(a.guest_cards).toEqual([{ id: 'gc1', name: 'Neusiedler See Card', type: 1, webLink: null }]);
    expect(a.topics_raw).toEqual([{ id: 't1', name: 'Strandbad' }]);
  });

  it('bundesland kommt normalisiert aus der Gemeinde-Registry (bundeslandToId), nicht aus der Config', () => {
    // Registry liefert 'Burgenland' (Gross) -> kanonische lowercase-ID.
    const a = transformOk();
    expect(a.bundesland).toBe('burgenland');
    expect(a.gemeinde_slug).toBe('7141-podersdorf-am-see');
    expect(a.town).toBe('Podersdorf am See');

    // Auch wenn die REGIONS-Config Unsinn enthaelt ('Österreich'-Eintraege
    // wie oberbuch/lahnstein): Registry gewinnt.
    const outcome = transformInfrastructure(rawPoi(), 'oberbuch', 'Österreich');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.activity.bundesland).toBe('burgenland');
      expect(outcome.bundeslandFromConfigFallback).toBe(false);
    }
  });

  it('Beschreibungen: 41 -> description_short, 42 -> description, bereinigt', () => {
    const a = transformOk();
    expect(a.description_short).toBe('Kurzer Teaser am See.');
    expect(a.description).toBe('Langtext mit \n Umbruch und & Entity.');
    expect(a.description).not.toContain('<br');
    expect(a.description).not.toContain('&amp;');
  });

  it('price_hint wird deterministisch aus ALLEN Texten extrahiert (auch Typ 43)', () => {
    const a = transformOk();
    // Zwei unterschiedliche Betraege -> "ab"-Semantik mit dem kleinsten.
    expect(a.price_hint).toBe('ab € 3');
  });

  it('Bild-URLs werden auf https normalisiert, Attribution bleibt erhalten', () => {
    const a = transformOk();
    expect(a.images).toHaveLength(1);
    expect(a.images![0].urls[0]).toBe('https://resc.deskline.net/images/BGL/1/x/10/bild.jpg');
    expect(a.images![0].copyright).toBe('TVB Podersdorf');
    expect(a.images![0].license).toBe('CC BY');
    expect(a.images![0].author).toBe('M. Muster');
  });

  it('openingTimes: Raw unveraendert + normalisierter E8-Vertrag', () => {
    const a = transformOk();
    expect(a.opening_times_raw).toEqual(rawPoi().openingTimes);
    expect(a.opening_times).toEqual([
      { from: '2026-05-01', to: '2026-09-30', timeFrom: '09:00', timeTo: '19:00', weekdays: null },
    ]);
  });

  it('Mojibake im Namen wird repariert (fliesst in Name, Slug und Fingerprint)', () => {
    const a = transformOk({ name: 'SeebÃ¤hnchen Podersdorf' });
    expect(a.name).toBe('Seebähnchen Podersdorf');
    expect(a.slug).toMatch(/^seebaehnchen-podersdorf-[0-9a-f]{12}$/);
  });
});

describe('transformInfrastructure — GESPERRT-Praefix (is_closed)', () => {
  it.each([
    ['GESPERRT Strandbad Podersdorf', 'Strandbad Podersdorf'],
    ['GESPERRT - Strandbad Podersdorf', 'Strandbad Podersdorf'],
    ['GESPERRT: Strandbad Podersdorf', 'Strandbad Podersdorf'],
    ['gesperrt! Strandbad Podersdorf', 'Strandbad Podersdorf'],
  ])('%s -> is_closed=true, Name gestrippt', (input, expected) => {
    const a = transformOk({ name: input });
    expect(a.is_closed).toBe(true);
    expect(a.name).toBe(expected);
    // Slug wird aus dem GESTRIPPTEN Namen gebaut.
    expect(a.slug.startsWith('strandbad-podersdorf-')).toBe(true);
  });

  it('"Gesperrter Wanderweg" bleibt unangetastet (nur eigenstaendiges Wort)', () => {
    const { name, isClosed } = stripGesperrtPrefix('Gesperrter Wanderweg');
    expect(isClosed).toBe(false);
    expect(name).toBe('Gesperrter Wanderweg');
  });

  it('geschlossene POIs werden IMPORTIERT (kein Skip) — Wiedereroeffnung setzt is_closed zurueck', () => {
    const closed = transformOk({ name: 'GESPERRT Strandbad Podersdorf' });
    expect(closed.is_closed).toBe(true);
    const reopened = transformOk({ name: 'Strandbad Podersdorf' });
    expect(reopened.is_closed).toBe(false);
    // is_closed ist Teil des Update-Pfads (mutable Business-Spalte).
    expect(UPDATE_BUSINESS_COLUMNS).toContain('is_closed');
  });
});

describe('transformInfrastructure — Skip-Pfade', () => {
  it('Blocklisten-Topic blockt auch bei zusaetzlichem Whitelist-Topic', () => {
    const outcome = transformInfrastructure(
      rawPoi({ topics: [{ name: 'Strandbad' }, { name: 'Restaurant' }] }),
      'burgenland',
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('excluded-topic');
      expect(outcome.fatal).toBe(false);
    }
  });

  it('kein Whitelist-Topic -> no-importable-topic (unmapped landet im Skip-Log)', () => {
    const outcome = transformInfrastructure(
      rawPoi({ topics: [{ name: 'Ausflugsziel' }] }),
      'burgenland',
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('no-importable-topic');
      expect(outcome.unmappedTopics).toEqual(['Ausflugsziel']);
    }
  });

  it('fehlende Koordinaten -> no-coordinates', () => {
    const outcome = transformInfrastructure(
      rawPoi({ location: { town: 'X', coordinate: null } }),
      'burgenland',
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('no-coordinates');
  });

  it('Koordinaten ausserhalb AT -> no-gemeinde-match (Muenchen)', () => {
    const outcome = transformInfrastructure(
      rawPoi({ location: { town: 'München', coordinate: { lat: 48.137, long: 11.575 } } }),
      'burgenland',
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('no-gemeinde-match');
  });

  it('fehlende id/leerer Name -> invalid', () => {
    expect(transformInfrastructure(rawPoi({ id: undefined }), 'burgenland').ok).toBe(false);
    expect(transformInfrastructure(rawPoi({ name: '   ' }), 'burgenland').ok).toBe(false);
    // Nur GESPERRT ohne Restnamen -> invalid, kein Crash.
    const outcome = transformInfrastructure(rawPoi({ name: 'GESPERRT' }), 'burgenland');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('invalid');
  });
});

describe('Payload-Spaltengruppen (DML-Strategie, Task-Spec)', () => {
  const activity = transformOk();

  it('Insert-Row: Identitaet + insert-only + ALLE Business-Spalten, KEINE Sichtungsspalten', () => {
    const row = buildInsertRow(activity);
    const keys = Object.keys(row).sort();
    const expected = [...IDENTITY_COLUMNS, ...INSERT_ONLY_COLUMNS, ...UPDATE_BUSINESS_COLUMNS].sort();
    expect(keys).toEqual(expected);
    for (const col of SIGHTING_COLUMNS) {
      expect(row).not.toHaveProperty(col);
    }
    expect(row.slug).toBe(activity.slug);
    expect(row.source_region).toBe('burgenland');
  });

  it('Update-Row: Identitaet + mutable Business-Spalten + updated_at — NIE slug/shortid/source_region, KEINE Sichtungsspalten', () => {
    const row = buildUpdateRow(activity, '2026-07-25T00:00:00.000Z');
    const keys = Object.keys(row).sort();
    const expected = [...IDENTITY_COLUMNS, ...UPDATE_BUSINESS_COLUMNS, 'updated_at'].sort();
    expect(keys).toEqual(expected);
    expect(row).not.toHaveProperty('slug');
    expect(row).not.toHaveProperty('shortid');
    expect(row).not.toHaveProperty('source_region');
    for (const col of SIGHTING_COLUMNS) {
      expect(row).not.toHaveProperty(col);
    }
    expect(row.updated_at).toBe('2026-07-25T00:00:00.000Z');
  });

  it('jede Row eines Batches traegt exakt dasselbe Spaltenset (NULL-Clobber-Falle)', () => {
    // Row mit vielen NULL-Feldern (kein Bild, keine Beschreibung, ...) hat
    // trotzdem exakt dieselben Keys wie eine voll befuellte Row.
    const sparse = transformOk({
      images: null,
      plainDescriptions: null,
      openingTimes: null,
      guestCards: [],
      openStatus: undefined,
    });
    expect(Object.keys(buildInsertRow(sparse)).sort()).toEqual(Object.keys(buildInsertRow(activity)).sort());
    expect(Object.keys(buildUpdateRow(sparse, 'x')).sort()).toEqual(Object.keys(buildUpdateRow(activity, 'x')).sort());
    expect(buildInsertRow(sparse).images).toBeNull();
    expect(buildInsertRow(sparse).description).toBeNull();
  });
});

describe('Text-Helpers', () => {
  it('cleanDesklineText: Tags, Entities, Mojibake, Whitespace', () => {
    expect(cleanDesklineText('Ein <b>Test</b>&nbsp;mit&nbsp;&quot;Zitat&quot; &amp; MÃ¼hle')).toBe(
      'Ein Test mit "Zitat" & Mühle',
    );
  });

  it('cleanActivityName: NBSP + Mehrfach-Whitespace kollabiert', () => {
    expect(cleanActivityName('  Bad   Sauerbrunn  ')).toBe('Bad Sauerbrunn');
  });
});
