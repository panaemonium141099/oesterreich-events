import { describe, it, expect } from 'vitest';
import {
  activityShortId,
  slugifyActivityName,
  buildActivitySlug,
  extractActivityShortId,
} from '@/lib/activities/slug';

describe('activityShortId', () => {
  it('erste 12 Hex-Zeichen von sha1(source:source_id), lowercase (Algorithmus-Fixierung)', () => {
    // Referenzwerte einmalig via node:crypto berechnet — schuetzt gegen
    // versehentliche Algorithmus-Aenderungen (Slug-Stabilitaet, Epic E5).
    expect(activityShortId('deskline', 'abc')).toBe('99e3be4b7079');
    expect(activityShortId('deskline', '11111111-2222-3333-4444-555555555555')).toBe('71fbd6f3f8fd');
  });

  it('ist deterministisch und 12 Zeichen lowercase-Hex', () => {
    const id = activityShortId('deskline', 'F8B0C5A1-1234-5678-9ABC-DEF012345678');
    expect(id).toMatch(/^[0-9a-f]{12}$/);
    expect(activityShortId('deskline', 'F8B0C5A1-1234-5678-9ABC-DEF012345678')).toBe(id);
  });

  it('unterschiedliche source_ids kollidieren nicht (5000 Stichproben)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      seen.add(activityShortId('deskline', `guid-${i}`));
    }
    expect(seen.size).toBe(5000);
  });

  it('source geht in den Hash ein', () => {
    expect(activityShortId('deskline', 'x')).not.toBe(activityShortId('osm', 'x'));
  });
});

describe('slugifyActivityName', () => {
  it('umlaute -> ae/oe/ue, lowercase, Hyphen-Trennung', () => {
    expect(slugifyActivityName('Kärntner Rodelbahn Süd')).toBe('kaerntner-rodelbahn-sued');
    expect(slugifyActivityName('Hochseilgarten Größenberg')).toBe('hochseilgarten-groessenberg');
  });

  it('strippt Akzente und Sonderzeichen', () => {
    expect(slugifyActivityName('Café Erlebnisbad (Neu!)')).toBe('cafe-erlebnisbad-neu');
  });

  it('kappt bei 60 Zeichen ohne Wortmitte', () => {
    const slug = slugifyActivityName('a'.repeat(40) + ' ' + 'b'.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).toBe('a'.repeat(40));
  });

  it('leerer/unbrauchbarer Name -> Fallback', () => {
    expect(slugifyActivityName('')).toBe('aktivitaet');
    expect(slugifyActivityName('---')).toBe('aktivitaet');
  });
});

describe('buildActivitySlug', () => {
  it('Format {name-slug}-{shortid}', () => {
    const slug = buildActivitySlug('Mountaincart am Erlebnisberg Fulseck', 'deskline', 'abc');
    expect(slug).toBe('mountaincart-am-erlebnisberg-fulseck-99e3be4b7079');
  });

  it('ist stabil: gleiche Identitaet -> gleicher Slug, auch bei Namensaenderung anderer Felder', () => {
    const a = buildActivitySlug('Freibad Podersdorf', 'deskline', 'guid-1');
    const b = buildActivitySlug('Freibad Podersdorf', 'deskline', 'guid-1');
    expect(a).toBe(b);
  });

  it('gleiche Namen, verschiedene source_ids -> verschiedene Slugs (Kollisionsfreiheit)', () => {
    const a = buildActivitySlug('Freibad', 'deskline', 'guid-1');
    const b = buildActivitySlug('Freibad', 'deskline', 'guid-2');
    expect(a).not.toBe(b);
  });
});

describe('extractActivityShortId', () => {
  it('liest die shortid aus einem vollen Slug', () => {
    expect(extractActivityShortId('mountaincart-am-erlebnisberg-fulseck-99e3be4b7079')).toBe('99e3be4b7079');
  });

  it('null wenn kein 12-Hex-Suffix', () => {
    expect(extractActivityShortId('freibad-podersdorf')).toBeNull();
    expect(extractActivityShortId('freibad-99e3be4b70')).toBeNull(); // nur 10 hex
    expect(extractActivityShortId('freibad-99E3BE4B7079')).toBeNull(); // uppercase ist nie gueltig
  });

  it('akzeptiert eine nackte shortid', () => {
    expect(extractActivityShortId('99e3be4b7079')).toBe('99e3be4b7079');
  });
});
