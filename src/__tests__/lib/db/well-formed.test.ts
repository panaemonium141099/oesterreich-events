import { describe, expect, it } from 'vitest';
import { stripLoneSurrogates, wellFormed } from '@/lib/db/well-formed';

// Prod 2026-11-05, Eventfrog 7522266300283923542: die Beschreibung endete
// nach der Kürzung auf 997 Zeichen mit einem halben Emoji.
const CUT = `🚂 5min zu Fuß vom Bahnhof\n${'📍'.slice(0, 1)}...`;

describe('stripLoneSurrogates', () => {
  it('entfernt ein halbes Zeichen und lässt ganze Emojis stehen', () => {
    expect(stripLoneSurrogates(CUT)).toBe('🚂 5min zu Fuß vom Bahnhof\n...');
    expect(stripLoneSurrogates(`${'📍'.slice(1)}Bahnhof`)).toBe('Bahnhof');
  });

  it('lässt wohlgeformten Text unverändert', () => {
    const text = 'Tanzabend 🎷 mit sax’n’more, Eintritt 12 €';
    expect(stripLoneSurrogates(text)).toBe(text);
  });

  it('macht den Text für JSON in Postgres gültig', () => {
    // Postgres lehnt die Escape-Folge eines einzelnen Surrogats ab.
    expect(JSON.stringify(CUT)).toMatch(/\\ud83d/);
    expect(JSON.stringify(stripLoneSurrogates(CUT))).not.toMatch(/\\ud[89a-f][0-9a-f]{2}/);
  });
});

describe('wellFormed', () => {
  it('bereinigt Felder, Listen und verschachtelte Objekte', () => {
    const event = {
      title: 'Tanzabend',
      description: CUT,
      tags: ['tanz', `live${'🎷'.slice(0, 1)}`],
      lineup: [{ name: `Sax${'🎷'.slice(0, 1)}`, role: 'headliner' }],
      latitude: 48.2,
    };
    expect(wellFormed(event)).toEqual({
      title: 'Tanzabend',
      description: '🚂 5min zu Fuß vom Bahnhof\n...',
      tags: ['tanz', 'live'],
      lineup: [{ name: 'Sax', role: 'headliner' }],
      latitude: 48.2,
    });
  });

  it('gibt ohne Fund denselben Wert zurück und verändert die Eingabe nie', () => {
    const clean = { title: 'Jazz Night 🎷', tags: ['jazz'], when: new Date('2026-11-05T19:00:00Z') };
    expect(wellFormed(clean)).toBe(clean);

    const broken = { title: 'Jazz', description: CUT };
    const fixed = wellFormed(broken);
    expect(fixed).not.toBe(broken);
    expect(broken.description).toBe(CUT);
  });
});

describe('Schreibweg', () => {
  it('der Sync bereinigt jede Lieferung, bevor er sie liest', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const sync = readFileSync(join(process.cwd(), 'src/lib/db/supabase-sync.ts'), 'utf8');
    const clean = sync.indexOf('rawEvents.map(e => wellFormed(e))');
    expect(clean).toBeGreaterThan(-1);
    expect(clean).toBeLessThan(sync.indexOf('normalizeEventTimestamps(wellFormedEvents)'));
  });
});
