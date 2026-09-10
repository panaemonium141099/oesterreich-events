/**
 * Nachtraegliche Reparatur falscher Blog-Hero-Bilder (fn-24).
 *
 * Befund 2026-09-10: alle vom Autowriter erzeugten Event-Posts trugen ein
 * Wikimedia-Commons-Foto, das nichts mit dem Event zu tun hat — der Hero von
 * "Science Busters for Kids" war das Cover von "YANK The Army Weekly" vom
 * 9. Maerz 1945, weil die Commons-Volltextsuche auf das Wort "Busters"
 * gematcht hat.
 *
 * Ursache: `resolveHero()` verwarf das Eventim-Artwork (222x222) als "zu
 * klein" und fiel auf eine ungefilterte Commons-Suche ueber den Event-Titel
 * zurueck. Fuer Eventim-Events haben wir das Nutzungsrecht am Originalbild —
 * das gehoert auf die Seite, auch wenn es klein ist.
 *
 * Dieses Script holt fuer jeden betroffenen Post das echte Bild nach:
 *   1. Event ueber `ticketUrl` in der DB finden (exakter Eventim-Deeplink),
 *      hilfsweise ueber den JSON-LD-Namen bzw. den Post-Titel.
 *   2. `events.image_url` laden, Hero-Datei ersetzen.
 *   3. `heroImageCredit` auf die Quelle setzen und `heroLayout: 'poster'`
 *      ergaenzen, wenn das Artwork schmaler als 900 px ist.
 *
 * Posts ohne auffindbares Originalbild werden NICHT angefasst, sondern am
 * Ende aufgelistet — lieber ein offener Rest als ein zweites falsches Bild.
 *
 * Aufruf: npx tsx src/scripts/repair-blog-heroes.ts [--dry-run] [--slug <slug>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, 'src', 'content', 'blog', 'posts');
const IMAGES_DIR = path.join(ROOT, 'public', 'images', 'blog');

/** Ab hier traegt ein Motiv den full-bleed-Hero; darunter Poster-Layout. */
const COVER_HERO_WIDTH = 900;
const MIN_HERO_WIDTH = 200;

function log(msg: string): void {
  console.log(msg);
}

