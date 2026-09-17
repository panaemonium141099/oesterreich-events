/**
 * Quelle: Tourismus Salzburg (salzburg.info) — Sehenswuerdigkeiten, Museen,
 * Kirchen, Plaetze und Ausflugsziele der Stadt Salzburg. Der Barrierefrei-
 * Bereich (von austria.info verlinkt) verweist fuer die Angaben auf die
 * Detailseiten: dort steht ein Akkordeon "Barrierefreiheit".
 *
 *   npx tsx src/scripts/barrierefrei/fetch-salzburg.ts
 *   -> data/barrierefrei/salzburg-info.json
 *
 * Seitenliste aus der Sitemap (sitemap.default.xml, /de/sehenswertes/...),
 * je Seite: Akkordeon-Text, Adressblock "Adresse & Kontakt", Koordinaten
 * (JSON im Quelltext), erstes Galeriebild mit Credit. Aufgenommen wird nur
 * ein positiver Befund (Text mit Verneinungsschutz wie im Deskline-Pfad).
 */

import * as cheerio from 'cheerio';
import type { DatasetEntry } from '@/lib/activities/barrierefrei-dataset';
import { detectAccessibilityFeatures, detectAccessibilityFromText } from '@/lib/activities/accessibility';
import { clean, dedupeEntries, fetchText, sleep, slugId, stripCopyrightPrefix, today, writeDataset } from './lib';

const BASE = 'https://www.salzburg.info';
const SITEMAP = `${BASE}/sitemap.default.xml`;
const SOURCE = 'salzburg-info';

function tagsOf(url: string, name: string): { tags: string[]; setting: 'indoor' | 'outdoor' | 'mixed' | null } {
  const n = `${url} ${name}`.toLowerCase();
  if (/museen|museum|galerie|hangar|haus der natur/.test(n)) return { tags: ['museumstour', 'ausstellung'], setting: 'indoor' };
  if (/festung|schloss|schloesser|burg/.test(n)) return { tags: ['burgführung'], setting: 'mixed' };
  if (/kirchen|friedhoefe|kirche|dom\b|stift|kloster|kapelle/.test(n)) return { tags: ['burgführung'], setting: 'indoor' };
  if (/zoo|tiergarten/.test(n)) return { tags: ['naturführung'], setting: 'outdoor' };
  if (/garten|park|berg\b|wasserspiele|plaetze|platz|strasse|gasse/.test(n)) return { tags: ['wandern'], setting: 'outdoor' };
  if (/bahn|lift/.test(n)) return { tags: ['bergtour'], setting: 'outdoor' };
  return { tags: [], setting: null };
}

async function main(): Promise<void> {
  const xml = await fetchText(SITEMAP);
  const urls = [...new Set([...xml.matchAll(/<loc>([^<]*\/de\/sehenswertes\/[^<]+)<\/loc>/g)].map((m) => m[1]))].filter((u) => /\/de\/sehenswertes\/[a-z0-9-]+\/[a-z0-9-]+$/.test(u));
  console.log(`[salzburg] ${urls.length} Detailseiten aus der Sitemap`);

  const entries: DatasetEntry[] = [];
  let n = 0;
  for (const url of urls) {
    n++;
    let html: string;
    try {
      html = await fetchText(url);
    } catch (err) {
      console.log(`[salzburg] ${url}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    await sleep(300);
    const $ = cheerio.load(html);
    const name = clean($('h1').first().text());
    if (!name) continue;

    // Akkordeon "Barrierefreiheit"
    let accText: string | null = null;
    $('.panel-title a').each((_, a) => {
      if (accText !== null) return;
      if (clean($(a).text())?.replace(/\s+/g, ' ').trim() !== 'Barrierefreiheit') return;
      const target = $(a).attr('href')?.replace(/^.*#/, '#') ?? '';
      const body = target ? $(target).find('.panel-body').first() : $(a).closest('.panel').find('.panel-body').first();
      accText = clean(body.text());
    });
    if (!accText || !detectAccessibilityFromText(accText)) continue;
    const features = detectAccessibilityFeatures(accText);
    // "barrierefrei zugänglich" ohne genannte Merkmale meint Rollstuhlzugang.
    if (features.length === 0 || (!features.includes('rollstuhl') && /barrierefrei|rollstuhl/i.test(accText))) features.unshift('rollstuhl');

    // Adresse: Block nach "Adresse & Kontakt"
    let street: string | null = null;
    let plz: string | null = null;
    let town: string | null = null;
    $('h2').each((_, h) => {
      if (plz || !/adresse\s*&\s*kontakt/i.test($(h).text())) return;
      // <address>Betreiber<br>Strasse<br>PLZ Ort</address>
      const addrHtml = $(h).parent().find('address').first().html() ?? '';
      const lines = addrHtml
        .split(/<br\s*\/?>/i)
        .map((l) => clean(cheerio.load(`<x>${l}</x>`)('x').text()))
        .filter((l): l is string => Boolean(l));
      const plzLine = lines.find((l) => /^\d{4}\s+\S/.test(l));
      if (plzLine) {
        const m = /^(\d{4})\s+(.+)$/.exec(plzLine);
        if (m) {
          plz = m[1];
          town = m[2];
          const idx = lines.indexOf(plzLine);
          if (idx > 0 && !/tel\.|@|http|www/i.test(lines[idx - 1])) street = lines[idx - 1];
        }
      }
    });
    const la = /"latitude"\s*:\s*([0-9.]+)/.exec(html);
    const lo = /"longitude"\s*:\s*([0-9.]+)/.exec(html);

    // Erstes Galeriebild + Credit ("Titel | © Foto: ...")
    let image: { url: string; credit: string | null } | null = null;
    $('#detail-site-gallery img[src], .gallery img[src]').each((_, img) => {
      if (image) return;
      const src = $(img).attr('src');
      if (!src || /logo/i.test(src)) return;
      const alt = clean($(img).attr('alt')) ?? '';
      image = { url: src.startsWith('http') ? src : `${BASE}${src}`, credit: alt.includes('©') ? stripCopyrightPrefix(alt.slice(alt.indexOf('©'))) : null };
    });

    const { tags, setting } = tagsOf(url, name);
    entries.push({
      id: slugId(url.split('/').slice(-2).join('-')),
      name,
      description: `${name} in Salzburg. Barrierefreiheit laut Tourismus Salzburg: ${accText}`,
      tags,
      setting,
      address: street,
      postal_code: plz,
      town: town ?? 'Salzburg',
      lat: la ? parseFloat(la[1]) : null,
      lng: lo ? parseFloat(lo[1]) : null,
      website: $('a.link-arrow[href^="http"]').filter((_, a) => /website/i.test($(a).text())).first().attr('href') ?? url,
      source_url: url,
      accessibility: { features, note: `Laut salzburg.info: ${accText}` },
      images: image ? [image] : [],
    });
    if (n % 20 === 0) console.log(`[salzburg] ${n}/${urls.length} geprueft, ${entries.length} barrierefrei`);
  }

  writeDataset({
    source: SOURCE,
    source_label: 'Tourismus Salzburg (salzburg.info)',
    source_url: `${BASE}/de/salzburg/barrierefrei`,
    checked_at: today(),
    entries: dedupeEntries(entries),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
