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
 * Namens-Token (>= 4 Zeichen) des Eintrags enthalten.
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

const REJECT_TITLE_RE = /logo|wappen|coat[_ ]of[_ ]arms|karte|\bmap\b|flag|icon|piktogramm|plan\b|grundriss|\.svg$/i;
const FREE_LICENSE_RE = /^(cc[- ]by|cc[- ]by[- ]sa|cc0|public domain|pd|gfdl|attribution)/i;

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export function nameTokens(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
}

/** Reine Auswahl: erstes brauchbares Foto aus den Commons-Seiten. */
export function pickWikimediaCandidate(pages: CommonsPage[], name: string): DatasetImage | null {
  const tokens = nameTokens(name);
  for (const page of pages) {
    const title = page.title ?? '';
    if (REJECT_TITLE_RE.test(title)) continue;
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const mime = info.mime ?? '';
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) continue;
    const norm = title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/ß/g, 'ss');
    if (tokens.length > 0 && !tokens.some((t) => norm.includes(t))) continue;
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
      const pick = pickWikimediaCandidate(pages, name);
      if (pick) return pick;
    } catch {
      // Netzfehler: naechste Anfrage / kein Bild
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}
