/**
 * Quelle: Steiermark Tourismus (steiermark.com) — "Zertifizierte
 * Ausflugsziele" des Barrierefrei-Bereichs (von austria.info verlinkt).
 *
 *   npx tsx src/scripts/barrierefrei/fetch-steiermark.ts
 *   -> data/barrierefrei/steiermark-com.json
 *
 * Liste: ?ajax=1&page=N (8 je Seite, 29 Eintraege am 2026-09-17), je
 * Eintrag die zertifizierten Zielgruppen als Icons (nur die mit
 * "--checked"); Detailseite: Kontaktadresse + Koordinaten (JSON im
 * Quelltext). Eintraege, die nur fuer Allergiker zertifiziert sind, und
 * Gastronomiebetriebe werden ausgelassen — es geht um Barrierefreiheit
 * von Freizeitzielen.
 */

import * as cheerio from 'cheerio';
import type { DatasetEntry } from '@/lib/activities/barrierefrei-dataset';
import type { AccessibilityFeature } from '@/lib/activities/accessibility';
import { clean, dedupeEntries, fetchText, sleep, slugId, stripCopyrightPrefix, today, writeDataset } from './lib';

const BASE = 'https://www.steiermark.com';
const LIST = `${BASE}/de/Urlaub-planen/Barrierefreier-Urlaub/barrierefreie-Ausflugsziele`;
const SOURCE = 'steiermark-com';
const GASTRO_RE = /buschenschank|restaurant|\bbar\b|weingut|heurige|gasthaus|gasthof|café|cafe\b|wirt\b|winzer/i;

const GROUP_LABEL: Record<string, string> = {
  erolli: 'Personen im Rollstuhl',
  'rolli-mit-hilfe': 'Rollstuhlfahrerinnen und Rollstuhlfahrer mit Unterstützung',
  gehbehindert: 'ältere, gehbehinderte und herzkranke Personen',
  blind: 'blinde Personen',
  sehbehindert: 'sehbehinderte Personen',
  gehoerlos: 'hörbehinderte und gehörlose Personen',
  lernschwierigkeiten: 'Menschen mit Lernschwierigkeiten',
  'familien-mit-kleinkind': 'Familien mit Kleinkindern',
};

function featuresOf(groups: string[]): AccessibilityFeature[] {
  const f = new Set<AccessibilityFeature>();
  if (groups.includes('erolli') || groups.includes('rolli-mit-hilfe')) f.add('rollstuhl');
  if (groups.includes('blind') || groups.includes('sehbehindert')) f.add('blind');
  if (groups.includes('gehoerlos')) f.add('gehoerlos');
  if (groups.includes('lernschwierigkeiten')) f.add('leichte-sprache');
  const order: AccessibilityFeature[] = ['rollstuhl', 'parkplatz', 'wc', 'lift', 'leihrollstuhl', 'badelift', 'blind', 'gehoerlos', 'leichte-sprache', 'assistenzhund'];
  return order.filter((x) => f.has(x));
}

function tagsOf(name: string): { tags: string[]; setting: 'indoor' | 'outdoor' | 'mixed' | null } {
  const n = name.toLowerCase();
  if (/museum|galerie|ausstellung|kunsthaus|salon|schokolade|manufaktur|erlebniswelt/.test(n)) return { tags: ['museumstour', 'ausstellung'], setting: 'indoor' };
  if (/therme|bad\b|wellnessbad/.test(n)) return { tags: ['schwimmen', 'thermen-special'], setting: 'indoor' };
  if (/seilbahn|bergbahn|gondel/.test(n)) return { tags: ['bergtour'], setting: 'outdoor' };
  if (/schloss|burg|stift/.test(n)) return { tags: ['burgführung'], setting: 'mixed' };
  if (/halle|theater|oper|bühne/.test(n)) return { tags: ['theater'], setting: 'indoor' };
  if (/park|garten|weg|naturpark/.test(n)) return { tags: ['wandern'], setting: 'outdoor' };
  return { tags: [], setting: null };
}

