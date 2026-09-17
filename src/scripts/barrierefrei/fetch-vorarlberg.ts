/**
 * Quelle: Vorarlberg Tourismus (vorarlberg.travel) — "Barrierefrei wandern:
 * Rollstuhl-Wanderwege" auf der Seite "Barrierefrei reisen - ohne Handicap"
 * (von austria.info verlinkt).
 *
 *   npx tsx src/scripts/barrierefrei/fetch-vorarlberg.ts
 *   -> data/barrierefrei/vorarlberg-travel.json
 *
 * Die Touren stehen als Liste (ul.tour-overview) mit Titel, Bild (title =
 * Fotograf), Faktentabelle (Schwierigkeit, Strecke, Dauer ...), Start-/
 * Endpunkt und Beschreibung. Koordinaten gibt es nicht — der Import
 * geocodiert den Startpunkt ("Hard, Seepark" -> "Seepark, Hard").
 */

import * as cheerio from 'cheerio';
import type { DatasetEntry } from '@/lib/activities/barrierefrei-dataset';
import { clean, dedupeEntries, fetchText, slugId, today, writeDataset } from './lib';

const URL = 'https://www.vorarlberg.travel/aktivitaet/barrierefrei-reisen-ohne-handicap/';
const SOURCE = 'vorarlberg-travel';

async function main(): Promise<void> {
  const html = await fetchText(URL);
  const $ = cheerio.load(html);
  const entries: DatasetEntry[] = [];

  $('ul.tour-overview > li').each((_, li) => {
    const details = $(li).find('.tour-overview__details');
    const title = clean(details.find('h4').first().text()) ?? clean($(li).find('.tour-overview__hl').first().text());
    if (!title) return;
    const name = title.replace(/^Barrierefrei\s*[:–-]\s*/i, '').replace(/…$/, '').trim();

    const facts: string[] = [];
    details.find('table.table--facts tr').each((__, tr) => {
      const th = clean($(tr).find('th').text())?.replace(/:$/, '');
      const td = clean($(tr).find('td').text());
      if (th && td && !/kondition|erlebnis|landschaft/i.test(th)) facts.push(`${th} ${td}`);
    });

    let start: string | null = null;
    let description: string | null = null;
    details.find('h5, h6, strong, b, dt').each((__, h) => {
      const label = clean($(h).text());
      if (label === 'Start der Tour' && !start) start = clean($(h).next().text());
      if (label === 'Beschreibung' && !description) description = clean($(h).next().text());
    });
    if (!start) {
      // Fallback: Textsuche im Detailblock
      const text = details.text();
      const m = /Start der Tour\s+([^\n]+?)\s+Ende der Tour/.exec(text.replace(/\s+/g, ' '));
      if (m) start = clean(m[1]);
    }
    if (!description) {
      const m = /Beschreibung\s+(.+?)\s+Beste Jahreszeit/.exec(details.text().replace(/\s+/g, ' '));
      if (m) description = clean(m[1]);
    }

    const img = $(li).find('img.tour-overview__img').first();
    const imgUrl = img.attr('data-lazy-src') ?? $(li).find('noscript img').first().attr('src') ?? null;
    const photographer = clean(img.attr('title'));
    const link = $(li).find('a[href*="/route/"]').first().attr('href') ?? null;

    // "Hard, Seepark" -> Ort "Hard", Adresse "Seepark"
    const [townRaw, ...rest] = (start ?? '').split(',').map((s) => s.trim());
    // "Schruns (linker Litzpromenadenweg)" / "Vandans/Bahnhof Tschagguns" -> Ort
    const town = clean(townRaw.replace(/\(.*?\)/g, '').split('/')[0].replace(/^beim\s+/i, '').replace(/^bahnhaltestelle\s+/i, ''));
    const address = rest.join(', ') || (townRaw.includes('(') ? clean(/\((.*?)\)/.exec(townRaw)?.[1] ?? '') : null);

    entries.push({
      id: slugId(name),
      name,
      description: `Rollstuhl-Wanderweg laut Vorarlberg Tourismus (Strecken mit angemessener Länge und Neigung, Asphalt oder geglätteter Schotter). ${facts.join(', ')}.${start ? ` Start und Ziel: ${start}.` : ''}`,
      tags: ['wandern'],
      setting: 'outdoor',
      address,
      town: town || null,
      website: link,
      source_url: URL,
      accessibility: {
        features: ['rollstuhl'],
        note: `Laut vorarlberg.travel als Rollstuhl-Wanderweg empfohlen. ${facts.join(', ')}.`,
      },
      images: imgUrl && !/data:/.test(imgUrl) ? [{ url: imgUrl, credit: photographer ?? 'Vorarlberg Tourismus' }] : [],
    });
  });

  console.log(`[vorarlberg] ${entries.length} Touren`);
  writeDataset({
    source: SOURCE,
    source_label: 'Vorarlberg Tourismus (vorarlberg.travel)',
    source_url: URL,
    checked_at: today(),
    entries: dedupeEntries(entries),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
