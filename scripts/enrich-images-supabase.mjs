#!/usr/bin/env node
/**
 * enrich-images-supabase.mjs
 *
 * Fetches og:image / twitter:image / content images from event source_url
 * for all Supabase events that have no image_url.
 *
 * Usage: node scripts/enrich-images-supabase.mjs [--limit N] [--source SOURCE_NAME]
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load env
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Parse CLI args
const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const MAX_EVENTS = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 5000;
const sourceIdx = args.indexOf('--source');
const SOURCE_FILTER = sourceIdx >= 0 ? args[sourceIdx + 1] : null;

const USER_AGENT = 'AustriaEvents-ImageEnrich/1.0 (educational)';

// Known bad image patterns
const BAD_PATTERNS = [
  'placeholder', 'default', 'noimage', 'kein-bild', 'no-image',
  'logo', 'icon', '.svg', 'tracking', 'pixel', 'spacer',
  'data:image', 'base64', '1x1', 'blank',
];

function isBadImage(url) {
  const lower = url.toLowerCase();
  return BAD_PATTERNS.some(p => lower.includes(p));
}

function fetchPage(url, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-AT,de;q=0.9',
      },
      timeout: timeoutMs,
    }, (res) => {
      // Follow one redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href;
        const mod2 = redirectUrl.startsWith('https') ? https : http;
        mod2.get(redirectUrl, {
          headers: { 'User-Agent': USER_AGENT },
          timeout: timeoutMs,
        }, (res2) => {
          let data = '';
          res2.on('data', chunk => data += chunk);
          res2.on('end', () => resolve(data));
        }).on('error', () => resolve(null));
        return;
      }
      if (res.statusCode !== 200) { resolve(null); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function extractImage(html, sourceUrl) {
  if (!html) return null;

  // 1. og:image
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch && !isBadImage(ogMatch[1])) {
    return makeAbsolute(ogMatch[1], sourceUrl);
  }

  // 2. twitter:image
  const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
  if (twMatch && !isBadImage(twMatch[1])) {
    return makeAbsolute(twMatch[1], sourceUrl);
  }

  // 3. JSON-LD image
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const ld = JSON.parse(jsonLdMatch[1]);
      const img = ld.image || ld.thumbnailUrl || (ld['@graph'] && ld['@graph'].find(i => i.image)?.image);
      if (typeof img === 'string' && !isBadImage(img)) return makeAbsolute(img, sourceUrl);
      if (Array.isArray(img) && img[0] && !isBadImage(String(img[0]))) return makeAbsolute(String(img[0]), sourceUrl);
      if (img?.url && !isBadImage(img.url)) return makeAbsolute(img.url, sourceUrl);
    } catch { /* ignore */ }
  }

  // 4. First large content image (in article/main area)
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (isBadImage(src)) continue;
    // Check for width attribute >=200 or common content image paths
    const widthMatch = match[0].match(/width=["']?(\d+)/);
    const hasSize = widthMatch && parseInt(widthMatch[1]) >= 200;
    const isContentPath = /upload|image|foto|photo|fileadmin|media|content|GetImage/i.test(src);
    if (hasSize || isContentPath) {
      return makeAbsolute(src, sourceUrl);
    }
  }

  return null;
}

function makeAbsolute(url, base) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('=== Enrich Missing Event Images (Supabase) ===');
  console.log(`Max events: ${MAX_EVENTS}${SOURCE_FILTER ? `, source: ${SOURCE_FILTER}` : ''}\n`);

  // Fetch events without images
  let query = supabase
    .from('events')
    .select('id, title, source_url, source_name, category')
    .is('image_url', null)
    .not('source_url', 'is', null)
    .limit(MAX_EVENTS);

  if (SOURCE_FILTER) {
    query = query.eq('source_name', SOURCE_FILTER);
  }

  const { data: events, error } = await query;
  if (error) { console.error('Fetch error:', error.message); return; }

  console.log(`Found ${events.length} events without images\n`);

  let enriched = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Skip listing pages (not event detail)
    if (event.source_url.includes('/alle-termine') || event.source_url.endsWith('/veranstaltung.aspx?sprache=1')) {
      skipped++;
      continue;
    }

    try {
      const html = await fetchPage(event.source_url);
      const imageUrl = extractImage(html, event.source_url);

      if (imageUrl) {
        const { error: updErr } = await supabase
          .from('events')
          .update({ image_url: imageUrl })
          .eq('id', event.id);

        if (!updErr) {
          enriched++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    } catch {
      failed++;
    }

    if ((i + 1) % 100 === 0) {
      console.log(`[${i + 1}/${events.length}] enriched=${enriched}, failed=${failed}, skipped=${skipped}`);
    }

    // Rate limit: 500ms between requests
    await sleep(500);
  }

  console.log(`\n=== DONE ===`);
  console.log(`Enriched: ${enriched}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
