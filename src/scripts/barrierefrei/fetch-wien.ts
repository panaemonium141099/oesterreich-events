/**
 * Quelle: WienTourismus (wien.info) — Sehenswuerdigkeiten und Museen mit
 * strukturiertem Block "Barrierefreiheit" (Haupteingang, Parkplaetze, Lift,
 * WC, Assistenzhunde, spezielle Angebote, Anmerkungen). Der Barrierefrei-
 * Bereich von wien.info (von austria.info verlinkt) verweist genau auf
 * diese Angaben "direkt bei der Adresse der jeweiligen Institution".
 *
 *   npx tsx src/scripts/barrierefrei/fetch-wien.ts
 *   -> data/barrierefrei/wien-info.json
 *
 * Weg: Sehenswuerdigkeiten A-Z + Museen-Uebersicht -> Artikelseiten ->
 * eingebettete Orts-Blobs (data-location: id, Titel, Koordinaten, Adresse,
 * Kategorie) -> /content/<id>/asJson (Orts-Fragment mit dem Barrierefrei-
 * Block). Aufgenommen wird ein Ort nur mit positivem Befund (stufenloser
 * oder per Rampe/Lift erreichbarer Eingang, Lift, barrierefreies WC oder
 * spezielle Angebote); Hotels, Lokale und Shops bleiben aussen vor.
 */

import * as cheerio from 'cheerio';
import type { DatasetEntry } from '@/lib/activities/barrierefrei-dataset';
import type { AccessibilityFeature } from '@/lib/activities/accessibility';
import { clean, dedupeEntries, fetchJson, fetchText, sleep, slugId, stripCopyrightPrefix, today, writeDataset } from './lib';

const BASE = 'https://www.wien.info';
const SOURCE = 'wien-info';
const LIST_PAGES = [
  `${BASE}/de/sehen-erleben/sehenswuerdigkeiten-a-z`,
  `${BASE}/de/kunst-kultur/museen-ausstellungen`,
  `${BASE}/de/kunst-kultur/museen-ausstellungen/top-museen`,
  `${BASE}/de/reiseinfos/wien-barrierefrei/museen-barrierefrei-352682`,
];

interface LocationBlob {
  id: string;
  title: string;
  lat: string;
  long: string;
  address?: string;
  category?: string;
  class?: string;
  website?: string;
  myviennalink?: string;
}

const EXCLUDED_CATEGORY_RE = /hotel|restaurant|caf[eé]|lokal|bar\b|shop|geschäft|heurige|club|unterkunft|pension|apartment/i;
// Verkehrsinfrastruktur (Bahnhoefe, Flughafen) ist keine Freizeitaktivitaet.
const EXCLUDED_NAME_RE = /\bbahnhof\b|\bflughafen\b|hauptbahnhof|westbahnhof/i;

function extractBlobs(html: string): LocationBlob[] {
  const out: LocationBlob[] = [];
  const re = /data-location='(\{[\s\S]*?\})'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')) as { location?: LocationBlob } & LocationBlob;
      const loc = parsed.location ?? parsed;
      if (loc && loc.id && loc.title && loc.lat && loc.long) out.push(loc);
    } catch {
      /* kaputter Blob */
    }
  }
  return out;
}

function articleLinks(html: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    if (/^\/de\/[a-z0-9-]+(?:\/[a-z0-9-]+)*-\d{5,7}$/.test(href) && !/datenschutz|impressum|nutzungsbedingungen|barrierefreiheit-340382/.test(href)) {
      links.add(`${BASE}${href}`);
    }
  });
  return [...links];
}

interface AccessBlock {
  entries: Array<{ label: string; value: string }>;
}

/** Block "Barrierefreiheit" — im asJson-Fragment: h3 + ul.location_sublist
 *  mit li (strong = Label, ul.location_subsublist = Werte); auf der
 *  Seite selbst: h2 + ul mit div (strong + p). Beide Formen werden gelesen. */
