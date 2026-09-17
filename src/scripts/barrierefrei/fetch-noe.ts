/**
 * Quelle: Niederösterreich Werbung — "Rollstuhlgerechte Ausflugsziele"
 * https://www.niederoesterreich.at/rollstuhlgerechte-ausflugsziele
 * (verlinkt von austria.info/planung/barrierefreier-urlaub, Kachel
 * "Niederösterreich: Barrierefreie Freizeit- und Ausflugsziele").
 *
 *   npx tsx src/scripts/barrierefrei/fetch-noe.ts [--limit N]
 *   -> data/barrierefrei/niederoesterreich-at.json
 *
 * Liste: 12 Treffer je Seite, Folgeseiten ueber den "weitere Ergebnisse"-
 * Link (cHash pflicht). Detailseite je Treffer: Koordinaten (data-lat/lng
 * der Karte), Kontaktblock (Strasse, PLZ Ort, Webseite), Akkordeons
 * "Eignungen" (rollstuhlgerecht laut Betreiber) und "Ausstattungen",
 * Preise, erstes Bild mit Credit. Die Beschreibung wird aus diesen Fakten
 * zusammengesetzt — der Marketingtext der Seite wird nicht uebernommen.
 * Detailseiten sind ~5 MB (eingebettete Kartendaten), es werden nur die
 * ersten 300 KB gelesen.
 */

import * as cheerio from 'cheerio';
import type { DatasetEntry } from '@/lib/activities/barrierefrei-dataset';
import { clean, dedupeEntries, featuresFromLabels, fetchText, sleep, slugId, today, writeDataset } from './lib';

const START = 'https://www.niederoesterreich.at/rollstuhlgerechte-ausflugsziele';
const SOURCE = 'niederoesterreich-at';
const DETAIL_BYTES = 300_000;

interface ListItem {
  name: string;
  addressLine: string | null;
  detailUrl: string;
  imageUrl: string | null;
  imageCredit: string | null;
}

function parseList(html: string): { items: ListItem[]; next: string | null } {
  const $ = cheerio.load(html);
  const items: ListItem[] = [];
  $('article.teaser-v1').each((_, el) => {
    const name = clean($(el).find('h3.main').first().text());
    const detailUrl = $(el).find('a.aria[href]').first().attr('href') ?? null;
    if (!name || !detailUrl) return;
    const img = $(el).find('picture img').first();
    items.push({
      name,
      addressLine: clean($(el).find('.article .paragraph').first().text()),
      detailUrl,
      imageUrl: img.attr('src') ?? null,
      imageCredit: clean($(el).find('figcaption .figcaption__text').first().text()),
    });
  });
  // Der Paginator traegt auch einen "vorherige"-Link (page=1 auf Seite 2);
  // weiter geht es nur ueber den Button "N weitere Ergebnisse".
  let next: string | null = null;
  $('.paginator a[href*="page="]').each((_, a) => {
    if (next) return;
    if (/weitere ergebnisse/i.test($(a).text())) next = $(a).attr('href') ?? null;
  });
  return { items, next: next ? (next as string).replace(/&amp;/g, '&') : null };
}

interface Detail {
  lat: number | null;
  lng: number | null;
  street: string | null;
  postalCode: string | null;
  town: string | null;
  website: string | null;
  eignungen: string[];
  ausstattung: string[];
  priceHint: string | null;
  openingHint: string | null;
  metaDescription: string | null;
}

function accordionItems($: cheerio.CheerioAPI, title: string): string[] {
  const out: string[] = [];
  $('button.heading .text').each((_, el) => {
    if (clean($(el).text()) !== title) return;
    const button = $(el).closest('button');
    const contentId = button.attr('id')?.replace('-button-', '-content-');
    const content = contentId ? button.closest('.item').find(`#${contentId}`) : button.closest('.item').find('.content');
    content.find('li').each((__, li) => {
      const t = clean($(li).text());
      if (t) out.push(t);
    });
  });
  return [...new Set(out)];
}

