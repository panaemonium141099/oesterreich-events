/**
 * Baut `data/de-gemeinde-registry.json` aus der Vollerhebung (fn-29.4).
 *
 * Kette: Vollerhebung (docs/research/de-gemeinden/vollerhebung/*.py) →
 * CSV docs/research/de-gemeinden/data/vollerhebung-*.csv → dieser Builder.
 *
 * Mit `--feeds` lädt er je Kalenderseite der Stufe A (eigene und Amts/VG-
 * Seiten) einmal die Seite, prüft vorher robots.txt und liest den Feed, den
 * die Seite selbst nennt (`feedUrlFromPage`). Ergebnisse landen in
 * `.registry-cache/feeds.json`; ohne `--feeds` nutzt der Builder diesen Stand.
 * Am Ende gibt er den Unterschied zur bisherigen Registry aus.
 *
 * Aufruf: npm run build:registry:de [-- --feeds] [--csv <datei>]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadGemeindenDe } from '../lib/gemeinden/de';
import { buildRegistry, diffRegistry, type ErhebungRow, type RegistryEntryDe } from '../lib/registry-de/build';
import { calendarPageCandidates, feedFormat, feedUrlFromPage, looksLikeFeed } from '../lib/registry-de/feed-url';
import { FEED_FROM_PAGE } from '../lib/registry-de/integrations';
import { robotsAllows } from '../lib/registry-de/robots';

const ROOT = process.cwd();
const UA = 'Mozilla/5.0 (compatible; lasstreffen-registry/1.0)';
const UA_TOKEN = 'lasstreffen-registry';
const OUT = join(ROOT, 'data', 'de-gemeinde-registry.json');
const CACHE = join(ROOT, '.registry-cache');
const FEEDS_FILE = join(CACHE, 'feeds-v3.json');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** RFC-4180-CSV (Anführungszeichen, Kommas in Feldern). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

async function fetchText(url: string, timeoutMs = 20000): Promise<{ status: number; url: string; text: string } | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'de' }, signal: ctl.signal, redirect: 'follow' });
    const ct = res.headers.get('content-type') ?? '';
    // Seiten (HTML) und Feeds (XML, JSON, iCal) lesen; Bilder, PDF u. ä. nicht.
    const text = /html|xml|text|json|calendar/.test(ct) || !ct ? (await res.text()).slice(0, 3_000_000) : '';
    return { status: res.status, url: res.url, text };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function collectFeeds(rows: ErhebungRow[], known: Record<string, string | null>): Promise<Record<string, string | null>> {
  const pages = new Map<string, string>();
  for (const r of rows) {
    if (FEED_FROM_PAGE.has(r.integration) && r.event_url) pages.set(r.event_url, r.integration);
    if (FEED_FROM_PAGE.has(r.vb_integration) && r.vb_event_url) pages.set(r.vb_event_url, r.vb_integration);
  }
  const todo = [...pages].filter(([u]) => !(u in known));
  console.log(`Feed-Lauf: ${pages.size} Kalenderseiten, ${todo.length} offen`);
  const robots = new Map<string, Promise<string | null>>();
  const robotsOf = (url: string) => {
    const origin = new URL(url).origin;
    if (!robots.has(origin)) robots.set(origin, fetchText(`${origin}/robots.txt`, 15000).then(r => (r && r.status < 400 ? r.text : null)));
    return robots.get(origin)!;
  };
  const allowed = async (u: string) => robotsAllows(await robotsOf(u), u, UA_TOKEN);
  /** Feed aus einer Seite lesen und nur übernehmen, wenn sein Abruf das erwartete Format liefert. */
  const feedFrom = async (pageUrl: string, integration: string): Promise<string | null> => {
    if (!(await allowed(pageUrl))) return null;
    const page = await fetchText(pageUrl);
    if (!page || page.status !== 200) return null;
    const candidate = feedUrlFromPage(integration, page.text, page.url);
    const format = feedFormat(integration);
    if (!candidate || !format || !(await allowed(candidate))) return null;
    const feed = await fetchText(candidate);
    return feed && feed.status === 200 && looksLikeFeed(format, feed.text) ? candidate : null;
  };
  let done = 0;
  const worker = async () => {
    while (todo.length) {
      const [url, integration] = todo.shift()!;
      let feed: string | null = null;
      try {
        feed = await feedFrom(url, integration);
        // Die Erhebung hat oft eine Termin- oder Detailseite verlinkt: belegte
        // Standardseiten des Herstellers als zweiter Versuch.
        if (!feed) {
          for (const candidate of calendarPageCandidates(integration, new URL(url).origin)) {
            if (candidate === url) continue;
            feed = await feedFrom(candidate, integration);
            if (feed) break;
          }
        }
      } catch { /* Seite nicht lesbar: kein Feed */ }
      known[url] = feed;
      if (++done % 100 === 0) {
        writeFileSync(FEEDS_FILE, JSON.stringify(known));
        process.stdout.write(`\r${done}/${pages.size}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 24 }, worker));
  writeFileSync(FEEDS_FILE, JSON.stringify(known));
  console.log('');
  return known;
}

async function main(): Promise<void> {
  const csvFile = arg('csv') ?? join(ROOT, 'docs', 'research', 'de-gemeinden', 'data', 'vollerhebung-2026-10.csv');
  const rows = parseCsv(readFileSync(csvFile, 'utf8')) as unknown as ErhebungRow[];
  mkdirSync(CACHE, { recursive: true });
  let known: Record<string, string | null> = existsSync(FEEDS_FILE) ? JSON.parse(readFileSync(FEEDS_FILE, 'utf8')) : {};
  if (process.argv.includes('--feeds')) known = await collectFeeds(rows, known);
  const feeds = new Map(Object.entries(known).filter((e): e is [string, string] => !!e[1]));

  const landByAgs = new Map(loadGemeindenDe().map(g => [g.ags, g.land]));
  const { entries, problems } = buildRegistry({ rows, landByAgs, feeds, checkedAt: arg('checked-at') ?? new Date().toISOString().slice(0, 10) });
  if (problems.length) {
    console.error(`${problems.length} Probleme:\n  ${problems.slice(0, 30).join('\n  ')}`);
    process.exit(1);
  }
  const before: RegistryEntryDe[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
  const diff = diffRegistry(before, entries);
  writeFileSync(OUT, JSON.stringify(entries, null, 0).replace(/\},\{/g, '},\n{') + '\n');
  const count = (k: keyof RegistryEntryDe) => entries.filter(e => e[k] !== undefined && e[k] !== null).length;
  console.log(`${entries.length} Einträge, Feed ${count('feed_url')}, Ausweichweg ${count('fallback')}`);
  console.log(`Diff: neu ${diff.added.length}, entfernt ${diff.removed.length}, geändert ${diff.changed.length}`);
  for (const c of diff.changed.slice(0, 20)) console.log(`  ${c.ags}: ${c.fields.join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
