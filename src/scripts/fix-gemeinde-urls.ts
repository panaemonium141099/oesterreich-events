/**
 * Fix-Gemeinde-URLs Script
 *
 * Testet alle Gemeinde-URLs aus gem2goGemeinden.ts und versucht,
 * fehlerhafte URLs durch alternative Patterns zu ersetzen.
 *
 * Run with: npm run fix-urls
 */

import * as fs from 'fs';
import * as path from 'path';
import { GEM2GO_GEMEINDEN, type Gem2GoGemeinde } from '../lib/scrapers/gemeinden/gem2goGemeinden';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONCURRENCY = 5;
const DELAY_MS = 500;
const TIMEOUT_MS = 5000;
const MAX_WEBSEARCH_ATTEMPTS = 50;

const GEM2GO_FILE = path.resolve(__dirname, '../lib/scrapers/gemeinden/gem2goGemeinden.ts');

/** Bundesland abbreviations used in some URL patterns */
const BUNDESLAND_KUERZEL: Record<string, string> = {
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

/** Event sub-paths to probe on a candidate base URL */
const EVENT_PATHS = [
  '/system/web/veranstaltung.aspx?sprache=1',
  '/veranstaltungen',
  '/termine',
  '/events',
];

// ---------------------------------------------------------------------------
// Name normalisation helpers
// ---------------------------------------------------------------------------

function normalise(name: string): string {
  let n = name.toLowerCase();
  // Umlauts & sharp-s
  n = n.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  // Spaces to hyphens
  n = n.replace(/\s+/g, '-');
  // Remove characters that are not alphanumeric or hyphen
  n = n.replace(/[^a-z0-9-]/g, '');
  // Collapse repeated hyphens
  n = n.replace(/-{2,}/g, '-');
  // Trim leading/trailing hyphens
  n = n.replace(/^-+|-+$/g, '');
  return n;
}

/** Strips common Austrian place-name qualifiers */
function stripQualifiers(name: string): string {
  // Remove trailing qualifiers like "am See", "an der Leitha", "im Burgenland", etc.
  let n = name;
  n = n.replace(/\s+(am|an der|an dem|im|bei|ob der|in der|in|ob)\s+.*$/i, '');
  return n;
}

/** Converts "Sankt" to "st" */
function sanktToSt(name: string): string {
  return name.replace(/\bSankt\b/gi, 'St.');
}

// ---------------------------------------------------------------------------
// URL candidate generation
// ---------------------------------------------------------------------------

function generateCandidateBaseUrls(gemeinde: Gem2GoGemeinde): string[] {
  const raw = gemeinde.name;
  const kuerzel = BUNDESLAND_KUERZEL[gemeinde.bundesland] ?? '';

  // Build several name variants
  const variants: string[] = [];

  // Full name normalised
  variants.push(normalise(raw));

  // With Sankt → St.
  if (/Sankt/i.test(raw)) {
    variants.push(normalise(sanktToSt(raw)));
    // Also "st-" without dot
    variants.push(normalise(raw.replace(/\bSankt\b/gi, 'St')));
  }

  // Stripped qualifiers
  const stripped = stripQualifiers(raw);
  if (stripped !== raw) {
    variants.push(normalise(stripped));
    if (/Sankt/i.test(stripped)) {
      variants.push(normalise(sanktToSt(stripped)));
    }
  }

  // De-duplicate
  const uniqueVariants = [...new Set(variants)];

  const urls: string[] = [];
  for (const v of uniqueVariants) {
    urls.push(`https://www.${v}.gv.at`);
    urls.push(`https://www.${v}.at`);
    urls.push(`https://${v}.gv.at`);
    urls.push(`https://${v}.at`);
    urls.push(`https://www.gemeinde-${v}.at`);
    urls.push(`https://www.stadtgemeinde-${v}.at`);
    urls.push(`https://www.marktgemeinde-${v}.at`);
    if (kuerzel) {
      urls.push(`https://www.${v}-${kuerzel}.gv.at`);
    }
  }

  // De-duplicate the final list
  return [...new Set(urls)];
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function testUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GemeindeURLFixer/1.0)',
      },
    });
    return res.ok; // 200-299
  } catch {
    return false;
  }
}

/** Tests whether a base URL has a working events sub-path. Returns the full base URL or null. */
async function findWorkingEventUrl(baseUrl: string): Promise<string | null> {
  for (const ePath of EVENT_PATHS) {
    const full = baseUrl.replace(/\/+$/, '') + ePath;
    if (await testUrl(full)) {
      return baseUrl;
    }
  }
  return null;
}