function parseAccessBlock(fragmentHtml: string): AccessBlock | null {
  const $ = cheerio.load(fragmentHtml);
  let block: AccessBlock | null = null;
  $('h2, h3').each((_, h) => {
    if (block || clean($(h).text()) !== 'Barrierefreiheit') return;
    const list = $(h).next('ul');
    const entries: Array<{ label: string; value: string }> = [];
    list.children('li, div').each((__, item) => {
      const label = clean($(item).children('strong').first().text()) ?? '';
      const valueNodes = $(item).find('ul li, p');
      const value =
        clean(valueNodes.length > 0 ? valueNodes.map((___, v) => $(v).text()).get().join(' ') : $(item).clone().children('strong').remove().end().text()) ?? '';
      if (label) entries.push({ label, value });
    });
    if (entries.length > 0) block = { entries };
  });
  return block;
}

function featuresOf(block: AccessBlock): AccessibilityFeature[] {
  const text = block.entries.map((e) => `${e.label}: ${e.value}`).join('\n');
  const entrance = block.entries.find((e) => /haupteingang|eingang/i.test(e.label))?.value ?? '';
  const f = new Set<AccessibilityFeature>();
  if (/stufenlos|ebenerdig|rampe|lift|aufzug|barrierefrei/i.test(entrance) && !/nicht barrierefrei|keine rampe/i.test(entrance)) f.add('rollstuhl');
  if (/behinderten-?parkpl/i.test(text) && !/keine behinderten/i.test(text)) f.add('parkplatz');
  if (/lift vorhanden|aufzug/i.test(text)) f.add('lift');
  if (/barrierefreies wc|behinderten-?wc/i.test(text)) f.add('wc');
  if (/assistenzhunde erlaubt|blindenhund/i.test(text)) f.add('assistenzhund');
  if (/rollstuhl zum ausleihen|leihrollstuhl|rollstühle? (zum )?(ver)?leih/i.test(text)) f.add('leihrollstuhl');
  if (/gebärdensprache|ögs|induktions|hörbehinder|gehörlos/i.test(text)) f.add('gehoerlos');
  if (/blinde|sehbehinder|sehbeeinträchtig|tast|braille|bodenleitsystem|audiodeskription/i.test(text)) f.add('blind');
  if (/einfacher sprache|leichter sprache|leichte sprache/i.test(text)) f.add('leichte-sprache');
  if (f.has('lift') || f.has('wc')) f.add('rollstuhl');
  const order: AccessibilityFeature[] = ['rollstuhl', 'parkplatz', 'wc', 'lift', 'leihrollstuhl', 'badelift', 'blind', 'gehoerlos', 'leichte-sprache', 'assistenzhund'];
  return order.filter((x) => f.has(x));
}

function tagsOf(category: string | undefined, cls: string | undefined, title: string): { tags: string[]; setting: 'indoor' | 'outdoor' | 'mixed' | null } {
  const c = `${category ?? ''} ${cls ?? ''} ${title}`.toLowerCase();
  if (/museum/.test(c)) return { tags: ['museumstour', 'ausstellung'], setting: 'indoor' };
  if (/park|garten|friedhof/.test(c)) return { tags: ['wandern', 'naturführung'], setting: 'outdoor' };
  if (/konzert|theater|oper|bühne|music_stage|musical/.test(c)) return { tags: ['theater'], setting: 'indoor' };
  if (/schloss|palais|burg|kirche|dom\b|stift/.test(c)) return { tags: ['burgführung'], setting: 'mixed' };
  if (/bad|therme|schwimm/.test(c)) return { tags: ['schwimmen'], setting: 'mixed' };
  if (/zoo|tiergarten/.test(c)) return { tags: ['naturführung'], setting: 'outdoor' };
  return { tags: [], setting: null };
}

