import { describe, it, expect } from 'vitest';
import { stripDashes, stripDashesDeep, findDashes } from '@/lib/blog/dashes';

describe('stripDashes', () => {
  it('macht aus Datums- und Zahlenspannen "bis"', () => {
    expect(stripDashes('21.–31. Jänner 2027')).toBe('21. bis 31. Jänner 2027');
    expect(stripDashes('Karten 25–120 Euro')).toBe('Karten 25 bis 120 Euro');
    expect(stripDashes('19:30 — 22:00')).toBe('19:30 bis 22:00');
  });

  it('ersetzt Einschub-Gedankenstriche durch Kommas', () => {
    expect(stripDashes('Das Festival – seit 1956 – ist berühmt.')).toBe('Das Festival, seit 1956, ist berühmt.');
  });

  it('lässt normale Bindestriche stehen', () => {
    expect(stripDashes('Saint-Saëns spielt')).toBe('Saint-Saëns spielt');
  });
});

describe('stripDashesDeep', () => {
  it('bereinigt verschachtelte Strings, aber keine URLs', () => {
    const out = stripDashesDeep({
      a: 'x – y',
      list: ['1–2'],
      url: 'https://example.com/a–b',
      n: 3,
    });
    expect(out).toEqual({ a: 'x, y', list: ['1 bis 2'], url: 'https://example.com/a–b', n: 3 });
  });
});

describe('findDashes', () => {
  it('meldet Gedankenstriche und Kopplungen, ignoriert URLs und erlaubte Namen', () => {
    const f = findDashes('Das Open-Air – mit Saint-Saëns, siehe https://a.at/b-c', ['Saint-Saëns']);
    expect(f.map(x => x.kind)).toEqual(['dash', 'hyphen']);
    expect(f[1].match).toBe('Open-Air');
  });

  it('liefert nichts für sauberen Text', () => {
    expect(findDashes('Vom 21. bis 31. Jänner im Großen Saal.')).toEqual([]);
  });
});
