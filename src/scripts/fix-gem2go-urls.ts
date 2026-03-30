/**
 * Fix-GEM2GO-URLs Script
 *
 * Testet NUR die fehlgeschlagenen Gemeinden (deren aktuelle URL keine GEM2GO-Seite liefert)
 * und versucht, funktionierende GEM2GO-URLs über alternative URL-Patterns zu finden.
 *
 * Kernproblem: Viele URLs redirecten zu Tourismus-Portalen statt zur echten GEM2GO-Seite.
 * Lösung: Redirect-Domains blockieren und HTML-Content auf GEM2GO-Marker prüfen.
 *
 * Run with: npm run fix-gem2go
 */

import * as fs from 'fs';
import * as path from 'path';
import { GEM2GO_GEMEINDEN, type Gem2GoGemeinde } from '../lib/scrapers/gemeinden/gem2goGemeinden';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONCURRENCY = 10;
const DELAY_MS = 300;
const TIMEOUT_MS = 5000;

const GEM2GO_FILE = path.resolve(__dirname, '../lib/scrapers/gemeinden/gem2goGemeinden.ts');

const GEM2GO_EVENTS_PATH = '/system/web/veranstaltung.aspx?sprache=1';

/** Markers that indicate a page is a GEM2GO page */
const GEM2GO_MARKERS = [
  'veranstaltungcmsliste',
  'va_list',
  'rasterlist',
  'bemcard',
  'system/web/veranstaltung',
  '/system/web/',
  'gem2go',
  'ctl00_',
];

/** Bundesland slug for URL patterns */
const BUNDESLAND_SLUG: Record<string, string> = {
  'Burgenland': 'bgld',
  'Kärnten': 'kaernten',
  'Niederösterreich': 'noe',
  'Oberösterreich': 'ooe',
  'Salzburg': 'sbg',
  'Steiermark': 'stmk',
  'Tirol': 'tirol',
  'Vorarlberg': 'vbg',
  'Wien': 'wien',
};

// ---------------------------------------------------------------------------
// Name normalisation helpers
// ---------------------------------------------------------------------------

function normalise(name: string): string {
  let n = name.toLowerCase();
  n = n.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  n = n.replace(/\./g, '-');
  n = n.replace(/\s+/g, '-');
  n = n.replace(/[^a-z0-9-]/g, '');
  n = n.replace(/-{2,}/g, '-');
  n = n.replace(/^-+|-+$/g, '');
  return n;
}

/** Strips common Austrian place-name qualifiers */
function stripQualifiers(name: string): string {
  return name.replace(/\s+(am|an der|an dem|im|bei|ob der|in der|in|ob)\s+.*$/i, '');
}

/** Converts "Sankt" / "St." to "st" */
function sanktToSt(name: string): string {
  return name.replace(/\bSankt\b/gi, 'St.').replace(/\bSt\.\s*/gi, 'St');
}

/** Extract bezirk as slug */
function bezirkSlug(bezirk: string): string {
  return normalise(bezirk.replace(/\(.*?\)/g, '').trim());
}

// ---------------------------------------------------------------------------
// URL candidate generation
// ---------------------------------------------------------------------------

