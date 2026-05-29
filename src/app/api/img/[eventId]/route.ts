/**
 * GET /api/img/[eventId]?w=320&h=240
 *
 * Server-side image proxy + resizer for use in transactional emails.
 *
 * Why this exists:
 *   - The original lifecycle email referenced events' raw image_url
 *     (e.g. https://resc.deskline.net/.../Pavel_Shalman.png — 810 KB).
 *     Gmail's image-proxy timed out on the heavy ones, leaving recipients
 *     with broken-img placeholders.
 *   - Now emails reference https://lasstreffen.at/api/img/<eventId>?w=…&h=…
 *     instead. We fetch the upstream once, resize via sharp to a sensible
 *     box, JPEG-compress, and let Vercel's edge cache serve every
 *     subsequent recipient from a single warm cache entry.
 *
 * Benefits:
 *   - Single sender domain → better email deliverability (DKIM+SPF aligned)
 *   - Bounded payload (<60 KB per image after resize) → no proxy timeouts
 *   - Broken / 404 upstream → we return a deterministic placeholder PNG
 *     with the event category color, so the email layout still looks clean
 *
 * Caching:
 *   - public, max-age=2592000 (30 days)
 *   - s-maxage=2592000 — Vercel edge serves the cached binary, our function
 *     only runs on first miss per (eventId, w, h, fit) tuple
 *   - The image_url itself can change in the DB; for now that's fine because
 *     the event-id is stable and the email is one-shot. If you change a
 *     hero image and want emails sent within 30d to update, bump the cache
 *     by adding `?v=<image_url_hash>` to the URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ eventId: string }>;
}

const MAX_W = 1200;
const MAX_H = 800;
const DEFAULT_W = 320;
const DEFAULT_H = 240;
const FETCH_TIMEOUT_MS = 5000;
const PLACEHOLDER_TTL = 60 * 60 * 24; // 1 day for placeholders (let the event re-publish before we re-serve broken)
const CACHE_TTL = 60 * 60 * 24 * 30;  // 30 days for real images

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function service(): ReturnType<typeof createClient<any>> {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(req: NextRequest, ctx: Params) {
  const { eventId } = await ctx.params;
  const { searchParams } = req.nextUrl;

  // Bounded dimensions to prevent abuse (no 8000×8000 requests).
  const w = clamp(Number(searchParams.get('w')) || DEFAULT_W, 32, MAX_W);
  const h = clamp(Number(searchParams.get('h')) || DEFAULT_H, 32, MAX_H);
  const fit = (searchParams.get('fit') === 'contain' ? 'contain' : 'cover') as 'cover' | 'contain';

  // ── 1. Resolve the source URL from the DB ──────────────────────────────
  let imageUrl: string | null = null;
  let category: string | null = null;
  try {
    const sb = service();
    const { data } = await sb
      .from('events')
      .select('image_url, category')
      .eq('id', eventId)
      .single();
    imageUrl = data?.image_url ?? null;
    category = data?.category ?? null;
  } catch {
    /* fall through to placeholder */
  }

  // ── 2. Fetch + resize, or fall back to placeholder ─────────────────────
  if (imageUrl) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(imageUrl, {
        signal: ctrl.signal,
        // Identify as ourselves; some upstreams whitelist UA-fingerprinted bots.
        headers: { 'User-Agent': 'LassTreffenImgProxy/1.0 (+https://lasstreffen.at)' },
      });
      clearTimeout(timer);

      if (res.ok) {
        const ct = res.headers.get('content-type') ?? '';
        if (ct.startsWith('image/')) {
          const buf = Buffer.from(await res.arrayBuffer());
          const out = await sharp(buf)
            .rotate() // honour EXIF orientation
            .resize(w, h, { fit, background: '#fbf7ec' })
            .jpeg({ quality: 78, mozjpeg: true })
            .toBuffer();

          return new NextResponse(new Uint8Array(out), {
            status: 200,
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}, immutable`,
              'Content-Length': String(out.length),
            },
          });
        }
      }
    } catch {
      /* fall through to placeholder */
    }
  }

  // ── 3. Placeholder ─────────────────────────────────────────────────────
  const png = await placeholderPng(w, h, category);
  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': `public, max-age=${PLACEHOLDER_TTL}, s-maxage=${PLACEHOLDER_TTL}`,
      'Content-Length': String(png.length),
    },
  });
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
}

/**
 * Render a category-themed placeholder so a missing image still looks like
 * it belongs in the email. Soft cream background + a tinted block in the
 * category color + the category label centred. Pure sharp + svg, no
 * Canvas / external assets needed.
 */
async function placeholderPng(w: number, h: number, category: string | null): Promise<Buffer> {
  const color = categoryToHex(category);
  const label = (category ?? 'Event').toUpperCase();
  const fontSize = Math.max(14, Math.min(28, Math.round(w / 14)));

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.08"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="#fbf7ec"/>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text
      x="50%" y="50%"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="-apple-system, Segoe UI, Roboto, sans-serif"
      font-weight="800"
      font-size="${fontSize}"
      fill="${color}"
      letter-spacing="2"
    >${escapeXml(label)}</text>
  </svg>`;

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

function categoryToHex(category: string | null): string {
  if (!category) return '#c8553d';
  const map: Record<string, string> = {
    Konzert: '#c8553d',
    Musik: '#c8553d',
    Festival: '#d97706',
    Genuss: '#65a30d',
    Brunch: '#db2777',
    Stadtfest: '#2563eb',
    Sport: '#059669',
    Markt: '#ea580c',
    Theater: '#7c3aed',
    Kunst: '#9333ea',
    Familie: '#0891b2',
    Sonstiges: '#6b7280',
  };
  return map[category] ?? '#c8553d';
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
