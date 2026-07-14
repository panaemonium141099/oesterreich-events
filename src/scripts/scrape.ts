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

import {
  runAllScrapers,
  getScraperByName,
  runScraper,
  getAvailableScrapers,
  getScrapersForShard,
} from '../lib/scrapers';
import { triggerLineupPipeline, triggerMatchArtists } from '../lib/post-scrape-hook';

async function main() {
  const args = process.argv.slice(2);
  const sourceIndex = args.indexOf('--source');
  const shardIndex = args.indexOf('--shard');

  if (sourceIndex !== -1 && args[sourceIndex + 1]) {
    const sourceName = args[sourceIndex + 1];
    const scraper = getScraperByName(sourceName);

    if (!scraper) {
      console.error(`Unbekannter Scraper: ${sourceName}`);
      console.error(`Verfügbar: ${getAvailableScrapers().join(', ')}`);
      process.exit(1);
    }

    await runScraper(scraper);
  } else if (shardIndex !== -1 && args[shardIndex + 1]) {
    // --shard i/N: deterministische Teilmenge für parallele CI-Jobs
    // (MASTERPLAN §5 — der 6h-Monolith wird in Shards zerlegt). Die
    // Post-Scrape-Hooks (Lineups + Artist-Matching) laufen bewusst NICHT
    // pro Shard, sondern einmal im Post-Processing-Job des Workflows.
    const m = /^(\d+)\/(\d+)$/.exec(args[shardIndex + 1]);
    if (!m) {
      console.error(`Ungültiges --shard Format (erwartet i/N): ${args[shardIndex + 1]}`);
      process.exit(1);
    }
    const subset = getScrapersForShard(parseInt(m[1], 10), parseInt(m[2], 10));
    console.log(`Shard ${m[1]}/${m[2]}: ${subset.map(s => s.name).join(', ')}`);
    await runAllScrapers(subset);
    return; // keine Hooks im Shard-Modus
  } else {
    await runAllScrapers();
  }

  // Post-scrape hook: scrapers -> lineup scraping + derivation -> artist matching
  await triggerLineupPipeline();
  await triggerMatchArtists();
}

// Expliziter Exit statt auf das Leerlaufen des Event-Loops zu warten:
// getimeoutete Scraper laufen ohne AbortSignal im Hintergrund weiter und
// halten den Prozess mit offenen Sockets am Leben. Run 29305622984:
// Shard 1 war um 04:43 fertig ("Scraping abgeschlossen"), der Prozess
// endete erst 08:06 — 3h23min Zombie; Shards 0/2/8 hingen bis zum
// GitHub-300-min-Kill. Alle Writes (Sync, Telemetrie) sind vor dem
// Resolve von main() awaited — exit(0) ist hier verlustfrei.
main().then(
  () => process.exit(0),
  err => {
    console.error('Fataler Fehler:', err);
    process.exit(1);
  },
);
