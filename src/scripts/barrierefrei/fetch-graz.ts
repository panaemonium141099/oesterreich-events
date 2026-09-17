/**
 * Quelle: Graz Tourismus (graztourismus.at) — "Barrierefrei unterwegs in
 * Graz": Museen, Sehenswuerdigkeiten und Veranstaltungsorte (von
 * austria.info verlinkt). Erhoben von Graz Tourismus mit der
 * Behindertenselbsthilfegruppe Hartberg und Cedos/Capito.
 *
 *   npx tsx src/scripts/barrierefrei/fetch-graz.ts
 *   -> data/barrierefrei/graztourismus-at.json
 *
 * Listen (?page=N) -> Detailseiten. Dort steht der Block "Infos zur
 * Barrierefreiheit" mit festen Eignungs-Chips (.barrierfree-info__item:
 * "Personen im Rollstuhl", "blinde Personen", ...), dazu JSON-LD
 * TouristAttraction (Adresse, Bild mit Autor) und das PDF mit den
 * Messwerten. Aufgenommen wird nur, wer mindestens einen Chip jenseits
 * von "Familien mit Kleinkindern"/"Allergien" traegt.
 */

import * as cheerio from 'cheerio';
import type { DatasetEntry } from '@/lib/activities/barrierefrei-dataset';
import type { AccessibilityFeature } from '@/lib/activities/accessibility';
import { clean, dedupeEntries, fetchText, sleep, slugId, today, writeDataset } from './lib';

const BASE = 'https://www.graztourismus.at';
const SOURCE = 'graztourismus-at';
const LISTS = [
  `${BASE}/de/unterkuenfte-packages/barrierefrei-in-graz/barrierefreie-museen`,
  `${BASE}/de/unterkuenfte-packages/barrierefrei-in-graz/barrierefreie-veranstaltungsorte`,
];
// Auf der Sightseeing-Seite namentlich genannt, aber nicht in den Listen
const EXTRA = [
  `${BASE}/de/sightseeing-kultur/sehenswuerdigkeiten/uhrturm_shg_1488`,
  `${BASE}/de/sightseeing-kultur/sehenswuerdigkeiten/murinsel_shg_1470`,
  `${BASE}/de/sightseeing-kultur/sehenswuerdigkeiten/hauptplatz-rathaus_shg_1456`,
  `${BASE}/de/sightseeing-kultur/sehenswuerdigkeiten/landhaushof_shg_1466`,
  `${BASE}/de/sightseeing-kultur/sehenswuerdigkeiten/salon-stolz_shg_7385`,
];

/** Chip-Text -> Merkmal (null = kein eigenes Merkmal, nur Notiz). */
function featureOfChip(label: string): AccessibilityFeature | null {
  const l = label.toLowerCase();
  // "barrierefreier Betrieb" = erfuellt alle Mindestkriterien (Filterkategorie der Seite)
  if (/personen im rollstuhl|rollstuhlfahrer|barrierefreier betrieb/.test(l)) return 'rollstuhl';
  if (/blinde/.test(l)) return 'blind';
  if (/gehörlos|hörbehindert/.test(l)) return 'gehoerlos';
  if (/lernschwierigkeiten/.test(l)) return 'leichte-sprache';
  return null;
}

function tagsOf(categories: string[], name: string): { tags: string[]; setting: 'indoor' | 'outdoor' | 'mixed' | null } {
  const c = `${categories.join(' ')} ${name}`.toLowerCase();
  if (/theater|oper|spielstätte|schauspielhaus|bühne|next liberty|kasematten/.test(c)) return { tags: ['theater'], setting: 'indoor' };
  if (/list halle/.test(c)) return { tags: ['theater'], setting: 'indoor' };
  if (/bergbahn|seilbahn|schlossberglift|aussichtspunkt/.test(c)) return { tags: ['bergtour'], setting: 'outdoor' };
  if (/schloss|burg/.test(c)) return { tags: ['burgführung', 'museumstour'], setting: 'mixed' };
  if (/museum|galerie|ausstellung|halle für kunst|cosa|kabinett|bibliothek|prunkräume|salon stolz|kunsthaus|zeughaus|joanneumsviertel/.test(c)) return { tags: ['museumstour', 'ausstellung'], setting: 'indoor' };
  if (/park|garten|insel|platz|hof/.test(c)) return { tags: ['wandern'], setting: 'outdoor' };
  return { tags: ['museumstour'], setting: null };
}

