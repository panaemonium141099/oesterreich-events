/**
 * Quelle: Tirol Werbung (tirol.at) — vier Barrierefrei-Listen, alle von
 * austria.info/planung/barrierefreier-urlaub verlinkt:
 *   Rolli-Wandertouren, Handbike-Routen, Schlittenlanglauf-Loipen,
 *   Skigebiete zum Monoskifahren.
 *
 *   npx tsx src/scripts/barrierefrei/fetch-tirol.ts
 *   -> data/barrierefrei/tirol-at.json
 *
 * Jede Liste ist ein "highlightListicles"-Block: Abschnitte mit Titel,
 * Bildergalerie (Credit in der Figcaption), Faktenliste (Schwierigkeit,
 * Laenge, Dauer, Ort ...) und "Mehr erfahren"-Link; die Karte des Blocks
 * traegt in data-markers die Koordinaten aller Abschnitte, zugeordnet
 * ueber data-ident. Beschreibung = Faktenliste in eigenen Worten.
 */

import * as cheerio from 'cheerio';
import type { DatasetEntry } from '@/lib/activities/barrierefrei-dataset';
import type { AccessibilityFeature } from '@/lib/activities/accessibility';
import { clean, dedupeEntries, fetchText, sleep, slugId, stripCopyrightPrefix, today, writeDataset } from './lib';

const SOURCE = 'tirol-at';

interface ListConfig {
  url: string;
  kind: 'rolli' | 'handbike' | 'loipe' | 'monoski';
  tags: string[];
  setting: 'outdoor';
  features: AccessibilityFeature[];
  intro: string;
}

const LISTS: ListConfig[] = [
  {
    url: 'https://www.tirol.at/reiseservice/barrierefrei/rolli-wandertouren',
    kind: 'rolli',
    tags: ['wandern'],
    setting: 'outdoor',
    features: ['rollstuhl'],
    intro: 'Rolli-Wandertour laut Tirol Werbung: mit dem Rollstuhl passierbarer Weg.',
  },
  {
    url: 'https://www.tirol.at/reisefuehrer/barrierefrei/handbike-routen',
    kind: 'handbike',
    tags: ['radfahren'],
    setting: 'outdoor',
    features: ['rollstuhl'],
    intro: 'Handbike-Route laut Tirol Werbung: für Handbikes geeignete Strecke.',
  },
  {
    url: 'https://www.tirol.at/reisefuehrer/barrierefrei/schlittenlanglauf',
    kind: 'loipe',
    tags: ['langlauf'],
    setting: 'outdoor',
    features: ['rollstuhl', 'parkplatz'],
    intro: 'Schlittenlanglauf-Loipe laut Tirol Werbung: für Langlaufschlitten geeignet, mit entsprechend ausgestatteten Park- und Zustiegsmöglichkeiten (Tiroler Gütesiegel).',
  },
  {
    url: 'https://www.tirol.at/aktivitaeten/sport/skifahren/mono-skigebiete',
    kind: 'monoski',
    tags: ['ski'],
    setting: 'outdoor',
    features: ['rollstuhl'],
    intro: 'Von Tirol Werbung als Skigebiet zum Monoskifahren empfohlen: barrierefrei zugängliche Liftanlagen und Infrastruktur, geschultes Liftpersonal.',
  },
];

/** Text eines Elements mit Leerzeichen zwischen Kind-Elementen
 *  ("<span>Ort</span><span>Pertisau</span>" -> "Ort Pertisau"). */
function spacedText($: cheerio.CheerioAPI, el: cheerio.Cheerio<import('domhandler').Element>): string | null {
  const html = el.html() ?? '';
  return clean(cheerio.load(`<x>${html.replace(/></g, '> <')}</x>`)('x').text());
}

interface Marker {
  latlng: [number, number];
  title: string;
  ident: string;
}

function parseMarkers($: cheerio.CheerioAPI): Map<string, Marker> {
  const out = new Map<string, Marker>();
  $('[data-markers]').each((_, el) => {
    const raw = $(el).attr('data-markers');
    if (!raw) return;
    try {
      const arr = JSON.parse(raw) as Marker[];
      for (const m of arr) if (m.ident && Array.isArray(m.latlng)) out.set(m.ident, m);
    } catch {
      /* kaputtes JSON -> ohne Koordinaten, Geocoding uebernimmt */
    }
  });
  return out;
}

