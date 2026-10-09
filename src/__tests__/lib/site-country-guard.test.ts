/**
 * Wächter: lasstreffen.at spielt nur Events aus SITE_COUNTRY aus.
 *
 * Bis 2026-10 standen rund 8.000 Eventim-Events aus Deutschland und der
 * Schweiz in der Event-Sitemap (/events/0000-at/…), auf Detailseiten, in der
 * Smart-Suche, auf Gemeinde- und Themen-Hubs, im Newsletter und in
 * Künstler-Benachrichtigungen. Bundesland-, Bezirks- oder Umkreis-Filter
 * schützen davor nicht (1.007 DE-Events im österreichischen Rechteck, 36
 * CH-Events mit österreichischem Bezirk). Deshalb trägt jede Lesestelle auf
 * `events` einen Länderfilter in derselben Anweisung, oder sie steht unten
 * mit Begründung in der Ausnahmeliste.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { SITE_COUNTRY } from '@/lib/site-country';

const ROOTS = ['src/app', 'src/lib', 'src/components'];

/** Dateien bzw. Bereiche, die ohne Länderfilter lesen dürfen. */
const ALLOW: Array<{ match: RegExp; reason: string }> = [
  { match: /\/admin\//, reason: 'Admin sieht bewusst alle Länder' },
  { match: /^src\/lib\/db\//, reason: 'Schreibpfad und Migrationen der Pipeline' },
  { match: /^src\/lib\/pipeline\//, reason: 'Pipeline (Dedup, Matching), keine Ausspielung' },
  { match: /^src\/lib\/outreach\//, reason: 'interne B2B-Akquise' },
  { match: /^src\/lib\/lineup\/derive-events\.ts$/, reason: 'Pipeline erzeugt abgeleitete Events' },
  { match: /^src\/lib\/artist-matching\.ts$/, reason: 'Pipeline/CLI; der Länderfilter sitzt in den Matching-RPCs (Migration 20261008100000)' },
  { match: /^src\/app\/api\/events\/route\.ts$/, reason: 'Query-Builder: Länderfilter als eigener Schritt (query.eq), dazu Cursor-Lookups per ID; abgesichert in events.test.ts' },
  { match: /^src\/app\/api\/events\/related\/route\.ts$/, reason: 'lädt nur das Ausgangs-Event per ID, die Ergebnisse filtern das Land' },
  { match: /^src\/lib\/events\/event-detail-loaders\.ts$/, reason: 'Dubletten-Lookups bewusst ohne Land (DE-Dublette leitet auf das AT-Original), alle Ziele filtern das Land' },
  { match: /^src\/lib\/v4\/derive-detail-context\.ts$/, reason: 'Kontext zur ID der bereits gefilterten Detailseite' },
  { match: /^src\/app\/api\/events\/\[id\]\/personal-context\/route\.ts$/, reason: 'Kontext zur ID der bereits gefilterten Detailseite' },
  { match: /^src\/app\/\[locale\]\/fuer-firmen\/boost\/erfolg\/page\.tsx$/, reason: 'eigenes Firmen-Event nach der Zahlung' },
  { match: /^src\/app\/api\/img\/\[eventId\]\/route\.ts$/, reason: 'Bild-Proxy, entscheidet nicht über Sichtbarkeit' },
  { match: /^src\/app\/\[locale\]\/feed\//, reason: 'Feed eingefroren (MASTERPLAN §8.6), Prod 2026-10-08: 0 DE/CH-Aktivitäten' },
];

const READ_SITE = /from\(\s*['"]events['"]\s*\)|events!inner|event:events|events:events|parent_event:events|rpc\(\s*['"]search_event_ids/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '__tests__') walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      out.push(p.split(sep).join('/'));
    }
  }
  return out;
}

/** Die Anweisung ab der Fundstelle: bis zum ersten Semikolon am Zeilenende. */
function statementAt(src: string, index: number): string {
  const rest = src.slice(index);
  const end = rest.search(/;[ \t]*(\r?\n|$)/);
  return end < 0 ? rest.slice(0, 2000) : rest.slice(0, end);
}

describe('Länder-Wächter (SITE_COUNTRY)', () => {
  it('die Seite ist österreichisch', () => {
    expect(SITE_COUNTRY).toBe('AT');
  });

  it('jede öffentliche Lesestelle auf events filtert das Land', () => {
    const missing: string[] = [];
    for (const file of ROOTS.flatMap(r => walk(r))) {
      if (ALLOW.some(a => a.match.test(file))) continue;
      const src = readFileSync(file, 'utf8');
      READ_SITE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = READ_SITE.exec(src))) {
        const stmt = statementAt(src, m.index);
        if (/\.(insert|update|upsert|delete)\(/.test(stmt)) continue;
        if (/country/.test(stmt)) continue;
        const line = src.slice(0, m.index).split('\n').length;
        missing.push(`${file}:${line}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('jede Ausnahme zeigt auf existierenden Code', () => {
    const files = ROOTS.flatMap(r => walk(r));
    const stale = ALLOW.filter(a => !files.some(f => a.match.test(f))).map(a => String(a.match));
    expect(stale).toEqual([]);
  });

  it('kein Rest des Länder-Schalters im Code', () => {
    const leftovers: string[] = [];
    for (const file of ROOTS.flatMap(r => walk(r))) {
      const src = readFileSync(file, 'utf8');
      if (/\batOnly\b|includeDeCh|AT,DE,CH|['"]at-de-ch['"]/.test(src)) leftovers.push(file);
    }
    expect(leftovers).toEqual([]);
    expect(existsSync('public/at-de-ch.geojson')).toBe(false);
  });
});
