import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { POSTGREST_MAX_ROWS, fetchAllRows, forEachPage } from '@/lib/db/fetch-all';

// Wächter gegen still gekürzte Abfragen: PostgREST liefert höchstens
// POSTGREST_MAX_ROWS Zeilen pro Antwort. `.limit(5000)` oder
// `.range(o, o + 4999)` sehen nach „alles“ aus und liefern 1000 Zeilen,
// ohne Fehler. So las der Dedup seit dem Hetzner-Umzug nur vergangene Tage
// und die Events-API brach nach 1000 Events ab (Befund 2026-09-24).
// Wer mehr als POSTGREST_MAX_ROWS braucht: fetchAllRows/forEachPage.

const num = (s: string) => Number(s.replace(/_/g, ''));

/** Abfragen, die mehr Zeilen erwarten, als eine Antwort enthalten kann. */
export function overCapQueries(source: string): string[] {
  // Kommentare zählen nicht (sie zitieren die alten Fehlerformen).
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  const consts = new Map<string, number>();
  for (const m of text.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*([0-9][0-9_]*)\b/g)) {
    consts.set(m[1], num(m[2]));
  }
  const value = (tok: string) => (/^[0-9_]+$/.test(tok) ? num(tok) : consts.get(tok));
  const out: string[] = [];
  for (const m of text.matchAll(/\.limit\(\s*([A-Z0-9_]+)\s*\)/g)) {
    const v = value(m[1]);
    if (v !== undefined && v > POSTGREST_MAX_ROWS) out.push(m[0]);
  }
  for (const m of text.matchAll(/\.range\(\s*[\w.]+\s*,\s*[\w.]+\s*\+\s*([A-Z0-9_]+)\s*(-\s*1)?\s*\)/g)) {
    const v = value(m[1]);
    if (v !== undefined && (m[2] ? v : v + 1) > POSTGREST_MAX_ROWS) out.push(m[0]);
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

describe('PostgREST-Zeilendeckel', () => {
  it('keine Abfrage im Code erwartet mehr als POSTGREST_MAX_ROWS Zeilen auf einmal', () => {
    const found = sourceFiles(join(process.cwd(), 'src')).flatMap((f) =>
      overCapQueries(readFileSync(f, 'utf8')).map(
        (q) => `${relative(process.cwd(), f).replace(/\\/g, '/')}: ${q}`,
      ),
    );
    expect(found, `Über dem Deckel, fetchAllRows nutzen:\n${found.join('\n')}`).toEqual([]);
  });

  it('erkennt die typischen Formen und lässt korrekte Seiten durch', () => {
    for (const bad of [
      '.limit(5000)',
      '.limit(100_000)',
      '.range(offset, offset + 4999)',
      'const PAGE_SIZE = 10000;\nq.range(offset, offset + PAGE_SIZE - 1)',
      'const BATCH = 2000;\nq.limit(BATCH)',
    ]) {
      expect(overCapQueries(bad), bad).toHaveLength(1);
    }
    for (const ok of [
      '.limit(1000)',
      '// früher .limit(5000)',
      '.range(offset, offset + 999)',
      'const PAGE = 1000;\nq.range(o, o + PAGE - 1)',
    ]) {
      expect(overCapQueries(ok), ok).toEqual([]);
    }
  });
});

describe('fetchAllRows', () => {
  const table = Array.from({ length: 2345 }, (_, i) => i);
  // Server, der jede Antwort auf `cap` Zeilen kürzt.
  const server = (cap: number) => (from: number, to: number) =>
    Promise.resolve({ data: table.slice(from, Math.min(to + 1, from + cap)), error: null });

  it('liest über den Deckel hinweg alle Zeilen', async () => {
    expect(await fetchAllRows(server(POSTGREST_MAX_ROWS))).toEqual(table);
  });

  it('respektiert maxRows', async () => {
    expect(await fetchAllRows(server(POSTGREST_MAX_ROWS), { maxRows: 1500 })).toEqual(table.slice(0, 1500));
  });

  it('bricht erst bei leerer Seite ab, nicht bei einer gekürzten', async () => {
    let pages = 0;
    const n = await forEachPage(server(500), () => { pages++; });
    expect(n).toBe(table.length);
    expect(pages).toBe(5);
  });

  it('wirft bei Fehlern statt ein Teilergebnis zu liefern', async () => {
    const broken = () => Promise.resolve({ data: null, error: { message: 'timeout' } });
    await expect(fetchAllRows(broken, { label: 'x' })).rejects.toThrow('x: timeout');
  });
});
