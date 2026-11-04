import { describe, it, expect } from 'vitest';
import { parseProse, parseRuns } from '@/lib/blog/prose';

describe('parseRuns', () => {
  it('zerlegt Fettdruck in Läufe', () => {
    expect(parseRuns('**Wien hängt nicht am Advent.** Der Markt startet Mitte November.')).toEqual([
      { text: 'Wien hängt nicht am Advent.', bold: true },
      { text: ' Der Markt startet Mitte November.', bold: false },
    ]);
  });

  it('lässt Text ohne Sterne unverändert', () => {
    expect(parseRuns('Nur Text')).toEqual([{ text: 'Nur Text', bold: false }]);
  });

  it('behandelt unpaarige Sterne als Text', () => {
    expect(parseRuns('2 ** 3 = 8')).toEqual([{ text: '2 ** 3 = 8', bold: false }]);
  });
});

describe('parseProse', () => {
  it('macht aus Zeilenumbrüchen Absätze (Silvester-Guide: ein Absatz je Bundesland)', () => {
    const blocks = parseProse('**Wien:** Der Silvesterpfad.\n\n**Tirol:** Silvester am Berg.\nVORARLBERG: Silvesterblasen.');
    expect(blocks).toHaveLength(3);
    expect(blocks.every((b) => b.type === 'paragraph')).toBe(true);
    expect(blocks[0]).toEqual({ type: 'paragraph', runs: [{ text: 'Wien:', bold: true }, { text: ' Der Silvesterpfad.', bold: false }] });
  });

  it('erkennt Markdown-Zwischentitel (Christkindlmärkte: „## Die zwei Startregeln")', () => {
    const blocks = parseProse('## Die zwei Startregeln, die du kennen solltest\n\nWien hängt nicht am Advent.');
    expect(blocks[0]).toEqual({ type: 'heading', text: 'Die zwei Startregeln, die du kennen solltest' });
    expect(blocks[1].type).toBe('paragraph');
  });

  it('überspringt Leerzeilen und Whitespace', () => {
    expect(parseProse('\n\n  Ein Absatz.  \n\n\n')).toEqual([{ type: 'paragraph', runs: [{ text: 'Ein Absatz.', bold: false }] }]);
    expect(parseProse('')).toEqual([]);
  });
});
