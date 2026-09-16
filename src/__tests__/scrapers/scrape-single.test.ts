import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/scrapers', () => ({ getScraperByName: vi.fn(), runScraper: vi.fn() }));
vi.mock('../../lib/reporting/workflow-run', () => ({ startWorkflowRun: vi.fn(), finishWorkflowRun: vi.fn() }));
import { getScraperByName, runScraper } from '../../lib/scrapers';
import { startWorkflowRun, finishWorkflowRun } from '../../lib/reporting/workflow-run';
import { runSingleScraper } from '../../scripts/scrape-single';
import { MeinBezirkScraper } from '../../lib/scrapers/MeinBezirkScraper';

describe('isolated single scraper reporting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getScraperByName).mockReturnValue(new MeinBezirkScraper());
    vi.mocked(startWorkflowRun).mockResolvedValue('report-id');
    vi.mocked(finishWorkflowRun).mockResolvedValue();
    vi.mocked(runScraper).mockResolvedValue({ eventsFound: 20, eventsUpserted: 18, durationMs: 60000 });
  });
  it('runs only the selected source and queues a report with accurate counts', async () => {
    expect(await runSingleScraper('meinbezirk')).toBe(true);
    expect(runScraper).toHaveBeenCalledTimes(1);
    expect(startWorkflowRun).toHaveBeenCalledWith('scrape-meinbezirk', 'github_dispatch');
    expect(finishWorkflowRun).toHaveBeenCalledWith('report-id', expect.objectContaining({
      status: 'success', summary: '20 Events gefunden, 18 gespeichert.',
    }));
  });
  it('reports swallowed scraper failures and returns a failure exit result', async () => {
    vi.mocked(runScraper).mockResolvedValue({ eventsFound: 0, eventsUpserted: 0, durationMs: 60000, error: 'Timeout' });
    expect(await runSingleScraper('meinbezirk')).toBe(false);
    expect(finishWorkflowRun).toHaveBeenCalledWith('report-id', expect.objectContaining({ status: 'failed', errors: ['Timeout'] }));
  });
  it('does not start if the email report cannot be registered', async () => {
    vi.mocked(startWorkflowRun).mockResolvedValue(null);
    await expect(runSingleScraper('meinbezirk')).rejects.toThrow('nicht registriert');
    expect(runScraper).not.toHaveBeenCalled();
  });
  it('records unexpected errors', async () => {
    vi.mocked(runScraper).mockRejectedValue(new Error('Unexpected failure'));
    await expect(runSingleScraper('meinbezirk')).rejects.toThrow('Unexpected failure');
    expect(finishWorkflowRun).toHaveBeenCalledWith('report-id', { status: 'failed', errors: ['Unexpected failure'] });
  });
});
