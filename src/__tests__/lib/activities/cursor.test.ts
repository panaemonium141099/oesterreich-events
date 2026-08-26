import { describe, it, expect } from 'vitest';
import {
  buildActivityCursorFilter,
  decodeActivityCursor,
  encodeActivityCursor,
} from '@/lib/activities/cursor';

const UUID = '01234567-89ab-cdef-0123-456789abcdef';

describe('Activity-Cursor Round-Trip (Wire-Format: base64url-JSON {q,id})', () => {
  it.each([84, 0, -15, 7])('round-trippt Score-Werte: %d', (q) => {
    const encoded = encodeActivityCursor({ q, id: UUID });
    // base64url: URL-safe ohne Padding-Sonderzeichen
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeActivityCursor(encoded)).toEqual({ q, id: UUID });
  });

  it('dekodiert das dokumentierte Wire-Format direkt', () => {
    const wire = Buffer.from(JSON.stringify({ q: 42, id: UUID }), 'utf8').toString('base64url');
    expect(decodeActivityCursor(wire)).toEqual({ q: 42, id: UUID });
  });

  it('normalisiert die UUID auf lowercase (DB-Vergleichsform)', () => {
    const encoded = encodeActivityCursor({ q: 1, id: UUID.toUpperCase() });
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
    ['q fehlt', Buffer.from(JSON.stringify({ id: UUID })).toString('base64url')],
    ['q kein Integer', Buffer.from(JSON.stringify({ q: 1.5, id: UUID })).toString('base64url')],
    ['q als String', Buffer.from(JSON.stringify({ q: '42', id: UUID })).toString('base64url')],
    ['id fehlt', Buffer.from(JSON.stringify({ q: 1 })).toString('base64url')],
    ['id keine UUID', Buffer.from(JSON.stringify({ q: 1, id: 'abc' })).toString('base64url')],
    [
      'id mit SQL-Injection-Versuch',
      Buffer.from(JSON.stringify({ q: 1, id: `${UUID}),visible.eq.false` })).toString('base64url'),
    ],
    [
      'Alt-Format {name,id} (vor Ranking-Umbau 2026-08-26)',
      Buffer.from(JSON.stringify({ name: 'Alpen Arena', id: UUID })).toString('base64url'),
    ],
  ])('lehnt ab: %s', (_label, raw) => {
    expect(decodeActivityCursor(raw as string | null | undefined)).toBeNull();
  });
});

describe('buildActivityCursorFilter — Lookup-Regel score<$q OR (score=$q AND id>$i)', () => {
  it('baut den PostgREST-or-Ausdruck', () => {
    expect(buildActivityCursorFilter({ q: 84, id: UUID })).toBe(
      `quality_score.lt.84,and(quality_score.eq.84,id.gt."${UUID}")`,
    );
  });

  it('auch mit negativem Score (Saisonbetrieb ausserhalb der Saison)', () => {
    expect(buildActivityCursorFilter({ q: -15, id: UUID })).toBe(
      `quality_score.lt.-15,and(quality_score.eq.-15,id.gt."${UUID}")`,
    );
  });
});