async function main(): Promise<void> {
  const articles = new Set<string>();
  for (const url of LIST_PAGES) {
    try {
      for (const a of articleLinks(await fetchText(url))) articles.add(a);
    } catch (err) {
      console.log(`[wien] Liste ${url}: ${err instanceof Error ? err.message : err}`);
    }
    await sleep(300);
  }
  console.log(`[wien] ${articles.size} Artikelseiten`);

  const blobs = new Map<string, LocationBlob & { articleUrl: string }>();
  let n = 0;
  for (const url of articles) {
    n++;
    try {
      for (const b of extractBlobs(await fetchText(url))) {
        if (!blobs.has(b.id)) blobs.set(b.id, { ...b, articleUrl: url });
      }
    } catch (err) {
      console.log(`[wien] ${url}: ${err instanceof Error ? err.message : err}`);
    }
    if (n % 25 === 0) console.log(`[wien] ${n}/${articles.size} Artikel, ${blobs.size} Orte`);
    await sleep(250);
  }
  console.log(`[wien] ${blobs.size} Orte gesamt`);

  const entries: DatasetEntry[] = [];
  let checked = 0;
  for (const loc of blobs.values()) {
    checked++;
    if (EXCLUDED_CATEGORY_RE.test(loc.category ?? '') || EXCLUDED_CATEGORY_RE.test(loc.class ?? '')) continue;
    if (EXCLUDED_NAME_RE.test(loc.title ?? '')) continue;
    let fragment: { html?: string };
    try {
      fragment = await fetchJson<{ html?: string }>(`${BASE}/content/${loc.id}/asJson`);
    } catch (err) {
      console.log(`[wien] ${loc.title}: asJson ${err instanceof Error ? err.message : err}`);
      continue;
    }
    await sleep(200);
    const html = fragment.html ?? '';
    const block = parseAccessBlock(html);
    if (!block || block.entries.length === 0) continue;
    const features = featuresOf(block);
    // "Assistenzhunde erlaubt" oder nur ein Behindertenparkplatz allein
    // macht keinen barrierefreien Ort — es braucht Zugang, Lift, WC oder
    // ein Angebot fuer seh-/hoerbehinderte Menschen.
    const substantive = features.some((f) => !['assistenzhund', 'parkplatz'].includes(f));
    if (!substantive) continue;

    const $ = cheerio.load(html);
    const img = $('img.article_image').first();
    // srcset traegt die 700px-Variante (2x); src ist nur 350px.
    const srcset = img.attr('srcset') ?? '';
    const big = srcset.split(',').map((s) => s.trim().split(' ')[0]).filter(Boolean).pop();
    const imgSrc = big ?? img.attr('src');
    const imgCredit = stripCopyrightPrefix(clean(img.attr('title')));
    const facts = block.entries.map((e) => (e.value ? `${e.label}: ${e.value}` : e.label)).join('. ');
    const address = clean(loc.address) ?? '';
    const addrMatch = /^(.*?),\s*(\d{4})\s+Wien$/i.exec(address);
    const { tags, setting } = tagsOf(loc.category, loc.class, loc.title);
    const pageUrl = loc.myviennalink ? `${BASE}${loc.myviennalink}` : loc.articleUrl;

    entries.push({
      id: slugId(`${loc.title}-${loc.id}`),
      name: clean(loc.title) ?? loc.title,
      description: `${clean(loc.title)} in Wien${loc.category ? ` (${loc.category})` : ''}. Barrierefreiheit laut WienTourismus: ${facts}.`,
      tags,
      setting,
      address: addrMatch ? clean(addrMatch[1]) : address || null,
      postal_code: addrMatch ? addrMatch[2] : null,
      town: 'Wien',
      lat: parseFloat(loc.lat),
      lng: parseFloat(loc.long),
      website: clean(loc.website),
      source_url: pageUrl,
      accessibility: { features, note: `Laut wien.info: ${facts}.` },
      images: imgSrc ? [{ url: imgSrc.startsWith('http') ? imgSrc : `${BASE}${imgSrc}`, credit: imgCredit ?? 'WienTourismus' }] : [],
    });
    if (checked % 50 === 0) console.log(`[wien] ${checked}/${blobs.size} geprueft, ${entries.length} barrierefrei`);
  }

  writeDataset({
    source: SOURCE,
    source_label: 'WienTourismus (wien.info)',
    source_url: 'https://www.wien.info/de/reiseinfos/wien-barrierefrei',
    checked_at: today(),
    entries: dedupeEntries(entries),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
