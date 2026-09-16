import { getScraperByName, runScraper } from '../lib/scrapers';
import { startWorkflowRun, finishWorkflowRun } from '../lib/reporting/workflow-run';
import { isDirectRun } from './lib/is-direct-run';

/** Isolated manual run: no lineup scrapers, artist matching or global post-processing. */
export async function runSingleScraper(source: string): Promise<boolean> {
  const scraper = getScraperByName(source);
  if (!scraper) throw new Error(`Unbekannter Scraper: ${source}`);
  const reportId = await startWorkflowRun(`scrape-${source}`, 'github_dispatch');
  if (!reportId) throw new Error('Abschlussbericht konnte nicht registriert werden; Scraper nicht gestartet.');
  try {
    const result = await runScraper(scraper);
    await finishWorkflowRun(reportId, {
      status: result.error ? 'failed' : 'success',
      summary: `${result.eventsFound} Events gefunden, ${result.eventsUpserted} gespeichert${result.error ? ' — Fehler aufgetreten' : ''}.`,
      metrics: {
        Quelle: source,
        'Events gefunden': result.eventsFound,
        'Events gespeichert (neu oder aktualisiert)': result.eventsUpserted,
        'Dauer (Minuten)': Math.round(result.durationMs / 6000) / 10,
      },
      errors: result.error ? [result.error] : [],
    });
    return !result.error;
  } catch (err) {
    await finishWorkflowRun(reportId, {
      status: 'failed', errors: [err instanceof Error ? err.message : String(err)],
    });
    throw err;
  }
}

if (isDirectRun(import.meta.url)) {
  runSingleScraper(process.argv[2] || '').then(
    ok => process.exit(ok ? 0 : 1),
    err => { console.error(err); process.exit(1); },
  );
}
