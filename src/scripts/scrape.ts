import { runAllScrapers, getScraperByName, runScraper, getAvailableScrapers } from '../lib/scrapers';

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
}

main().catch(err => {
  console.error('Fataler Fehler:', err);
  process.exit(1);
});