function parseDetail(html: string): Detail {
  const $ = cheerio.load(html);
  const map = $('figure.map').first();
  const lat = parseFloat(map.attr('data-lat') ?? '');
  const lng = parseFloat(map.attr('data-lng') ?? '');

  const contact = $('article.contact-map section.contact .details').first();
  let street: string | null = null;
  let postalCode: string | null = null;
  let town: string | null = null;
  contact.find('p').each((_, p) => {
    const lines = $(p)
      .html()
      ?.split(/<br\s*\/?>/i)
      .map((l) => clean(cheerio.load(`<x>${l}</x>`)('x').text()))
      .filter((l): l is string => Boolean(l)) ?? [];
    const plzLine = lines.find((l) => /^\d{4}\s+\S/.test(l));
    if (plzLine && !postalCode) {
      const m = /^(\d{4})\s+(.+)$/.exec(plzLine);
      if (m) {
        postalCode = m[1];
        town = m[2];
        const idx = lines.indexOf(plzLine);
        if (idx > 0 && !/telefon|e-mail|webseite/i.test(lines[idx - 1])) street = lines[idx - 1];
      }
    }
  });
  const website = contact.find('a[href^="http"]').first().attr('href') ?? null;

  const eignungen = accordionItems($, 'Eignungen');
  const ausstattung = accordionItems($, 'Ausstattungen');

  let priceHint: string | null = null;
  $('h4').each((_, h) => {
    if (priceHint) return;
    if (!/preise einzelpersonen|preise/i.test($(h).text())) return;
    const line = clean($(h).next().text() || $(h).nextAll('p').first().text());
    if (line && /€|euro|frei|gratis/i.test(line)) priceHint = line.slice(0, 120);
  });

  let openingHint: string | null = null;
  $('h4').each((_, h) => {
    if (openingHint) return;
    const t = clean($(h).text());
    if (t && /^vom .* bis zum .*$/i.test(t)) openingHint = t.replace(/^vom\s+/i, 'Saison ').replace(/bis zum/, 'bis');
  });

  const metaDescription = clean($('meta[name="description"]').attr('content'));
  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    street,
    postalCode,
    town,
    website,
    eignungen,
    ausstattung,
    priceHint,
    openingHint,
    metaDescription,
  };
}

function guessTags(name: string, ausstattung: string[]): string[] {
  const n = name.toLowerCase();
  const tags = new Set<string>();
  if (/museum|galerie|ausstellung|haus der|welt|zentrum|sammlung|kunsthalle/.test(n)) tags.add('museumstour');
  if (/burg|schloss|ruine|stift|kloster|basilika|dom\b|kirche|kapelle/.test(n)) tags.add('burgführung');
  if (/bad\b|badesee|therme|strand|freibad|hallenbad|see\b/.test(n)) tags.add('schwimmen');
  if (/therme/.test(n)) tags.add('thermen-special');
  if (/weg\b|pfad|wander|steig|park|garten|rosarium|aussicht|warte|naturpark|au\b|moor|lehrpfad|kellergasse/.test(n)) tags.add('wandern');
  if (/zoo|tier|ranch|reit|pferd|alpaka|lama|wild/.test(n)) tags.add('naturführung');
  if (/reit|ranch|pferd/.test(n)) tags.add('reiten');
  if (/kino|film/.test(n)) tags.add('kino');
  if (/theater|bühne|festspiel/.test(n)) tags.add('theater');
  if (/bahn|lift|gondel/.test(n) && !/museum/.test(n)) tags.add('bergtour');
  if (tags.size === 0 && ausstattung.some((a) => /führung/i.test(a))) tags.add('museumstour');
  return [...tags];
}

