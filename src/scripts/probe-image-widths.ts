/**
 * SEO-Bilder-Fix (2026-09-01) — misst die echte Pixel-Breite der
 * gescrapten Event-Bilder und schreibt sie nach events.image_width.
 *
 *   npx tsx src/scripts/probe-image-widths.ts                # kompletter Backlog (future events)
 *   npx tsx src/scripts/probe-image-widths.ts --limit 2000   # gedeckelt (Pipeline-Modus)
 *
 * Warum: Google zeigt mit max-image-preview:large große SERP-Thumbnails
 * aus dem Seiten-/Schema-Bild — 222px-Scraper-Thumbnails wirken dort
 * hochskaliert verpixelt. Der Bild-Resolver (resolveEventImage.ts) ersetzt
 * Bilder < 600px durch die großen Kategorie-Fallbacks; dafür braucht er
 * die Breite. Gemessen wird sparsam: Range-Request auf die ersten 64 KB,
 * Header-Parsing für JPEG/PNG/GIF/WebP. Probe-Fehler → image_width = -1
 * (Resolver behandelt das als "unbekannt" und behält das Original).
 *
 * Backlog-Definition (siehe Partial-Index events_image_probe_backlog_idx):
 * future events mit image_url, deren image_probed_url fehlt oder von der
 * aktuellen image_url abweicht (Scraper hat das Bild getauscht).
 */

import { createClient } from '@supabase/supabase-js';

const CONCURRENCY = 12;
const FETCH_TIMEOUT_MS = 10_000;
const RANGE_BYTES = 65_535;

interface Row {
  id: string;
  image_url: string;
}

/** Bildbreite aus den ersten Bytes (JPEG SOF / PNG IHDR / GIF / WebP VP8*). */
export function imageWidthOf(buf: Buffer): number | null {
  if (buf.length < 12) return null;
  // PNG: 8-Byte-Signatur, IHDR-Breite bei Offset 16
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf.length >= 24) {
    return buf.readUInt32BE(16);
  }
  // GIF: "GIF8", Breite little-endian bei Offset 6
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf.length >= 10) {
    return buf.readUInt16LE(6);
  }
  // WebP: RIFF....WEBP + VP8/VP8L/VP8X-Chunk
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const fourcc = buf.toString('ascii', 12, 16);
    if (fourcc === 'VP8X') return 1 + (buf.readUIntLE(24, 3));
    if (fourcc === 'VP8L') return 1 + ((buf.readUInt32LE(21) & 0x3fff));
    if (fourcc === 'VP8 ') return buf.readUInt16LE(26) & 0x3fff;
    return null;
  }
  // JPEG: Marker-Scan bis SOF0/1/2 (0xC0/0xC1/0xC2)
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { off += 2; continue; }
      const len = buf.readUInt16BE(off + 2);
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return buf.readUInt16BE(off + 7);
      }
      off += 2 + len;
    }
  }
  return null;
}

/**
 * Rueckgabewerte und ihre Bedeutung in events.image_width:
 *
 *    > 0   gemessene Breite in Pixeln
 *   IMAGE_DEAD (0)      geprueft und dauerhaft nicht abrufbar (404/403/410)
 *                       -> resolvePrimaryEventImage() nimmt den Fallback
 *   IMAGE_UNKNOWN (-1)  nicht messbar (Timeout, Netzfehler, unbekanntes
 *                       Format) -> Original bleibt, naechster Lauf misst neu
 *
 * Vorher landeten beide Faelle auf -1. Der Resolver wertet -1 als "noch nicht
 * vermessen" und behielt das Original — eine nachweislich tote URL wurde
 * dadurch weiter als <img> ausgeliefert und blieb im Layout als kaputtes Bild
 * stehen (beobachtet 03.09.2026 an einem eventfinder.at-Bild).
 */
export const IMAGE_DEAD = 0;
export const IMAGE_UNKNOWN = -1;

/** HTTP-Codes, die eine URL dauerhaft als tot ausweisen. */
const DEAD_STATUSES = new Set([400, 401, 403, 404, 410, 451]);

async function probe(url: string): Promise<number> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        Range: `bytes=0-${RANGE_BYTES}`,
        'User-Agent': 'OesterreichEventsBot/1.0 (+https://lasstreffen.at; image-probe)',
      },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    clearTimeout(t);
    if (!res.ok && res.status !== 206) {
      // 5xx und Rate-Limits sind voruebergehend — die bleiben "unbekannt",
      // damit ein wackeliger Fremdserver keine funktionierenden Bilder
      // aussortiert. Nur die eindeutigen Dauerfehler zaehlen als tot.
      return DEAD_STATUSES.has(res.status) ? IMAGE_DEAD : IMAGE_UNKNOWN;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const w = imageWidthOf(buf);
    // smallint-Grenze: alles >= 32k Pixel clampen (praktisch nie)
    return w == null ? IMAGE_UNKNOWN : Math.min(w, 32_000);
  } catch {
    // Timeout / DNS / TLS — nicht entscheidbar, also erneut versuchen lassen.
    return IMAGE_UNKNOWN;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 2000 : Infinity;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY erforderlich');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let probed = 0;
  let small = 0;
  let failed = 0;

  // Seitenweise durch den Backlog (nutzt den Partial-Index)
  for (;;) {
    if (probed >= limit) break;
    const pageSize = Math.min(500, limit - probed);
    // Backlog = unvermessen (image_probed_url NULL). Bildwechsel setzt den
    // Trigger trg_reset_image_probe auf NULL zurueck — landet also wieder hier.
    const { data, error } = await supabase
      .from('events')
      .select('id, image_url')
      .not('image_url', 'is', null)
      .is('image_probed_url', null)
      .gte('start_date', new Date().toISOString())
      .limit(pageSize);
    if (error) throw new Error(`Backlog-Query: ${error.message}`);
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) break;

    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const chunk = rows.slice(i, i + CONCURRENCY);
      const widths = await Promise.all(chunk.map((r) => probe(r.image_url)));
      const updates = chunk.map((r, j) => ({ id: r.id, width: widths[j] }));
      for (const u of updates) {
        const { error: uerr } = await supabase
          .from('events')
          .update({ image_width: u.width, image_probed_url: chunk.find(c => c.id === u.id)!.image_url })
          .eq('id', u.id);
        if (uerr) throw new Error(`Update ${u.id}: ${uerr.message}`);
        probed++;
        if (u.width > 0 && u.width < 600) small++;
        if (u.width === -1) failed++;
      }
    }
    console.log(`[image-probe] ${probed} vermessen (${small} < 600px, ${failed} Fehler)…`);
  }

  console.log(`[image-probe] FERTIG: ${probed} vermessen, ${small} zu klein (<600px), ${failed} nicht messbar`);
}

// Nur ausführen wenn direkt aufgerufen (imageWidthOf ist testbar exportiert)
const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('probe-image-widths.ts');
if (isMain) {
  main().catch((e) => {
    console.error('[image-probe] FATAL:', e);
    process.exit(1);
  });
}
