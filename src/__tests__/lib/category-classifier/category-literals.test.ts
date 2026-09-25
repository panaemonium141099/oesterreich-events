import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CATEGORIES, resolveCategoryParam } from '@/lib/category-classifier/taxonomy';

// Wächter: Event-Abfragen und Links nennen Kategorien nur so, wie sie in der
// Datenbank stehen (Taxonomie v3). Befund 2026-09-25: die Landing fragte
// `category.eq.music,category.eq.konzerte` ab und der Link „Alle Konzerte“
// ging auf ?category=music. Seit der Classifier alles auf v3 schreibt,
// lieferte beides 0 Treffer, die Konzert-Sektion war leer.

const V3 = new Set<string>(CATEGORIES);

const PATTERNS: RegExp[] = [
  /category\.eq\.([^,'"`)&]+)/g,
  /\.eq\(\s*['"]category['"]\s*,\s*['"]([^'"]+)['"]/g,
  /[?&]category=([^&'"`\s]+)/g,
  /\.set\(\s*['"]category['"]\s*,\s*['"]([^'"]+)['"]/g,
];
const IN_PATTERN = /\.in\(\s*['"]category['"]\s*,\s*\[([^\]]*)\]/g;

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      // Blog-Posts haben eine eigene Rubrik-Taxonomie, keine Event-Kategorien.
      if (name === '__tests__' || p.endsWith(join('content', 'blog'))) continue;
      out.push(...files(p));
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

export function nonV3CategoryLiterals(src: string): string[] {
  const text = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  const bad: string[] = [];
  const check = (v: string) => {
    let value = v.trim().replace(/^['"]|['"]$/g, '');
    try { value = decodeURIComponent(value); } catch { /* roh lassen */ }
    if (!value || value.includes('${')) return; // dynamisch, nicht prüfbar
    if (!V3.has(value)) bad.push(value);
  };
  for (const re of PATTERNS) for (const m of text.matchAll(re)) check(m[1]);
  for (const m of text.matchAll(IN_PATTERN)) {
    for (const part of m[1].split(',')) if (/^\s*['"]/.test(part)) check(part);
  }
  return bad;
}

describe('Event-Kategorien im Code', () => {
  it('Abfragen und Links nutzen nur Kategorien der Taxonomie v3', () => {
    const found = files(join(process.cwd(), 'src')).flatMap((f) =>
      nonV3CategoryLiterals(readFileSync(f, 'utf8')).map(
        (v) => `${relative(process.cwd(), f).replace(/\\/g, '/')}: ${v}`,
      ),
    );
    expect(found, `Kategorie nicht in CATEGORIES:\n${found.join('\n')}`).toEqual([]);
  });

  it('erkennt die Fehlerformen vom 25.09.', () => {
    expect(nonV3CategoryLiterals(".or('category.eq.music,category.eq.konzerte')")).toEqual(['music', 'konzerte']);
    expect(nonV3CategoryLiterals('href="/entdecken?category=music"')).toEqual(['music']);
    expect(nonV3CategoryLiterals(".eq('category', 'Musik')")).toEqual([]);
    expect(nonV3CategoryLiterals('href="/entdecken?category=M%C3%A4rkte%20%26%20Feste"')).toEqual([]);
  });
});

describe('resolveCategoryParam', () => {
  it('bildet Altnamen, Kurz-IDs und Schreibweisen auf v3 ab', () => {
    expect(resolveCategoryParam('music')).toBe('Musik');
    expect(resolveCategoryParam('Konzerte')).toBe('Musik');
    expect(resolveCategoryParam('Wein & Kulinarik')).toBe('Essen & Trinken');
    expect(resolveCategoryParam('markets')).toBe('Märkte & Feste');
    expect(resolveCategoryParam('kultur & bühne')).toBe('Kultur & Bühne');
    expect(resolveCategoryParam('Musik')).toBe('Musik');
  });
  it('lässt Unbekanntes und Leeres als null', () => {
    expect(resolveCategoryParam('festival')).toBeNull();
    expect(resolveCategoryParam('')).toBeNull();
    expect(resolveCategoryParam(null)).toBeNull();
  });
});
