/**
 * Quelle: barrierefreierurlaub.at (Verein "Barrierefreier Urlaub", Steiermark
 * und Nachbarregionen; von austria.info verlinkt). Jeder Betrieb wurde vor
 * Ort geprueft (Praxistest, Pruefer, Datum) und traegt eine
 * Rollstuhlbewertung 1 bis 3 sowie Messwerte (Tuerlichte, WC-Hoehe ...).
 *
 *   npx tsx src/scripts/barrierefrei/fetch-bfu.ts
 *   -> data/barrierefrei/barrierefreierurlaub-at.json
 *
 * Liste per POST-Suchformular je Typ (nur Freizeit-Typen, keine Unterkunft/
 * Gastronomie), Detail `Eintrag.2305.html?bsghid=<id>` als Tabelle
 * "Label: | Wert". Achtung: die Felder "Google Maps Lat"/"Long" sind auf
 * der Seite vertauscht (Lat enthaelt die Laenge).
 */

import * as cheerio from 'cheerio';
import type { DatasetEntry } from '@/lib/activities/barrierefrei-dataset';
import type { AccessibilityFeature } from '@/lib/activities/accessibility';
import { USER_AGENT, clean, dedupeEntries, fetchText, sleep, slugId, today, writeDataset } from './lib';

const BASE = 'https://barrierefreierurlaub.at';
const SOURCE = 'barrierefreierurlaub-at';

/** Freizeit-Typen des Suchformulars (bsghtype) mit Tag-Vorgabe. */
const TYPES: { id: number; label: string; tags: string[]; setting: 'indoor' | 'outdoor' | 'mixed' | null }[] = [
  { id: 4, label: 'Ausflugsziel', tags: ['naturführung'], setting: null },
  { id: 5, label: 'Ausstellung', tags: ['museumstour', 'ausstellung'], setting: 'indoor' },
  { id: 6, label: 'Freizeit', tags: ['naturführung'], setting: null },
  { id: 7, label: 'Freizeit - Ausflugsziel', tags: ['naturführung'], setting: null },
  { id: 8, label: 'Freizeitanlage', tags: ['naturführung'], setting: null },
  { id: 9, label: 'Freizeiteinrichtung', tags: ['naturführung'], setting: null },
  { id: 10, label: 'Freizeiteinrichtung-Badesee', tags: ['schwimmen'], setting: 'outdoor' },
  { id: 11, label: 'Heiltherme & Styrian Spa', tags: ['thermen-special', 'wellness-day'], setting: 'indoor' },
  { id: 12, label: 'Kultur- und Freizeitverein', tags: ['theater'], setting: null },
  { id: 14, label: 'Sport für Menschen mit Behinderung', tags: ['wassersport'], setting: null },
  { id: 16, label: 'Stift', tags: ['burgführung', 'museumstour'], setting: 'mixed' },
  { id: 17, label: 'Weingut', tags: [], setting: null },
];

function refineTags(name: string, fallback: string[], setting: 'indoor' | 'outdoor' | 'mixed' | null): { tags: string[]; setting: 'indoor' | 'outdoor' | 'mixed' | null } {
  const n = name.toLowerCase();
  if (/therme|bad\b|hallenbad|freibad|strandbad|schwimm|badesee|see\b/.test(n)) return { tags: ['schwimmen'], setting: /hallen|therme/.test(n) ? 'indoor' : 'outdoor' };
  if (/museum|galerie|ausstellung|haus der|schloss|burg|stift/.test(n)) return { tags: /schloss|burg|stift/.test(n) ? ['burgführung', 'museumstour'] : ['museumstour', 'ausstellung'], setting: 'indoor' };
  if (/theater|bühne|oper|kino/.test(n)) return { tags: ['theater'], setting: 'indoor' };
  if (/weg\b|pfad|klamm|wandern|park\b|garten|gestüt|tierpark|wildpark|zoo/.test(n)) return { tags: /gestüt/.test(n) ? ['reiten', 'naturführung'] : ['wandern', 'naturführung'], setting: 'outdoor' };
  if (/bahn\b|lift|gondel|seilbahn/.test(n)) return { tags: ['bergtour'], setting: 'outdoor' };
  if (/baumwipfel|aussicht/.test(n)) return { tags: ['wandern'], setting: 'outdoor' };
  return { tags: fallback, setting };
}