/** Bildbreite/-hoehe aus JPEG-SOF- bzw. PNG-IHDR-Header (ohne Dependency). */
function imageDims(buf: Buffer): { w: number; h: number } | null {
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

interface Downloaded { ext: string; buf: Buffer; width: number; height: number }

async function downloadImage(url: string): Promise<Downloaded | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LassTreffenBot/1.0; +https://lasstreffen.at)' },
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

interface PostMeta {
  slug: string;
  file: string;
  src: string;
  title: string;
  ticketUrl?: string;
  jsonLdName?: string;
  heroImage: string;
  credit: string;
}

function readField(src: string, key: string): string | undefined {
  const m = src.match(new RegExp(`"${key}":\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? JSON.parse(`"${m[1]}"`) as string : undefined;
}

/**
 * Autowriter-Posts, deren Hero nachgezogen werden muss. Zwei Faelle:
 *   • Der Hero stammt noch aus der Commons-Volltextsuche (das eigentliche
 *     Problem: thematisch fremdes Foto).
 *   • Der Hero ist bereits ein Poster, aber ohne `heroImageWidth` — dann
 *     kennt die Seite die Originalbreite nicht und skaliert es hoch.
 */
function collectBrokenPosts(only?: string): PostMeta[] {
  const out: PostMeta[] = [];
  for (const name of fs.readdirSync(POSTS_DIR).sort()) {
    if (!name.endsWith('.ts')) continue;
    const slug = name.replace(/\.ts$/, '');
    if (only && slug !== only) continue;
    const file = path.join(POSTS_DIR, name);
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('Automatisch generiert vom Blog-Autowriter')) continue;
    const credit = readField(src, 'heroImageCredit') ?? '';
    const fromCommons = credit.includes('Wikimedia Commons');
    const posterOhneBreite = src.includes('"heroLayout": "poster"')
      && !src.includes('"heroImageWidth"');
    if (!fromCommons && !posterOhneBreite) continue;
    // Stay-Guides (fn-21) suchen Commons bewusst mit einer kuratierten
    // Ortsanfrage ("Graz Uhrturm Schlossberg") — dort ist das Foto richtig.
    if (slug.startsWith('uebernachten-')) continue;
    out.push({
      slug,
      file,
      src,
      title: readField(src, 'title') ?? slug,
      ticketUrl: readField(src, 'ticketUrl'),
      jsonLdName: readField(src, 'name'),
      heroImage: readField(src, 'heroImage') ?? '',
      credit,
    });
  }
  return out;
}

interface EventImage { imageUrl: string; sourceName: string | null }

/** Originalbild des Events finden — ausschliesslich ueber den Ticket-Deeplink.
 *
 *  Bewusst KEINE Titelsuche als Fallback: "Science Busters for Kids" wuerde
 *  darueber das Artwork von "Science Busters — Weltuntergang fuer
 *  Fortgeschrittene" erben, also wieder ein fremdes Bild. Genau diese Art
 *  unscharfer Zuordnung hat das Problem ueberhaupt erzeugt. Lieber ein Post
 *  ohne Bild als ein Post mit dem falschen. */
async function findEventImage(sb: SupabaseClient, post: PostMeta): Promise<EventImage | null> {
  if (!post.ticketUrl) return null;
  const pick = (rows: Array<{ image_url: string | null; source_name: string | null }> | null) => {
    const hit = (rows ?? []).find(r => r.image_url);
    return hit?.image_url ? { imageUrl: hit.image_url, sourceName: hit.source_name } : null;
  };

  const { data } = await sb.from('events')
    .select('image_url, source_name').eq('ticket_url', post.ticketUrl).limit(5);
  const hit = pick(data);
  if (hit) return hit;

  // Ohne Query-String nochmal — die Affiliate-Parameter koennen sich aendern.
  const bare = post.ticketUrl.split('?')[0];
  const { data: d2 } = await sb.from('events')
    .select('image_url, source_name').like('ticket_url', `${bare}%`).limit(5);
  return pick(d2);
}

/** heroImageCredit neu setzen, heroLayout und heroImageWidth ergaenzen. */
function rewritePost(
  src: string, credit: string, layout: 'cover' | 'poster', width: number,
): string {
  // Vorhandene Werte raus — sie werden unten neu gesetzt, falls noetig.
  let out = src.replace(/\n[ \t]*"heroLayout":\s*"[^"]*",/, '');
  out = out.replace(/\n[ \t]*"heroImageWidth":\s*\d+,/, '');
  const creditLine = /\n([ \t]*)"heroImageCredit":\s*"(?:[^"\\]|\\.)*",/;
  if (!creditLine.test(out)) throw new Error('heroImageCredit-Zeile nicht gefunden');
  out = out.replace(creditLine, (_m, indent: string) => {
    const credited = `\n${indent}"heroImageCredit": ${JSON.stringify(credit)},`;
    return layout === 'poster'
      ? `${credited}\n${indent}"heroLayout": "poster",\n${indent}"heroImageWidth": ${width},`
      : credited;
  });
  return out;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const only = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : undefined;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY erforderlich');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const posts = collectBrokenPosts(only);
  log(`${posts.length} Posts mit Commons-Hero gefunden\n`);

  const fixed: string[] = [];
  const unresolved: string[] = [];

  for (const post of posts) {
    const found = await findEventImage(sb, post);
    if (!found) {
      log(`SKIP  ${post.slug} — kein Event mit Bild in der DB`);
      unresolved.push(`${post.slug} (kein DB-Treffer)`);
      continue;
    }
    const dl = await downloadImage(found.imageUrl);
    if (!dl) {
      log(`SKIP  ${post.slug} — Download fehlgeschlagen: ${found.imageUrl}`);
      unresolved.push(`${post.slug} (Download ${found.imageUrl})`);
      continue;
    }
    const layout = dl.width >= COVER_HERO_WIDTH ? 'cover' : 'poster';
    const credit = `Foto: ${found.sourceName ?? 'Veranstalter'}`;
    log(`FIX   ${post.slug} — ${dl.width}x${dl.height} (${layout}) ${credit}`);

    if (dryRun) { fixed.push(post.slug); continue; }

    const destDir = path.join(IMAGES_DIR, post.slug);
    fs.mkdirSync(destDir, { recursive: true });
    // Alte Hero-Datei(en) entfernen, damit keine verwaiste hero.png liegen bleibt.
    for (const f of fs.readdirSync(destDir)) {
      if (/^hero\.(jpe?g|png|webp)$/i.test(f)) fs.unlinkSync(path.join(destDir, f));
    }
    fs.writeFileSync(path.join(destDir, `hero.${dl.ext}`), dl.buf);

    let src = rewritePost(post.src, credit, layout, dl.width);
    const newHero = `/images/blog/${post.slug}/hero.${dl.ext}`;
    src = src.replace(/("heroImage":\s*)"[^"]*"/, `$1${JSON.stringify(newHero)}`);
    // JSON-LD-Bildpfad mitziehen (absolute URL im Event-Schema).
    src = src.replace(
      /"image":\s*"https:\/\/lasstreffen\.at\/images\/blog\/[^"]*"/,
      `"image": ${JSON.stringify(`https://lasstreffen.at${newHero}`)}`,
    );
    fs.writeFileSync(post.file, src, 'utf8');
    fixed.push(post.slug);
  }

  log(`\n${fixed.length} repariert, ${unresolved.length} offen`);
  if (unresolved.length > 0) {
    log('\nOffen (Bild manuell setzen oder Post zurueckziehen):');
    for (const u of unresolved) log(`  - ${u}`);
  }
  if (dryRun) log('\n(dry-run — nichts geschrieben)');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
