/**
 * og:image einer Festival-Website lesen und als Hero-Bild prüfen.
 *
 * Genutzt vom Import der kuratierten Festivals (import-upcoming-festivals.ts
 * --fetch-images): Einträge ohne belegte Bild-URL bekommen das Sujet der
 * offiziellen Website, sofern es eine echte, ausreichend breite Bilddatei
 * ist. Kein Raten von CMS-Pfaden; was die Seite nicht ausweist, bleibt leer
 * und fällt im Frontend auf das Kategorie-Bild zurück.
 */
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (compatible; LassTreffenBot/1.0; +https://lasstreffen.at)';
const FETCH_TIMEOUT_MS = 12_000;
/** Unter dieser Breite taugt ein Bild nicht als Hero (Icons, Logos, Favicons). */
export const MIN_HERO_WIDTH = 600;

/** Erster brauchbarer Bildverweis aus og:image, twitter:image oder JSON-LD. */
export function extractOgImage(html: string, baseUrl: string): string | null {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    return null;
  }
  const candidates: string[] = [];
  const push = (v: string | undefined) => { if (v && v.trim()) candidates.push(v.trim()); };
  push($('meta[property="og:image:secure_url"]').attr('content'));
  push($('meta[property="og:image"]').attr('content'));
  push($('meta[name="og:image"]').attr('content'));
  push($('meta[name="twitter:image"]').attr('content'));
  push($('meta[property="twitter:image"]').attr('content'));
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text()) as unknown;
      const stack: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== 'object') continue;
        const obj = node as Record<string, unknown>;
        if (Array.isArray(obj['@graph'])) stack.push(...(obj['@graph'] as unknown[]));
        const img = obj.image;
        if (typeof img === 'string') push(img);
        else if (Array.isArray(img) && typeof img[0] === 'string') push(img[0]);
        else if (img && typeof img === 'object' && typeof (img as { url?: unknown }).url === 'string') push((img as { url: string }).url);
      }
    } catch {
      /* kaputtes JSON-LD ignorieren */
    }
  });
  for (const c of candidates) {
    try {
      const abs = new URL(c, baseUrl);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') continue;
      // Platzhalter-Sujets und Logos sind kein Hero.
      if (/logo|favicon|placeholder|default|blank|spacer/i.test(abs.pathname)) continue;
      return abs.toString();
    } catch {
      /* ungültige URL */
    }
  }
  return null;
}

/** Bildbreite/-höhe aus JPEG-SOF-, PNG-IHDR- oder WebP-VP8-Header. */
export function imageDims(buf: Buffer): { w: number; h: number } | null {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') {
      return { w: (buf.readUIntLE(24, 3)) + 1, h: (buf.readUIntLE(27, 3)) + 1 };
    }
  }
  return null;
}

export interface ImageProbe {
  ok: boolean;
  status: number;
  contentType: string | null;
  width: number | null;
  reason?: string;
}

/** Lädt das Bild und prüft Typ und Breite. Wirft nie. */
export async function probeImage(url: string): Promise<ImageProbe> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const contentType = res.headers.get('content-type');
    if (!res.ok) return { ok: false, status: res.status, contentType, width: null, reason: `HTTP ${res.status}` };
    if (!contentType || !contentType.startsWith('image/')) {
      return { ok: false, status: res.status, contentType, width: null, reason: `kein Bild (${contentType ?? 'ohne content-type'})` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 4_000) return { ok: false, status: res.status, contentType, width: null, reason: 'Datei zu klein' };
    const dims = imageDims(buf);
    if (dims && dims.w < MIN_HERO_WIDTH) {
      return { ok: false, status: res.status, contentType, width: dims.w, reason: `nur ${dims.w}px breit` };
    }
    // SVG/AVIF u. ä. ohne lesbaren Header: Typ reicht, Breite unbekannt.
    return { ok: true, status: res.status, contentType, width: dims?.w ?? null };
  } catch (err) {
    return { ok: false, status: 0, contentType: null, width: null, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Website laden und das og:image ermitteln. Wirft nie; null bei Fehlschlag. */
export async function fetchOgImage(websiteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(websiteUrl, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html')) return null;
    const html = await res.text();
    return extractOgImage(html, res.url || websiteUrl);
  } catch {
    return null;
  }
}
