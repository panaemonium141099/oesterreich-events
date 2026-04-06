import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local (Next.js does this automatically, but tsx does not)
try {
  const envPath = join(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* .env.local not found, rely on environment */ }

import { runAllScrapers, getScraperByName, runScraper, getAvailableScrapers } from '../lib/scrapers';
import { triggerMatchArtists } from '../lib/post-scrape-hook';

async function main() {
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf('--source');

  if (sourceIndex !== -1 && args[sourceIndex + 1]) {
    const sourceName = args[sourceIndex + 1];
    const scraper = getScraperByName(sourceName);

    if (!scraper) {
      console.error(`Unbekannter Scraper: ${sourceName}`);
      console.error(`Verfügbar: ${getAvailableScrapers().join(', ')}`);
      process.exit(1);
    }

    await runScraper(scraper);
  } else {
    await runAllScrapers();
  }

  // Post-scrape hook: trigger artist-event matching pipeline
  await triggerMatchArtists();
}

main().catch(err => {
  console.error('Fataler Fehler:', err);
  process.exit(1);
});
