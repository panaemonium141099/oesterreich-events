import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Wächter gegen Datumsanzeige in der Zeitzone der Runtime.
//
// Der Server läuft in UTC, Browser in der Zone des Besuchers. Ein
// `toLocaleTimeString('de-AT', { hour, minute })` ohne `timeZone` zeigt
// deshalb im Server-HTML eine andere Uhrzeit als im Browser und als auf der
// Detailseite. Befund 2026-10-06: /thema/musik listete ein Konzert um 17:30,
// die Detailseite 19:30 (richtig). 111 Stellen formatierten so.
//
// Regel: jeder Datums-Formatter nennt seine Zeitzone, praktisch immer
// `timeZone: EVENT_TZ` aus `@/lib/utils/event-time`. Für Event-Anzeigen gibt
// es fertige Helfer: `formatEventDate` (event-time.ts) und `@/lib/utils/date`.

const FORMATTER_RE = /\b(toLocaleTimeString|toLocaleDateString|toLocaleString|Intl\.DateTimeFormat)\s*\(/g;
// toLocaleString gibt es auch auf Zahlen; nur Datums-Optionen zählen.
const DATE_OPTION_RE = /\b(hour|minute|second|weekday|day|month|year|dateStyle|timeStyle)\s*:/;

/** Datums-Formatter ohne `timeZone` im Quelltext. */
export function formattersWithoutTimeZone(source: string): string[] {
  // Kommentare zählen nicht (sie zitieren die alten Fehlerformen).
  // Block-Kommentare durch Leerzeichen ersetzen, damit Zeilennummern stimmen.
  const text = source
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|\s)\/\/.*$/gm, '$1');
  const out: string[] = [];
  for (const m of text.matchAll(FORMATTER_RE)) {
    const start = m.index! + m[0].length;
    let depth = 1;
    let i = start;
    while (i < text.length && depth > 0) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') depth--;
      i++;
    }
    const args = text.slice(start, i - 1);
    if (/\btimeZone\b/.test(args)) continue;
    if (m[1] === 'toLocaleString' && !DATE_OPTION_RE.test(args)) continue;
    const line = text.slice(0, m.index).split('\n').length;
    out.push(`${line}: ${m[1]}(${args.replace(/\s+/g, ' ').trim().slice(0, 60)})`);
  }
  return out;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== '__tests__') out.push(...sourceFiles(p));
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

describe('Datumsanzeige mit fester Zeitzone', () => {
  it('kein Datums-Formatter im Code läuft in der Zeitzone der Runtime', () => {
    const found = sourceFiles(join(process.cwd(), 'src')).flatMap((f) =>
      formattersWithoutTimeZone(readFileSync(f, 'utf8')).map(
        (q) => `${relative(process.cwd(), f).replace(/\\/g, '/')}:${q}`,
      ),
    );
    expect(found, `Ohne timeZone (timeZone: EVENT_TZ ergänzen):\n${found.join('\n')}`).toEqual([]);
  });

  it('erkennt die typischen Formen und lässt korrekte durch', () => {
    for (const bad of [
      "d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })",
      "d.toLocaleDateString('de-AT')",
      "d.toLocaleDateString(fmt, sameYear ? { day: 'numeric' } : { year: 'numeric' })",
      "d.toLocaleString('de-AT', { day: '2-digit', hour: '2-digit' })",
      "new Intl.DateTimeFormat('de-AT', { weekday: 'long' })",
    ]) {
      expect(formattersWithoutTimeZone(bad), bad).toHaveLength(1);
    }
    for (const ok of [
      "d.toLocaleTimeString('de-AT', { hour: '2-digit', timeZone: EVENT_TZ })",
      "d.toLocaleDateString('de-AT', { timeZone: EVENT_TZ })",
      "new Intl.DateTimeFormat('en-CA', {\n  timeZone: EVENT_TZ,\n  year: 'numeric',\n})",
      'count.toLocaleString(numberLocale)',
      "n.toLocaleString('de-AT', { maximumFractionDigits: 1 })",
      "// früher: d.toLocaleTimeString('de-AT')",
    ]) {
      expect(formattersWithoutTimeZone(ok), ok).toEqual([]);
    }
  });
});
