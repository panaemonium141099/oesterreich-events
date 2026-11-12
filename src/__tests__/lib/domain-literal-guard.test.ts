/**
 * Wächter: Domain, Locale und Land der Seite stehen nur in src/lib/site/.
 *
 * Aus dieser Codebasis entstehen lasstreffen.at und lasstreffen.de (fn-31).
 * Eine fest eingetragene Domain, ein festes `de-AT` (hreflang oder
 * Datumsformat) oder ein festes `addressCountry: 'AT'` wäre auf der jeweils
 * anderen Seite falsch: Canonical auf die fremde Domain, „Jänner“ auf .de.
 *
 * Ausnahmen brauchen einen Grund. Zwei Arten:
 *  - Die Datei gehört zu einer Säule, die lasstreffen.de nicht ausspielt
 *    (Feature-Matrix). Wird die Säule dort eingeschaltet, schlägt der Wächter
 *    an und die Datei muss vorher länderfähig werden.
 *  - Eine Regel unten mit Begründung.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { SITES } from '@/lib/site/sites';
import { featureOfPath } from '@/lib/site/features';
import { bilingualAlternates, deOnlyAlternates } from '@/lib/seo/canonical';
import { SITEMAP_BASE_URL } from '@/lib/seo/sitemap-xml';
import { getSite } from '@/lib/site';
import robots from '@/app/robots';

const ROOTS = ['src/app', 'src/lib', 'src/components'];

/** Hier darf die Domain stehen: die Site selbst. */
const OWN = /^src\/lib\/site\//;

const PATTERNS: RegExp[] = [
  /lasstreffen\.(at|de)/i,
  /['"]de[-_](AT|DE)['"]/,
  /addressCountry['"]?\s*:\s*['"](AT|DE)['"]/,
];

/** Ausnahmen mit Begründung. Jede Regel muss noch mindestens eine Datei treffen. */
const ALLOW: Array<{ match: RegExp; reason: string }> = [
  {
    match: /^src\/app\/\[locale\]\/(agb|datenschutz|impressum|quellen|ueber-uns)\/page\.tsx$/,
    reason: 'Rechts- und Selbstdarstellungstexte: Wortlaut je Seite liefert der Betreiber (fn-31.13)',
  },
  {
    match: /^src\/app\/api\/cron\/(lifecycle-emails|newsletter-weekly|send-reminders|seo-[a-z-]+)\/route\.ts$/,
    reason: 'Mail- und SEO-Crons laufen nur für lasstreffen.at, für .de gibt es keinen Timer',
  },
  {
    match: /^src\/lib\/(email|newsletter|event-reminder)\.ts$|^src\/lib\/lifecycle\//,
    reason: 'Mailversand: Säulen newsletter und account sind auf .de aus',
  },
  {
    match: /^src\/lib\/outreach\/|^src\/lib\/reporting\//,
    reason: 'interne Akquise und Betriebsberichte des Betreibers, keine Ausspielung',
  },
  {
    match: /^src\/components\/(Blog|Business|Admin)\/|^src\/lib\/(blog|festivals|themes)\/|^src\/lib\/student-data\.ts$/,
    reason: 'Bausteine der Säulen Blog, Veranstalter-Pakete, Admin, Festivals, Themen, Studenten: auf .de aus',
  },
  {
    match: /^src\/app\/api\/img\/\[eventId\]\/route\.ts$|^src\/lib\/quality\/withdrawal\.ts$|^src\/lib\/scrapers\/|^src\/lib\/activities\/wikimedia-image\.ts$/,
    reason: 'User-Agent der Abrufe nennt den Betreiber und seine Quellenseite, unabhängig von der Seite',
  },
  {
    match: /^src\/lib\/affiliate\/viator-client\.ts$|^src\/components\/Affiliate\//,
    reason: 'Sprachcode der Partner (Viator, GetYourGuide führen Deutsch als de-DE), nicht die Locale der Seite',
  },
  {
    match: /^src\/lib\/pruefstand\/report\.ts$/,
    reason: 'Prüfstand-Bericht der deutschen Adapter, Zeitangaben für Deutschland',
  },
];

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

/** Kommentarzeilen zählen nicht: sie erklären, sie spielen nichts aus. */
function hasLiteral(file: string): boolean {
  const lines = readFileSync(file, 'utf8')
    .split('\n')
    .filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line));
  return PATTERNS.some(re => lines.some(l => re.test(l)));
}

/** Der Pfad, unter dem eine Datei aus src/app ausgespielt wird; sonst null. */
function servedPath(file: string): string | null {
  const page = file.match(/^src\/app\/\[locale\]\/(.+)$/);
  if (page) return `/${page[1]}`;
  const root = file.match(/^src\/app\/(.+)$/);
  return root ? `/${root[1].replace(/\/route\.tsx?$/, '')}` : null;
}

/** Säule der Datei, wenn lasstreffen.de sie nicht ausspielt. */
function pillarOffOnDe(file: string): string | null {
  const path = servedPath(file);
  const feature = path ? featureOfPath(path) : null;
  return feature && !SITES.DE.features[feature] ? feature : null;
}

describe('Domain-Wächter (src/lib/site ist die einzige Stelle)', () => {
  const withLiteral = ROOTS.flatMap(r => walk(r)).filter(f => !OWN.test(f) && hasLiteral(f));

  it('kein Literal außerhalb der Site, abgeschalteter Säulen und begründeter Ausnahmen', () => {
    const offen = withLiteral.filter(f => !pillarOffOnDe(f) && !ALLOW.some(a => a.match.test(f)));
    expect(offen).toEqual([]);
  });

  it('jede Ausnahme trifft noch eine Datei mit Literal', () => {
    const verwaist = ALLOW.filter(a => !withLiteral.some(f => a.match.test(f))).map(a => a.reason);
    expect(verwaist).toEqual([]);
  });

  it('der Wächter findet, was er finden soll', () => {
    const probe = (line: string) => PATTERNS.some(re => re.test(line));
    expect(probe("const url = 'https://lasstreffen.at/x';")).toBe(true);
    expect(probe("d.toLocaleDateString('de-AT')")).toBe(true);
    expect(probe("locale: 'de_AT'")).toBe(true);
    expect(probe("addressCountry: 'AT',")).toBe(true);
    expect(probe('const url = `${getSite().url}/x`;')).toBe(false);
    expect(probe('d.toLocaleDateString(DE_LOCALE)')).toBe(false);
  });
});

describe('Canonical-Wächter: keine URL zeigt auf die andere Seite', () => {
  const site = getSite();
  const fremd = Object.values(SITES).filter(s => s.country !== site.country).map(s => s.domain);

  it('Canonical, hreflang, Sitemap-Basis und robots nennen nur die eigene Domain', () => {
    const urls = [
      deOnlyAlternates('/wien').canonical,
      ...Object.values(bilingualAlternates('/events/x', 'de').languages),
      bilingualAlternates('/events/x', 'en').canonical,
      SITEMAP_BASE_URL,
      String(robots().sitemap),
    ];
    for (const url of urls) {
      expect(url.startsWith(site.url)).toBe(true);
      for (const d of fremd) expect(url).not.toContain(d);
    }
  });

  it('hreflang der deutschen Fassung ist der der Seite', () => {
    const languages = bilingualAlternates('/events/x', 'de').languages as Record<string, string>;
    expect(Object.keys(languages).sort()).toEqual([site.hreflang, 'en', 'x-default'].sort());
  });
});