async function main(): Promise<void> {
  const items: Array<{ name: string; url: string; image: string | null; credit: string | null; groups: string[] }> = [];
  for (let page = 1; page <= 20; page++) {
    const html = await fetchText(`${LIST}?ajax=1&page=${page}`);
    const $ = cheerio.load(html);
    let found = 0;
    $('.flatrate-teaser').each((_, t) => {
      const a = $(t).find('h3.flatrate-teaser__title a').first();
      const name = clean(a.text());
      const href = a.attr('href');
      if (!name || !href) return;
      found++;
      const groups: string[] = [];
      $(t).find('.flatrate-teaser__accessibility-item--checked img').each((__, img) => {
        const alt = $(img).attr('alt');
        if (alt) groups.push(alt);
      });
      const img = $(t).find('img.flatrate-teaser__img').first();
      const alt = clean(img.attr('alt')) ?? '';
      const credit = alt.includes('©') ? stripCopyrightPrefix(alt.slice(alt.indexOf('©'))) : null;
      items.push({
        name,
        url: href.startsWith('http') ? href : `${BASE}${href}`,
        image: img.attr('src') ? `${BASE}${img.attr('src')}` : null,
        credit,
        groups,
      });
    });
    console.log(`[steiermark] Seite ${page}: ${found}`);
    if (found < 8) break;
    await sleep(300);
  }

  const entries: DatasetEntry[] = [];
  for (const item of items) {
    const features = featuresOf(item.groups);
    const relevantGroups = item.groups.filter((g) => g in GROUP_LABEL);
    if (features.length === 0 && !relevantGroups.includes('gehbehindert')) continue;
    if (GASTRO_RE.test(item.name)) continue;

    let street: string | null = null;
    let plz: string | null = null;
    let town: string | null = null;
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const html = await fetchText(item.url);
      const $ = cheerio.load(html);
      const addr = $('.infra-event-contact address').first().html() ?? '';
      const lines = addr.split(/<br\s*\/?>/i).map((l) => clean(cheerio.load(`<x>${l}</x>`)('x').text())).filter((l): l is string => Boolean(l));
      const plzLine = lines.find((l) => /^\d{4}\s+\S/.test(l));
      if (plzLine) {
        const m = /^(\d{4})\s+(.+)$/.exec(plzLine);
        if (m) {
          plz = m[1];
          town = m[2].replace(/^(\S+)(?:\s+\1)+$/, '$1'); // "Graz Graz" -> "Graz"
          const idx = lines.indexOf(plzLine);
          if (idx > 0) street = lines[idx - 1];
        }
      }
      const la = /"latitude"\s*:\s*([0-9.]+)/.exec(html);
      const lo = /"longitude"\s*:\s*([0-9.]+)/.exec(html);
      if (la && lo) {
        lat = parseFloat(la[1]);
        lng = parseFloat(lo[1]);
      }
    } catch (err) {
      console.log(`[steiermark] ${item.name}: ${err instanceof Error ? err.message : err}`);
    }
    await sleep(300);
    // Redaktionelle Seiten ohne Kontaktblock (z. B. Kunsthaus Graz): Ort aus
    // dem Regions-Pfad, damit das Geocoding einen Anker hat.
    if (!town && /\/Region-Graz\//.test(item.url)) town = 'Graz';

    const groupText = relevantGroups.map((g) => GROUP_LABEL[g]).join(', ');
    const { tags, setting } = tagsOf(item.name);
    entries.push({
      id: slugId(item.url.split('_isd_').pop() ? `${item.name}-${item.url.split('_isd_').pop()}` : item.name),
      name: item.name,
      description: `${item.name}${town ? ` in ${town}` : ''}: von Steiermark Tourismus als barrierefreies Ausflugsziel zertifiziert. Geeignet laut Zertifizierung für: ${groupText}.`,
      tags,
      setting,
      address: street,
      postal_code: plz,
      town,
      lat,
      lng,
      website: item.url,
      source_url: item.url,
      accessibility: {
        features,
        note: `Laut steiermark.com zertifiziert für: ${groupText}. Grundlage sind Mindestkriterien pro Zielgruppe (z. B. markierter Behindertenparkplatz, Behinderten-WC mit Haltegriffen).`,
      },
      images: item.image ? [{ url: item.image, credit: item.credit ?? 'Steiermark Tourismus' }] : [],
    });
  }

  writeDataset({
    source: SOURCE,
    source_label: 'Steiermark Tourismus (steiermark.com)',
    source_url: LIST,
    checked_at: today(),
    entries: dedupeEntries(entries),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
