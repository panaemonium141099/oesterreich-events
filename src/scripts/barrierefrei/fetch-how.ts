/**
 * Quelle: Holidays on Wheels (holidaysonwheels.at) — Aktiv-Angebote
 * (Sport, Freizeit, Kunst & Kultur, Sightseeing, Wellness), von austria.info
 * verlinkt. Die Betriebe sind mit dem "Accessibility Check" erhoben; auf
 * der Detailseite zeigen Pictogramme (Datei `<x>_dunkel.png` = zutreffend,
 * `_hell` = nicht zutreffend) die Eignung fuer Rollstuhl, Rollator,
 * Kinderwagen, blinde und gehoerlose Menschen.
 *
 *   npx tsx src/scripts/barrierefrei/fetch-how.ts
 *   -> data/barrierefrei/holidaysonwheels-at.json
 *
 * Die Listen laden per Ajax (list-search-result-only.jsp, itemsPerPage frei
 * waehlbar); Unterkuenfte und Gastronomie in den Listen werden ausgelassen.
 * Koordinaten stehen im Karten-Script der Detailseite (lat:/lng:).
 */

import * as cheerio from 'cheerio';
import type { DatasetEntry } from '@/lib/activities/barrierefrei-dataset';
import type { AccessibilityFeature } from '@/lib/activities/accessibility';
import { detectAccessibilityFeatures, detectAccessibilityFromText } from '@/lib/activities/accessibility';
import { clean, dedupeEntries, fetchText, sleep, slugId, today, writeDataset } from './lib';

const BASE = 'https://www.holidaysonwheels.at';
const SOURCE = 'holidaysonwheels-at';
const LIST = `${BASE}/system/modules/at.holidays.on.wheels/elements/list-search-result-only.jsp`;

const CATEGORIES: { key: string; path: string; headline: string; listConfig: string; cssID: string; tags: string[]; setting: 'indoor' | 'outdoor' | 'mixed' | null }[] = [
  { key: 'sport', path: 'sport', headline: 'Sportangebote', listConfig: 'l_00004', cssID: '2d272f09-62f9-11e6-ae22-00163e087933', tags: ['wassersport'], setting: null },
  { key: 'freizeit', path: 'freizeit', headline: 'Freizeit', listConfig: 'l_00008', cssID: '416947f8-69e3-11e6-8bea-00163e087933', tags: ['naturführung'], setting: null },
  { key: 'kultur', path: 'kunst_u_kultur', headline: 'Kunst und Kultur', listConfig: 'l_00009', cssID: '5cebd29c-69e3-11e6-8bea-00163e087933', tags: ['museumstour', 'ausstellung'], setting: 'indoor' },
  { key: 'sightseeing', path: 'sightseeing', headline: 'Sightseeing', listConfig: 'l_00011', cssID: '8ce63b84-69e3-11e6-8bea-00163e087933', tags: ['wandern'], setting: null },
  { key: 'wellness', path: 'wellness', headline: 'Wellness', listConfig: 'l_00010', cssID: '749dcd40-69e3-11e6-8bea-00163e087933', tags: ['thermen-special', 'wellness-day'], setting: 'indoor' },
];

function listUrl(c: (typeof CATEGORIES)[number]): string {
  const q = new URLSearchParams({
    cssID: `${c.cssID}-inner`,
    categoryFacetField: 'category_exact',
    typesToCollect: 'BarrierefreiBetrieb:0248bf85-6954-11e6-8bea-00163e087933',
    categoriesToCollect: `/system/categories/maintypes/aktivangebote/${c.path}/`,
    pathes: '/shared/',
    headline: c.headline,
    showDate: 'true',
    showSort: 'true',
    app: 'false',
    showCategoryFilter: 'true',
    itemsPerPage: '500',
    buttonColor: 'red',
    compactForm: 'false',
    teaserLength: '200',
    extraQueries: '',
    __locale: 'de',
    sortOrder: 'asc',
    pageUri: `/de/aktiv-angebote/${c.key === 'sport' ? 'sportangebote' : c.key === 'kultur' ? 'kunst-und-kultur' : c.key}/index.html`,
    listConfig: `/.content/lists/${c.listConfig}.xml`,
    linkPrefix: '',
    sort: 'asc',
    page: '1',
    searchText: '',
  });
  return `${LIST}?${q.toString()}&reloaded`;
}

