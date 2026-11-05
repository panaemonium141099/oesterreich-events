/**
 * Baut `data/de-gemeinde-registry.json` aus der Vollerhebung (fn-29.4).
 *
 * Kette: Vollerhebung (docs/research/de-gemeinden/vollerhebung/*.py) →
 * CSV docs/research/de-gemeinden/data/vollerhebung-*.csv → dieser Builder.
 *
 * Mit `--feeds` lädt er je Kalenderseite der Stufe A (eigene und Amts/VG-
 * Seiten, bei Amt/VG ohne Kalenderseite deren Startseite) einmal die Seite, prüft vorher robots.txt und liest den Feed, den
 * die Seite selbst nennt (`feedUrlFromPage`). Ergebnisse landen in
 * `.registry-cache/feeds.json`; ohne `--feeds` nutzt der Builder diesen Stand.
 * Am Ende gibt er den Unterschied zur bisherigen Registry aus.
 *
 * `--only <integration>`: nur die Seiten dieser Integration neu fragen. Ohne
 * Cache gelten die Feeds der bisherigen Registry weiter, sonst fielen sie alle
 * weg (Workflow `registry-de-feeds.yml`, läuft von dort, wo auch der Nachtlauf
 * liest). `.registry-cache/feeds-log.json` nennt je Seite den Grund ohne Feed.
 *
 * Je Server (IP) nacheinander mit Pause (verwaltungsportal und GeoCMS sperren
 * bei parallelen Abrufen auf ihren gemeinsamen Server); nach fünf Seiten ohne
 * Verbindung in Folge fragt der Lauf diesen Server nicht weiter.
 *
 * Aufruf: npm run build:registry:de [-- --feeds] [--only ionas] [--csv <datei>]
 */
import { lookup } from 'node:dns/promises';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadGemeindenDe } from '../lib/gemeinden/de';
import { buildRegistry, diffRegistry, verbandHomeUrl, type ErhebungRow, type RegistryEntryDe } from '../lib/registry-de/build';
import { calendarLinks, calendarPageCandidates, feedFormat, feedUrlFromPage, looksLikeFeed } from '../lib/registry-de/feed-url';
import { FEED_FROM_PAGE } from '../lib/registry-de/integrations';
import { robotsAllows, robotsCrawlDelay } from '../lib/registry-de/robots';