async function listDetailUrls(): Promise<string[]> {
  const urls = new Set<string>(EXTRA);
  for (const list of LISTS) {
    for (let page = 1; page <= 10; page++) {
      const html = await fetchText(page === 1 ? list : `${list}?page=${page}`);
      const $ = cheerio.load(html);
      let found = 0;
      $('a[href*="/sehenswuerdigkeiten/"]').each((_, a) => {
        const href = $(a).attr('href');
        if (!href || !/_shg_\d+$/.test(href)) return;
        urls.add(href.startsWith('http') ? href : `${BASE}${href}`);
        found++;
      });
      const total = /Seite\s+\d+\s+von\s+(\d+)/.exec($('.pagination').text());
      console.log(`[graz] ${list.split('/').pop()} Seite ${page}: ${found} Links`);
      if (!total || page >= Number(total[1]) || found === 0) break;
      await sleep(300);
    }
  }
  return [...urls];
}

interface LdAttraction {
  '@type'?: string;
  name?: string;
  description?: string;
  address?: { streetAddress?: string; postalCode?: string; addressLocality?: string };
  image?: { author?: string; contentUrl?: string; url?: string } | { author?: string; contentUrl?: string; url?: string }[];
  geo?: { latitude?: number | string; longitude?: number | string };
}

function readAttraction($: cheerio.CheerioAPI): LdAttraction | null {
  let out: LdAttraction | null = null;
  $('script[type="application/ld+json"]').each((_, s) => {
    if (out) return;
    try {
      const parsed = JSON.parse($(s).text()) as LdAttraction | LdAttraction[];
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const hit = list.find((p) => p && p['@type'] === 'TouristAttraction');
      if (hit) out = hit;
    } catch {
      /* kein JSON */
    }
  });
  return out;
}

