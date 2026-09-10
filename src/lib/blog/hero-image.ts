/**
 * Hero-Bilder für Blog-Posts — gemeinsame Logik für Autowriter (fn-19),
 * Saison-Autopilot und die Reparatur bestehender Posts (fn-24).
 *
 * Warum das hier zentral liegt: bis 2026-09 hat der Autowriter ein zu kleines
 * Veranstalter-Bild verworfen und stattdessen eine ungefilterte Volltextsuche
 * auf Wikimedia Commons über den Event-Titel gemacht. Ergebnis: 25 Posts mit
 * thematisch fremden Fotos — der Hero von "Science Busters for Kids" war das
 * Cover von "YANK The Army Weekly" vom 9. März 1945, weil dort "Burma Bridge
 * Busters" auf der Titelseite stand.
 *
 * Zwei Regeln folgen daraus:
 *
 *   1. Ein kleines RICHTIGES Bild schlägt ein großes fremdes. Eventim liefert
 *      222x222-Artworks, für die wir das Nutzungsrecht haben — die kommen auf
 *      die Seite, im Poster-Layout statt full-bleed.
 *
 *   2. Commons wird nur mit einer KURATIERTEN Suchanfrage befragt, nie mit
 *      einem Event-Titel, und ein Treffer muss das Thema im Dateinamen tragen.
 */

/** Ab dieser Breite trägt ein Motiv den full-bleed-Hero über 75vh. */
export const COVER_HERO_WIDTH = 900;

/** Untergrenze für "überhaupt ein Bild" — siebt Icons und Tracking-Pixel aus. */
export const MIN_HERO_WIDTH = 200;

export type HeroLayout = 'cover' | 'poster';

export interface DownloadedImage {
  ext: 'jpg' | 'png' | 'webp';
  buf: Buffer;
  width: number;
  height: number;
}

export interface HeroResult {
  heroImage: string;
  credit: string;
  layout: HeroLayout;
}

const UA = 'Mozilla/5.0 (compatible; LassTreffenBot/1.0; +https://lasstreffen.at)';

/** Bildbreite/-höhe aus JPEG-SOF- bzw. PNG-IHDR-Header (ohne Dependency). */
export function imageDims(buf: Buffer): { w: number; h: number } | null {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xc3) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

export function layoutFor(width: number): HeroLayout {
  return width >= COVER_HERO_WIDTH ? 'cover' : 'poster';
}

/** Bild laden und vermessen — schreibt noch nichts auf die Platte. */
export async function fetchImage(url: string): Promise<DownloadedImage | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.startsWith('image/')) return null;
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 4_000) return null;
    const dims = imageDims(buf);
    if (!dims || dims.w < MIN_HERO_WIDTH) return null;
    return { ext, buf, width: dims.w, height: dims.h };
  } catch {
    return null;
  }
}

/** Wörter, die als Treffer nichts beweisen: "Konzert" steht in jedem zweiten
 *  Commons-Dateinamen und würde das Relevanz-Gate aushebeln. */
const STOPWORDS = new Set([
  'der', 'die', 'das', 'und', 'oder', 'ein', 'eine', 'einer', 'des', 'dem', 'den',
  'von', 'vom', 'zum', 'zur', 'mit', 'fuer', 'für', 'the', 'and', 'live', 'tour',
  'show', 'konzert', 'concert', 'festival', 'open', 'air', 'gala', 'night',
  'oesterreich', 'österreich', 'austria',
]);

/**
 * Trägt der Commons-Dateiname wirklich das gesuchte Thema?
 *
 * Ohne diese Prüfung matcht die Volltextsuche auf irgendein Wort der Anfrage.
 * Ein Foto darf nur durch, wenn ein aussagekräftiges Token der Suchanfrage
 * auch im Dateinamen vorkommt.
 */
export function isRelevantCommonsFile(query: string, fileUrl: string): boolean {
  const tokens = query
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/i)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  if (tokens.length === 0) return false;
  let name: string;
  try {
    name = decodeURIComponent(fileUrl);
  } catch {
    name = fileUrl;
  }
  name = name.toLowerCase().replace(/[_-]+/g, ' ');
  return tokens.some((t) => name.includes(t));
}

export interface CommonsHit {
  url: string;
  credit: string;
  width: number;
}

/**
 * Wikimedia-Commons-Foto für eine KURATIERTE Suchanfrage (Saison-Hubs,
 * Stay-Guides: "Christkindlmarkt Wien Rathausplatz", "Graz Uhrturm").
 *
 * Ausdrücklich NICHT für Event-Titel gedacht: eine Volltextsuche über einen
 * Veranstaltungsnamen liefert Treffer, die aussehen wie ein Bild zum Thema,
 * aber keines sind. Event-Posts nehmen das Bild des Veranstalters oder keines.
 */
export async function findCommonsPhoto(
  query: string,
  opts: { minWidth?: number; onReject?: (url: string) => void } = {},
): Promise<CommonsHit | null> {
  const minWidth = opts.minWidth ?? 1200;
  const q = encodeURIComponent(query.replace(/\b(19|20)\d{2}\b/g, '').trim());
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json`
    + `&generator=search&gsrsearch=${q}&gsrnamespace=6&gsrlimit=12`
    + `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1800`;
  try {
    const res = await fetch(api, {
      headers: { 'User-Agent': 'LassTreffenBot/1.0 (https://lasstreffen.at)' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const json = await res.json() as {
      query?: {
        pages?: Record<string, {
          imageinfo?: Array<{
            thumburl?: string; url?: string; width?: number; height?: number;
            extmetadata?: Record<string, { value?: string }>;
          }>;
        }>;
      };
    };
    // Querformat zuerst — der Hero ist breit, Hochkant beschneidet Köpfe.
    const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => {
      const ratio = (p: typeof a) => {
        const i = p.imageinfo?.[0];
        return i?.width && i?.height ? i.width / i.height : 0;
      };
      return ratio(b) - ratio(a);
    });
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      const meta = info?.extmetadata ?? {};
      const license = meta.LicenseShortName?.value ?? '';
      const url = info?.thumburl ?? info?.url;
      const source = info?.url ?? url;
      if (!url || !source) continue;
      if (!/(^CC|Public domain)/i.test(license)) continue;
      if ((info?.width ?? 0) < minWidth) continue;
      if (!/\.(jpe?g|png)/i.test(source)) continue;
      if (!isRelevantCommonsFile(query, source)) {
        opts.onReject?.(source);
        continue;
      }
      const artist = (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim();
      return {
        url,
        width: info?.width ?? minWidth,
        credit: `Foto: ${artist || 'Wikimedia Commons'}, ${license}, Wikimedia Commons`,
      };
    }
    return null;
  } catch {
    return null;
  }
}
