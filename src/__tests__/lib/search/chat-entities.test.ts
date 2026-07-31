import { describe, it, expect } from 'vitest';
import { extractEntityRefs, stripEntityMarkers } from '@/lib/search/chat-entities';

describe('extractEntityRefs', () => {
  it('findet Event- und Activity-Marker in Text-Reihenfolge', () => {
    const text = 'Zuerst die Therme [activity:therme-x-abc123], danach das Konzert [event:9e6854c5-4118] im Park.';
    expect(extractEntityRefs(text)).toEqual([
      { kind: 'activity', ref: 'therme-x-abc123' },
      { kind: 'event', ref: '9e6854c5-4118' },
    ]);
  });

  it('dedupliziert wiederholte Marker', () => {
    const text = '[event:abc] und nochmal [event:abc] und [event:def]';
    expect(extractEntityRefs(text).map(r => (r.kind === 'suggestion' ? r.text : r.ref))).toEqual(['abc', 'def']);
  });

  it('ignoriert kaputte/fremde Marker', () => {
    expect(extractEntityRefs('[venue:abc] [event:] [event:ok] [event:has space]')).toEqual([
      { kind: 'event', ref: 'ok' },
    ]);
  });

  it('leerer Text → leere Liste', () => {
    expect(extractEntityRefs('')).toEqual([]);
    expect(extractEntityRefs('ganz ohne Marker')).toEqual([]);
  });

  it('tipp-Marker werden als suggestion extrahiert (fn-19 Tipp-Karten)', () => {
    const text = 'Wie wärs damit? [tipp:Picknick mit Seeblick] Danach das Konzert [event:abc].';
    expect(extractEntityRefs(text)).toEqual([
      { kind: 'suggestion', text: 'Picknick mit Seeblick' },
      { kind: 'event', ref: 'abc' },
    ]);
  });

  it('tipp-Dedupe ist case-insensitiv; zu kurze Tipps fallen weg', () => {
    const refs = extractEntityRefs('[tipp:Radtour am See] und [tipp:radtour am see] und [tipp:ab]');
    expect(refs).toEqual([{ kind: 'suggestion', text: 'Radtour am See' }]);
  });
});

describe('stripEntityMarkers', () => {
  it('entfernt Marker und räumt doppelte Leerzeichen auf', () => {
    const text = 'Das Konzert [event:abc-123] im Stadtpark ist super.';
    expect(stripEntityMarkers(text)).toBe('Das Konzert im Stadtpark ist super.');
  });

  it('räumt Leerzeichen vor Satzzeichen auf', () => {
    expect(stripEntityMarkers('Die Therme [activity:xyz], danach essen.')).toBe('Die Therme, danach essen.');
  });

  it('erhält Zeilenumbrüche (Tagesplan-Gliederung)', () => {
    const text = 'Nachmittag: Therme [activity:a]\nAbend: Konzert [event:b]';
    expect(stripEntityMarkers(text)).toBe('Nachmittag: Therme\nAbend: Konzert');
  });

  it('lässt Text ohne Marker unverändert', () => {
    expect(stripEntityMarkers('Servus! Wie kann ich helfen?')).toBe('Servus! Wie kann ich helfen?');
  });

  it('entfernt auch tipp-Marker', () => {
    expect(stripEntityMarkers('Wie wärs mit einem Picknick? [tipp:Picknick mit Seeblick] Danach …'))
      .toBe('Wie wärs mit einem Picknick? Danach …');
  });
});