async function main(): Promise<void> {
  const urls = await listDetailUrls();
  console.log(`[graz] ${urls.length} Detailseiten`);
  const entries: DatasetEntry[] = [];

  for (const url of urls) {
    let html: string;
    try {
      html = await fetchText(url);
    } catch (err) {
      console.log(`[graz] ${url}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    await sleep(300);
    const $ = cheerio.load(html);
    const name = clean($('h1').first().text());
    if (!name) continue;

    const chips: string[] = [];
    $('.barrierfree-info__item').each((_, el) => {
      const label = clean($(el).text().replace(/\bi\b\s*$/, ''));
      if (label) chips.push(label.replace(/\s+i$/, ''));
    });
    const features = new Set<AccessibilityFeature>();
    for (const chip of chips) {
      const f = featureOfChip(chip);
      if (f) features.add(f);
    }
    if (features.size === 0) {
      console.log(`[graz] ${name}: keine relevanten Chips (${chips.join(', ') || 'keine'})`);
      continue;
    }

    const ld = readAttraction($);
    const addr = ld?.address;
    const img = Array.isArray(ld?.image) ? ld?.image[0] : ld?.image;
    const imgUrl = img?.contentUrl ?? img?.url ?? $('meta[property="og:image"]').attr('content') ?? null;
    const pdf = $('a[href*="Barrierefrei/PDFs"]').first().attr('href') ?? null;
    const categories: string[] = [];
    $('.tag, .category, .img-teaser__category, .detail-header__categories').each((_, el) => {
      const t = clean($(el).text());
      if (t) categories.push(t);
    });
    // Kategorien stehen auf der Listenseite ("Museum | Sehenswürdigkeit"); auf
    // der Detailseite genuegt der Name + Breadcrumb.
    const { tags, setting } = tagsOf(categories, name);

    // Beschreibung: Einleitung im Hero (.hero__wysiwyg), sonst erste Absaetze
    // im Inhalt; die Buchungs-Modals mit ihren Aktions-Texten liegen ausserhalb.
    const paras: string[] = [];
    const sub = clean($('.hero__sub-title').first().text());
    $('.hero__wysiwyg p, main .content-block .wysiwyg p').each((_, p) => {
      if (paras.join(' ').length > 500) return;
      const t = clean($(p).text());
      if (!t || t.length < 60) return;
      if (/öffnungszeiten|eintritt|preise|\buhr\b|cookie|newsletter|graz card|nächte/i.test(t)) return;
      paras.push(t);
    });
    if (paras.length === 0 && sub) paras.push(sub);
    const description = paras.length > 0 ? paras.join(' ').slice(0, 900) : clean($('meta[name="description"]').attr('content'));

    const chipNote = chips.filter((c) => !/kleinkindern|allergie/i.test(c));
    entries.push({
      id: slugId(url.split('/').pop() ?? name),
      name,
      description: `${description ?? name}`,
      tags,
      setting,
      address: clean(addr?.streetAddress) ?? null,
      postal_code: clean(addr?.postalCode) ?? null,
      town: clean(addr?.addressLocality) ?? 'Graz',
      lat: ld?.geo?.latitude != null ? Number(ld.geo.latitude) : null,
      lng: ld?.geo?.longitude != null ? Number(ld.geo.longitude) : null,
      website: url,
      source_url: url,
      accessibility: {
        features: [...features],
        note: `Laut Graz Tourismus geeignet für: ${chipNote.join(', ')}.${pdf ? ` Messwerte im Barrierefrei-Datenblatt: ${pdf.startsWith('http') ? pdf : `${BASE}${pdf}`}` : ''}`,
      },
      images: imgUrl ? [{ url: imgUrl, credit: clean(img?.author) ?? 'Graz Tourismus' }] : [],
    });
    console.log(`[graz] + ${name} (${[...features].join(', ')})`);
  }

  // Auf der Sightseeing-Seite beschrieben, aber ohne Chip-Block auf der Detailseite
  const SIGHTSEEING = `${BASE}/de/unterkuenfte-packages/barrierefrei-in-graz/sightseeing-barrierefrei`;
  entries.push(
    {
      id: 'murinsel',
      name: 'Murinsel Graz',
      description: 'Schwimmende Plattform in der Mur nach einem Entwurf von Vito Acconci (Kulturhauptstadt 2003) mit Café und Amphitheater, über Stege mit beiden Ufern verbunden.',
      tags: ['wandern'],
      setting: 'outdoor',
      address: 'Lendkai 19',
      postal_code: '8020',
      town: 'Graz',
      website: `${BASE}/de/sightseeing-kultur/sehenswuerdigkeiten/murinsel_shg_1470`,
      source_url: SIGHTSEEING,
      accessibility: {
        features: ['rollstuhl', 'lift'],
        note: 'Laut Graz Tourismus mit dem Rollstuhl befahrbar: vom rechten Murufer über eine asphaltierte Rampe (6 bis 10 % Steigung), vom linken Murufer über Rampe und Lift.',
      },
      images: [],
    },
    {
      id: 'uhrturm',
      name: 'Grazer Uhrturm',
      description: 'Wahrzeichen von Graz auf dem Schlossberg, mit Schlossbergbahn oder Schlossberglift barrierefrei erreichbar. Vor dem Uhrturm steht ein dreidimensional ertastbares Bronze-Miniaturmodell für blinde und sehbehinderte Gäste.',
      tags: ['wandern'],
      setting: 'outdoor',
      address: 'Schlossberg 6',
      postal_code: '8010',
      town: 'Graz',
      website: `${BASE}/de/sightseeing-kultur/sehenswuerdigkeiten/uhrturm_shg_1488`,
      source_url: SIGHTSEEING,
      accessibility: {
        features: ['rollstuhl', 'blind'],
        note: 'Laut Graz Tourismus: Schlossbergbahn und Schlossberglift für Personen mit körperlichen Beeinträchtigungen nutzbar (Euro-Key-Besitzer fahren im Lift gratis); Tastmodell aus Bronze direkt vor dem Uhrturm.',
      },
      images: [],
    },
  );

  writeDataset({
    source: SOURCE,
    source_label: 'Graz Tourismus (graztourismus.at)',
    source_url: `${BASE}/de/unterkuenfte-packages/barrierefrei-in-graz`,
    checked_at: today(),
    entries: dedupeEntries(entries),
  });
  console.log(`[graz] ${entries.length} Eintraege geschrieben`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