/** Tests a base URL itself (just the root). */
async function testBaseUrl(baseUrl: string): Promise<boolean> {
  return testUrl(baseUrl.replace(/\/+$/, '') + '/');
}

// ---------------------------------------------------------------------------
// Concurrency / rate-limit helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type CorrectionMethod = 'pattern' | 'websearch';

interface UrlCorrection {
  gkz: string;
  name: string;
  oldUrl: string;
  newUrl: string;
  method: CorrectionMethod;
}

interface ProcessResult {
  status: 'ok' | 'fixed' | 'failed';
  correction?: UrlCorrection;
  gemeinde: Gem2GoGemeinde;
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

async function processGemeinde(gemeinde: Gem2GoGemeinde): Promise<ProcessResult> {
  // 1. Test the existing URL
  const existingWorks = await testBaseUrl(gemeinde.website);
  if (existingWorks) {
    return { status: 'ok', gemeinde };
  }

  // 2. Try the existing URL with https (in case it's http that now redirects)
  const httpsVariant = gemeinde.website.replace(/^http:\/\//, 'https://');
  if (httpsVariant !== gemeinde.website && (await testBaseUrl(httpsVariant))) {
    const correction: UrlCorrection = {
      gkz: gemeinde.gkz,
      name: gemeinde.name,
      oldUrl: gemeinde.website,
      newUrl: httpsVariant,
      method: 'pattern',
    };
    return { status: 'fixed', correction, gemeinde };
  }

  // 3. Try alternative URL patterns
  const candidates = generateCandidateBaseUrls(gemeinde);
  for (const candidate of candidates) {
    // Skip if same as existing (with or without trailing slash, http vs https)
    const normExisting = gemeinde.website.replace(/\/+$/, '');
    const normHttps = httpsVariant.replace(/\/+$/, '');
    const normCandidate = candidate.replace(/\/+$/, '');
    if (normCandidate === normExisting || normCandidate === normHttps) {
      continue;
    }

    // First test the GEM2GO event path specifically
    const eventUrl = await findWorkingEventUrl(candidate);
    if (eventUrl) {
      const correction: UrlCorrection = {
        gkz: gemeinde.gkz,
        name: gemeinde.name,
        oldUrl: gemeinde.website,
        newUrl: eventUrl,
        method: 'pattern',
      };
      return { status: 'fixed', correction, gemeinde };
    }

    // Then just the base URL
    if (await testBaseUrl(candidate)) {
      const correction: UrlCorrection = {
        gkz: gemeinde.gkz,
        name: gemeinde.name,
        oldUrl: gemeinde.website,
        newUrl: candidate,
        method: 'pattern',
      };
      return { status: 'fixed', correction, gemeinde };
    }

    await sleep(100); // Small delay between candidates within one gemeinde
  }

  return { status: 'failed', gemeinde };
}

async function processInBatches(
  gemeinden: Gem2GoGemeinde[],
  batchSize: number,
  delayMs: number,
): Promise<{ corrections: UrlCorrection[]; failed: Gem2GoGemeinde[]; okCount: number }> {
  const corrections: UrlCorrection[] = [];
  const failed: Gem2GoGemeinde[] = [];
  let okCount = 0;
  let processed = 0;

  for (let i = 0; i < gemeinden.length; i += batchSize) {
    const batch = gemeinden.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((g) => processGemeinde(g)));

    for (const result of results) {
      switch (result.status) {
        case 'ok':
          okCount++;
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
      console.log(`  Progress: ${processed}/${gemeinden.length} tested (OK: ${okCount}, Fixed: ${corrections.length}, Failed: ${failed.length})`);
    }

    if (i + batchSize < gemeinden.length) {
      await sleep(delayMs);
    }
  }

  return { corrections, failed, okCount };
}

// ---------------------------------------------------------------------------
// Web-search fallback (for up to MAX_WEBSEARCH_ATTEMPTS failed gemeinden)
// ---------------------------------------------------------------------------

async function webSearchFallback(failed: Gem2GoGemeinde[]): Promise<UrlCorrection[]> {
  const corrections: UrlCorrection[] = [];
  const toSearch = failed.slice(0, MAX_WEBSEARCH_ATTEMPTS);

  if (toSearch.length === 0) return corrections;

  console.log(`\nWeb-search fallback for ${toSearch.length} gemeinden...`);

  for (const gemeinde of toSearch) {
    const query = `${gemeinde.name} veranstaltungen ${gemeinde.bundesland} gemeinde website`;
    console.log(`  Searching: "${query}"`);

    try {
      // Use a simple Google search via fetch and parse the first result
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=3`;
      const res = await fetch(searchUrl, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!res.ok) {
        console.log(`    Google returned ${res.status}, skipping.`);
        await sleep(2000);
        continue;
      }

      const html = await res.text();

      // Extract URLs from Google results — look for patterns like /url?q=https://...
      const urlMatches = html.match(/\/url\?q=(https?:\/\/[^&"]+)/g);
      if (urlMatches) {
        for (const match of urlMatches) {
          const extracted = decodeURIComponent(match.replace('/url?q=', '')).split('&')[0];
          // Skip google/youtube/wikipedia
          if (
            /google\.|youtube\.|wikipedia\.|facebook\.|instagram\./i.test(extracted)
          ) {
            continue;
          }

          // Extract base URL (just the origin)
          try {
            const parsed = new URL(extracted);
            const baseUrl = parsed.origin;

            if (await testBaseUrl(baseUrl)) {
              corrections.push({
                gkz: gemeinde.gkz,
                name: gemeinde.name,
                oldUrl: gemeinde.website,
                newUrl: baseUrl,
                method: 'websearch',
              });
              console.log(`    FOUND: ${gemeinde.name} → ${baseUrl}`);
              break;
            }
          } catch {
            // Invalid URL, skip
          }
        }
      }
    } catch (err) {
      console.log(`    Search failed for ${gemeinde.name}: ${err}`);
    }

    await sleep(2000); // Rate limit for web search
  }

  return corrections;
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

  // Build a map of gkz → new URL for quick lookup
  const correctionMap = new Map<string, string>();
  for (const c of corrections) {
    correctionMap.set(c.gkz, c.newUrl);
  }

  let appliedCount = 0;

  // Process line by line — each gemeinde entry is a single line
  const updatedLines = lines.map((line) => {
    // Check if this line contains a gkz we need to update
    const gkzMatch = line.match(/gkz:\s*'(\d+)'/);
    if (!gkzMatch) return line;

    const gkz = gkzMatch[1];
    const newUrl = correctionMap.get(gkz);
    if (!newUrl) return line;

    // Replace the website value on this line
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
  console.log(`\n=== Fix Gemeinde URLs ===`);
  console.log(`Total gemeinden: ${GEM2GO_GEMEINDEN.length}`);
  console.log(`Concurrency: ${CONCURRENCY}, Delay: ${DELAY_MS}ms, Timeout: ${TIMEOUT_MS}ms\n`);

  // Phase 1: Test all URLs and try pattern-based fixes
  console.log('Phase 1: Testing URLs and trying pattern-based alternatives...\n');
  const { corrections: patternCorrections, failed, okCount } = await processInBatches(
    GEM2GO_GEMEINDEN,
    CONCURRENCY,
    DELAY_MS,
  );

  console.log(`\nPhase 1 complete:`);
  console.log(`  Already working: ${okCount}`);
  console.log(`  Pattern-based corrections: ${patternCorrections.length}`);
  console.log(`  Still failing: ${failed.length}`);

  // Phase 2: Web-search fallback for remaining failures
  const searchCorrections = await webSearchFallback(failed);
  console.log(`\nPhase 2 complete:`);
  console.log(`  Web-search corrections: ${searchCorrections.length}`);

  // Combine all corrections
  const allCorrections = [...patternCorrections, ...searchCorrections];

  // Phase 3: Update the file
  console.log('\nPhase 3: Updating gem2goGemeinden.ts...');
  updateGemeindenFile(allCorrections);

  // Summary
  const stillFailing = failed.length - searchCorrections.length;
  console.log(`\n=== Summary ===`);
  console.log(`Total gemeinden: ${GEM2GO_GEMEINDEN.length}`);
  console.log(`URLs already working: ${okCount}`);
  console.log(`Fixed via patterns: ${patternCorrections.length}`);
  console.log(`Fixed via web-search: ${searchCorrections.length}`);
  console.log(`Total fixed: ${allCorrections.length}`);
  console.log(`Still failing: ${stillFailing}`);

  if (allCorrections.length > 0) {
    console.log(`\nAll corrections:`);
    for (const c of allCorrections) {
      console.log(`  [${c.method}] ${c.name} (${c.gkz}): ${c.oldUrl} → ${c.newUrl}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