function generateCandidateUrls(gemeinde: Gem2GoGemeinde): string[] {
  const raw = gemeinde.name;
  const blSlug = BUNDESLAND_SLUG[gemeinde.bundesland] ?? '';
  const bSlug = bezirkSlug(gemeinde.bezirk);
  const isTirol = gemeinde.bundesland === 'Tirol';

  // Build name variants
  const variants: string[] = [];

  // Full name normalised
  variants.push(normalise(raw));

  // Sankt → St
  if (/Sankt/i.test(raw)) {
    variants.push(normalise(sanktToSt(raw)));
    variants.push(normalise(raw.replace(/\bSankt\b/gi, 'St')));
  }
  // St. → st
  if (/\bSt\./i.test(raw)) {
    variants.push(normalise(raw.replace(/\bSt\.\s*/gi, 'Sankt ')));
    variants.push(normalise(raw.replace(/\bSt\.\s*/gi, 'St')));
  }

  // Stripped qualifiers
  const stripped = stripQualifiers(raw);
  if (stripped !== raw) {
    variants.push(normalise(stripped));
    if (/Sankt/i.test(stripped)) {
      variants.push(normalise(sanktToSt(stripped)));
    }
    if (/\bSt\./i.test(stripped)) {
      variants.push(normalise(stripped.replace(/\bSt\.\s*/gi, 'St')));
    }
  }

  const uniqueVariants = [...new Set(variants)];

  const urls: string[] = [];
  for (const v of uniqueVariants) {
    // Generic patterns
    urls.push(`https://www.${v}.gv.at`);
    urls.push(`https://www.${v}.at`);
    urls.push(`https://${v}.gv.at`);
    urls.push(`https://www.gemeinde-${v}.at`);

    // With bezirk
    if (bSlug && bSlug !== v) {
      urls.push(`https://www.${v}-${bSlug}.gv.at`);
    }

    // With bundesland
    if (blSlug) {
      urls.push(`https://www.${v}-${blSlug}.gv.at`);
    }

    // Tirol-specific patterns
    if (isTirol) {
      urls.push(`https://www.${v}.tirol.gv.at`);
      urls.push(`https://www.${v}-tirol.gv.at`);
      urls.push(`https://www.gemeinde-${v}.at`);
    }
  }

  return [...new Set(urls)];
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a URL with same-origin redirect policy.
 * Returns the HTML body if the response is OK and stays on the same domain.
 * Returns null if the URL fails, times out, or redirects to another domain.
 */
async function fetchGem2Go(url: string): Promise<string | null> {
  try {
    // Use manual redirect to check for cross-domain redirects
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GEM2GOUrlFixer/1.0)',
        'Accept': 'text/html',
      },
    });

    // If redirect, check if it's same-domain
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return null;

      // Resolve relative redirects
      const redirectUrl = new URL(location, url);
      const originalHost = new URL(url).hostname;
      const redirectHost = redirectUrl.hostname;

      // Block cross-domain redirects (the core problem!)
      if (redirectHost !== originalHost && !redirectHost.endsWith('.' + originalHost)) {
        return null;
      }

      // Follow same-domain redirect once
      const res2 = await fetch(redirectUrl.href, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GEM2GOUrlFixer/1.0)',
          'Accept': 'text/html',
        },
      });

      if (!res2.ok) return null;
      return await res2.text();
    }

    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Checks if HTML content contains GEM2GO markers.
 */
