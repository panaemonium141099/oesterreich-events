import { describe, it, expect } from 'vitest';
import {
  contentFingerprint,
  normalizeActivityName,
  quantizeCoord,
  fixMojibake,
} from '@/lib/activities/fingerprint';

describe('quantizeCoord (exakt spezifizierter Algorithmus: round(x*1000)/1000)', () => {
  it('rundet auf 3 Dezimalstellen', () => {
    expect(quantizeCoord(47.2446301479087)).toBe(47.245);
    expect(quantizeCoord(13.109825458197)).toBe(13.11);
    expect(quantizeCoord(47.2)).toBe(47.2);
  });
});

describe('normalizeActivityName', () => {
  it('lowercase + Whitespace-Kollaps + Trim', () => {
    expect(normalizeActivityName('  Mountaincart  am   Erlebnisberg Fulseck ')).toBe(
      'mountaincart am erlebnisberg fulseck',
    );
  });

  it('bereinigt Mojibake', () => {
    expect(normalizeActivityName('HÃ¼tteneckalm')).toBe('hütteneckalm');
    expect(normalizeActivityName('GroÃŸarltal â€“ Talstation')).toBe('großarltal – talstation');
  });
});

describe('fixMojibake', () => {
  it('repariert die gaengigen deutschen Sequenzen', () => {
    expect(fixMojibake('Ã¤Ã¶Ã¼ÃŸ Ã„Ã–Ãœ')).toBe('äöüß ÄÖÜ');
    expect(fixMojibake('CafÃ©')).toBe('Café');
  });

  it('laesst saubere Strings unveraendert', () => {
    expect(fixMojibake('Hütteneckalm – Café')).toBe('Hütteneckalm – Café');
  });

  it('repariert à/NBSP-Mojibake (Ã+NBSP), ohne Ã+Space zu korrumpieren', () => {
    // 'à la carte' doppelt-encodet: 'Ã' + U+00A0.
    expect(fixMojibake('Ã  la carte')).toBe('à la carte');
    // NBSP-Mojibake ('Â' + U+00A0) wird zu normalem Space.
    expect(fixMojibake('BadÂ Gastein')).toBe('Bad Gastein');
    // Legitimes 'Ã' + normales Leerzeichen bleibt unveraendert.
    expect(fixMojibake('Ã Wien')).toBe('Ã Wien');
  });
});

describe('contentFingerprint (Epic-E11-Fixtures)', () => {
  it('ist ein 40-Zeichen-sha1-Hex', () => {
    expect(contentFingerprint('Freibad', 47.852, 16.847)).toMatch(/^[0-9a-f]{40}$/);
  });

  it('Fixture-Paar gleicher Bucket -> gleicher Hash (Mirror-Regionen-Fall)', () => {
    // Beide Koordinaten quantisieren auf (47.245, 13.110).
    const a = contentFingerprint('Mountaincart am Erlebnisberg Fulseck', 47.2446301479087, 13.109825458197);
    const b = contentFingerprint('Mountaincart am Erlebnisberg Fulseck', 47.2453, 13.1101);
    expect(a).toBe(b);
  });

  it('Namens-Normalisierung greift im Hash (Whitespace + Mojibake)', () => {
    const clean = contentFingerprint('Hütteneckalm', 47.6, 13.6);
    const messy = contentFingerprint('  HÃ¼tteneckalm ', 47.6, 13.6);
    expect(messy).toBe(clean);
  });

  it('Fixture-Paar verschiedener Bucket -> anderer Hash', () => {
    // 47.2446 -> 47.245, aber 47.2456 -> 47.246 (Nachbar-Bucket).
    const a = contentFingerprint('Mountaincart am Erlebnisberg Fulseck', 47.2446, 13.1098);
    const b = contentFingerprint('Mountaincart am Erlebnisberg Fulseck', 47.2456, 13.1098);
    expect(a).not.toBe(b);
  });

  it('anderer Name -> anderer Hash (gleicher Bucket)', () => {
    const a = contentFingerprint('Freibad Podersdorf', 47.852, 16.847);
    const b = contentFingerprint('Strandbad Podersdorf', 47.852, 16.847);
    expect(a).not.toBe(b);
  });
});
