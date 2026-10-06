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

// ─── Zweite Klasse: Tages-Zuordnung über Runtime-Getter ──────────────────
//
// `getDate()/getDay()/getHours()`, `setHours(0, 0, 0, 0)`, `toDateString()`
// und `new Date(y, m, d)` rechnen in der Zone der Runtime. Server = UTC,
// Browser = Zone des Besuchers: ein Event um 00:30 Wien landete serverseitig
// am Vortag, "heute/morgen"-Gruppen und Kalenderraster wichen zwischen SSR
// und Client ab (Befund 2026-10-06).
//
// Regel: Tages-Logik läuft über die Wien-Helfer aus `@/lib/utils/event-time`
// (toViennaDate, viennaToday, viennaWeekday, viennaFields, addViennaDays,
// viennaDayDiff, viennaDayStart, viennaDayRange). Kalenderrechnung ohne
// Zonenbezug geht über `Date.UTC(...)` + `getUTC*`.
//
// Ausnahmen brauchen einen Grund: ein Kommentar `tz-runtime: <Grund>` in
// derselben Zeile oder der Zeile davor, oder ein Eintrag in RUNTIME_DATE_ALLOWED.

const RUNTIME_DATE_RE =
  /\.(getHours|getMinutes|getSeconds|getDate|getDay|getMonth|getFullYear|setHours|setMinutes|setSeconds|setDate|setMonth|setFullYear|toDateString|toTimeString|getTimezoneOffset)\s*\(|\bnew Date\s*\(/g;

/** Dateien, deren Runtime-Datumslogik bewusst bleibt — mit Begründung. */
const RUNTIME_DATE_ALLOWED: Record<string, string> = {
  'src/app/api/admin/analytics/route.ts': 'Admin-Statistik über Seitenaufrufe, keine Event-Tage',
  'src/app/[locale]/admin/overview/page.tsx': 'Admin-Kennzahlen (neue Nutzer), keine Event-Tage',
  'src/scripts/archive-events.ts': 'Backup-Dateiname nach Laufwoche, keine Event-Zuordnung',
  'src/scripts/generate-saison-guide.ts': 'grobes Monatsfenster für Kandidaten, Jahreszahl im Fallback-Titel',
  'src/scripts/seed-festivals.ts': '±30-Tage-Suchfenster um den Festivalstart',
  'src/scripts/fast-backfill.ts': 'Plausibilitätsfenster "in den nächsten zwei Jahren"',
  'src/lib/quality/score-event.ts': 'Plausibilitätsfenster "in den nächsten zwei Jahren"',
  'src/lib/connectors/ics-connector.ts':
    'node-ical legt VALUE=DATE als Mitternacht der Runtime an; genau so wird es zurückgelesen',
  'src/components/Planer/detail/PlanSettingsDrawer.tsx':
    'Plan-Formular: Datum/Uhrzeit-Felder in Browser-Ortszeit, Hin- und Rückweg lokal',
};

/** Scraper lesen die Wandzeit ihrer Quelle und laufen in UTC (GitHub
 *  Actions); sie werden eigens geprüft: die Zahl darf nur sinken. */
const SCRAPER_DIR = 'src/lib/scrapers/';
const SCRAPER_BASELINE = 102; // Stand 2026-10-06

/** Runtime-abhängige Datumsaufrufe im Quelltext (`Zeile: Fundstelle`). */
export function runtimeDateCalls(source: string): string[] {
  const exempt = new Set<number>();
  source.split('\n').forEach((l, i) => {
    if (/tz-runtime:\s*\S/.test(l)) {
      exempt.add(i + 1);
      exempt.add(i + 2);
    }
  });
  const text = source
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|\s)\/\/.*$/gm, '$1');
  const out: string[] = [];
  for (const m of text.matchAll(RUNTIME_DATE_RE)) {
    const line = text.slice(0, m.index).split('\n').length;
    if (exempt.has(line)) continue;
    if (m[1]) {
      out.push(`${line}: .${m[1]}()`);
      continue;
    }
    // new Date(...) zählt nur mit Einzelfeldern (y, m, d, …); ein Argument ist ein Instant.
    let depth = 1;
    let commas = 0;
    let i = m.index! + m[0].length;
    const start = i;
    while (i < text.length && depth > 0) {
      const c = text[i];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === ',' && depth === 1) commas++;
      i++;
    }
    if (commas === 0) continue;
    out.push(`${line}: new Date(${text.slice(start, i - 1).replace(/\s+/g, ' ').trim().slice(0, 50)})`);
  }
  return out;
}

describe('Tages-Zuordnung unabhängig von der Runtime-Zone', () => {
  const all = sourceFiles(join(process.cwd(), 'src')).map((f) => ({
    rel: relative(process.cwd(), f).replace(/\\/g, '/'),
    hits: runtimeDateCalls(readFileSync(f, 'utf8')),
  }));

  it('kein runtime-abhängiger Date-Getter/-Setter ausserhalb der Scraper', () => {
    const found = all
      .filter((f) => !f.rel.startsWith(SCRAPER_DIR) && !RUNTIME_DATE_ALLOWED[f.rel])
      .flatMap((f) => f.hits.map((h) => `${f.rel}:${h}`));
    expect(
      found,
      `Runtime-Zone statt Wien (Helfer aus @/lib/utils/event-time nutzen):\n${found.join('\n')}`,
    ).toEqual([]);
  });

  it('Ausnahmeliste enthält nur Dateien, die es noch braucht', () => {
    const stale = Object.keys(RUNTIME_DATE_ALLOWED).filter(
      (rel) => !all.some((f) => f.rel === rel && f.hits.length > 0),
    );
    expect(stale, 'Eintrag aus RUNTIME_DATE_ALLOWED entfernen').toEqual([]);
  });

  it('Scraper: Zahl der Runtime-Datumsaufrufe steigt nicht', () => {
    const n = all
      .filter((f) => f.rel.startsWith(SCRAPER_DIR))
      .reduce((sum, f) => sum + f.hits.length, 0);
    expect(n).toBeLessThanOrEqual(SCRAPER_BASELINE);
  });

  it('erkennt die typischen Formen und lässt korrekte durch', () => {
    for (const bad of [
      'const d = new Date(); d.setHours(0, 0, 0, 0);',
      'if (a.toDateString() === b.toDateString()) {}',
      'const dow = new Date().getDay();',
      'new Date(year, month + 1, 0)',
      'new Date(\n  y,\n  m,\n)',
    ]) {
      expect(runtimeDateCalls(bad), bad).not.toEqual([]);
    }
    for (const ok of [
      'new Date(e.start_date)',
      'new Date(Date.UTC(y, m, 1)).getUTCDay()',
      'viennaFields(d).weekday',
      '// früher: d.setHours(0, 0, 0, 0)',
      'n.setDate(n.getDate() + 30); // tz-runtime: Abruffenster, ±1 Tag egal',
      '// tz-runtime: Formular in Browser-Ortszeit\nconst y = d.getFullYear();',
    ]) {
      expect(runtimeDateCalls(ok), ok).toEqual([]);
    }
  });
});