function isGem2GoContent(html: string): boolean {
  const lower = html.toLowerCase();
  return GEM2GO_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * Tests if a base URL has a working GEM2GO events page.
 * Returns true only if: URL responds, no cross-domain redirect, AND content has GEM2GO markers.
 */
async function testGem2GoUrl(baseUrl: string): Promise<boolean> {
  const eventsUrl = baseUrl.replace(/\/+$/, '') + GEM2GO_EVENTS_PATH;
  const html = await fetchGem2Go(eventsUrl);
  if (!html) return false;
  return isGem2GoContent(html);
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface UrlCorrection {
  gkz: string;
  name: string;
  oldUrl: string;
  newUrl: string;
}

interface ProcessResult {
  status: 'already_working' | 'fixed' | 'failed';
  correction?: UrlCorrection;
  gemeinde: Gem2GoGemeinde;
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

async function processGemeinde(gemeinde: Gem2GoGemeinde): Promise<ProcessResult> {
  // 1. Test current URL
  const currentWorks = await testGem2GoUrl(gemeinde.website);
  if (currentWorks) {
    return { status: 'already_working', gemeinde };
  }

  // 2. Try HTTPS variant if currently HTTP
  const httpsVariant = gemeinde.website.replace(/^http:\/\//, 'https://');
  if (httpsVariant !== gemeinde.website) {
    const httpsWorks = await testGem2GoUrl(httpsVariant);
    if (httpsWorks) {
      return {
        status: 'fixed',
        correction: {
          gkz: gemeinde.gkz,
          name: gemeinde.name,
          oldUrl: gemeinde.website,
          newUrl: httpsVariant,
        },
        gemeinde,
      };
    }
  }

  // 3. Try alternative URL patterns
  const candidates = generateCandidateUrls(gemeinde);
  const normExisting = gemeinde.website.replace(/\/+$/, '').replace(/^http:/, 'https:');

  for (const candidate of candidates) {
    const normCandidate = candidate.replace(/\/+$/, '');
    if (normCandidate === normExisting) continue;

    const works = await testGem2GoUrl(candidate);
    if (works) {
      return {
        status: 'fixed',
        correction: {
          gkz: gemeinde.gkz,
          name: gemeinde.name,
          oldUrl: gemeinde.website,
          newUrl: candidate,
        },
        gemeinde,
      };
    }

    // Tiny delay between candidates for same gemeinde
    await sleep(50);
  }

  return { status: 'failed', gemeinde };
}

async function processInBatches(
  gemeinden: Gem2GoGemeinde[],
): Promise<{ corrections: UrlCorrection[]; failed: Gem2GoGemeinde[]; alreadyWorking: number }> {
  const corrections: UrlCorrection[] = [];
  const failed: Gem2GoGemeinde[] = [];
  let alreadyWorking = 0;
  let processed = 0;

  for (let i = 0; i < gemeinden.length; i += CONCURRENCY) {
    const batch = gemeinden.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((g) => processGemeinde(g)));

    for (const result of results) {
      switch (result.status) {
        case 'already_working':
          alreadyWorking++;
          break;
        case 'fixed':
          corrections.push(result.correction!);
          console.log(`  FIXED: ${result.correction!.name} — ${result.correction!.oldUrl} → ${result.correction!.newUrl}`);
          break;
        case 'failed':
          failed.push(result.gemeinde);
          break;
      }
    }

    processed += batch.length;
    if (processed % 50 === 0 || processed === gemeinden.length) {
      console.log(`  Progress: ${processed}/${gemeinden.length} (Working: ${alreadyWorking}, Fixed: ${corrections.length}, Failed: ${failed.length})`);
    }

    if (i + CONCURRENCY < gemeinden.length) {
      await sleep(DELAY_MS);
    }
  }

  return { corrections, failed, alreadyWorking };
}

// ---------------------------------------------------------------------------
// File update
// ---------------------------------------------------------------------------

function updateGemeindenFile(corrections: UrlCorrection[]): void {
  if (corrections.length === 0) {
    console.log('\nNo corrections to apply.');
    return;
  }

  const content = fs.readFileSync(GEM2GO_FILE, 'utf-8');
  const lines = content.split('\n');

  const correctionMap = new Map<string, string>();
  for (const c of corrections) {
    correctionMap.set(c.gkz, c.newUrl);
  }

  let appliedCount = 0;

  const updatedLines = lines.map((line) => {
    const gkzMatch = line.match(/gkz:\s*'(\d+)'/);
    if (!gkzMatch) return line;

    const gkz = gkzMatch[1];
    const newUrl = correctionMap.get(gkz);
    if (!newUrl) return line;

    const updated = line.replace(
      /(website:\s*')[^']*(')/,
      `$1${newUrl}$2`,
    );

    if (updated !== line) {
      appliedCount++;
    }
    return updated;
  });

  fs.writeFileSync(GEM2GO_FILE, updatedLines.join('\n'), 'utf-8');
  console.log(`\nUpdated ${appliedCount} URLs in gem2goGemeinden.ts`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n=== Fix GEM2GO URLs ===`);
  console.log(`Total gemeinden: ${GEM2GO_GEMEINDEN.length}`);
  console.log(`Concurrency: ${CONCURRENCY}, Delay: ${DELAY_MS}ms, Timeout: ${TIMEOUT_MS}ms`);
  console.log(`Strategy: Test GEM2GO events path + validate HTML markers`);
  console.log(`Cross-domain redirects are BLOCKED\n`);

  console.log('Testing all gemeinden for working GEM2GO events pages...\n');
  const { corrections, failed, alreadyWorking } = await processInBatches(GEM2GO_GEMEINDEN);

  // Apply corrections
  if (corrections.length > 0) {
    console.log('\nUpdating gem2goGemeinden.ts...');
    updateGemeindenFile(corrections);
  }

  // Summary
  console.log(`\n=== Summary ===`);
  console.log(`Total gemeinden: ${GEM2GO_GEMEINDEN.length}`);
  console.log(`Already working (GEM2GO verified): ${alreadyWorking}`);
  console.log(`Fixed (new URL found): ${corrections.length}`);
  console.log(`Still failing: ${failed.length}`);

  if (corrections.length > 0) {
    console.log(`\nAll corrections:`);
    for (const c of corrections) {
      console.log(`  ${c.name}: ${c.oldUrl} → ${c.newUrl}`);
    }
  }

  if (failed.length > 0) {
    console.log(`\nFailed gemeinden (first 30):`);
    for (const g of failed.slice(0, 30)) {
      console.log(`  ${g.name} (${g.bundesland}, ${g.bezirk}) — ${g.website}`);
    }
    if (failed.length > 30) {
      console.log(`  ... and ${failed.length - 30} more`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
