/**
 * SEO-Vergleich vor und nach einem Umbau (fn-31): belegt, dass sich für eine
 * Seite Canonical, hreflang, JSON-LD, robots.txt und Sitemaps nicht ändern.
 *
 *   npx tsx src/scripts/seo-vergleich.ts --base https://lasstreffen.at --save vorher.json
 *   npx tsx src/scripts/seo-vergleich.ts --base https://lasstreffen.at --compare vorher.json
 *   npx tsx src/scripts/seo-vergleich.ts --base http://localhost:3000 --as https://lasstreffen.at --compare vorher.json
 *
 * `--as` ersetzt die abgefragte Basis in den Ergebnissen (lokaler Build gegen
 * den Schnappschuss von Prod). `--urls datei` nimmt eine eigene Pfadliste
 * (eine Zeile je Pfad), sonst gilt die feste Liste unten plus je Sitemap die
 * ersten Einträge. Nur lesend, ein Abruf zur Zeit.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/** Feste Pfade: Startseite, Hubs, Listen, Rechtsseiten, Maschinenlesbares. */
const PATHS = [
  '/', '/en', '/entdecken', '/map', '/wien', '/wien/musik', '/wien/heute', '/burgenland',
  '/steiermark', '/tirol', '/salzburg', '/kaernten', '/niederoesterreich', '/oberoesterreich',
  '/vorarlberg', '/studenten', '/blog', '/festivals', '/aktivitaeten', '/artists',
  '/fuer-firmen', '/quellen', '/impressum', '/datenschutz', '/agb', '/ueber-uns',
  '/robots.txt', '/sitemap.xml', '/sitemap-core.xml', '/sitemap-events.xml', '/sitemap-activities.xml',
];
/** Je Sitemap so viele Seiten zusätzlich prüfen (Event-, Gemeinde-, Aktivitätsseiten). */
const PER_SITEMAP = 5;

export interface PageFacts {
  status: number;
  canonical: string | null;
  robots: string | null;
  ogUrl: string | null;
  ogLocale: string | null;
  hreflang: string[];
  jsonLd: string[];
  /** Nur für robots.txt und Sitemaps: der Inhalt selbst. */
  body?: string;
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

/** Zeitangaben, die sich von Abruf zu Abruf ändern dürfen. */
function stable(text: string): string {
  return text
    .replace(/<lastmod>[^<]*<\/lastmod>/g, '<lastmod/>')
    .replace(/"(dateModified|datePublished|uploadDate)"\s*:\s*"[^"]*"/g, '"$1":""');
}

export function extractFacts(status: number, html: string, raw: boolean): PageFacts {
  if (raw) {
    return { status, canonical: null, robots: null, ogUrl: null, ogLocale: null, hreflang: [], jsonLd: [], body: stable(html) };
  }
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const meta = (key: string) => {
    const tag = metas.find(t => attr(t, 'name') === key || attr(t, 'property') === key);
    return tag ? attr(tag, 'content') : null;
  };
  const canonicalTag = links.find(t => attr(t, 'rel') === 'canonical');
  const jsonLd = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => stable(m[1].trim()))
    .sort();
  return {
    status,
    canonical: canonicalTag ? attr(canonicalTag, 'href') : null,
    robots: meta('robots'),
    ogUrl: meta('og:url'),
    ogLocale: meta('og:locale'),
    hreflang: links
      .filter(t => attr(t, 'rel') === 'alternate' && attr(t, 'hreflang'))
      .map(t => `${attr(t, 'hreflang')} ${attr(t, 'href')}`)
      .sort(),
    jsonLd,
  };
}

/** Unterschiede zweier Schnappschüsse als lesbare Zeilen, leer heißt gleich. */
export function diffSnapshots(before: Record<string, PageFacts>, after: Record<string, PageFacts>): string[] {
  const out: string[] = [];
  for (const path of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    const a = before[path];
    const b = after[path];
    if (!a || !b) {
      out.push(`${path}: nur ${a ? 'vorher' : 'nachher'} vorhanden`);
      continue;
    }
    for (const key of Object.keys({ ...a, ...b }) as (keyof PageFacts)[]) {
      const x = JSON.stringify(a[key] ?? null);
      const y = JSON.stringify(b[key] ?? null);
      if (x !== y) out.push(`${path}: ${key}\n    vorher:  ${x.slice(0, 300)}\n    nachher: ${y.slice(0, 300)}`);
    }
  }
  return out;
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function main() {
  const base = (arg('base') ?? '').replace(/\/+$/, '');
  if (!base) throw new Error('--base fehlt');
  const as = (arg('as') ?? base).replace(/\/+$/, '');
  const save = arg('save');
  const compare = arg('compare');
  const urlFile = arg('urls');

  const paths = urlFile
    ? readFileSync(urlFile, 'utf8').split('\n').map(l => l.trim()).filter(Boolean)
    : [...PATHS];
  const facts: Record<string, PageFacts> = {};

  const fetchOne = async (path: string) => {
    const res = await fetch(`${base}${path}`, { redirect: 'manual', headers: { 'user-agent': 'lasstreffen-seo-vergleich' } });
    const text = (await res.text()).split(base).join(as);
    facts[path] = extractFacts(res.status, text, /\.(xml|txt)$/.test(path));
    return text;
  };

  for (const path of paths) {
    const text = await fetchOne(path);
    // Bei --compare gelten die Seiten des Schnappschusses, nicht neue aus der Sitemap.
    if (!urlFile && !compare && /sitemap-.*\.xml$/.test(path)) {
      const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(as, ''));
      for (const loc of locs.slice(0, PER_SITEMAP)) if (!(loc in facts)) await fetchOne(loc);
    }
  }

  if (save) {
    writeFileSync(save, JSON.stringify(facts, null, 2));
    console.log(`${Object.keys(facts).length} Seiten gespeichert in ${save}`);
    const bad = Object.entries(facts).filter(([, f]) => f.status >= 400).map(([p, f]) => `${p} ${f.status}`);
    if (bad.length) console.log(`Achtung, Fehlerstatus: ${bad.join(', ')}`);
  }
  if (compare) {
    const before = JSON.parse(readFileSync(compare, 'utf8')) as Record<string, PageFacts>;
    for (const path of Object.keys(before)) if (!(path in facts)) await fetchOne(path);
    const diff = diffSnapshots(before, facts);
    if (diff.length === 0) {
      console.log(`Keine Abweichung auf ${Object.keys(before).length} Seiten.`);
    } else {
      console.log(diff.join('\n'));
      console.log(`\n${diff.length} Abweichungen.`);
      process.exitCode = 1;
    }
  }
}

if ((process.argv[1] ?? '').split('\\').join('/').endsWith('src/scripts/seo-vergleich.ts')) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