async function postList(typeId: number): Promise<number[]> {
  const res = await fetch(`${BASE}/Eintrag.2305.html`, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ bsghsearch: '', bsghregion: '0', bsghtype: String(typeId), bsghbewertungen: '0', bsghlimit: '100' }).toString(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} Liste Typ ${typeId}`);
  const html = await res.text();
  return [...new Set([...html.matchAll(/bsghid=(\d+)/g)].map((m) => Number(m[1])))];
}

async function main(): Promise<void> {
  const byId = new Map<number, (typeof TYPES)[number]>();
  for (const t of TYPES) {
    const ids = await postList(t.id);
    for (const id of ids) if (!byId.has(id)) byId.set(id, t);
    console.log(`[bfu] ${t.label}: ${ids.length}`);
    await sleep(300);
  }
  console.log(`[bfu] ${byId.size} Betriebe`);

  const entries: DatasetEntry[] = [];
  for (const [id, type] of byId) {
    const url = `${BASE}/Eintrag.2305.html?bsghid=${id}`;
    let html: string;
    try {
      html = await fetchText(url);
    } catch (err) {
      console.log(`[bfu] ${url}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    await sleep(300);
    const $ = cheerio.load(html);

    // Tabelle "Label: | Wert" -> Map (mehrfache Labels wie "Türart" nur erstes)
    const fields = new Map<string, string>();
    $('tr').each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length < 2) return;
      const label = clean($(tds[0]).text())?.replace(/:$/, '');
      const value = clean($(tds[1]).text());
      if (label && value && !fields.has(label)) fields.set(label, value);
    });
    const name = clean($('h3.uk-h2').first().text());
    if (!name || fields.size === 0) {
      console.log(`[bfu] ${id}: keine Felder`);
      continue;
    }
    const yes = (label: string): boolean => /^ja$/i.test(fields.get(label) ?? '');
    const rating = Math.max(0, Number(fields.get('Rollstuhlbewertung') ?? '0') || 0);
    const features: AccessibilityFeature[] = [];
    if (rating >= 1 || yes('Zugang barrierefrei') || yes('Eingang barrierefrei')) features.push('rollstuhl');
    if (yes('WC barrierefrei') && features.length > 0) features.push('wc');
    if (yes('Behindertenparkplatz') || yes('Parkplatz barrierefrei') || yes('Parkplätze barrierefrei')) features.push('parkplatz');
    if (yes('Lift') || yes('Aufzug') || yes('Lift barrierefrei')) features.push('lift');
    if (features.length === 0) {
      console.log(`[bfu] ${name}: kein Befund (Bewertung ${rating})`);
      continue;
    }

    // Lat/Long sind auf der Seite vertauscht
    const a = parseFloat(fields.get('Google Maps Lat') ?? '');
    const b = parseFloat(fields.get('Google Maps Long') ?? '');
    let lat: number | null = null;
    let lng: number | null = null;
    if (Number.isFinite(a) && Number.isFinite(b)) {
      [lat, lng] = a > b ? [a, b] : [b, a];
      if (lat < 46 || lat > 49.1 || lng < 9.4 || lng > 17.3) {
        lat = null;
        lng = null;
      }
    }

    const facts: string[] = [];
    for (const label of ['Türlichte', 'WC Höhe', 'WC Anfahrbarkeit', 'Türart', 'Entfernung der nächsten Haltestelle']) {
      const v = fields.get(label);
      if (v && v !== '0') facts.push(`${label} ${v}`);
    }
    const checked = fields.get('Datum der Erhebung');
    const checkedIso = checked && /^(\d{2})\.(\d{2})\.(\d{4})$/.test(checked) ? checked.replace(/^(\d{2})\.(\d{2})\.(\d{4})$/, '$3-$2-$1') : null;
    const tester = fields.get('Name des Prüfers') ?? fields.get('Praxistest durchgeführt von');
    const homepage = fields.get('Homepage');
    // Kurztext steht direkt nach dem Titel (h3.uk-h2 -> PLZ Ort -> Text)
    // Kurztext ist loser Text zwischen "<strong>PLZ Ort</strong>" und der Tabelle
    const afterTitle = $('h3.uk-h2').first().parent().html() ?? '';
    const descMatch = /<\/strong>\s*<br\s*\/?>([\s\S]*?)<table/i.exec(afterTitle);
    const description = descMatch ? clean(cheerio.load(`<x>${descMatch[1]}</x>`)('x').text()) : null;

    const images: DatasetEntry['images'] = [];
    $('img[src*="/bsgh/business"]').each((_, img) => {
      const src = $(img).attr('src');
      if (!src || images.length >= 3) return;
      const u = src.startsWith('http') ? src : `${BASE}/${src.replace(/^\//, '')}`;
      if (!images.some((i) => i.url === u)) images.push({ url: u, credit: 'barrierefreierurlaub.at / Betrieb' });
    });

    const { tags, setting } = refineTags(name, type.tags, type.setting);
    entries.push({
      id: slugId(`${id}-${name}`),
      name,
      description: `${description ?? name}. Typ laut barrierefreierurlaub.at: ${type.label}.`,
      tags,
      setting,
      address: fields.get('Adresse') ?? null,
      postal_code: fields.get('Postleitzahl') ?? null,
      town: fields.get('Ort') ?? null,
      lat,
      lng,
      website: homepage ? (homepage.startsWith('http') ? homepage : `https://${homepage}`) : url,
      source_url: url,
      accessibility: {
        features,
        note: `Laut barrierefreierurlaub.at (Praxistest${tester ? ` durch ${tester}` : ''}${checked ? ` am ${checked}` : ''}): Rollstuhlbewertung ${rating} von 3${['Zugang barrierefrei', 'Eingang barrierefrei', 'WC barrierefrei']
          .filter((l) => fields.has(l))
          .map((l) => `; ${l}: ${fields.get(l) === '0' ? 'Nein' : fields.get(l)}`)
          .join('')}${facts.length ? `; ${facts.join(', ')}` : ''}.`,
      },
      images,
    });
    console.log(`[bfu] + ${name} (${fields.get('Ort') ?? '?'}): ${features.join(', ')}, Bewertung ${rating}${checkedIso ? `, ${checkedIso}` : ''}`);
  }

  writeDataset({
    source: SOURCE,
    source_label: 'Verein Barrierefreier Urlaub (barrierefreierurlaub.at)',
    source_url: `${BASE}/suche.2305.html`,
    checked_at: today(),
    entries: dedupeEntries(entries),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