const ROOT = process.cwd();
const UA = 'Mozilla/5.0 (compatible; lasstreffen-registry/1.0)';
const UA_TOKEN = 'lasstreffen-registry';
const OUT = join(ROOT, 'data', 'de-gemeinde-registry.json');
const CACHE = join(ROOT, '.registry-cache');
const FEEDS_FILE = join(CACHE, 'feeds-v3.json');
const FEEDS_LOG = join(CACHE, 'feeds-log.json');
/** Pause zwischen zwei Abrufen eines Servers, mindestens; Crawl-delay geht vor. */
const PAUSE_MS = 1000;
const SERVER_AUS_NACH = 5;

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
    // Amt/VG ohne Kalender-URL: Startseite, danach die belegten Standardseiten (fn-29.17).
    else if (FEED_FROM_PAGE.has(r.vb_integration) && r.vb_host?.trim()) pages.set(verbandHomeUrl(r.vb_host), r.vb_integration);
  }
  const only = arg('only');
  const todo = [...pages].filter(([u, integration]) => !(u in known) && (!only || integration === only));
  console.log(`Feed-Lauf: ${pages.size} Kalenderseiten, ${todo.length} offen`);
  const robots = new Map<string, Promise<string | null>>();
  const robotsOf = (url: string) => {
    const origin = new URL(url).origin;
    if (!robots.has(origin)) robots.set(origin, fetchText(`${origin}/robots.txt`, 15000).then(r => (r && r.status < 400 ? r.text : null)));
    return robots.get(origin)!;
  };
  const log: Record<string, string> = {};
  const pause = async (url: string) => {
    const delay = robotsCrawlDelay(await robotsOf(url), UA_TOKEN) ?? 0;
    await new Promise(r => setTimeout(r, Math.max(PAUSE_MS, delay * 1000)));
  };
  /** Feed aus einer Seite lesen und nur übernehmen, wenn sein Abruf das erwartete Format liefert; sonst der Grund. */
  const feedFrom = async (pageUrl: string, integration: string): Promise<{ feed: string | null; reason: string; links?: string[] }> => {
    if (!robotsAllows(await robotsOf(pageUrl), pageUrl, UA_TOKEN)) return { feed: null, reason: 'robots' };
    await pause(pageUrl);
    const page = await fetchText(pageUrl);
    if (!page) return { feed: null, reason: 'keine Verbindung' };
    if (page.status !== 200) return { feed: null, reason: `HTTP ${page.status}` };
    const candidate = feedUrlFromPage(integration, page.text, page.url);
    const format = feedFormat(integration);
    if (!candidate || !format) return { feed: null, reason: 'Seite nennt keinen Feed', links: calendarLinks(page.text, page.url) };
    if (!robotsAllows(await robotsOf(candidate), candidate, UA_TOKEN)) return { feed: null, reason: 'robots Feed' };
    await pause(candidate);
    const feed = await fetchText(candidate);
    if (!feed) return { feed: null, reason: 'keine Verbindung' };
    if (feed.status !== 200) return { feed: null, reason: `Feed HTTP ${feed.status}` };
    return looksLikeFeed(format, feed.text) ? { feed: candidate, reason: 'ok' } : { feed: null, reason: 'Feed-Format falsch' };
  };
  // Seiten je Server: eine Warteschlange, nie zwei Abrufe gleichzeitig.
  const servers = new Map<string, [string, string][]>();
  for (const item of todo) {
    const host = new URL(item[0]).hostname;
    const ip = await lookup(host).then(r => r.address, () => `dns:${host}`);
    servers.set(ip, [...(servers.get(ip) ?? []), item]);
  }
  const queue = [...servers].sort((a, b) => b[1].length - a[1].length);
  let done = 0;
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [server, items] = next;
      let ohneVerbindung = 0;
      for (const [url, integration] of items) {
        if (ohneVerbindung >= SERVER_AUS_NACH) {
          // Kein Ergebnis: bleibt offen, der nächste Lauf fragt wieder.
          log[url] = `Server ${server} antwortet nicht`;
          continue;
        }
        let feed: string | null = null;
        let reason = 'Seite nicht lesbar';
        try {
          const first = await feedFrom(url, integration);
          ({ feed, reason } = first);
          // Die Erhebung hat oft eine Termin- oder Detailseite verlinkt: belegte
          // Standardseiten des Herstellers, dann die Kalenderseiten, auf die sie verlinkt.
          if (!feed && reason !== 'keine Verbindung') {
            const tried = new Set([url]);
            for (const candidate of [...calendarPageCandidates(integration, new URL(url).origin), ...(first.links ?? [])]) {
              if (tried.has(candidate)) continue;
              tried.add(candidate);
              const r = await feedFrom(candidate, integration);
              if (r.feed) { feed = r.feed; reason = 'ok über verlinkte Seite'; break; }
            }
          }
        } catch { /* Seite nicht lesbar: kein Feed */ }
        ohneVerbindung = reason === 'keine Verbindung' ? ohneVerbindung + 1 : 0;
        log[url] = reason;
        if (reason !== 'keine Verbindung') known[url] = feed;
        if (++done % 100 === 0) {
          writeFileSync(FEEDS_FILE, JSON.stringify(known));
          process.stdout.write(`\r${done}/${todo.length}`);
        }
      }
    }
  };
  // --workers 1: alle Server nacheinander.
  await Promise.all(Array.from({ length: Number(arg('workers') ?? 24) }, worker));
  writeFileSync(FEEDS_FILE, JSON.stringify(known));
  writeFileSync(FEEDS_LOG, JSON.stringify(log, null, 1));
  const gruende = new Map<string, number>();
  for (const r of Object.values(log)) {
    const k = r.replace(/^Server .* antwortet nicht$/, 'Server antwortet nicht');
    gruende.set(k, (gruende.get(k) ?? 0) + 1);
  }
  console.log(`\nGründe: ${[...gruende].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  return known;
}

/** Feeds der bisherigen Registry, je Kalenderseite wie in `buildRegistry`. */
function feedsOfRegistry(entries: RegistryEntryDe[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries) {
    if (e.url && e.feed_url) out[e.url] = e.feed_url;
    const f = e.fallback;
    if (f?.kind === 'verband' && f.feed_url) out[f.url ?? verbandHomeUrl(f.host)] = f.feed_url;
  }
  return out;
}

async function main(): Promise<void> {
  const csvFile = arg('csv') ?? join(ROOT, 'docs', 'research', 'de-gemeinden', 'data', 'vollerhebung-2026-10.csv');
  const rows = parseCsv(readFileSync(csvFile, 'utf8')) as unknown as ErhebungRow[];
  mkdirSync(CACHE, { recursive: true });
  const before: RegistryEntryDe[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
  let known: Record<string, string | null> = existsSync(FEEDS_FILE) ? JSON.parse(readFileSync(FEEDS_FILE, 'utf8')) : arg('only') ? feedsOfRegistry(before) : {};
  if (process.argv.includes('--feeds')) known = await collectFeeds(rows, known);
  const feeds = new Map(Object.entries(known).filter((e): e is [string, string] => !!e[1]));

  const landByAgs = new Map(loadGemeindenDe().map(g => [g.ags, g.land]));
  const { entries, problems } = buildRegistry({ rows, landByAgs, feeds, checkedAt: arg('checked-at') ?? new Date().toISOString().slice(0, 10) });
  if (problems.length) {
    console.error(`${problems.length} Probleme:\n  ${problems.slice(0, 30).join('\n  ')}`);
    process.exit(1);
  }
  const diff = diffRegistry(before, entries);
  // Unveränderte Einträge behalten ihr Prüfdatum, der Diff bleibt lesbar.
  const changedAgs = new Set(diff.changed.map(c => c.ags));
  const beforeByAgs = new Map(before.map(e => [e.ags, e]));
  for (const e of entries) {
    const old = beforeByAgs.get(e.ags);
    if (arg('only') && old && !changedAgs.has(e.ags)) e.checked_at = old.checked_at;
  }
  writeFileSync(OUT, JSON.stringify(entries, null, 0).replace(/\},\{/g, '},\n{') + '\n');
  const count = (k: keyof RegistryEntryDe) => entries.filter(e => e[k] !== undefined && e[k] !== null).length;
  console.log(`${entries.length} Einträge, Feed ${count('feed_url')}, Ausweichweg ${count('fallback')}`);
  console.log(`Diff: neu ${diff.added.length}, entfernt ${diff.removed.length}, geändert ${diff.changed.length}`);
  for (const c of diff.changed.slice(0, 20)) console.log(`  ${c.ags}: ${c.fields.join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