function guessSetting(name: string, tags: string[]): 'indoor' | 'outdoor' | 'mixed' | null {
  const n = name.toLowerCase();
  if (/museum|galerie|kino|theater|hallenbad|therme/.test(n)) return 'indoor';
  if (/weg|pfad|park|garten|see|strand|freibad|ruine|warte|aussicht|kellergasse|au\b|moor/.test(n)) return 'outdoor';
  if (tags.includes('museumstour')) return 'indoor';
  if (tags.includes('wandern') || tags.includes('schwimmen')) return 'outdoor';
  return null;
}

function composeDescription(name: string, d: Detail, addressTown: string | null): string {
  const parts: string[] = [];
  const where = d.town ?? addressTown;
  parts.push(`${name}${where ? ` in ${where}` : ''}: rollstuhlgerechtes Ausflugsziel laut Niederösterreich Werbung.`);
  if (d.eignungen.length > 0) parts.push(`Eignungen laut Betreiber: ${d.eignungen.join(', ')}.`);
  if (d.ausstattung.length > 0) parts.push(`Ausstattung: ${d.ausstattung.join(', ')}.`);
  return parts.join(' ');
}

async function main(): Promise<void> {
  const limitIdx = process.argv.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1] ?? '0', 10) : 0;

  const list: ListItem[] = [];
  let url: string | null = START;
  let page = 0;
  while (url) {
    page++;
    const html = await fetchText(url);
    const { items, next } = parseList(html);
    list.push(...items);
    console.log(`[noe] Liste Seite ${page}: ${items.length} Treffer (gesamt ${list.length})`);
    url = next;
    if (limit && list.length >= limit) break;
    await sleep(400);
  }

  const entries: DatasetEntry[] = [];
  let n = 0;
  for (const item of limit ? list.slice(0, limit) : list) {
    n++;
    let d: Detail;
    try {
      d = parseDetail(await fetchText(item.detailUrl, DETAIL_BYTES));
    } catch (err) {
      console.log(`[noe] ${item.name}: Detail fehlgeschlagen (${err instanceof Error ? err.message : err})`);
      continue;
    }
    await sleep(350);

    // Adresse: Detail-Kontaktblock, sonst Listenzeile "Strasse, PLZ Ort".
    let street = d.street;
    let plz = d.postalCode;
    let town = d.town;
    if ((!plz || !town) && item.addressLine) {
      const m = /^(.*?),\s*(\d{4})\s+(.+)$/.exec(item.addressLine);
      if (m) {
        street = street ?? clean(m[1]);
        plz = plz ?? m[2];
        town = town ?? clean(m[3]);
      }
    }

    const features = featuresFromLabels(d.eignungen);
    if (!features.includes('rollstuhl')) features.unshift('rollstuhl'); // Listenkriterium der Quelle
    const tags = guessTags(item.name, d.ausstattung);
    const id = slugId(item.detailUrl.split('/').filter(Boolean).pop() ?? item.name);

    entries.push({
      id,
      name: item.name,
      description: composeDescription(item.name, d, town),
      description_short: d.metaDescription ? null : null,
      tags,
      setting: guessSetting(item.name, tags),
      address: street,
      postal_code: plz,
      town,
      lat: d.lat,
      lng: d.lng,
      website: d.website,
      source_url: item.detailUrl,
      accessibility: {
        features,
        note: d.eignungen.length > 0
          ? `Laut niederoesterreich.at: ${d.eignungen.join(', ')}. Angaben beruhen auf Eigenauskunft des Betriebs.`
          : 'Von Niederösterreich Werbung als rollstuhlgerechtes Ausflugsziel gelistet. Angaben beruhen auf Eigenauskunft des Betriebs.',
      },
      images: item.imageUrl ? [{ url: item.imageUrl, credit: item.imageCredit }] : [],
      price_hint: d.priceHint,
      opening_hint: d.openingHint,
    });
    if (n % 25 === 0) console.log(`[noe] ${n}/${list.length} Details gelesen`);
  }

  writeDataset({
    source: SOURCE,
    source_label: 'Niederösterreich Werbung (niederoesterreich.at)',
    source_url: START,
    checked_at: today(),
    entries: dedupeEntries(entries),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