/** Feinere Tags aus dem Namen (die Kategorien der Seite sind grob). */
function refineTags(name: string, fallback: string[], setting: 'indoor' | 'outdoor' | 'mixed' | null): { tags: string[]; setting: 'indoor' | 'outdoor' | 'mixed' | null } {
  const n = name.toLowerCase();
  if (/therme|bad\b|hallenbad|freibad|strandbad|schwimm|badesee/.test(n)) return { tags: ['schwimmen'], setting: /hallen|therme/.test(n) ? 'indoor' : 'outdoor' };
  if (/museum|galerie|ausstellung|haus der|schloss|burg|stift|dom\b|kirche/.test(n)) return { tags: /schloss|burg|stift/.test(n) ? ['burgführung', 'museumstour'] : ['museumstour', 'ausstellung'], setting: 'indoor' };
  if (/theater|bühne|oper|kino|konzert/.test(n)) return { tags: ['theater'], setting: 'indoor' };
  if (/wanderweg|rundweg|promenade|lehrpfad|themenweg|klamm|weg\b|wandern/.test(n)) return { tags: ['wandern'], setting: 'outdoor' };
  if (/radweg|rad\b|bike/.test(n)) return { tags: ['radfahren'], setting: 'outdoor' };
  if (/bahn\b|lift|gondel|seilbahn|bergbahn/.test(n)) return { tags: ['bergtour'], setting: 'outdoor' };
  if (/paragleit|klettern|climbing|bogensport|wakeboard|wasserski|segel|kanu|kajak|reiten|golf|sporthalle|sportpark/.test(n)) {
    if (/klettern|climbing/.test(n)) return { tags: ['klettern'], setting: null };
    if (/wakeboard|wasserski|segel/.test(n)) return { tags: ['wassersport'], setting: 'outdoor' };
    if (/kanu|kajak/.test(n)) return { tags: ['kanutour'], setting: 'outdoor' };
    if (/reiten/.test(n)) return { tags: ['reiten'], setting: 'outdoor' };
    return { tags: ['wassersport'], setting: null };
  }
  if (/zoo|tierpark|wildpark|garten|park\b|see\b/.test(n)) return { tags: ['naturführung'], setting: 'outdoor' };
  return { tags: fallback, setting };
}

