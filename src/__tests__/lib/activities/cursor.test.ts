import { describe, it, expect } from 'vitest';
import {
  buildActivityCursorFilter,
  decodeActivityCursor,
  encodeActivityCursor,
  quotePostgrestValue,
} from '@/lib/activities/cursor';

const UUID = '01234567-89ab-cdef-0123-456789abcdef';

describe('Activity-Cursor Round-Trip (Wire-Format: base64url-JSON {name,id})', () => {
  const NAMES = [
    'Mountaincart Fulseck',
    'Bäder & Thermen — Lutzmannsburg',
    'Café "Zur Möwe", Terrasse (Süd)',
    'Straußenfarm größte Österreichs',
    'name,with.commas.and.dots',
    'back\\slash "quotes"',
    '   ', // Whitespace-Name (DB koennte ihn theoretisch enthalten)
    '',
  ];

  it.each(NAMES)('round-trippt raw-DB-Namen unveraendert: %j', (name) => {
    const encoded = encodeActivityCursor({ name, id: UUID });
    // base64url: URL-safe ohne Padding-Sonderzeichen
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeActivityCursor(encoded)).toEqual({ name, id: UUID });
  });

  it('dekodiert das dokumentierte Wire-Format direkt', () => {
    const wire = Buffer.from(JSON.stringify({ name: 'Fülseck', id: UUID }), 'utf8').toString('base64url');
    expect(decodeActivityCursor(wire)).toEqual({ name: 'Fülseck', id: UUID });
  });

  it('normalisiert die UUID auf lowercase (DB-Vergleichsform)', () => {
    const encoded = encodeActivityCursor({ name: 'x', id: UUID.toUpperCase() });
    expect(decodeActivityCursor(encoded)?.id).toBe(UUID);
  });
});

describe('decodeActivityCursor — strikte Ablehnung', () => {
  it.each([
    ['leer', ''],
    ['null', null],
    ['undefined', undefined],
    ['kein base64url-Alphabet', 'abc+/=='],
    ['kein JSON', Buffer.from('not json').toString('base64url')],
    ['JSON-Array', Buffer.from('[1,2]').toString('base64url')],
    ['JSON-String', Buffer.from('"nur-string"').toString('base64url')],
    ['name fehlt', Buffer.from(JSON.stringify({ id: UUID })).toString('base64url')],
    ['name kein String', Buffer.from(JSON.stringify({ name: 42, id: UUID })).toString('base64url')],
    ['id fehlt', Buffer.from(JSON.stringify({ name: 'x' })).toString('base64url')],
    ['id keine UUID', Buffer.from(JSON.stringify({ name: 'x', id: 'abc' })).toString('base64url')],
    [
      'id mit SQL-Injection-Versuch',
      Buffer.from(JSON.stringify({ name: 'x', id: `${UUID}),visible.eq.false` })).toString('base64url'),
    ],
  ])('lehnt ab: %s', (_label, raw) => {
    expect(decodeActivityCursor(raw as string | null | undefined)).toBeNull();
  });
});

describe('buildActivityCursorFilter — Lookup-Regel name>$n OR (name=$n AND id>$i)', () => {
  it('baut den PostgREST-or-Ausdruck mit gequoteten Werten', () => {
    expect(buildActivityCursorFilter({ name: 'Alpen Arena', id: UUID })).toBe(
      `name.gt."Alpen Arena",and(name.eq."Alpen Arena",id.gt."${UUID}")`,
    );
  });

  it('escaped Anfuehrungszeichen und Backslashes im Namen', () => {
    const filter = buildActivityCursorFilter({ name: 'Café "Möwe" \\ Bar', id: UUID });
    expect(filter).toBe(
      `name.gt."Café \\"Möwe\\" \\\\ Bar",and(name.eq."Café \\"Möwe\\" \\\\ Bar",id.gt."${UUID}")`,
    );
  });

  it('Kommas/Klammern im Namen bleiben sicher im Quoting eingeschlossen', () => {
    const filter = buildActivityCursorFilter({ name: 'a,b(c).d', id: UUID });
    expect(filter).toContain('name.gt."a,b(c).d"');
  });
});

describe('quotePostgrestValue', () => {
  it('quotet und escaped deterministisch', () => {
    expect(quotePostgrestValue('plain')).toBe('"plain"');
    expect(quotePostgrestValue('a"b')).toBe('"a\\"b"');
    expect(quotePostgrestValue('a\\b')).toBe('"a\\\\b"');
  });
});
