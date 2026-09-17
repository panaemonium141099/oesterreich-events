/**
 * Bild-Fallback ueber Wikimedia Commons fuer kuratierte Barrierefrei-
 * Eintraege ohne Quellbild (import-barrierefrei.ts --wikimedia).
 *
 * Commons-Suche (API, kein Scraping) im Datei-Namensraum; genommen wird
 * das erste Foto (JPEG/PNG, kein Logo/Karte/Wappen/SVG), das eine freie
 * Lizenz traegt. Attribution kommt aus den extmetadata (Artist,
 * LicenseShortName) und landet im images-jsonb als copyright/author/
 * license — die Detailseite und die Karten zeigen sie an.
 *
 * Trefferqualitaet ist Heuristik: ein Bild namens "Burgruine Aggstein 2019"
 * fuer den Eintrag "Burgruine Aggstein" ist verlaesslich, ein Bild fuer
 * "Freibad" + Ort weniger. Deshalb muss der Dateiname mindestens ein
 * Namens-Token (>= 3 Zeichen, keine Fuellwoerter) des Eintrags enthalten.
 */

import type { DatasetImage } from './barrierefrei-dataset';

const API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'lasstreffen.at (https://lasstreffen.at/quellen; Barrierefrei-Bildsuche)';

interface CommonsPage {
  title?: string;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
}

const REJECT_TITLE_RE = /logo|wappen|coat[_ ]of[_ ]arms|karte|\bmap\b|flag|icon|piktogramm|plan\b|grundriss|plakat|werbung|poster|flyer|prospekt|ticket|eintrittskarte|screenshot|\.svg$/i;
const FREE_LICENSE_RE = /^(cc[- ]by|cc[- ]by[- ]sa|cc0|public domain|pd|gfdl|attribution)/i;

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

const STOP_TOKENS = new Set(['der', 'die', 'das', 'und', 'von', 'vom', 'zum', 'zur', 'den', 'dem', 'des', 'mit', 'bei', 'auf', 'fur', 'aus', 'ein', 'ins', 'the', 'and']);

export function nameTokens(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP_TOKENS.has(t));
}

/**
 * Gattungswoerter und Ortsnamen tragen nichts zur Identifikation bei:
 * "Wien Museum" darf nicht auf "Oberes Belvedere Wien" matchen,
 * "Pfänderbahn Bregenz" nicht auf "Hafenmole Bregenz".
 */
const GENERIC_TOKENS = new Set([
  'museum', 'museen', 'haus', 'bahn', 'bergbahn', 'bergbahnen', 'seilbahn', 'seilbahnen', 'lift', 'therme', 'freibad',
  'hallenbad', 'strandbad', 'wanderweg', 'rundweg', 'pfad', 'lehrpfad', 'themenweg', 'park', 'tierpark', 'wildpark',
  'garten', 'schloss', 'burg', 'stift', 'kirche', 'dom', 'kapelle', 'galerie', 'kunst', 'kunsthaus', 'theater', 'oper', 'kino',
  'zentrum', 'center', 'welt', 'erlebnis', 'erlebniswelt', 'freizeit', 'kultur', 'natur', 'stadt', 'stadtmuseum',
  'heimatmuseum', 'ausstellung', 'infostelle', 'besucherzentrum', 'nationalpark', 'wellness', 'sport', 'sportpark',
  'halle', 'arena', 'hotel', 'chalet', 'resort', 'alm', 'berg', 'see', 'tal', 'bad', 'stadtrunde', 'runde', 'weg',
  'wien', 'graz', 'linz', 'salzburg', 'innsbruck', 'bregenz', 'klagenfurt', 'villach', 'tirol', 'steiermark',
  'kaernten', 'karnten', 'vorarlberg', 'burgenland', 'niederoesterreich', 'niederosterreich', 'oberoesterreich',
  'oberosterreich', 'oesterreich', 'osterreich', 'austria', 'sankt',
]);

function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss');
}

/**
 * Passt der Dateiname zum Eintrag? Unterscheidungskraeftige Tokens
 * (weder Gattungswort noch Ortsname) muessen vorkommen; ein einzelnes
 * kurzes Token reicht nur zusammen mit dem Ortsnamen oder dem vollen
 * Namen. Ohne unterscheidungskraeftige Tokens muessen alle Nicht-Orts-
 * Tokens vorkommen ("Dom Museum Wien" -> "Dommuseum").
 */
export function titleMatchesName(title: string, name: string, town: string | null): boolean {
  const norm = normalizeTitle(title);
  const tokens = nameTokens(name);
  if (tokens.length === 0) return false;
  const townTokens = new Set(nameTokens(town ?? ''));
  const distinctive = tokens.filter((t) => !GENERIC_TOKENS.has(t) && !townTokens.has(t));
  if (distinctive.length > 0) {
    const hits = distinctive.filter((t) => norm.includes(t));
    if (hits.length === 0) return false;
    if (hits.length >= 2) return true;
    if (hits[0].length >= 8) return true;
    if ([...townTokens].some((t) => norm.includes(t))) return true;
    const full = normalizeTitle(name).replace(/[^a-z0-9]+/g, ' ').trim();
    return norm.replace(/[^a-z0-9]+/g, ' ').includes(full);
  }
  // Nur Gattungs-/Ortswoerter: die Tokens muessen als Folge im Titel stehen
  // ("Dom Museum Wien" -> "Dommuseum", "Wien Museum" -> "Wien_Museum_Karlsplatz",
  // aber nicht "Naturhistorisches Museum Wien").
  const squashed = norm.replace(/[^a-z0-9]+/g, '');
  const rest = tokens.filter((t) => !townTokens.has(t));
  const need = rest.length >= 2 ? rest : tokens;
  return squashed.includes(need.join(''));
}

/** Reine Auswahl: erstes brauchbares Foto aus den Commons-Seiten. */
export function pickWikimediaCandidate(pages: CommonsPage[], name: string, town: string | null = null): DatasetImage | null {
  for (const page of pages) {
    const title = page.title ?? '';
    if (REJECT_TITLE_RE.test(title)) continue;
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const mime = info.mime ?? '';
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) continue;
    if (!titleMatchesName(title, name, town)) continue;
    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value ?? '');
    if (!license || !FREE_LICENSE_RE.test(license)) continue;
    const artist = stripHtml(meta.Artist?.value ?? '') || null;
    const url = info.thumburl ?? info.url;
    if (!url) continue;
    return {
      url,
      credit: `Wikimedia Commons, ${license}`,
      license,
      author: artist,
    };
  }
  return null;
}

export async function findWikimediaImage(name: string, town: string | null): Promise<DatasetImage | null> {
  const queries = [town ? `${name} ${town}` : name, name];
  for (const q of [...new Set(queries)]) {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: q,
      gsrnamespace: '6',
      gsrlimit: '8',
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
      iiurlwidth: '1200',
      iiextmetadatafilter: 'LicenseShortName|Artist',
      format: 'json',
      origin: '*',
    });
    try {
      const res = await fetch(`${API}?${params.toString()}`, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) continue;
      const json = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } };
      const pages = Object.values(json.query?.pages ?? {});
      const pick = pickWikimediaCandidate(pages, name, town);
      if (pick) return pick;
    } catch {
      // Netzfehler: naechste Anfrage / kein Bild
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}