async function main(): Promise<void> {
  const entries: DatasetEntry[] = [];
  const seen = new Set<string>();

  for (const cat of CATEGORIES) {
    const html = await fetchText(listUrl(cat));
    const $ = cheerio.load(html);
    const links: string[] = [];
    $('a[href*="/de/barrierefreie-angebote/"]').each((_, a) => {
      const href = $(a).attr('href') ?? '';
      if (/\/(unterkunft|gastronomie)\//.test(href)) return;
      const url = href.startsWith('http') ? href : `${BASE}${href}`;
      if (!seen.has(url)) {
        seen.add(url);
        links.push(url);
      }
    });
    console.log(`[how] ${cat.headline}: ${links.length} Angebote`);

    for (const url of links) {
      let page: string;
      try {
        page = await fetchText(url);
      } catch (err) {
        console.log(`[how] ${url}: ${err instanceof Error ? err.message : err}`);
        continue;
      }
      await sleep(250);
      const $$ = cheerio.load(page);
      const box = $$('.info-box').first();
      const name = clean(box.find('h3').first().text());
      if (!name) continue;
      const region = box.find('.subtitle-region span').map((_, s) => clean($$(s).text())).get().filter(Boolean);
      const town = region[0] ?? null;
      const state = region[1] ?? null;
      const short = clean(box.find('p').first().text());

      // Pictogramme: *_dunkel = zutreffend
      const active = new Set<string>();
      $$('img[src*="icons_logo/"]').each((_, img) => {
        const m = /icons_logo\/([a-z_]+?)(?:_dunkel|_hell)?\.png/.exec($$(img).attr('src') ?? '');
        if (m && /_dunkel\.png/.test($$(img).attr('src') ?? '')) active.add(m[1]);
        if (m && /verified/.test(m[1])) active.add('verified');
      });
      const features: AccessibilityFeature[] = [];
      if (active.has('rolli')) features.push('rollstuhl');
      if (active.has('blind')) features.push('blind');
      if (active.has('taub')) features.push('gehoerlos');
      // Ohne Pictogramm zaehlt nur ein positiver Befund im Beschreibungstext
      // (gleiche Heuristik mit Verneinungsschutz wie im Deskline-Pfad).
      const generalText = clean($$('#allgemeines').text().replace(/Allgemeine Informationen/, '')) ?? '';
      let basis: 'pictogramm' | 'text' = 'pictogramm';
      if (features.length === 0) {
        if (!detectAccessibilityFromText(generalText)) {
          console.log(`[how] ${name}: kein Pictogramm und kein Textbefund`);
          continue;
        }
        basis = 'text';
        for (const f of detectAccessibilityFeatures(generalText)) features.push(f);
        if (!features.includes('rollstuhl') && /barrierefrei|rollstuhl|gehbeeinträchtigt|gehbehindert/i.test(generalText)) features.unshift('rollstuhl');
        if (features.length === 0) {
          console.log(`[how] ${name}: Textbefund ohne Merkmal`);
          continue;
        }
      }
      const groups: string[] = [];
      if (active.has('rolli')) groups.push('Rollstuhl');
      if (active.has('rollator')) groups.push('Rollator');
      if (active.has('kinderwagen')) groups.push('Kinderwagen');
      if (active.has('blind')) groups.push('blinde und sehbehinderte Menschen');
      if (active.has('taub')) groups.push('gehörlose und schwerhörige Menschen');

      // Kontakt: Strasse, "PLZ Ort", Website
      let street: string | null = null;
      let plz: string | null = null;
      let contactTown: string | null = null;
      let website: string | null = null;
      $$('.info-box').each((_, b) => {
        if (clean($$(b).find('h3').first().text()) !== 'Kontakt') return;
        const lines = ($$(b).html() ?? '')
          .split(/<br\s*\/?>/i)
          .map((l) => clean(cheerio.load(`<x>${l}</x>`)('x').text()))
          .filter((l): l is string => Boolean(l));
        const plzIdx = lines.findIndex((l) => /^\d{4}\s+\S/.test(l));
        if (plzIdx >= 0) {
          const m = /^(\d{4})\s+(.+)$/.exec(lines[plzIdx]);
          if (m) {
            plz = m[1];
            contactTown = m[2];
          }
          if (plzIdx > 0) street = lines[plzIdx - 1].replace(/^.*?,\s*(?=[^,]+\s\d)/, '');
        }
        website = $$(b).find('a[href^="http"]').filter((_, a) => !/holidaysonwheels/.test($$(a).attr('href') ?? '')).first().attr('href') ?? null;
      });

      const la = /lat:\s*([0-9.]+)/.exec(page);
      const lo = /lng:\s*([0-9.]+)/.exec(page);
      const general = generalText || null;
      const anreise = clean($$('#anreise p').text());

      const images: DatasetEntry['images'] = [];
      $$('#bilder img[src*="/wheels/media/"], .fancybox img[src*="/wheels/media/"]').each((_, img) => {
        const src = $$(img).attr('src');
        if (!src || images.length >= 3) return;
        const url = src.startsWith('http') ? src : `${BASE}${src}`;
        if (!images.some((i) => i.url === url)) images.push({ url, credit: 'Holidays on Wheels / Betrieb' });
      });

      const { tags, setting } = refineTags(name, cat.tags, cat.setting);
      const slug = url.replace(/\/$/, '').split('/').pop() ?? name;
      entries.push({
        id: slugId(`${cat.key}-${slug}`),
        name,
        description: `${short ? `${short} ` : ''}${general ?? ''}`.trim() || name,
        description_short: short,
        tags,
        setting,
        address: street,
        postal_code: plz,
        town: contactTown ?? town,
        lat: la ? parseFloat(la[1]) : null,
        lng: lo ? parseFloat(lo[1]) : null,
        website: website ?? url,
        source_url: url,
        accessibility: {
          features,
          note:
            basis === 'pictogramm'
              ? `Laut Holidays on Wheels (Accessibility Check${active.has('verified') ? ', extern geprüft' : ''}) geeignet für: ${groups.join(', ')}.${anreise ? ` Anreise: ${anreise}` : ''}`.slice(0, 600)
              : `Bei Holidays on Wheels als barrierefreier Betrieb gelistet; laut Beschreibung: ${generalText}`.slice(0, 600),
        },
        images,
      });
      console.log(`[how] + ${name} (${town ?? '?'}, ${state ?? '?'}): ${features.join(', ')}`);
    }
  }

  writeDataset({
    source: SOURCE,
    source_label: 'Holidays on Wheels (holidaysonwheels.at)',
    source_url: `${BASE}/de/aktiv-angebote/sportangebote/`,
    checked_at: today(),
    entries: dedupeEntries(entries),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
