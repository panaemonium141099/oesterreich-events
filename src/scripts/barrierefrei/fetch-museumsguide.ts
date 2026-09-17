/**
 * Quelle: Museums Guide inklusiv (museumsguide.net) — Verzeichnis
 * barrierefreier Museen, von austria.info/planung/barrierefreier-urlaub
 * verlinkt ("Kunst und Kultur ohne Hindernisse").
 *
 *   npx tsx src/scripts/barrierefrei/fetch-museumsguide.ts
 *   -> data/barrierefrei/museumsguide-net.json
 *
 * WordPress-REST-API (kein Scraping): /wp-json/wp/v2/museum mit den
 * Taxonomien accessibility (16 Merkmale wie "Barrierefreier Eingang",
 * "Barrierefreie WCs", "für Menschen mit Sehbehinderung") und region.
 * Eintraege der Region "Ausland" werden ausgelassen. Beschreibung ist
 * eine Faktenliste aus den Merkmalen und den drei Barrierefrei-Textfeldern
 * (Eingang/Gebaeude, Vermittlung, Fuehrungen); der Kurztext des Museums
 * wird nicht uebernommen. Bild: erstes Galeriebild mit Credit aus dem
 * Bildtitel ("Albertina © Harald Eisenberger").
 */

import type { DatasetEntry } from '@/lib/activities/barrierefrei-dataset';
import type { AccessibilityFeature } from '@/lib/activities/accessibility';
import { clean, dedupeEntries, fetchJson, sleep, slugId, today, writeDataset } from './lib';

const API = 'https://museumsguide.net/wp-json/wp/v2';
const SOURCE = 'museumsguide-net';
const REGION_AUSLAND = 54;

interface Term {
  id: number;
  name: string;
}

interface Museum {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  accessibility: number[];
  region: number[];
  place?: string;
  zip?: string;
  street?: string;
  website?: string;
  accessibility_1?: string;
  accessibility_2?: string;
  accessibility_3?: string;
  gallery?: Array<{ guid?: string; post_title?: string; post_excerpt?: string }> | false;
  opening_hours?: string[] | false;
  price_regular?: string[] | false;
}

/** Taxonomie-Term -> unser Merkmal (null = nur informativ). */
function featureOfTerm(name: string): AccessibilityFeature | null {
  const n = name.toLowerCase();
  if (n.startsWith('barrierefreier eingang')) return 'rollstuhl';
  if (n.startsWith('barrierefreie wcs')) return 'wc';
  if (n.startsWith('verleih von rollator')) return 'leihrollstuhl';
  if (n.includes('sehbehinderung')) return 'blind';
  if (n.includes('hörbehinderung') || n.includes('ögs')) return 'gehoerlos';
  if (n.startsWith('induktive höranlage')) return 'gehoerlos';
  if (n.includes('leichter oder einfacher sprache')) return 'leichte-sprache';
  if (n.startsWith('begleithunde')) return 'assistenzhund';
  if (n.startsWith('taktile orientierungshilfen')) return 'blind';
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;|&#8222;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** "<b>Eingang:</b> über Lift ...\r\n\r\n<b>Im Gebäude:</b> ..." -> Zeilen. */
function factsFromHtml(html: string | undefined): string[] {
  if (!html) return [];
  return html
    .split(/\r?\n/)
    .map((l) => clean(decodeEntities(l.replace(/<[^>]+>/g, ''))))
    .filter((l): l is string => Boolean(l))
    .filter((l) => !/:\s*(nein|nicht vorhanden|keine?)$/i.test(l));
}

function creditFromTitle(title: string | undefined, museum: string): string | null {
  if (!title) return null;
  const t = decodeEntities(title);
  const m = /(?:©|\(c\)|copyright|foto:?)\s*(.+)$/i.exec(t);
  if (m) return clean(m[1]);
  // Kein Copyright-Zeichen: Titel ohne Museumsnamen als Credit, sonst Museum.
  const rest = clean(t.replace(museum, ''));
  return rest && rest.length > 2 && !/\.(jpe?g|png|webp)$/i.test(rest) ? rest : museum;
}

async function main(): Promise<void> {
  const terms = await fetchJson<Term[]>(`${API}/accessibility?per_page=100`);
  const termName = new Map(terms.map((t) => [t.id, t.name]));

  const museums: Museum[] = [];
  for (let page = 1; ; page++) {
    const batch = await fetchJson<Museum[]>(`${API}/museum?per_page=100&page=${page}`);
    museums.push(...batch);
    if (batch.length < 100) break;
    await sleep(300);
  }
  console.log(`[museumsguide] ${museums.length} Museen aus der API`);

  const entries: DatasetEntry[] = [];
  for (const m of museums) {
    if (m.region.includes(REGION_AUSLAND)) continue;
    const name = clean(decodeEntities(m.title.rendered));
    if (!name) continue;
    const termNames = m.accessibility.map((id) => termName.get(id)).filter((n): n is string => Boolean(n));
    const features = [...new Set(termNames.map(featureOfTerm).filter((f): f is AccessibilityFeature => f !== null))];
    // Ohne strukturiertes Barrierefrei-Merkmal (nur "Ermäßigter Eintritt"/
    // "Kulturpass") ist das Museum hier nicht als barrierefrei belegt.
    if (features.length === 0) continue;

    const facts = [...factsFromHtml(m.accessibility_1), ...factsFromHtml(m.accessibility_2), ...factsFromHtml(m.accessibility_3)];
    const gallery = Array.isArray(m.gallery) ? m.gallery : [];
    const img = gallery.find((g) => g.guid && /\.(jpe?g|png|webp)$/i.test(g.guid));
    const opening = Array.isArray(m.opening_hours) ? m.opening_hours.map((o) => clean(o)).filter(Boolean).join('; ') : null;
    const price = Array.isArray(m.price_regular) ? m.price_regular.map((p) => clean(p)).filter(Boolean).join('; ') : null;
    const website = clean(m.website);
    const place = clean(m.place);

    const description =
      `${name}${place ? ` in ${place}` : ''}: im Museums Guide inklusiv als barrierefreies Museum gelistet. ` +
      `Merkmale laut Verzeichnis: ${termNames.filter((t) => !/ermäßigter eintritt|kulturpass/i.test(t)).join(', ')}.` +
      (facts.length > 0 ? ` ${facts.join(' ')}` : '');

    entries.push({
      id: slugId(m.slug),
      name,
      description,
      tags: ['museumstour', 'ausstellung'],
      setting: 'indoor',
      address: clean(m.street),
      postal_code: clean(m.zip),
      town: place,
      website: website ? (website.startsWith('http') ? website : `https://${website}`) : null,
      source_url: m.link,
      accessibility: {
        features,
        note: facts.length > 0 ? facts.join(' ') : `Laut Museums Guide inklusiv: ${termNames.join(', ')}.`,
      },
      images: img?.guid ? [{ url: img.guid.replace(/^http:/, 'https:'), credit: creditFromTitle(img.post_title, name) }] : [],
      price_hint: price || null,
      opening_hint: opening || null,
    });
  }

  writeDataset({
    source: SOURCE,
    source_label: 'Museums Guide inklusiv (museumsguide.net)',
    source_url: 'https://museumsguide.net/museen/',
    checked_at: today(),
    entries: dedupeEntries(entries),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