async function parseList(cfg: ListConfig): Promise<DatasetEntry[]> {
  const html = await fetchText(cfg.url);
  const $ = cheerio.load(html);
  const markers = parseMarkers($);
  const entries: DatasetEntry[] = [];

  $('section.highlightListicle').each((_, section) => {
    const title = clean($(section).find('h2.title .text').first().text());
    if (!title) return;
    const ident = $(section).attr('data-ident') ?? '';
    const marker = markers.get(ident) ?? null;

    const facts: string[] = [];
    $(section).find('li').each((__, li) => {
      if ($(li).hasClass('item') || $(li).find('figure').length > 0) return;
      const t = spacedText($, $(li));
      if (t && t.length < 160) facts.push(t);
    });
    const ort = facts.find((f) => /^Ort\s/.test(f))?.replace(/^Ort\s+/, '') ?? null;
    const town = ort ? clean(ort.split('/')[0]) : null;
    const detail = $(section).find('a[href]').filter((__, a) => /mehr erfahren|zum skigebiet/i.test($(a).text())).first().attr('href') ?? null;

    const img = $(section).find('figure img[src]').first();
    const caption = clean($(section).find('figure .figcaptionSlot').first().text());
    const credit = caption && caption.includes('©') ? stripCopyrightPrefix(caption.slice(caption.indexOf('©'))) : null;

    const factLine = facts.filter((f) => /^(Schwierigkeit|Länge|Dauer|Höhenmeter|Stil|Ort)\b/.test(f)).join(', ');
    const extra = facts.filter((f) => !/^(Schwierigkeit|Länge|Dauer|Höhenmeter|Stil|Ort|Öffnungszeiten)\b/.test(f)).slice(0, 4).join('. ');

    entries.push({
      id: slugId(`${cfg.kind}-${title}`),
      name: title.replace(/\s*\(barrierefrei\)\s*/i, '').trim(),
      description: [cfg.intro, factLine ? `${factLine}.` : null, extra ? `${extra}.` : null].filter(Boolean).join(' '),
      tags: cfg.tags,
      setting: cfg.setting,
      town,
      lat: marker?.latlng[0] ?? null,
      lng: marker?.latlng[1] ?? null,
      website: detail && /^https?:\/\//.test(detail) ? detail : detail ? `https://www.tirol.at${detail}` : null,
      source_url: cfg.url,
      accessibility: {
        features: cfg.features,
        note: extra ? `Laut tirol.at: ${extra}.` : cfg.intro,
      },
      images: img.attr('src') ? [{ url: img.attr('src') as string, credit: credit ?? 'Tirol Werbung' }] : [],
    });
  });
  return entries;
}

/** Skigebiets-Liste (list-default): Artikel mit data-ident, Titel, Bild,
 *  Pistenkilometer/Hoehenlage; Koordinaten aus den Karten-Markern. */
async function parseResortList(cfg: ListConfig): Promise<DatasetEntry[]> {
  const html = await fetchText(cfg.url);
  const $ = cheerio.load(html);
  const markers = parseMarkers($);
  const entries: DatasetEntry[] = [];
  $('article.list__article').each((_, article) => {
    const title = clean($(article).find('h3.title').first().text());
    if (!title) return;
    const marker = markers.get($(article).attr('data-ident') ?? '') ?? null;
    // Ohne Karten-Marker ist es ein Teaser auf andere Artikel, kein Skigebiet.
    if (!marker) return;
    const img = $(article).find('figure img[src]').first();
    const caption = clean($(article).find('figure .figcaptionSlot').first().text());
    const credit = caption && caption.includes('©') ? stripCopyrightPrefix(caption.slice(caption.indexOf('©'))) : null;
    const data: string[] = [];
    $(article).find('.dataItem').each((__, d) => {
      const label = clean($(d).find('.hide').text());
      const value = clean($(d).find('.text').text());
      if (label && value && !/öffnungsstatus/i.test(label)) data.push(`${label} ${value}`);
    });
    const detail = $(article).find('a.link[href]').first().attr('href') ?? null;
    entries.push({
      id: slugId(`${cfg.kind}-${title}`),
      name: title,
      description: [cfg.intro, data.length > 0 ? `${data.join(', ')}.` : null].filter(Boolean).join(' '),
      tags: cfg.tags,
      setting: cfg.setting,
      town: null,
      lat: marker?.latlng[0] ?? null,
      lng: marker?.latlng[1] ?? null,
      website: detail,
      source_url: cfg.url,
      accessibility: { features: cfg.features, note: cfg.intro },
      images: img.attr('src') ? [{ url: img.attr('src') as string, credit: credit ?? 'Tirol Werbung' }] : [],
    });
  });
  return entries;
}

async function main(): Promise<void> {
  const all: DatasetEntry[] = [];
  for (const cfg of LISTS) {
    const entries = cfg.kind === 'monoski' ? await parseResortList(cfg) : await parseList(cfg);
    console.log(`[tirol] ${cfg.kind}: ${entries.length} Eintraege (${entries.filter((e) => e.lat != null).length} mit Koordinaten)`);
    all.push(...entries);
    await sleep(500);
  }
  writeDataset({
    source: SOURCE,
    source_label: 'Tirol Werbung (tirol.at)',
    source_url: 'https://www.tirol.at/reisefuehrer/barrierefrei',
    checked_at: today(),
    entries: dedupeEntries(all),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
